# Generate Model-Loop Validation Plan

## Objective
Promote `/generate` from simulation mode to `model_loop` only after reproducible evidence shows:
- stable optimization behavior,
- measurable target-state convergence,
- and non-clinical safety guardrails are respected.

## Scope
- In scope: research-grade validation for algorithmic generation quality and operational reliability.
- Out of scope: clinical efficacy claims, diagnosis, or treatment claims.

## Stage Gates

### Gate 0: Instrumented Simulation Baseline
- Keep `/generate` in `simulation` mode by default.
- Log request IDs, iteration counts, and output payload metadata.
- Define baseline latency/error budgets for queued and sync generation routes.

### Gate 1: Offline Replay Validation
- Build fixed replay dataset of target states across modalities and demographic profiles.
- Run candidate generation loop offline and score convergence against deterministic objective functions.
- Acceptance:
  - Reproducibility: repeated runs on same seed/profile stay within tolerance.
  - Convergence: median score improves over initial candidates by predefined threshold.
  - Reliability: no uncaught errors across validation corpus.

### Gate 2: Prospective Research Pilot
- Run model-loop behind explicit research feature flag.
- Capture operator-reviewed outputs, failure modes, and rollback conditions.
- Acceptance:
  - Error rate and latency stay within Gate 1 production budgets.
  - No policy violations against `docs/RESEARCH_USE_AND_EVIDENCE_POLICY.md`.
  - Dead-letter and retry telemetry remain stable under pilot load.

### Gate 3: Promotion Readiness
- Publish validation report with methods, metrics, and limitations.
- Review commercialization fit as research tooling output, not therapeutic intervention.
- Promote `/generate` response `generation_mode` to `model_loop` only after sign-off.

## Current Gate Status (2026-04-18)
- Gate 1: PASS (`docs/reports/generate_model_loop_gate1_baseline.md`)
- Gate 2: PASS (`docs/reports/generate_model_loop_gate2_pilot.md`)
- Gate 3: APPROVED (`docs/reports/generate_model_loop_gate3_signoff.md`)

Promotion note:
- Model-loop promotion is approved for non-clinical research tooling outputs.
- Runtime default may remain `simulation` per deployment policy.

## Required Artifacts Before Promotion
- Validation dataset manifest and replay protocol.
- Metric definitions and thresholds (convergence, stability, runtime reliability).
- Validation report with reproducibility evidence and failure analysis.
- Updated API/UI copy confirming non-clinical positioning after promotion.

Current repository artifacts:
- Dataset manifest: `backend/validation/generate_model_loop_dataset.json`
- Runner: `backend/scripts/run_generate_model_loop_validation.py`
- Latest baseline report targets:
  - `docs/reports/generate_model_loop_gate1_baseline.json`
  - `docs/reports/generate_model_loop_gate1_baseline.md`
- Gate 2 pilot manifest: `backend/validation/generate_model_loop_pilot_manifest.json`
- Gate 2 pilot runner: `backend/scripts/run_generate_model_loop_pilot.py`
- Gate 2 pilot report targets:
  - `docs/reports/generate_model_loop_gate2_pilot.json`
  - `docs/reports/generate_model_loop_gate2_pilot.md`
- Gate 3 sign-off generator: `backend/scripts/run_generate_model_loop_gate3_signoff.py`
- Gate 3 sign-off report targets:
  - `docs/reports/generate_model_loop_gate3_signoff.json`
  - `docs/reports/generate_model_loop_gate3_signoff.md`

## Deployment Rule
- Default runtime remains `simulation`.
- Runtime gate variables:
  - `GENERATE_MODE=model_loop`
  - `GENERATE_MODEL_LOOP_VALIDATED=true`
  - `GENERATE_MODEL_LOOP_VALIDATION_REPORT=<report reference>`
  - `GENERATE_MODEL_LOOP_SIGNED_OFF=true`
  - `GENERATE_MODEL_LOOP_SIGNOFF_REPORT=<sign-off reference>`
- Any `model_loop` enablement must reference completed Gate 1 and Gate 2 reports plus explicit Gate 3 sign-off.
