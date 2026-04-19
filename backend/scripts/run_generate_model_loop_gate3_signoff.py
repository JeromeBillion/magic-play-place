from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def to_repo_relative(path: Path, repo_root: Path) -> str:
    try:
        relative = path.relative_to(repo_root)
        return str(relative).replace("\\", "/")
    except ValueError:
        return str(path)


def render_markdown_report(report: dict) -> str:
    decision = report["decision"]
    gate_inputs = report["gate_inputs"]
    lines = [
        "# Generate Model-Loop Gate 3 Sign-off Report",
        "",
        f"- Generated at: `{report['generated_at_utc']}`",
        f"- Sign-off ID: `{report['signoff_id']}`",
        f"- Signatories: `{', '.join(report['signatories'])}`",
        f"- Approval decision: `{decision['approved']}`",
        "",
        "## Gate Inputs",
        f"- Gate 1 report: `{gate_inputs['gate1_report']}`",
        f"- Gate 1 pass: `{gate_inputs['gate1_pass']}`",
        f"- Gate 2 report: `{gate_inputs['gate2_report']}`",
        f"- Gate 2 pass: `{gate_inputs['gate2_pass']}`",
        f"- Gate 2 policy violations: `{gate_inputs['gate2_policy_violation_count']}`",
        f"- Gate 2 retry delta: `{gate_inputs['gate2_retry_delta_generate']}`",
        f"- Gate 2 dead-letter delta: `{gate_inputs['gate2_dead_letter_delta_generate']}`",
        "",
        "## Governance Decision",
        f"- Commercialization stance: `{decision['commercialization_stance']}`",
        f"- Runtime promotion: `{decision['runtime_promotion']}`",
        f"- Evidence policy reference: `{decision['policy_reference']}`",
        "",
        "## Notes",
        f"- {decision['notes']}",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Gate 3 sign-off decision from Gate 1 and Gate 2 reports."
    )
    repo_root = Path(__file__).resolve().parents[2]
    parser.add_argument(
        "--gate1-json",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate1_baseline.json"),
        help="Path to Gate 1 JSON report.",
    )
    parser.add_argument(
        "--gate2-json",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate2_pilot.json"),
        help="Path to Gate 2 JSON report.",
    )
    parser.add_argument(
        "--signatories",
        default="platform-engineering,scientific-governance",
        help="Comma-separated signatory identifiers.",
    )
    parser.add_argument(
        "--json-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate3_signoff.json"),
        help="Path to write machine-readable Gate 3 sign-off report.",
    )
    parser.add_argument(
        "--md-out",
        default=str(repo_root / "docs" / "reports" / "generate_model_loop_gate3_signoff.md"),
        help="Path to write markdown Gate 3 sign-off report.",
    )
    args = parser.parse_args()

    gate1_path = Path(args.gate1_json).resolve()
    gate2_path = Path(args.gate2_json).resolve()
    json_out = Path(args.json_out).resolve()
    md_out = Path(args.md_out).resolve()

    with gate1_path.open("r", encoding="utf-8") as fp:
        gate1_report = json.load(fp)
    with gate2_path.open("r", encoding="utf-8") as fp:
        gate2_report = json.load(fp)
    gate1_ref = to_repo_relative(gate1_path, repo_root)
    gate2_ref = to_repo_relative(gate2_path, repo_root)

    gate1_pass = bool(gate1_report.get("summary", {}).get("overall_pass", False))
    gate2_summary = gate2_report.get("summary", {})
    gate2_pass = bool(gate2_summary.get("overall_pass", False))
    gate2_policy_violations = int(gate2_summary.get("policy_violation_count", 0))
    gate2_retry_delta = int(gate2_summary.get("retry_delta_generate", 0))
    gate2_dead_letter_delta = int(gate2_summary.get("dead_letter_delta_generate", 0))
    approval = (
        gate1_pass
        and gate2_pass
        and gate2_policy_violations == 0
        and gate2_retry_delta == 0
        and gate2_dead_letter_delta == 0
    )

    signatories = [token.strip() for token in args.signatories.split(",") if token.strip()]
    signoff_id = f"gate3-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

    report = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "signoff_id": signoff_id,
        "signatories": signatories,
        "gate_inputs": {
            "gate1_report": gate1_ref,
            "gate1_pass": gate1_pass,
            "gate2_report": gate2_ref,
            "gate2_pass": gate2_pass,
            "gate2_policy_violation_count": gate2_policy_violations,
            "gate2_retry_delta_generate": gate2_retry_delta,
            "gate2_dead_letter_delta_generate": gate2_dead_letter_delta,
        },
        "decision": {
            "approved": approval,
            "runtime_promotion": "ALLOW_GENERATE_MODE_MODEL_LOOP" if approval else "HOLD_SIMULATION",
            "commercialization_stance": (
                "research_tooling_non_clinical_output_only" if approval else "hold_until_gates_pass"
            ),
            "policy_reference": "docs/RESEARCH_USE_AND_EVIDENCE_POLICY.md",
            "notes": (
                "Gate 1 and Gate 2 passed with stable policy/telemetry checks. "
                "Model-loop remains non-clinical research output."
                if approval
                else "One or more Gate 3 prerequisites failed. Keep /generate in simulation mode."
            ),
        },
    }

    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    md_out.write_text(render_markdown_report(report), encoding="utf-8")

    print(f"Wrote JSON report: {json_out}")
    print(f"Wrote Markdown report: {md_out}")
    print(f"Gate 3 sign-off approval: {approval}")
    return 0 if approval else 2


if __name__ == "__main__":
    raise SystemExit(main())
