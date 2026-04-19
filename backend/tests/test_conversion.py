import unittest
from unittest import mock

import conversion


class ConversionTests(unittest.TestCase):
    def test_convert_raises_runtime_error_when_moviepy_unavailable(self):
        with mock.patch.object(conversion, "ImageClip", None):
            with self.assertRaises(RuntimeError) as context:
                conversion.convert_image_to_video("input.png", "output.mp4")

        self.assertIn("moviepy is required", str(context.exception))
        self.assertIn("pip install", str(context.exception))

    def test_convert_logs_and_reraises_conversion_failure(self):
        class BrokenClip:
            def with_duration(self, duration: int):
                return self

            def write_videofile(self, *_args, **_kwargs):
                raise ValueError("bad encode")

        with mock.patch.object(conversion, "ImageClip", return_value=BrokenClip()):
            with mock.patch.object(conversion.logger, "error") as logger_error:
                with self.assertRaises(ValueError) as context:
                    conversion.convert_image_to_video("input.png", "output.mp4")

        self.assertIn("bad encode", str(context.exception))
        logger_error.assert_called_once()


if __name__ == "__main__":
    unittest.main()
