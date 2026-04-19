from typing import Any

from fastapi import APIRouter, Request

from auth import enforce_api_key, get_request_id
from config import (
    ASYNC_JOB_QUEUE_ENABLED,
    DELETE_UPLOADS_AFTER_INFERENCE,
    GENERATE_MODE,
    GENERATE_MODEL_LOOP_ITERATIONS,
    GENERATE_MODEL_LOOP_SIGNED_OFF,
    GENERATE_MODEL_LOOP_SIGNOFF_REPORT,
    GENERATE_MODEL_LOOP_VALIDATED,
    GENERATE_MODEL_LOOP_VALIDATION_REPORT,
    INFERENCE_MODE,
    JOB_MAX_RETRIES,
    JOB_QUEUE_MAX_PENDING,
    JOB_RETENTION_HOURS,
    JOB_WORKER_CONCURRENCY,
    MAX_UPLOAD_MB,
    METRICS_ENABLED,
    METRICS_REQUIRE_API_KEY,
    OTEL_ENABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_SERVICE_NAME,
    QUEUE_BACKEND,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    REQUIRE_API_KEY,
    TRIBEV2_CHECKPOINT_DIR,
    UPLOAD_CLEANUP_INTERVAL_SECONDS,
    UPLOAD_TTL_HOURS,
)
from inference.tribe import get_tribe_model_status
from jobs.dead_letter import get_dead_letter_count
from jobs.queue import get_job_queue_depth, get_job_state_counts, maybe_cleanup_jobs

router = APIRouter()

@router.get("/health")
def health_check() -> dict[str, Any]:
    """Minimal liveness probe for load balancers and container orchestration."""
    return {"status": "ok"}


@router.get("/admin/status")
async def admin_status(request: Request) -> dict[str, Any]:
    """Full diagnostics endpoint — requires API key authentication."""
    request_id = get_request_id(request)
    enforce_api_key(request, request_id=request_id)
    maybe_cleanup_jobs()
    job_counts = get_job_state_counts()
    return {
        "status": "ok",
        "message": "Magic Play Place Laboratory is active.",
        "inference_mode": INFERENCE_MODE,
        "generate_mode": GENERATE_MODE,
        "generate_model_loop_validated": GENERATE_MODEL_LOOP_VALIDATED,
        "generate_model_loop_validation_report_configured": bool(
            GENERATE_MODEL_LOOP_VALIDATION_REPORT
        ),
        "generate_model_loop_validation_report": (
            GENERATE_MODEL_LOOP_VALIDATION_REPORT or None
        ),
        "generate_model_loop_signed_off": GENERATE_MODEL_LOOP_SIGNED_OFF,
        "generate_model_loop_signoff_report_configured": bool(
            GENERATE_MODEL_LOOP_SIGNOFF_REPORT
        ),
        "generate_model_loop_signoff_report": (GENERATE_MODEL_LOOP_SIGNOFF_REPORT or None),
        "generate_model_loop_iterations": GENERATE_MODEL_LOOP_ITERATIONS,
        "queue_backend": QUEUE_BACKEND,
        "metrics_enabled": METRICS_ENABLED,
        "metrics_require_api_key": METRICS_REQUIRE_API_KEY,
        "otel_enabled": OTEL_ENABLED,
        "otel_service_name": OTEL_SERVICE_NAME,
        "otel_exporter_otlp_endpoint": OTEL_EXPORTER_OTLP_ENDPOINT,
        "tribe_model_status": get_tribe_model_status(),
        "tribe_checkpoint_configured": bool(TRIBEV2_CHECKPOINT_DIR),
        "max_upload_mb": MAX_UPLOAD_MB,
        "upload_ttl_hours": UPLOAD_TTL_HOURS,
        "upload_cleanup_interval_seconds": UPLOAD_CLEANUP_INTERVAL_SECONDS,
        "delete_uploads_after_inference": DELETE_UPLOADS_AFTER_INFERENCE,
        "api_key_required": REQUIRE_API_KEY,
        "rate_limit_enabled": RATE_LIMIT_ENABLED,
        "rate_limit_window_seconds": RATE_LIMIT_WINDOW_SECONDS,
        "rate_limit_max_requests": RATE_LIMIT_MAX_REQUESTS,
        "async_job_queue_enabled": ASYNC_JOB_QUEUE_ENABLED,
        "job_worker_concurrency": JOB_WORKER_CONCURRENCY,
        "job_queue_max_pending": JOB_QUEUE_MAX_PENDING,
        "job_max_retries": JOB_MAX_RETRIES,
        "job_retention_hours": JOB_RETENTION_HOURS,
        "job_queue_depth": get_job_queue_depth(),
        "job_queued": job_counts["queued"],
        "job_running": job_counts["running"],
        "job_succeeded": job_counts["succeeded"],
        "job_failed": job_counts["failed"],
        "dead_letter_count": get_dead_letter_count(),
    }
