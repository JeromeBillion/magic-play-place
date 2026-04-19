import asyncio
import json
import threading
import time
from typing import Any, Callable, Literal
from uuid import uuid4

from fastapi import HTTPException, status

from config import (
    ASYNC_JOB_QUEUE_ENABLED,
    JOB_CLEANUP_INTERVAL_SECONDS,
    JOB_MAX_RETRIES,
    JOB_QUEUE_MAX_PENDING,
    JOB_RETENTION_HOURS,
    JOB_WORKER_CONCURRENCY,
    QUEUE_BACKEND,
    REDIS_KEY_PREFIX,
    REDIS_URL,
    logger,
)
from metrics import record_async_job_submitted
from models import JobStatusResponse

_job_lock = threading.Lock()
_job_records: dict[str, dict[str, Any]] = {}

_job_worker_gate: threading.BoundedSemaphore | None = None
_job_event_loop: asyncio.AbstractEventLoop | None = None

def init_job_queue() -> None:
    global _job_worker_gate
    global _job_event_loop
    if ASYNC_JOB_QUEUE_ENABLED:
        _job_worker_gate = threading.BoundedSemaphore(JOB_WORKER_CONCURRENCY)
        _job_event_loop = asyncio.get_running_loop()

def teardown_job_queue() -> None:
    global _job_worker_gate
    global _job_event_loop
    _job_event_loop = None
    _job_worker_gate = None

_job_cleanup_lock = threading.Lock()
_next_job_cleanup_epoch = 0.0
_job_terminal_states = {"succeeded", "failed"}

_redis_lock = threading.Lock()
_redis_client: Any | None = None


def get_job_worker_gate() -> threading.BoundedSemaphore:
    global _job_worker_gate
    if _job_worker_gate is None:
        _job_worker_gate = threading.BoundedSemaphore(JOB_WORKER_CONCURRENCY)
    return _job_worker_gate


def redis_queue_key() -> str:
    return f"{REDIS_KEY_PREFIX}:jobs:queue"


def redis_processing_key() -> str:
    return f"{REDIS_KEY_PREFIX}:jobs:processing"


def redis_job_key(job_id: str) -> str:
    return f"{REDIS_KEY_PREFIX}:job:{job_id}"


def redis_state_key(state: str) -> str:
    return f"{REDIS_KEY_PREFIX}:jobs:{state}"


def get_redis_client() -> Any:
    if QUEUE_BACKEND != "redis":
        raise RuntimeError("Redis client requested while QUEUE_BACKEND is not redis.")

    global _redis_client
    with _redis_lock:
        if _redis_client is not None:
            return _redis_client

        try:
            import redis as redis_lib
        except ImportError as exc:
            raise RuntimeError(
                "QUEUE_BACKEND=redis requires 'redis' package. Install with: pip install redis"
            ) from exc

        client = redis_lib.Redis.from_url(REDIS_URL, decode_responses=True)
        try:
            client.ping()
        except Exception as exc:
            raise RuntimeError(f"Redis unavailable at {REDIS_URL}: {exc}") from exc
        _redis_client = client
        return _redis_client


def get_job_record(job_id: str) -> dict[str, Any] | None:
    if QUEUE_BACKEND == "redis":
        client = get_redis_client()
        raw = client.get(redis_job_key(job_id))
        if not raw:
            return None
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return None
        return parsed

    with _job_lock:
        return _job_records.get(job_id)


def mutate_job_record(
    job_id: str,
    mutator: Callable[[dict[str, Any]], None],
) -> dict[str, Any] | None:
    """
    Atomically mutate a job record.

    For in-memory mode this executes under a single lock scope to avoid TOCTOU races.
    For Redis mode this performs read-modify-write with persisted state transition metadata.
    """
    if QUEUE_BACKEND == "redis":
        import redis.exceptions

        client = get_redis_client()
        key = redis_job_key(job_id)

        for _ in range(5):
            try:
                pipeline = client.pipeline()
                pipeline.watch(key)
                raw = pipeline.get(key)
                if not raw:
                    pipeline.unwatch()
                    return None

                record = json.loads(raw)
                if not isinstance(record, dict):
                    pipeline.unwatch()
                    return None

                previous_state = str(record.get("state", ""))
                mutator(record)
                state = str(record["state"])

                pipeline.multi()
                pipeline.set(key, json.dumps(record))
                if previous_state and previous_state != state:
                    pipeline.srem(redis_state_key(previous_state), str(record["job_id"]))
                    if previous_state == "running":
                        pipeline.lrem(redis_processing_key(), 1, str(record["job_id"]))
                    pipeline.sadd(redis_state_key(state), str(record["job_id"]))
                elif previous_state is None:
                    pipeline.sadd(redis_state_key(state), str(record["job_id"]))
                
                pipeline.execute()
                return record
            except redis.exceptions.WatchError:
                continue
            except Exception:
                pipeline.unwatch()
                raise

        logger.error("Failed to optimistically mutate Redis job %s after retries", job_id)
        return None

    with _job_lock:
        record = _job_records.get(job_id)
        if record is None:
            return None
        mutator(record)
        return dict(record)


def persist_job_record(record: dict[str, Any], previous_state: str | None = None) -> None:
    if QUEUE_BACKEND == "redis":
        client = get_redis_client()
        state = str(record["state"])
        pipeline = client.pipeline()
        pipeline.set(redis_job_key(str(record["job_id"])), json.dumps(record))
        if previous_state and previous_state != state:
            pipeline.srem(redis_state_key(previous_state), str(record["job_id"]))
            if previous_state == "running":
                pipeline.lrem(redis_processing_key(), 1, str(record["job_id"]))
            pipeline.sadd(redis_state_key(state), str(record["job_id"]))
        elif previous_state is None:
            pipeline.sadd(redis_state_key(state), str(record["job_id"]))
        pipeline.execute()
        return

    with _job_lock:
        _job_records[str(record["job_id"])] = record


def remove_job_record(job_id: str, state: str | None = None) -> None:
    if QUEUE_BACKEND == "redis":
        client = get_redis_client()
        pipeline = client.pipeline()
        pipeline.delete(redis_job_key(job_id))
        if state:
            pipeline.srem(redis_state_key(state), job_id)
            if state == "running":
                pipeline.lrem(redis_processing_key(), 1, job_id)
        else:
            for known_state in ("queued", "running", "succeeded", "failed"):
                pipeline.srem(redis_state_key(known_state), job_id)
            pipeline.lrem(redis_processing_key(), 1, job_id)
        pipeline.execute()
        return

    with _job_lock:
        _job_records.pop(job_id, None)


def claim_next_redis_job_id(timeout_seconds: int = 2) -> str | None:
    client = get_redis_client()
    claimed = client.blmove(
        redis_queue_key(),
        redis_processing_key(),
        timeout=timeout_seconds,
        src="RIGHT",
        dest="LEFT",
    )
    if not claimed:
        return None
    return str(claimed)


def get_job_queue_depth() -> int:
    if QUEUE_BACKEND == "redis":
        try:
            client = get_redis_client()
            return int(client.llen(redis_queue_key()) + client.llen(redis_processing_key()))
        except Exception as exc:
            logger.warning("Failed to get Redis queue depth: %s", exc)
            return -1

    with _job_lock:
        return sum(
            1 for record in _job_records.values() if record["state"] in {"queued", "running"}
        )


def get_job_state_counts() -> dict[str, int]:
    counts = {"queued": 0, "running": 0, "succeeded": 0, "failed": 0}
    if QUEUE_BACKEND == "redis":
        try:
            client = get_redis_client()
            for state in counts:
                counts[state] = int(client.scard(redis_state_key(state)))
            return counts
        except Exception as exc:
            logger.warning("Failed to get Redis job state counts: %s", exc)
            return counts

    with _job_lock:
        for record in _job_records.values():
            state = record["state"]
            if state in counts:
                counts[state] += 1
    return counts


def record_to_status_response(record: dict[str, Any]) -> JobStatusResponse:
    return JobStatusResponse(
        job_id=str(record["job_id"]),
        job_type=record["job_type"],
        state=record["state"],
        request_id=str(record["request_id"]),
        submitted_at=str(record["submitted_at"]),
        started_at=record["started_at"],
        completed_at=record["completed_at"],
        error=record["error"],
        attempts=int(record.get("attempts", 0)),
        max_retries=int(record.get("max_retries", JOB_MAX_RETRIES)),
        dead_lettered=bool(record.get("dead_lettered", False)),
        dead_letter_reason=record.get("dead_letter_reason"),
        result=record["result"],
    )


def cleanup_expired_jobs(force: bool = False) -> int:
    if JOB_RETENTION_HOURS <= 0:
        return 0

    global _next_job_cleanup_epoch
    now = time.time()
    with _job_cleanup_lock:
        if not force and now < _next_job_cleanup_epoch:
            return 0
        _next_job_cleanup_epoch = now + max(60, JOB_CLEANUP_INTERVAL_SECONDS)

    cutoff = now - (JOB_RETENTION_HOURS * 3600)
    removed = 0

    if QUEUE_BACKEND == "redis":
        client = get_redis_client()
        for terminal_state in _job_terminal_states:
            state_members = client.smembers(redis_state_key(terminal_state))
            for job_id in state_members:
                raw = client.get(redis_job_key(str(job_id)))
                if not raw:
                    client.srem(redis_state_key(terminal_state), str(job_id))
                    continue

                parsed = json.loads(raw)
                completed_epoch = parsed.get("completed_epoch")
                if completed_epoch is None:
                    continue
                try:
                    completed_value = float(completed_epoch)
                except (TypeError, ValueError):
                    continue
                if completed_value <= cutoff:
                    remove_job_record(str(job_id), state=None)
                    removed += 1
    else:
        with _job_lock:
            expired_ids = [
                job_id
                for job_id, record in _job_records.items()
                if record["state"] in _job_terminal_states
                and record["completed_epoch"] is not None
                and record["completed_epoch"] <= cutoff
            ]
            for job_id in expired_ids:
                _job_records.pop(job_id, None)
                removed += 1

    if removed:
        logger.info(
            "Removed %s expired async job record(s) (ttl_hours=%s)",
            removed,
            JOB_RETENTION_HOURS,
        )
    return removed


def maybe_cleanup_jobs() -> None:
    try:
        cleanup_expired_jobs(force=False)
    except Exception:
        logger.exception("Async job cleanup failed unexpectedly")


def schedule_async_job(job_id: str) -> None:
    from jobs.worker import run_async_job

    if _job_event_loop is None or _job_event_loop.is_closed():
        threading.Thread(
            target=lambda: asyncio.run(run_async_job(job_id)),
            daemon=True,
            name=f"job-runner-{job_id[:8]}",
        ).start()
        return

    try:
        running_loop = asyncio.get_running_loop()
    except RuntimeError:
        running_loop = None

    if running_loop is _job_event_loop:
        _job_event_loop.create_task(run_async_job(job_id))
        return

    future = asyncio.run_coroutine_threadsafe(run_async_job(job_id), _job_event_loop)

    def _log_future_failure(done_future):
        if done_future.cancelled():
            logger.warning("Async job future cancelled job_id=%s", job_id)
            return
        exc = done_future.exception()
        if exc is not None:
            logger.exception("Async job future failed job_id=%s error=%s", job_id, exc)

    future.add_done_callback(_log_future_failure)


def utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def enqueue_job(job_type: Literal["predict", "generate"], request_id: str, payload: dict[str, Any]) -> tuple[str, int]:
    job_id = uuid4().hex

    record = {
        "job_id": job_id,
        "job_type": job_type,
        "state": "queued",
        "request_id": request_id,
        "submitted_at": utc_now_iso(),
        "submitted_epoch": time.time(),
        "started_at": None,
        "started_epoch": None,
        "completed_at": None,
        "completed_epoch": None,
        "error": None,
        "attempts": 0,
        "max_retries": JOB_MAX_RETRIES,
        "dead_lettered": False,
        "dead_letter_reason": None,
        "result": None,
        "payload": payload,
    }

    if QUEUE_BACKEND == "redis":
        try:
            active_jobs = get_job_queue_depth()
            if active_jobs >= JOB_QUEUE_MAX_PENDING:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"[{request_id}] Async queue is at capacity "
                        f"({JOB_QUEUE_MAX_PENDING} active jobs)."
                    ),
                )
            persist_job_record(record, previous_state=None)
            client = get_redis_client()
            client.rpush(redis_queue_key(), job_id)
            queue_depth = get_job_queue_depth()
            record_async_job_submitted(job_type)
            return job_id, max(queue_depth, 0)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"[{request_id}] Failed to enqueue Redis async job: {exc}",
            ) from exc

    with _job_lock:
        active_jobs = sum(
            1 for existing in _job_records.values() if existing["state"] in {"queued", "running"}
        )
        if active_jobs >= JOB_QUEUE_MAX_PENDING:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"[{request_id}] Async queue is at capacity "
                    f"({JOB_QUEUE_MAX_PENDING} active jobs)."
                ),
            )
        _job_records[job_id] = record
        queue_depth = active_jobs + 1

    try:
        schedule_async_job(job_id)
    except Exception as exc:
        with _job_lock:
            _job_records.pop(job_id, None)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Failed to schedule async job: {exc}",
        ) from exc
    record_async_job_submitted(job_type)
    return job_id, queue_depth
