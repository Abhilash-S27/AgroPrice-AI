"""
backend/services/agents/

Internal AI agent framework for AgroPrice AI (Phase 2B).

ARCHITECTURE RULE:
  Agents are pure Python computations — they NEVER call Gemini or any LLM.
  They receive the deterministic insight_context dict (from build_insight_context)
  and return structured AgentInsight dicts.

  Only advisor_ai_router.py controls Gemini access.
  Agents enrich PromptContext; Gemini narrates the result.
"""
from backend.services.agents.trend_agent import analyze as trend_analyze
from backend.services.agents.risk_agent import analyze as risk_analyze
from backend.services.agents.seasonal_agent import analyze as seasonal_analyze
from backend.services.agents.recommendation_agent import analyze as recommendation_analyze
from backend.services.agents.market_briefing_agent import run_briefing

__all__ = [
    "trend_analyze",
    "risk_analyze",
    "seasonal_analyze",
    "recommendation_analyze",
    "run_briefing",
]
