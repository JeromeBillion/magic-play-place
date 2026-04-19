import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("magic-play-place.backend")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_CHARS", "8000"))
UPLOAD_TTL_HOURS = int(os.getenv("UPLOAD_TTL_HOURS", "24"))
UPLOAD_CLEANUP_INTERVAL_SECONDS = int(os.getenv("UPLOAD_CLEANUP_INTERVAL_SECONDS", "900"))
DELETE_UPLOADS_AFTER_INFERENCE = env_flag("DELETE_UPLOADS_AFTER_INFERENCE", default=False)
REQUIRE_API_KEY = env_flag("REQUIRE_API_KEY", default=False)
API_KEY = os.getenv("API_KEY", "").strip()
RATE_LIMIT_ENABLED = env_flag("RATE_LIMIT_ENABLED", default=True)
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "30"))
RATE_LIMIT_TRUST_X_FORWARDED_FOR = env_flag(
    "RATE_LIMIT_TRUST_X_FORWARDED_FOR", default=False
)
ASYNC_JOB_QUEUE_ENABLED = env_flag("ASYNC_JOB_QUEUE_ENABLED", default=True)
JOB_WORKER_CONCURRENCY = int(os.getenv("JOB_WORKER_CONCURRENCY", "2"))
JOB_QUEUE_MAX_PENDING = int(os.getenv("JOB_QUEUE_MAX_PENDING", "100"))
JOB_RETENTION_HOURS = int(os.getenv("JOB_RETENTION_HOURS", "24"))
JOB_CLEANUP_INTERVAL_SECONDS = int(os.getenv("JOB_CLEANUP_INTERVAL_SECONDS", "900"))
GENERATE_SIMULATION_DELAY_SECONDS = float(
    os.getenv("GENERATE_SIMULATION_DELAY_SECONDS", "1.5")
)
GENERATE_MODE = os.getenv("GENERATE_MODE", "simulation").strip().lower()
VALID_GENERATE_MODES = {"simulation", "model_loop"}
GENERATE_MODEL_LOOP_VALIDATED = env_flag("GENERATE_MODEL_LOOP_VALIDATED", default=False)
GENERATE_MODEL_LOOP_VALIDATION_REPORT = os.getenv(
    "GENERATE_MODEL_LOOP_VALIDATION_REPORT", ""
).strip()
GENERATE_MODEL_LOOP_SIGNED_OFF = env_flag("GENERATE_MODEL_LOOP_SIGNED_OFF", default=False)
GENERATE_MODEL_LOOP_SIGNOFF_REPORT = os.getenv(
    "GENERATE_MODEL_LOOP_SIGNOFF_REPORT", ""
).strip()
GENERATE_MODEL_LOOP_ITERATIONS = int(os.getenv("GENERATE_MODEL_LOOP_ITERATIONS", "24"))
JOB_MAX_RETRIES = int(os.getenv("JOB_MAX_RETRIES", "2"))
DLQ_MAX_ITEMS = int(os.getenv("DLQ_MAX_ITEMS", "1000"))
METRICS_ENABLED = env_flag("METRICS_ENABLED", default=True)
METRICS_REQUIRE_API_KEY = env_flag("METRICS_REQUIRE_API_KEY", default=False)
OTEL_ENABLED = env_flag("OTEL_ENABLED", default=False)
OTEL_SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "magic-play-place-backend").strip()
OTEL_EXPORTER_OTLP_ENDPOINT = os.getenv(
    "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces"
).strip()
OTEL_EXPORTER_OTLP_HEADERS = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "").strip()
QUEUE_BACKEND = os.getenv("QUEUE_BACKEND", "inmemory").strip().lower()
VALID_QUEUE_BACKENDS = {"inmemory", "redis"}
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()
REDIS_KEY_PREFIX = os.getenv("REDIS_KEY_PREFIX", "mpp").strip() or "mpp"
INFERENCE_MODE = os.getenv("INFERENCE_MODE", "mock").strip().lower()
VALID_INFERENCE_MODES = {"mock", "tribe"}

if INFERENCE_MODE not in VALID_INFERENCE_MODES:
    raise RuntimeError(
        f"Invalid INFERENCE_MODE={INFERENCE_MODE!r}. Valid values: {sorted(VALID_INFERENCE_MODES)}"
    )
if REQUIRE_API_KEY and not API_KEY:
    raise RuntimeError("API_KEY is required when REQUIRE_API_KEY=true.")
if RATE_LIMIT_WINDOW_SECONDS <= 0:
    raise RuntimeError("RATE_LIMIT_WINDOW_SECONDS must be greater than 0.")
if RATE_LIMIT_MAX_REQUESTS <= 0:
    raise RuntimeError("RATE_LIMIT_MAX_REQUESTS must be greater than 0.")
if JOB_WORKER_CONCURRENCY <= 0:
    raise RuntimeError("JOB_WORKER_CONCURRENCY must be greater than 0.")
if JOB_QUEUE_MAX_PENDING <= 0:
    raise RuntimeError("JOB_QUEUE_MAX_PENDING must be greater than 0.")
if JOB_CLEANUP_INTERVAL_SECONDS <= 0:
    raise RuntimeError("JOB_CLEANUP_INTERVAL_SECONDS must be greater than 0.")
if GENERATE_SIMULATION_DELAY_SECONDS < 0:
    raise RuntimeError("GENERATE_SIMULATION_DELAY_SECONDS must be >= 0.")
if GENERATE_MODE not in VALID_GENERATE_MODES:
    raise RuntimeError(
        f"Invalid GENERATE_MODE={GENERATE_MODE!r}. Valid values: {sorted(VALID_GENERATE_MODES)}"
    )
if GENERATE_MODEL_LOOP_ITERATIONS <= 0:
    raise RuntimeError("GENERATE_MODEL_LOOP_ITERATIONS must be greater than 0.")
if GENERATE_MODEL_LOOP_VALIDATED and not GENERATE_MODEL_LOOP_VALIDATION_REPORT:
    raise RuntimeError(
        "GENERATE_MODEL_LOOP_VALIDATION_REPORT is required when "
        "GENERATE_MODEL_LOOP_VALIDATED=true."
    )
if GENERATE_MODEL_LOOP_SIGNED_OFF and not GENERATE_MODEL_LOOP_SIGNOFF_REPORT:
    raise RuntimeError(
        "GENERATE_MODEL_LOOP_SIGNOFF_REPORT is required when "
        "GENERATE_MODEL_LOOP_SIGNED_OFF=true."
    )
if GENERATE_MODEL_LOOP_SIGNED_OFF and not GENERATE_MODEL_LOOP_VALIDATED:
    raise RuntimeError(
        "GENERATE_MODEL_LOOP_SIGNED_OFF=true requires "
        "GENERATE_MODEL_LOOP_VALIDATED=true."
    )
if GENERATE_MODE == "model_loop" and not GENERATE_MODEL_LOOP_VALIDATED:
    raise RuntimeError(
        "GENERATE_MODE=model_loop requires GENERATE_MODEL_LOOP_VALIDATED=true."
    )
if GENERATE_MODE == "model_loop" and not GENERATE_MODEL_LOOP_SIGNED_OFF:
    raise RuntimeError(
        "GENERATE_MODE=model_loop requires GENERATE_MODEL_LOOP_SIGNED_OFF=true."
    )
if GENERATE_MODE == "model_loop" and not GENERATE_MODEL_LOOP_SIGNOFF_REPORT:
    raise RuntimeError(
        "GENERATE_MODE=model_loop requires GENERATE_MODEL_LOOP_SIGNOFF_REPORT."
    )
if JOB_MAX_RETRIES < 0:
    raise RuntimeError("JOB_MAX_RETRIES must be >= 0.")
if DLQ_MAX_ITEMS <= 0:
    raise RuntimeError("DLQ_MAX_ITEMS must be greater than 0.")
if QUEUE_BACKEND not in VALID_QUEUE_BACKENDS:
    raise RuntimeError(
        f"Invalid QUEUE_BACKEND={QUEUE_BACKEND!r}. Valid values: {sorted(VALID_QUEUE_BACKENDS)}"
    )

TRIBEV2_CHECKPOINT_DIR = os.getenv("TRIBEV2_CHECKPOINT_DIR", "").strip()
TRIBEV2_CHECKPOINT_NAME = os.getenv("TRIBEV2_CHECKPOINT_NAME", "best.ckpt").strip()
TRIBEV2_CACHE_FOLDER = Path(
    os.getenv("TRIBEV2_CACHE_FOLDER", BASE_DIR / "cache" / "tribev2")
)
TRIBEV2_DEVICE = os.getenv("TRIBEV2_DEVICE", "auto").strip()
TRIBEV2_CLUSTER = os.getenv("TRIBEV2_CLUSTER", "").strip() or None
TRIBEV2_PRELOAD_MODEL = env_flag("TRIBEV2_PRELOAD_MODEL", default=False)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a"}
MEDIA_CONTENT_TYPES: dict[str, set[str]] = {
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".bmp": {"image/bmp"},
    ".webp": {"image/webp"},
    ".mp4": {"video/mp4"},
    ".webm": {"video/webm"},
    ".mov": {"video/quicktime"},
    ".avi": {"video/x-msvideo", "video/avi"},
    ".mp3": {"audio/mpeg", "audio/mp3"},
    ".wav": {"audio/wav", "audio/x-wav", "audio/wave"},
    ".m4a": {"audio/mp4", "audio/m4a", "audio/x-m4a"},
}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TRIBEV2_CACHE_FOLDER.mkdir(parents=True, exist_ok=True)

def parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["http://localhost:3000"]

CORS_ORIGINS = parse_cors_origins()
ALLOW_CREDENTIALS = "*" not in CORS_ORIGINS
