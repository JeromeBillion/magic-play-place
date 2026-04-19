# Research Use and Evidence Policy

## Scope
This project is a research platform for neuroscience workflow prototyping and commercialization discovery.
It is not a medical device, diagnostic service, or clinical intervention platform.

## Non-Clinical Boundary
- Outputs from `/predict`, `/generate`, and async job endpoints are research-use only.
- No API/UI output may be framed as treatment advice or patient-specific guidance.
- Any therapeutic framing must remain simulation-only unless a validated model-loop is explicitly enabled and documented.

## Evidence Taxonomy
The platform uses three evidence tags:

- `observed`: direct measured values from runtime outputs (for example tensor summary statistics, segment counts, timings).
- `inferred`: deterministic interpretation derived from observed metrics and documented heuristics.
- `hypothesis`: speculative research direction, unvalidated mechanism, or proposed next experiment.

## Claim Rules
- Allowed in product copy:
  - "simulated", "research-use", "prototype", "hypothesis-generating", "model output".
- Disallowed in product copy without formal clinical validation:
  - "diagnoses", "treats", "prevents", "clinically proven", "patient-safe", "medical recommendation".
- Every user-visible result should include:
  - an evidence tag set,
  - a scientific disclaimer,
  - a traceable request identifier.

## Commercialization Guardrails
- Commercial outputs must be positioned as:
  - research tooling,
  - content generation simulation,
  - operational analytics for study design.
- Clinical positioning requires separate regulatory, ethics, and validation pathways outside this repository.

## Release Checklist
- `/health` reflects active runtime mode and safeguards.
- `/predict` and `/generate` return explicit disclaimers.
- Async queue behavior is deterministic and observable via `GET /jobs/{job_id}`.
- API-key auth and rate limiting are configured for external beta deployments.
- Documentation and UI copy remain aligned with the non-clinical boundary.
