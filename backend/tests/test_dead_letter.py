import unittest
from unittest import mock

from jobs import dead_letter


class DeadLetterTests(unittest.TestCase):
    def test_remove_for_job_uses_atomic_redis_eval(self):
        client = mock.Mock()
        with mock.patch.object(dead_letter, "QUEUE_BACKEND", "redis"):
            with mock.patch("jobs.queue.get_redis_client", return_value=client):
                dead_letter.remove_dead_letter_entries_for_job("abc123")

        client.eval.assert_called_once_with(
            dead_letter._REMOVE_JOB_FROM_DLQ_LUA,
            1,
            dead_letter.redis_dead_letter_key(),
            "abc123",
            dead_letter.DLQ_MAX_ITEMS,
        )

    def test_remove_for_job_filters_inmemory_entries(self):
        original = list(dead_letter._dead_letter_records)
        try:
            dead_letter._dead_letter_records[:] = [
                {"job_id": "a", "reason": "x"},
                {"job_id": "b", "reason": "y"},
                {"job_id": "a", "reason": "z"},
            ]
            with mock.patch.object(dead_letter, "QUEUE_BACKEND", "inmemory"):
                dead_letter.remove_dead_letter_entries_for_job("a")

            self.assertEqual(dead_letter._dead_letter_records, [{"job_id": "b", "reason": "y"}])
        finally:
            dead_letter._dead_letter_records[:] = original


if __name__ == "__main__":
    unittest.main()
