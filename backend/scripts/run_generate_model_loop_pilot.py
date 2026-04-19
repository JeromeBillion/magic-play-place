from __future__ import annotations

import argparse
import importlib
import json
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from itertools import product
from pathlib import Path

from fastapi.testclient import TestClient


def compute_percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    if percentile <= 0:
        return float(sorted_values[0])
    if percentile >= 100:
        return float(sorted_values[-1])
    position = int(math.ceil((percentile / 100.0) * len(sorted_values))) - 1
    position = min(max(position, 0), len(sorted_values) - 1)
    return float(sorted_values[position])


def build_cases(manifest: dict, limit: int) -> list[dict]:
    modalities = manifest["modalities"]
    profiles = manifest["profiles"]
    ages = manifest["ages"]
    targets = manifest["targets"]
    cases: list[dict] = []
    for index, (modality, profile, age) in enumerate(product(modalities, profiles, ages)):
        if len(cases) >= limit:
            break
        target = targets[index % len(targets)]
        cases.append(
            {
                "case_id": f"case_{index + 1:03d}",
                "modality": modality,
                "profile": profile,
                "age": age,
                "valence": int(target["valence"]),
                "arousal": int(target["arousal"]),
            }
        )
    return cases


def parse_prometheus_labels(raw: str) -> dict[str, str]:
    labels: dict[str, str] = {}
    if not raw.strip():
        return labels
    for token in raw.split(","):
        part = token.strip()
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        labels[key.strip()] = value.strip().strip('"')
    return labels


def extract_prometheus_metric(
    metrics_text: str,
    metric_name: str,
    required_labels: dict[str, str] | None = None,
) -> float:
    required = required_labels or {}
    pattern = re.compile(
        rf"^{re.escape(metric_name)}(?:\{{([^}}]*)\}})?\s+([+-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$"
    )
    for line in metrics_text.splitlines():
        match = pattern.match(line.strip())
        if not match:
            continue
        labels = parse_prometheus_labels(match.group(1) or "")
        if any(labels.get(k) != v for k, v in required.items()):
            continue
        return float(match.group(2))
    return 0.0


def check_policy(payload: dict, expected_validation_ref: str, expected_signoff_ref: str) -> list[str]:
    violations: list[str] = []
    if payload.get("generation_mode") != "model_loop":
        violations.append("generation_mode != model_loop")

    disclaimer = str(payload.get("scientific_disclaimer", ""))
    if "Research-use model-loop output only" not in disclaimer:
        violations.append("missing research-use disclaimer text")
    if "non-clinical" not in disclaimer.lower():
        violations.append("missing non-clinical disclaimer text")

    if payload.get("validation_reference") != expected_validation_ref:
        violations.append("validation_reference mismatch")
    if payload.get("signoff_reference") != expected_signoff_ref:
        violations.append("signoff_reference mismatch")

    optimization_metrics = payload.get("optimization_metrics")
    if not isinstance(optimization_metrics, dict):
        violations.append("optimization_metrics missing")
    else:
        baseline_distance = float(optimization_metrics.get("baseline_distance", 0.0))
        final_distance = float(optimization_metrics.get("final_distance", 0.0))
        improvement = float(optimization_metrics.get("improvement", 0.0))
        if improvement < 0:
            violations.append("negative improvement")
        if final_distance > baseline_distance:
            violations.append("final_distance exceeds baseline_distance")
    return violations


def load_backend_main(
    repo_root: Path,
    upload_dir: Path,
    cache_dir: Path,
    validation_ref: str,
    signoff_ref: str,
):
    backend_dir = repo_root / "backend"
    os.environ["INFERENCE_MODE"] = "mock"
    os.environ["UPLOAD_DIR"] = str(upload_dir)
    os.environ["TRIBEV2_CACHE_FOLDER"] = str(cache_dir)
    os.environ["RATE_LIMIT_ENABLED"] = "false"
    os.environ["METRICS_ENABLED"] = "true"
    os.environ["METRICS_REQUIRE_API_KEY"] = "false"
    os.environ["ASYNC_JOB_QUEUE_ENABLED"] = "true"
    os.environ["QUEUE_BACKEND"] = "inmemory"
    os.environ["JOB_WORKER_CONCURRENCY"] = "2"
    os.environ["JOB_QUEUE_MAX_PENDING"] = "200"
    os.environ["JOB_MAX_RETRIES"] = "1"
    os.environ["GENERATE_MODE"] = "model_loop"
    os.environ["GENERATE_MODEL_LOOP_VALIDATED"] = "true"
    os.environ["GENERATE_MODEL_LOOP_VALIDATION_REPORT"] = validation_ref
    os.environ["GENERATE_MODEL_LOOP_SIGNED_OFF"] = "true"
    os.environ["GENERATE_MODEL_LOOP_SIGNOFF_REPORT"] = signoff_ref
    os.environ["GENERATE_MODEL_LOOP_ITERATIONS"] = "24"

    original_cwd = Path.cwd()
    try:
        os.chdir(backend_dir)
        sys.modules.pop("main", None)
        return importlib.import_module("main")
    finally:
        os.chdir(original_cwd)


def wait_for_job(
    client: TestClient,
    job_id: str,
    timeout_seconds: float,
    poll_interval_seconds: float,
) -> tuple[dict, float]:
    start = time.perf_counter()
    while time.perf_counter() - start < timeout_seconds:
        status_response = client.get(f"/jobs/{job_id}")
        payload = status_response.json()
        state = payload.get("state")
        if status_response.status_code == 200 and state in {"succeeded", "failed"}:
            return payload, time.perf_counter() - start
        time.sleep(poll_interval_seconds)
    return (
        {
            "state": "failed",
            "error": f"poll timeout after {timeout_seconds}s for job_id={job_id}",
        },
        time.perf_counter() - start,
    )


def render_markdown_report(report: dict) -> str:
    summary = report["summary"]
    thresholds = report["thresholds"]
    lines = [
        "# Generate Model-Loop Gate 2 Pilot Report",
        "",
        f"- Generated at: `{report['generated_at_utc']}`",
        f"- Pilot version: `{report['pilot_version']}`",
        f"- Validation reference: `{report['validation_reference']}`",
        f"- Sign-off reference (configured for run): `{report['signoff_reference']}`",
        f"- Overall pass: `{summary['overall_pass']}`",
        "",
        "## Sync /generate Results",
        f"- Cases: `{summary['sync_case_count']}`",
        f"- Error count: `{summary['sync_error_count']}`",
        f"- Error rate: `{summary['sync_error_rate']:.6f}`",
        f"- P95 latency (s): `{summary['sync_p95_latency_seconds']:.6f}`",
        "",
        "## Async /generate/jobs Results",
        f"- Cases: `{summary['async_case_count']}`",
        f"- Error count: `{summary['async_error_count']}`",
        f"- Error rate: `{summary['async_error_rate']:.6f}`",
        f"- P95 end-to-end latency (s): `{summary['async_p95_latency_seconds']:.6f}`",
        "",
        "## Policy and Telemetry",
        f"- Policy violation count: `{summary['policy_violation_count']}`",
        f"- Retry counter delta (generate): `{summary['retry_delta_generate']}`",
        f"- Dead-letter counter delta (generate): `{summary['dead_letter_delta_generate']}`",
        "",
        "## Thresholds",
        f"- Max sync error rate: `{thresholds.get('max_sync_error_rate', 'n/a')}`",
        f"- Max sync P95 latency (s): `{thresholds.get('max_sync_p95_latency_seconds', 'n/a')}`",
        f"- Max async error rate: `{thresholds.get('max_async_error_rate', 'n/a')}`",
        f"- Max async P95 latency (s): `{thresholds.get('max_async_p95_latency_seconds', thresholds.get('max_async_p95_completion_seconds', 'n/a'))}`",
        f"- Max retry delta: `{thresholds.get('max_retry_delta', 'n/a')}`",
        f"- Max dead-letter delta: `{thresholds.get('max_dead_letter_delta', 'n/a')}`",
        f"- Max dead-letter count: `{thresholds.get('max_dead_letter_count', 'n/a')}`",
        f"- Min policy compliance rate: `{thresholds.get('min_policy_compliance_rate', 'n/a')}`",
        "",
        "## Gate Decision",
        f"- Gate 2 prospective pilot status: `{'PASS' if summary['overall_pass'] else 'FAIL'}`",
        "- This report is for non-clinical research platform governance.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Gate 2 prospective pilot checks for /generate model_loop."
    )
    repo_root = Path(__file__).resolve().parents[2]
    parser.add_argument(
        "--manifest",
        default=str(repo_root / "backend" / "validation" / "generate_model_loop_pilot_manifest.json"),
        help="Path to pilot manifest JSON.",
    )
    parser.add_argument(
        "--validation-reference",
        default="docs/reports/generate_model_loop_gate1_baseline.md",
        help="Validation report reference passed to backend runtime gate.",
    )
    parser.add_argument(
        "--signoff-reference",
        default="docs/reports/generate_model_loop_gate3_signoff.md",
        help="Gate 3 sign-off reference passed to backend runtime gate.",
    )
    parser.add_argument(
        "--json-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate2_pilot.json"),
        help="Path to write machine-readable pilot report.",
    )
    parser.add_argument(
        "--md-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate2_pilot.md"),
        help="Path to write markdown pilot summary.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    json_out = Path(args.json_out).resolve()
    md_out = Path(args.md_out).resolve()

    with manifest_path.open("r", encoding="utf-8") as fp:
        manifest = json.load(fp)

    thresholds = manifest["thresholds"]
    max_sync_error_rate = float(thresholds.get("max_sync_error_rate", 0.0))
    max_sync_p95_latency = float(thresholds.get("max_sync_p95_latency_seconds", 1.0))
    max_async_error_rate = float(thresholds.get("max_async_error_rate", 0.0))
    max_async_p95_latency = float(
        thresholds.get(
            "max_async_p95_latency_seconds",
            thresholds.get("max_async_p95_completion_seconds", 5.0),
        )
    )
    max_retry_delta = int(thresholds.get("max_retry_delta", 0))
    max_dead_letter_delta = thresholds.get("max_dead_letter_delta")
    max_dead_letter_count = thresholds.get("max_dead_letter_count")
    min_policy_compliance_rate = float(thresholds.get("min_policy_compliance_rate", 1.0))
    sync_cases = build_cases(manifest, int(manifest.get("sync_case_limit", 36)))
    async_cases = build_cases(manifest, int(manifest.get("async_case_limit", 24)))
    poll_timeout = float(manifest.get("poll_timeout_seconds", 8.0))
    poll_interval = float(manifest.get("poll_interval_seconds", 0.05))

    sync_latencies: list[float] = []
    async_latencies: list[float] = []
    sync_errors = 0
    async_errors = 0
    policy_violations: list[dict[str, str]] = []

    temp_base = repo_root / "backend" / "tmp" / "gate2_pilot_runtime"
    temp_base.mkdir(parents=True, exist_ok=True)
    upload_dir = temp_base / "uploads"
    cache_dir = temp_base / "cache"
    backend_main = load_backend_main(
        repo_root=repo_root,
        upload_dir=upload_dir,
        cache_dir=cache_dir,
        validation_ref=args.validation_reference,
        signoff_ref=args.signoff_reference,
    )

    with TestClient(backend_main.app) as client:
        metrics_before_response = client.get("/metrics")
        if metrics_before_response.status_code != 200:
            raise RuntimeError(
                f"Unable to read baseline metrics: status={metrics_before_response.status_code}"
            )
        metrics_before = metrics_before_response.text
        retry_before = extract_prometheus_metric(
            metrics_before,
            "mpp_async_jobs_retried_total",
            {"job_type": "generate"},
        )
        dead_letter_before = extract_prometheus_metric(
            metrics_before,
            "mpp_async_jobs_dead_lettered_total",
            {"job_type": "generate"},
        )
        dead_letter_count_before = extract_prometheus_metric(
            metrics_before,
            "mpp_dead_letter_count",
        )

        for case in sync_cases:
            payload = {
                "valence": case["valence"],
                "arousal": case["arousal"],
                "modality": case["modality"],
                "profile": case["profile"],
                "age": case["age"],
            }
            start = time.perf_counter()
            response = client.post("/generate", json=payload)
            latency = time.perf_counter() - start
            sync_latencies.append(latency)
            if response.status_code != 200:
                sync_errors += 1
                policy_violations.append(
                    {
                        "case_id": case["case_id"],
                        "source": "sync",
                        "detail": f"HTTP {response.status_code}: {response.text}",
                    }
                )
                continue

            response_payload = response.json()
            violations = check_policy(
                response_payload,
                expected_validation_ref=args.validation_reference,
                expected_signoff_ref=args.signoff_reference,
            )
            if violations:
                sync_errors += 1
                for violation in violations:
                    policy_violations.append(
                        {
                            "case_id": case["case_id"],
                            "source": "sync",
                            "detail": violation,
                        }
                    )

        for case in async_cases:
            payload = {
                "valence": case["valence"],
                "arousal": case["arousal"],
                "modality": case["modality"],
                "profile": case["profile"],
                "age": case["age"],
            }
            submit_response = client.post("/generate/jobs", json=payload)
            if submit_response.status_code != 202:
                async_errors += 1
                policy_violations.append(
                    {
                        "case_id": case["case_id"],
                        "source": "async",
                        "detail": f"submit HTTP {submit_response.status_code}: {submit_response.text}",
                    }
                )
                continue

            submit_payload = submit_response.json()
            job_id = str(submit_payload.get("job_id", ""))
            if not job_id:
                async_errors += 1
                policy_violations.append(
                    {
                        "case_id": case["case_id"],
                        "source": "async",
                        "detail": "missing job_id in submit response",
                    }
                )
                continue

            terminal_payload, latency = wait_for_job(
                client=client,
                job_id=job_id,
                timeout_seconds=poll_timeout,
                poll_interval_seconds=poll_interval,
            )
            async_latencies.append(latency)
            if terminal_payload.get("state") != "succeeded":
                async_errors += 1
                policy_violations.append(
                    {
                        "case_id": case["case_id"],
                        "source": "async",
                        "detail": str(terminal_payload.get("error", "async job failed")),
                    }
                )
                continue

            result_payload = terminal_payload.get("result")
            if not isinstance(result_payload, dict):
                async_errors += 1
                policy_violations.append(
                    {
                        "case_id": case["case_id"],
                        "source": "async",
                        "detail": "missing async result payload",
                    }
                )
                continue
            violations = check_policy(
                result_payload,
                expected_validation_ref=args.validation_reference,
                expected_signoff_ref=args.signoff_reference,
            )
            if violations:
                async_errors += 1
                for violation in violations:
                    policy_violations.append(
                        {
                            "case_id": case["case_id"],
                            "source": "async",
                            "detail": violation,
                        }
                    )

        metrics_after_response = client.get("/metrics")
        if metrics_after_response.status_code != 200:
            raise RuntimeError(
                f"Unable to read final metrics: status={metrics_after_response.status_code}"
            )
        metrics_after = metrics_after_response.text
        retry_after = extract_prometheus_metric(
            metrics_after,
            "mpp_async_jobs_retried_total",
            {"job_type": "generate"},
        )
        dead_letter_after = extract_prometheus_metric(
            metrics_after,
            "mpp_async_jobs_dead_lettered_total",
            {"job_type": "generate"},
        )
        dead_letter_count_after = extract_prometheus_metric(
            metrics_after,
            "mpp_dead_letter_count",
        )

        health_response = client.get("/health")
        health_payload = health_response.json() if health_response.status_code == 200 else {}

    sys.modules.pop("main", None)

    sync_case_count = len(sync_cases)
    async_case_count = len(async_cases)
    sync_error_rate = (sync_errors / sync_case_count) if sync_case_count else 0.0
    async_error_rate = (async_errors / async_case_count) if async_case_count else 0.0
    sync_p95_latency = compute_percentile(sync_latencies, 95.0)
    async_p95_latency = compute_percentile(async_latencies, 95.0)
    retry_delta = int(retry_after - retry_before)
    dead_letter_delta = int(dead_letter_after - dead_letter_before)
    dead_letter_count_current = int(dead_letter_count_after)
    unique_policy_cases = {(item["source"], item["case_id"]) for item in policy_violations}
    total_case_count = sync_case_count + async_case_count
    policy_compliance_rate = (
        (total_case_count - len(unique_policy_cases)) / total_case_count if total_case_count else 1.0
    )

    gate_checks = {
        "sync_error_rate": sync_error_rate <= max_sync_error_rate,
        "sync_latency": sync_p95_latency <= max_sync_p95_latency,
        "async_error_rate": async_error_rate <= max_async_error_rate,
        "async_latency": async_p95_latency <= max_async_p95_latency,
        "retry_stability": retry_delta <= max_retry_delta,
        "policy_compliance": policy_compliance_rate >= min_policy_compliance_rate,
    }
    if max_dead_letter_delta is not None:
        gate_checks["dead_letter_stability"] = dead_letter_delta <= int(max_dead_letter_delta)
    if max_dead_letter_count is not None:
        gate_checks["dead_letter_count"] = dead_letter_count_current <= int(max_dead_letter_count)

    if bool(thresholds.get("require_policy_disclaimer", True)):
        gate_checks["policy"] = len(policy_violations) == 0

    overall_pass = all(gate_checks.values())

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "pilot_version": manifest.get("pilot_version", manifest.get("dataset_version", "unknown")),
        "description": manifest.get("description", ""),
        "validation_reference": args.validation_reference,
        "signoff_reference": args.signoff_reference,
        "thresholds": thresholds,
        "summary": {
            "sync_case_count": sync_case_count,
            "sync_error_count": sync_errors,
            "sync_error_rate": round(sync_error_rate, 6),
            "sync_p95_latency_seconds": round(sync_p95_latency, 6),
            "async_case_count": async_case_count,
            "async_error_count": async_errors,
            "async_error_rate": round(async_error_rate, 6),
            "async_p95_latency_seconds": round(async_p95_latency, 6),
            "policy_violation_count": len(policy_violations),
            "policy_compliance_rate": round(policy_compliance_rate, 6),
            "retry_delta_generate": retry_delta,
            "dead_letter_delta_generate": dead_letter_delta,
            "dead_letter_count_current": dead_letter_count_current,
            "dead_letter_count_delta": int(dead_letter_count_after - dead_letter_count_before),
            "overall_pass": overall_pass,
            "gate_checks": gate_checks,
        },
        "health_snapshot": health_payload,
        "policy_violations": policy_violations,
    }

    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_out.write_text(render_markdown_report(report), encoding="utf-8")

    print(f"Wrote JSON report: {json_out}")
    print(f"Wrote Markdown report: {md_out}")
    print(f"Gate 2 prospective pilot pass: {overall_pass}")
    return 0 if overall_pass else 2


if __name__ == "__main__":
    raise SystemExit(main())
