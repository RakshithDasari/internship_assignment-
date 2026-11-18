import hashlib
import json
import logging
import re
import shutil
import time
import uuid
from dataclasses import asdict
from pathlib import Path

import redis
from fastapi import APIRouter, FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import db
from app.config import settings
from app.models import registry
from app.models.media import detect_media_type, find_ffmpeg
from app.workers.celery_app import celery_app
from app.workers.tasks import process_job

log = logging.getLogger(__name__)
router = APIRouter()

JOB_ID = re.compile(r"^[0-9a-f]{32}$")
IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
CHUNK_BYTES = 1024 * 1024
MULTIPART_OVERHEAD_BYTES = 1024 * 1024
HEALTH_CACHE_S = 5.0
PROMPT_CODES = {"PROMPT_REQUIRED", "PROMPT_INVALID"}


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message, "code": code})


def install_error_handlers(app: FastAPI) -> None:
    """Every error leaves the API as {"detail": ..., "code": ...}; tracebacks stay in the log."""

    @app.exception_handler(ApiError)
    def _api_error(_, exc: ApiError):
        return _error(exc.status, exc.code, str(exc))

    @app.exception_handler(registry.RequestError)
    def _request_error(_, exc: registry.RequestError):
        return _error(422 if exc.code in PROMPT_CODES else 400, exc.code, str(exc))

    @app.exception_handler(RequestValidationError)
    def _validation_error(_, exc: RequestValidationError):
        first = exc.errors()[0]
        field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
        return _error(422, "VALIDATION_ERROR", f"Invalid {field}: {first.get('msg', 'bad value')}")

    @app.exception_handler(StarletteHTTPException)
    def _http_error(_, exc: StarletteHTTPException):
        return _error(exc.status_code, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR", str(exc.detail))

    @app.exception_handler(Exception)
    def _unexpected(_, exc: Exception):
        ref = uuid.uuid4().hex[:8]
        log.error("Unhandled error ref=%s", ref, exc_info=exc)
        return _error(500, "INTERNAL", f"Something went wrong (ref {ref}).")


# --- helpers -------------------------------------------------------------------------------------

def _job_or_404(job_id: str) -> dict:
    # Validate before any path is built from the ID.
    job = db.get_job(job_id) if JOB_ID.match(job_id) else None
    if job is None:
        raise ApiError(404, "JOB_NOT_FOUND", "Job not found.")
    return job


def _public(job: dict, same_file: bool) -> dict:
    out = {k: v for k, v in job.items() if k != "input_ext"}
    out["queue_position"] = db.queue_position(job["job_id"]) if job["status"] == "queued" else None
    out["same_file"] = same_file
    done = job["status"] == "completed"
    out["result_url"] = f"/jobs/{job['job_id']}/result" if done else None
    out["metadata_url"] = f"/jobs/{job['job_id']}/metadata" if done else None
    return out


def _completed_file(job: dict, name: str) -> Path:
    if job["status"] != "completed":
        raise ApiError(409, "NOT_READY", "This job hasn't finished processing yet.")
    path = settings.results_dir / job["job_id"] / name
    if not path.is_file():
        raise ApiError(410, "RESULT_MISSING", "Result files are missing.")
    return path


def _clean_filename(name: str) -> str:
    name = Path(name.replace("\\", "/")).name  # drop any client-side directory parts
    return "".join(c for c in name if c.isprintable())[:255] or "upload"


def _remove_job_files(job_id: str) -> None:
    for folder in (settings.uploads_dir / job_id, settings.results_dir / job_id,
                   settings.results_dir / f"{job_id}.tmp"):
        shutil.rmtree(folder, ignore_errors=True)


# --- upload --------------------------------------------------------------------------------------

@router.post("/upload", status_code=202)
def upload(
    request: Request,
    file: UploadFile | None = File(None),
    model: str | None = Form(None),
    conf: str | None = Form(None),
    prompt: str | None = Form(None),
    device: str = Form("auto"),
):
    if file is None or not file.filename:
        raise ApiError(422, "NO_FILE", "Please choose a file to upload.")
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in settings.allowed_extensions:
        allowed = ", ".join(sorted(e.upper() for e in settings.allowed_extensions))
        raise ApiError(415, "UNSUPPORTED_TYPE", f"Unsupported file format. Please upload {allowed}.")

    spec = registry.get_spec(model or settings.default_model)
    try:
        confidence = float(conf) if conf not in (None, "") else settings.default_confidence
    except ValueError:
        confidence = -1.0
    if not 0.01 <= confidence <= 1.0:
        raise ApiError(422, "INVALID_CONFIDENCE", "Confidence must be a number between 0.01 and 1.")
    prompt_text = ", ".join(registry.parse_prompt(prompt)) if spec.needs_prompt else None
    registry.resolve_device(device)  # rejects bad values and "gpu" on a CPU-only server

    # Fast reject for honest clients. UploadFile is already spooled to a temp file
    # by the time we run, so a client lying about Content-Length is only caught by the byte
    # count below; a streaming multipart parser would close that gap.
    declared = int(request.headers.get("content-length") or 0)
    if declared > settings.max_file_size_bytes + MULTIPART_OVERHEAD_BYTES:
        raise _too_large()

    job_id = uuid.uuid4().hex
    folder = settings.uploads_dir / job_id
    target = folder / f"input.{ext}"
    digest, size = hashlib.sha256(), 0
    try:
        folder.mkdir(parents=True)
        with open(target, "wb") as out:
            while chunk := file.file.read(CHUNK_BYTES):
                size += len(chunk)
                if size > settings.max_file_size_bytes:
                    raise _too_large()
                digest.update(chunk)
                out.write(chunk)
        if size == 0:
            raise ApiError(400, "EMPTY_FILE", "File is empty.")
        media_type = detect_media_type(target)
        expected = "image" if ext in IMAGE_EXTENSIONS else "video"
        if media_type != expected:
            raise ApiError(415, "CONTENT_MISMATCH", f"This file isn't a valid {expected}.")
    except ApiError:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    except OSError:
        shutil.rmtree(folder, ignore_errors=True)
        log.exception("Saving upload failed")
        raise ApiError(507, "STORAGE_ERROR", "Server storage error. Try again later.") from None

    db.create_job(
        job_id=job_id, filename=_clean_filename(file.filename), input_ext=ext, media_type=media_type,
        size_bytes=size, sha256=digest.hexdigest(), model=spec.id, conf=confidence,
        prompt=prompt_text, device_requested=device,
    )
    try:
        process_job.apply_async(args=[job_id], retry=True,
                                retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5})
    except Exception as exc:
        log.warning("job=%s event=enqueue-failed reason=%s", job_id, exc)  # broker down: expected, no traceback
        db.update_job(job_id, status="failed", error_code="QUEUE_UNAVAILABLE",
                      error="Job queue is unavailable.", completed_at=db.now())
        shutil.rmtree(folder, ignore_errors=True)
        raise ApiError(503, "QUEUE_UNAVAILABLE", "Job queue is unavailable. Please try again shortly.") from None

    log.info("job=%s event=queued model=%s media=%s size=%d", job_id, spec.id, media_type, size)
    return {"job_id": job_id, "status": "queued"}


def _too_large() -> ApiError:
    return ApiError(413, "TOO_LARGE", f"File exceeds the {settings.max_file_size_mb} MB limit.")


# --- jobs ----------------------------------------------------------------------------------------

@router.get("/jobs")
def list_jobs():
    jobs = db.list_jobs()
    counts: dict[str, int] = {}
    for job in jobs:
        counts[job["sha256"]] = counts.get(job["sha256"], 0) + 1
    return {"jobs": [_public(job, counts[job["sha256"]] > 1) for job in jobs]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = _job_or_404(job_id)
    return _public(job, db.has_same_file(job_id, job["sha256"]))


@router.get("/jobs/{job_id}/result")
def get_result(job_id: str, download: bool = False):
    job = _job_or_404(job_id)
    name = "output.jpg" if job["media_type"] == "image" else "output.mp4"
    path = _completed_file(job, name)
    filename = f"{Path(job['filename']).stem}_annotated{path.suffix}" if download else None
    return FileResponse(path, media_type="image/jpeg" if path.suffix == ".jpg" else "video/mp4", filename=filename)


@router.get("/jobs/{job_id}/metadata")
def get_metadata(job_id: str, download: bool = False):
    job = _job_or_404(job_id)
    path = _completed_file(job, "metadata.json")
    filename = f"{Path(job['filename']).stem}_metadata.json" if download else None
    return FileResponse(path, media_type="application/json", filename=filename)


@router.get("/jobs/{job_id}/metadata/{frame}")
def get_frame_metadata(job_id: str, frame: int):
    job = _job_or_404(job_id)
    frames = json.loads(_completed_file(job, "metadata.json").read_text(encoding="utf-8"))["frames"]
    if not 0 <= frame < len(frames):
        raise ApiError(404, "FRAME_OUT_OF_RANGE", f"Frame must be between 0 and {len(frames) - 1}.")
    return frames[frame]


@router.get("/jobs/{job_id}/thumbs/{frame}")
def get_thumbnail(job_id: str, frame: int):
    job = _job_or_404(job_id)
    if job["status"] != "completed":
        raise ApiError(409, "NOT_READY", "This job hasn't finished processing yet.")
    path = settings.results_dir / job_id / "thumbs" / f"{frame}.jpg"
    if not path.is_file():
        raise ApiError(404, "THUMBNAIL_NOT_FOUND", "No thumbnail for that frame.")
    return FileResponse(path, media_type="image/jpeg")


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    _job_or_404(job_id)
    if not db.transition(job_id, "queued", "cancelled", completed_at=db.now()):
        raise ApiError(409, "INVALID_STATE", "Only queued jobs can be cancelled.")
    shutil.rmtree(settings.uploads_dir / job_id, ignore_errors=True)
    log.info("job=%s event=cancelled", job_id)
    return {"job_id": job_id, "status": "cancelled"}


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    job = _job_or_404(job_id)
    if job["status"] == "processing":
        raise ApiError(409, "INVALID_STATE", "A job can't be deleted while it's processing.")
    db.delete_job(job_id)
    _remove_job_files(job_id)
    log.info("job=%s event=deleted", job_id)
    return Response(status_code=204)


# --- models & health -----------------------------------------------------------------------------

@router.get("/models")
def list_models():
    gpu = registry.gpu()
    return {
        "models": [asdict(spec) for spec in registry.MODELS.values()],
        "default_model": settings.default_model,
        "default_confidence": settings.default_confidence,
        "devices": {"cpu": True, "gpu": gpu is not None, "gpu_name": gpu[1] if gpu else None},
    }


_health_cache: tuple[float, dict] | None = None


def _component_status() -> dict:
    global _health_cache
    if _health_cache and time.monotonic() - _health_cache[0] < HEALTH_CACHE_S:
        return _health_cache[1]
    try:
        redis.Redis.from_url(settings.redis_url, socket_timeout=1, socket_connect_timeout=1).ping()
        redis_ok = True
    except redis.RedisError:
        redis_ok = False
    worker_ok = False
    if redis_ok:
        try:
            worker_ok = bool(celery_app.control.ping(timeout=1.0))
        except Exception:
            log.warning("Worker ping failed", exc_info=True)
    status = {"redis": "ok" if redis_ok else "down", "worker": "ok" if worker_ok else "down"}
    _health_cache = (time.monotonic(), status)
    return status


@router.get("/health")
def health():
    components = _component_status()
    ffmpeg = find_ffmpeg() is not None
    healthy = components["redis"] == "ok" and components["worker"] == "ok" and ffmpeg
    return {
        "status": "ok" if healthy else "degraded",
        "api": "ok",
        **components,
        "ffmpeg": ffmpeg,
        "device": registry.resolve_device("auto"),
        "max_file_size_mb": settings.max_file_size_mb,
        "allowed_extensions": sorted(settings.allowed_extensions),
    }
