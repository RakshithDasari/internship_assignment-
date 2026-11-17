import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Callable

import cv2

from app.models import annotate, media

MAX_OUTPUT_SHORT_SIDE = 1080
KEYFRAME_COUNT = 4
KEYFRAME_MIN_GAP_S = 1.0
PROGRESS_INTERVAL_S = 0.5
# ByteTrack, not Ultralytics' default BoT-SORT: BoT-SORT's camera-motion step costs ~35 ms/frame.
TRACKER = "bytetrack.yaml"
EARLY_END_RATIO = 0.9

log = logging.getLogger(__name__)

ProgressCallback = Callable[[int, int], None]  # (frames_done, frames_expected)


def _detections(result, width: int, height: int) -> tuple[list[dict], list | None]:
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return [], None
    xyxy = boxes.xyxy.cpu().numpy()
    classes = boxes.cls.cpu().numpy().astype(int)
    confidences = boxes.conf.cpu().numpy()
    track_ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else None
    masks = result.masks.xy if result.masks is not None else None

    detections = []
    for i, (x1, y1, x2, y2) in enumerate(xyxy):
        det = {
            "class_id": int(classes[i]),
            "class_name": result.names[int(classes[i])],
            "confidence": round(float(confidences[i]), 4),
            "bbox": {
                "x1": max(0, round(float(x1))),
                "y1": max(0, round(float(y1))),
                "x2": min(width - 1, round(float(x2))),
                "y2": min(height - 1, round(float(y2))),
            },
            "mask_present": masks is not None and len(masks[i]) > 0,
        }
        if track_ids is not None:
            det["track_id"] = int(track_ids[i])
        detections.append(det)
    return detections, masks


def _frame_record(index: int, timestamp_ms: int, model_id: str, result, detections: list[dict]) -> dict:
    return {
        "frame_index": index,
        "timestamp_ms": timestamp_ms,
        "model": model_id,
        "detections": detections,
        "total_objects": len(detections),
        "inference_time_ms": round(result.speed["inference"], 1),
    }


def _class_colors(frames: list[dict]) -> dict[str, str]:
    return {
        det["class_name"]: annotate.class_color(det["class_id"], det["class_name"])
        for frame in frames
        for det in frame["detections"]
    }


def _offer_keyframe(kept: list, index: int, objects: int, frame, gap: int) -> list:
    """Keeps the KEYFRAME_COUNT frames with the most objects, at least `gap` frames apart.
    Entries are ((objects, -index), index, thumbnail); ties favour the earlier frame."""
    if objects == 0:
        return kept
    score = (objects, -index)
    near = [k for k in kept if abs(k[1] - index) < gap]
    if near:
        if all(score > k[0] for k in near):
            kept = [k for k in kept if abs(k[1] - index) >= gap] + [(score, index, media.thumbnail(frame))]
    elif len(kept) < KEYFRAME_COUNT:
        kept = kept + [(score, index, media.thumbnail(frame))]
    else:
        weakest = min(kept, key=lambda k: k[0])
        if score > weakest[0]:
            kept = [k for k in kept if k is not weakest] + [(score, index, media.thumbnail(frame))]
    return kept


def _run_image(input_path, work_dir, model, model_id, device, conf, on_progress) -> dict:
    frame = media.read_image(input_path)
    height, width = frame.shape[:2]
    result = model.predict(frame, conf=conf, device=device, verbose=False)[0]
    detections, masks = _detections(result, width, height)
    annotate.draw(frame, detections, masks)
    media.write_image(work_dir / "output.jpg", frame)
    frames = [_frame_record(0, 0, model_id, result, detections)]
    if on_progress:
        on_progress(1, 1)
    return {
        "media_type": "image", "width": width, "height": height,
        "output_width": width, "output_height": height,
        "fps": None, "frame_count": None, "duration_ms": None,
        "tracking": False, "keyframes": [], "warnings": [], "frames": frames,
    }


def _run_video(input_path, work_dir, model, model_id, device, conf, on_progress) -> dict:
    frames: list[dict] = []
    kept: list = []
    warnings: list[str] = []
    last_report = 0.0

    with media.VideoReader(input_path, work_dir / "scratch") as video:
        info = video.info
        gap = max(1, round(KEYFRAME_MIN_GAP_S * info.fps))
        # Detect on the full frame, but draw and encode at most 1080p: the dashboard player is
        # ~1000 px wide, and 4K decode/draw/encode was the bottleneck.
        scale = min(1.0, MAX_OUTPUT_SHORT_SIDE / min(info.width, info.height))
        out_w, out_h = round(info.width * scale), round(info.height * scale)
        with media.VideoWriter(work_dir / "output.mp4", out_w, out_h, info.fps) as writer:
            for index, frame in enumerate(video):
                result = model.track(frame, persist=True, tracker=TRACKER, conf=conf, device=device, verbose=False)[0]
                detections, masks = _detections(result, info.width, info.height)
                frames.append(_frame_record(index, round(index * 1000 / info.fps), model_id, result, detections))
                if scale < 1:
                    frame = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
                annotate.draw(frame, detections, masks, scale)
                writer.write(frame)

                kept = _offer_keyframe(kept, index, len(detections), frame, gap)

                now = time.monotonic()
                if on_progress and now - last_report >= PROGRESS_INTERVAL_S:
                    on_progress(index + 1, info.frame_count)
                    last_report = now

    if info.fps_assumed:
        warnings.append(f"Video has no valid frame rate; assumed {info.fps:g} fps.")
    if video.resized_frames:
        warnings.append(f"Resolution changed mid-video; {video.resized_frames} frames were resized.")
    if info.frame_count and len(frames) < EARLY_END_RATIO * info.frame_count:
        warnings.append(f"Video ended early at frame {len(frames)} of {info.frame_count}.")

    thumbs_dir = work_dir / "thumbs"
    thumbs_dir.mkdir()
    keyframes = []
    for (objects, _), index, thumb in sorted(kept, key=lambda k: k[0], reverse=True):
        media.write_image(thumbs_dir / f"{index}.jpg", thumb, quality=80)
        keyframes.append({"frame_index": index, "timestamp_ms": frames[index]["timestamp_ms"], "total_objects": objects})
    shutil.rmtree(work_dir / "scratch", ignore_errors=True)
    if on_progress:
        on_progress(len(frames), len(frames))

    return {
        "media_type": "video", "width": info.width, "height": info.height,
        "output_width": out_w, "output_height": out_h,
        "fps": round(info.fps, 6), "frame_count": len(frames),
        "duration_ms": round(len(frames) * 1000 / info.fps),
        "tracking": True, "keyframes": keyframes, "warnings": warnings, "frames": frames,
    }


def process_media(
    media_type: str,
    input_path: Path,
    out_dir: Path,
    load_model: Callable,
    model_id: str,
    device: str,
    conf: float,
    on_progress: ProgressCallback | None = None,
) -> dict:
    """Runs a model over an image or video and writes output, metadata.json and thumbnails
    to `out_dir`. Returns metadata without the per-frame list.

    Work happens in a sibling `.tmp` folder that replaces `out_dir` only on success, so a
    partially processed job never looks complete. A GPU RuntimeError (driver fault, out of
    memory) retries the whole job on CPU.
    """
    run = _run_image if media_type == "image" else _run_video
    out_dir = Path(out_dir)
    work_dir = out_dir.with_name(out_dir.name + ".tmp")
    attempts = [device] if device == "cpu" else [device, "cpu"]
    try:
        for used_device in attempts:
            shutil.rmtree(work_dir, ignore_errors=True)
            work_dir.mkdir(parents=True)
            try:
                metadata = run(input_path, work_dir, load_model(), model_id, used_device, conf, on_progress)
                break
            except RuntimeError as exc:
                if used_device == "cpu":
                    raise
                log.warning("Inference on %s failed, retrying on CPU: %s", used_device, exc)

        if used_device != device:
            metadata["warnings"].append(f"GPU ({device}) failed during processing; the job ran on CPU.")
        metadata = {"model": model_id, "device": used_device, **metadata,
                    "class_colors": _class_colors(metadata["frames"])}
        with open(work_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, separators=(",", ":"))

        shutil.rmtree(out_dir, ignore_errors=True)
        os.replace(work_dir, out_dir)
    except BaseException:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
    return {k: v for k, v in metadata.items() if k != "frames"}
