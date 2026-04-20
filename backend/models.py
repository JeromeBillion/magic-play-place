from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

class PredictResponse(BaseModel):
    status: Literal["success"] = "success"
    message: str
    stimulus_type: Literal["TEXT", "IMAGE", "VIDEO", "AUDIO"]
    insights: dict[str, Any]
    timesteps: int | None = None
    vertices: int | None = None
    inference_mode: str
    evidence_tags: list[Literal["observed", "inferred", "hypothesis", "low_confidence"]] = []
    scientific_disclaimer: str
    mock_data: bool | None = None

class TargetStateRequest(BaseModel):
    valence: int = Field(ge=0, le=100)
    arousal: int = Field(ge=0, le=100)
    modality: Literal["audio", "text", "image", "video"]
    profile: Literal["neurotypical", "adhd", "asd"] = "neurotypical"
    age: Literal["child", "adult", "elderly"] = "adult"

class GenerateResponse(BaseModel):
    status: Literal["success"] = "success"
    iterations: int
    generated_payload: str
    inference_mode: str
    generation_mode: Literal["simulation", "model_loop"]
    scientific_disclaimer: str
    validation_reference: str | None = None
    signoff_reference: str | None = None
    optimization_metrics: dict[str, int | float] | None = None
    simulated_optimization_metrics: dict[str, int | float] | None = None
    loop_type: Literal["simulation", "model_evaluated"]

class JobSubmitResponse(BaseModel):
    status: Literal["accepted"] = "accepted"
    job_id: str
    job_type: Literal["predict", "generate"]
    state: Literal["queued", "running", "succeeded", "failed"]
    queue_depth: int
    poll_url: str

class JobStatusResponse(BaseModel):
    status: Literal["success"] = "success"
    job_id: str
    job_type: Literal["predict", "generate"]
    state: Literal["queued", "running", "succeeded", "failed"]
    request_id: str
    submitted_at: str
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None
    attempts: int = 0
    max_retries: int = 0
    dead_lettered: bool = False
    dead_letter_reason: str | None = None
    result: dict[str, Any] | None = None

class DeadLetterEntry(BaseModel):
    job_id: str
    job_type: Literal["predict", "generate"]
    request_id: str
    failed_at: str
    attempts: int
    max_retries: int
    error: str
    queue_backend: str

class DeadLetterListResponse(BaseModel):
    status: Literal["success"] = "success"
    total: int
    entries: list[DeadLetterEntry]
