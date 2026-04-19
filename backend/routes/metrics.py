from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import PlainTextResponse

from auth import enforce_api_key, get_request_id
from config import METRICS_ENABLED, METRICS_REQUIRE_API_KEY
from jobs.queue import maybe_cleanup_jobs
from metrics import build_prometheus_metrics_payload

router = APIRouter()

@router.get("/metrics", response_class=PlainTextResponse)
async def metrics_endpoint(request: Request) -> PlainTextResponse:
    request_id = get_request_id(request)
    if not METRICS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"[{request_id}] Metrics endpoint is disabled.",
        )

    if METRICS_REQUIRE_API_KEY:
        enforce_api_key(request, request_id=request_id)

    maybe_cleanup_jobs()
    payload = build_prometheus_metrics_payload()
    return PlainTextResponse(payload, media_type="text/plain; version=0.0.4")
