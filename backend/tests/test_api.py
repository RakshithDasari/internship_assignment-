import dataclasses

import pytest
from fastapi.websockets import WebSocketDisconnect

from app import db
from app.api import routes
from app.workers import tasks
from tests.conftest import upload

DETECTION_KEYS = {"class_id", "class_name", "confidence", "bbox", "mask_present"}
FRAME_KEYS = {"frame_index", "timestamp_ms", "model", "detections", "total_objects", "inference_time_ms"}


# --- read-only endpoints -------------------------------------------------------------------------

def test_health_reports_components(client):
    body = client.get("/health").json()
    assert body["api"] == "ok"
    assert body["redis"] == "down" and body["status"] == "degraded"  # tests run without a broker
    assert body["ffmpeg"] is True


def test_models_lists_all_four(client):
    body = client.get("/models").json()
    assert {m["id"] for m in body["models"]} == {"yolov8n", "yolov8s", "yolov8s-worldv2", "yolov8n-seg"}
    assert body["default_model"] == "yolov8n"


def test_unknown_job_is_404(client):
    response = client.get("/jobs/0123456789abcdef0123456789abcdef")
    assert response.status_code == 404
    assert response.json()["code"] == "JOB_NOT_FOUND"


# --- upload validation ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("name", "data", "form", "status", "code"),
    [
        ("notes.txt", b"hello", {}, 415, "UNSUPPORTED_TYPE"),
        ("empty.jpg", b"", {}, 400, "EMPTY_FILE"),
        ("fake.mp4", b"not a video", {}, 415, "CONTENT_MISMATCH"),
        ("bus.jpg", None, {"model": "yolov99"}, 400, "INVALID_MODEL"),
        ("bus.jpg", None, {"conf": "7"}, 422, "INVALID_CONFIDENCE"),
        ("bus.jpg", None, {"conf": "abc"}, 422, "INVALID_CONFIDENCE"),
        ("bus.jpg", None, {"model": "yolov8s-worldv2"}, 422, "PROMPT_REQUIRED"),
        ("bus.jpg", None, {"device": "tpu"}, 400, "INVALID_DEVICE"),
        ("bus.jpg", None, {"model": "yolov8s-worldv2", "prompt": ",".join(f"thing{i}" for i in range(50))}, 422, "PROMPT_INVALID"),
    ],
)
def test_upload_rejects_bad_input(client, bus_jpg, name, data, form, status, code):
    response = upload(client, name, bus_jpg if data is None else data, **form)
    assert response.status_code == status
    assert response.json()["code"] == code


def test_upload_without_file(client):
    response = client.post("/upload")
    assert (response.status_code, response.json()["code"]) == (422, "NO_FILE")


def test_upload_over_size_limit(client, monkeypatch):
    monkeypatch.setattr(routes, "settings", dataclasses.replace(routes.settings, max_file_size_mb=1))
    response = upload(client, "big.jpg", b"\xff" * (2 * 1024 * 1024))
    assert (response.status_code, response.json()["code"]) == (413, "TOO_LARGE")


def test_upload_when_queue_is_down(client, bus_jpg, monkeypatch):
    def broker_down(*_, **__):
        raise ConnectionError("redis unreachable")

    monkeypatch.setattr(routes.process_job, "apply_async", broker_down)
    response = upload(client, "bus.jpg", bus_jpg)
    assert (response.status_code, response.json()["code"]) == (503, "QUEUE_UNAVAILABLE")


# --- full pipeline -------------------------------------------------------------------------------

def test_image_end_to_end(client, run_inline, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg, conf="0.4").json()["job_id"]

    job = client.get(f"/jobs/{job_id}").json()
    assert job["status"] == "completed" and job["media_type"] == "image"

    result = client.get(f"/jobs/{job_id}/result")
    assert result.status_code == 200 and result.headers["content-type"] == "image/jpeg"

    frames = client.get(f"/jobs/{job_id}/metadata").json()["frames"]
    assert len(frames) == 1
    frame = client.get(f"/jobs/{job_id}/metadata/0").json()
    assert FRAME_KEYS <= frame.keys() and frame["model"] == "yolov8n"
    assert frame["total_objects"] == len(frame["detections"]) > 0
    assert {"person", "bus"} <= {d["class_name"] for d in frame["detections"]}
    for detection in frame["detections"]:
        assert DETECTION_KEYS <= detection.keys()
        assert set(detection["bbox"]) == {"x1", "y1", "x2", "y2"}
        assert detection["confidence"] >= 0.4

    assert client.get(f"/jobs/{job_id}/metadata/1").status_code == 404
    assert job_id in {j["job_id"] for j in client.get("/jobs").json()["jobs"]}


def test_segmentation_marks_masks(client, run_inline, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg, model="yolov8n-seg").json()["job_id"]
    detections = client.get(f"/jobs/{job_id}/metadata/0").json()["detections"]
    assert detections and all(d["mask_present"] for d in detections)


def test_open_vocabulary_prompt(client, run_inline, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg, model="yolov8s-worldv2", prompt="bus").json()["job_id"]
    detections = client.get(f"/jobs/{job_id}/metadata/0").json()["detections"]
    assert {d["class_name"] for d in detections} == {"bus"}


def test_video_end_to_end(client, run_inline, live_events, tiny_mp4):
    job_id = upload(client, "clip.mp4", tiny_mp4).json()["job_id"]
    job = client.get(f"/jobs/{job_id}").json()
    assert job["status"] == "completed" and job["media_type"] == "video"

    metadata = client.get(f"/jobs/{job_id}/metadata").json()
    assert len(metadata["frames"]) == 12
    assert [f["frame_index"] for f in metadata["frames"]] == list(range(12))
    tracked = [d for f in metadata["frames"] for d in f["detections"] if d.get("track_id") is not None]
    assert tracked, "ByteTrack should assign IDs across frames"

    head = client.get(f"/jobs/{job_id}/result", headers={"Range": "bytes=0-99"})
    assert head.status_code == 206 and len(head.content) == 100  # seeking needs range support

    keyframe = metadata["keyframes"][0]["frame_index"]
    assert client.get(f"/jobs/{job_id}/thumbs/{keyframe}").status_code == 200
    assert any(e["type"] == "frame" and e.get("preview") for e in live_events)
    assert live_events[-1]["status"] == "completed"


# --- job lifecycle -------------------------------------------------------------------------------

def test_cancel_then_delete(client, no_worker, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg).json()["job_id"]
    assert client.get(f"/jobs/{job_id}").json()["status"] == "queued"

    assert client.post(f"/jobs/{job_id}/cancel").json()["status"] == "cancelled"
    assert client.post(f"/jobs/{job_id}/cancel").status_code == 409

    tasks.process_job(job_id)  # a cancelled job reaching the worker is skipped
    assert client.get(f"/jobs/{job_id}").json()["status"] == "cancelled"

    assert client.delete(f"/jobs/{job_id}").status_code == 204
    assert client.get(f"/jobs/{job_id}").status_code == 404


def test_cannot_delete_while_processing(client, no_worker, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg).json()["job_id"]
    db.update_job(job_id, status="processing")
    assert client.delete(f"/jobs/{job_id}").status_code == 409


def test_result_not_ready_while_queued(client, no_worker, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg).json()["job_id"]
    assert client.get(f"/jobs/{job_id}/result").status_code == 409


def test_worker_fails_job_on_unreadable_input(client, no_worker, live_events, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg).json()["job_id"]
    (routes.settings.uploads_dir / job_id / "input.jpg").write_bytes(b"corrupted after upload")

    tasks.process_job(job_id)
    job = client.get(f"/jobs/{job_id}").json()
    assert job["status"] == "failed" and job["error_code"]
    assert live_events[-1]["status"] == "failed"


def test_worker_skips_deleted_job():
    tasks.process_job("0123456789abcdef0123456789abcdef")  # no row: must return quietly


def test_stale_jobs_are_failed_on_worker_start(client, no_worker, bus_jpg):
    job_id = upload(client, "bus.jpg", bus_jpg).json()["job_id"]
    db.update_job(job_id, status="processing")
    db.mark_stale()
    assert client.get(f"/jobs/{job_id}").json()["status"] == "failed"


# --- live stream ---------------------------------------------------------------------------------

def test_websocket_rejects_foreign_origin(client):
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect("/ws/jobs/x", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()
    assert closed.value.code == 1008


def test_websocket_rejects_unknown_job(client):
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect("/ws/jobs/0123456789abcdef0123456789abcdef") as ws:
            ws.receive_json()
    assert closed.value.code == 4404
