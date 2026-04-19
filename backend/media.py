import threading
import time
import wave
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from config import (
    AUDIO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_MB,
    MEDIA_CONTENT_TYPES,
    UPLOAD_CLEANUP_INTERVAL_SECONDS,
    UPLOAD_DIR,
    UPLOAD_TTL_HOURS,
    VIDEO_EXTENSIONS,
    logger,
)

_cleanup_lock = threading.Lock()
_next_cleanup_epoch = 0.0


def get_stimulus_type_from_extension(ext: str) -> Literal["IMAGE", "VIDEO", "AUDIO"]:
    if ext in IMAGE_EXTENSIONS:
        return "IMAGE"
    if ext in VIDEO_EXTENSIONS:
        return "VIDEO"
    if ext in AUDIO_EXTENSIONS:
        return "AUDIO"
    allowed = sorted(IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | AUDIO_EXTENSIONS)
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"Unsupported media type '{ext}'. Allowed extensions: {', '.join(allowed)}",
    )


def get_unique_upload_path(ext: str, prefix: str = "upload") -> Path:
    return UPLOAD_DIR / f"{prefix}_{uuid4().hex}{ext}"


async def persist_upload_file(media: UploadFile) -> Path:
    suffix = Path(media.filename or "").suffix.lower()
    if not suffix:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded media must include a valid file extension.",
        )

    target_path = get_unique_upload_path(suffix)
    size = 0

    try:
        with target_path.open("wb") as output_file:
            while True:
                chunk = await media.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Uploaded file exceeds MAX_UPLOAD_MB={MAX_UPLOAD_MB}.",
                    )
                output_file.write(chunk)
    except HTTPException:
        if target_path.exists():
            target_path.unlink()
        raise
    except Exception as exc:
        if target_path.exists():
            target_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist uploaded media: {exc}",
        ) from exc
    finally:
        await media.close()

    return target_path


def normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""
    return content_type.split(";")[0].strip().lower()


def read_signature(file_path: Path, size: int = 32) -> bytes:
    with file_path.open("rb") as input_file:
        return input_file.read(size)


def is_iso_bmff(signature: bytes, brands: set[bytes]) -> bool:
    return len(signature) >= 12 and signature[4:8] == b"ftyp" and signature[8:12] in brands


def is_mp3_signature(signature: bytes) -> bool:
    if signature.startswith(b"ID3"):
        return True
    return len(signature) >= 2 and signature[0] == 0xFF and (signature[1] & 0xE0) == 0xE0


def validate_media_content_type(
    extension: str,
    content_type: str | None,
    request_id: str,
) -> None:
    normalized_type = normalize_content_type(content_type)
    allowed_types = MEDIA_CONTENT_TYPES.get(extension, set())
    if normalized_type and allowed_types and normalized_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"[{request_id}] Content-Type '{normalized_type}' does not match "
                f"file extension '{extension}'."
            ),
        )


def validate_media_signature(file_path: Path, extension: str, request_id: str) -> None:
    signature = read_signature(file_path, size=64)
    mismatch_detail = (
        f"[{request_id}] File content does not match extension '{extension}'. "
        "Upload an unmodified media file with matching format."
    )

    if extension in {".jpg", ".jpeg"} and not signature.startswith(b"\xFF\xD8\xFF"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".png" and not signature.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".bmp" and not signature.startswith(b"BM"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".webp" and not (
        len(signature) >= 12 and signature.startswith(b"RIFF") and signature[8:12] == b"WEBP"
    ):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".mp3" and not is_mp3_signature(signature):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".wav":
        if not (len(signature) >= 12 and signature.startswith(b"RIFF") and signature[8:12] == b"WAVE"):
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
        try:
            with wave.open(str(file_path), "rb") as wav_file:
                wav_file.getnframes()
        except (wave.Error, EOFError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"[{request_id}] Corrupted WAV file: {exc}",
            ) from exc
    if extension == ".avi" and not (
        len(signature) >= 12 and signature.startswith(b"RIFF") and signature[8:12] == b"AVI "
    ):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".webm" and not signature.startswith(b"\x1A\x45\xDF\xA3"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".mp4" and not is_iso_bmff(
        signature, {b"isom", b"iso2", b"avc1", b"mp41", b"mp42", b"dash", b"MSNV"}
    ):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".mov" and not is_iso_bmff(signature, {b"qt  "}):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)
    if extension == ".m4a" and not is_iso_bmff(
        signature, {b"M4A ", b"M4B ", b"isom", b"mp42"}
    ):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=mismatch_detail)


def validate_uploaded_media(
    file_path: Path,
    content_type: str | None,
    request_id: str,
) -> None:
    extension = file_path.suffix.lower()
    try:
        validate_media_content_type(extension, content_type, request_id)
        validate_media_signature(file_path, extension, request_id)
    except HTTPException as exc:
        logger.warning(
            "request_id=%s media_validation_failed file=%s reason=%s",
            request_id,
            file_path.name,
            exc.detail,
        )
        raise


def is_path_in_directory(path: Path, directory: Path) -> bool:
    resolved_path = path.resolve()
    resolved_dir = directory.resolve()
    return resolved_path == resolved_dir or resolved_dir in resolved_path.parents


def safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Failed to delete artifact %s: %s", path, exc)


def cleanup_request_artifacts(artifacts: list[Path], request_id: str) -> None:
    seen: set[str] = set()
    for artifact in artifacts:
        key = str(artifact)
        if key in seen:
            continue
        seen.add(key)
        if not is_path_in_directory(artifact, UPLOAD_DIR):
            logger.warning(
                "request_id=%s skipped_artifact_cleanup path_outside_upload_dir=%s",
                request_id,
                artifact,
            )
            continue
        safe_unlink(artifact)


def cleanup_expired_uploads(force: bool = False) -> int:
    if UPLOAD_TTL_HOURS <= 0:
        return 0

    global _next_cleanup_epoch
    now = time.time()
    with _cleanup_lock:
        if not force and now < _next_cleanup_epoch:
            return 0
        _next_cleanup_epoch = now + max(60, UPLOAD_CLEANUP_INTERVAL_SECONDS)

    cutoff = now - (UPLOAD_TTL_HOURS * 3600)
    deleted = 0
    for path in UPLOAD_DIR.glob("*"):
        if not path.is_file():
            continue
        try:
            modified_time = path.stat().st_mtime
        except FileNotFoundError:
            continue
        if modified_time <= cutoff:
            safe_unlink(path)
            deleted += 1

    if deleted:
        logger.info(
            "Deleted %s expired upload artifact(s) from %s (ttl_hours=%s)",
            deleted,
            UPLOAD_DIR,
            UPLOAD_TTL_HOURS,
        )
    return deleted


def maybe_cleanup_uploads() -> None:
    try:
        cleanup_expired_uploads(force=False)
    except Exception:
        logger.exception("Upload cleanup failed unexpectedly")

