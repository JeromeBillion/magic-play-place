import importlib
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient


def load_main_module(env_overrides: dict[str, str]):
    for mod_name in list(sys.modules.keys()):
        if mod_name in ("main", "config", "auth", "media", "metrics", "models") or mod_name.startswith("jobs.") or mod_name.startswith("inference.") or mod_name.startswith("routes."):
            sys.modules.pop(mod_name, None)
    with mock.patch.dict(os.environ, env_overrides, clear=False):
        module = importlib.import_module("main")
    return module


class MockModeApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "MAX_TEXT_CHARS": "20",
                "MAX_UPLOAD_MB": "1",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def test_health_returns_minimal_probe(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload, {"status": "ok"})

    def test_admin_status_reports_mock_mode(self):
        response = self.client.get("/admin/status")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["inference_mode"], "mock")
        self.assertEqual(payload["generate_mode"], "simulation")
        self.assertEqual(payload["tribe_model_status"], "disabled")
        self.assertEqual(payload["queue_backend"], "inmemory")
        self.assertIn("upload_ttl_hours", payload)
        self.assertIn("delete_uploads_after_inference", payload)
        self.assertIn("api_key_required", payload)
        self.assertIn("rate_limit_enabled", payload)
        self.assertIn("job_max_retries", payload)
        self.assertIn("dead_letter_count", payload)
        self.assertIn("metrics_enabled", payload)
        self.assertIn("otel_enabled", payload)
        self.assertIn("generate_model_loop_validation_report", payload)
        self.assertIn("generate_model_loop_signoff_report", payload)

    def test_predict_rejects_empty_submission(self):
        response = self.client.post("/predict", data={})
        self.assertEqual(response.status_code, 400)
        self.assertIn("No media or text prompt provided", response.json()["detail"])

    def test_predict_text_success(self):
        response = self.client.post(
            "/predict",
            data={"text_prompt": "neural text", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["inference_mode"], "mock")
        self.assertEqual(payload["stimulus_type"], "TEXT")
        self.assertGreaterEqual(payload["timesteps"], 1)
        self.assertLessEqual(payload["timesteps"], 8)
        self.assertEqual(payload["vertices"], 20484)
        self.assertIn("description", payload["insights"])
        self.assertIn("cross_modal_guide", payload["insights"])
        self.assertIn("evidence_tags", payload)
        self.assertGreaterEqual(len(payload["evidence_tags"]), 1)
        self.assertIn("low_confidence", payload["evidence_tags"])
        self.assertTrue(payload["mock_data"])
        self.assertIn("scientific_disclaimer", payload)

    def test_predict_text_too_long(self):
        response = self.client.post(
            "/predict",
            data={"text_prompt": "x" * 21, "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("MAX_TEXT_CHARS=20", response.json()["detail"])

    def test_predict_rejects_unsupported_media_extension(self):
        response = self.client.post(
            "/predict",
            files={"media": ("sample.exe", b"abc", "application/octet-stream")},
        )
        self.assertEqual(response.status_code, 415)
        self.assertIn("Unsupported media type", response.json()["detail"])

    def test_predict_accepts_audio_media(self):
        response = self.client.post(
            "/predict",
            files={"media": ("stimulus.mp3", b"ID3\x00\x00\x00", "audio/mpeg")},
            data={"profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["stimulus_type"], "AUDIO")
        self.assertEqual(payload["inference_mode"], "mock")

    def test_predict_rejects_content_type_mismatch(self):
        response = self.client.post(
            "/predict",
            files={"media": ("stimulus.mp3", b"ID3\x04\x00\x00", "image/png")},
            data={"profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 415)
        self.assertIn("Content-Type", response.json()["detail"])

    def test_predict_rejects_signature_mismatch(self):
        response = self.client.post(
            "/predict",
            files={"media": ("stimulus.mp3", b"\x89PNG\r\n\x1a\n", "audio/mpeg")},
            data={"profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 415)
        self.assertIn("does not match extension", response.json()["detail"])

    def test_predict_rejects_corrupted_wav(self):
        response = self.client.post(
            "/predict",
            files={"media": ("stimulus.wav", b"RIFF\x08\x00\x00\x00WAVE", "audio/wav")},
            data={"profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("Corrupted WAV file", response.json()["detail"])

    def test_generate_success(self):
        with mock.patch.object(self.main.asyncio, "sleep", new=mock.AsyncMock()) as sleep_mock:
            response = self.client.post(
                "/generate",
                json={
                    "valence": 60,
                    "arousal": 40,
                    "modality": "audio",
                    "profile": "neurotypical",
                    "age": "adult",
                },
            )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["iterations"], 50)
        self.assertEqual(payload["inference_mode"], "mock")
        self.assertEqual(payload["generation_mode"], "simulation")
        self.assertEqual(payload["loop_type"], "simulation")
        self.assertIn("SIMULATION MODE", payload["scientific_disclaimer"])
        self.assertIn("SYNTHETIC_AUDIO_FILE_60v_40a.raw", payload["generated_payload"])
        self.assertIsNone(payload["validation_reference"])
        self.assertIsNone(payload["optimization_metrics"])
        self.assertIsInstance(payload["simulated_optimization_metrics"], dict)
        sleep_mock.assert_awaited_once()


class TribeModeFallbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "tribe",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "TRIBEV2_CHECKPOINT_DIR": "",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def test_health_reports_tribe_mode_unloaded(self):
        response = self.client.get("/admin/status")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["inference_mode"], "tribe")
        self.assertEqual(payload["tribe_model_status"], "not_loaded")
        self.assertFalse(payload["tribe_checkpoint_configured"])

    def test_predict_returns_503_without_checkpoint_config(self):
        response = self.client.post(
            "/predict",
            data={"text_prompt": "tribe path", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn(
            "TRIBEV2_CHECKPOINT_DIR is required",
            response.json()["detail"],
        )


class ModelLoopGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "GENERATE_MODE": "model_loop",
                "GENERATE_MODEL_LOOP_VALIDATED": "true",
                "GENERATE_MODEL_LOOP_VALIDATION_REPORT": "docs/GENERATE_MODEL_LOOP_VALIDATION_PLAN.md",
                "GENERATE_MODEL_LOOP_SIGNED_OFF": "true",
                "GENERATE_MODEL_LOOP_SIGNOFF_REPORT": "docs/reports/generate_model_loop_gate3_signoff.md",
                "GENERATE_MODEL_LOOP_ITERATIONS": "12",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def test_generate_runs_in_model_loop_mode(self):
        response = self.client.post(
            "/generate",
            json={
                "valence": 72,
                "arousal": 31,
                "modality": "audio",
                "profile": "neurotypical",
                "age": "adult",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["generation_mode"], "model_loop")
        self.assertEqual(payload["iterations"], 12)
        self.assertIn("MODEL_LOOP_AUDIO_FILE_", payload["generated_payload"])
        self.assertIn("Validation reference", payload["scientific_disclaimer"])
        self.assertEqual(
            payload["validation_reference"],
            "docs/GENERATE_MODEL_LOOP_VALIDATION_PLAN.md",
        )
        self.assertEqual(
            payload["signoff_reference"],
            "docs/reports/generate_model_loop_gate3_signoff.md",
        )
        self.assertIsInstance(payload["optimization_metrics"], dict)
        self.assertGreaterEqual(payload["optimization_metrics"]["improvement"], 0)
        self.assertLessEqual(
            payload["optimization_metrics"]["final_distance"],
            payload["optimization_metrics"]["baseline_distance"],
        )


class ModelLoopConfigGuardTests(unittest.TestCase):
    def test_model_loop_requires_validation_gate(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            with self.assertRaises(RuntimeError):
                load_main_module(
                    {
                        "INFERENCE_MODE": "mock",
                        "UPLOAD_DIR": str(base / "uploads"),
                        "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                        "GENERATE_MODE": "model_loop",
                        "GENERATE_MODEL_LOOP_VALIDATED": "false",
                        "GENERATE_MODEL_LOOP_VALIDATION_REPORT": "",
                        "GENERATE_MODEL_LOOP_SIGNED_OFF": "false",
                        "GENERATE_MODEL_LOOP_SIGNOFF_REPORT": "",
                    }
                )
            sys.modules.pop("main", None)

    def test_signoff_flag_requires_validation_flag(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            with self.assertRaises(RuntimeError):
                load_main_module(
                    {
                        "INFERENCE_MODE": "mock",
                        "UPLOAD_DIR": str(base / "uploads"),
                        "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                        "GENERATE_MODE": "simulation",
                        "GENERATE_MODEL_LOOP_VALIDATED": "false",
                        "GENERATE_MODEL_LOOP_VALIDATION_REPORT": "",
                        "GENERATE_MODEL_LOOP_SIGNED_OFF": "true",
                        "GENERATE_MODEL_LOOP_SIGNOFF_REPORT": "docs/reports/generate_model_loop_gate3_signoff.md",
                    }
                )
            sys.modules.pop("main", None)

    def test_model_loop_requires_signoff_gate(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            with self.assertRaises(RuntimeError):
                load_main_module(
                    {
                        "INFERENCE_MODE": "mock",
                        "UPLOAD_DIR": str(base / "uploads"),
                        "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                        "GENERATE_MODE": "model_loop",
                        "GENERATE_MODEL_LOOP_VALIDATED": "true",
                        "GENERATE_MODEL_LOOP_VALIDATION_REPORT": "docs/reports/generate_model_loop_gate1_baseline.md",
                        "GENERATE_MODEL_LOOP_SIGNED_OFF": "false",
                        "GENERATE_MODEL_LOOP_SIGNOFF_REPORT": "",
                    }
                )
            sys.modules.pop("main", None)


class ArtifactLifecycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "DELETE_UPLOADS_AFTER_INFERENCE": "true",
                "UPLOAD_TTL_HOURS": "1",
                "UPLOAD_CLEANUP_INTERVAL_SECONDS": "1",
            }
        )
        cls.config = importlib.import_module("config")
        cls.media = importlib.import_module("media")
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def test_predict_deletes_request_artifacts_when_enabled(self):
        upload_dir = Path(self.config.UPLOAD_DIR)
        response = self.client.post(
            "/predict",
            files={"media": ("stimulus.mp3", b"ID3\x04\x00\x00", "audio/mpeg")},
            data={"profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stimulus_type"], "AUDIO")
        remaining_files = [path for path in upload_dir.glob("*") if path.is_file()]
        self.assertEqual(remaining_files, [])

    def test_cleanup_expired_uploads_removes_stale_files(self):
        upload_dir = Path(self.config.UPLOAD_DIR)
        stale_file = upload_dir / "old_upload.mp3"
        stale_file.write_bytes(b"ID3\x04\x00\x00")
        stale_time = time.time() - (3 * 3600)
        os.utime(stale_file, (stale_time, stale_time))

        deleted = self.media.cleanup_expired_uploads(force=True)
        self.assertGreaterEqual(deleted, 1)
        self.assertFalse(stale_file.exists())


class AccessControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "REQUIRE_API_KEY": "true",
                "API_KEY": "test-secret",
                "RATE_LIMIT_ENABLED": "true",
                "RATE_LIMIT_WINDOW_SECONDS": "60",
                "RATE_LIMIT_MAX_REQUESTS": "2",
            }
        )
        cls.client = TestClient(cls.main.app)
        cls.auth_header = {"X-API-Key": "test-secret"}

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def test_predict_rejects_missing_api_key(self):
        response = self.client.post(
            "/predict",
            data={"text_prompt": "hello", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("API key required", response.json()["detail"])

    def test_predict_rejects_invalid_api_key(self):
        response = self.client.post(
            "/predict",
            headers={"X-API-Key": "bad-key"},
            data={"text_prompt": "hello", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Invalid API key", response.json()["detail"])

    def test_predict_accepts_valid_api_key(self):
        response = self.client.post(
            "/predict",
            headers=self.auth_header,
            data={"text_prompt": "authorized", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

    def test_generate_rate_limit_enforced(self):
        payload = {
            "valence": 50,
            "arousal": 50,
            "modality": "audio",
            "profile": "neurotypical",
            "age": "adult",
        }
        with mock.patch.object(self.main.asyncio, "sleep", new=mock.AsyncMock()):
            first = self.client.post("/generate", headers=self.auth_header, json=payload)
            second = self.client.post("/generate", headers=self.auth_header, json=payload)
            third = self.client.post("/generate", headers=self.auth_header, json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 429)
        self.assertIn("Rate limit exceeded", third.json()["detail"])


class AsyncJobQueueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "ASYNC_JOB_QUEUE_ENABLED": "true",
                "JOB_WORKER_CONCURRENCY": "1",
                "JOB_QUEUE_MAX_PENDING": "10",
                "GENERATE_SIMULATION_DELAY_SECONDS": "0.01",
                "RATE_LIMIT_ENABLED": "false",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def wait_for_job(self, job_id: str, timeout_seconds: float = 3.0) -> dict:
        start = time.time()
        while time.time() - start < timeout_seconds:
            response = self.client.get(f"/jobs/{job_id}")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            if payload["state"] in {"succeeded", "failed"}:
                return payload
            time.sleep(0.05)
        self.fail(f"Job {job_id} did not complete within {timeout_seconds}s")

    def test_predict_async_job_submission_and_completion(self):
        submit = self.client.post(
            "/predict/jobs",
            data={"text_prompt": "queue me", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(submit.status_code, 202)
        submit_payload = submit.json()
        self.assertEqual(submit_payload["status"], "accepted")
        self.assertEqual(submit_payload["job_type"], "predict")
        self.assertEqual(submit_payload["state"], "queued")
        self.assertIn("job_id", submit_payload)
        self.assertIn("poll_url", submit_payload)

        status_payload = self.wait_for_job(submit_payload["job_id"])
        self.assertEqual(status_payload["state"], "succeeded")
        self.assertIn("result", status_payload)
        self.assertEqual(status_payload["result"]["stimulus_type"], "TEXT")
        self.assertEqual(status_payload["result"]["inference_mode"], "mock")

    def test_generate_async_job_submission_and_completion(self):
        submit = self.client.post(
            "/generate/jobs",
            json={
                "valence": 55,
                "arousal": 45,
                "modality": "audio",
                "profile": "neurotypical",
                "age": "adult",
            },
        )
        self.assertEqual(submit.status_code, 202)
        submit_payload = submit.json()
        self.assertEqual(submit_payload["job_type"], "generate")
        self.assertEqual(submit_payload["state"], "queued")

        status_payload = self.wait_for_job(submit_payload["job_id"])
        self.assertEqual(status_payload["state"], "succeeded")
        self.assertEqual(status_payload["result"]["generation_mode"], "simulation")

    def test_jobs_returns_400_for_malformed_id(self):
        response = self.client.get("/jobs/does-not-exist")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid job_id format", response.json()["detail"])

    def test_jobs_returns_404_for_missing_id(self):
        response = self.client.get("/jobs/00000000000000000000000000000000")
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.json()["detail"])


class MetricsEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "mock",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "ASYNC_JOB_QUEUE_ENABLED": "true",
                "JOB_WORKER_CONCURRENCY": "1",
                "JOB_QUEUE_MAX_PENDING": "10",
                "GENERATE_SIMULATION_DELAY_SECONDS": "0.01",
                "RATE_LIMIT_ENABLED": "false",
                "METRICS_ENABLED": "true",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def wait_for_job(self, job_id: str, timeout_seconds: float = 3.0) -> dict:
        start = time.time()
        while time.time() - start < timeout_seconds:
            response = self.client.get(f"/jobs/{job_id}")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            if payload["state"] in {"succeeded", "failed"}:
                return payload
            time.sleep(0.05)
        self.fail(f"Job {job_id} did not complete within {timeout_seconds}s")

    def test_metrics_endpoint_exports_runtime_and_queue_metrics(self):
        predict_response = self.client.post(
            "/predict",
            data={"text_prompt": "metric probe", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(predict_response.status_code, 200)

        with mock.patch.object(self.main.asyncio, "sleep", new=mock.AsyncMock()):
            generate_response = self.client.post(
                "/generate",
                json={
                    "valence": 41,
                    "arousal": 62,
                    "modality": "audio",
                    "profile": "neurotypical",
                    "age": "adult",
                },
            )
        self.assertEqual(generate_response.status_code, 200)

        submit = self.client.post(
            "/predict/jobs",
            data={"text_prompt": "metric async", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(submit.status_code, 202)
        self.wait_for_job(submit.json()["job_id"])

        metrics_response = self.client.get("/metrics")
        self.assertEqual(metrics_response.status_code, 200)
        metrics_text = metrics_response.text
        self.assertIn("mpp_predict_runtime_seconds_count", metrics_text)
        self.assertIn("mpp_generate_runtime_seconds_count", metrics_text)
        self.assertIn('mpp_async_jobs_submitted_total{job_type="predict"}', metrics_text)
        self.assertIn('mpp_async_job_runtime_seconds_count{job_type="predict"}', metrics_text)
        self.assertIn("mpp_dead_letter_count", metrics_text)


class AsyncDeadLetterRetryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.temp_dir.name)
        cls.main = load_main_module(
            {
                "INFERENCE_MODE": "tribe",
                "TRIBEV2_CHECKPOINT_DIR": "",
                "UPLOAD_DIR": str(base / "uploads"),
                "TRIBEV2_CACHE_FOLDER": str(base / "cache"),
                "ASYNC_JOB_QUEUE_ENABLED": "true",
                "JOB_WORKER_CONCURRENCY": "1",
                "JOB_QUEUE_MAX_PENDING": "10",
                "JOB_MAX_RETRIES": "1",
                "RATE_LIMIT_ENABLED": "false",
            }
        )
        cls.client = TestClient(cls.main.app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        sys.modules.pop("main", None)

    def wait_for_job(self, job_id: str, timeout_seconds: float = 4.0) -> dict:
        start = time.time()
        while time.time() - start < timeout_seconds:
            response = self.client.get(f"/jobs/{job_id}")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            if payload["state"] in {"succeeded", "failed"}:
                return payload
            time.sleep(0.05)
        self.fail(f"Job {job_id} did not complete within {timeout_seconds}s")

    def submit_failing_predict_job(self) -> str:
        submit = self.client.post(
            "/predict/jobs",
            data={"text_prompt": "this should fail", "profile": "neurotypical", "age": "adult"},
        )
        self.assertEqual(submit.status_code, 202)
        payload = submit.json()
        self.assertEqual(payload["job_type"], "predict")
        return payload["job_id"]

    def test_dead_letter_list_includes_failed_job(self):
        job_id = self.submit_failing_predict_job()
        job_payload = self.wait_for_job(job_id)
        self.assertEqual(job_payload["state"], "failed")
        self.assertTrue(job_payload["dead_lettered"])
        self.assertEqual(job_payload["dead_letter_reason"], "retry_exhausted")
        self.assertEqual(job_payload["max_retries"], 1)
        self.assertEqual(job_payload["attempts"], 2)

        dlq_response = self.client.get("/jobs/dead-letter?limit=25")
        self.assertEqual(dlq_response.status_code, 200)
        dlq_payload = dlq_response.json()
        self.assertIn("total", dlq_payload)
        self.assertGreaterEqual(dlq_payload["total"], 1)

        matching = [entry for entry in dlq_payload["entries"] if entry["job_id"] == job_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["attempts"], 2)
        self.assertEqual(matching[0]["max_retries"], 1)

    def test_retry_endpoint_requeues_dead_letter_job(self):
        job_id = self.submit_failing_predict_job()
        first_terminal = self.wait_for_job(job_id)
        self.assertEqual(first_terminal["state"], "failed")
        self.assertTrue(first_terminal["dead_lettered"])

        retry_response = self.client.post(f"/jobs/{job_id}/retry")
        self.assertEqual(retry_response.status_code, 202)
        retry_payload = retry_response.json()
        self.assertEqual(retry_payload["job_id"], job_id)
        self.assertEqual(retry_payload["state"], "queued")

        second_terminal = self.wait_for_job(job_id)
        self.assertEqual(second_terminal["state"], "failed")
        self.assertTrue(second_terminal["dead_lettered"])
        self.assertEqual(second_terminal["attempts"], 2)

        dlq_response = self.client.get("/jobs/dead-letter?limit=100")
        self.assertEqual(dlq_response.status_code, 200)
        dlq_payload = dlq_response.json()
        matching = [entry for entry in dlq_payload["entries"] if entry["job_id"] == job_id]
        self.assertEqual(len(matching), 1)
