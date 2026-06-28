"""
backend/services/llm/prompt_builder.py

Constructs fully-grounded, structured prompts for Gemini.

CRITICAL ARCHITECTURE RULE:
  This module NEVER invents agricultural data. Every numeric value passed to the
  prompt must originate from the deterministic engine (forecasting, analytics,
  DuckDB queries). Gemini's role is to reason ABOUT those values, not to create them.

  Data flow:
    DuckDB / ML engine → PromptContext → build_grounded_prompt() → Gemini
                                    ↑
               deterministic truth source (prices, forecasts, confidence, volatility)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── System identity — analyst-grade, precise role definition ──────────────────
_SYSTEM_IDENTITY = """\
You are AgroPrice AI, a professional agricultural commodity intelligence advisor
specialising in South Indian crop markets across Tamil Nadu, Karnataka,
Andhra Pradesh, Kerala, and Telangana.

Your knowledge is grounded in AGMARKNET price data (2015–2026), ML forecasting
(Prophet + XGBoost), and deterministic analytics (volatility, momentum, seasonality,
anomaly detection). You reason ABOUT injected facts — you never invent them.

HARD CONSTRAINTS (never violate):
- You ONLY discuss agricultural markets, crop prices, farming strategy, seasonal
  patterns, and supply/demand dynamics for South Indian crops.
- You NEVER invent price figures, forecasts, volatility measures, or confidence
  scores. All such metrics are provided as grounded facts in this prompt.
- You ALWAYS cite the data category when referencing a metric
  (e.g., "The ML forecast shows…", "AGMARKNET data indicates…").
- You NEVER speculate about non-agricultural topics.
- Price unit default: ₹/quintal unless specified otherwise.
- When signals conflict, acknowledge the contradiction explicitly — do not suppress it.
- When confidence is low or data is sparse, say so honestly rather than projecting
  false certainty.
"""

# ── Response style (appended after question) ───────────────────────────────────
_RESPONSE_STYLE = """\
RESPONSE FORMAT RULES:
- Lead with the single most actionable insight or answer.
- Use bullet points for multi-item analysis. Keep each bullet focused.
- End with a clear recommendation or decision guidance where data supports it.
- Reference injected metrics explicitly (prices, CV, forecast values) — do not
  rephrase them vaguely.
- Avoid generic LLM filler phrases ("Great question!", "It's important to note").
- Never pad with agricultural disclaimers that add no information.
- Use ₹ for Indian Rupees, not "INR" or "Rs." in running text.
"""


@dataclass
class PromptContext:
    """
    Container for all grounded data injected into the prompt.

    All fields are Optional — the prompt builder degrades gracefully when only
    partial context is available (e.g., no forecast yet for a new crop/state).

    IMPORTANT: Populate these fields ONLY from deterministic data sources.
    Never construct a PromptContext with guessed or placeholder values.
    """

    # ── Crop / market identity ─────────────────────────────────────────────────
    crop: Optional[str] = None
    state: Optional[str] = None
    market: Optional[str] = None           # specific mandi/APMC name

    # ── Retrieved price metrics (from DuckDB / analytics engine) ──────────────
    current_modal_price: Optional[float] = None   # ₹/quintal
    price_min_30d: Optional[float] = None
    price_max_30d: Optional[float] = None
    price_trend: Optional[str] = None             # "rising" | "falling" | "stable"
    price_change_pct: Optional[float] = None      # % change over period

    # ── Forecast intelligence (from ML engine — Prophet / XGBoost) ────────────
    forecast_7d: Optional[float] = None
    forecast_30d: Optional[float] = None
    forecast_90d: Optional[float] = None
    forecast_trend_label: Optional[str] = None    # "bullish" | "bearish" | "neutral"

    # ── Confidence & reliability (from evaluation engine + confidence_engine) ──
    confidence_score: Optional[float] = None      # 0.0 – 1.0
    confidence_label: Optional[str] = None        # "high" | "medium" | "low"
    data_quality_note: Optional[str] = None       # e.g., "sparse data for this mandi"
    confidence_narrative: Optional[str] = None    # Phase 4A — synthesized one-liner
    confidence_contributors: Optional[list[str]] = None   # boosters
    confidence_detractors: Optional[list[str]] = None     # reducers

    # ── Seasonal intelligence ──────────────────────────────────────────────────
    seasonal_pattern: Optional[str] = None        # e.g., "peak harvest: Oct–Nov"
    current_season: Optional[str] = None          # "kharif" | "rabi" | "zaid"
    monsoon_outlook: Optional[str] = None

    # ── Anomaly / volatility flags ─────────────────────────────────────────────
    volatility_label: Optional[str] = None        # "high" | "moderate" | "low"
    anomaly_detected: bool = False
    anomaly_description: Optional[str] = None

    # ── Historical intelligence (from AGMARKNET retrieval — never invented) ────
    historical_summary: Optional[str] = None

    # ── Persona & analyst framing (Phase 4A) ──────────────────────────────────
    persona_section: Optional[str] = None         # pre-built from analyst_persona.py

    # ── Correlation signals (Phase 4A — from correlation_engine.py) ───────────
    correlation_signals: Optional[list[str]] = None  # confirming / contradicting signals

    # ── Topic context (Phase 4A — enriched memory context) ────────────────────
    topic_context: Optional[str] = None           # recent topic chain from memory

    # ── Extra context (free-form, structured as key-value) ────────────────────
    additional_facts: dict[str, str] = field(default_factory=dict)


def build_grounded_prompt(
    user_question: str,
    context: Optional[PromptContext] = None,
) -> str:
    """
    Assemble a complete, grounded prompt for Gemini.

    Section order (Phase 4A — analyst cognition flow):
      1.  Persona framing          ← audience-specific instructions
      2.  System identity          ← hard constraints
      3.  Retrieved market metrics ← deterministic truth
      4.  Forecast intelligence    ← deterministic truth
      5.  Correlation signals      ← confirming / contradicting patterns (Phase 4A)
      6.  Seasonal intelligence    ← deterministic truth
      7.  Confidence & reliability ← synthesized from multiple signals (Phase 4A)
      8.  Anomaly flags            ← deterministic truth
      9.  Historical intelligence  ← from AGMARKNET retrieval
      10. Topic context            ← enriched conversation memory (Phase 4A)
      11. Additional facts         ← agent signals, conversation history
      12. User question
      13. Response style rules

    Args:
        user_question: The sanitized, validated question from the user.
        context:       Grounded data from the deterministic engine. If None,
                       Gemini answers from general agricultural knowledge only.

    Returns:
        A formatted string ready to send to GeminiProvider.generate().
    """
    sections: list[str] = []

    # Persona first — sets audience framing before any data
    if context and context.persona_section:
        sections.append(context.persona_section.strip())

    sections.extend([_SYSTEM_IDENTITY, "---"])

    if context is None:
        sections.append(
            "MARKET DATA: No live market data is available for this query. "
            "Answer from general South Indian agricultural knowledge and clearly "
            "state that you are not referencing live prices or forecasts."
        )
    else:
        _add_if(sections, _build_market_section(context))
        _add_if(sections, _build_forecast_section(context))
        _add_if(sections, _build_correlation_section(context))
        _add_if(sections, _build_seasonal_section(context))
        _add_if(sections, _build_confidence_section(context))
        _add_if(sections, _build_anomaly_section(context))
        if context.historical_summary:
            _add_if(sections, _build_historical_section(context))
        if context.topic_context:
            _add_if(sections, _build_topic_context_section(context))
        if context.additional_facts:
            _add_if(sections, _build_additional_facts(context.additional_facts))

    sections.append("---")
    sections.append(f"USER QUESTION: {user_question}")
    sections.append("---")
    sections.append(_RESPONSE_STYLE)

    return "\n\n".join(s for s in sections if s and s.strip())


# ── Section builders ───────────────────────────────────────────────────────────

def _add_if(sections: list[str], text: str) -> None:
    if text and text.strip():
        sections.append(text)


def _build_market_section(ctx: PromptContext) -> str:
    if not any([ctx.crop, ctx.current_modal_price, ctx.price_trend]):
        return ""

    lines = ["RETRIEVED MARKET METRICS (live, deterministic — do not alter):"]
    if ctx.crop:
        loc = " | ".join(filter(None, [ctx.state, ctx.market]))
        lines.append(f"  Commodity: {ctx.crop}" + (f"  |  Location: {loc}" if loc else ""))
    if ctx.current_modal_price is not None:
        lines.append(f"  Current modal price : ₹{ctx.current_modal_price:,.0f}/quintal")
    if ctx.price_min_30d is not None and ctx.price_max_30d is not None:
        lines.append(f"  30-day range        : ₹{ctx.price_min_30d:,.0f} – ₹{ctx.price_max_30d:,.0f}/quintal")
    if ctx.price_trend:
        change = f" ({ctx.price_change_pct:+.1f}%)" if ctx.price_change_pct is not None else ""
        lines.append(f"  Price trend         : {ctx.price_trend}{change}")
    return "\n".join(lines)


def _build_forecast_section(ctx: PromptContext) -> str:
    if not any([ctx.forecast_7d, ctx.forecast_30d, ctx.forecast_90d]):
        return ""

    lines = ["FORECAST INTELLIGENCE (ML engine output — do not alter):"]
    if ctx.forecast_7d is not None:
        lines.append(f"  7-day forecast  : ₹{ctx.forecast_7d:,.0f}/quintal")
    if ctx.forecast_30d is not None:
        lines.append(f"  30-day forecast : ₹{ctx.forecast_30d:,.0f}/quintal")
    if ctx.forecast_90d is not None:
        lines.append(f"  90-day forecast : ₹{ctx.forecast_90d:,.0f}/quintal")
    if ctx.forecast_trend_label:
        lines.append(f"  Outlook label   : {ctx.forecast_trend_label}")
    return "\n".join(lines)


def _build_correlation_section(ctx: PromptContext) -> str:
    if not ctx.correlation_signals:
        return ""
    lines = ["MARKET SIGNAL CORRELATIONS (detected by analytics engine — reason about these):"]
    for sig in ctx.correlation_signals:
        lines.append(f"  • {sig}")
    return "\n".join(lines)


def _build_seasonal_section(ctx: PromptContext) -> str:
    if not any([ctx.seasonal_pattern, ctx.current_season, ctx.monsoon_outlook]):
        return ""

    lines = ["SEASONAL INTELLIGENCE:"]
    if ctx.current_season:
        lines.append(f"  Current season   : {ctx.current_season}")
    if ctx.seasonal_pattern:
        lines.append(f"  Seasonal pattern : {ctx.seasonal_pattern}")
    if ctx.monsoon_outlook:
        lines.append(f"  Monsoon outlook  : {ctx.monsoon_outlook}")
    return "\n".join(lines)


def _build_confidence_section(ctx: PromptContext) -> str:
    has_basic    = ctx.confidence_score is not None or bool(ctx.confidence_label)
    has_extended = bool(ctx.confidence_narrative)
    if not has_basic and not has_extended:
        return ""

    lines = ["CONFIDENCE & DATA QUALITY:"]
    if ctx.confidence_score is not None:
        lines.append(f"  Composite confidence : {ctx.confidence_score:.0%}")
    if ctx.confidence_label:
        lines.append(f"  Confidence level     : {ctx.confidence_label}")
    if ctx.confidence_narrative:
        lines.append(f"  Assessment           : {ctx.confidence_narrative}")
    if ctx.confidence_contributors:
        lines.append(f"  Supporting factors   : {'; '.join(ctx.confidence_contributors[:3])}")
    if ctx.confidence_detractors:
        lines.append(f"  Limiting factors     : {'; '.join(ctx.confidence_detractors[:2])}")
    if ctx.data_quality_note:
        lines.append(f"  Note                 : {ctx.data_quality_note}")
    return "\n".join(lines)


def _build_anomaly_section(ctx: PromptContext) -> str:
    if not ctx.anomaly_detected:
        return ""

    lines = ["ANOMALY FLAG:"]
    lines.append("  An unusual price movement has been detected by the anomaly engine.")
    if ctx.volatility_label:
        lines.append(f"  Volatility : {ctx.volatility_label}")
    if ctx.anomaly_description:
        lines.append(f"  Details    : {ctx.anomaly_description}")
    return "\n".join(lines)


def _build_historical_section(ctx: PromptContext) -> str:
    if not ctx.historical_summary:
        return ""
    return (
        "HISTORICAL MARKET DATA (retrieved from AGMARKNET database — do not alter or invent values):\n"
        + ctx.historical_summary
    )


def _build_topic_context_section(ctx: PromptContext) -> str:
    if not ctx.topic_context:
        return ""
    return f"CONVERSATION CONTEXT:\n{ctx.topic_context}"


def _build_additional_facts(facts: dict[str, str]) -> str:
    lines = ["ADDITIONAL CONTEXT:"]
    for key, value in facts.items():
        lines.append(f"  {key}: {value}")
    return "\n".join(lines)
