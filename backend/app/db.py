import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from app.config import settings

STATUSES = ("queued", "processing", "completed", "failed", "cancelled")

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS jobs (
    job_id            TEXT PRIMARY KEY,
    filename          TEXT NOT NULL,
    input_ext         TEXT NOT NULL,
    media_type        TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    size_bytes        INTEGER NOT NULL,
    sha256            TEXT NOT NULL,
    model             TEXT NOT NULL,
    conf              REAL NOT NULL,
    prompt            TEXT,
    device_requested  TEXT NOT NULL,
    device            TEXT,
    width             INTEGER,
    height            INTEGER,
    fps               REAL,
    frame_count       INTEGER,
    duration_ms       INTEGER,
    status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN {STATUSES}),
    progress          REAL NOT NULL DEFAULT 0,
    frames_done       INTEGER NOT NULL DEFAULT 0,
    tracking          INTEGER,
    warnings          TEXT NOT NULL DEFAULT '[]',
    error_code        TEXT,
    error             TEXT,
    created_at        TEXT NOT NULL,
    started_at        TEXT,
    completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS jobs_created_at ON jobs (created_at);
CREATE INDEX IF NOT EXISTS jobs_sha256 ON jobs (sha256);
"""

# Column names can't be bound as query parameters, so they're validated against this set.
COLUMNS = {
    "job_id", "filename", "input_ext", "media_type", "size_bytes", "sha256", "model",
    "conf", "prompt", "device_requested", "device", "width", "height", "fps",
    "frame_count", "duration_ms", "status", "progress", "frames_done", "tracking",
    "warnings", "error_code", "error", "created_at", "started_at", "completed_at",
}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def _connect():
    conn = sqlite3.connect(settings.db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    job = dict(row)
    job["warnings"] = json.loads(job["warnings"])
    job["tracking"] = None if job["tracking"] is None else bool(job["tracking"])
    return job


def _encode(fields: dict) -> dict:
    unknown = set(fields) - COLUMNS
    if unknown:
        raise ValueError(f"Unknown job column(s): {sorted(unknown)}")
    if "warnings" in fields:
        fields["warnings"] = json.dumps(fields["warnings"])
    if fields.get("tracking") is not None:
        fields["tracking"] = int(fields["tracking"])
    return fields


def init_db() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL")  # lets the API read while the worker writes
        conn.executescript(SCHEMA)


def create_job(**fields) -> dict:
    fields = _encode({"created_at": now(), **fields})
    names = ", ".join(fields)
    marks = ", ".join("?" for _ in fields)
    with _connect() as conn:
        conn.execute(f"INSERT INTO jobs ({names}) VALUES ({marks})", tuple(fields.values()))
    return get_job(fields["job_id"])


def get_job(job_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    return _to_dict(row)


def list_jobs() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC, rowid DESC").fetchall()
    return [_to_dict(r) for r in rows]


def update_job(job_id: str, **fields) -> None:
    fields = _encode(fields)
    assignments = ", ".join(f"{name} = ?" for name in fields)
    with _connect() as conn:
        conn.execute(f"UPDATE jobs SET {assignments} WHERE job_id = ?", (*fields.values(), job_id))


def transition(job_id: str, from_status: str, to_status: str, **fields) -> bool:
    """Atomic compare-and-set on status. False means the status had already changed,
    e.g. the job was cancelled before the worker picked it up."""
    fields = _encode({**fields, "status": to_status})
    assignments = ", ".join(f"{name} = ?" for name in fields)
    with _connect() as conn:
        cursor = conn.execute(
            f"UPDATE jobs SET {assignments} WHERE job_id = ? AND status = ?",
            (*fields.values(), job_id, from_status),
        )
    return cursor.rowcount == 1


def queue_position(job_id: str) -> int | None:
    # rowid is insertion order, so ties within the same second still sort correctly.
    with _connect() as conn:
        row = conn.execute(
            """SELECT (SELECT COUNT(*) FROM jobs ahead
                       WHERE ahead.status = 'queued' AND ahead.rowid < me.rowid)
               FROM jobs me WHERE me.job_id = ? AND me.status = 'queued'""",
            (job_id,),
        ).fetchone()
    return row[0] if row else None


def has_same_file(job_id: str, sha256: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM jobs WHERE sha256 = ? AND job_id != ? LIMIT 1", (sha256, job_id)
        ).fetchone()
    return row is not None


def delete_job(job_id: str) -> bool:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM jobs WHERE job_id = ?", (job_id,))
    return cursor.rowcount == 1


def mark_stale() -> list[str]:
    # Called on worker startup: anything still 'processing' was interrupted by a crash or restart.
    with _connect() as conn:
        ids = [r[0] for r in conn.execute("SELECT job_id FROM jobs WHERE status = 'processing'")]
        conn.execute(
            """UPDATE jobs SET status = 'failed', error_code = 'WORKER_RESTARTED',
                   error = 'Processing was interrupted. Please re-run.', completed_at = ?
               WHERE status = 'processing'""",
            (now(),),
        )
    return ids
