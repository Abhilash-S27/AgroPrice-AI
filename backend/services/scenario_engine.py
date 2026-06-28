"""
backend/services/scenario_engine.py

Heuristic "what-if" scenario simulation for South Indian agricultural markets.

IMPORTANT HONESTY RULE:
  This engine uses heuristic multipliers derived from agricultural economics
  principles and historical volatility patterns. It does NOT have a causal model.
  All outputs are prefixed with confidence labels and explicitly state uncertainty.
  Never claim scientific precision.

Supported scenario types (auto-detected from free text):
  - rainfall_decrease / drought
  - rainfall_increase / flood
  - supply_increase / bumper_crop
  - supply_decrease / crop_loss
  - transport_cost_rise
  - demand_spike / festive_demand
  - market_disruption / market_closure
  - export_restriction
  - generic (any other)
"""
from __future__ import annotations

import re
from typing import Any, Optional


# ── Scenario templates ────────────────────────────────────────────────────────
# Each template defines baseline impact multipliers.
# Actual impact is scaled by crop volatility and stated magnitude.

_TEMPLATES: dict[str, dict] = {
    "rainfall_decrease": {
        "price_direction":       "up",
        "base_impact_pct":       15.0,
        "volatility_multiplier": 1.40,
        "risk_change":           "increases",
        "supply_effect":         "decreases",
        "keywords":              ["rainfall decrease", "drought", "less rain", "dry spell",
                                  "water shortage", "low rainfall", "poor monsoon"],
        "rationale": (
            "Reduced rainfall typically lowers crop yield, especially for water-intensive "
            "vegetables. Supply contraction historically drives prices up 10–25%."
        ),
    },
    "rainfall_increase": {
        "price_direction":       "down",
        "base_impact_pct":       -10.0,
        "volatility_multiplier": 1.20,
        "risk_change":           "varies",
        "supply_effect":         "increases (initially)",
        "keywords":              ["rainfall increase", "heavy rain", "flood", "excess rain",
                                  "good monsoon", "bumper rain"],
        "rationale": (
            "Above-normal rainfall often boosts short-term supply but can damage crops "
            "if excessive. Net effect is typically a mild price decrease unless flooding occurs."
        ),
    },
    "supply_increase": {
        "price_direction":       "down",
        "base_impact_pct":       -12.0,
        "volatility_multiplier": 1.25,
        "risk_change":           "decreases",
        "supply_effect":         "increases",
        "keywords":              ["supply increase", "supply glut", "bumper crop", "bumper harvest",
                                  "high production", "more supply", "oversupply", "glut",
                                  "large harvest", "record harvest", "record crop",
                                  "abundant supply", "excess supply", "excess production"],
        "rationale": (
            "Supply surpluses create downward price pressure. South Indian markets are "
            "price-elastic for major vegetables — a 10% supply increase typically reduces "
            "prices by 12–18%."
        ),
    },
    "supply_decrease": {
        "price_direction":       "up",
        "base_impact_pct":       18.0,
        "volatility_multiplier": 1.50,
        "risk_change":           "increases significantly",
        "supply_effect":         "decreases",
        "keywords":              ["supply decrease", "crop loss", "crop failure", "pest attack",
                                  "disease outbreak", "low production", "shortage"],
        "rationale": (
            "Supply shortfalls cause disproportionate price surges in perishable commodities. "
            "Historical data shows a 10% supply shortfall can increase prices by 15–25%."
        ),
    },
    "transport_cost_rise": {
        "price_direction":       "up",
        "base_impact_pct":       6.0,
        "volatility_multiplier": 1.15,
        "risk_change":           "slightly increases",
        "supply_effect":         "unchanged",
        "keywords":              ["transport", "logistics", "fuel price", "freight",
                                  "truck fare", "transport cost"],
        "rationale": (
            "Higher transport costs are partially passed to end prices. "
            "Impact is typically 5–10% for major South Indian markets with good connectivity."
        ),
    },
    "demand_spike": {
        "price_direction":       "up",
        "base_impact_pct":       10.0,
        "volatility_multiplier": 1.30,
        "risk_change":           "increases temporarily",
        "supply_effect":         "unchanged",
        "keywords":              ["demand spike", "festive demand", "high demand",
                                  "festival", "export demand", "market demand"],
        "rationale": (
            "Demand spikes — especially during festivals or export surges — "
            "can push prices up 8–15% temporarily. Effect typically normalizes within 2–4 weeks."
        ),
    },
    "market_disruption": {
        "price_direction":       "up",
        "base_impact_pct":       12.0,
        "volatility_multiplier": 1.60,
        "risk_change":           "increases significantly",
        "supply_effect":         "restricted",
        "keywords":              ["market closure", "strike", "road block", "disruption",
                                  "bandh", "market closed", "supply chain disruption"],
        "rationale": (
            "Market disruptions sever the supply chain. Even short closures can cause "
            "10–20% price spikes due to perishability of agricultural produce."
        ),
    },
    "export_restriction": {
        "price_direction":       "down",
        "base_impact_pct":       -8.0,
        "volatility_multiplier": 1.20,
        "risk_change":           "increases",
        "supply_effect":         "domestic surplus increases",
        "keywords":              ["export ban", "export restriction", "export quota",
                                  "no export", "export stopped"],
        "rationale": (
            "Export restrictions divert supply to the domestic market, "
            "typically reducing prices by 8–15% in the short term."
        ),
    },
}


def _detect_scenario(text: str) -> tuple[str, dict]:
    """Match free text to the closest scenario template."""
    lower = text.lower()
    for name, tpl in _TEMPLATES.items():
        if any(kw in lower for kw in tpl["keywords"]):
            return name, tpl
    return "generic", {
        "price_direction":       "uncertain",
        "base_impact_pct":       0.0,
        "volatility_multiplier": 1.10,
        "risk_change":           "unknown",
        "supply_effect":         "unknown",
        "rationale":             "Scenario type not recognized. General market uncertainty applies.",
    }


def _extract_magnitude(text: str) -> Optional[float]:
    """Extract percentage or magnitude from user text (e.g. '20%', 'by 30 percent')."""
    m = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:%|percent)\b', text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def simulate_scenario(
    question: str,
    crop: str,
    state: str,
    insight_context: Optional[dict] = None,
) -> dict:
    """
    Simulate a "what-if" agricultural scenario.

    Args:
        question:        Free-text scenario question.
        crop:            Crop name.
        state:           State name.
        insight_context: Optional dict from build_insight_context() for crop volatility scaling.

    Returns:
        SimulationResult dict with price direction, impact estimate, risk change,
        recommendation, confidence, and honest uncertainty caveats.
    """
    scenario_type, tpl = _detect_scenario(question)
    magnitude          = _extract_magnitude(question)

    # Baseline values from context
    current_price = 0
    cv            = 30.0  # default moderate volatility
    base_impact   = tpl["base_impact_pct"]

    if insight_context and insight_context.get("has_data"):
        current_price = insight_context.get("last_price", 0)
        vol           = insight_context.get("volatility") or {}
        cv            = vol.get("cv", 30.0)

    # Scale impact by stated magnitude (e.g. "20% rainfall decrease")
    scale_factor = 1.0
    if magnitude:
        scale_factor = min(3.0, magnitude / 10.0)   # 10% stated → 1x, 30% → 3x, cap at 3x
    scaled_impact = round(base_impact * scale_factor, 1)

    # Confidence: lower with high volatility or unknown scenario
    if scenario_type == "generic":
        confidence = "very low — scenario type not recognized"
    elif cv > 50:
        confidence = "low — market is highly volatile; outcomes are unpredictable"
    elif cv > 30:
        confidence = "moderate — heuristic estimate based on historical patterns"
    else:
        confidence = "moderate-high — market is stable; heuristic estimate is more reliable"

    # Price impact estimate
    direction = tpl["price_direction"]
    est_price = None
    if current_price > 0 and scaled_impact != 0:
        est_price = round(current_price * (1 + scaled_impact / 100))

    # Recommendation
    if direction == "up":
        farmer_rec = "Farmers and traders should consider selling promptly before supply impact is absorbed by the market."
    elif direction == "down":
        farmer_rec = "Buyers may benefit from temporary lower prices. Sellers should consider storage if economically feasible."
    else:
        farmer_rec = "Monitor market closely. Conditions are uncertain and price direction could swing either way."

    return {
        "scenario":          question[:200],
        "scenario_type":     scenario_type,
        "crop":              crop,
        "state":             state,
        "price_direction":   direction,
        "price_impact_pct":  scaled_impact,          # always numeric; 0.0 when undetected
        "current_price":     current_price,           # int/float; 0 when unknown
        "estimated_price":   est_price,               # int or None
        "volatility_effect": f"Volatility expected to {tpl['volatility_multiplier']:.1f}x current levels temporarily",
        "supply_effect":     tpl["supply_effect"],
        "risk_change":       tpl["risk_change"],
        "farmer_recommendation": farmer_rec,
        "confidence":        confidence,
        "rationale":         tpl["rationale"],
        "disclaimer": (
            "This is a heuristic simulation based on historical agricultural patterns. "
            "It is NOT a scientific forecast. Actual outcomes depend on many unpredictable "
            "factors. Use as one input among many, not as a sole decision basis."
        ),
    }
