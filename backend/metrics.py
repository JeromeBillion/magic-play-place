import threading
from typing import Any

from config import (
    GENERATE_MODE,
    GENERATE_MODEL_LOOP_SIGNED_OFF,
    GENERATE_MODEL_LOOP_VALIDATED,
    OTEL_ENABLED,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_SERVICE_NAME,
    QUEUE_BACKEND,
    logger,
)

_metrics_lock = threading.Lock()
_otel_lock = threading.Lock()
_otel_tracer: Any | None = None

_METRIC_HISTOGRAM_BOUNDS = (0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0)
_metrics_predict_runtime = {
    "buckets": [0 for _ in _METRIC_HISTOGRAM_BOUNDS],
    "overflow_count": 0,
    "count": 0,
    "sum": 0.0,
}
_metrics_generate_runtime = {
    "buckets": [0 for _ in _METRIC_HISTOGRAM_BOUNDS],
    "overflow_count": 0,
    "count": 0,
    "sum": 0.0,
}
_metrics_async_runtime = {
    "predict": {
        "buckets": [0 for _ in _METRIC_HISTOGRAM_BOUNDS],
        "overflow_count": 0,
        "count": 0,
        "sum": 0.0,
    },
    "generate": {
        "buckets": [0 for _ in _METRIC_HISTOGRAM_BOUNDS],
        "overflow_count": 0,
        "count": 0,
        "sum": 0.0,
    },
}
_metrics_async_jobs_submitted = {"predict": 0, "generate": 0}
_metrics_async_jobs_succeeded = {"predict": 0, "generate": 0}
_metrics_async_jobs_failed = {"predict": 0, "generate": 0}
_metrics_async_jobs_retried = {"predict": 0, "generate": 0}
_metrics_async_jobs_dead_lettered = {"predict": 0, "generate": 0}

def parse_otel_headers(raw_headers: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for token in raw_headers.split(","):
        part = token.strip()
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            parsed[key] = value
    return parsed


def configure_opentelemetry() -> None:
    global _otel_tracer

    if not OTEL_ENABLED:
        return

    with _otel_lock:
        if _otel_tracer is not None:
            return

        try:
            from opentelemetry import trace
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter,
            )
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor
        except ImportError as exc:
            raise RuntimeError(
                "OTEL_ENABLED=true requires OpenTelemetry packages. "
                "Install: opentelemetry-api, opentelemetry-sdk, "
                "opentelemetry-exporter-otlp-proto-http"
            ) from exc

        exporter_headers = parse_otel_headers(OTEL_EXPORTER_OTLP_HEADERS)
        exporter = OTLPSpanExporter(
            endpoint=OTEL_EXPORTER_OTLP_ENDPOINT,
            headers=exporter_headers or None,
        )
        provider = TracerProvider(
            resource=Resource.create({"service.name": OTEL_SERVICE_NAME})
        )
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)
        _otel_tracer = trace.get_tracer("magic-play-place.backend")
        logger.info(
            "OpenTelemetry tracing enabled service=%s endpoint=%s",
            OTEL_SERVICE_NAME,
            OTEL_EXPORTER_OTLP_ENDPOINT,
        )


def _observe_histogram(histogram: dict[str, Any], value_seconds: float) -> None:
    bounded_value = max(0.0, float(value_seconds))
    histogram["count"] += 1
    histogram["sum"] += bounded_value
    for index, bound in enumerate(_METRIC_HISTOGRAM_BOUNDS):
        if bounded_value <= bound:
            histogram["buckets"][index] += 1
            return
    histogram["overflow_count"] += 1


def _increment_job_counter(counter: dict[str, int], job_type: str) -> None:
    if job_type not in counter:
        return
    counter[job_type] += 1


def record_predict_runtime(duration_seconds: float) -> None:
    with _metrics_lock:
        _observe_histogram(_metrics_predict_runtime, duration_seconds)


def record_generate_runtime(duration_seconds: float) -> None:
    with _metrics_lock:
        _observe_histogram(_metrics_generate_runtime, duration_seconds)


def record_async_job_runtime(job_type: str, duration_seconds: float) -> None:
    with _metrics_lock:
        histogram = _metrics_async_runtime.get(job_type)
        if histogram is None:
            return
        _observe_histogram(histogram, duration_seconds)


def record_async_job_submitted(job_type: str) -> None:
    with _metrics_lock:
        _increment_job_counter(_metrics_async_jobs_submitted, job_type)


def record_async_job_succeeded(job_type: str) -> None:
    with _metrics_lock:
        _increment_job_counter(_metrics_async_jobs_succeeded, job_type)


def record_async_job_failed(job_type: str) -> None:
    with _metrics_lock:
        _increment_job_counter(_metrics_async_jobs_failed, job_type)


def record_async_job_retry(job_type: str) -> None:
    with _metrics_lock:
        _increment_job_counter(_metrics_async_jobs_retried, job_type)


def record_async_job_dead_lettered(job_type: str) -> None:
    with _metrics_lock:
        _increment_job_counter(_metrics_async_jobs_dead_lettered, job_type)


def _prometheus_labels(labels: dict[str, str] | None = None) -> str:
    if not labels:
        return ""

    parts = []
    for key in sorted(labels):
        raw_value = str(labels[key])
        escaped = (
            raw_value.replace("\\", "\\\\")
            .replace("\n", "\\n")
            .replace('"', '\\"')
        )
        parts.append(f'{key}="{escaped}"')
    return "{" + ",".join(parts) + "}"


def _render_histogram_lines(
    metric_name: str,
    histogram: dict[str, Any],
    labels: dict[str, str] | None = None,
) -> list[str]:
    lines: list[str] = []
    cumulative = 0
    for bound, bucket_count in zip(_METRIC_HISTOGRAM_BOUNDS, histogram["buckets"]):
        cumulative += int(bucket_count)
        bucket_labels = dict(labels or {})
        bucket_labels["le"] = f"{bound:g}"
        lines.append(f"{metric_name}_bucket{_prometheus_labels(bucket_labels)} {cumulative}")

    inf_labels = dict(labels or {})
    inf_labels["le"] = "+Inf"
    lines.append(f"{metric_name}_bucket{_prometheus_labels(inf_labels)} {int(histogram['count'])}")
    lines.append(f"{metric_name}_count{_prometheus_labels(labels)} {int(histogram['count'])}")
    lines.append(f"{metric_name}_sum{_prometheus_labels(labels)} {float(histogram['sum']):.6f}")
    return lines


def build_prometheus_metrics_payload() -> str:
    with _metrics_lock:
        predict_runtime = {
            "buckets": list(_metrics_predict_runtime["buckets"]),
            "count": int(_metrics_predict_runtime["count"]),
            "sum": float(_metrics_predict_runtime["sum"]),
        }
        generate_runtime = {
            "buckets": list(_metrics_generate_runtime["buckets"]),
            "count": int(_metrics_generate_runtime["count"]),
            "sum": float(_metrics_generate_runtime["sum"]),
        }
        async_runtime = {
            job_type: {
                "buckets": list(hist["buckets"]),
                "count": int(hist["count"]),
                "sum": float(hist["sum"]),
            }
            for job_type, hist in _metrics_async_runtime.items()
        }
        submitted = dict(_metrics_async_jobs_submitted)
        succeeded = dict(_metrics_async_jobs_succeeded)
        failed = dict(_metrics_async_jobs_failed)
        retried = dict(_metrics_async_jobs_retried)
        dead_lettered = dict(_metrics_async_jobs_dead_lettered)

    # Late imports to avoid circular dependency
    from jobs.queue import get_job_queue_depth, get_job_state_counts
    from jobs.dead_letter import get_dead_letter_count

    queue_depth = get_job_queue_depth()
    state_counts = get_job_state_counts()
    dead_letter_count = get_dead_letter_count()

    lines = [
        "# HELP mpp_queue_backend_info Queue backend info metric.",
        "# TYPE mpp_queue_backend_info gauge",
        f'mpp_queue_backend_info{{backend="{QUEUE_BACKEND}"}} 1',
        "# HELP mpp_generate_mode_info Therapeutics generation mode info metric.",
        "# TYPE mpp_generate_mode_info gauge",
        f'mpp_generate_mode_info{{mode="{GENERATE_MODE}"}} 1',
        "# HELP mpp_generate_model_loop_validated Whether model-loop has validated evidence.",
        "# TYPE mpp_generate_model_loop_validated gauge",
        f"mpp_generate_model_loop_validated {1 if GENERATE_MODEL_LOOP_VALIDATED else 0}",
        "# HELP mpp_generate_model_loop_signed_off Whether model-loop has Gate 3 sign-off.",
        "# TYPE mpp_generate_model_loop_signed_off gauge",
        f"mpp_generate_model_loop_signed_off {1 if GENERATE_MODEL_LOOP_SIGNED_OFF else 0}",
        "# HELP mpp_async_queue_depth Active async queue depth (queued + running).",
        "# TYPE mpp_async_queue_depth gauge",
        f"mpp_async_queue_depth {int(queue_depth)}",
        "# HELP mpp_async_jobs_state Current async jobs by state.",
        "# TYPE mpp_async_jobs_state gauge",
    ]

    for state_name in ("queued", "running", "succeeded", "failed"):
        lines.append(
            f'mpp_async_jobs_state{{state="{state_name}"}} {int(state_counts.get(state_name, 0))}'
        )

    lines.extend(
        [
            "# HELP mpp_dead_letter_count Current dead-letter queue size.",
            "# TYPE mpp_dead_letter_count gauge",
            f"mpp_dead_letter_count {int(dead_letter_count)}",
            "# HELP mpp_async_jobs_submitted_total Total async jobs accepted.",
            "# TYPE mpp_async_jobs_submitted_total counter",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.append(
            f'mpp_async_jobs_submitted_total{{job_type="{job_type}"}} {int(submitted[job_type])}'
        )

    lines.extend(
        [
            "# HELP mpp_async_jobs_succeeded_total Total async jobs completed successfully.",
            "# TYPE mpp_async_jobs_succeeded_total counter",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.append(
            f'mpp_async_jobs_succeeded_total{{job_type="{job_type}"}} {int(succeeded[job_type])}'
        )

    lines.extend(
        [
            "# HELP mpp_async_jobs_failed_total Total async jobs that reached terminal failed state.",
            "# TYPE mpp_async_jobs_failed_total counter",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.append(
            f'mpp_async_jobs_failed_total{{job_type="{job_type}"}} {int(failed[job_type])}'
        )

    lines.extend(
        [
            "# HELP mpp_async_jobs_retried_total Total async job retry schedules.",
            "# TYPE mpp_async_jobs_retried_total counter",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.append(
            f'mpp_async_jobs_retried_total{{job_type="{job_type}"}} {int(retried[job_type])}'
        )

    lines.extend(
        [
            "# HELP mpp_async_jobs_dead_lettered_total Total async jobs sent to dead-letter queue.",
            "# TYPE mpp_async_jobs_dead_lettered_total counter",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.append(
            f'mpp_async_jobs_dead_lettered_total{{job_type="{job_type}"}} {int(dead_lettered[job_type])}'
        )

    lines.extend(
        [
            "# HELP mpp_predict_runtime_seconds Runtime distribution for /predict inference pipeline.",
            "# TYPE mpp_predict_runtime_seconds histogram",
        ]
    )
    lines.extend(_render_histogram_lines("mpp_predict_runtime_seconds", predict_runtime))

    lines.extend(
        [
            "# HELP mpp_generate_runtime_seconds Runtime distribution for /generate pipeline.",
            "# TYPE mpp_generate_runtime_seconds histogram",
        ]
    )
    lines.extend(_render_histogram_lines("mpp_generate_runtime_seconds", generate_runtime))

    lines.extend(
        [
            "# HELP mpp_async_job_runtime_seconds Runtime distribution for async job attempts.",
            "# TYPE mpp_async_job_runtime_seconds histogram",
        ]
    )
    for job_type in ("predict", "generate"):
        lines.extend(
            _render_histogram_lines(
                "mpp_async_job_runtime_seconds",
                async_runtime[job_type],
                labels={"job_type": job_type},
            )
        )

    return "\n".join(lines) + "\n"
