from __future__ import annotations

import asyncio
import logging
import os
import signal
import threading
import time

from main import (
    ASYNC_JOB_QUEUE_ENABLED,
    QUEUE_BACKEND,
    claim_next_redis_job_id,
    get_job_record,
    get_redis_client,
    maybe_cleanup_jobs,
    redis_processing_key,
    run_async_job,
)


logger = logging.getLogger("magic-play-place.redis-worker")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def main() -> None:
    if not ASYNC_JOB_QUEUE_ENABLED:
        raise RuntimeError("ASYNC_JOB_QUEUE_ENABLED must be true to run redis_worker.")
    if QUEUE_BACKEND != "redis":
        raise RuntimeError("QUEUE_BACKEND must be set to 'redis' to run redis_worker.")

    stop_event = threading.Event()

    def _handle_signal(signum, _frame):
        logger.info("Received signal %s; shutting down worker.", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    poll_seconds = max(1, int(os.getenv("REDIS_WORKER_POLL_SECONDS", "2")))
    logger.info("Redis worker started (poll_seconds=%s).", poll_seconds)

    while not stop_event.is_set():
        maybe_cleanup_jobs()

        try:
            job_id = claim_next_redis_job_id(timeout_seconds=poll_seconds)
        except Exception as exc:
            logger.error("Failed to claim Redis job: %s", exc)
            time.sleep(1)
            continue

        if not job_id:
            continue

        record = get_job_record(job_id)
        if record is None:
            # Queue entry exists without metadata; drop from processing list.
            get_redis_client().lrem(redis_processing_key(), 1, job_id)
            continue

        state = str(record.get("state", "queued"))
        if state not in {"queued", "running"}:
            get_redis_client().lrem(redis_processing_key(), 1, job_id)
            continue

        try:
            asyncio.run(run_async_job(job_id))
        except Exception:
            logger.exception("Async Redis job execution failed for job_id=%s", job_id)

    logger.info("Redis worker stopped.")


if __name__ == "__main__":
    main()
