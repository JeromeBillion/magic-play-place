from __future__ import annotations

import argparse
import importlib
import json
import math
import os
from datetime import datetime, timezone
from itertools import product
from pathlib import Path
from statistics import median


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


def build_cases(manifest: dict) -> list[dict]:
    modalities = manifest["modalities"]
    profiles = manifest["profiles"]
    ages = manifest["ages"]
    targets = manifest["targets"]
    case_limit = int(manifest.get("case_limit", 36))

    cases: list[dict] = []
    for index, (modality, profile, age) in enumerate(product(modalities, profiles, ages)):
        if len(cases) >= case_limit:
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


def render_markdown_report(report: dict) -> str:
    summary = report["summary"]
    thresholds = report["thresholds"]
    lines = [
        "# Generate Model-Loop Gate 1 Validation Report",
        "",
        f"- Generated at: `{report['generated_at_utc']}`",
        f"- Dataset version: `{report['dataset_version']}`",
        f"- Cases: `{summary['case_count']}`",
        f"- Overall pass: `{summary['overall_pass']}`",
        "",
        "## Summary Metrics",
        f"- Determinism rate: `{summary['determinism_rate']:.4f}`",
        f"- Median improvement: `{summary['median_improvement']:.4f}`",
        f"- P95 final distance: `{summary['p95_final_distance']:.4f}`",
        f"- Mean final distance: `{summary['mean_final_distance']:.4f}`",
        f"- Error count: `{summary['error_count']}`",
        "",
        "## Thresholds",
        f"- Minimum determinism rate: `{thresholds['min_determinism_rate']}`",
        f"- Minimum median improvement: `{thresholds['min_median_improvement']}`",
        f"- Maximum P95 final distance: `{thresholds['max_p95_final_distance']}`",
        "",
        "## Gate Decision",
        f"- Gate 1 offline replay status: `{'PASS' if summary['overall_pass'] else 'FAIL'}`",
        "- This report is for research validation only and does not support clinical claims.",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run offline Gate 1 validation for /generate model-loop convergence."
    )
    repo_root = Path(__file__).resolve().parents[2]
    parser.add_argument(
        "--manifest",
        default=str(repo_root / "backend" / "validation" / "generate_model_loop_dataset.json"),
        help="Path to validation manifest JSON.",
    )
    parser.add_argument(
        "--json-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate1_baseline.json"),
        help="Path to write machine-readable validation report.",
    )
    parser.add_argument(
        "--md-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate1_baseline.md"),
        help="Path to write markdown validation summary.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    json_out = Path(args.json_out).resolve()
    md_out = Path(args.md_out).resolve()

    with manifest_path.open("r", encoding="utf-8") as fp:
        manifest = json.load(fp)

    repeat_runs = int(manifest.get("repeat_runs", 3))
    thresholds = manifest.get("thresholds", {})
    cases = build_cases(manifest)

    backend_dir = repo_root / "backend"
    original_cwd = Path.cwd()
    try:
        os.chdir(backend_dir)
        # Import backend runtime helpers only after loading config artifacts.
        backend_main = importlib.import_module("main")
    finally:
        os.chdir(original_cwd)

    case_rows: list[dict] = []
    improvements: list[float] = []
    final_distances: list[float] = []
    deterministic_count = 0
    error_count = 0

    for case in cases:
        req = backend_main.TargetStateRequest(
            valence=case["valence"],
            arousal=case["arousal"],
            modality=case["modality"],
            profile=case["profile"],
            age=case["age"],
        )

        runs = [backend_main.run_model_loop_search(req) for _ in range(repeat_runs)]
        first = runs[0]
        deterministic = all(run == first for run in runs[1:])
        deterministic_count += 1 if deterministic else 0

        improvement = float(first["improvement"])
        final_distance = float(first["final_distance"])
        improvements.append(improvement)
        final_distances.append(final_distance)
        if improvement < 0:
            error_count += 1

        case_rows.append(
            {
                **case,
                "iterations": int(first["iterations"]),
                "baseline_distance": float(first["baseline_distance"]),
                "final_valence": int(first["final_valence"]),
                "final_arousal": int(first["final_arousal"]),
                "final_distance": final_distance,
                "improvement": improvement,
                "deterministic": deterministic,
            }
        )

    case_count = len(case_rows)
    determinism_rate = (deterministic_count / case_count) if case_count else 0.0
    median_improvement = float(median(improvements)) if improvements else 0.0
    p95_final_distance = compute_percentile(final_distances, 95.0)
    mean_final_distance = (sum(final_distances) / case_count) if case_count else 0.0

    gate_checks = {
        "determinism": determinism_rate >= float(thresholds.get("min_determinism_rate", 1.0)),
        "improvement": median_improvement >= float(thresholds.get("min_median_improvement", 0.0)),
        "distance": p95_final_distance <= float(thresholds.get("max_p95_final_distance", 9999.0)),
        "errors": error_count == 0,
    }
    overall_pass = all(gate_checks.values())

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_version": manifest.get("dataset_version", "unknown"),
        "description": manifest.get("description", ""),
        "thresholds": thresholds,
        "summary": {
            "case_count": case_count,
            "deterministic_cases": deterministic_count,
            "determinism_rate": round(determinism_rate, 6),
            "median_improvement": round(median_improvement, 6),
            "p95_final_distance": round(p95_final_distance, 6),
            "mean_final_distance": round(mean_final_distance, 6),
            "error_count": error_count,
            "overall_pass": overall_pass,
            "gate_checks": gate_checks,
        },
        "cases": case_rows,
    }

    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_out.write_text(render_markdown_report(report), encoding="utf-8")

    print(f"Wrote JSON report: {json_out}")
    print(f"Wrote Markdown report: {md_out}")
    print(f"Gate 1 offline replay pass: {overall_pass}")
    return 0 if overall_pass else 2


if __name__ == "__main__":
    raise SystemExit(main())
