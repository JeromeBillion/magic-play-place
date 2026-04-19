"""Image-to-video conversion for Tribe v2 V-JEPA2 backend compatibility."""

from __future__ import annotations

import logging

logger = logging.getLogger("magic-play-place.conversion")

try:
    from moviepy import ImageClip
except ImportError:
    ImageClip = None


def convert_image_to_video(image_path: str, output_path: str, duration: int = 1) -> str:
    """
    Converts a static image into a 1-second video clip.
    This enables native compatibility with the Tribe v2 V-JEPA2 backend.

    Raises RuntimeError if moviepy is not installed.
    """
    if ImageClip is None:
        raise RuntimeError(
            "moviepy is required for image-to-video conversion but is not installed. "
            "Install with: pip install 'moviepy>=2.2.1'"
        )

    try:
        clip = ImageClip(image_path)
        clip = clip.with_duration(duration)
        clip.write_videofile(output_path, fps=24, codec="libx264", logger=None)
        return output_path
    except Exception as exc:
        logger.error("Image-to-video conversion failed: %s", exc)
        raise
