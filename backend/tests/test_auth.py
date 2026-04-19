import time
import types
import unittest
from unittest import mock

import auth


class AuthRateLimitTests(unittest.TestCase):
    def test_rate_limit_evicts_stale_bucket_keys(self):
        request = types.SimpleNamespace(
            headers={},
            client=types.SimpleNamespace(host="127.0.0.1"),
        )
        now = time.time()
        stale_bucket = "/predict:10.0.0.5"
        active_bucket = "/predict:127.0.0.1"
        original_buckets = dict(auth._rate_limit_buckets)
        try:
            auth._rate_limit_buckets.clear()
            auth._rate_limit_buckets[stale_bucket] = [now - 999]
            auth._rate_limit_buckets[active_bucket] = [now - 1]

            with mock.patch.object(auth, "RATE_LIMIT_ENABLED", True):
                with mock.patch.object(auth, "RATE_LIMIT_WINDOW_SECONDS", 60):
                    with mock.patch.object(auth, "RATE_LIMIT_MAX_REQUESTS", 5):
                        with mock.patch.object(auth, "RATE_LIMIT_TRUST_X_FORWARDED_FOR", False):
                            auth.enforce_rate_limit(request, route_tag="/predict", request_id="req1")

            self.assertNotIn(stale_bucket, auth._rate_limit_buckets)
            self.assertIn(active_bucket, auth._rate_limit_buckets)
        finally:
            auth._rate_limit_buckets.clear()
            auth._rate_limit_buckets.update(original_buckets)


if __name__ == "__main__":
    unittest.main()
