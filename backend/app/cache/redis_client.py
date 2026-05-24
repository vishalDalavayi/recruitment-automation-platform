"""
Redis Cache Client
===================
Lazy-initialized Redis with in-memory fallback.
"""

import time
import json
import logging
from typing import Optional, Any
from app.config import get_settings

logger = logging.getLogger("KonfigAI")

_redis_client = None
_redis_init_attempted = False


def get_redis():
    """Lazy-init Redis. Returns None if unavailable (graceful degradation)."""
    global _redis_client, _redis_init_attempted
    if _redis_init_attempted:
        return _redis_client
    _redis_init_attempted = True

    settings = get_settings()
    if settings.redis_url:
        try:
            import redis
            _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            _redis_client.ping()
            logger.info("Redis connected successfully.")
        except Exception as e:
            logger.warning(f"Redis unavailable, using in-memory cache: {e}")
            _redis_client = None
    return _redis_client


class CacheManager:
    """
    Unified caching layer. Uses Redis if available, in-memory dict as fallback.
    """

    def __init__(self):
        self._memory: dict = {}

    def get(self, key: str) -> Optional[Any]:
        r = get_redis()
        if r:
            try:
                val = r.get(key)
                return json.loads(val) if val else None
            except Exception:
                pass

        entry = self._memory.get(key)
        if entry and time.time() < entry["expires"]:
            return entry["data"]
        return None

    def set(self, key: str, value: Any, ttl: int = 30):
        r = get_redis()
        if r:
            try:
                r.setex(key, ttl, json.dumps(value, default=str))
                return
            except Exception:
                pass

        self._memory[key] = {"data": value, "expires": time.time() + ttl}

    def delete(self, key: str):
        r = get_redis()
        if r:
            try:
                r.delete(key)
            except Exception:
                pass
        self._memory.pop(key, None)

    def delete_pattern(self, pattern: str):
        """Delete all keys matching a pattern (e.g. 'candidates:*')."""
        r = get_redis()
        if r:
            try:
                keys = r.keys(pattern)
                if keys:
                    r.delete(*keys)
            except Exception:
                pass
        # Memory cache doesn't easily support pattern matching without iterating
        keys_to_del = [k for k in self._memory.keys() if pattern.replace('*', '') in k]
        for k in keys_to_del:
            self._memory.pop(k, None)


# Singleton
cache = CacheManager()
