from __future__ import annotations

import math
from enum import Enum
from typing import Any


class EvidenceTag(str, Enum):
    observed = "observed"
    inferred = "inferred"
    hypothesis = "hypothesis"
    low_confidence = "low_confidence"

    @classmethod
    def valid_set(cls) -> set[str]:
        return {member.value for member in cls}


SCIENTIFIC_DISCLAIMER = (
    "Research-use output only. This is not a clinical diagnosis, treatment recommendation, "
    "or medical advice."
)

MOCK_DISCLAIMER = (
    "SYNTHETIC DATA — This output was produced in mock inference mode. "
    "Values are illustrative only and must not be interpreted as real neural measurements. "
    + SCIENTIFIC_DISCLAIMER
)

SIMULATION_DISCLAIMER = (
    "SIMULATION MODE — Therapeutic generation was produced by a gradient-approximation "
    "simulation. No neural model was queried during generation. "
    + SCIENTIFIC_DISCLAIMER
)


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


def _cross_modal_guide(
    stimulus_type: str,
    mean_activation: float | None = None,
    std_activation: float | None = None,
) -> str:
    """Return a cross-modal recommendation, qualified by observed metrics when available."""
    metric_qualifier = ""
    if mean_activation is not None and std_activation is not None:
        spread = "high-spread" if std_activation > 0.01 else "low-spread"
        metric_qualifier = (
            f" [Based on observed activation: mean={mean_activation:.5f}, "
            f"std={std_activation:.5f} — {spread} distribution. "
            "This guide is a heuristic hypothesis; validate via A/B prediction runs.]"
        )
    else:
        metric_qualifier = (
            " [No measured activation data available; this is a modality-level heuristic only.]"
        )

    if stimulus_type == "VIDEO":
        base = (
            "To approximate this response via TEXT, use vivid motion-rich prompts with "
            "high-contrast geometric and temporal descriptions."
        )
    elif stimulus_type == "TEXT":
        base = (
            "To approximate this response via AUDIO, use semantically dense narrative "
            "speech with rapid lexical transitions."
        )
    elif stimulus_type == "AUDIO":
        base = (
            "To approximate this response via IMAGE, use compositionally complex visuals "
            "with dense texture and implied acoustic energy."
        )
    else:
        base = (
            "To approximate this response via AUDIO, use sparse bright transients and short "
            "tonal pings to induce high-salience perceptual association."
        )
    return base + metric_qualifier


def validate_evidence_tags(tags: list[str]) -> list[str]:
    """Validate and return only known EvidenceTag values. Raises on empty result."""
    valid = EvidenceTag.valid_set()
    filtered = [t for t in tags if t in valid]
    if not filtered:
        raise ValueError(
            f"evidence_tags contained no valid values. "
            f"Got {tags!r}; allowed: {sorted(valid)}"
        )
    return filtered


def analyze_fmri_roi(
    roi_data: dict[str, Any],
    stimulus_type: str,
    *,
    is_mock: bool = False,
) -> dict[str, Any]:
    """
    Produce research-facing interpretation with explicit evidence tags.

    Evidence tags (EvidenceTag enum):
    - observed: directly measured from model output summary metrics
    - inferred: interpretation logic derived from observed metrics
    - hypothesis: next-step speculative recommendation
    - low_confidence: flagged anomalous or synthetic output

    Args:
        roi_data: Activation statistics dict from inference.
        stimulus_type: Stimulus type string (TEXT, IMAGE, VIDEO, AUDIO).
        is_mock: If True, marks output as synthetic and appends mock disclaimer.
    """
    mean_activation = _safe_float(roi_data, "mean_activation")
    max_activation = _safe_float(roi_data, "max_activation")
    min_activation = _safe_float(roi_data, "min_activation")
    std_activation = _safe_float(roi_data, "std_activation")
    segment_count = _safe_int(roi_data, "segment_count")

    evidence: list[dict[str, str]] = []
    evidence_tags: list[str] = []

    if is_mock:
        evidence_tags.append(EvidenceTag.low_confidence)
        evidence.append(
            {
                "tag": EvidenceTag.low_confidence,
                "statement": (
                    "Output was generated in MOCK inference mode. "
                    "Activation values are synthetic constants and must not be interpreted "
                    "as real neural measurements."
                ),
                "source": "mock_inference_flag",
            }
        )

    if mean_activation is not None:
        if EvidenceTag.low_confidence not in evidence_tags:
            evidence_tags.insert(0, EvidenceTag.observed)
        else:
            evidence_tags.append(EvidenceTag.observed)
        evidence.append(
            {
                "tag": EvidenceTag.observed,
                "statement": (
                    "Predicted activation distribution: "
                    f"mean={mean_activation:.5f}, "
                    f"std={std_activation if std_activation is not None else 0.0:.5f}, "
                    f"min={min_activation if min_activation is not None else 0.0:.5f}, "
                    f"max={max_activation if max_activation is not None else 0.0:.5f}."
                ),
                "source": "tribe_prediction_summary",
            }
        )
        evidence.append(
            {
                "tag": EvidenceTag.inferred,
                "statement": (
                    "Interpretation emphasizes relative activation spread and salience over "
                    "absolute biological ground truth."
                ),
                "source": "heuristic_mapping_v1",
            }
        )
        evidence_tags.append(EvidenceTag.inferred)
    else:
        evidence.append(
            {
                "tag": EvidenceTag.inferred,
                "statement": (
                    "No calibrated prediction metrics were supplied; interpretation is modality-level "
                    "and should be treated as low-confidence guidance."
                ),
                "source": "fallback_mapping_v1",
            }
        )
        if EvidenceTag.inferred not in evidence_tags:
            evidence_tags.append(EvidenceTag.inferred)

    cross_modal = _cross_modal_guide(
        stimulus_type,
        mean_activation=mean_activation,
        std_activation=std_activation,
    )

    evidence.append(
        {
            "tag": EvidenceTag.hypothesis,
            "statement": (
                "Use the cross-modal guide as a testable hypothesis and validate via repeated "
                "prediction runs before drawing conclusions."
            ),
            "source": "experimental_recommendation",
        }
    )
    if EvidenceTag.hypothesis not in evidence_tags:
        evidence_tags.append(EvidenceTag.hypothesis)

    description = (
        f"{stimulus_type} pathway analysis generated"
        + (" [MOCK — synthetic data]" if is_mock else "")
        + ". "
        + (
            f"Processed {segment_count} kept temporal segments. "
            if segment_count is not None
            else "Segment-level count unavailable in this execution mode. "
        )
        + "Use evidence tags to separate observation from interpretation."
    )

    disclaimer = MOCK_DISCLAIMER if is_mock else SCIENTIFIC_DISCLAIMER

    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped_tags: list[str] = []
    for t in evidence_tags:
        tv = t.value if isinstance(t, EvidenceTag) else t
        if tv not in seen:
            seen.add(tv)
            deduped_tags.append(tv)

    return {
        "description": description,
        "cross_modal_guide": cross_modal,
        "evidence_tags": deduped_tags,
        "evidence": evidence,
        "scientific_disclaimer": disclaimer,
        "mock_data": is_mock,
    }
