"""
backend/api/routes/intelligence.py

Autonomous Intelligence endpoints — Phase 4B.

GET /api/intelligence/monitor
    Cross-crop autonomous market monitor: priority scores, regimes, escalations,
    executive briefing. All deterministic — no Gemini calls.

GET /api/intelligence/compare/{crop}/{state}
    Strategic comparison: safer / stronger-momentum / seasonal alternatives
    for a reference crop, drawn from Tier-1 peers.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# ── Internal helpers ───────────────────────────────────────────────────────────

def _run_crop_intelligence(crop: str, state: str) -> dict | None:
    """Synchronous — run full intelligence pipeline for one crop. Safe for to_thread."""
    try:
        from backend.services.ai_forecast_narrator import build_insight_context
        from backend.services.agents.market_briefing_agent import run_briefing
        from backend.services.market_monitor import build_crop_intelligence

        raw_ctx  = build_insight_context(crop, state, days=90)
        if not raw_ctx.get("has_data"):
            return None
        briefing = run_briefing(raw_ctx)
        return build_crop_intelligence(crop, state, briefing, raw_ctx)
    except Exception as exc:
        logger.debug("intelligence_fail crop=%s state=%s: %s", crop, state, exc)
        return None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/monitor")
async def get_monitor(max_crops: int = 8) -> dict:
    """
    Autonomous cross-crop market monitor.

    Runs the full 4-agent + intelligence pipeline across Tier-1 crops in
    parallel and returns a priority-sorted intelligence report with an
    autonomous executive briefing.
    """
    from backend.data.analytics import TIER1_HOME_STATE
    from backend.services.executive_briefing_engine import generate_executive_briefing

    targets = list(TIER1_HOME_STATE.items())[:max_crops]
    tasks   = [asyncio.to_thread(_run_crop_intelligence, crop, state) for crop, state in targets]
    results = await asyncio.gather(*tasks)

    items = [r for r in results if r and r.get("has_data")]
    items.sort(key=lambda x: x.get("priority_score", 0), reverse=True)

    briefing_items = generate_executive_briefing(items)

    # Summary counts
    critical     = sum(1 for i in items if i.get("priority_level") == "CRITICAL")
    high_attn    = sum(1 for i in items if i.get("priority_level") == "HIGH_ATTENTION")
    watch_count  = sum(1 for i in items if i.get("priority_level") == "WATCH")
    total_esc    = sum(len(i.get("escalations") or []) for i in items)
    reversals    = sum(1 for i in items if i.get("reversal_risk"))

    # Regime distribution
    regime_counts: dict[str, int] = {}
    for item in items:
        rn = item.get("regime_name", "TRANSITIONAL")
        regime_counts[rn] = regime_counts.get(rn, 0) + 1

    return {
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "crops_scanned":     len(items),
        "critical_alerts":   critical,
        "high_attention":    high_attn,
        "watch":             watch_count,
        "total_escalations": total_esc,
        "reversal_risks":    reversals,
        "regime_distribution": regime_counts,
        "items":             items,
        "executive_briefing": briefing_items,
    }


@router.get("/compare/{crop}/{state}")
async def compare_crop(crop: str, state: str) -> dict:
    """
    Strategic comparison — find safer, stronger-momentum, or seasonal alternatives.
    """
    from backend.data.analytics import TIER1_HOME_STATE
    from backend.utils.validators import validate_crop, validate_state

    try:
        crop  = validate_crop(crop)
        state = validate_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Run intelligence for all Tier-1 peers (excluding the reference crop)
    peers   = [(c, s) for c, s in TIER1_HOME_STATE.items() if c != crop][:8]
    tasks   = [asyncio.to_thread(_run_crop_intelligence, c, s) for c, s in peers]
    results = await asyncio.gather(*tasks)

    all_peers = [r for r in results if r and r.get("has_data")]

    _BULLISH = {"STRONG_BULLISH", "BULLISH", "MILD_BULLISH"}
    _LOW     = {"LOW_RISK", "MODERATE_RISK"}
    _PEAK    = {"DEEP_PEAK", "PEAK_SEASON"}

    safer    = [i for i in all_peers if i.get("risk_verdict") in _LOW     and i.get("priority_level") in {"STABLE", "WATCH"}]
    stronger = [i for i in all_peers if i.get("trend_verdict") in _BULLISH and i.get("priority_level") != "CRITICAL"]
    seasonal = [i for i in all_peers if i.get("seasonal_verdict") in _PEAK]

    def _entry(d: dict) -> dict:
        return {
            "crop":               d["crop"],
            "state":              d["state"],
            "regime":             d.get("regime_label", ""),
            "regime_icon":        d.get("regime_icon", ""),
            "priority":           d.get("priority_level", ""),
            "recommendation":     d.get("recommendation", ""),
            "synthesis":          d.get("synthesis", ""),
            "opportunity_score":  d.get("opportunity_score", 0.0),
            "confidence_label":   d.get("confidence_label", ""),
        }

    return {
        "reference_crop":          crop,
        "reference_state":         state,
        "safer_alternatives":      [_entry(i) for i in sorted(safer,    key=lambda x: x.get("confidence_score", 0), reverse=True)[:3]],
        "stronger_momentum":       [_entry(i) for i in sorted(stronger, key=lambda x: x.get("opportunity_score", 0), reverse=True)[:3]],
        "seasonal_outperformers":  [_entry(i) for i in sorted(seasonal, key=lambda x: x.get("opportunity_score", 0), reverse=True)[:3]],
        "generated_at":            datetime.now(timezone.utc).isoformat(),
    }
