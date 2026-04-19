import unittest
from unittest import mock

from jobs import queue


class QueueMutationTests(unittest.TestCase):
    def test_mutate_job_record_updates_inmemory_atomically(self):
        original_records = dict(queue._job_records)
        try:
            queue._job_records.clear()
            queue._job_records["job-1"] = {
                "job_id": "job-1",
                "state": "queued",
                "attempts": 0,
            }

            def _mutator(record: dict):
                record["state"] = "running"
                record["attempts"] = int(record["attempts"]) + 1

            with mock.patch.object(queue, "QUEUE_BACKEND", "inmemory"):
                updated = queue.mutate_job_record("job-1", _mutator)

            self.assertIsNotNone(updated)
            self.assertEqual(updated["state"], "running")
            self.assertEqual(updated["attempts"], 1)
            self.assertEqual(queue._job_records["job-1"]["state"], "running")
            self.assertEqual(queue._job_records["job-1"]["attempts"], 1)
        finally:
            queue._job_records.clear()
            queue._job_records.update(original_records)


if __name__ == "__main__":
    unittest.main()
