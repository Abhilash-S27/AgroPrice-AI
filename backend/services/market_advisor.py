"""
Market Advisory Engine (Phase 3).

Cross-crop advisory rankings computed from the cross-crop analytics cache
(volatility, momentum, continuity, anomaly density, reliability, seasonal
phase). Every recommendation cites the metrics it ranks on — deterministic,
no canned content.

Question types served:
  safest / riskiest / most profitable / storage-suitable /
  strongest momentum / short-term selling / long-term holding /
  diversification
"""
from __future__ import annotations


def _usable(peers: list[dict], state: str | None = None) -> tuple[list[dict], str]:
    pool = [p for p in peers if p.get("has_analytics")]
    scope = "across South India"
    if state:
        in_state = [p for p in pool if p.get("state") == state]
        if in_state:
            return in_state, f"among crops with {state} as their primary market"
        scope = f"across South India (no crop uses {state} as its primary market)"
    return pool, scope


def _fmt(p: dict) -> str:
    return (f"{p['crop']} ({p.get('volatility_cv', 0):.0f}% CV, "
            f"momentum {p.get('momentum_score', 0):+.1f}%/7d, "
            f"Tier {p.get('tier')}, reliability {p.get('reliability_score')}/100)")


def safest(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    # safety = low volatility, weighted by data dependability
    ranked = sorted(pool, key=lambda p: (
        p.get("volatility_cv", 99) - (p.get("reliability_score") or 0) * 0.15
    ))[:n]
    names = [_fmt(p) for p in ranked]
    reply = (
        f"For lower-risk positioning {scope}, the steadiest markets right now are: "
        + "; ".join(f"{i + 1}. {s}" for i, s in enumerate(names))
        + ". Low coefficient of variation means smaller week-to-week price swings, "
          "and high reliability means the pattern is well-evidenced by reporting depth."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def riskiest(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    ranked = sorted(pool, key=lambda p: p.get("volatility_cv", 0), reverse=True)[:n]
    reply = (
        f"The highest-swing markets {scope} are: "
        + "; ".join(f"{i + 1}. {_fmt(p)}" for i, p in enumerate(ranked))
        + ". High CV cuts both ways — larger profit potential on good timing, "
          "but bulk positions face equally large adverse moves."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def most_profitable(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)

    def opportunity(p):
        return (p.get("momentum_score", 0) * 0.5
                - p.get("volatility_cv", 50) * 0.25
                + (p.get("reliability_score") or 0) * 0.35)

    ranked = sorted(pool, key=opportunity, reverse=True)[:n]
    reply = (
        f"Ranking opportunity {scope} by momentum, stability and forecast confidence: "
        + " ".join(f"{i + 1}. {_fmt(p)}" for i, p in enumerate(ranked))
        + ". Higher momentum means rising prices; lower CV means steadier income; "
          "reliability reflects how predictable the market is. This is market-signal "
          "analysis, not agronomic or financial advice."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def storage_suitable(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    # storables: grains/cash crops, stable, ideally in a trough (buy-hold logic)
    storable = [p for p in pool if p.get("category") in ("grain", "cash")] or pool
    ranked = sorted(storable, key=lambda p: (
        p.get("volatility_cv", 99)
        - (10 if p.get("current_phase") == "trough" else 0)
    ))[:n]
    lines = []
    for i, p in enumerate(ranked, 1):
        phase = p.get("current_phase", "normal")
        note = " — currently at seasonal lows (favourable entry)" if phase == "trough" else ""
        lines.append(f"{i}. {p['crop']} ({p.get('volatility_cv', 0):.0f}% CV, {p.get('category')}){note}")
    reply = (
        f"For storage/holding {scope}, non-perishable and stable markets rank best: "
        + "; ".join(lines)
        + ". Perishable vegetables are excluded from holding logic — their storage "
          "cost and spoilage risk usually exceed expected price gains."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def strongest_momentum(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    ranked = sorted(pool, key=lambda p: p.get("momentum_score", 0), reverse=True)[:n]
    reply = (
        f"Strongest short-term momentum {scope}: "
        + "; ".join(f"{i + 1}. {p['crop']} ({p.get('momentum_score', 0):+.1f}%/7d, "
                    f"{p.get('volatility_cv', 0):.0f}% CV)" for i, p in enumerate(ranked))
        + ". Fast moves often partially retrace — check whether the move aligns "
          "with the crop's seasonal pattern before chasing it."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def short_term_selling(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    # sell-side edge: positive momentum + at/near seasonal peak
    def sell_score(p):
        return (p.get("momentum_score", 0)
                + (15 if p.get("current_phase") == "peak" else 0))
    ranked = sorted(pool, key=sell_score, reverse=True)[:n]
    lines = []
    for i, p in enumerate(ranked, 1):
        phase_note = "in its seasonal peak window" if p.get("current_phase") == "peak" \
            else f"momentum {p.get('momentum_score', 0):+.1f}%/7d"
        lines.append(f"{i}. {p['crop']} ({phase_note})")
    reply = (
        f"Best short-cycle selling conditions {scope}: " + "; ".join(lines)
        + ". Selling into strength (rising momentum or a seasonal peak) has "
          "historically captured the premium before mean reversion."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def long_term_holding(peers: list[dict], state: str | None = None, n: int = 3) -> dict:
    pool, scope = _usable(peers, state)
    holdable = [p for p in pool if p.get("category") in ("grain", "cash")] or pool
    def hold_score(p):
        return ((p.get("reliability_score") or 0)
                - p.get("volatility_cv", 50) * 0.5
                + (10 if p.get("current_phase") == "trough" else 0))
    ranked = sorted(holdable, key=hold_score, reverse=True)[:n]
    reply = (
        f"For longer holding horizons {scope}, dependable non-perishables rank best: "
        + "; ".join(f"{i + 1}. {_fmt(p)}" for i, p in enumerate(ranked))
        + ". The logic favours high forecast reliability, manageable volatility, "
          "and entries near seasonal lows."
    )
    return {"reply": reply, "ranking": [p["crop"] for p in ranked]}


def diversification(peers: list[dict], state: str | None = None) -> dict:
    pool, scope = _usable(peers, state)
    if len(pool) < 4:
        return {"reply": "Not enough analytics-covered crops for a diversification view.",
                "ranking": []}
    stable = min(pool, key=lambda p: p.get("volatility_cv", 99))
    grower = max(pool, key=lambda p: p.get("momentum_score", 0))
    anchor = max(pool, key=lambda p: (p.get("reliability_score") or 0))
    picks, seen = [], set()
    for role, p in (("stability anchor", stable), ("growth exposure", grower),
                    ("confidence anchor", anchor)):
        if p["crop"] not in seen:
            picks.append((role, p))
            seen.add(p["crop"])
    reply = (
        f"A balanced mix {scope} would combine: "
        + "; ".join(f"{p['crop']} as the {role} ({p.get('volatility_cv', 0):.0f}% CV, "
                    f"momentum {p.get('momentum_score', 0):+.1f}%/7d)"
                    for role, p in picks)
        + ". Spreading across volatility profiles smooths income against any "
          "single market's swings."
    )
    return {"reply": reply, "ranking": [p["crop"] for _, p in picks]}


# question-type → handler (used by the chat layer)
ADVISORY_HANDLERS = {
    "safest": safest,
    "riskiest": riskiest,
    "profitable": most_profitable,
    "storage": storage_suitable,
    "momentum": strongest_momentum,
    "short_term": short_term_selling,
    "long_term": long_term_holding,
    "diversify": diversification,
}
