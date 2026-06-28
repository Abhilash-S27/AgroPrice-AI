"""
backend/services/executive_briefing_engine.py

Autonomous executive briefing engine — Phase 4B Step 4.

Generates Bloomberg-terminal style intelligence items from cross-crop
CropIntelligence dicts. Fully deterministic — no Gemini calls.

The briefing is a priority-sorted list of BriefingItem dicts covering:
  - Critical alerts (CRITICAL priority crops)
  - Most unstable crop
  - Emerging recoveries
  - Confidence deterioration warnings
  - Momentum reversals
  - Accelerating bullish opportunities
  - Watch-closely items (HIGH_ATTENTION)
"""

from __future__ import annotations


def generate_executive_briefing(items: list[dict]) -> list[dict]:
    """
    Generate a priority-sorted briefing from cross-crop intelligence dicts.

    Args:
        items: List of dicts from build_crop_intelligence() — must have has_data=True.

    Returns:
        List of BriefingItem dicts: {category, headline, detail, severity, crop, state}
        Capped at 8 items.
    """
    active = [i for i in items if i.get("has_data")]
    if not active:
        return []

    briefing: list[dict] = []
    seen_crops: set[str] = set()

    def _add(category, headline, detail, severity, crop, state):
        briefing.append({
            "category": category,
            "headline": headline,
            "detail":   detail,
            "severity": severity,
            "crop":     crop,
            "state":    state,
        })
        seen_crops.add(crop)

    # ── CRITICAL alerts (highest priority) ───────────────────────────────────
    critical = sorted(
        [i for i in active if i.get("priority_level") == "CRITICAL"],
        key=lambda x: x.get("priority_score", 0),
        reverse=True,
    )
    for c in critical[:2]:
        _add(
            "top_development",
            f"🔴 CRITICAL: {c['crop']} ({c['state']}) — {c.get('regime_label', 'Volatile')}",
            c.get("synthesis", ""),
            "critical",
            c["crop"], c["state"],
        )

    # ── Most unstable (highest priority score not already added) ─────────────
    risky = sorted(active, key=lambda x: x.get("priority_score", 0), reverse=True)
    for r in risky:
        if r["crop"] not in seen_crops and r.get("priority_level") in {"CRITICAL", "HIGH_ATTENTION"}:
            _add(
                "instability",
                f"⚡ MOST UNSTABLE: {r['crop']} ({r['state']})",
                f"{r.get('regime_label', '')} · {r.get('dominant_signal', '')}",
                "warning",
                r["crop"], r["state"],
            )
            break

    # ── Emerging recovery ─────────────────────────────────────────────────────
    for r in active:
        if r.get("regime_name") == "RECOVERY_PHASE" and r["crop"] not in seen_crops:
            _add(
                "opportunity",
                f"📈 EMERGING RECOVERY: {r['crop']} ({r['state']})",
                r.get("synthesis", ""),
                "positive",
                r["crop"], r["state"],
            )
            break

    # ── Momentum reversal warning ─────────────────────────────────────────────
    for r in active:
        if r.get("reversal_risk") and r.get("temporal_direction") == "reversing" and r["crop"] not in seen_crops:
            _add(
                "watchlist",
                f"🔄 MOMENTUM REVERSAL: {r['crop']} ({r['state']})",
                r.get("temporal_label", "Direction flipped vs prior period"),
                "warning",
                r["crop"], r["state"],
            )
            break

    # ── Accelerating bullish opportunity ─────────────────────────────────────
    for b in active:
        if (
            b.get("regime_name") == "BULLISH_EXPANSION"
            and b.get("temporal_direction") == "accelerating"
            and b["crop"] not in seen_crops
        ):
            _add(
                "opportunity",
                f"🚀 ACCELERATING: {b['crop']} ({b['state']})",
                f"{b.get('regime_label', '')} with accelerating momentum — {b.get('velocity', 0):+.1f}%/wk",
                "positive",
                b["crop"], b["state"],
            )
            break

    # ── Seasonal peak run ─────────────────────────────────────────────────────
    for s in active:
        if s.get("regime_name") == "SEASONAL_PEAK_RUN" and s["crop"] not in seen_crops:
            _add(
                "opportunity",
                f"🌙 SEASONAL PEAK: {s['crop']} ({s['state']})",
                f"Peak season driving prices — {s.get('dominant_signal', '')}",
                "positive",
                s["crop"], s["state"],
            )
            break

    # ── Confidence deterioration warning ─────────────────────────────────────
    low_conf = [i for i in active if i.get("confidence_label") in {"low", "insufficient data"}]
    if low_conf:
        worst = min(low_conf, key=lambda x: x.get("confidence_score", 1.0))
        if worst["crop"] not in seen_crops:
            score_pct = round((worst.get("confidence_score") or 0) * 100)
            _add(
                "deterioration",
                f"⚠️ LOW CONFIDENCE: {worst['crop']} ({worst['state']})",
                f"Confidence {worst.get('confidence_label', 'low')} ({score_pct}%) — treat signals with caution.",
                "warning",
                worst["crop"], worst["state"],
            )

    # ── Watch-closely (HIGH_ATTENTION) ────────────────────────────────────────
    high_attn = [
        i for i in active
        if i.get("priority_level") == "HIGH_ATTENTION" and i["crop"] not in seen_crops
    ]
    if high_attn:
        top_h = sorted(high_attn, key=lambda x: x.get("priority_score", 0), reverse=True)[0]
        _add(
            "watchlist",
            f"👁️ WATCH CLOSELY: {top_h['crop']} ({top_h['state']})",
            top_h.get("synthesis", ""),
            "info",
            top_h["crop"], top_h["state"],
        )

    return briefing[:8]
