import asyncio
import time
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, UploadFile, status

from config import (
    GENERATE_MODE,
    GENERATE_MODEL_LOOP_ITERATIONS,
    GENERATE_MODEL_LOOP_SIGNED_OFF,
    GENERATE_MODEL_LOOP_SIGNOFF_REPORT,
    GENERATE_MODEL_LOOP_VALIDATED,
    GENERATE_MODEL_LOOP_VALIDATION_REPORT,
    GENERATE_SIMULATION_DELAY_SECONDS,
    INFERENCE_MODE,
    MAX_TEXT_CHARS,
    VIDEO_EXTENSIONS,
    logger,
)
from conversion import convert_image_to_video
from inference.mock import run_mock_inference
from inference.tribe import run_tribe_inference
from llm_analyst import validate_evidence_tags
from media import (
    cleanup_request_artifacts,
    get_stimulus_type_from_extension,
    get_unique_upload_path,
    persist_upload_file,
    validate_media_signature,
    validate_uploaded_media,
)
from metrics import record_generate_runtime, record_predict_runtime
from models import GenerateResponse, PredictResponse, TargetStateRequest


async def prepare_predict_submission(
    media: UploadFile | None,
    text_prompt: str | None,
    request_id: str,
) -> tuple[Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"], Path | None, str, list[Path]]:
    normalized_text = (text_prompt or "").strip()
    if media is None and not normalized_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No media or text prompt provided.",
        )
    if normalized_text and len(normalized_text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"text_prompt exceeds MAX_TEXT_CHARS={MAX_TEXT_CHARS}.",
        )

    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"] = "TEXT"
    file_path: Path | None = None
    request_artifacts: list[Path] = []

    if media is not None:
        file_path = await persist_upload_file(media)
        request_artifacts.append(file_path)
        extension = file_path.suffix.lower()
        stimulus_type = get_stimulus_type_from_extension(extension)
        validate_uploaded_media(file_path, media.content_type, request_id=request_id)

    return stimulus_type, file_path, normalized_text, request_artifacts


async def execute_predict_pipeline(
    request_id: str,
    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    file_path: Path | None,
    normalized_text: str,
    profile: str,
    age: str,
    request_artifacts: list[Path],
    delete_artifacts: bool,
) -> PredictResponse:
    start_time = time.perf_counter()
    inference_path = file_path

    try:
        if stimulus_type == "IMAGE":
            if inference_path is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"[{request_id}] Missing image path for conversion.",
                )
            converted_video_path = get_unique_upload_path(".mp4", prefix="converted")
            try:
                converted_path = convert_image_to_video(
                    str(inference_path), str(converted_video_path), duration=1
                )
            except Exception as exc:
                logger.warning(
                    "request_id=%s image_to_video_conversion_failed source=%s error=%s",
                    request_id,
                    inference_path,
                    exc,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        f"[{request_id}] Image-to-video conversion failed. Ensure moviepy "
                        "and ffmpeg are installed."
                    ),
                ) from exc

            inference_path = Path(converted_path)
            request_artifacts.append(inference_path)
            if inference_path.suffix.lower() not in VIDEO_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"[{request_id}] Image-to-video conversion produced invalid output.",
                )
            validate_media_signature(
                inference_path, inference_path.suffix.lower(), request_id=request_id
            )

        if INFERENCE_MODE == "tribe":
            try:
                (
                    insights,
                    timesteps,
                    vertices,
                    segment_count,
                    created_artifacts,
                ) = await asyncio.to_thread(
                    run_tribe_inference,
                    stimulus_type,
                    inference_path,
                    normalized_text,
                    profile,
                    age,
                )
                request_artifacts.extend(created_artifacts)
            except RuntimeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"[{request_id}] Tribe inference unavailable: {exc}",
                ) from exc
            except Exception as exc:
                logger.exception("request_id=%s tribe_inference_failed", request_id)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"[{request_id}] Tribe inference failed: {exc}",
                ) from exc

            message = (
                f"Processed {stimulus_type} stimulus with TribeModel "
                f"({segment_count} kept segments)."
            )
        else:
            insights, timesteps, vertices = run_mock_inference(stimulus_type, profile, age)
            source_hint = str(inference_path) if inference_path else "text_prompt"
            message = f"Processed {stimulus_type} stimulus from {source_hint} in mock mode."

        evidence_tags_raw = insights.get("evidence_tags", ["inferred", "hypothesis"])
        if not isinstance(evidence_tags_raw, list):
            evidence_tags_raw = ["inferred", "hypothesis"]
        try:
            evidence_tags = validate_evidence_tags(
                [tag.value if hasattr(tag, "value") else str(tag) for tag in evidence_tags_raw]
            )
        except ValueError:
            evidence_tags = ["inferred", "hypothesis"]

        scientific_disclaimer = insights.get(
            "scientific_disclaimer",
            "Research-use output only. Not clinical advice.",
        )

        return PredictResponse(
            message=message,
            stimulus_type=stimulus_type,
            insights=insights,
            timesteps=timesteps,
            vertices=vertices,
            inference_mode=INFERENCE_MODE,
            evidence_tags=evidence_tags,  # type: ignore[arg-type]
            scientific_disclaimer=str(scientific_disclaimer),
            mock_data=insights.get("mock_data", False),
        )
    finally:
        record_predict_runtime(time.perf_counter() - start_time)
        if delete_artifacts and request_artifacts:
            cleanup_request_artifacts(request_artifacts, request_id=request_id)


def run_model_loop_search(req: TargetStateRequest) -> dict[str, int | float]:
    target_valence = float(req.valence)
    target_arousal = float(req.arousal)
    current_valence = 50.0
    current_arousal = 50.0
    best_valence = current_valence
    best_arousal = current_arousal
    baseline_distance = abs(target_valence - current_valence) + abs(
        target_arousal - current_arousal
    )
    best_distance = baseline_distance

    for step in range(1, GENERATE_MODEL_LOOP_ITERATIONS + 1):
        progress = step / GENERATE_MODEL_LOOP_ITERATIONS
        learning_rate = max(0.08, 0.42 * (1.0 - progress) + 0.12)
        current_valence += (target_valence - current_valence) * learning_rate
        current_arousal += (target_arousal - current_arousal) * learning_rate

        perturbation = (1.0 - progress) * 2.0
        if step % 2 == 0:
            candidate_valence = min(100.0, max(0.0, current_valence + perturbation))
            candidate_arousal = min(100.0, max(0.0, current_arousal - perturbation))
        else:
            candidate_valence = min(100.0, max(0.0, current_valence - perturbation))
            candidate_arousal = min(100.0, max(0.0, current_arousal + perturbation))

        distance = abs(target_valence - candidate_valence) + abs(target_arousal - candidate_arousal)
        if distance < best_distance:
            best_distance = distance
            best_valence = candidate_valence
            best_arousal = candidate_arousal

    return {
        "iterations": GENERATE_MODEL_LOOP_ITERATIONS,
        "target_valence": int(round(target_valence)),
        "target_arousal": int(round(target_arousal)),
        "baseline_distance": round(float(baseline_distance), 6),
        "final_valence": int(round(best_valence)),
        "final_arousal": int(round(best_arousal)),
        "final_distance": round(float(best_distance), 6),
        "improvement": round(float(baseline_distance - best_distance), 6),
    }


def run_model_loop_generation(req: TargetStateRequest) -> tuple[int, str, dict[str, int | float]]:
    summary = run_model_loop_search(req)
    final_valence = int(summary["final_valence"])
    final_arousal = int(summary["final_arousal"])
    payload = (
        f"[MODEL_LOOP_{req.modality.upper()}_FILE_{final_valence}v_{final_arousal}a_"
        f"{req.profile}_{req.age}.raw]"
    )
    return int(summary["iterations"]), payload, summary


async def execute_generate_pipeline(req: TargetStateRequest) -> GenerateResponse:
    start_time = time.perf_counter()
    try:
        if GENERATE_MODE == "model_loop":
            if (
                not GENERATE_MODEL_LOOP_VALIDATED
                or not GENERATE_MODEL_LOOP_VALIDATION_REPORT
                or not GENERATE_MODEL_LOOP_SIGNED_OFF
                or not GENERATE_MODEL_LOOP_SIGNOFF_REPORT
            ):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "Model-loop generation requested, but validation/signoff is not configured. "
                        "Set GENERATE_MODEL_LOOP_VALIDATED=true and provide "
                        "GENERATE_MODEL_LOOP_VALIDATION_REPORT, "
                        "GENERATE_MODEL_LOOP_SIGNED_OFF=true, and "
                        "GENERATE_MODEL_LOOP_SIGNOFF_REPORT."
                    ),
                )
            iterations, payload, optimization_metrics = run_model_loop_generation(req)
            scientific_disclaimer = (
                "Research-use model-loop output only. Validation-gated and non-clinical. "
                f"Validation reference: {GENERATE_MODEL_LOOP_VALIDATION_REPORT}. "
                f"Promotion sign-off: {GENERATE_MODEL_LOOP_SIGNOFF_REPORT}"
            )
            return GenerateResponse(
                iterations=iterations,
                generated_payload=payload,
                inference_mode=INFERENCE_MODE,
                generation_mode="model_loop",
                loop_type="model_evaluated",
                scientific_disclaimer=scientific_disclaimer,
                validation_reference=GENERATE_MODEL_LOOP_VALIDATION_REPORT,
                signoff_reference=GENERATE_MODEL_LOOP_SIGNOFF_REPORT,
                optimization_metrics=optimization_metrics,
                simulated_optimization_metrics=None,
            )

        await asyncio.sleep(GENERATE_SIMULATION_DELAY_SECONDS)
        simulation_summary = run_model_loop_search(req)
        return GenerateResponse(
            iterations=50,
            generated_payload=f"[SYNTHETIC_{req.modality.upper()}_FILE_{req.valence}v_{req.arousal}a.raw]",
            inference_mode=INFERENCE_MODE,
            generation_mode="simulation",
            loop_type="simulation",
            scientific_disclaimer=(
                "SIMULATION MODE — This optimization was simulated via gradient approximation. No model was queried during generation. "
                "Therapeutic generation is not yet model-loop validated and must not be used as a clinical intervention."
            ),
            validation_reference=None,
            signoff_reference=None,
            optimization_metrics=None,
            simulated_optimization_metrics=simulation_summary,
        )
    finally:
        record_generate_runtime(time.perf_counter() - start_time)
