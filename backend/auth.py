import hmac
import threading
import time
from uuid import uuid4

from fastapi import HTTPException, Request, status

from config import (
    API_KEY,
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_TRUST_X_FORWARDED_FOR,
    RATE_LIMIT_WINDOW_SECONDS,
    REQUIRE_API_KEY,
)

_rate_limit_lock = threading.Lock()
_rate_limit_buckets: dict[str, list[float]] = {}
_last_cleanup_epoch = 0.0


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or uuid4().hex[:12]


def extract_client_identifier(request: Request) -> str:
    if RATE_LIMIT_TRUST_X_FORWARDED_FOR:
        forwarded = request.headers.get("x-forwarded-for", "").strip()
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def extract_api_key(request: Request) -> str:
    header_key = request.headers.get("x-api-key", "").strip()
    if header_key:
        return header_key

    auth_header = request.headers.get("authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return ""


def enforce_api_key(request: Request, request_id: str) -> None:
    if not REQUIRE_API_KEY:
        return

    provided_key = extract_api_key(request)
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"[{request_id}] API key required. Provide X-API-Key header.",
        )
    if not hmac.compare_digest(provided_key, API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"[{request_id}] Invalid API key.",
        )


def enforce_rate_limit(request: Request, route_tag: str, request_id: str) -> None:
    if not RATE_LIMIT_ENABLED:
        return

    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    client_key = extract_client_identifier(request)
    bucket_key = f"{route_tag}:{client_key}"

    with _rate_limit_lock:
        global _last_cleanup_epoch
        if now - _last_cleanup_epoch > 60:
            _last_cleanup_epoch = now
            stale_keys: list[str] = []
            for key, timestamps in _rate_limit_buckets.items():
                timestamps[:] = [timestamp for timestamp in timestamps if timestamp > window_start]
                if not timestamps:
                    stale_keys.append(key)
            for key in stale_keys:
                _rate_limit_buckets.pop(key, None)

        bucket = _rate_limit_buckets.setdefault(bucket_key, [])
        bucket[:] = [timestamp for timestamp in bucket if timestamp > window_start]
        if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"[{request_id}] Rate limit exceeded for {route_tag}. "
                    f"Limit={RATE_LIMIT_MAX_REQUESTS}/{RATE_LIMIT_WINDOW_SECONDS}s."
                ),
            )
        bucket.append(now)


def enforce_request_access_controls(
    request: Request,
    route_tag: str,
    request_id: str,
) -> None:
    enforce_api_key(request, request_id=request_id)
    enforce_rate_limit(request, route_tag=route_tag, request_id=request_id)
