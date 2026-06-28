"""
Forecast AI Chat — conversational market copilot (Phase 3).

Pipeline per message:
  1. ConversationContext (chat_context_manager) — working memory rebuilt
     from the client-sent transcript: entities, timeframes, intents,
     pronoun/fragment resolution, inferred-context tracking
  2. classify_intent() — analytical + advisory intents
  3. handler — answers computed live from the dataset (insight context,
     cross-crop peers, direct historical retrieval, market advisor)

Provider abstraction unchanged: RuleBasedProvider is the deterministic
engine; Claude/Gemini are Phase-next stubs that fall back to it.
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from datetime import date

import pandas as pd

from backend.data.loaders.duckdb_queries import query_for_forecast
from backend.services import market_advisor as advisor
from backend.services.ai_forecast_narrator import (
    build_confidence,
    build_insight_context,
    build_strategy,
    explain_anomalies,
    state_availability,
)
from backend.services.chat_context_manager import (
    MONTH_LABEL,
    ConversationContext,
    extract_state,
    parse_timeframe,
)
from backend.utils.constants import SOUTH_INDIAN_STATES


# NOTE: stems use \w* (e.g. volatil\w*) so 'volatile', 'volatility',
# 'fluctuating', 'confidence' all match — a bare trailing \b after a stem
# silently kills prefix matching.
_INTENT_PATTERNS: list[tuple[str, str]] = [
    ("greeting",      r"^\s*(hi+|hello+|hey+|namaste|good\s*(morning|afternoon|evening))\b"),
    ("thanks",        r"^\s*(thanks\w*|thank you|thx|great|awesome|nice|ok(ay)?|cool)\s*[!.]*\s*$"),
    ("help",          r"\b(what can you (do|help)|help me|capabilit\w*|how do you work|what do you know)\b"),
    # "when was X most volatile" must outrank the riskiest-ranking intent
    ("most_volatile_when", r"\bwhen\b.*\b(volatil\w*|unstable|swing\w*)"),
    # advisory rankings (before profitability so risk-phrased questions land here)
    ("adv_safest",    r"\b(safest|lower risk|low[- ]risk|less risky|safe crop|safer crop)\b"),
    ("adv_riskiest",  r"\b(riskiest|most (risky|volatile)|highest risk)\b"),
    ("adv_momentum",  r"\b(strongest|best|fastest)\b.*\b(momentum|recovery|rising|growing)\b"),
    ("adv_short",     r"\b(short[- ]term sell\w*|quick sale|sell (now|quickly|fast))\b"),
    ("adv_long",      r"\b(long[- ]term (hold\w*|invest\w*)|hold long|holding crop)\b"),
    ("adv_diversify", r"\b(diversif\w*|spread (the )?risk|mix of crops|portfolio)\b"),
    ("profitability", r"\b(profit\w*|best crop|which crop|what crop|recommend\w*|grow for|should .* grow|earn\w*|income|opportunit\w*)\b"),
    # Historical intelligence — specific temporal queries (must precede generic "historical")
    ("all_time_peak",     r"\b(highest\s+ever|all[- ]time\s+(high|peak)|record\s+high|best\s+year|most\s+expensive\s+year)\b"),
    ("all_time_trough",   r"\b(lowest\s+ever|all[- ]time\s+(low|trough)|record\s+low|worst\s+year|cheapest\s+year)\b"),
    ("yearly_comparison", r"(\d{4}\s*(vs\.?|versus|compared\s+to|and)\s*\d{4}|between\s+\d{4}\s+and\s+\d{4})"),
    ("trend_analysis",    r"\b(long[- ]term\s+trend|year[- ]by[- ]year|price\s+evolution|over\s+the\s+(years|decade|past\s+\d+))\b"),
    ("historical_price",  r"\b(price|cost|rate|modal|average)\b.{0,30}\b(in\s+\d{4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})\b|what\s+(was|were)\b.{0,30}\b(price|cost|rate)\b"),
    ("seasonal_history",  r"\b(historically\s+(in|during|prices)|january|february|march|april|may|june|july|august|september|october|november|december)\b.{0,25}\b(prices|season|pattern|historically|average|was|were)\b"),
    ("historical",        r"\b(was|were|history|historical\w*|performed?|back in|how did)\b"),
    ("compare",           r"\b(safer|better than|versus|vs\.?|compared?( to| with)?|difference between)\b"),
    ("anomaly",       r"\b(spike\w*|crash\w*|anomal\w*|jump(ed)?|shock\w*|sudden\w*|caused)\b"),
    ("volatility",    r"\b(volatil\w*|risky|risk\b|unstable|swing\w*|fluctuat\w*|stable|stabilit\w*|steady)\b"),
    ("confidence",    r"\b(confiden\w*|reliab\w*|trust\w*|accurate|accuracy|sure|certain\w*)\b"),
    ("sell_window",   r"\b(sell\w*|best (period|time|month|window)|when.*(sell|market))\b"),
    ("storage",       r"\b(store\w*|storage|hold\w*|inventory|keep|warehouse\w*)\b"),
    ("seasonal",      r"\b(season\w*|monthly pattern|peak month\w*|trough\w*|cycle\w*)\b"),
    ("trend",         r"\b(trend\w*|direction|rising|falling|going (up|down)|outlook|future|forecast\w*|next month|predict\w*)\b"),
    ("price_now",     r"\b(price\w*|cost\w*|rate\w*|current\w*|today|now)\b"),
]


def classify_intent(text: str) -> str:
    q = text.lower().strip()
    for intent, pattern in _INTENT_PATTERNS:
        if re.search(pattern, q):
            return intent
    return "unknown"


# ── Provider contract ────────────────────────────────────────────────────────

class ChatProvider(ABC):
    name: str = "base"

    @abstractmethod
    def respond(self, message: str, ctx: dict, peers: list[dict],
                history: list[dict] | None = None) -> dict:
        """Returns {reply, intent, follow_ups, inferred_context, provider}."""


# ── Rule-based provider (active) ─────────────────────────────────────────────

class RuleBasedProvider(ChatProvider):
    name = "rule_based"

    def respond(self, message: str, ctx: dict, peers: list[dict],
                history: list[dict] | None = None) -> dict:
        memory = ConversationContext(history or [], ctx["crop"], ctx["state"],
                                     classify_intent)
        ref = memory.resolve(message)
        intent = ref["intent"]

        # comparison phrased as "which crop is safer?" with no second crop
        if intent == "compare" and not ref["crops_mentioned"] \
                and re.search(r"\b(safer|safest)\b", message.lower()) \
                and not re.search(r"\bthan\b", message.lower()):
            intent = "adv_safest"

        # context may shift if the user named a different crop/state
        if ref["crop"] != ctx["crop"] or ref["state"] != ctx["state"]:
            ctx = build_insight_context(ref["crop"], ref["state"], ctx.get("days", 30))

        analytics_only = (not ctx.get("has_data")) or ctx["tier"]["tier"] == "D"

        # advisory rankings (peer-level, work regardless of pair mode)
        if intent.startswith("adv_"):
            key = intent.removeprefix("adv_")
            mapping = {"safest": "safest", "riskiest": "riskiest",
                       "momentum": "momentum", "short": "short_term",
                       "long": "long_term", "diversify": "diversify"}
            handler = advisor.ADVISORY_HANDLERS[mapping[key]]
            if not [p for p in peers if p.get("has_analytics")]:
                return self._wrap(intent, "Cross-crop analytics are still warming up — try again in a moment.", ctx, ref)
            result = handler(peers, extract_state(message) or None)
            return self._wrap(intent, result["reply"], ctx, ref)

        handlers = {
            "greeting":            self._greeting,
            "thanks":              self._thanks,
            "help":                self._help,
            "profitability":       self._profitability,
            "historical":          self._historical,
            # Phase 2A historical sub-intents → handled by the same historical handler
            "historical_price":    self._historical,
            "all_time_peak":       self._historical,
            "all_time_trough":     self._historical,
            "yearly_comparison":   self._historical,
            "trend_analysis":      self._trend,
            "seasonal_history":    self._seasonal,
            "most_volatile_when":  self._most_volatile_when,
            "compare":             self._compare,
            "anomaly":             self._anomaly,
            "volatility":          self._volatility,
            "confidence":          self._confidence,
            "sell_window":         self._sell_window,
            "storage":             self._storage,
            "seasonal":            self._seasonal,
            "trend":               self._trend,
            "price_now":           self._price_now,
            "unknown":             self._unknown,
        }

        local_intents = {"volatility", "confidence", "anomaly", "sell_window",
                         "storage", "seasonal", "trend", "price_now"}
        if analytics_only and intent in local_intents:
            return self._wrap("analytics_only", self._analytics_only(ctx), ctx, ref)

        reply = handlers[intent](message, ctx, peers, ref)
        return self._wrap(intent, reply, ctx, ref)

    # ── conversational intents ───────────────────────────────────────────────

    def _greeting(self, q, ctx, peers, ref) -> str:
        """Dynamic onboarding from the live market context — never static."""
        if not ctx.get("has_data"):
            return (f"Hello! You're viewing {ctx['crop']} in {ctx['state']}, which is in "
                    "analytics-only mode (sparse local reporting). I can still help with "
                    "regional comparisons, historical prices in stronger markets, and "
                    "crop recommendations — what would you like to explore?")
        v, m, tier = ctx["volatility"], ctx["momentum"], ctx["tier"]
        seas = ctx["seasonal"]
        phase_bit = ""
        if seas:
            ph = seas["current_phase"]
            if ph == "trough" and m["score"] > 3:
                phase_bit = "in a recovery phase off its seasonal lows"
            elif ph == "trough":
                phase_bit = "moving through its seasonal trough"
            elif ph == "peak":
                phase_bit = "trading in its seasonal peak window"
            else:
                phase_bit = "in a normal seasonal phase"
        vol_bit = ("high-volatility" if v["cv"] >= 55 else
                   "moderately volatile" if v["cv"] >= 30 else "stable")
        mates = [p["crop"] for p in peers
                 if p.get("category") == ctx["category"] and p["crop"] != ctx["crop"]][:2]
        compare_bit = f", or compare it against {' and '.join(mates)}" if mates else ""
        return (
            f"Hello! {ctx['crop']} in {ctx['state']} is currently a {vol_bit} market "
            f"{phase_bit} (momentum {m['score']:+.1f}%/7d, Tier {tier['tier']} data). "
            f"You can ask about historical prices, seasonal selling windows, storage "
            f"risk{compare_bit}."
        )

    def _thanks(self, q, ctx, peers, ref) -> str:
        return ("Happy to help! Ask me about selling windows, volatility, "
                "historical prices, or crop comparisons whenever you need.")

    def _help(self, q, ctx, peers, ref) -> str:
        return (
            "I work from live AGMARKNET analytics for 27 South Indian crops. You can ask me: "
            "price history ('What was Onion price in Jan 2025?'), trends and forecasts, "
            "why a crop is volatile or stable, the best selling window, storage decisions, "
            "anomaly causes, crop-vs-crop comparisons, advisory rankings ('Which crop is "
            "safest?'), and follow-ups like 'and in 2024?' or 'what about Kerala?'."
        )

    def _unknown(self, q, ctx, peers, ref) -> str:
        return (
            f"I'm not sure I caught that. I can answer questions about prices, trends, "
            f"volatility, seasonality, storage, selling windows, history, comparisons and "
            f"advisory rankings — for {ctx['crop']} or any of the 27 covered crops. "
            "Try: 'Why is it volatile?' or 'Which crop is safest right now?'"
        )

    # ── analytical intents ───────────────────────────────────────────────────

    def _analytics_only(self, ctx) -> str:
        crop, state = ctx["crop"], ctx["state"]
        avail = state_availability(crop)
        here = next((a for a in avail if a["state"] == state), None)
        valid = [a for a in avail if a["forecast_capable"] and a["state"] != state]
        why = (f"only {here['recent_days_365']} recent reporting day"
               f"{'s' if here and here['recent_days_365'] != 1 else ''}"
               if here else "no valid mandi records")
        alt = ""
        if valid:
            v0 = valid[0]
            mom_bit = ""
            if len(valid) > 1:
                steadier = min(valid[:2], key=lambda v: v["cv"] or 999)
                mom_bit = f" {steadier['state']} currently shows the lower volatility of the two."
            alt = (f" However, {v0['state']}"
                   + (f" and {valid[1]['state']} have" if len(valid) > 1 else " has")
                   + f" strong historical coverage ({v0['continuity_score']}% continuity)."
                   + mom_bit
                   + f" Ask 'Compare {crop} in {v0['state']}"
                   + (f" vs {valid[1]['state']}'" if len(valid) > 1 else "'")
                   + " or switch the state selector for full forecasting.")
        return (f"{crop} has insufficient continuity in {state} for reliable "
                f"forecasting ({why}).{alt}")

    def _profitability(self, q, ctx, peers, ref) -> str:
        usable = [p for p in peers if p.get("has_analytics")]
        if len(usable) < 3:
            return "Cross-crop analytics are still warming up — try again in a moment."
        return advisor.most_profitable(peers, extract_state(q))["reply"]

    def _historical(self, q, ctx, peers, ref) -> str:
        crop, state = ctx["crop"], ctx["state"]
        tf = ref.get("timeframe")
        if tf is None:
            return (f"Tell me the period you're interested in — e.g. "
                    f"'What was {crop} price in Jan 2025?' or 'How did it perform in 2024?'")

        df = query_for_forecast(crop, state)
        if df.empty:
            return f"No historical records exist for {crop} in {state}."
        df = df.sort_values("ds")
        latest = df["ds"].max()

        if tf.get("years"):
            y1, y2 = tf["years"]
            parts = []
            for y in (y1, y2):
                sub = df[df["ds"].dt.year == y]
                parts.append(f"{y}: no data" if sub.empty else
                             f"{y}: avg ₹{sub['y'].mean():,.0f}/qtl "
                             f"(range ₹{sub['y'].min():,.0f}–₹{sub['y'].max():,.0f}, {len(sub)} days)")
            s1 = df[df["ds"].dt.year == y1]["y"]
            s2 = df[df["ds"].dt.year == y2]["y"]
            delta = ""
            if len(s1) and len(s2):
                ch = (s2.mean() - s1.mean()) / s1.mean() * 100
                cv1 = s1.std() / s1.mean() * 100 if s1.mean() > 0 else 0
                cv2 = s2.std() / s2.mean() * 100 if s2.mean() > 0 else 0
                delta = (f" That's a {ch:+.1f}% change in average price, and volatility "
                         f"{'rose' if cv2 > cv1 else 'fell'} from {cv1:.0f}% to {cv2:.0f}% CV.")
            return f"{crop} in {state} — " + "; ".join(parts) + "." + delta

        if tf.get("since_anomaly"):
            if not ctx.get("has_data") or not ctx["anomalies"]:
                return f"No recent price event found for {crop} in {state} to anchor that."
            a = ctx["anomalies"][0]
            since = df[df["ds"] >= pd.Timestamp(a["date"])]
            return (f"Since the {a['pct_deviation']:+.1f}% {a['event_type']} on {a['date']}, "
                    f"{crop} in {state} has averaged ₹{since['y'].mean():,.0f}/qtl over "
                    f"{len(since)} sessions vs the pre-event rolling mean of "
                    f"₹{a['roll_mean']:,.0f}/qtl — "
                    f"{'partial mean reversion is underway' if abs(since['y'].iloc[-1] - a['roll_mean']) < abs(a['price'] - a['roll_mean']) else 'prices are still dislocated from the prior baseline'}.")

        if tf.get("relative") == "last_year":
            yr = latest.year - 1
            tf = {"start": date(yr, 1, 1), "end": date(yr, 12, 31), "label": str(yr)}
        elif tf.get("relative") == "this_year":
            yr = latest.year
            tf = {"start": date(yr, 1, 1), "end": date(yr, 12, 31), "label": str(yr)}
        elif tf.get("future_months"):
            return (f"That's a forward-looking window — use the {tf['future_months'] * 30}-day "
                    f"forecast horizon selector above, and I can explain the projected trend.")
        elif tf.get("month_range"):
            a, b = tf["month_range"]
            months = list(range(a, b + 1)) if a <= b else list(range(a, 13)) + list(range(1, b + 1))
            yr = tf.get("year")
            if yr == "last":
                yr = latest.year - 1
            if yr:
                sub = df[(df["ds"].dt.year == yr) & (df["ds"].dt.month.isin(months))]
                if sub.empty:
                    return f"No {crop} records in {state} for {tf['label']} {yr}."
                return (f"{crop} in {state} during {tf['label']} {yr}: average "
                        f"₹{sub['y'].mean():,.0f}/qtl across {len(sub)} reporting days "
                        f"(range ₹{sub['y'].min():,.0f}–₹{sub['y'].max():,.0f}).")
            sub = df[df["ds"].dt.month.isin(months)]
            if sub.empty:
                return f"No {crop} records in {state} during {tf['label']}."
            overall = df["y"].mean()
            delta = (sub["y"].mean() - overall) / overall * 100 if overall > 0 else 0
            return (f"Across all recorded years, {crop} in {state} averages "
                    f"₹{sub['y'].mean():,.0f}/qtl during {tf['label']} — "
                    f"{delta:+.1f}% vs its overall mean of ₹{overall:,.0f}/qtl "
                    f"({len(sub):,} reporting days). "
                    f"{'Prices typically firm up in this window.' if delta > 3 else 'Prices typically soften in this window.' if delta < -3 else 'Pricing is close to its annual norm in this window.'}")
        elif tf.get("harvest"):
            seas = ctx.get("seasonal") if ctx.get("has_data") else None
            if seas:
                return (f"For {crop}, the strongest (harvest-premium) months are "
                        f"{'/'.join(seas['peak_months'])} at {seas['peak_pct']:+.0f}% vs the "
                        "annual mean — use those for timing questions.")
            return "I don't have a seasonal profile for this pair to define harvest season."

        start, end = pd.Timestamp(tf["start"]), pd.Timestamp(tf["end"])
        sub = df[(df["ds"] >= start) & (df["ds"] <= end)]
        if sub.empty:
            return (f"No {crop} records in {state} for {tf['label']} — reporting there "
                    f"covers {df['ds'].min().date()} to {latest.date()} with gaps.")

        # autonomous reasoning: level vs today + seasonal phase of that window
        avg, lo, hi = sub["y"].mean(), sub["y"].min(), sub["y"].max()
        now = df["y"].tail(30).mean()
        vs_now = (now - avg) / avg * 100 if avg > 0 else 0
        level_word = ("relatively subdued" if vs_now > 10 else
                      "elevated" if vs_now < -10 else "comparable to today")
        season_bit = ""
        seas = ctx.get("seasonal") if ctx.get("has_data") else None
        if seas and tf.get("start") and tf["start"].month == (tf["end"].month if hasattr(tf["end"], "month") else tf["start"].month):
            mon_label = MONTH_LABEL.get(tf["start"].month, "")
            if mon_label in seas["trough_months"]:
                season_bit = (f" {mon_label} sits in {crop}'s seasonal trough window, "
                              "when heavy arrivals typically keep demand pressure low.")
            elif mon_label in seas["peak_months"]:
                season_bit = (f" {mon_label} falls in {crop}'s seasonal peak window, "
                              "when supply contraction usually supports prices.")
        return (f"{crop} prices in {state} during {tf['label']} were {level_word}, "
                f"averaging ₹{avg:,.0f}/qtl across {len(sub)} reporting days "
                f"(range ₹{lo:,.0f}–₹{hi:,.0f}).{season_bit} "
                f"Today's 30-day average of ₹{now:,.0f}/qtl runs {vs_now:+.1f}% "
                f"against that period.")

    def _most_volatile_when(self, q, ctx, peers, ref) -> str:
        df = query_for_forecast(ctx["crop"], ctx["state"])
        if df.empty or len(df) < 60:
            return f"Not enough {ctx['crop']} history in {ctx['state']} to profile volatility by period."
        df = df.sort_values("ds")
        by_year = df.groupby(df["ds"].dt.year)["y"].agg(["mean", "std", "count"])
        by_year = by_year[by_year["count"] >= 30]
        by_year["cv"] = by_year["std"] / by_year["mean"] * 100
        worst = by_year["cv"].idxmax()
        return (f"{ctx['crop']} in {ctx['state']} was most volatile in {worst} "
                f"({by_year.loc[worst, 'cv']:.0f}% CV vs {by_year['cv'].mean():.0f}% average "
                f"across years). Calmest year: {by_year['cv'].idxmin()} "
                f"({by_year['cv'].min():.0f}% CV).")

    def _compare(self, q, ctx, peers, ref) -> str:
        mentioned = [c for c in ref["crops_mentioned"] if c != ctx["crop"]]
        states_in_q = [s for s in SOUTH_INDIAN_STATES if s.lower() in q.lower()]
        if len(states_in_q) >= 2 and not mentioned:
            rows = []
            for st in states_in_q[:2]:
                c2 = build_insight_context(ctx["crop"], st, ctx.get("days", 30))
                rows.append(
                    f"{st}: ₹{c2['avg_30d']:,}/qtl 30-day avg, {c2['volatility']['cv']:.0f}% CV, "
                    f"{c2['tier']['continuity_score']}% continuity (Tier {c2['tier']['tier']})"
                    if c2.get("has_data") else f"{st}: insufficient data")
            return f"{ctx['crop']} across states — " + "; ".join(rows) + "."

        other = next((p for p in peers if mentioned and p["crop"] == mentioned[0]), None)
        if other is None:
            return (f"Name a second crop or two states to compare — e.g. "
                    f"'Is {ctx['crop']} safer than Onion?' or "
                    f"'Compare {ctx['crop']} in Karnataka vs Kerala'.")
        mine = next((p for p in peers if p["crop"] == ctx["crop"]), None)
        if mine is None or not mine.get("has_analytics"):
            return f"I don't have comparable analytics for {ctx['crop']} yet."
        safer = mine if mine.get("volatility_cv", 99) < other.get("volatility_cv", 99) else other
        riskier = other if safer is mine else mine
        return (
            f"{safer['crop']} is the steadier market: {safer['volatility_cv']:.0f}% CV vs "
            f"{riskier['volatility_cv']:.0f}% for {riskier['crop']}. Momentum: "
            f"{mine['crop']} {mine.get('momentum_score', 0):+.1f}%/7d vs {other['crop']} "
            f"{other.get('momentum_score', 0):+.1f}%/7d. Reliability: {mine['crop']} "
            f"{mine.get('reliability_score')}/100 (Tier {mine.get('tier')}) vs {other['crop']} "
            f"{other.get('reliability_score')}/100 (Tier {other.get('tier')})."
        )

    def _volatility(self, q, ctx, peers, ref) -> str:
        v, crop = ctx["volatility"], ctx["crop"]
        seas = ctx["seasonal"]
        stable = v["cv"] < 30
        parts = [
            f"{crop} is {'relatively stable' if stable else 'volatile'} in {ctx['state']} — "
            f"{v['cv']:.0f}% coefficient of variation ('{v['badge']}')."
        ]
        if stable:
            parts.append(f"That's low compared to most vegetables and spices, and "
                         f"{ctx['tier']['continuity_score']}% reporting continuity means "
                         "price discovery is consistent.")
        elif seas:
            spread = seas["peak_pct"] - seas["trough_pct"]
            parts.append(f"The main structural driver is seasonality — prices swing "
                         f"{spread:.0f}% between {'/'.join(seas['peak_months'])} peaks and "
                         f"{'/'.join(seas['trough_months'])} troughs.")
        if ctx["anomalies"]:
            a = ctx["anomalies"][0]
            rev = "reverted quickly, preventing sustained instability" if stable \
                  else "show how sharply this market can gap"
            parts.append(f"Recent anomalies ({a['pct_deviation']:+.1f}% {a['event_type']} "
                         f"on {a['date']}) {rev}.")
        return " ".join(parts)

    def _confidence(self, q, ctx, peers, ref) -> str:
        conf = build_confidence(ctx)
        top = sorted(conf["breakdown"], key=lambda b: b["weight"] - b["earned"], reverse=True)[:2]
        weakest = " and ".join(f"{b['factor'].lower()} ({b['earned']}/{b['weight']})" for b in top)
        return (f"{conf['summary']} The weighted breakdown: " +
                ", ".join(f"{b['factor']} {b['earned']}/{b['weight']}" for b in conf["breakdown"]) +
                f". The biggest drags are {weakest}.")

    def _anomaly(self, q, ctx, peers, ref) -> str:
        events = explain_anomalies(ctx)
        if not events:
            return (f"No statistical anomalies in the last 90 days for {ctx['crop']} in "
                    f"{ctx['state']} — daily moves stayed within ±2σ of the rolling mean.")
        e = events[0]
        return f"{e['meaning']} {e['probable_cause']} {e['implication']}"

    def _sell_window(self, q, ctx, peers, ref) -> str:
        strat = build_strategy(ctx)
        seas = ctx["seasonal"]
        base = strat["farmer"][0] if strat["farmer"] else ""
        extra = (f" Across the full year, {'/'.join(seas['peak_months'])} average "
                 f"{seas['peak_pct']:+.0f}% vs the annual mean — historically the strongest window."
                 if seas else "")
        return (base + extra).strip() or "Seasonal data is unavailable for a selling-window recommendation."

    def _storage(self, q, ctx, peers, ref) -> str:
        # "what should farmers store?" with no specific crop → advisory ranking
        if re.search(r"\b(which|what)\b.*\bstore\b", q.lower()) and not ref["crops_mentioned"]:
            if [p for p in peers if p.get("has_analytics")]:
                return advisor.storage_suitable(peers, extract_state(q))["reply"]
        strat = build_strategy(ctx)
        return " ".join(strat["storage"]) + (f" Risk note: {strat['risks'][0]}" if strat["risks"] else "")

    def _seasonal(self, q, ctx, peers, ref) -> str:
        seas = ctx["seasonal"]
        if not seas:
            return f"Seasonal decomposition isn't available for {ctx['crop']} in {ctx['state']}."
        return (f"{ctx['crop']} peaks in {'/'.join(seas['peak_months'])} "
                f"({seas['peak_pct']:+.0f}% vs annual mean) and bottoms in "
                f"{'/'.join(seas['trough_months'])} ({seas['trough_pct']:.0f}%). "
                f"It's currently in a {seas['current_phase']} phase at "
                f"{seas['current_vs_norm']:+.1f}% vs normal.")

    def _trend(self, q, ctx, peers, ref) -> str:
        m, tier, seas = ctx["momentum"], ctx["tier"], ctx["seasonal"]
        parts = [f"{ctx['crop']} momentum in {ctx['state']} is {m['signal'].lower()} at "
                 f"{m['score']:+.1f}% (7-day avg ₹{m['avg_7d']:,.0f} vs prior-month baseline)."]
        if seas:
            nxt = [mn for mn in seas["peak_months"] if mn in ctx["horizon_months"]]
            if nxt:
                parts.append(f"The horizon enters the historical peak window "
                             f"({'/'.join(nxt)}, {seas['peak_pct']:+.0f}% vs annual mean).")
            else:
                t = [mn for mn in seas["trough_months"] if mn in ctx["horizon_months"]]
                if t:
                    parts.append(f"The horizon crosses the seasonal trough "
                                 f"({'/'.join(t)}, {seas['trough_pct']:.0f}% vs annual mean).")
        parts.append(f"Model basis: Tier {tier['tier']} on {tier['training_days']:,} days.")
        return " ".join(parts)

    def _price_now(self, q, ctx, peers, ref) -> str:
        pv = ctx["price_vs_year"]
        return (f"{ctx['crop']} in {ctx['state']} last recorded ₹{ctx['last_price']:,}/qtl "
                f"({ctx['last_date']}); the 30-day average is ₹{ctx['avg_30d']:,}/qtl, "
                f"{pv:+.1f}% vs the 12-month mean of ₹{ctx['avg_365d']:,}/qtl.")

    # ── plumbing ─────────────────────────────────────────────────────────────

    _INTENT_KIND = {
        "volatility":          ("AI Analysis",        "🔬"),
        "confidence":          ("AI Analysis",        "🔬"),
        "anomaly":             ("AI Analysis",        "🔬"),
        "trend":               ("Trend Observation",  "📈"),
        "seasonal":            ("Trend Observation",  "📈"),
        "sell_window":         ("Recommendation",     "🎯"),
        "storage":             ("Recommendation",     "🎯"),
        "profitability":       ("Recommendation",     "🎯"),
        "adv_safest":          ("Recommendation",     "🎯"),
        "adv_riskiest":        ("Recommendation",     "🎯"),
        "adv_momentum":        ("Recommendation",     "🎯"),
        "adv_short":           ("Recommendation",     "🎯"),
        "adv_long":            ("Recommendation",     "🎯"),
        "adv_diversify":       ("Recommendation",     "🎯"),
        "historical":          ("Historical Context", "🕐"),
        "most_volatile_when":  ("Historical Context", "🕐"),
        "price_now":           ("Market Insight",     "💹"),
        "compare":             ("Market Insight",     "💹"),
        "analytics_only":      ("Data Availability",  "📡"),
    }

    def _wrap(self, intent: str, reply: str, ctx: dict, ref: dict | None = None) -> dict:
        kind = self._INTENT_KIND.get(intent)
        confidence = (ctx.get("quality", {}).get("score")
                      if ctx.get("has_data") and kind and kind[0] != "Data Availability"
                      else None)
        return {
            "reply": reply,
            "intent": intent,
            "provider": self.name,
            "kind": kind[0] if kind else None,
            "kind_icon": kind[1] if kind else None,
            "confidence": confidence,
            "inferred_context": (ref or {}).get("inferred", []),
            "follow_ups": suggested_prompts(ctx, exclude_intent=intent)[:3],
        }


# ── Future LLM providers (stubs) ─────────────────────────────────────────────

class ClaudeChatProvider(ChatProvider):
    """Future: ground Claude with build_insight_context(); stream tokens."""
    name = "claude"

    def respond(self, message, ctx, peers, history=None) -> dict:
        raise NotImplementedError("Claude chat provider is scaffolded for a later phase.")


class GeminiChatProvider(ChatProvider):
    """Future: same contract over gemini_advisor."""
    name = "gemini"

    def respond(self, message, ctx, peers, history=None) -> dict:
        raise NotImplementedError("Gemini chat provider is scaffolded for a later phase.")


def get_provider() -> ChatProvider:
    """Switches on configured API keys in a later phase; deterministic for now."""
    return RuleBasedProvider()


# ── Suggested prompts ────────────────────────────────────────────────────────

def suggested_prompts(ctx: dict, exclude_intent: str | None = None) -> list[str]:
    if not ctx.get("has_data"):
        return [f"Which states have good {ctx['crop']} data?",
                f"Compare {ctx['crop']} markets across states",
                "Which crops look most profitable right now?"]

    crop = ctx["crop"]
    out: list[tuple[str, str]] = []
    if ctx["volatility"]["cv"] >= 45:
        out.append(("volatility", f"Why is {crop} so volatile?"))
    else:
        out.append(("volatility", f"Why is {crop} stable?"))
    if ctx["anomalies"]:
        out.append(("anomaly", "What caused the recent price spike?"))
    out.append(("adv_safest", "Which crop is safest right now?"))
    out.append(("sell_window", "When is the best selling period?"))
    out.append(("historical", f"What was the price in {ctx['last_date'][:4]} vs last year?"))
    out.append(("trend", f"Where is {crop} heading this month?"))
    return [p for intent, p in out if intent != exclude_intent]


# ── Public entry point ───────────────────────────────────────────────────────

def chat(message: str, crop: str, state: str, days: int,
         peers: list[dict], history: list[dict] | None = None) -> dict:
    ctx = build_insight_context(crop, state, days)
    ctx["days"] = days
    provider = get_provider()
    try:
        return provider.respond(message, ctx, peers, history or [])
    except NotImplementedError:
        return RuleBasedProvider().respond(message, ctx, peers, history or [])
