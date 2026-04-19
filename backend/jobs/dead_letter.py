import json
import threading
from typing import Any

from config import DLQ_MAX_ITEMS, QUEUE_BACKEND, REDIS_KEY_PREFIX, logger

_dead_letter_lock = threading.Lock()
_dead_letter_records: list[dict[str, Any]] = []

_REMOVE_JOB_FROM_DLQ_LUA = """
local key = KEYS[1]
local job_id = ARGV[1]
local max_items = tonumber(ARGV[2])
local entries = redis.call("LRANGE", key, 0, -1)
if #entries == 0 then
  return 0
end

local removed = 0
redis.call("DEL", key)
for idx = #entries, 1, -1 do
  local raw = entries[idx]
  local keep = true
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == "table" and tostring(parsed["job_id"]) == job_id then
    keep = false
    removed = removed + 1
  end
  if keep then
    redis.call("LPUSH", key, raw)
  end
end

redis.call("LTRIM", key, 0, max_items - 1)
return removed
"""

def redis_dead_letter_key() -> str:
    return f"{REDIS_KEY_PREFIX}:jobs:dead_letter"

def get_dead_letter_count() -> int:
    if QUEUE_BACKEND == "redis":
        try:
            from jobs.queue import get_redis_client
            client = get_redis_client()
            return int(client.llen(redis_dead_letter_key()))
        except Exception as exc:
            logger.warning("Failed to get Redis dead-letter count: %s", exc)
            return 0

    with _dead_letter_lock:
        return len(_dead_letter_records)


def get_dead_letter_entries(limit: int = 50) -> list[dict[str, Any]]:
    bounded_limit = max(1, min(limit, 500))
    if QUEUE_BACKEND == "redis":
        from jobs.queue import get_redis_client
        client = get_redis_client()
        raw_entries = client.lrange(redis_dead_letter_key(), 0, bounded_limit - 1)
        entries: list[dict[str, Any]] = []
        for raw in raw_entries:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                entries.append(parsed)
        return entries

    with _dead_letter_lock:
        return [dict(entry) for entry in _dead_letter_records[:bounded_limit]]


def push_dead_letter_entry(entry: dict[str, Any]) -> None:
    if QUEUE_BACKEND == "redis":
        from jobs.queue import get_redis_client
        client = get_redis_client()
        pipeline = client.pipeline()
        pipeline.lpush(redis_dead_letter_key(), json.dumps(entry))
        pipeline.ltrim(redis_dead_letter_key(), 0, DLQ_MAX_ITEMS - 1)
        pipeline.execute()
        return

    with _dead_letter_lock:
        _dead_letter_records.insert(0, dict(entry))
        if len(_dead_letter_records) > DLQ_MAX_ITEMS:
            del _dead_letter_records[DLQ_MAX_ITEMS:]


def remove_dead_letter_entries_for_job(job_id: str) -> None:
    if QUEUE_BACKEND == "redis":
        from jobs.queue import get_redis_client
        client = get_redis_client()
        client.eval(
            _REMOVE_JOB_FROM_DLQ_LUA,
            1,
            redis_dead_letter_key(),
            job_id,
            DLQ_MAX_ITEMS,
        )
        return

    with _dead_letter_lock:
        _dead_letter_records[:] = [
            entry
            for entry in _dead_letter_records
            if str(entry.get("job_id")) != job_id
        ]
