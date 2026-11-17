import os
from dataclasses import dataclass
from functools import lru_cache

from app.config import settings

# Keep Ultralytics' settings file (download dir, telemetry flag) next to our weights
# instead of the user profile. Must be set before ultralytics is imported.
os.environ.setdefault("YOLO_CONFIG_DIR", str(settings.weights_dir / ".ultralytics"))

import torch  # noqa: E402
import torchvision  # noqa: E402
import ultralytics.nn.text_model as yolo_text_model  # noqa: E402
import ultralytics.utils.nms as yolo_nms  # noqa: E402
from ultralytics import YOLO  # noqa: E402
from ultralytics import settings as yolo_settings  # noqa: E402

yolo_settings.update({"weights_dir": str(settings.weights_dir), "sync": False})
# YOLO-World's CLIP loader copied WEIGHTS_DIR at import time, before the update above.
yolo_text_model.WEIGHTS_DIR = settings.weights_dir

_ultralytics_nms_boxes = yolo_nms.nms_boxes


def _nms_boxes(boxes, scores, iou, rotated=False):
    # Ultralytics skips torchvision NMS on XPU and falls back to a Python loop of tiny GPU ops
    # (~60 ms per call on Intel Arc vs ~3 ms for torchvision; results are identical).
    if boxes.device.type == "xpu" and not rotated:
        return torchvision.ops.nms(boxes, scores, iou)
    return _ultralytics_nms_boxes(boxes, scores, iou, rotated)


yolo_nms.nms_boxes = _nms_boxes

DEVICE_CHOICES = ("auto", "cpu", "gpu")
MAX_PROMPT_CLASSES = 20
MAX_PROMPT_CLASS_LENGTH = 50


class RequestError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ModelSpec:
    id: str
    task: str
    tag: str
    description: str
    output: str
    needs_prompt: bool = False
    masks: bool = False


MODELS = {
    spec.id: spec
    for spec in (
        ModelSpec("yolov8n", "detect", "Fastest", "Fast nano detection across 80 COCO classes.", "Object BBox"),
        ModelSpec("yolov8s", "detect", "More accurate", "Small weight variant with higher mAP accuracy.", "Object BBox"),
        ModelSpec(
            "yolov8s-worldv2", "detect", "Open-vocab", "Open-vocabulary prompt-driven detection.",
            "Custom text", needs_prompt=True,
        ),
        ModelSpec(
            "yolov8n-seg", "segment", "Masks", "Instance polygon segmentation and bounding boxes.",
            "BBox + Mask", masks=True,
        ),
    )
}

if settings.default_model not in MODELS:
    raise RuntimeError(f"DEFAULT_MODEL must be one of {sorted(MODELS)}, got {settings.default_model!r}")


def get_spec(model_id: str) -> ModelSpec:
    spec = MODELS.get(model_id)
    if spec is None:
        raise RequestError("INVALID_MODEL", f"Unknown model {model_id!r}. Choose one of {sorted(MODELS)}.")
    return spec


def parse_prompt(text: str | None) -> list[str]:
    # dict.fromkeys drops duplicates but keeps the user's order.
    classes = list(dict.fromkeys(c.strip().lower() for c in (text or "").split(",") if c.strip()))
    if not classes:
        raise RequestError("PROMPT_REQUIRED", "Please enter at least one prompt for YOLO-World detection.")
    if len(classes) > MAX_PROMPT_CLASSES:
        raise RequestError("PROMPT_INVALID", f"Use at most {MAX_PROMPT_CLASSES} prompts.")
    if any(len(c) > MAX_PROMPT_CLASS_LENGTH for c in classes):
        raise RequestError("PROMPT_INVALID", f"Each prompt must be at most {MAX_PROMPT_CLASS_LENGTH} characters.")
    return classes


@lru_cache(maxsize=1)
def gpu() -> tuple[str, str] | None:
    """(torch device, display name) of the first usable GPU, or None."""
    if torch.cuda.is_available():
        return "cuda:0", torch.cuda.get_device_name(0)
    xpu = getattr(torch, "xpu", None)  # absent in older torch builds
    if xpu is not None and xpu.is_available():
        return "xpu:0", xpu.get_device_name(0)
    return None


def resolve_device(requested: str) -> str:
    if requested not in DEVICE_CHOICES:
        raise RequestError("INVALID_DEVICE", f"Device must be one of {list(DEVICE_CHOICES)}.")
    if requested == "cpu":
        return "cpu"
    found = gpu()
    if found:
        return found[0]
    if requested == "gpu":
        raise RequestError("DEVICE_UNAVAILABLE", "No GPU is available on this server.")
    return "cpu"


def load_model(model_id: str, prompt_classes: list[str] | None = None) -> YOLO:
    # A fresh instance per job, so tracker state and YOLO-World classes never carry over.
    spec = get_spec(model_id)
    if spec.needs_prompt and not prompt_classes:
        raise RequestError("PROMPT_REQUIRED", "Please enter at least one prompt for YOLO-World detection.")
    settings.weights_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(settings.weights_dir / f"{spec.id}.pt"))  # downloads on first use
    if spec.needs_prompt:
        model.set_classes(prompt_classes)
    return model


def preload() -> None:
    for spec in MODELS.values():
        load_model(spec.id, ["person"] if spec.needs_prompt else None)


if __name__ == "__main__":
    preload()  # used at Docker build time so weights ship inside the image
