from typing import Literal

from fastapi import APIRouter, File, Form, Request, UploadFile

from auth import enforce_request_access_controls, get_request_id
from config import DELETE_UPLOADS_AFTER_INFERENCE
from inference.pipeline import execute_predict_pipeline, prepare_predict_submission
from jobs.queue import maybe_cleanup_jobs
from media import maybe_cleanup_uploads
from models import PredictResponse

router = APIRouter()

@router.post("/predict", response_model=PredictResponse)
async def process_stimulus(
    request: Request,
    media: UploadFile | None = File(default=None),
    text_prompt: str | None = Form(default=None),
    profile: Literal["neurotypical", "adhd", "asd"] = Form(default="neurotypical"),
    age: Literal["child", "adult", "elderly"] = Form(default="adult"),
) -> PredictResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/predict", request_id=request_id)
    maybe_cleanup_uploads()
    maybe_cleanup_jobs()

    stimulus_type, file_path, normalized_text, request_artifacts = await prepare_predict_submission(
        media=media,
        text_prompt=text_prompt,
        request_id=request_id,
    )
    return await execute_predict_pipeline(
        request_id=request_id,
        stimulus_type=stimulus_type,
        file_path=file_path,
        normalized_text=normalized_text,
        profile=profile,
        age=age,
        request_artifacts=request_artifacts,
        delete_artifacts=DELETE_UPLOADS_AFTER_INFERENCE,
    )
