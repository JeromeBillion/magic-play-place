# Magic Play Place Roadmap

## Product Position
Magic Play Place is a **research platform** first, with **commercializable outputs** as the product strategy.

Implications:
- Scientific validity and traceability are the primary quality gates.
- Commercial packaging, APIs, and productization are built on top of validated research workflows.
- Claims in UI/API must match evidence level at all times.

## Strategic Decisions (Locked)
1. Primary mode: research platform with commercialization-ready outcomes.
2. Demographic conditioning: roadmap-only until model-level implementation is real.
3. Architecture: one vehicle, one codebase. Merge `tribev2-main` into this project and remove duplicate external folder.

## Current State (2026-04-18)
- Frontend lab UI is integrated and deployable.
- Backend `/predict` supports `mock` and `tribe` inference modes.
- Backend `/generate` defaults to simulation mode and supports promoted `model_loop` mode when validation + sign-off gates are configured.
- TRIBE engine is merged inside this repository under `engine/tribev2`.
- Upload artifact lifecycle controls are active (TTL cleanup + optional delete-after-inference).
- Media validation now checks extension, MIME, and binary signature before inference.
- Frontend now surfaces backend health, inference mode, and actionable diagnostics.
- Backend now supports optional API-key protection and route-scoped rate limiting for deploy hardening.
- Request tracing is active via `X-Request-ID` response headers and request-scoped logs.
- Backend supports queued async execution (`/predict/jobs`, `/generate/jobs`) with pollable job status (`/jobs/{job_id}`).
- Async execution now supports durable broker-backed mode via Redis (`QUEUE_BACKEND=redis`) with external worker process.
- Async jobs now include retry budgets, dead-letter capture (`GET /jobs/dead-letter`), and manual replay (`POST /jobs/{job_id}/retry`).
- Deployment manifests now exist for Docker Compose and Kubernetes with probes + resource limits.
- Kubernetes worker autoscaling policy is now defined via HPA (`deploy/k8s/backend-worker-hpa.yaml`).
- Non-clinical evidence policy is documented in `docs/RESEARCH_USE_AND_EVIDENCE_POLICY.md`.
- `/generate` model-loop validation plan is documented in `docs/GENERATE_MODEL_LOOP_VALIDATION_PLAN.md`.
- `/generate` now supports validation + sign-off gated `model_loop` mode (`GENERATE_MODE=model_loop`) with explicit report references.
- Offline Gate 1 replay validation harness and baseline report are now in repo (`backend/scripts/run_generate_model_loop_validation.py`, `docs/reports/generate_model_loop_gate1_baseline.md`).
- Gate 2 prospective pilot harness and report are now in repo (`backend/scripts/run_generate_model_loop_pilot.py`, `docs/reports/generate_model_loop_gate2_pilot.md`).
- Gate 3 promotion sign-off generator and report are now in repo (`backend/scripts/run_generate_model_loop_gate3_signoff.py`, `docs/reports/generate_model_loop_gate3_signoff.md`).
- TRIBE import path no longer relies on runtime `sys.path` mutation (`tribev2` package install path is required).
- Prometheus metrics export is active at `GET /metrics` for queue depth, retries/dead-letter counts, and runtime histograms.
- OpenTelemetry export wiring is available via `OTEL_ENABLED=true` and OTLP endpoint configuration.
- CI workflow gates now validate backend tests, frontend lint/build, and Docker image builds.
- **Full-stack code review completed 2026-04-18. Findings F8–F23 documented below.**

## Gap-to-Fix Plan (Findings 1-7) — Previous Cycle

### F1. Scientific interpretation layer is not evidence-grounded yet (High) - Completed
Fix plan:
- Replace modality-only canned interpretation with data-driven summaries from prediction outputs.
- Add explicit evidence tags in responses: `observed`, `inferred`, `hypothesis`.
- Add scientific disclaimer field in API response metadata.
Exit criteria:
- `insights` text is generated from measured prediction statistics and documented heuristics.

### F2. Therapeutics loop is simulated (High) - Completed
Fix plan:
- Keep `/generate` clearly marked as simulation until real optimization loop exists.
- Add `mode` metadata to `/generate` responses and frontend labels.
- Implement Phase C prototype loop: target state -> candidate generation -> scoring over model output.
Exit criteria:
- No UI or API copy implies real therapeutic synthesis unless actual loop is active.

### F3. Real inference packaging is brittle (High) - Completed
Fix plan:
- Merge `tribev2-main/tribev2-main` into this repo as an internal engine module.
- Remove runtime `sys.path` mutation dependency after merge.
- Add pinned install path and repeatable runtime setup for local and deploy environments.
Exit criteria:
- Backend can run `INFERENCE_MODE=tribe` from a clean checkout with one documented install flow.

### F4. Data lifecycle and retention policy missing (Medium) - Completed
Fix plan:
- Add upload retention policy config (`UPLOAD_TTL_HOURS`, startup/periodic cleanup).
- Add optional delete-after-inference mode for sensitive workflows.
- Document storage policy and privacy handling in deployment docs.
Exit criteria:
- Upload and generated prompt artifacts are controlled by explicit lifecycle rules.

### F5. Media validation relies on extension only (Medium) - Completed
Fix plan:
- Add MIME/content sniffing and basic decode validation before inference.
- Add clear errors for mismatched or corrupted files.
- Log validation failures with request IDs for triage.
Exit criteria:
- Backend rejects renamed or invalid media before expensive pipeline steps.

### F6. Deterministic API tests are missing (Medium) - Completed
Fix plan:
- Add backend test suite for `/health`, `/predict` (mock/tribe-fallback), `/generate`.
- Add fixture-based tests for validation errors and boundary values.
- Add CI test command as roadmap gate for all releases.
Exit criteria:
- Tests run in CI and protect core contracts from regression.

### F7. Frontend error observability is weak (Low) - Completed
Fix plan:
- Parse backend error payloads and display actionable messages.
- Surface inference mode and backend status in UI diagnostics panel.
- Add user-facing guidance for common misconfigurations.
Exit criteria:
- Frontend shows precise, actionable failure reasons.

---

## Gap-to-Fix Plan (Findings 8-23) — Code Review Cycle

### F8. Health endpoint leaks operational secrets (Critical — Security)
The unauthenticated `/health` endpoint returns infrastructure topology, OTEL endpoint URLs, rate-limit parameters, queue depth, API-key requirement flag, and full model error strings. An adversary can fingerprint the deployment, learn if auth is enabled, and calibrate rate-limit evasion without any credentials.
Fix plan:
- Split `/health` into a public liveness probe returning `{"status": "ok"}` only.
- Create `/admin/status` (or similar) gated behind `enforce_api_key()` for the full diagnostics payload.
- Ensure Kubernetes readiness/liveness probes target the minimal `/health` endpoint.
- Update docker-compose healthcheck commands accordingly.
Exit criteria:
- Unauthenticated callers see only liveness status.
- All infrastructure details require valid API-key authentication.
- K8s and Docker probes still function correctly.

### F9. Backend `main.py` is a 2,280-line monolith (Critical — Maintainability)
Configuration, Pydantic models, rate limiting, file upload handling, media signature validation, Prometheus metrics infrastructure, job queue state machine (in-memory + Redis dual-backend), dead-letter queue, TribeModel integration, and all route handlers are in a single 84KB file. This blocks testability, contributor velocity, and safe refactoring.
Fix plan:
- Extract into domain modules: `config.py`, `models.py`, `auth.py`, `media.py`, `metrics.py`.
- Create `jobs/` package: `queue.py`, `worker.py`, `dead_letter.py`.
- Create `inference/` package: `mock.py`, `tribe.py`, `pipeline.py`.
- Create `routes/` package: `health.py`, `predict.py`, `generate.py`, `jobs.py`, `metrics.py`.
- Reduce `main.py` to app factory + lifespan wiring only.
- Move all route handlers into the `routes/` package using FastAPI `APIRouter`.
Exit criteria:
- No source file exceeds 400 lines.
- Each module has a single domain responsibility.
- All existing tests pass without modification (import paths may change).

### F10. Thread-safety gaps in global mutable state (Critical — Reliability)
- `_tribe_model_error` is read without lock in `get_tribe_model_status()` but written under `_tribe_lock`.
- `_rate_limit_buckets` grows unbounded — old bucket keys for stale client IPs are never evicted, leaking memory over time.
- `_job_records` in-memory dict has TOCTOU races between `get_job_record()` and `persist_job_record()` in `run_async_job()` because each acquires and releases the lock separately.
Fix plan:
- Guard all reads of `_tribe_model_error` under `_tribe_lock`, or make it a thread-safe read via `threading.Event` / immutable snapshot.
- Add periodic eviction of stale `_rate_limit_buckets` entries (e.g., evict keys whose newest timestamp is older than the window).
- Refactor in-memory job record access to use a single lock scope for read-modify-write operations, or switch to `asyncio.Lock` in async context.
Exit criteria:
- No global mutable state is accessed outside its protecting lock.
- Rate-limit bucket count is bounded regardless of client cardinality.
- Job record updates are atomic.

### F11. Frontend is a 932-line God component (High — Maintainability)
`MagicPlayPlace.tsx` contains all three mode panels, result display, session info, backend diagnostics, form handling, 20+ `useState` hooks, API call logic, and inline `<style>` blocks in a single component. This blocks unit testing, increases cognitive load, and prevents contributor specialization.
Fix plan:
- Extract mode-specific panels: `DiscoveryPanel.tsx`, `TherapeuticsPanel.tsx`, `ConditioningPanel.tsx`.
- Extract output panels: `ResultsPanel.tsx`, `DiagnosticsPanel.tsx`, `SessionInfo.tsx`.
- Extract custom hooks: `useBackendHealth.ts`, `usePrediction.ts`, `useGeneration.ts`.
- Extract API client module: `api.ts` (encapsulates `fetch`, headers, error parsing).
- Move inline `<style>` blocks into `globals.css` or a component-scoped CSS module.
Exit criteria:
- No component file exceeds 250 lines.
- Each panel is independently testable.
- API logic is decoupled from UI rendering.

### F12. BrainCanvas.tsx is dead code with live dependencies (High — Bundle Size)
`BrainCanvas.tsx` is a fully implemented Three.js/React-Three-Fiber brain mesh visualizer that is never imported or rendered. The dependencies `three`, `@react-three/fiber`, `@react-three/drei`, and `@types/three` add ~1MB+ to the production bundle for zero user value.
Fix plan:
- Integrate `BrainCanvas` as the center-panel visualization (replacing the CSS-only octagon animation), OR
- Remove `BrainCanvas.tsx` and uninstall `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` from `package.json`.
- If retaining, move `@types/three` from `dependencies` to `devDependencies`.
Exit criteria:
- No dead component files exist in the codebase.
- No unused npm packages remain in `package.json`.
- If integrated, the 3D visualizer responds to processing state and shows brain activity.

### F13. `conversion.py` silently fails and uses deprecated API (High — Accuracy)
When `moviepy` is not installed, `convert_image_to_video()` silently returns the original image path instead of raising an error. The caller then tries to validate it as a video and produces a confusing error. Additionally, `import moviepy.editor as mp` is deprecated in moviepy 2.x (which `requirements.txt` pins).
Fix plan:
- Raise `RuntimeError` when moviepy is not installed, with a clear installation instruction.
- Replace `import moviepy.editor as mp` with `from moviepy import ImageClip`.
- Replace `print()` with `logging.getLogger()` calls.
- Add a unit test for the conversion path with moviepy mocked as unavailable.
Exit criteria:
- A missing moviepy produces a clear, actionable error at conversion time.
- No deprecated moviepy import paths remain.
- Conversion failures are logged, not printed.

### F14. No frontend test coverage (High — Quality)
Zero test files exist for the frontend. CI only runs lint and build. There are no unit tests, component tests, integration tests, or accessibility checks.
Fix plan:
- Set up Jest + React Testing Library (or Vitest) for the frontend.
- Add component tests for mode switching, form input handling, and result rendering.
- Add API client tests with mocked `fetch` for success, error, and timeout paths.
- Add accessibility audit (e.g., `jest-axe`) to catch missing `aria-*` attributes.
- Add frontend test step to `ci.yml`.
Exit criteria:
- Frontend test suite runs in CI and protects core interaction paths from regression.
- All interactive elements have appropriate accessibility attributes.

### F15. Docker Compose uses `.env.example` as production config (High — Security)
`docker-compose.yml` references `../backend/.env.example` as the `env_file`. This file contains `REQUIRE_API_KEY=false`, permissive rate limits, and empty secrets. Anyone running `docker compose up` gets an unauthenticated API.
Fix plan:
- Create `deploy/.env.production.example` with secure defaults (`REQUIRE_API_KEY=true`, `API_KEY=CHANGE_ME`, etc.).
- Update `docker-compose.yml` to reference a `.env` file that must be explicitly created.
- Add a pre-flight check or startup warning if API_KEY is the placeholder value.
- Document the required env setup in `DEPLOYMENT.md`.
Exit criteria:
- `docker compose up` fails or warns clearly if secrets are not configured.
- No example file is used as a production config source.

### F16. `NEXT_PUBLIC_*` env vars don't work at Docker runtime (Medium — Deployment)
`NEXT_PUBLIC_API_BASE_URL` is set as a runtime env var in `docker-compose.yml` and K8s manifests. However, Next.js bakes `NEXT_PUBLIC_*` variables into the client bundle at **build time**. The runtime value has no effect — the frontend will always use whatever was present during `npm run build`.
Fix plan:
- Use a runtime configuration approach: inject config via a server-rendered `<script>` tag, or use Next.js `publicRuntimeConfig`.
- Alternatively, accept build-time injection and document that the frontend image must be rebuilt per environment.
- Update `DEPLOYMENT.md` and docker-compose to match the chosen approach.
Exit criteria:
- Frontend correctly reads API base URL in all deployment environments without requiring image rebuilds, or documentation explicitly states the rebuild requirement.

### F17. `lastRequestId` state is reset immediately after being set (Medium — UX Bug)
In `MagicPlayPlace.tsx`, `setLastRequestId(responseRequestId)` is called, then `setLastRequestId('none')` is called a few lines later in the same success handler. The diagnostics panel never shows a meaningful request ID because it's always cleared.
Fix plan:
- Remove the `setLastRequestId('none')` calls from the success paths of `handleRunAlgorithm`.
- Keep the `'none'` reset only in the error path or at the start of a new run.
Exit criteria:
- The diagnostics panel displays the request ID from the most recent API call until the next call begins.

### F18. Redis dead-letter removal is non-atomic (Medium — Reliability)
`remove_dead_letter_entries_for_job()` reads the entire DLQ list, filters in Python, deletes the key, then re-pushes the filtered list. Between `DELETE` and `RPUSH`, concurrent readers see an empty DLQ.
Fix plan:
- Replace with a Redis Lua script that atomically filters and replaces the list.
- Alternatively, migrate DLQ storage to a Redis sorted set for O(1) removal by job ID.
Exit criteria:
- DLQ removal is atomic; concurrent readers never see a transiently empty queue.

### F19. `brpoplpush` is deprecated in Redis 6.2+ (Medium — Compatibility)
`claim_next_redis_job_id()` uses `brpoplpush` which was deprecated in favor of `BLMOVE`.
Fix plan:
- Replace `client.brpoplpush(src, dst, timeout)` with `client.blmove(src, dst, timeout, "RIGHT", "LEFT")`.
Exit criteria:
- No deprecated Redis commands remain.
- Worker functions correctly against Redis 7.x.

### F20. `job_id` path parameter is not validated (Medium — Security)
`/jobs/{job_id}` and `/jobs/{job_id}/retry` accept arbitrary strings. These strings are interpolated into Redis key names. Malicious input could create colliding keys or excessively long key names.
Fix plan:
- Add a path parameter validator or Pydantic constraint: `job_id` must match `^[a-f0-9]{32}$`.
- Return 400 for malformed job IDs before any backend or Redis operations.
Exit criteria:
- Only valid hex job IDs are accepted.
- Malformed IDs return a clear 400 error.

### F21. Validation scripts still use `sys.path` mutation (Medium — Consistency)
`backend/scripts/run_generate_model_loop_validation.py` (and sibling scripts) insert the backend directory into `sys.path` at runtime. The roadmap declares F3 (removing `sys.path` mutation) as completed, but the scripts still depend on it.
Fix plan:
- Make scripts runnable via `python -m backend.scripts.run_generate_model_loop_validation` from the repo root, or
- Add a proper package structure to backend with `__init__.py` files and adjust imports.
- Update CI and documentation to use the corrected invocation.
Exit criteria:
- No Python source file contains `sys.path.insert()` or `sys.path.append()`.

### F22. Kubernetes manifest hardcodes `model_loop` mode (Medium — Deployment Safety)
`deploy/k8s/magic-play-place.yaml` sets `GENERATE_MODE: "model_loop"` by default. Deploying from this manifest without understanding the validation gate system causes a startup crash because the referenced report paths may not exist in the container filesystem.
Fix plan:
- Default `GENERATE_MODE` to `simulation` in the K8s manifest.
- Add comments explaining the prerequisites for enabling `model_loop`.
- Consider mounting validation reports as a ConfigMap or documenting that they are baked into the image.
Exit criteria:
- A fresh deployment from the K8s manifest starts successfully without modification.
- `model_loop` promotion requires explicit, documented configuration changes.

### F23. Unused CSS custom properties and placeholder files (Low — Cleanup)
- `globals.css` defines `--glow-primary`, `--glow-secondary`, `.glass-panel`, and `.glow-text` that are never referenced.
- `frontend/guidelines/Guidelines.md` is a default template placeholder with no custom content.
- `frontend/CLAUDE.md` is 11 bytes (empty placeholder).
- `hackathon Submission.md` has a space in the filename that causes issues with some CI tools.
Fix plan:
- Remove unused CSS custom properties and classes, or integrate them into the component styles.
- Either populate or delete `Guidelines.md` and `CLAUDE.md`.
- Rename `hackathon Submission.md` to `hackathon-submission.md`.
Exit criteria:
- No dead CSS exists in the stylesheet.
- No placeholder-only files remain in the repo.
- All filenames are CI-safe (no spaces).

---

## User Experience Gap Plan (UX1-UX8)

### UX1. 3D Brain Visualizer is built but invisible (High)
The `BrainCanvas.tsx` Three.js component exists and renders an animated icosahedron with processing states, sparkle effects, and orbit controls. But users never see it — the center panel uses a static CSS octagon. The 3D visualizer is the flagship differentiator of this platform.
Fix plan:
- Replace the CSS octagon in the center panel with `BrainCanvas`.
- Connect `isSimulating` prop to the processing state.
- Add visual transitions between idle and active states (color shift, particle density, rotation speed).
- Add vertex count and activation intensity overlays when results are available.
Exit criteria:
- Users see a dynamic, rotating 3D brain mesh that responds to inference activity.
- Processing state is visually obvious without reading the status label.

### UX2. No onboarding or contextual help (High)
A new user lands on the interface with no explanation of what the modes do, what inputs are expected, or what the outputs mean. The lab-style UI assumes domain expertise.
Fix plan:
- Add a first-run tooltip walkthrough (or dismissible overlay) explaining Discovery, Therapeutics, and Conditioning modes.
- Add `title` / tooltip attributes on each control explaining its purpose.
- Add a contextual help icon ("?") next to key sections (Stimulus Type, Valence/Arousal, Evidence Tags) linking to inline explanations.
- Add a brief description under each mode tab when selected.
Exit criteria:
- A new user can understand what each mode does and how to use it within 30 seconds.

### UX3. No visual feedback during long operations (Medium)
The progress bar increments artificially (every 150ms by +3%) with no connection to actual backend progress. It reaches 95% and stalls until the response arrives. Users have no way to distinguish a 2-second mock call from a 30-second tribe inference.
Fix plan:
- For sync calls, show an indeterminate progress indicator instead of a fake percentage.
- For async calls (`/predict/jobs`, `/generate/jobs`), poll the job status endpoint and show real state transitions: queued → running → succeeded/failed.
- Display estimated wait times based on historical runtime metrics.
- Add a cancel button for async jobs.
Exit criteria:
- Progress indication reflects actual backend state.
- Users can distinguish between queued, running, and completed states.

### UX4. Results are displayed as raw text (Medium)
Analysis output, evidence chains, cross-modal guides, and optimization metrics are all rendered as monospace text blocks. There's no visual hierarchy, no charts, and no structured interpretation.
Fix plan:
- Render evidence chains as tagged cards (colored by `observed`/`inferred`/`hypothesis`).
- Display optimization metrics (valence, arousal, distance, improvement) as a mini dashboard with gauges or sparklines.
- Show scientific disclaimer in a distinct, visually separated callout box.
- Display prediction shape information (timesteps × vertices) in a structured summary card.
Exit criteria:
- Results are scannable and visually structured.
- Evidence confidence level is immediately apparent from color/icon coding.

### UX5. No result history or comparison (Medium)
Each run overwrites the previous results. Users cannot compare runs, track changes across parameter tweaks, or export results.
Fix plan:
- Maintain a session-local result history (last N runs) in component state or localStorage.
- Add a result timeline or carousel to compare runs side-by-side.
- Add an "Export Results (JSON)" button for each run.
- Show parameter diff between consecutive runs.
Exit criteria:
- Users can review and compare at least the last 5 runs within a session.
- Results can be exported for external analysis.

### UX6. Conditioning mode has no backend integration (Medium — Accuracy Gap)
The Conditioning panel updates local state (profile + age cohort) but runs no backend call. It uses `setTimeout(resolve, 900)` to simulate work. The profile and age values are sent to `/predict` and `/generate`, but there's no feedback about whether the conditioning actually changed the model's behavior.
Fix plan:
- Clearly label Conditioning as "Profile Configuration" rather than implying an active process.
- Remove the fake processing delay and progress bar for conditioning — make it instant.
- Add visual confirmation that the profile is active (persistent badge in the header).
- Add a note explaining that profile/age are passed to inference calls for demographic conditioning.
Exit criteria:
- Users understand that conditioning sets parameters, it doesn't run a pipeline.
- Active profile is always visible in the UI.

### UX7. No responsive mobile layout (Low)
The three-column layout uses `xl:grid-cols-[320px_1fr_320px]` and collapses to a single column on mobile. On mobile, the diagnostics panel (which is the least important for end users) occupies the most vertical space, pushing the action button and results far down the page.
Fix plan:
- Reorder mobile layout: control panel → action → results → diagnostics (collapsed by default).
- Make the diagnostics panel collapsible/expandable on all screen sizes.
- Ensure touch targets are adequately sized (48px minimum).
Exit criteria:
- The platform is usable on a tablet without horizontal scrolling.
- The most important controls are above the fold on mobile.

### UX8. No accessibility attributes (Low)
Interactive elements (mode buttons, stimulus type selectors, file upload trigger, sliders, run button) have no `aria-label`, `aria-describedby`, or `role` attributes. Sliders lack visible track fill. The color scheme relies on emerald-500 as the sole active indicator with no secondary visual cue.
Fix plan:
- Add `aria-label` to all buttons and interactive elements.
- Add `role="tablist"` and `role="tab"` to the mode navigation.
- Add visible slider fill track for valence/arousal controls.
- Ensure all states have a non-color secondary indicator (border weight, icon, or text change).
- Run an axe-core audit and fix all violations.
Exit criteria:
- All interactive elements are screen-reader accessible.
- No WCAG 2.1 Level AA violations in an automated audit.

---

## Accuracy & Robustness Gap Plan (AR1-AR7)

### AR1. Model-loop search is deterministic simulation, not model-in-the-loop (High)
`run_model_loop_search()` uses a fixed gradient-descent-like algorithm with no randomness and no actual model inference. It always converges because it uses a predictable learning rate schedule. While the validation gates exist, the API response uses `optimization_metrics` language that could mislead research consumers into thinking a real model evaluation loop ran.
Fix plan:
- Add a `loop_type` field to `GenerateResponse`: `"simulation"` or `"model_evaluated"`.
- When in simulation mode, label `optimization_metrics` as `simulated_optimization_metrics`.
- Add a response-level disclaimer: `"This optimization was simulated via gradient approximation. No model was queried during generation."`.
- Document in `RESEARCH_USE_AND_EVIDENCE_POLICY.md` that model-loop mode without real model scoring is still a convergence simulation.
Exit criteria:
- No API consumer can mistake a simulated optimization for a model-evaluated one.
- Evidence tags and disclaimers are machine-parsable for downstream tooling.

### AR2. Mock inference returns hardcoded constants (High)
`run_mock_inference()` returns `timesteps=1, vertices=20484` and a dummy `roi_data` dict regardless of input. The `llm_analyst.analyze_fmri_roi()` then interprets these fixed values as if they were real measurements. Research consumers may treat mock-mode outputs as meaningful data.
Fix plan:
- Add `mock_data: true` field to `PredictResponse` when `INFERENCE_MODE=mock`.
- Generate varied mock outputs based on input characteristics (e.g., text length → timesteps, stimulus type → different ROI patterns) so integration tests exercise diverse code paths.
- Add a prominent mock-mode banner in the frontend when `lastInferenceMode === 'mock'`.
Exit criteria:
- Mock-mode outputs are explicitly flagged as synthetic in both API and UI.
- Mock outputs vary by input to exercise downstream interpretation paths.

### AR3. Evidence tag validation is loose (Medium)
The evidence tags returned from `llm_analyst.py` are validated in `execute_predict_pipeline` by filtering against a set, but the fallback is `["inferred", "hypothesis"]`. If the analyst returns garbage, the pipeline silently downgrades rather than raising an integrity error.
Fix plan:
- Validate evidence tags in `analyze_fmri_roi()` itself, raising `ValueError` for invalid tags.
- Make the tag vocabulary an `Enum` shared between `llm_analyst.py` and the response models.
- Add a test case verifying that analyst output always contains valid tags.
Exit criteria:
- Evidence tag vocabulary is enforced at source and validated by type system.
- No silent downgrade of evidence quality is possible.

### AR4. Cross-modal guide is static and not input-dependent (Medium)
`_cross_modal_guide()` in `llm_analyst.py` returns hardcoded strings based only on stimulus type, with no consideration of the actual prediction metrics, activation patterns, or profile/age parameters. The guide reads as a confident recommendation but has no empirical basis.
Fix plan:
- Qualify guide statements with observed activation patterns (e.g., "Given high-spread activation [std={X}], consider...").
- Add a confidence qualifier: "This guide is a heuristic hypothesis. Validate via A/B prediction comparison."
- Make the guide output depend on at least mean/std activation metrics when available.
Exit criteria:
- Cross-modal guide text references measured data when available.
- Guide confidence level is explicit and appropriately hedged.

### AR5. No prediction output validation or sanity checking (Medium)
When running real tribe inference, `run_tribe_inference()` checks that `preds.ndim == 2` but performs no range validation, NaN checking, or statistical sanity checking on the prediction tensor. Corrupted or degenerate outputs would propagate through the analysis pipeline and produce misleading insights.
Fix plan:
- Add NaN/Inf check on prediction tensor before computing summary statistics.
- Add range validation: warn if activation values are outside expected bounds.
- Add a degenerate-output check: warn if `std_activation ≈ 0` (constant prediction).
- Tag the evidence as `"low_confidence"` when sanity checks flag anomalies.
Exit criteria:
- Degenerate or corrupted predictions are detected and flagged before interpretation.
- No NaN or Inf value can reach the API response.

### AR6. Histogram overflow bucket is not counted (Low)
`_observe_histogram()` increments `count` and `sum` for all values, but values exceeding the largest bucket bound (30s) are never placed in any bucket. While the `+Inf` bucket uses `count` directly (so Prometheus math is technically correct), inter-bucket deltas are inaccurate for tail latencies.
Fix plan:
- Add an implicit `+Inf` overflow counter, or ensure the last bucket catches all remaining values.
Exit criteria:
- Histogram bucket counts sum to `count` when including the overflow bucket.

### AR7. Therapeutics modality `video` is missing from frontend (Low)
The backend `TargetStateRequest` accepts `modality` values `["audio", "text", "image", "video"]`, but the frontend Therapeutics panel only offers `["audio", "text", "image"]` — `video` is not selectable.
Fix plan:
- Add `"video"` to the modality selector in the Therapeutics panel.
- Alternatively, if video generation is not supported, restrict the backend validator to match the frontend.
Exit criteria:
- Frontend and backend modality options are in sync.

---

## One-Vehicle Merge Plan (Engine Consolidation)
Goal: integrate TRIBE engine into this repository and delete duplicate sibling folder.

### Merge Steps
1. Create internal engine path, e.g. `engine/tribev2/`.
2. Copy TRIBE source, preserve history strategy (subtree or documented import commit).
3. Update backend imports/config to use internal engine path/package.
4. Update install docs and requirements to internal source.
5. Remove dependency on external `..\..\tribev2-main\tribev2-main` path.
6. Delete or archive the duplicate external folder after verification.

### Merge Exit Criteria
- Single repo contains frontend, backend, and TRIBE engine.
- `INFERENCE_MODE=tribe` works without external sibling directories.
- All docs and env examples reference only internal paths.

---

## Phase Plan

### Phase A (Completed): Deploy Baseline
- [x] Frontend replacement and deploy-ready UI
- [x] Backend hardening basics (validation/CORS/upload limits)
- [x] Build and lint checks passing

### Phase B (Completed): Real `/predict` Integration
- [x] Lazy-loaded TribeModel path
- [x] Multimodal mapping into `get_events_dataframe(...)`
- [x] Mock fallback mode retained

### Phase C (Completed): Scientific Reliability + Truthful UX
- [x] Implement F1 evidence-grounded interpretation
- [x] Implement F2 truthful therapeutics labeling + loop scaffold
- [x] Implement F6 deterministic API tests
- [x] Add explicit non-clinical and evidence-level documentation

### Phase D (Completed): Platform Integrity + Consolidation
- [x] Implement F3 one-vehicle merge and packaging stability
- [x] Implement F4 artifact lifecycle controls
- [x] Implement F5 robust media validation
- [x] Implement F7 frontend observability improvements

### Phase E (Completed): Production Operations
- [x] Auth and rate limiting
- [x] Worker queue for heavy inference
- [x] Dead-letter handling + manual replay for failed async jobs
- [x] Worker autoscaling policy for distributed queue processing
- [x] Metrics export for runtime and queue observability (`/metrics`)
- [x] OpenTelemetry trace export wiring
- [x] Structured logging and traceability
- [x] Deployment manifests and resource guardrails

### Phase F: Security & Structural Integrity
- [x] F8 — Split `/health` into public probe + authenticated admin status
- [x] F9 — Extract `main.py` monolith into domain modules
- [x] F10 — Fix thread-safety gaps (lock coverage, rate-limit eviction, job TOCTOU)
- [x] F13 — Fix `conversion.py` silent failure + deprecated moviepy import
- [x] F15 — Replace `.env.example` usage in Docker Compose with secure defaults
- [x] F20 — Add `job_id` format validation
- [x] F21 — Remove `sys.path` mutation from validation scripts

### Phase G: User Experience & Accessibility
- [ ] UX1 — Integrate 3D BrainCanvas visualizer into center panel
- [ ] F11 — Extract frontend God component into sub-components + hooks
- [x] F12 — Resolve BrainCanvas dead code (integrate or remove with dependencies)
- [x] F17 — Fix `lastRequestId` double-reset bug
- [ ] UX2 — Add onboarding tooltips and contextual help
- [ ] UX3 — Replace fake progress bar with real backend state polling
- [ ] UX4 — Render results as structured cards with evidence color coding
- [ ] UX5 — Add session result history and export
- [ ] UX6 — Clarify Conditioning mode as profile configuration (no fake processing)
- [ ] UX7 — Improve mobile responsive layout and panel ordering
- [ ] UX8 — Add ARIA attributes and pass WCAG 2.1 AA audit

### Phase H: Accuracy, Robustness & Confidence
- [ ] AR1 — Add explicit `loop_type` and simulation disclaimers to optimization response
- [ ] AR2 — Flag mock outputs as synthetic + add varied mock generation
- [ ] AR3 — Enforce evidence tag vocabulary via shared Enum
- [ ] AR4 — Make cross-modal guide data-dependent and confidence-qualified
- [ ] AR5 — Add NaN/Inf/degenerate prediction output validation
- [ ] AR6 — Fix histogram overflow bucket counting
- [ ] AR7 — Sync frontend/backend modality options for Therapeutics
- [ ] F14 — Add frontend test suite (component, API client, accessibility)
- [x] F16 — Fix `NEXT_PUBLIC_*` build-time vs runtime env var issue
- [x] F18 — Atomicize Redis dead-letter removal
- [x] F19 — Replace deprecated `brpoplpush` with `blmove`
- [x] F22 — Default K8s manifest to `simulation` mode
- [x] F23 — Clean up dead CSS, placeholder files, filename spaces

---

## Definition of Ready for External Research Beta
- Claims are aligned to evidence level in API/UI.
- `/predict` real inference is reproducible from clean setup.
- `/generate` is explicitly simulated unless model loop is active.
- Upload lifecycle and validation are enforced.
- Deterministic tests protect core contracts.
- Repo is consolidated into one vehicle architecture.
- Async queue is deployable in durable broker-backed mode (Redis + worker).
- **No unauthenticated endpoint leaks infrastructure details (F8).**
- **Mock-mode outputs are explicitly flagged as synthetic in API and UI (AR2).**
- **Evidence tag vocabulary is enforced and consistent (AR3).**
- **Users can understand the platform within 30 seconds of landing (UX2).**
- **Progress indication reflects actual backend state (UX3).**
- **No silent failures in media conversion or inference paths (F13, AR5).**
- **Frontend has automated test coverage in CI (F14).**

## Immediate Execution Queue
1. [x] Add distributed worker autoscaling policy and dead-letter handling for failed async jobs.
2. [x] Complete Gate 2 prospective pilot and Gate 3 sign-off to finalize `/generate` promotion.
3. [x] Add observability metrics export (Prometheus `/metrics`) for async queue and inference runtimes.
4. [x] **F8** — Split `/health` endpoint (Critical security — 1h).
5. [x] **F15** — Fix Docker Compose `.env.example` usage (Critical security — 15m).
6. [x] **F17** — Fix `lastRequestId` double-reset (Quick UX fix — 10m).
7. [x] **F13** — Fix `conversion.py` silent failure + deprecated import (High accuracy — 30m).
8. [x] **F20** — Add `job_id` format validation (Medium security — 15m).
9. [x] **F9** — Extract `main.py` monolith into modules (Major refactor — 4-8h).
10. [x] **F10** — Fix thread-safety gaps (Reliability — 2-4h).
11. [x] **UX1 + F12** — Integrate or remove BrainCanvas (UX flagship — 2-4h).
12. [ ] **AR1 + AR2** — Add simulation/mock output flagging (Accuracy — 2h).
13. [ ] **F11** — Extract frontend God component (Maintainability — 3-4h).
14. [ ] **UX2 + UX4** — Onboarding + structured result rendering (UX quality — 4-6h).
15. [ ] **F14** — Add frontend test suite (Quality — 4-8h).
16. [ ] **AR3 + AR4 + AR5** — Evidence robustness + prediction validation (Accuracy — 3-4h).
