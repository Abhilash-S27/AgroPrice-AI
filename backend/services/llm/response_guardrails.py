"""
backend/services/llm/response_guardrails.py

Guardrails that keep Gemini confined to its role as an agricultural intelligence
advisor for South Indian markets.

Design principle:
  The AI must never drift outside: agriculture, market pricing, forecasting,
  crop advisory, and farm economics. Any out-of-scope query gets a firm,
  professional redirect — not an error, not a hallucination.
"""

from __future__ import annotations

import re

# ── Domain vocabulary ──────────────────────────────────────────────────────────

_AGRICULTURE_KEYWORDS: frozenset[str] = frozenset({
    "crop", "crops", "price", "prices", "market", "mandi", "farmer", "farm",
    "harvest", "season", "monsoon", "yield", "commodity", "grain", "vegetable",
    "fruit", "spice", "rice", "wheat", "tomato", "onion", "potato", "chilli",
    "turmeric", "banana", "coconut", "ragi", "maize", "sugarcane", "cotton",
    "soybean", "groundnut", "arecanut", "cardamom", "pepper", "ginger",
    "forecast", "trend", "volatility", "outlook", "advisory", "sell", "buy",
    "storage", "procurement", "apmc", "agmarknet", "quintal", "kg", "tonne",
    "karnataka", "tamil Nadu", "telangana", "andhra", "kerala", "south india",
    "supply", "demand", "export", "import", "agri", "agriculture", "kharif",
    "rabi", "zaid", "irrigation", "sowing", "ripe", "post-harvest",
    "soil", "fertilizer", "pesticide", "drip", "rainfall", "drought",
    "cold storage", "warehouse", "logistics", "msp", "minimum support",
})

# Domains that are explicitly out-of-scope for AgroPrice AI
# Domains that are ALWAYS blocked — no agriculture keywords can offset them.
# Used for unambiguously off-topic or unsafe requests.
_HARD_BLOCKED_DOMAINS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(python|javascript|typescript|java(?!nese)\b|c\+\+|ruby|php|golang|rust\b|code|program\w*|algorithm|debug|syntax|compiler|scrape|scraper|crawl)\b", re.I),
     "software development"),
    (re.compile(r"\b(bitcoin|ethereum|crypto(?:currency)?|blockchain|nft|defi|web3)\b", re.I),
     "cryptocurrency"),
    (re.compile(r"\b(quantum computing|machine learning(?! for agri)|deep learning|neural network|llm|gpt|chatgpt|openai|gemini(?! agro)|anthropic)\b", re.I),
     "AI/technology"),
]

# Domains blocked unless the query also has clear agriculture context.
_SOFT_BLOCKED_DOMAINS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(election|vote|party|politician|government policy|manifesto|campaign)\b", re.I),
     "politics"),
    (re.compile(r"\b(recipe|cooking|ingredient|cuisine|restaurant|chef|bake|fry|boil)\b", re.I),
     "cooking/recipes"),
    (re.compile(r"\b(movie|film|actor|music|song|celebrity|sport|cricket(?! farming)|football)\b", re.I),
     "entertainment"),
    (re.compile(r"\b(stock market|equity|share|nifty|sensex|ipo|mutual fund)\b", re.I),
     "financial markets (non-agricultural)"),
    (re.compile(r"\b(medical|disease|symptom|medicine|doctor|hospital|treat|cure|diagnos)\b", re.I),
     "medical advice"),
    (re.compile(r"\b(legal|lawsuit|court|lawyer|attorney|sue|jurisdiction|contract law)\b", re.I),
     "legal advice"),
]

# Keep for backward-compat references
_BLOCKED_DOMAINS = _HARD_BLOCKED_DOMAINS + _SOFT_BLOCKED_DOMAINS

_MAX_PROMPT_LENGTH = 2000  # characters — prevents prompt injection via huge inputs
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(your|previous|all|above|prior)\s+instructions?", re.I),
    re.compile(r"you are (now|a|an) .{0,40}(assistant|bot|ai|model)", re.I),
    re.compile(r"(forget|disregard|override) (your |the )?(system|instructions?|prompt)", re.I),
    re.compile(r"act as (a|an) .{0,40}(expert|advisor|consultant) in .{0,40}(?!agri|farm|crop)", re.I),
    re.compile(r"(reveal|show|print|output) (your |the )?(system prompt|instructions?|api key)", re.I),
    re.compile(r"\b(jailbreak|dan mode|developer mode|bypass|override)\b.{0,30}(system|instruct|restrict|rule)", re.I),
]

# Professional response for out-of-scope queries
_OUT_OF_SCOPE_RESPONSE = (
    "I'm AgroPrice AI — specialised in South Indian agricultural markets, crop price "
    "forecasting, and farm advisory. I'm not able to assist with {domain} topics.\n\n"
    "Please ask me about crop prices, market trends, seasonal patterns, forecast "
    "explanations, or farming strategy for South Indian markets."
)

_INJECTION_RESPONSE = (
    "I'm AgroPrice AI and I maintain my agricultural focus at all times. "
    "If you have a question about crop markets, price forecasts, or farming "
    "strategy in South India, I'm here to help."
)


# ── Public API ─────────────────────────────────────────────────────────────────

def validate_domain_query(query: str) -> tuple[bool, str]:
    """
    Check whether a query is within the agricultural domain.

    Returns:
        (True, "")           — query is valid, proceed
        (False, <response>)  — out-of-scope; <response> is what to return to the user
    """
    lower = query.lower()

    # 1. Injection attempts — highest priority, always blocked
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(query):
            return False, _INJECTION_RESPONSE

    # 2. Hard-blocked domains — blocked regardless of agriculture keywords present
    for pattern, domain_label in _HARD_BLOCKED_DOMAINS:
        if pattern.search(lower):
            return False, _OUT_OF_SCOPE_RESPONSE.format(domain=domain_label)

    # 3. Soft-blocked domains — only blocked when NO agriculture keywords offset them
    for pattern, domain_label in _SOFT_BLOCKED_DOMAINS:
        if pattern.search(lower):
            has_agri_context = any(kw in lower for kw in _AGRICULTURE_KEYWORDS)
            if not has_agri_context:
                return False, _OUT_OF_SCOPE_RESPONSE.format(domain=domain_label)

    return True, ""


def sanitize_prompt(prompt: str) -> str:
    """
    Clean and truncate user input before it enters the prompt builder.

    - Strips leading/trailing whitespace
    - Collapses multiple blank lines
    - Truncates to _MAX_PROMPT_LENGTH to prevent token abuse
    """
    prompt = prompt.strip()
    # Collapse multiple consecutive blank lines
    prompt = re.sub(r"\n{3,}", "\n\n", prompt)
    # Remove non-printable characters (except newlines and tabs)
    prompt = re.sub(r"[^\x09\x0A\x0D\x20-\x7E -￿]", "", prompt)

    if len(prompt) > _MAX_PROMPT_LENGTH:
        prompt = prompt[:_MAX_PROMPT_LENGTH] + "...[truncated]"

    return prompt


def enforce_agriculture_scope(query: str) -> str | None:
    """
    Convenience wrapper that returns a ready-to-send rejection message,
    or None if the query is valid.

    Usage in route handlers:
        rejection = enforce_agriculture_scope(user_query)
        if rejection:
            return AdvisorResponse(answer=rejection)
        # ... proceed to Gemini
    """
    valid, response = validate_domain_query(query)
    return None if valid else response
