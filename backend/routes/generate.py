from fastapi import APIRouter, Request

from auth import enforce_request_access_controls, get_request_id
from inference.pipeline import execute_generate_pipeline
from jobs.queue import maybe_cleanup_jobs
from media import maybe_cleanup_uploads
from models import GenerateResponse, TargetStateRequest

router = APIRouter()

@router.post("/generate", response_model=GenerateResponse)
async def generate_therapeutic(req: TargetStateRequest, request: Request) -> GenerateResponse:
    request_id = get_request_id(request)
    enforce_request_access_controls(request, route_tag="/generate", request_id=request_id)
    maybe_cleanup_uploads()
    maybe_cleanup_jobs()
    return await execute_generate_pipeline(req)
