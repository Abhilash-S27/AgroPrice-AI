"""
Conversation context manager (Phase 3).

Stateless server, stateful protocol: the client sends recent turns and this
module reconstructs a working memory per request, then resolves the current
message against it. This gives true multi-turn behaviour (the memory
"survives" turns because the transcript does) without server-side sessions.

Capabilities:
  - entity memory       crops/states mentioned, most-recent-first (decay =
                        only the last N turns are scanned)
  - timeframe memory    full + partial inheritance: "What about Feb?" after
                        "Jan 2020" resolves to Feb 2020
  - intent carry        bare fragments ("and in Kerala?", "in 2021") re-run
                        the previous analytical intent in the new context
  - pronoun references  "is it profitable?" → the active crop
  - comparison memory   "compare with onion" → active crop vs Onion
  - era parsing         covid eras, seasons, quarters, relative years
  - inferred-context    tracking which slots were inherited (drives the
                        "AI inferred context" pills in the UI)
"""
from __future__ import annotations

import re
from datetime import date

import pandas as pd

from backend.utils.constants import SOUTH_INDIAN_STATES
from backend.utils.crop_registry import _ALIAS_INDEX

_MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}
MONTH_LABEL = {v: k.capitalize() for k, v in _MONTHS.items() if len(k) == 3}
_SEASONS = {
    "monsoon": (6, 9), "kharif": (6, 10), "rabi": (11, 3),
    "summer": (3, 5), "winter": (11, 2),
}
_QUARTERS = {"q1": (1, 3), "q2": (4, 6), "q3": (7, 9), "q4": (10, 12)}


# ── Entity extraction ────────────────────────────────────────────────────────

def extract_crops(text: str) -> list[str]:
    """Canonical crops mentioned in free text (aliases + short names aware)."""
    q = text.lower()
    found: list[str] = []
    for key in sorted(_ALIAS_INDEX, key=len, reverse=True):
        if re.search(rf"\b{re.escape(key)}\b", q):
            canonical = _ALIAS_INDEX[key]
            if canonical not in found:
                found.append(canonical)
    return found


def extract_state(text: str) -> str | None:
    q = text.lower()
    for s in SOUTH_INDIAN_STATES:
        if s.lower() in q:
            return s
    return None


# ── Temporal parsing ─────────────────────────────────────────────────────────

def parse_timeframe(text: str) -> dict | None:
    """
    Parse temporal references → {start, end, label} or structured variants:
      {years: [a, b]}            year-vs-year comparison
      {month_range, year}        quarters / seasons
      {month_only: int}          bare month — needs a remembered year
      {relative: ...}            last/this year
      {future_months: n}
      {harvest: True}            crop-specific (resolved by handler)
      {since_anomaly: True}      "after the price spike"
    Eras: 'before covid' (≤2019), 'during covid' (2020–21), 'after covid' (≥2022).
    """
    q = text.lower()

    # covid eras
    if re.search(r"\b(before|pre)[\s-]*covid\b", q):
        return {"start": date(2015, 1, 1), "end": date(2019, 12, 31), "label": "pre-COVID (2015–2019)"}
    if re.search(r"\b(during|in)?\s*covid\b|\bpandemic\b", q):
        return {"start": date(2020, 1, 1), "end": date(2021, 12, 31), "label": "the COVID period (2020–2021)"}
    if re.search(r"\b(after|post)[\s-]*covid\b", q):
        return {"start": date(2022, 1, 1), "end": date(2026, 12, 31), "label": "post-COVID (2022 onwards)"}

    # after the spike/crash
    if re.search(r"\bafter\b.*\b(spike|crash|shock|anomaly)\b", q):
        return {"since_anomaly": True, "label": "since the recent price event"}

    # month + year
    m = re.search(rf"\b({'|'.join(_MONTHS)})\.?,?\s*(20[12]\d)\b", q)
    if m:
        mon, yr = _MONTHS[m.group(1)], int(m.group(2))
        end_day = (pd.Timestamp(yr, mon, 1) + pd.offsets.MonthEnd(0)).day
        return {"start": date(yr, mon, 1), "end": date(yr, mon, end_day),
                "label": f"{MONTH_LABEL[mon]} {yr}"}

    # year(s)
    years = [int(y) for y in re.findall(r"\b(20[12]\d)\b", q)]
    if len(years) >= 2 and re.search(r"\bvs\.?\b|versus|compare", q):
        return {"years": years[:2], "label": f"{years[0]} vs {years[1]}"}
    if years:
        yr = years[0]
        return {"start": date(yr, 1, 1), "end": date(yr, 12, 31), "label": str(yr)}

    # relative years / seasons-with-relative ("last summer")
    m = re.search(r"\blast\s+(monsoon|summer|winter|kharif|rabi)\b", q)
    if m:
        a, b = _SEASONS[m.group(1)]
        return {"month_range": (a, b), "year": "last", "label": f"last {m.group(1)}"}
    if "last year" in q:
        return {"relative": "last_year", "label": "last year"}
    if "this year" in q:
        return {"relative": "this_year", "label": "this year"}

    m = re.search(r"next\s+(\d+)\s*month", q)
    if m:
        return {"future_months": int(m.group(1)), "label": f"next {m.group(1)} months"}

    m = re.search(r"\b(q[1-4])\s*(20[12]\d)?\b", q)
    if m:
        a, b = _QUARTERS[m.group(1)]
        return {"month_range": (a, b), "year": int(m.group(2)) if m.group(2) else None,
                "label": f"{m.group(1).upper()}{' ' + m.group(2) if m.group(2) else ''}"}

    for season, (a, b) in _SEASONS.items():
        if season in q:
            return {"month_range": (a, b), "year": None, "label": f"{season} season"}
    if "harvest" in q:
        return {"harvest": True, "label": "harvest season"}

    # bare month — "what about feb?" (year inherited from memory)
    m = re.search(rf"\b({'|'.join(_MONTHS)})\b\.?\??\s*$", q) or \
        re.search(rf"\babout\s+({'|'.join(_MONTHS)})\b", q) or \
        re.search(rf"\bin\s+({'|'.join(_MONTHS)})\b(?!\s*20)", q)
    if m:
        return {"month_only": _MONTHS[m.group(1)], "label": MONTH_LABEL[_MONTHS[m.group(1)]]}

    return None


def is_followup_fragment(text: str) -> bool:
    """
    True for short follow-ups that carry the previous question's intent:
    'in 2024', 'what about feb?', 'and in kerala?', 'compare with onion',
    'was it profitable then?'.
    """
    q = text.lower().strip()
    words = q.replace("?", "").replace(".", "").split()
    if len(words) > 6:
        return False
    has_anchor = (parse_timeframe(q) is not None
                  or extract_state(q) is not None
                  or bool(extract_crops(q))
                  or bool(re.search(r"\b(it|that|this|then|there)\b", q)))
    starts_like_followup = bool(re.match(
        r"^(and|what about|how about|in|for|with|compare with|vs\.?|versus|was it|is it|then)\b", q))
    return has_anchor and (starts_like_followup or len(words) <= 3)


# ── Conversation memory ──────────────────────────────────────────────────────

class ConversationContext:
    """
    Working memory reconstructed from the client-sent transcript.
    `classify` is injected to avoid a circular import with the chat module.
    """

    def __init__(self, history: list[dict], page_crop: str, page_state: str,
                 classify) -> None:
        self.page_crop, self.page_state = page_crop, page_state
        self._classify = classify
        self.crops: list[str] = []        # most recent first
        self.state: str | None = None
        self.last_intent: str | None = None
        self.last_timeframe: dict | None = None

        for turn in history[-8:]:         # decay: older turns fall away
            if turn.get("role") != "user":
                continue
            text = turn.get("text", "")
            for c in extract_crops(text):
                if c in self.crops:
                    self.crops.remove(c)
                self.crops.insert(0, c)
            st = extract_state(text)
            if st:
                self.state = st
            intent = classify(text)
            if intent not in ("greeting", "thanks", "help", "unknown"):
                self.last_intent = intent
            tf = parse_timeframe(text)
            if tf and not tf.get("month_only"):
                self.last_timeframe = tf

    # ── resolution ───────────────────────────────────────────────────────────

    def resolve(self, message: str) -> dict:
        """
        Effective {intent, crop, state, timeframe, crops_mentioned, inferred}
        for this turn. `inferred` lists slots inherited from memory rather
        than stated in the message — the UI shows these as context pills.
        """
        crops_now = extract_crops(message)
        state_now = extract_state(message)
        tf_now = parse_timeframe(message)
        intent = self._classify(message)
        inferred: list[str] = []

        followup = is_followup_fragment(message)

        # "compare with onion" — comparison follow-up keeps the active crop
        if re.match(r"^\s*(compare( it| this)?( with| to)?|vs\.?|versus)\b", message.lower()):
            intent = "compare"

        # bare fragments inherit the previous analytical intent
        if followup and intent in ("unknown", "price_now", "historical"):
            carried = self.last_intent or intent
            if carried not in ("greeting", "thanks", "help", "unknown"):
                if intent != carried:
                    inferred.append(f"intent: {carried.replace('_', ' ')}")
                intent = carried
            if intent in ("price_now", "trend") and (tf_now or self.last_timeframe):
                intent = "historical"
        # any unmatched question with a temporal reference is historical
        if intent == "unknown" and tf_now:
            intent = "historical"
        if intent == "compare" and (tf_now or {}).get("years"):
            intent = "historical"

        # crop: stated > remembered > page selection
        if crops_now:
            crop = crops_now[0]
        elif self.crops and (followup or re.search(r"\b(it|that|this)\b", message.lower())):
            crop = self.crops[0]
            inferred.append(f"crop: {crop}")
        elif self.crops:
            crop = self.crops[0]
            inferred.append(f"crop: {crop}")
        else:
            crop = self.page_crop

        # state: stated > remembered > page selection
        if state_now:
            state = state_now
        elif self.state:
            state = self.state
            inferred.append(f"state: {state}")
        else:
            state = self.page_state

        # timeframe: merge partial references with memory
        timeframe = tf_now
        if tf_now and tf_now.get("month_only"):
            year = self._year_from_memory()
            if year:
                mon = tf_now["month_only"]
                end_day = (pd.Timestamp(year, mon, 1) + pd.offsets.MonthEnd(0)).day
                timeframe = {"start": date(year, mon, 1), "end": date(year, mon, end_day),
                             "label": f"{MONTH_LABEL[mon]} {year}"}
                inferred.append(f"year: {year}")
            else:
                timeframe = {"month_range": (tf_now["month_only"], tf_now["month_only"]),
                             "year": None, "label": tf_now["label"]}
        elif timeframe is None and intent == "historical" and self.last_timeframe:
            timeframe = self.last_timeframe
            inferred.append(f"period: {self.last_timeframe.get('label', '')}")

        return {
            "intent": intent, "crop": crop, "state": state,
            "timeframe": timeframe, "crops_mentioned": crops_now,
            "inferred": inferred,
        }

    def _year_from_memory(self) -> int | None:
        tf = self.last_timeframe or {}
        if tf.get("start"):
            s = tf["start"]
            return s.year if hasattr(s, "year") else int(str(s)[:4])
        if tf.get("years"):
            return tf["years"][-1]
        return None
