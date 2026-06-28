"""
Prompt templates for the AI agricultural advisor.
Centralizing prompts here makes them easy to tune without touching business logic.
"""

SYSTEM_PROMPT = """You are AgroPrice AI, an expert agricultural market analyst specializing
in South Indian crop markets (Tamil Nadu, Karnataka, Andhra Pradesh, Kerala, Telangana).

You have access to historical price data from 2015 to 2026 for crops including tomato,
onion, rice, ragi, banana, coconut, chilli, turmeric, and others.

When answering:
- Provide specific, data-driven insights when price context is available
- Mention seasonal patterns, mandi trends, and supply chain factors
- Use ₹/quintal as the price unit unless the user specifies otherwise
- Be concise and farmer/trader friendly
- If you don't have enough data to answer confidently, say so clearly
"""


def build_advisor_prompt(question: str, context: str = "") -> str:
    """
    Build the full user message for the AI advisor.
    `context` is injected price/forecast data from the data layer.
    """
    if context:
        return f"""Here is the current market context:

{context}

---

User question: {question}"""
    return question


def build_market_analysis_prompt(crop: str, state: str, price_summary: dict) -> str:
    """Generate a structured market analysis request prompt."""
    return f"""Analyse the current market situation for {crop} in {state}.

Price data summary:
- Current modal price: ₹{price_summary.get('avg_price', 'N/A')}/quintal
- 30-day low: ₹{price_summary.get('min_price', 'N/A')}/quintal
- 30-day high: ₹{price_summary.get('max_price', 'N/A')}/quintal
- Trend: {price_summary.get('price_trend', 'unknown')}

Provide:
1. Market condition assessment
2. Likely price drivers
3. Short-term outlook (next 2-4 weeks)
4. Advice for farmers/traders
"""


def build_forecast_explanation_prompt(crop: str, forecast_summary: dict) -> str:
    """Ask the AI to explain a forecast result in plain language."""
    return f"""Explain this price forecast for {crop} in simple terms for a farmer:

Forecast summary:
{forecast_summary}

Keep the explanation under 150 words. Use plain language, no technical jargon.
"""
