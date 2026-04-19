from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import (
    ALLOW_CREDENTIALS,
    CORS_ORIGINS,
    INFERENCE_MODE,
    TRIBEV2_PRELOAD_MODEL,
    logger,
)
from inference.tribe import load_tribe_model
from jobs.queue import init_job_queue, maybe_cleanup_jobs, teardown_job_queue
from media import maybe_cleanup_uploads
from metrics import configure_opentelemetry
from routes.generate import router as generate_router
from routes.health import router as health_router
from routes.jobs import router as jobs_router
from routes.metrics import router as metrics_router
from routes.predict import router as predict_router


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    configure_opentelemetry()
    maybe_cleanup_uploads()
    maybe_cleanup_jobs()
    init_job_queue()
    if INFERENCE_MODE == "tribe" and TRIBEV2_PRELOAD_MODEL:
        try:
            await asyncio.to_thread(load_tribe_model)
        except Exception as exc:
            logger.error("Tribe preload failed: %s", exc)
    try:
        yield
    finally:
        teardown_job_queue()


app = FastAPI(
    title="Magic Play Place - Tribe v2 Core",
    version="1.2.0",
    lifespan=app_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_trace_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", "").strip() or uuid4().hex[:12]
    request.state.request_id = request_id
    start_time = time.time()

    from metrics import _otel_tracer as tracer

    if tracer is None:
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_id=%s method=%s path=%s unhandled_exception",
                request_id,
                request.method,
                request.url.path,
            )
            raise

        duration_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    span_name = f"{request.method} {request.url.path}"
    with tracer.start_as_current_span(span_name) as span:
        span.set_attribute("http.request_id", request_id)
        span.set_attribute("http.method", request.method)
        span.set_attribute("http.path", request.url.path)
        try:
            response = await call_next(request)
        except Exception as exc:
            span.set_attribute("error", True)
            span.record_exception(exc)
            logger.exception(
                "request_id=%s method=%s path=%s unhandled_exception",
                request_id,
                request.method,
                request.url.path,
            )
            raise

        duration_ms = int((time.time() - start_time) * 1000)
        span.set_attribute("http.status_code", response.status_code)
        span.set_attribute("http.duration_ms", duration_ms)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(predict_router)
app.include_router(generate_router)
app.include_router(jobs_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
