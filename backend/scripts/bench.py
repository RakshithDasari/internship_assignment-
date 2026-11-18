"""Print timing for finished jobs, to compare machines and devices on the same clip.

    python backend/scripts/bench.py                 # latest completed job
    python backend/scripts/bench.py <job_id> ...    # specific jobs
    API=http://other-host:8000 python backend/scripts/bench.py

Standard library only, so it runs anywhere Python does (no venv needed).
"""

import json
import os
import statistics
import sys
import urllib.request
from datetime import datetime

API = os.environ.get("API", "http://localhost:8000")


def get(path):
    with urllib.request.urlopen(API + path, timeout=30) as response:
        return json.load(response)


def parse(stamp):
    return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")


def report(job_id):
    job = get(f"/jobs/{job_id}")
    if job["status"] != "completed":
        return f"{job_id}: {job['status']}, skipped"
    frames = get(f"/jobs/{job_id}/metadata")["frames"]
    model_ms = [frame["inference_time_ms"] for frame in frames]
    # Timestamps have 1 s resolution, so wall time is only meaningful for jobs of several seconds.
    wall = max((parse(job["completed_at"]) - parse(job["started_at"])).total_seconds(), 1)
    return (
        f"{job['filename']:<20} {job['model']:<16} {job['device']:<8} "
        f"{len(frames):>5} frames  {wall:>6.0f} s total  {len(frames) / wall:>6.1f} fps  "
        f"model {statistics.mean(model_ms):>6.1f} ms avg / {statistics.median(model_ms):>6.1f} ms median"
    )


if __name__ == "__main__":
    ids = sys.argv[1:] or [next(j["job_id"] for j in get("/jobs")["jobs"] if j["status"] == "completed")]
    for job_id in ids:
        print(report(job_id))
