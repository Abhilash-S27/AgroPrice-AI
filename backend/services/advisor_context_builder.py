"""
backend/services/advisor_context_builder.py

Builds a grounded PromptContext by delegating to the existing deterministic
analytics pipeline.  This module is the ONLY bridge between raw analytics data
and the LLM layer.

Design rule (enforced here):
  Every numeric value placed into PromptContext MUST come from the
  deterministic analytics engine — never guessed, interpolated, or invented.
  If a value is unavailable, the corresponding PromptContext field stays None.

Data flow:
  build_insight_context()  ← ai_forecast_narrator.py (one pass over DuckDB)
       ↓
  volatility / momentum / seasonal / anomaly / tier / quality (all computed)
       ↓
  get_cached_forecast()    ← cache/forecast_cache.py  (7d / 30d / 90d prices)
       ↓
  PromptContext dataclass  ← returned to AdvisorAIRouter
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Optional

from backend.cache.forecast_cache import get_cached_forecast
from backend.services.ai_forecast_narrator import build_insight_context
from backend.services.llm.prompt_builder import PromptContext

logger = logging.getLogger(__name__)


# ── Season inference ──────────────────────────────────────────────────────────

def _current_season() -> str:
    """Map calendar month to Indian agricultural season."""
    m = date.today().month
    if m in (6, 7, 8, 9, 10):
        return "kharif (Jun-Oct)"
    if m in (11, 12, 1, 2, 3):
        return "rabi (Nov-Mar)"
    return "zaid (Apr-May)"


def _format_seasonal(seas: dict) -> Optional[str]:
    """Compact seasonal summary: 'peak: Oct, Nov, Dec; lean: Mar, Apr, May'."""
    if not seas or seas.get("error"):
        return None
    peak   = ", ".join(seas.get("peak_months",   [])[:3])
    trough = ", ".join(seas.get("trough_months", [])[:3])
    parts  = []
    if peak:
        parts.append(f"peak: {peak}")
    if trough:
        parts.append(f"lean: {trough}")
    return "; ".join(parts) if parts else None


def _extract_forecast(cached: dict, days: int) -> Optional[float]:
    """Safe extraction of the predicted price at `days` index from a cached forecast."""
    try:
        points = cached.get("forecast", [])
        idx    = days - 1
        if idx < len(points):
            return float(points[idx]["predicted_price"])
    except (TypeError, KeyError, ValueError):
        pass
    return None


# ── Main context builder ──────────────────────────────────────────────────────

class AdvisorContextBuilder:
    """
    Assembles a populated PromptContext for a given crop+state pair.

    Usage:
        builder = AdvisorContextBuilder()
        ctx = await builder.build("Tomato", "Karnataka")
    """

    async def build_with_raw(
        self,
        crop: str,
        state: str,
        include_forecast: bool = True,
    ) -> tuple[PromptContext, dict]:
        """
        Like build(), but also returns the raw insight_context dict so callers
        (e.g. advisor_ai_router) can pass it to the agent framework without a
        second DuckDB query.

        Returns: (PromptContext, raw_insight_context)
        """
        try:
            insight = await asyncio.to_thread(build_insight_context, crop, state, 90)
        except Exception as exc:
            logger.error("build_insight_context failed: %s", exc)
            fallback = PromptContext(
                crop=crop, state=state,
                data_quality_note="Analytics engine temporarily unavailable.",
            )
            return fallback, {"has_data": False, "crop": crop, "state": state}

        prompt_ctx = await self._build_from_insight(insight, crop, state, include_forecast)
        return prompt_ctx, insight

    async def build(
        self,
        crop: str,
        state: str,
        include_forecast: bool = True,
    ) -> PromptContext:
        """
        Fetch all grounded metrics and return a fully populated PromptContext.

        Runs the synchronous DuckDB / pandas pipeline in a thread pool so
        FastAPI's event loop remains non-blocking.

        Args:
            crop:             Canonical crop name (validated upstream).
            state:            State name.
            include_forecast: Whether to attempt a cached forecast lookup.

        Returns:
            PromptContext with all available fields filled from real data.
            Any unavailable field stays None — never invented.
        """
        try:
            insight = await asyncio.to_thread(build_insight_context, crop, state, 90)
        except Exception as exc:
            logger.error("build_insight_context failed: %s", exc)
            return PromptContext(
                crop=crop, state=state,
                data_quality_note="Analytics engine temporarily unavailable.",
            )
        return await self._build_from_insight(insight, crop, state, include_forecast)

    async def _build_from_insight(
        self,
        insight: dict,
        crop: str,
        state: str,
        include_forecast: bool = True,
    ) -> PromptContext:
        """Shared builder used by both build() and build_with_raw()."""
        if not insight.get("has_data"):
            return PromptContext(
                crop=crop, state=state,
                data_quality_note=(
                    f"No historical price data found for {crop} in {state}. "
                    "General agricultural knowledge will be used."
                ),
            )

        vol       = insight.get("volatility") or {}
        mom       = insight.get("momentum")   or {}
        seas      = insight.get("seasonal")   or {}
        tier      = insight.get("tier")       or {}
        qual      = insight.get("quality")    or {}
        anomalies = insight.get("anomalies")  or []

        # ── Price metrics ──────────────────────────────────────────────────
        last_price    = insight.get("last_price")    or 0.0
        avg_30d       = insight.get("avg_30d")       or 0.0
        avg_365d      = insight.get("avg_365d")      or 0.0
        price_min_30d = insight.get("price_min_30d")
        price_max_30d = insight.get("price_max_30d")
        price_vs_year = insight.get("price_vs_year", 0.0)
        mom_score     = mom.get("score", 0.0)

        trend_label = (
            "rising"  if mom_score >  3 else
            "falling" if mom_score < -3 else
            "stable"
        )

        # ── Forecast (from cache only — never compute inline) ──────────────
        f7 = f30 = f90 = None
        forecast_trend = None
        if include_forecast and tier.get("forecast_eligible"):
            for model_name in ("prophet", "sparse_trend"):
                cached = get_cached_forecast(crop, state, 90, model_name)
                if cached:
                    f7   = _extract_forecast(cached, 7)
                    f30  = _extract_forecast(cached, 30)
                    f90  = _extract_forecast(cached, 90)
                    forecast_trend = tier.get("readiness")
                    break

        # ── Confidence ────────────────────────────────────────────────────
        quality_score = qual.get("score", 0)
        conf_score    = quality_score / 100.0 if quality_score else None
        conf_label    = qual.get("reliability")

        # ── Anomaly summary ───────────────────────────────────────────────
        top_anomaly   = anomalies[0] if anomalies else None
        anomaly_desc  = None
        if top_anomaly:
            direction   = "Spike" if top_anomaly.get("event_type") == "spike" else "Crash"
            pct         = top_anomaly.get("pct_deviation", 0)
            anomaly_desc = (
                f"{direction} of {pct:+.1f}% detected on {top_anomaly.get('date', 'N/A')} "
                f"(z-score={top_anomaly.get('z_score', 0):.1f}, "
                f"severity={top_anomaly.get('severity', 'unknown')})"
            )

        # ── Additional structured facts ───────────────────────────────────
        additional: dict[str, str] = {
            "volatility_cv":    f"{vol.get('cv', 0):.1f}% ({vol.get('badge', 'N/A')})",
            "momentum_signal":  f"{mom.get('signal', 'N/A')} (score {mom_score:+.1f}%)",
            "avg_30d_price":    f"{avg_30d:.0f}",
            "avg_1yr_price":    f"{avg_365d:.0f}",
            "price_vs_1yr_avg": f"{price_vs_year:+.1f}%",
            "data_tier":        f"Tier {tier.get('tier', 'D')} — {tier.get('method', 'N/A')}",
            "training_days":    str(tier.get("training_days", 0)),
        }
        if anomalies:
            additional["anomaly_count_90d"] = str(len(anomalies))

        data_note = (
            f"Tier {tier.get('tier', 'D')}: {tier.get('method', 'insufficient data')}. "
            f"Training data: {tier.get('training_days', 0)} days."
        )

        return PromptContext(
            crop=crop,
            state=state,
            current_modal_price=float(last_price) if last_price else None,
            price_min_30d=float(price_min_30d) if price_min_30d is not None else None,
            price_max_30d=float(price_max_30d) if price_max_30d is not None else None,
            price_trend=trend_label,
            price_change_pct=price_vs_year,
            forecast_7d=f7,
            forecast_30d=f30,
            forecast_90d=f90,
            forecast_trend_label=forecast_trend,
            confidence_score=conf_score,
            confidence_label=conf_label,
            data_quality_note=data_note,
            current_season=_current_season(),
            seasonal_pattern=_format_seasonal(seas),
            volatility_label=vol.get("level"),
            anomaly_detected=bool(anomalies),
            anomaly_description=anomaly_desc,
            additional_facts=additional,
        )


# Module-level singleton
advisor_context_builder = AdvisorContextBuilder()
