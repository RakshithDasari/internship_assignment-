import logging

from celery import Celery
from celery.signals import worker_ready

from app import db
from app.config import settings

log = logging.getLogger(__name__)

celery_app = Celery("visionquest", broker=settings.redis_url, include=["app.workers.tasks"])
celery_app.conf.update(
    # Job state lives in SQLite; a Celery result backend would be a second source of truth.
    task_ignore_result=True,
    # Take one job at a time so waiting jobs stay in Redis and queue positions stay accurate.
    worker_prefetch_multiplier=1,
    # Acknowledge on receipt: a job that crashes the worker is marked failed on restart
    # (mark_stale) instead of being redelivered and crashing it again.
    task_acks_late=False,
    broker_connection_retry_on_startup=True,
)


@worker_ready.connect
def _recover_interrupted_jobs(**_) -> None:
    db.init_db()
    stale = db.mark_stale()
    if stale:
        log.warning("Marked %d interrupted job(s) as failed: %s", len(stale), ", ".join(stale))
