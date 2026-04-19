import re
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status

from auth import enforce_request_access_controls, get_request_id
from config import ASYNC_JOB_QUEUE_ENABLED, QUEUE_BACKEND, logger
from inference.pipeline import prepare_predict_submission
from jobs.dead_letter import (
    get_dead_letter_count,
    get_dead_letter_entries,
    remove_dead_letter_entries_for_job,
)
from jobs.queue import (
    enqueue_job,
    get_job_queue_depth,
    get_job_record,
    get_redis_client,
    maybe_cleanup_jobs,
    mutate_job_record,
    record_to_status_response,
    redis_queue_key,
    schedule_async_job,
)
from media import cleanup_request_artifacts, maybe_cleanup_uploads
from models import (
    DeadLetterEntry,
    DeadLetterListResponse,
    JobStatusResponse,
    JobSubmitResponse,
    TargetStateRequest,
)

router = APIRouter()

_JOB_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def validate_job_id(job_id: str, request_id: str) -> None:
    """Reject job IDs that don't match the expected hex format."""
    if not _JOB_ID_PATTERN.match(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"[{request_id}] Invalid job_id format. Expected 32 hex characters.",
        )


@router.post("/predict/jobs", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_predict_job(
    request: Request,
    media: UploadFile | None = File(default=None),
    text_prompt: str | None = Form(default=None),
    profile: Literal["neurotypical", "adhd", "asd"] = Form(default="neurotypical"),
    age: Literal["child", "adult", "elderly"] = Form(default="adult"),
) -> JobSubmitResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/predict/jobs", request_id=request_id)
    if not ASYNC_JOB_QUEUE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Async job queue is disabled.",
        )

    maybe_cleanup_uploads()
    maybe_cleanup_jobs()
    stimulus_type, file_path, normalized_text, request_artifacts = await prepare_predict_submission(
        media=media,
        text_prompt=text_prompt,
        request_id=request_id,
    )

    try:
        job_id, queue_depth = enqueue_job(
            "predict",
            request_id=request_id,
            payload={
                "stimulus_type": stimulus_type,
                "file_path": str(file_path) if file_path else None,
                "normalized_text": normalized_text,
                "profile": profile,
                "age": age,
                "request_artifacts": [str(path) for path in request_artifacts],
            },
        )
    except Exception:
        cleanup_request_artifacts(request_artifacts, request_id=request_id)
        raise

    return JobSubmitResponse(
        job_id=job_id,
        job_type="predict",
        state="queued",
        queue_depth=queue_depth,
        poll_url=f"/jobs/{job_id}",
    )


@router.post("/generate/jobs", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_generate_job(req: TargetStateRequest, request: Request) -> JobSubmitResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/generate/jobs", request_id=request_id)
    if not ASYNC_JOB_QUEUE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Async job queue is disabled.",
        )

    maybe_cleanup_jobs()
    job_id, queue_depth = enqueue_job(
        "generate",
        request_id=request_id,
        payload={"target_state": req.model_dump()},
    )
    return JobSubmitResponse(
        job_id=job_id,
        job_type="generate",
        state="queued",
        queue_depth=queue_depth,
        poll_url=f"/jobs/{job_id}",
    )


@router.get("/jobs/dead-letter", response_model=DeadLetterListResponse)
async def list_dead_letter_jobs(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500),
) -> DeadLetterListResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/jobs/dead-letter", request_id=request_id)
    maybe_cleanup_jobs()

    try:
        raw_entries = get_dead_letter_entries(limit=limit)
        total = get_dead_letter_count()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Dead-letter backend unavailable: {exc}",
        ) from exc

    entries: list[DeadLetterEntry] = []
    for raw_entry in raw_entries:
        try:
            entries.append(DeadLetterEntry.model_validate(raw_entry))
        except Exception:
            logger.warning(
                "request_id=%s skipping_malformed_dead_letter_entry job_id=%s",
                request_id,
                raw_entry.get("job_id"),
            )

    return DeadLetterListResponse(total=total, entries=entries)


@router.post("/jobs/{job_id}/retry", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def retry_job(job_id: str, request: Request) -> JobSubmitResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/jobs/retry", request_id=request_id)
    validate_job_id(job_id, request_id)
    if not ASYNC_JOB_QUEUE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Async job queue is disabled.",
        )

    maybe_cleanup_jobs()
    try:
        def _set_retry(record: dict) -> None:
            current_state = str(record.get("state", ""))
            if current_state in {"queued", "running"}:
                raise ValueError(f"Job '{job_id}' is already active ({current_state}).")
            if current_state == "succeeded":
                raise ValueError(f"Job '{job_id}' already succeeded and cannot be retried.")
            if record.get("payload") is None:
                raise ValueError(f"Job '{job_id}' cannot be retried because payload is missing.")

            record["state"] = "queued"
            record["error"] = None
            record["result"] = None
            record["started_at"] = None
            record["started_epoch"] = None
            record["completed_at"] = None
            record["completed_epoch"] = None
            record["attempts"] = 0
            record["dead_lettered"] = False
            record["dead_letter_reason"] = None

        record = mutate_job_record(job_id, _set_retry)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"[{request_id}] Job '{job_id}' not found.",
            )

        remove_dead_letter_entries_for_job(job_id)
        if QUEUE_BACKEND == "redis":
            client = get_redis_client()
            client.rpush(redis_queue_key(), job_id)
        else:
            schedule_async_job(job_id)
        queue_depth = max(get_job_queue_depth(), 0)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"[{request_id}] {exc}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Failed to retry async job '{job_id}': {exc}",
        ) from exc

    return JobSubmitResponse(
        job_id=job_id,
        job_type=record["job_type"],
        state="queued",
        queue_depth=queue_depth,
        poll_url=f"/jobs/{job_id}",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, request: Request) -> JobStatusResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/jobs", request_id=request_id)
    validate_job_id(job_id, request_id)
    maybe_cleanup_jobs()
    try:
        record = get_job_record(job_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"[{request_id}] Job backend unavailable: {exc}",
        ) from exc
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"[{request_id}] Job '{job_id}' not found.",
        )
    return record_to_status_response(record)

