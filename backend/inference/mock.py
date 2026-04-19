from typing import Any, Literal
from llm_analyst import analyze_fmri_roi

def run_mock_inference(
    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    profile: str,
    age: str,
) -> tuple[dict[str, Any], int, int]:
    roi_data = {"dummy_roi_scores": 1.0, "profile": profile, "age": age}
    insights = analyze_fmri_roi(roi_data, stimulus_type)
    return insights, 1, 20484
