import errno
import logging

from app import db
from app.config import settings
from app.models import inference, registry
from app.models.media import MediaError
from app.workers.celery_app import celery_app

log = logging.getLogger(__name__)


class ModelLoadError(Exception):
    """Kept separate from RuntimeError so a broken model isn't mistaken for a GPU fault."""


def _fail(job_id: str, code: str, message: str) -> None:
    db.update_job(job_id, status="failed", error_code=code, error=message, completed_at=db.now())
    log.warning("job=%s event=failed code=%s", job_id, code)


@celery_app.task(name="process_job")
def process_job(job_id: str) -> None:
    job = db.get_job(job_id)
    if job is None:
        log.info("job=%s event=skipped reason=deleted", job_id)
        return

    try:
        device = registry.resolve_device(job["device_requested"])
    except registry.RequestError as exc:
        if db.transition(job_id, "queued", "processing", started_at=db.now()):
            _fail(job_id, exc.code, str(exc))
        return

    if not db.transition(job_id, "queued", "processing", started_at=db.now(), device=device):
        log.info("job=%s event=skipped reason=no-longer-queued", job_id)  # cancelled first
        return
    log.info("job=%s event=started model=%s device=%s", job_id, job["model"], device)

    prompt = registry.parse_prompt(job["prompt"]) if registry.get_spec(job["model"]).needs_prompt else None

    def load_model():
        try:
            return registry.load_model(job["model"], prompt)
        except Exception as exc:
            raise ModelLoadError(str(exc)) from exc

    def on_progress(done: int, expected: int) -> None:
        # The frame count is only an estimate until decoding ends, so hold below 100%.
        progress = min(done / expected, 0.99) if expected else 0.0
        fields = {"frames_done": done, "progress": round(progress, 4)}
        if expected:
            fields["frame_count"] = expected  # estimate shown while processing; replaced on completion
        db.update_job(job_id, **fields)

    try:
        summary = inference.process_media(
            job["media_type"],
            settings.uploads_dir / job_id / f"input.{job['input_ext']}",
            settings.results_dir / job_id,
            load_model,
            job["model"],
            device,
            job["conf"],
            on_progress,
        )
    except MediaError as exc:
        _fail(job_id, exc.code, str(exc))
    except ModelLoadError:
        log.exception("job=%s event=model-load-error", job_id)
        _fail(job_id, "MODEL_LOAD_FAILED", "Model could not be loaded.")
    except OSError as exc:
        log.exception("job=%s event=os-error", job_id)
        if exc.errno == errno.ENOSPC:
            _fail(job_id, "DISK_FULL", "The server ran out of disk space.")
        else:
            _fail(job_id, "INFERENCE_FAILED", "Inference failed.")
    except Exception:
        log.exception("job=%s event=error", job_id)
        _fail(job_id, "INFERENCE_FAILED", "Inference failed.")
    else:
        db.update_job(
            job_id,
            status="completed",
            progress=1.0,
            frames_done=summary["frame_count"] or 1,
            device=summary["device"],
            width=summary["width"],
            height=summary["height"],
            fps=summary["fps"],
            frame_count=summary["frame_count"],
            duration_ms=summary["duration_ms"],
            tracking=summary["tracking"],
            warnings=summary["warnings"],
            completed_at=db.now(),
        )
        log.info("job=%s event=completed device=%s warnings=%d", job_id, summary["device"], len(summary["warnings"]))
