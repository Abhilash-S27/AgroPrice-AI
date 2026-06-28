"""
File-based cache for forecast results.
Stores JSON files in data/cache/ keyed by crop+state+days+model.
Avoids re-running expensive Prophet/XGBoost fits on every request.
"""
import hashlib
import json
from datetime import datetime, timedelta
from pathlib import Path

from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger(__name__)


def _cache_key(crop: str, state: str | None, days: int, model: str) -> str:
    raw = f"{crop}_{state or 'all'}_{days}_{model}".lower()
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _cache_path(key: str) -> Path:
    settings.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return settings.CACHE_DIR / f"forecast_{key}.json"


def get_cached_forecast(crop: str, state: str | None, days: int, model: str) -> dict | None:
    """Return cached forecast dict or None if missing/expired."""
    key = _cache_key(crop, state, days, model)
    path = _cache_path(key)

    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = datetime.fromisoformat(data["cached_at"])
        ttl = timedelta(hours=settings.CACHE_TTL_HOURS)
        if datetime.utcnow() - cached_at > ttl:
            path.unlink(missing_ok=True)
            logger.info("Forecast cache expired", crop=crop, state=state)
            return None
        logger.info("Forecast cache hit", crop=crop, state=state, model=model)
        return data["payload"]
    except (json.JSONDecodeError, KeyError, ValueError):
        path.unlink(missing_ok=True)
        return None


def save_forecast_cache(
    crop: str, state: str | None, days: int, model: str, payload: dict
) -> None:
    """Persist a forecast result to the file cache."""
    key = _cache_key(crop, state, days, model)
    path = _cache_path(key)
    data = {
        "cached_at": datetime.utcnow().isoformat(),
        "crop": crop,
        "state": state,
        "days": days,
        "model": model,
        "payload": payload,
    }
    path.write_text(json.dumps(data, default=str), encoding="utf-8")
    logger.info("Forecast cached", crop=crop, model=model, key=key)


def invalidate_cache(crop: str | None = None) -> int:
    """Delete cache files, optionally filtered by crop. Returns count deleted."""
    cache_dir = settings.CACHE_DIR
    if not cache_dir.exists():
        return 0
    deleted = 0
    for f in cache_dir.glob("forecast_*.json"):
        if crop is None or crop.lower() in f.read_text().lower():
            f.unlink()
            deleted += 1
    return deleted
