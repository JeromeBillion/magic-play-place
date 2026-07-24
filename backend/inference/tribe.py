import threading
from pathlib import Path
from typing import Any, Literal

from llm_analyst import analyze_fmri_roi

from config import (
    INFERENCE_MODE,
    TRIBEV2_CACHE_FOLDER,
    TRIBEV2_CHECKPOINT_DIR,
    TRIBEV2_CHECKPOINT_NAME,
    TRIBEV2_CLUSTER,
    TRIBEV2_DEVICE,
    logger,
)
from media import get_unique_upload_path, safe_unlink

_tribe_model: Any | None = None
_tribe_model_error: str | None = None
_tribe_lock = threading.Lock()


def _import_tribe_model_cls():
    try:
        from tribev2 import TribeModel
    except ImportError as exc:
        raise RuntimeError(
            "Failed to import tribev2 package. Install it with "
            "`pip install -e ..\\engine\\tribev2` before running INFERENCE_MODE=tribe."
        ) from exc

    return TribeModel


def load_tribe_model() -> Any:
    global _tribe_model
    global _tribe_model_error

    if _tribe_model is not None:
        return _tribe_model

    with _tribe_lock:
        if _tribe_model is not None:
            return _tribe_model
        if _tribe_model_error is not None:
            raise RuntimeError(_tribe_model_error)

        if not TRIBEV2_CHECKPOINT_DIR:
            msg = "TRIBEV2_CHECKPOINT_DIR is required when INFERENCE_MODE=tribe."
            _tribe_model_error = msg
            raise RuntimeError(msg)

        try:
            TribeModel = _import_tribe_model_cls()
            model = TribeModel.from_pretrained(
                checkpoint_dir=TRIBEV2_CHECKPOINT_DIR,
                checkpoint_name=TRIBEV2_CHECKPOINT_NAME,
                cache_folder=str(TRIBEV2_CACHE_FOLDER),
                cluster=TRIBEV2_CLUSTER,
                device=TRIBEV2_DEVICE,
            )
        except Exception as exc:
            _tribe_model_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Failed to load TribeModel")
            raise RuntimeError(_tribe_model_error) from exc

        _tribe_model = model
        logger.info(
            "Loaded TribeModel from %s (%s)",
            TRIBEV2_CHECKPOINT_DIR,
            TRIBEV2_CHECKPOINT_NAME,
        )
        return _tribe_model


def get_tribe_model_status() -> str:
    if INFERENCE_MODE != "tribe":
        return "disabled"
    with _tribe_lock:
        if _tribe_model is not None:
            return "loaded"
        if _tribe_model_error is not None:
            return f"error: {_tribe_model_error}"
    return "not_loaded"


def run_tribe_inference(
    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    file_path: Path | None,
    normalized_text: str,
    profile: str,
    age: str,
) -> tuple[dict[str, Any], int, int, int, list[Path]]:
    import numpy as np

    model = load_tribe_model()
    created_artifacts: list[Path] = []
    try:
        if stimulus_type == "TEXT":
            if not normalized_text:
                raise RuntimeError("Text stimulus is empty.")
            text_path = get_unique_upload_path(".txt", prefix="prompt")
            text_path.write_text(normalized_text, encoding="utf-8")
            created_artifacts.append(text_path)
            events = model.get_events_dataframe(text_path=str(text_path))
        elif stimulus_type == "AUDIO":
            if file_path is None:
                raise RuntimeError("Audio stimulus path is missing.")
            events = model.get_events_dataframe(audio_path=str(file_path))
        else:
            if file_path is None:
                raise RuntimeError("Video stimulus path is missing.")
            events = model.get_events_dataframe(video_path=str(file_path))

        preds, segments = model.predict(events=events, verbose=False)
        if preds.ndim != 2:
            raise RuntimeError(f"Unexpected prediction shape: {preds.shape}")

        # AR5: Validate prediction tensor integrity before analysis
        if bool(np.isnan(preds).any()) or bool(np.isinf(preds).any()):
            raise RuntimeError(
                "Prediction tensor contains NaN or Inf values. "
                "Model output is corrupted; cannot produce reliable insights."
            )
        std_val = float(np.std(preds))
        is_degenerate = std_val < 1e-9
        if is_degenerate:
            logger.warning(
                "request_id=unknown tribe_degenerate_prediction std=%.2e — "
                "constant prediction output; results flagged as low_confidence.",
                std_val,
            )

        roi_data = {
            "mean_activation": float(np.mean(preds)),
            "max_activation": float(np.max(preds)),
            "min_activation": float(np.min(preds)),
            "std_activation": std_val,
            "segment_count": len(segments),
            "profile": profile,
            "age": age,
            "degenerate": is_degenerate,
        }
        insights = analyze_fmri_roi(roi_data, stimulus_type)
        if is_degenerate:
            from llm_analyst import EvidenceTag
            tags = insights.get("evidence_tags", [])
            if EvidenceTag.low_confidence not in tags:
                tags.insert(0, EvidenceTag.low_confidence)
                insights["evidence_tags"] = tags
            insights["scientific_disclaimer"] = (
                "LOW CONFIDENCE — Degenerate (constant) prediction detected (std ≈ 0). "
                + insights.get("scientific_disclaimer", "")
            )
        timesteps = int(preds.shape[0])
        vertices = int(preds.shape[1])
        return insights, timesteps, vertices, len(segments), created_artifacts
    except Exception:
        for artifact in created_artifacts:
            safe_unlink(artifact)
        raise
