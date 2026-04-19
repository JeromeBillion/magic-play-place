import asyncio
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from config import DELETE_UPLOADS_AFTER_INFERENCE, JOB_MAX_RETRIES, QUEUE_BACKEND, logger
from jobs.dead_letter import push_dead_letter_entry
from jobs.queue import (
    get_job_worker_gate,
    get_redis_client,
    mutate_job_record,
    redis_queue_key,
    schedule_async_job,
    utc_now_iso,
)
from metrics import (
    record_async_job_dead_lettered,
    record_async_job_failed,
    record_async_job_retry,
    record_async_job_runtime,
    record_async_job_succeeded,
)
from models import TargetStateRequest

def schedule_job_retry(job_id: str, error_detail: str) -> bool:
    def _set_retry_state(record: dict[str, Any]) -> None:
        record["state"] = "queued"
        record["error"] = error_detail
        record["started_at"] = None
        record["started_epoch"] = None
        record["completed_at"] = None
        record["completed_epoch"] = None
        record["dead_lettered"] = False
        record["dead_letter_reason"] = None

    record = mutate_job_record(job_id, _set_retry_state)
    if record is None:
        return False

    job_type = str(record.get("job_type", ""))
    record_async_job_retry(job_type)

    if QUEUE_BACKEND == "redis":
        client = get_redis_client()
        client.rpush(redis_queue_key(), job_id)
    else:
        schedule_async_job(job_id)
    return True


def mark_job_dead_letter(job_id: str, error_detail: str) -> bool:
    def _set_dead_letter_state(record: dict[str, Any]) -> None:
        record["state"] = "failed"
        record["error"] = error_detail
        record["completed_at"] = utc_now_iso()
        record["completed_epoch"] = time.time()
        record["dead_lettered"] = True
        record["dead_letter_reason"] = "retry_exhausted"

    record = mutate_job_record(job_id, _set_dead_letter_state)
    if record is None:
        return False

    job_type = str(record.get("job_type", ""))

    dlq_entry = {
        "job_id": str(record["job_id"]),
        "job_type": record["job_type"],
        "request_id": str(record["request_id"]),
        "failed_at": str(record["completed_at"]),
        "attempts": int(record.get("attempts", 0)),
        "max_retries": int(record.get("max_retries", JOB_MAX_RETRIES)),
        "error": error_detail,
        "queue_backend": QUEUE_BACKEND,
    }
    push_dead_letter_entry(dlq_entry)
    record_async_job_failed(job_type)
    record_async_job_dead_lettered(job_type)
    return True


async def run_async_job(job_id: str) -> None:
    # Late import for pipelines to avoid circular dependencies
    from inference.pipeline import execute_generate_pipeline, execute_predict_pipeline

    worker_gate = get_job_worker_gate()
    await asyncio.to_thread(worker_gate.acquire)
    start_time = time.perf_counter()
    runtime_job_type = ""

    try:
        def _set_running(current: dict[str, Any]) -> None:
            current["state"] = "running"
            current["started_at"] = utc_now_iso()
            current["started_epoch"] = time.time()
            current["error"] = None
            current["attempts"] = int(current.get("attempts", 0)) + 1
            current["dead_lettered"] = False
            current["dead_letter_reason"] = None

        record = mutate_job_record(job_id, _set_running)
        if record is None:
            return

        runtime_job_type = str(record.get("job_type", ""))

        job_type = record["job_type"]
        request_id = str(record["request_id"])
        payload = record["payload"]

        try:
            if job_type == "predict":
                file_path_raw = payload.get("file_path")
                artifact_paths = payload.get("request_artifacts", [])
                result_model = await execute_predict_pipeline(
                    request_id=request_id,
                    stimulus_type=payload["stimulus_type"],
                    file_path=Path(file_path_raw) if file_path_raw else None,
                    normalized_text=payload["normalized_text"],
                    profile=payload["profile"],
                    age=payload["age"],
                    request_artifacts=[Path(path_str) for path_str in artifact_paths],
                    delete_artifacts=DELETE_UPLOADS_AFTER_INFERENCE,
                )
            else:
                target_state = TargetStateRequest.model_validate(payload["target_state"])
                result_model = await execute_generate_pipeline(target_state)

            def _set_succeeded(current: dict[str, Any]) -> None:
                current["state"] = "succeeded"
                current["result"] = result_model.model_dump()
                current["completed_at"] = utc_now_iso()
                current["completed_epoch"] = time.time()
                current["payload"] = None

            updated = mutate_job_record(job_id, _set_succeeded)
            if updated is None:
                return
            record_async_job_succeeded(job_type)
        except HTTPException as exc:
            error_detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            attempts = int(record.get("attempts", 0))
            max_retries = int(record.get("max_retries", JOB_MAX_RETRIES))
            if attempts <= max_retries:
                schedule_job_retry(job_id, error_detail=error_detail)
            else:
                mark_job_dead_letter(job_id, error_detail=error_detail)
        except Exception as exc:
            logger.exception("request_id=%s async_job_failed job_id=%s", request_id, job_id)
            error_detail = f"{type(exc).__name__}: {exc}"
            attempts = int(record.get("attempts", 0))
            max_retries = int(record.get("max_retries", JOB_MAX_RETRIES))
            if attempts <= max_retries:
                schedule_job_retry(job_id, error_detail=error_detail)
            else:
                mark_job_dead_letter(job_id, error_detail=error_detail)
    finally:
        worker_gate.release()
        if runtime_job_type:
            record_async_job_runtime(runtime_job_type, time.perf_counter() - start_time)
