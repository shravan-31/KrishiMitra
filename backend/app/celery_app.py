"""
KrishiMitra — Celery Application

Async task queue backed by Redis.
Workers run heavy ML inference, report generation, etc.
"""

import os
from celery import Celery

# Redis broker URL from environment
broker_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
result_backend = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "krishimitra",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Auto-discover tasks from all routers / ml modules
celery_app.autodiscover_tasks(["app.routers", "app.ml"])


# ---------------------------------------------------------------------------
# Stub tasks — replaced with real implementations in later phases
# ---------------------------------------------------------------------------
@celery_app.task(name="health_check_task")
def health_check_task():
    """Simple task to verify Celery worker is running."""
    return {"status": "celery_ok", "phase": "0-scaffold"}
