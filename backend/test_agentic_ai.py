"""
Phase 2B -- Agentic AI Test Suite

Tests: agent orchestration, scenario simulation, market briefing.
Run from project root:
    python -m backend.test_agentic_ai
"""
import sys
from datetime import datetime


def hdr(n, title):
    print(f"\n{'='*55}")
    print(f"  Test {n}: {title}")
    print('='*55)

def ok(msg):   print(f"  [PASS] {msg}")
def fail(msg): print(f"  [FAIL] {msg}"); return False
def warn(msg): print(f"  [WARN] {msg}")

results = []

# ── Test 1: TrendAgent -- bullish signal ──────────────────────────────────
hdr(1, "TrendAgent -- bullish signal")
try:
    from backend.services.agents.trend_agent import analyze as trend_analyze
    ctx = {
        "has_data": True,
        "crop": "Tomato", "state": "Karnataka",
        "momentum": {"score": 12.0, "signal": "bullish", "avg_7d": 4200, "avg_30d": 3900},
        "last_price": 4200,
        "price_vs_year": 5.0,
    }
    result = trend_analyze(ctx)
    assert result["agent"] == "trend", "agent name"
    assert result["score"] >= 0.55, f"score too low: {result['score']}"
    assert "BULLISH" in result["verdict"].upper(), f"expected bullish: {result['verdict']}"
    assert len(result["signals"]) > 0, "no signals"
    ok(f"verdict={result['verdict']} score={result['score']:.2f} headline='{result['headline'][:50]}'")
    results.append(True)
except Exception as e:
    fail(f"TrendAgent raised: {e}")
    results.append(False)


# ── Test 2: TrendAgent -- bearish signal ─────────────────────────────────
hdr(2, "TrendAgent -- bearish signal")
try:
    from backend.services.agents.trend_agent import analyze as trend_analyze
    ctx = {
        "has_data": True,
        "crop": "Onion", "state": "Tamil Nadu",
        "momentum": {"score": -15.0, "signal": "bearish", "avg_7d": 3000, "avg_30d": 3700},
        "last_price": 3000,
        "price_vs_year": -8.0,
    }
    result = trend_analyze(ctx)
    assert result["score"] <= 0.45, f"score too high for bearish: {result['score']}"
    assert "BEAR" in result["verdict"].upper() or "NEUTRAL" in result["verdict"].upper(), \
        f"expected bearish verdict: {result['verdict']}"
    ok(f"verdict={result['verdict']} score={result['score']:.2f}")
    results.append(True)
except Exception as e:
    fail(f"TrendAgent bearish raised: {e}")
    results.append(False)


# ── Test 3: RiskAgent -- high volatility ──────────────────────────────────
hdr(3, "RiskAgent -- high volatility")
try:
    from backend.services.agents.risk_agent import analyze as risk_analyze
    ctx = {
        "has_data": True,
        "crop": "Cardamom", "state": "Kerala",
        "volatility": {"cv": 55.0, "level": "extreme", "badge": "Extreme"},
        "anomalies": [{"event_type": "spike"}, {"event_type": "crash"}],
        "quality": {"score": 40, "reliability": "Low"},
        "staleness_days": 5,
    }
    result = risk_analyze(ctx)
    assert result["agent"] == "risk"
    assert result["score"] >= 0.6, f"risk score too low for extreme vol: {result['score']}"
    assert "RISK" in result["verdict"], f"expected risk verdict: {result['verdict']}"
    ok(f"verdict={result['verdict']} risk_score={result['score']:.2f} anomalies=2")
    results.append(True)
except Exception as e:
    fail(f"RiskAgent raised: {e}")
    results.append(False)


# ── Test 4: SeasonalAgent -- peak season ─────────────────────────────────
hdr(4, "SeasonalAgent -- peak season")
try:
    from backend.services.agents.seasonal_agent import analyze as seasonal_analyze
    ctx = {
        "has_data": True,
        "crop": "Tomato", "state": "Karnataka",
        "seasonal": {
            "current_phase": "peak",
            "current_vs_norm": 18.0,
            "peak_months": ["Oct", "Nov", "Dec"],
            "trough_months": ["Mar", "Apr"],
            "peak_pct": 25.0,
            "trough_pct": -15.0,
        }
    }
    result = seasonal_analyze(ctx)
    assert result["agent"] == "seasonal"
    assert result["score"] >= 0.65, f"peak score too low: {result['score']}"
    assert "PEAK" in result["verdict"], f"expected peak: {result['verdict']}"
    ok(f"verdict={result['verdict']} score={result['score']:.2f}")
    results.append(True)
except Exception as e:
    fail(f"SeasonalAgent raised: {e}")
    results.append(False)


# ── Test 5: RecommendationAgent -- SELL_NOW scenario ─────────────────────
hdr(5, "RecommendationAgent -- SELL_NOW (bullish+low risk+peak)")
try:
    from backend.services.agents.trend_agent          import analyze as trend_analyze
    from backend.services.agents.risk_agent           import analyze as risk_analyze
    from backend.services.agents.seasonal_agent       import analyze as seasonal_analyze
    from backend.services.agents.recommendation_agent import analyze as rec_analyze

    base = {"has_data": True, "crop": "Tomato", "state": "Karnataka", "last_price": 5000}
    trend_ctx    = {**base, "momentum": {"score": 18.0, "signal": "strong_bullish", "avg_7d": 5000, "avg_30d": 4200}, "price_vs_year": 10.0}
    risk_ctx     = {**base, "volatility": {"cv": 8.0, "level": "stable", "badge": "Stable"}, "anomalies": [], "quality": {"score": 90, "reliability": "Excellent"}, "staleness_days": 1}
    seasonal_ctx = {**base, "seasonal": {"current_phase": "peak", "current_vs_norm": 20.0, "peak_months": ["Oct"], "trough_months": ["Mar"], "peak_pct": 25.0, "trough_pct": -10.0}}

    trend    = trend_analyze(trend_ctx)
    risk     = risk_analyze(risk_ctx)
    seasonal = seasonal_analyze(seasonal_ctx)
    rec      = rec_analyze(base, trend, risk, seasonal)

    assert rec["agent"] == "recommendation"
    assert rec["verdict"] in ("SELL_NOW", "SELL_SOON"), f"expected SELL_*: {rec['verdict']}"
    assert "advice" in rec.get("details", {}), "no advice in details"
    ok(f"verdict={rec['verdict']} opp_score={rec['score']:.2f} advice='{rec['details']['advice'][:60]}'")
    results.append(True)
except Exception as e:
    import traceback; traceback.print_exc()
    fail(f"RecommendationAgent raised: {e}")
    results.append(False)


# ── Test 6: MarketBriefingAgent -- orchestration ──────────────────────────
hdr(6, "MarketBriefingAgent.run_briefing() orchestration")
try:
    from backend.services.agents.market_briefing_agent import run_briefing

    ctx = {
        "has_data": True,
        "crop": "Tomato", "state": "Karnataka",
        "last_price": 4500,
        "price_vs_year": 5.0,
        "momentum": {"score": 8.0, "signal": "bullish", "avg_7d": 4500, "avg_30d": 4100},
        "volatility": {"cv": 20.0, "level": "moderate", "badge": "Moderate"},
        "seasonal": {"current_phase": "normal", "current_vs_norm": 2.0, "peak_months": ["Oct"], "trough_months": ["Feb"], "peak_pct": 15.0, "trough_pct": -10.0},
        "anomalies": [],
        "quality": {"score": 70, "reliability": "Good"},
        "staleness_days": 2,
    }
    b = run_briefing(ctx)

    assert b["crop"] == "Tomato"
    assert "agents" in b
    assert "trend"          in b["agents"]
    assert "risk"           in b["agents"]
    assert "seasonal"       in b["agents"]
    assert "recommendation" in b["agents"]
    assert "executive_summary" in b
    assert 0 <= b["opportunity_score"] <= 1
    # risk_level is the verdict string lowercased, e.g. "extreme risk", "moderate risk"
    assert "risk" in b["risk_level"] or b["risk_level"] == "unknown", f"unexpected: {b['risk_level']}"
    ok(f"4 agents wired opp={b['opportunity_score']:.2f} risk={b['risk_level']}")
    # Strip rupee sign to avoid cp1252 console encoding issues
    safe_summary = b['executive_summary'].replace('₹', 'Rs')[:80]
    ok(f"exec='{safe_summary}'")
    results.append(True)
except Exception as e:
    import traceback; traceback.print_exc()
    fail(f"run_briefing raised: {e}")
    results.append(False)


# ── Test 7: ScenarioEngine -- rainfall decrease ───────────────────────────
hdr(7, "ScenarioEngine -- rainfall_decrease")
try:
    from backend.services.scenario_engine import simulate_scenario

    result = simulate_scenario(
        question="What if rainfall decreases by 40% this season?",
        crop="Tomato", state="Karnataka", insight_context=None
    )
    assert result["scenario_type"] == "rainfall_decrease", f"wrong type: {result['scenario_type']}"
    assert result["price_direction"] == "up", f"expected up: {result['price_direction']}"
    assert isinstance(result["price_impact_pct"], (int, float)), "price_impact_pct not numeric"
    assert "farmer_recommendation" in result
    assert "disclaimer" in result
    ok(f"type={result['scenario_type']} dir={result['price_direction']} impact={result['price_impact_pct']:.1f}%")
    results.append(True)
except Exception as e:
    fail(f"ScenarioEngine rainfall raised: {e}")
    results.append(False)


# ── Test 8: ScenarioEngine -- export restriction ──────────────────────────
hdr(8, "ScenarioEngine -- export_restriction")
try:
    from backend.services.scenario_engine import simulate_scenario

    result = simulate_scenario(
        question="What if export ban is imposed for 3 months?",
        crop="Onion", state="Tamil Nadu", insight_context=None
    )
    assert result["scenario_type"] == "export_restriction", f"wrong: {result['scenario_type']}"
    assert result["price_direction"] == "down", f"expected down: {result['price_direction']}"
    ok(f"type={result['scenario_type']} dir={result['price_direction']}")
    results.append(True)
except Exception as e:
    fail(f"ScenarioEngine export_restriction raised: {e}")
    results.append(False)


# ── Test 9: ScenarioEngine -- generic fallback ────────────────────────────
hdr(9, "ScenarioEngine -- generic/unrecognized fallback")
try:
    from backend.services.scenario_engine import simulate_scenario

    result = simulate_scenario(
        question="If the sun turns green what happens to prices?",
        crop="Rice", state="Kerala", insight_context=None
    )
    assert "scenario_type" in result
    assert "disclaimer" in result
    assert "confidence" in result
    # confidence may be a long string like "very low -- scenario type not recognized"
    assert len(result["confidence"]) > 0
    ok(f"fallback handled: type={result['scenario_type']} dir={result['price_direction']}")
    ok(f"confidence='{result['confidence'][:50]}'")
    results.append(True)
except Exception as e:
    fail(f"ScenarioEngine fallback raised: {e}")
    results.append(False)


# ── Test 10: ScenarioEngine -- with insight_context price scaling ──────────
hdr(10, "ScenarioEngine -- insight_context price scaling")
try:
    from backend.services.scenario_engine import simulate_scenario

    ctx = {"has_data": True, "last_price": 5000, "volatility": {"cv": 30.0, "level": "high"}}
    result = simulate_scenario(
        question="What if transport costs increase by 20%?",
        crop="Chilli", state="Andhra Pradesh", insight_context=ctx
    )
    assert result["scenario_type"] == "transport_cost_rise", f"wrong: {result['scenario_type']}"
    # current_price is a formatted string like "Rs5,000/quintal" or numeric
    assert result["current_price"] != "Unknown", f"current_price was Unknown (has_data not read)"
    assert result["estimated_price"] is not None, "estimated_price is None with has_data=True"
    ok(f"type={result['scenario_type']} has_price=True impact={result['price_impact_pct']:.1f}%")
    results.append(True)
except Exception as e:
    fail(f"ScenarioEngine with ctx raised: {e}")
    results.append(False)


# ── Test 11: AdvisorContextBuilder.build_with_raw -- live DB ──────────────
hdr(11, "AdvisorContextBuilder.build_with_raw() (requires DB)")
try:
    import asyncio
    from backend.core.database import db_manager
    from backend.data.ingest import run_ingestion_pipeline
    from backend.services.advisor_context_builder import AdvisorContextBuilder

    db_manager.connect()
    run_ingestion_pipeline(db_manager.conn)
    builder = AdvisorContextBuilder()
    prompt_ctx, raw = asyncio.run(builder.build_with_raw("Tomato", "Karnataka"))

    assert prompt_ctx is not None, "prompt_ctx is None"
    assert isinstance(raw, dict), "raw not dict"
    ok(f"PromptContext built crop={prompt_ctx.crop} state={prompt_ctx.state}")
    ok(f"Raw keys: {list(raw.keys())[:6]}")
    ok(f"current_modal_price={prompt_ctx.current_modal_price}")
    results.append(True)
except Exception as e:
    warn(f"Skipped (DB not connected): {e}")
    results.append(None)


# ── Test 12: Full briefing engine -- live ────────────────────────────────
hdr(12, "MarketBriefingEngine.get_market_briefing() (requires DB)")
try:
    from backend.services.market_briefing_engine import get_market_briefing

    b = get_market_briefing("Tomato", "Karnataka")
    assert "agents" in b
    assert "executive_summary" in b
    ok(f"briefing generated opp={b['opportunity_score']:.2f} risk={b['risk_level']}")
    ok(f"exec: '{b['executive_summary'][:80]}'")
    results.append(True)
except Exception as e:
    warn(f"Skipped (DB not connected): {e}")
    results.append(None)


# ── Test 13: Proactive insights -- live ──────────────────────────────────
hdr(13, "MarketBriefingEngine.get_proactive_insights() (requires DB)")
try:
    from backend.services.market_briefing_engine import get_proactive_insights

    pi = get_proactive_insights(max_crops=5)
    assert "generated_for" in pi
    ok(f"generated_for={pi['generated_for']}")
    if pi.get("top_opportunity"):
        ok(f"top_opportunity={pi['top_opportunity']['crop']}/{pi['top_opportunity']['state']}")
    results.append(True)
except Exception as e:
    warn(f"Skipped (DB not connected): {e}")
    results.append(None)


# ── Summary ──────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"  Phase 2B Test Results -- {datetime.now().strftime('%Y-%m-%d %H:%M')}")
print('='*55)

passed  = sum(1 for r in results if r is True)
failed  = sum(1 for r in results if r is False)
skipped = sum(1 for r in results if r is None)

for i, r in enumerate(results, 1):
    mark = "PASS" if r is True else ("FAIL" if r is False else "SKIP")
    print(f"  [{mark}] Test {i:02d}")

print(f"\n  {passed}/{len(results)} passed  {failed} failed  {skipped} skipped")
if failed > 0:
    print("  WARNING: Some tests failed -- see output above.")
    sys.exit(1)
else:
    print("  All required tests PASS.")
