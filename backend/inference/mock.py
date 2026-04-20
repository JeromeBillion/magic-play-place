from typing import Any, Literal
from llm_analyst import analyze_fmri_roi

def run_mock_inference(
    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    profile: str,
    age: str,
) -> tuple[dict[str, Any], int, int]:
    import random
    # Vary outputs by stimulus so downstream code exercises diverse paths
    seed = hash((stimulus_type, profile, age)) & 0xFFFF
    rng = random.Random(seed)
    timesteps = rng.randint(1, 8)
    vertices = 20484
    roi_data = {
        "dummy_roi_scores": round(rng.uniform(0.1, 0.9), 4),
        "profile": profile,
        "age": age,
    }
    insights = analyze_fmri_roi(roi_data, stimulus_type, is_mock=True)
    return insights, timesteps, vertices
