from __future__ import annotations

from typing import Any


def _safe_float(data: dict[str, Any], key: str) -> float | None:
    value = data.get(key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(data: dict[str, Any], key: str) -> int | None:
    value = data.get(key)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _cross_modal_guide(stimulus_type: str) -> str:
    if stimulus_type == "VIDEO":
        return (
            "To approximate this response via TEXT, use vivid motion-rich prompts with "
            "high-contrast geometric and temporal descriptions."
        )
    if stimulus_type == "TEXT":
        return (
            "To approximate this response via AUDIO, use semantically dense narrative "
            "speech with rapid lexical transitions."
        )
    if stimulus_type == "AUDIO":
        return (
            "To approximate this response via IMAGE, use compositionally complex visuals "
            "with dense texture and implied acoustic energy."
        )
    return (
        "To approximate this response via AUDIO, use sparse bright transients and short "
        "tonal pings to induce high-salience perceptual association."
    )


def analyze_fmri_roi(roi_data: dict[str, Any], stimulus_type: str) -> dict[str, Any]:
    """
    Produce research-facing interpretation with explicit evidence tags.

    Evidence tags:
    - observed: directly measured from model output summary metrics
    - inferred: interpretation logic derived from observed metrics
    - hypothesis: next-step speculative recommendation
    """
    mean_activation = _safe_float(roi_data, "mean_activation")
    max_activation = _safe_float(roi_data, "max_activation")
    min_activation = _safe_float(roi_data, "min_activation")
    std_activation = _safe_float(roi_data, "std_activation")
    segment_count = _safe_int(roi_data, "segment_count")

    evidence = []
    evidence_tags = ["inferred", "hypothesis"]

    if mean_activation is not None:
        evidence_tags.insert(0, "observed")
        evidence.append(
            {
                "tag": "observed",
                "statement": (
                    "Predicted activation distribution: "
                    f"mean={mean_activation:.5f}, std={std_activation if std_activation is not None else 0.0:.5f}, "
                    f"min={min_activation if min_activation is not None else 0.0:.5f}, "
                    f"max={max_activation if max_activation is not None else 0.0:.5f}."
                ),
                "source": "tribe_prediction_summary",
            }
        )
        evidence.append(
            {
                "tag": "inferred",
                "statement": (
                    "Interpretation emphasizes relative activation spread and salience over "
                    "absolute biological ground truth."
                ),
                "source": "heuristic_mapping_v1",
            }
        )
    else:
        evidence.append(
            {
                "tag": "inferred",
                "statement": (
                    "No calibrated prediction metrics were supplied; interpretation is modality-level "
                    "and should be treated as low-confidence guidance."
                ),
                "source": "fallback_mapping_v1",
            }
        )

    description = (
        f"{stimulus_type} pathway analysis generated. "
        + (
            f"Processed {segment_count} kept temporal segments. "
            if segment_count is not None
            else "Segment-level count unavailable in this execution mode. "
        )
        + "Use evidence tags to separate observation from interpretation."
    )
    cross_modal = _cross_modal_guide(stimulus_type)

    evidence.append(
        {
            "tag": "hypothesis",
            "statement": (
                "Use the cross-modal guide as a testable hypothesis and validate via repeated "
                "prediction runs before drawing conclusions."
            ),
            "source": "experimental_recommendation",
        }
    )

    return {
        "description": description,
        "cross_modal_guide": cross_modal,
        "evidence_tags": evidence_tags,
        "evidence": evidence,
        "scientific_disclaimer": (
            "Research-use output only. This is not a clinical diagnosis, treatment recommendation, "
            "or medical advice."
        ),
    }

