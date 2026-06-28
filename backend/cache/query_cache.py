"""
In-memory LRU cache for frequent DuckDB queries.
Uses cachetools.TTLCache — no Redis dependency needed.
Decorators can wrap query functions for transparent caching.
"""
from cachetools import TTLCache
from backend.core.config import settings

# 200 entries, TTL = CACHE_TTL_HOURS converted to seconds
_query_cache: TTLCache = TTLCache(
    maxsize=200,
    ttl=settings.CACHE_TTL_HOURS * 3600,
)


def cache_get(key: str) -> dict | None:
    return _query_cache.get(key)


def cache_set(key: str, value: dict) -> None:
    _query_cache[key] = value


def cache_clear() -> None:
    _query_cache.clear()


def cache_stats() -> dict:
    return {
        "size": len(_query_cache),
        "maxsize": _query_cache.maxsize,
        "ttl_seconds": _query_cache.ttl,
    }
