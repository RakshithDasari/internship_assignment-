import os
import tempfile
from pathlib import Path

# Settings are read at import time, so the environment must be ready before `app` is imported.
# Redis points at a closed port: tests never need a broker, and /health must report it down.
os.environ.update(
    DATA_DIR=tempfile.mkdtemp(prefix="vq-tests-"),
    WEIGHTS_DIR=str(Path(__file__).resolve().parents[1] / "weights"),
    REDIS_URL="redis://127.0.0.1:6399/0",
    CORS_ORIGINS="http://localhost:3000",
)

import cv2  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from ultralytics.utils import ASSETS  # noqa: E402

from app.api import routes  # noqa: E402
from app.main import app  # noqa: E402
from app.workers import tasks  # noqa: E402

BUS = ASSETS / "bus.jpg"  # ships with ultralytics: people and a bus, so detections are real


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def live_events(monkeypatch):
    events = []
    monkeypatch.setattr(tasks, "publish_live", lambda job_id, event: events.append(event))
    return events


@pytest.fixture
def run_inline(monkeypatch, live_events):
    """Uploads run the worker task in-process instead of queueing it."""
    monkeypatch.setattr(routes.process_job, "apply_async", lambda args, **_: tasks.process_job(*args))


@pytest.fixture
def no_worker(monkeypatch):
    """Uploads are accepted but stay queued."""
    monkeypatch.setattr(routes.process_job, "apply_async", lambda args, **_: None)


@pytest.fixture(scope="session")
def bus_jpg():
    return BUS.read_bytes()


@pytest.fixture(scope="session")
def tiny_mp4(tmp_path_factory):
    """12 frames at 12 fps, the bus image sliding left, written with OpenCV."""
    path = tmp_path_factory.mktemp("media") / "clip.mp4"
    frame = cv2.resize(cv2.imread(str(BUS)), (320, 432))
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 12, (320, 432))
    for shift in range(12):
        writer.write(cv2.copyMakeBorder(frame[:, shift * 4:], 0, 0, 0, shift * 4, cv2.BORDER_REPLICATE))
    writer.release()
    return path.read_bytes()


def upload(client, name, data, **form):
    return client.post("/upload", files={"file": (name, data)}, data=form)
