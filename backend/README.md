# Magic Play Place Backend

FastAPI service powering:
- `POST /predict` for multimodal discovery input
- `POST /generate` for therapeutic payload generation
- `POST /predict/jobs` for queued async discovery jobs
- `POST /generate/jobs` for queued async therapeutic jobs
- `GET /jobs/{job_id}` for async job status/result polling
- `GET /jobs/dead-letter` to inspect failed jobs after retry exhaustion
- `POST /jobs/{job_id}/retry` to requeue failed jobs for manual replay
- `GET /metrics` for Prometheus-format runtime and queue metrics
- `GET /health` for runtime health checks

## Quick Start

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Install `tribev2` package source (required for real inference mode):

```bash
pip install -e ..\engine\tribev2
```

4. Configure environment values:

```bash
cp .env.example .env
```

5. Run the API:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Run Tests

Use deterministic API tests:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

## Run Model-Loop Gate 1 Validation

Generate offline replay validation artifacts for `/generate` model-loop:

```bash
python scripts/run_generate_model_loop_validation.py
```

Outputs:
- `docs/reports/generate_model_loop_gate1_baseline.json`
- `docs/reports/generate_model_loop_gate1_baseline.md`

## Run Model-Loop Gate 2 Pilot

Run prospective pilot checks across sync and async generation paths:

```bash
python scripts/run_generate_model_loop_pilot.py
```

Outputs:
- `docs/reports/generate_model_loop_gate2_pilot.json`
- `docs/reports/generate_model_loop_gate2_pilot.md`

## Generate Gate 3 Sign-Off

Create the promotion sign-off artifact from Gate 1 + Gate 2 reports:

```bash
python scripts/run_generate_model_loop_gate3_signoff.py
```

Outputs:
- `docs/reports/generate_model_loop_gate3_signoff.json`
- `docs/reports/generate_model_loop_gate3_signoff.md`

## Environment Variables

- `CORS_ORIGINS`: Comma-separated allowed origins (default: `http://localhost:3000`)
- `INFERENCE_MODE`: `mock` or `tribe`
- `UPLOAD_DIR`: Upload folder path (default: `uploads`)
- `MAX_UPLOAD_MB`: Max upload size in megabytes (default: `50`)
- `MAX_TEXT_CHARS`: Max text prompt length (default: `8000`)
- `UPLOAD_TTL_HOURS`: Retention window for uploaded/generated artifacts in hours (default: `24`)
- `UPLOAD_CLEANUP_INTERVAL_SECONDS`: Background cleanup cadence trigger window (default: `900`)
- `DELETE_UPLOADS_AFTER_INFERENCE`: Delete request artifacts immediately after `/predict` completes (`true`/`false`)
- `REQUIRE_API_KEY`: Require API key for `/predict`, `/generate`, and job endpoints (`true`/`false`)
- `API_KEY`: Expected API key value when `REQUIRE_API_KEY=true`
- `RATE_LIMIT_ENABLED`: Enable in-memory request limiting (`true`/`false`)
- `RATE_LIMIT_WINDOW_SECONDS`: Rate-limit window size (default: `60`)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per client per route within the window (default: `30`)
- `RATE_LIMIT_TRUST_X_FORWARDED_FOR`: Use `X-Forwarded-For` for client identity behind a trusted proxy
- `ASYNC_JOB_QUEUE_ENABLED`: Enable queued async endpoints (`true`/`false`)
- `JOB_WORKER_CONCURRENCY`: Max concurrently running async jobs (default: `2`)
- `JOB_QUEUE_MAX_PENDING`: Max queued+running jobs before rejection (default: `100`)
- `JOB_RETENTION_HOURS`: Retain completed job records for polling window (default: `24`)
- `JOB_CLEANUP_INTERVAL_SECONDS`: Cleanup cadence for expired job records (default: `900`)
- `GENERATE_SIMULATION_DELAY_SECONDS`: Delay used by simulation-mode `/generate` and `/generate/jobs`
- `GENERATE_MODE`: `simulation` (default) or `model_loop`
- `GENERATE_MODEL_LOOP_VALIDATED`: Must be `true` before `GENERATE_MODE=model_loop`
- `GENERATE_MODEL_LOOP_VALIDATION_REPORT`: Required validation reference when model-loop validation is enabled
- `GENERATE_MODEL_LOOP_SIGNED_OFF`: Must be `true` before `GENERATE_MODE=model_loop`
- `GENERATE_MODEL_LOOP_SIGNOFF_REPORT`: Required Gate 3 sign-off reference when model-loop is enabled
- `GENERATE_MODEL_LOOP_ITERATIONS`: Iteration budget for model-loop generation mode (default: `24`)
- `JOB_MAX_RETRIES`: Retry budget per async job before dead-lettering (default: `2`)
- `DLQ_MAX_ITEMS`: Max dead-letter entries retained (default: `1000`)
- `METRICS_ENABLED`: Enable Prometheus metrics endpoint (`/metrics`)
- `METRICS_REQUIRE_API_KEY`: Require API key for `/metrics` endpoint
- `OTEL_ENABLED`: Enable OpenTelemetry trace export
- `OTEL_SERVICE_NAME`: Service name attached to emitted traces
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP HTTP endpoint for trace export (e.g. `http://otel-collector:4318/v1/traces`)
- `OTEL_EXPORTER_OTLP_HEADERS`: Optional comma-separated OTLP headers (`key=value,key2=value2`)
- `QUEUE_BACKEND`: `inmemory` (default) or `redis`
- `REDIS_URL`: Redis connection URL when `QUEUE_BACKEND=redis`
- `REDIS_KEY_PREFIX`: Redis key prefix for queue/job state names
- `REDIS_WORKER_POLL_SECONDS`: Blocking poll timeout used by `redis_worker.py`
- `TRIBEV2_CHECKPOINT_DIR`: Checkpoint directory or HF repo id for model loading
- `TRIBEV2_CHECKPOINT_NAME`: Checkpoint filename (default: `best.ckpt`)
- `TRIBEV2_CACHE_FOLDER`: Feature/model cache directory
- `TRIBEV2_DEVICE`: `auto`, `cpu`, or `cuda`
- `TRIBEV2_CLUSTER`: Optional cluster name forwarded to tribev2 extractor infra
- `TRIBEV2_PRELOAD_MODEL`: Preload model at startup (`true`/`false`)

## Deployment Notes

- Use explicit `CORS_ORIGINS` in production.
- For real inference, set `INFERENCE_MODE=tribe` and configure `TRIBEV2_CHECKPOINT_DIR`.
- Media uploads are validated by extension + MIME + binary signature before inference.
- Artifact storage is lifecycle-controlled by TTL cleanup and optional delete-after-inference.
- High-load paths can use queued async endpoints (`/predict/jobs`, `/generate/jobs`) and poll `GET /jobs/{job_id}`.
- Failed async jobs are retried automatically up to `JOB_MAX_RETRIES` and then stored in dead-letter history (`GET /jobs/dead-letter`).
- Prometheus metrics are exported at `GET /metrics` for queue depth, retry/dead-letter counters, and runtime histograms.
- OpenTelemetry traces can be exported when `OTEL_ENABLED=true`.
- `GENERATE_MODE=model_loop` is gated behind explicit validation + Gate 3 sign-off config and remains non-clinical research output.
- When `GENERATE_MODE=model_loop`, `/generate` returns `validation_reference`, `signoff_reference`, and `optimization_metrics`.
- API responses include `X-Request-ID`; backend logs are request-ID traceable.
- Evidence/claim governance policy: `docs/RESEARCH_USE_AND_EVIDENCE_POLICY.md`.

## Durable Redis Worker Mode

1. Set `QUEUE_BACKEND=redis` and configure `REDIS_URL`.
2. Start API server as usual.
3. Run a separate worker process:

```bash
python redis_worker.py
```

In Redis mode, async jobs are persisted and processed by external workers instead of in-process background tasks.
