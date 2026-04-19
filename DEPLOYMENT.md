# Deployment Guide

## Services
- Frontend: Next.js app in `frontend/`
- Backend: FastAPI app in `backend/`

## 1) Backend

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e ..\engine\tribev2
copy .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## 2) Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run build
npm run start
```

Frontend expects backend at `NEXT_PUBLIC_API_BASE_URL`.

## Recommended Production Settings

- Backend:
  - Set `CORS_ORIGINS` to your real frontend origin(s)
  - Set `INFERENCE_MODE=tribe` and configure `TRIBEV2_CHECKPOINT_DIR` for real inference
  - Set artifact lifecycle policy: `UPLOAD_TTL_HOURS`, `UPLOAD_CLEANUP_INTERVAL_SECONDS`, and optionally `DELETE_UPLOADS_AFTER_INFERENCE=true` for sensitive workflows
  - Enable access controls: `REQUIRE_API_KEY=true`, strong `API_KEY`, and tune rate limits (`RATE_LIMIT_*`)
  - For durable async execution, set `QUEUE_BACKEND=redis`, configure `REDIS_URL`, and run worker process (`python redis_worker.py`)
  - Tune async queue controls for workload shape: `ASYNC_JOB_QUEUE_ENABLED`, `JOB_WORKER_CONCURRENCY`, `JOB_QUEUE_MAX_PENDING`, `JOB_RETENTION_HOURS`, `JOB_MAX_RETRIES`, `DLQ_MAX_ITEMS`
  - Promote `/generate` model-loop only with full gates configured:
    - `GENERATE_MODE=model_loop`
    - `GENERATE_MODEL_LOOP_VALIDATED=true`
    - `GENERATE_MODEL_LOOP_VALIDATION_REPORT=docs/reports/generate_model_loop_gate1_baseline.md`
    - `GENERATE_MODEL_LOOP_SIGNED_OFF=true`
    - `GENERATE_MODEL_LOOP_SIGNOFF_REPORT=docs/reports/generate_model_loop_gate3_signoff.md`
  - Enable metrics scraping with `METRICS_ENABLED=true` and configure auth stance via `METRICS_REQUIRE_API_KEY`
  - Enable distributed tracing only when collector is available: `OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and optional `OTEL_EXPORTER_OTLP_HEADERS`
  - Regenerate model-loop gate artifacts before promotion:
    - `python backend/scripts/run_generate_model_loop_validation.py`
    - `python backend/scripts/run_generate_model_loop_pilot.py`
    - `python backend/scripts/run_generate_model_loop_gate3_signoff.py`
  - Ensure media clients send matching extension + MIME type (backend also validates file signatures)
  - Put API behind HTTPS reverse proxy
- Frontend:
  - Keep `output: "standalone"` for container-friendly deployments
  - `NEXT_PUBLIC_*` variables are build-time values in Next.js and must be set before `npm run build` / image build
  - Set `NEXT_PUBLIC_API_BASE_URL` per environment before building the frontend image
  - If backend auth is enabled, set `NEXT_PUBLIC_API_KEY` to match deployment key before frontend image build

## Containerized Deployment

Run both services via Docker Compose:

```bash
cd deploy
copy .env.example .env
# Edit .env and replace CHANGE_ME secrets before running.
docker compose up --build
```

Compose file: `deploy/docker-compose.yml`

This compose stack includes Redis + backend worker for durable queued jobs.
When `NEXT_PUBLIC_*` values change, rebuild the frontend image (`docker compose up --build`) so the client bundle picks up the new values.

## Kubernetes Baseline Manifest

Baseline manifest with probes and resource limits:

```bash
kubectl apply -f deploy/k8s/magic-play-place.yaml
```

Apply worker autoscaling policy (requires metrics-server):

```bash
kubectl apply -f deploy/k8s/backend-worker-hpa.yaml
```

## Model-Loop Promotion Status

- `/generate` supports promoted `model_loop` mode when Gate 1 validation, Gate 2 pilot, and Gate 3 sign-off references are all configured.
- Reports:
  - `docs/reports/generate_model_loop_gate1_baseline.md`
  - `docs/reports/generate_model_loop_gate2_pilot.md`
  - `docs/reports/generate_model_loop_gate3_signoff.md`

## Research Governance

Review and enforce non-clinical/evidence policy before external release:

- `docs/RESEARCH_USE_AND_EVIDENCE_POLICY.md`

## CI Gates

Automated checks are defined in:

- `.github/workflows/ci.yml`
