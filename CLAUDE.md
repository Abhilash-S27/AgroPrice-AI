# AgroPrice AI — Project Memory for Claude Code

## Project Identity

**AgroPrice AI** is an Agentic Agricultural Intelligence System for South Indian crop markets.
It provides price forecasting, AI-narrated insights, and multi-turn conversational advisory
for farmers, traders, and agri-businesses across Tamil Nadu, Karnataka, Andhra Pradesh, Kerala, and Telangana.

Data source: AGMARKNET dataset (2015–2026), stored as yearly Parquet files, queried via DuckDB.

---

## Technology Stack

| Layer        | Technology                                       |
|--------------|--------------------------------------------------|
| Backend      | FastAPI + uvicorn, Python 3.13                   |
| Data engine  | DuckDB, Pandas, PyArrow                          |
| ML/Forecast  | Prophet, XGBoost, custom sparse-trend model      |
| LLM layer    | Gemini 2.5 Flash (`google-generativeai 0.8.6`)   |
| Config       | pydantic-settings (loads from `backend/.env`)    |
| Frontend     | React + Vite + TailwindCSS                       |
| Reports      | openpyxl (Excel), reportlab (PDF)                |

---

## CRITICAL Architecture Rule — Deterministic vs LLM Responsibilities

This boundary must NEVER be violated:

### Deterministic Engine owns (truth source)
- Crop price retrieval (DuckDB queries)
- Price trend calculation (% change, direction)
- Volatility scoring
- Anomaly detection
- Forecast values (7d / 30d / 90d) via Prophet / XGBoost
- Confidence scores and model evaluation metrics
- Seasonality patterns (crop registry)
- All numeric outputs presented to users

### LLM layer (Gemini) owns
- Reasoning ABOUT deterministic data
- Natural language narration of forecasts
- Conversational advisory (multi-turn)
- Strategy explanation ("should I sell now?")
- Anomaly explanation in plain language
- Seasonal pattern interpretation

### LLM must NEVER
- Invent prices, forecasts, volatility values, or confidence scores
- Generate numeric predictions without deterministic backing
- Answer questions outside agricultural domain (see guardrails)
- Receive or expose the GEMINI_API_KEY to the frontend

---

## Folder Responsibilities

```
backend/
├── core/           Config (Settings), logger, database connection
├── data/           DuckDB queries, data pipeline, schema models, analytics
├── ml/             Forecasting models (Prophet, XGBoost, sparse-trend)
├── ai/             Legacy AI advisor stubs (BaseAdvisor, GeminiAdvisor placeholder)
│   └── prompts/    Existing prompt templates (templates.py)
├── services/       NEW (Phase 1A) — orchestration layer
│   ├── llm/        GeminiProvider, PromptBuilder, ResponseGuardrails
│   ├── advisor_ai_router.py       (Phase 1B scaffold)
│   ├── advisor_context_builder.py (Phase 1B scaffold)
│   └── advisor_memory_manager.py  (Phase 1B scaffold)
├── api/routes/     FastAPI route handlers
├── cache/          Forecast cache, query cache
├── reports/        Excel/PDF report generators
└── utils/          Crop registry, validators, constants, date/price utils
```

---

## Completed Phases

### Forecast System (Phases 1–4, complete)
- 27-crop registry with tier A/B/C/D support
- Prophet + XGBoost + sparse-trend forecasting engine
- Confidence scoring and model evaluation
- AI narrative generation (Claude-based, existing)
- Conversational forecast intelligence
- Volatility and anomaly detection
- Seasonality analysis
- Executive dashboard (command center, pair-matrix heatmaps, opportunity matrix)
- Strategy planner and battle analysis
- PDF/Excel report generation
- Multi-agent visual orchestration

### Phase 1A — Gemini Foundation (COMPLETE)
- `google-generativeai 0.8.6` installed
- `backend/services/llm/gemini_provider.py` — full implementation
- `backend/services/llm/prompt_builder.py` — full implementation
- `backend/services/llm/response_guardrails.py` — full implementation
- `backend/test_gemini.py` — 5-test verification suite
- `backend/services/advisor_ai_router.py` — scaffold
- `backend/services/advisor_context_builder.py` — scaffold
- `backend/services/advisor_memory_manager.py` — scaffold
- CLAUDE.md created

### Phase 1B — Grounded Conversational Intelligence (COMPLETE)
- `AdvisorContextBuilder.build()` — delegates to `build_insight_context()` (reuse, no duplication)
  - Volatility, momentum, seasonal, anomaly, tier, quality all wired
  - Cached forecast extraction (7d / 30d / 90d prices)
  - Graceful None handling for missing fields
- `AdvisorAIRouter.route_advisor_query()` — full end-to-end pipeline
  - Guardrails → memory → intent → context → prompt → Gemini → memory store
- `AdvisorMemoryManager` — in-process session store (TTL 2h, max 10 turns per session)
  - Crop/state inheritance on follow-up questions
  - History injected as `additional_facts` section in prompt
- `AdvisorResponse` extended: `intent`, `inferred_context` fields added
- `/api/advisor/ask` fully wired — `/api/advisor/history` implemented
- Guardrails upgraded: hard/soft domain split (coding/crypto always blocked; others need no agri offset)
- `frontend/src/services/advisorService.js` — calls `/api/advisor/ask`
- `frontend/src/components/ai/AdvisorChat.jsx` — conversational UI with crop/state selectors
- `frontend/src/pages/AIAdvisor.jsx` — Phase 5 placeholder replaced with live `AdvisorChat`
- `backend/test_advisor_pipeline.py` — 7/7 tests pass

---

## AI Advisor Roadmap

### Phase 1C — Enhanced Grounding (COMPLETE — 2026-06-13)
- Database wired into test pipeline: `db_manager.connect()` + `run_ingestion_pipeline()` called in `main()` before any test — Test 4 (context builder) now runs live against real data
- `price_min_30d` / `price_max_30d` added to `build_insight_context()` return dict (computed from `df["y"].tail(30)` — same df already fetched, no extra DuckDB call). Wired into `PromptContext` in `advisor_context_builder.py`. Prompt section `_build_market_section()` already rendered the 30-day range line — now it has real data.
- Optional Redis backend: `RedisMemoryManager` added to `advisor_memory_manager.py`. Activated via `ADVISOR_MEMORY_BACKEND=redis` in `backend/.env`. Falls back to in-process store if `redis` package is absent or the server is unreachable. Factory function `_create_memory_manager()` selects the backend at import time. `active_session_count()` method added to both backends.
- `DELETE /api/advisor/session/{id}` endpoint added to `advisor.py` — returns `{session_id, status, existed}`. Idempotent.
- Debug route updated: `active_sessions` now uses `memory_manager.active_session_count()` (works with both backends); `backend` field added showing which class is in use.
- Test suite extended to 9 tests: Test 8 (30d price range), Test 9 (session delete)

### Phase 2 — Streaming + Advanced Grounding
- Real-time streaming Gemini responses (FastAPI SSE / WebSocket)
- Proactive anomaly alerts via advisor
- Advisor panel integration within Forecast page (context auto-injected)

### Phase 3 — Advanced Agentic Features
- Multi-agent crop comparison
- Automated strategy generation
- Proactive alert system (price anomaly notifications)
- Report-augmented advisory (AI explains the PDF)

---

## Gemini Integration Status (Phase 1A)

| Component            | File                                      | Status    |
|----------------------|-------------------------------------------|-----------|
| API key              | `backend/.env` (GEMINI_API_KEY)           | Loaded    |
| Settings             | `backend/core/config.py` (Settings.GEMINI_API_KEY) | Ready |
| SDK                  | `google-generativeai==0.8.6`              | Installed |
| Model                | `gemini-2.5-flash`                        | Configured|
| Provider             | `backend/services/llm/gemini_provider.py` | Complete  |
| Prompt builder       | `backend/services/llm/prompt_builder.py`  | Complete  |
| Guardrails           | `backend/services/llm/response_guardrails.py` | Complete |
| Test script          | `backend/test_gemini.py`                  | Complete  |

---

## Grounding Philosophy

Every Gemini response is **grounded** — meaning the LLM receives factual
agricultural metrics from the deterministic engine BEFORE generating language.
It reasons ABOUT truth, it does not CREATE truth.

This prevents:
- Hallucinated prices
- Invented forecasts
- Overconfident predictions without data backing
- Domain drift to non-agricultural topics

The `PromptContext` dataclass is the contract between deterministic and LLM layers.
All fields are Optional — missing data is handled gracefully, never invented.

---

## Guardrails Summary

`response_guardrails.py` blocks:
- Prompt injection attempts
- Software development questions
- Politics
- Cooking/recipes
- Entertainment
- Non-agricultural financial markets (equity, crypto, etc.)
- Medical advice
- Legal advice

All blocks return professional agricultural redirects, never raw errors.

---

## Security

- `backend/.env` is in `.gitignore` — API key never committed to git
- Frontend has NO access to GEMINI_API_KEY
- All Gemini calls go through `GeminiProvider` (backend only)
- API key is loaded via pydantic-settings + python-dotenv (not hardcoded)

---

## Phase 1B Routing Architecture

```
Frontend → POST /api/advisor/ask
             ↓
         AdvisorRequest (question, crop, state, session_id)
             ↓
         validate_crop() / validate_state()   ← validators.py
             ↓
         route_advisor_query()                ← advisor_ai_router.py
             ├── sanitize_prompt()            ← response_guardrails.py
             ├── enforce_agriculture_scope()  ← response_guardrails.py (hard+soft blocks)
             ├── memory_manager.get_or_create_session()  ← advisor_memory_manager.py
             │     └── crop/state inheritance from session
             ├── classify_intent()            ← forecast_ai_chat.py (rule-based, no LLM)
             ├── advisor_context_builder.build()  ← advisor_context_builder.py
             │     └── build_insight_context()   ← ai_forecast_narrator.py (DuckDB + pandas)
             │           ├── compute_volatility_metrics()  ← analytics.py
             │           ├── compute_momentum_signal()     ← analytics.py
             │           ├── compute_seasonal_profile()    ← analytics.py
             │           ├── detect_price_anomalies()      ← analytics.py
             │           └── get_cached_forecast()         ← forecast_cache.py
             ├── memory_manager.get_history_string()  → injected into PromptContext
             ├── build_grounded_prompt()      ← prompt_builder.py
             └── GeminiProvider.generate()   ← gemini_provider.py
                   └── response stored in memory_manager
             ↓
         AdvisorResponse (answer, intent, sources, inferred_context, session_id)
```

## Phase 1B Memory Behaviour

- Session ID: generated by client (`advisorService.newSessionId()`) or server fallback
- Crop/state inheritance: if turn N omits crop, session's `last_crop` is used
- `inferred_context` field in response tells the frontend what was inherited
- History: last 3 turns injected as `recent_conversation` in `additional_facts`
- TTL: 2 hours inactivity per session; FIFO eviction at 10 turns

## Key Configuration

```python
# backend/core/config.py — Settings class (pydantic-settings)
GEMINI_API_KEY: str          # loaded from backend/.env
DEFAULT_AI_ADVISOR: str      # "claude" | "gemini"
DEFAULT_FORECAST_DAYS: int   # 90
```

---

## Development Notes

- Run backend: `python -m uvicorn backend.main:app --port 8001` (from project root — port 8001 required, matches start.bat and frontend config)
- Run Gemini test: `python -m backend.test_gemini` (from project root)
- Linting: `ruff check backend/`
- Tests: `pytest tests/`
- Frontend: `cd frontend && npm run dev`

---

## Important Architectural Constraints

1. Never replace deterministic forecasting with LLM-generated forecasts
2. Never expose API keys to the frontend
3. Keep `services/llm/` provider-agnostic (Gemini today, easily swappable)
4. Build for multi-agent future — services are stateless and injectable
5. PromptContext fields must come from real data, never placeholder values
6. All Gemini calls use low temperature (0.2) to enforce consistency
7. The `enforce_agriculture_scope()` guardrail must be called before EVERY LLM call

---

## Phase 1B — Debugging & Stabilization (completed 2026-06-13)

### Root causes found

1. **GEMINI_API_KEY never loaded (primary).** The key lives in `backend/.env`, but
   `Settings(env_file=".env")` and `load_dotenv()` resolve relative to the process
   CWD — uvicorn runs from the project root, where no `.env` exists. The provider
   silently fell back ("API key not configured").
   **Fix:** both `backend/core/config.py` and `backend/services/llm/gemini_provider.py`
   now anchor the env file to the backend package directory
   (`Path(__file__).resolve().parents[...] / ".env"`), CWD-independent.

2. **HTTP 500 on /api/advisor/ask (secondary).** The long-running backend process
   predated the advisor modules; the lazy import inside the route handler hit
   stale/partial code. A clean restart resolved it. The route now wraps the pipeline
   so any future internal failure returns a structured 502, never a bare 500.

### Stabilization added

- **Structured error categories** from `/ask`: `validation_error` (422) and
  `pipeline_error` (502), each `{category, message}` with user-safe copy. The
  frontend (`AdvisorChat.describeAdvisorError`) maps categories — including true
  network failures — to distinct messages (the old code also crashed React when
  `detail` was an object).
- **Stage-by-stage pipeline tracing** in `advisor_ai_router.py`:
  sanitize → guardrail → memory → intent → context → history → prompt → gemini,
  each logged via `backend.core.logger` with timings, and stored in a rolling
  `last_trace` for observability.
- **`GET /api/advisor/debug`** — route status, Gemini readiness/key/model, active
  memory sessions, and the full stage trace of the most recent request.
- **Dev-only diagnostics panel** in `AdvisorChat.jsx` (renders only when
  `import.meta.env.DEV`) showing the same data inline.
- **`backend/test_live_advisor_request.py`** — live health suite: grounded
  Tomato/Karnataka outlook, follow-up memory inheritance, safest-crop, volatility,
  seasonal reasoning, off-domain rejection, plus the printed stage trace.
  Run with: `python -m backend.test_live_advisor_request` (server on :8001).

### Verified live (all PASS)

- Gemini 2.5 Flash responds with grounded content citing the injected metrics
  ("Based on the ML engine output…", real volatility CV referenced).
- Follow-up without crop/state inherits `crop: Tomato, state: Karnataka` from
  session memory (`inferred_context` confirms).
- Off-domain ("write me a Python script") rejected by guardrails in ~4 ms —
  Gemini is never invoked for out-of-scope queries.
- Browser: AdvisorChat renders live answers, intent chips, sources, and the dev
  diagnostics panel; no console errors.

### Known limitations (Phase 1C candidates)

- Suggested-prompt chips mention crops in text, but grounding only activates when
  the crop/state *selectors* are set (or inherited from memory) — the advisor does
  not yet extract entities from free text the way the Forecast copilot does.
- Memory remains per-process (Redis backend deferred, as designed).
- `google-generativeai 0.8.6` is deprecated upstream; migration to `google-genai`
  is recommended before any SDK-breaking change.

---

## Phase 2 — Gemini Runtime Stabilization (COMPLETE — 2026-06-13)

### Root cause (quota/auth session)

The new API key in `backend/.env` was not picked up by the running process because
`_gemini = GeminiProvider()` is a module-level singleton initialized at import time.
Changing the `.env` file requires a **full backend restart** (`Ctrl+C` + re-run uvicorn).
The env-file anchoring fix from Phase 1B is correct; the stale provider simply needed
a process restart, not a code fix. Now documented explicitly.

### SDK migration

`google-generativeai 0.8.6` (deprecated) → `google-genai 2.8.0` (current).

| What changed                 | Old SDK                                     | New SDK                                    |
|------------------------------|---------------------------------------------|--------------------------------------------|
| Import                       | `import google.generativeai as genai`       | `from google import genai`                 |
| Configure                    | `genai.configure(api_key=key)`              | `genai.Client(api_key=key)`                |
| Model init                   | `genai.GenerativeModel(model_name=...)`     | No model object — pass `model=` per call   |
| Async call                   | `asyncio.to_thread(model.generate_content)` | `await client.aio.models.generate_content` |
| Safety settings              | Separate `HarmCategory` enum                | `types.SafetySetting(category=str, ...)`   |
| Error base class             | `google.api_core.exceptions.*`              | `google.genai.errors.APIError`             |
| Status code                  | Exception type encodes status               | `exc.code` attribute (int)                 |

### Structured error handling

`GeminiProvider.generate()` now returns `GeminiResult(text, error_type, latency_ms)` instead of `str`.

| error_type         | Trigger                                    | Retry? |
|--------------------|--------------------------------------------|--------|
| `None`             | Success                                    | —      |
| `quota_exceeded`   | HTTP 429 or "resource exhausted" message   | No     |
| `invalid_key`      | HTTP 401/403 or "api key" / "permission"   | No     |
| `key_not_configured` | GEMINI_API_KEY not set in .env           | No     |
| `safety_blocked`   | Gemini safety filter triggered             | No     |
| `empty_response`   | API returned blank text                    | No     |
| `timeout`          | asyncio.TimeoutError (30s default)         | Yes ×2 |
| `server_error`     | HTTP 5xx from Gemini                       | Yes ×2 |
| `network_error`    | Connection-level failure                   | Yes ×2 |

Retry uses exponential backoff: delay = `1.0 × 2^attempt` seconds.
`quota_exceeded` and `invalid_key` are never retried (not transient).

### Files changed

- **`backend/services/llm/gemini_provider.py`** — full rewrite:
  - Migrated to `google-genai 2.8.0` native async client
  - `GeminiResult` dataclass (text, error_type, latency_ms)
  - Structured error classification for all failure modes
  - Exponential retry for transient errors
  - Masked key logging on startup (prefix+suffix only, never full key)

- **`backend/services/advisor_ai_router.py`** — updated:
  - Uses `GeminiResult` instead of raw `str` from `generate()`
  - `error_type`, `latency_ms`, `grounded` now in trace and result dict

- **`backend/data/schema/models.py`** — `AdvisorResponse` extended:
  - `error_type: str | None`
  - `latency_ms: float`
  - `grounded: bool`

- **`backend/api/routes/advisor.py`** — added:
  - `GET /api/advisor/health` — gemini_configured, gemini_ready, duckdb_ready, model, memory_backend
  - Passes new fields through to `AdvisorResponse`

- **`backend/main.py`** — startup validation:
  - Imports `_gemini` singleton and logs its readiness + model on startup
  - Warns cleanly if key is missing — never crashes startup

- **`frontend/src/components/ai/AdvisorChat.jsx`** — enhanced:
  - `GeminiErrorBadge` maps each error_type to a friendly badge + actionable message
  - `GroundedIndicator` shows "Grounded" (green) or "General" (gray) per message
  - Latency shown in ms next to each AI response
  - "Select crop & state" hint when no context is active
  - `AdvisorDebugPanel` enhanced: fetches `/health` + `/debug` in parallel,
    shows gemini/duckdb/memory status, grounded/intent/latency/error_type per message

- **`backend/test_gemini_resilience.py`** — new 11-test suite:
  - Tests 1–9: unit tests (mocked) for env, init, key masking, all error types, retry
  - Test 10: health endpoint schema (skipped if server not running)
  - Test 11: live Gemini call (skipped if quota/key issue)
  - All 11/11 PASS verified

### Startup validation (important operational note)

The `_gemini` singleton is created at module **import** time in `advisor_ai_router.py`.
Changing `GEMINI_API_KEY` in `backend/.env` requires a **full server restart** to take effect.
A hot-reload (`--reload`) does NOT reinitialize module-level globals.
On restart, `main.py` logs `Gemini AI Advisor ready: model=gemini-2.5-flash` if the key loaded correctly,
or a clear `WARNING` with instructions if the key is missing.

### Health endpoint

```
GET /api/advisor/health
{
  "gemini_configured": true,
  "gemini_ready":      true,
  "duckdb_ready":      true,
  "model":             "gemini-2.5-flash",
  "memory_backend":    "InProcessMemoryManager"
}
```

### Quota handling

When quota is exhausted:
- `error_type = "quota_exceeded"` is set on the `AdvisorResponse`
- Frontend renders an amber badge: "Quota Exceeded — Free-tier quota exhausted — responses will resume shortly."
- Gemini is NOT retried (quota reset is time-based, not request-based)
- The fallback text advises checking the Forecast section for price data

### Remaining limitations

- Suggested-prompt chips do not extract crop/state from free text; users must use dropdowns
  for grounded responses on first turn (memory handles follow-up inheritance).
- Redis memory backend remains opt-in via `ADVISOR_MEMORY_BACKEND=redis` in `.env`.
- Streaming responses (SSE) deferred to Phase 3.

---

## Phase 3 — E2E Runtime Debug & Frontend–Backend Connectivity Fix (COMPLETE — 2026-06-13)

### Root Causes Found & Fixed

#### 1. Port mismatch (PRIMARY — caused "Network error — the backend is not reachable")

`start.bat` starts the backend on **port 8001**, but the frontend was hardcoded to **port 8000**.

| File | Old value | Fixed value |
|------|-----------|-------------|
| `frontend/src/services/api.js` (line 8) | `http://localhost:8000` | `http://localhost:8001` |
| `frontend/vite.config.js` proxy target | `http://localhost:8000` | `http://localhost:8001` |

Also created `frontend/.env` with `VITE_API_BASE_URL=http://localhost:8001` so the URL
is explicit and environment-configurable without touching code.

**Why the mismatch existed:** The Development Notes in CLAUDE.md said
`uvicorn backend.main:app --reload` (default port 8000), but `start.bat` always ran on 8001.
The frontend was written against the docs, not the actual launcher.

#### 2. Gemini 2.5 Flash thinking tokens consuming response budget (SECONDARY — caused truncated answers)

Gemini 2.5 Flash has thinking enabled by default. Thinking tokens compete with output tokens
for the `max_output_tokens` budget, leaving only ~44 tokens (~176 chars) for the actual response.
Responses were cut off mid-sentence with unclosed markdown (`**price trend is currently rising`).

**Fix:**
- Added `thinking_config=types.ThinkingConfig(thinking_budget=0)` to disable thinking
- Increased `max_output_tokens` from 1024 → 2048

Since all facts are pre-injected via `PromptContext`, Gemini is narrating rather than reasoning —
thinking provides no value here and only eats the token budget.

**Before:** 176 chars, truncated, ~6 seconds, `finish=MAX_TOKENS`
**After:** 1325 chars, complete, ~3 seconds, `finish=STOP`

#### 3. Backend process dying between sessions

The background process started via the Bash tool is tied to the session and dies when the
session ends. Use `start.bat` or a persistent terminal (PowerShell window) for long-running dev.

### Files Changed

- `frontend/src/services/api.js` — default baseURL 8000 → 8001
- `frontend/vite.config.js` — proxy target 8000 → 8001
- `frontend/.env` — NEW: explicit `VITE_API_BASE_URL=http://localhost:8001`
- `backend/services/llm/gemini_provider.py`:
  - `thinking_config=types.ThinkingConfig(thinking_budget=0)` added to `_GENERATION_CONFIG`
  - `max_output_tokens` 1024 → 2048
  - `finish_reason` now logged per call for observability

### Verified End-to-End (all PASS — 2026-06-13)

| Check | Result |
|-------|--------|
| Backend starts on :8001 | ✓ |
| DuckDB connects | ✓ |
| Gemini ready (`key_prefix` logged) | ✓ |
| `/api/advisor/health` → all true | ✓ |
| `/api/advisor/ask` Tomato/Karnataka | ✓ `grounded=true`, 1325 chars, `finish=STOP` |
| `/api/advisor/ask` Onion/Tamil Nadu (CORS origin header) | ✓ grounded response |
| Off-domain guardrail (Python script request) | ✓ `intent=rejected`, 0ms latency |
| CORS preflight from `localhost:5173` | ✓ `allow-origin` header present |
| Frontend `api.js` baseURL | ✓ `http://localhost:8001` |
| Vite proxy target | ✓ `http://localhost:8001` |
| Vite starts on :5173 | ✓ |

### Operational Restart Procedure

**Always use `start.bat`** from the project root — it starts both servers in named terminal windows:
```
start.bat                   # backend :8001 + frontend :5173
```

Manual (from project root):
```powershell
# Terminal 1
python -m uvicorn backend.main:app --port 8001

# Terminal 2
cd frontend && npm run dev
```

**After changing `backend/.env`**: full backend restart required (hot-reload does NOT reinitialize
the `_gemini` singleton created at module import time).

### Known Dual-SDK State

Both `google-generativeai 0.8.6` (old, deprecated) and `google-genai 2.8.0` (new) are installed.
The current `gemini_provider.py` uses only the new SDK (`from google import genai`).
Run `pip uninstall google-generativeai` to clean up the deprecated package when convenient.

---

## Phase 2A — Voice AI + Historical Market Intelligence (COMPLETE — 2026-06-13)

### What Was Built

10-part upgrade to the AI Advisor: voice input/output, historical AGMARKNET retrieval,
improved response rendering, expanded intent detection.

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useSpeechRecognition.js` | Web Speech API STT hook (Chrome/Edge) |
| `frontend/src/hooks/useTextToSpeech.js` | speechSynthesis TTS hook, strips markdown before speaking |
| `backend/services/historical_query_parser.py` | Regex parser: free text → HistoricalQuery struct |
| `backend/services/historical_market_service.py` | Real AGMARKNET retrieval via DuckDB (NO hallucination) |
| `backend/test_historical_queries.py` | 14-test suite: 7 parser + 6 service + 1 router integration |

### Modified Files

| File | Change |
|------|--------|
| `backend/services/forecast_ai_chat.py` | 6 new historical intents in `_INTENT_PATTERNS` |
| `backend/services/llm/prompt_builder.py` | `historical_summary` field in `PromptContext`; `_build_historical_section()` |
| `backend/services/advisor_ai_router.py` | Step 5b: parse → fetch_historical → inject into PromptContext |
| `frontend/src/components/ai/AdvisorChat.jsx` | Mic button, speaker button per message, markdown renderer |

### Historical Query Pipeline

```
User: "What was tomato price in October 2019?"
    ↓
parse_historical_query()          → HistoricalQuery(type=month_year, year=2019, month=10)
    ↓
fetch_historical(crop, state, ...) → HistoricalResult(found=True, summary="HISTORICAL DATA — ...")
    ↓
prompt_ctx.historical_summary = hist.summary   ← injected verbatim into Gemini prompt
    ↓
_build_historical_section()    → "HISTORICAL MARKET DATA (retrieved from AGMARKNET):\n..."
    ↓
Gemini narrates ABOUT the data (never invents)
    ↓
grounded=True, sources includes "AGMARKNET historical database (2015-2026)"
```

### New Intents (forecast_ai_chat.py)

| Intent | Trigger pattern |
|--------|----------------|
| `all_time_peak` | "highest ever", "all-time high", "record high" |
| `all_time_trough` | "lowest ever", "all-time low", "record low" |
| `yearly_comparison` | "2019 vs 2024", "between 2018 and 2022" |
| `trend_analysis` | "long-term trend", "year by year", "price evolution" |
| `historical_price` | "what was the price in 2020", "price in October 2019" |
| `seasonal_history` | "historically in January", "March prices historically" |

### Historical Market Service — Query Types

| query_type | Function | Example question |
|-----------|---------|----------------|
| `month_year` | `get_price_for_month(crop, state, year, month)` | "Tomato price in June 2021" |
| `yearly_avg` | `get_yearly_average(crop, state, year)` | "What was the average in 2022?" |
| `comparison` | `compare_periods(crop, state, y1, y2)` | "2019 vs 2023" |
| `all_time_peak` | `get_peak_year(crop, state)` | "Best year ever?" |
| `all_time_trough` | `get_peak_year(crop, state)` | "Worst year for prices?" |
| `monthly_pattern` | `get_monthly_pattern(crop, state, month)` | "January prices historically" |
| `trend_evolution` | `get_historical_trend(crop, state)` | "Long-term trend over the years" |

All functions return `HistoricalResult(found, summary, details)`.
`found=False` means no data — Gemini is told to acknowledge this transparently.

### Voice UI (AdvisorChat.jsx)

- **Mic button** (appears when `SpeechRecognition` supported — Chrome/Edge):
  - Animated pulse + red border when listening
  - Interim transcripts shown above input bar as preview
  - Final transcript appended to input field
- **Speaker button** on each AI message (appears when `speechSynthesis` supported):
  - Reads response aloud in Indian English (en-IN voice preferred)
  - Strips `**bold**`, `*italic*`, `₹→rupees`, `/qtl→per quintal` before speaking
  - Click again to stop
- **Markdown renderer** (`renderAdvisorMarkdown`):
  - `**bold**` → `<strong>`, `*italic*` → `<em>`
  - Bullet lists (`- `, `• `, `* `) → `<ul>` with proper spacing
  - Numbered lists → `<ol>`
  - `### headings` → styled paragraph
  - Prices `₹X,XXX` and percentages highlighted in emerald

### Grounded Flag Extended

Previously `grounded = current_modal_price is not None`.
Now: `grounded = current_modal_price is not None OR historical_summary is not None`.
Historical queries now correctly show the "Grounded" badge.

### Test Results (parser — 7/7 PASS verified, no server needed)

```
python -m backend.test_historical_queries
```

Tests 1–7: parser logic (no DB)
Tests 8–13: live AGMARKNET retrieval (requires DB)
Test 14: router integration (requires DB + backend imported)

### Architecture Invariants (unchanged)

1. `fetch_historical()` uses ONLY real DuckDB data — returns `found=False` if absent
2. Gemini receives `historical_summary` verbatim and is instructed not to alter values
3. `historical_query_parser.py` has zero DuckDB calls — pure regex/dataclass
4. Voice UI hooks (`useSpeechRecognition`, `useTextToSpeech`) are stateless, unmount-safe
5. All numeric outputs in `HistoricalResult.summary` come from `df["y"]` — never invented

---

## Phase 2B - Agentic Agricultural Intelligence System (COMPLETE - 2026-06-13)

### What Was Built

Multi-agent AI architecture with proactive market briefing, explainable AI panels,
heuristic scenario simulation, and smart AI insight cards.

### Multi-Agent Architecture

All agents are pure Python - deterministic, no Gemini calls.
ONLY advisor_ai_router.py controls Gemini access.

| Agent | File | Verdict Types |
|-------|------|--------------|
| TrendAgent | backend/services/agents/trend_agent.py | STRONG_BULLISH..STRONG_BEARISH |
| RiskAgent | backend/services/agents/risk_agent.py | LOW_RISK..EXTREME_RISK |
| SeasonalAgent | backend/services/agents/seasonal_agent.py | DEEP_PEAK..DEEP_TROUGH |
| RecommendationAgent | backend/services/agents/recommendation_agent.py | SELL_NOW..WATCH |
| MarketBriefingAgent | backend/services/agents/market_briefing_agent.py | Orchestrator |

### New Backend Files

| File | Purpose |
|------|---------|
| backend/services/agents/__init__.py | Package - exports analyze() functions |
| backend/services/agents/trend_agent.py | Momentum and price direction |
| backend/services/agents/risk_agent.py | Volatility and anomaly risk scoring |
| backend/services/agents/seasonal_agent.py | Seasonal positioning |
| backend/services/agents/recommendation_agent.py | SELL/HOLD/WAIT verdict |
| backend/services/agents/market_briefing_agent.py | 4-agent orchestrator |
| backend/services/market_briefing_engine.py | get_market_briefing(), get_proactive_insights() |
| backend/services/scenario_engine.py | Heuristic what-if simulation (8 scenario types) |
| backend/api/routes/briefing.py | GET /api/briefing/{crop}/{state}, POST /api/briefing/scenario, GET /api/briefing/proactive |
| backend/test_agentic_ai.py | 13-test suite: 11/13 PASS (2 skip: DB not connected) |

### Modified Backend Files

- backend/services/advisor_context_builder.py - Added build_with_raw() and _build_from_insight() to avoid double DuckDB calls; agents receive raw context alongside PromptContext
- backend/services/advisor_ai_router.py - Added Step 5c: agent pipeline; agent_insights injected into PromptContext.additional_facts and returned in AdvisorResponse
- backend/data/schema/models.py - AdvisorResponse extended with agent_insights: dict
- backend/api/routes/advisor.py - Passes agent_insights through to response
- backend/main.py - Registers /api/briefing router

### New Frontend Files

| File | Purpose |
|------|---------|
| frontend/src/components/ai/AIMarketBriefing.jsx | Proactive signals + per-crop deep briefing panel |
| frontend/src/components/ai/AISimulationPanel.jsx | What-if scenario simulation UI |
| frontend/src/components/ai/AIReasoningPanel.jsx | Collapsible "Why AI suggested this" explainability |
| frontend/src/components/ai/AIRiskCard.jsx | Visual risk meter card |
| frontend/src/components/ai/AIRecommendationCard.jsx | Verdict badge + opportunity bar |
| frontend/src/services/briefingService.js | API calls: getMarketBriefing, getProactiveInsights, simulateScenario |

### Modified Frontend Files

- frontend/src/components/ai/AdvisorChat.jsx - Added AIReasoningPanel import; agent_insights stored per message; renders AIReasoningPanel on every AI response
- frontend/src/pages/AIAdvisor.jsx - Added AIMarketBriefing + AISimulationPanel in 2-column grid; badge updated to "Phase 2B - Agentic AI"

### Scenario Engine Templates

8 recognized scenario types (auto-detected via keyword matching):
- rainfall_decrease: price up (drought impact)
- rainfall_increase: price down (supply boost)
- supply_increase: price down (bumper harvest)
- supply_decrease: price up (crop failure)
- transport_cost_rise: price up (6% base)
- demand_spike: price up (festive/export)
- market_disruption: price up (bandh/closure)
- export_restriction: price down (domestic surplus)
- generic: uncertain (fallback)

Impact is scaled by stated magnitude (e.g. "40%" = 4x) and crop volatility (CV).

### Architectural Invariants (Phase 2B)

1. Agents are stateless pure Python - no I/O, no LLM, no side effects
2. run_briefing() accepts insight_context dict and returns a briefing dict - no DB calls inside agents
3. build_with_raw() avoids a second build_insight_context() call - single DuckDB fetch
4. AIReasoningPanel shows agent verdicts only when agent_insights is non-empty
5. Scenario engine is explicitly heuristic - always includes a disclaimer
6. Gemini NEVER called from agent files - enforced by architecture (no gemini_provider import)

### Test Results

Run: python -m backend.test_agentic_ai

Tests 1-10: pure Python (no DB) - 10/10 PASS
Test 11: build_with_raw (requires DB) - SKIP if not connected
Test 12: get_market_briefing (requires DB) - PASS (graceful fallback)
Test 13: get_proactive_insights (requires DB) - SKIP if not connected
Total: 11/13 PASS  0 FAIL  2 SKIP
---

## Phase 2B Stabilization (COMPLETE - 2026-06-13)

### Root Cause of 404s

The backend was a stale process started BEFORE Phase 2B code was committed.
FastAPI routes (including /api/briefing/*) are only registered at process
startup — a hot-reload or stale process will NOT pick up new routers.

**Fix: always restart the backend after adding new routes.**

```
# Kill port 8001, then:
python -m uvicorn backend.main:app --port 8001
```

### Route Audit Results

All Phase 2B routes were correctly registered in main.py and briefing.py.
The 404s were 100% due to the stale backend, not a code bug.

Verified with fresh backend (HTTP 200 on all):

| Route | Method | Status |
|-------|--------|--------|
| /api/briefing/proactive | GET | 200 + real cross-crop data |
| /api/briefing/{crop}/{state} | GET | 200 + has_data=True |
| /api/briefing/scenario | POST | 200 + numeric prices |
| /api/advisor/ask | POST | 200 + agent_insights{trend,risk,seasonal,recommendation} |

### Scenario Engine Fix

`backend/services/scenario_engine.py` previously returned formatted string prices
("Rs1,273/quintal") which broke the frontend's .toLocaleString() call.
Now returns numeric types:

- current_price: int/float (0 when unknown)
- estimated_price: int or None
- price_impact_pct: float (always, 0.0 when undetected - never None)

### Frontend Fixes

- `AISimulationPanel.jsx`: price display updated to handle numeric values
  - `Number(result.current_price).toLocaleString('en-IN')` works with int
  - Added 'uncertain' to DIRECTION_CONFIG (for generic/unrecognized scenarios)

### Agent Insights Verified

POST /api/advisor/ask returns agent_insights with 4 keys:
  trend, risk, seasonal, recommendation

AIReasoningPanel renders all 4 AgentCards correctly when agent_insights
is non-empty. The "Why AI suggested this" collapsible appears under each AI response.

### Final Endpoint Map (Phase 2B)

```
GET  /api/briefing/proactive
     → Cross-crop proactive intelligence (Tier-1 crops)
     → Response: {top_opportunity, biggest_risk, safest_market,
                  strongest_momentum, seasonal_alert, anomaly_alert}

GET  /api/briefing/{crop}/{state}
     → Full 4-agent briefing for one crop+state
     → Response: {crop, state, has_data, agents{trend,risk,seasonal,recommendation},
                  executive_summary, opportunity_score, risk_level}

POST /api/briefing/scenario
     → Heuristic what-if simulation
     → Body: {crop, state, scenario (str, min 10 chars)}
     → Response: {scenario_type, price_direction, price_impact_pct (float),
                  current_price (int), estimated_price (int|null),
                  farmer_recommendation, confidence, rationale, disclaimer}

POST /api/advisor/ask
     → Grounded Gemini advisory (existing, enhanced with agent_insights)
     → Response includes: agent_insights{trend,risk,seasonal,recommendation}
```

### Operational Notes

1. Backend MUST be restarted after any change to main.py or new router files
2. Hot-reload (--reload) reinitializes routes but NOT module-level singletons
   (GeminiProvider, MemoryManager) — full restart preferred for production
3. DuckDB file is exclusive-access — only one backend process can run at a time
4. Scenario min_length=10 is enforced by Pydantic — very short inputs get 422

---

## Phase 3A — Executive AI Experience Layer (COMPLETE — 2026-06-13)

### What Was Built

Streaming AI responses (SSE), Bloomberg-style executive summary cards, smart entity
extraction from question text, and a streaming-safe shared pipeline architecture.

### Streaming Architecture

```
POST /api/advisor/ask/stream
  -> route_advisor_query_stream()   <- async generator (advisor_ai_router.py)
      -> _prepare_query_context()   <- shared with non-streaming /ask
          sanitize -> guardrail -> memory -> entity-extract -> intent
          -> context -> agents -> historical -> history -> prompt
      -> _gemini.generate_stream()  <- yields text tokens
      -> yields {"type":"token","token":str}  per chunk
      -> yields {"type":"done","intent":...}  at end
  -> StreamingResponse(event_gen(), media_type="text/event-stream")
```

---

## Phase 3D — Enterprise Command Center & Responsive Intelligence Grid (COMPLETE — 2026-06-13)

### What Was Built

7-zone enterprise command center layout, density management, KPI System 2.0, live intelligence
rail, executive immersive mode, and visual prioritization engine 2.0.

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/IntelligenceGrid.jsx` | Responsive auto-fit grid engine with DensityContext |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/ui/DashPanel.jsx` | Added `dark`, `preview`, `loading` props; dark variant for executive sections; collapsed preview text |
| `frontend/src/pages/AIAdvisor.jsx` | Full 7-zone command center rewrite |

### 7-Zone Layout

| Zone | Content | Visible in Immersive? |
|------|---------|----------------------|
| 1 | Executive Strip (header, density, immersive toggle) | ✓ |
| 2 | Critical Alerts (anomaly DashPanel) | ✓ (compact) |
| 3 | Live AI Workspace (intelligence rail + AdvisorChat) | ✓ |
| 4 | Strategic Intelligence (KPI 2.0 + insights) | ✗ |
| 5 | Simulation Lab (briefing / simulation / recent) | ✗ |
| 6 | Deep Analysis (momentum / volatility / seasonal) | ✗ |
| 7 | Historical Archive (comparison table / forecast quality) | ✗ |

### KPI System 2.0

- Trend arrow (↑/↓/→) driven by `trendScore` prop — colored green/red/gray
- Status ring around emoji: `ring-2 ring-offset-1 ring-{color}-300 ring-opacity-50`
- `density` prop adjusts card padding (compact: `p-3`, balanced: `p-4`, expanded: `p-5`)
- `trendScore` for Volatility KPI: `-(cv / 10)` so high CV = red ↓ arrow

### Intelligence Rail (Zone 3)

Always visible above AdvisorChat. Shows:
- Top gainer crop with 7d % change and direction arrow
- Highest-volatility crop with CV when CV > 25
- "Alert Active" pulse when `criticalAnomaly = true`
- Live AGMARKNET indicator dot (animated pulse)
- `immersive` boolean toggles between light rail (gray-50) and dark rail (gray-900)

### Density Management

`densityMode` state: `compact | balanced | expanded` (default: balanced)
- Controls outer `space-y-*` gap, grid gaps, and KPI card padding
- `DensityToggle` renders 3 icon buttons in `bg-gray-100` pill
- Hidden in Immersive Mode (irrelevant when only 3 zones visible)

### Executive Immersive Mode

Replaces Phase 3C "Focus Mode". When active:
- Executive header becomes dark (`bg-gray-900`, `text-gray-100`)
- Intelligence rail switches to dark variant (`bg-gray-900 border-gray-700/60`)
- Zones 4–7 hidden (`{!immersive && ...}`)
- Anomaly panel still visible when critical anomaly exists (compact mode)
- Toggle button: dark pill when inactive → light pill when active

### DashPanel — New Props

| Prop | Type | Purpose |
|------|------|---------|
| `dark` | boolean | Dark header background (`bg-gray-900`) |
| `preview` | string | One-line summary shown when panel is collapsed |
| `loading` | boolean | Shimmer animation instead of children |

### Visual Prioritization Engine 2.0

`prioritizeInsights()` scores:
- Risk Alert: +30 (critical — must float to top)
- Seasonal Signal: +20
- Price Intelligence: +15
- Stability: +10

Anomaly alerts independently sorted high→medium→low severity before rendering.

### IntelligenceGrid

```jsx
<IntelligenceGrid cols={3} density="balanced">...</IntelligenceGrid>
// or auto-fit:
<IntelligenceGrid minWidth={260} density="compact">...</IntelligenceGrid>
```

Exports `DensityContext` and `useDensity()` hook for child components to read density.

### Architectural Invariants (unchanged)

1. Zone 3 (AdvisorChat) is NEVER broken — streaming, voice, memory all intact
2. All analytics (KPI, insights, rail) come from deterministic hooks (`useAnalytics`, `useCrossAnalytics`)
3. Gemini is never called from page-level components — only through AdvisorChat → advisor_ai_router
4. `IntelligenceGrid` and `DashPanel` are purely presentational — no data fetching

Frontend consumption:
- `advisorService.askStream(params, signal)` — async generator using native fetch()
- Bypasses axios and Vite proxy (direct to :8001 via VITE_API_BASE_URL)
- Yields {type:"token", token:str} | {type:"done",...} | {type:"error",...}

### Smart Entity Extraction (Step 8)

`_extract_entities_from_question()` in `advisor_ai_router.py` scans question text
for crop and state name mentions using the full crop registry.

Priority: explicit UI selector > session memory > entity extraction from text.

Examples:
- "What about Kerala?" + session has crop=Tomato -> eff_state=Kerala, eff_crop=Tomato
- "How are tomato prices in Tamil Nadu?" -> eff_crop=Tomato, eff_state=Tamil Nadu
- Longer crop names checked first to prevent partial-match collisions

### Shared Pipeline — _prepare_query_context()

Steps 1-7 extracted from `route_advisor_query` into `_prepare_query_context()`.
Both non-streaming (/ask) and streaming (/ask/stream) routes call this shared
coroutine. Returns dict with rejected, clean, eff_crop, eff_state, intent,
full_prompt, prompt_ctx, sources, inferred, agent_insights, grounded, trace.

### generate_stream() — GeminiProvider

`GeminiProvider.generate_stream(prompt)` is an async generator:
- Uses `client.aio.models.generate_content_stream()` with same config (thinking_budget=0)
- Connection-only timeout 15s; once streaming starts, runs until done
- On any error: yields a single professional fallback string and stops
- No retry — streaming errors surface immediately for user retry

### SSE Protocol

```
data: {"type": "token", "token": "Current prices for Tomato..."}

data: {"type": "done", "intent": "price_now", "sources": [...],
       "grounded": true, "error_type": null, "latency_ms": 2341,
       "agent_insights": {"trend":{...},...}, "session_id": "adv_..."}

data: {"type": "error", "error_type": "pipeline_error", "message": "..."}
```

### AIExecutiveSummaryCards (NEW)

Bloomberg-style 2x2 grid shown after streaming completes:
Market Outlook (trend) / Risk Level (risk) / Seasonal Signal (seasonal) /
Suggested Action (recommendation). Each card: verdict label, icon, score bar.
Renders only when recommendation.verdict is set and non-UNKNOWN.

### Modified Files

| File | Change |
|------|--------|
| `backend/services/llm/gemini_provider.py` | Added `generate_stream()` async generator |
| `backend/services/advisor_ai_router.py` | Extracted `_prepare_query_context()`, added `_extract_entities_from_question()`, added `route_advisor_query_stream()` |
| `backend/api/routes/advisor.py` | Added `POST /api/advisor/ask/stream` (StreamingResponse SSE) |
| `frontend/src/services/advisorService.js` | Added `async *askStream()` (native fetch) |
| `frontend/src/components/ai/AIExecutiveSummaryCards.jsx` | NEW — executive intelligence cards |
| `frontend/src/components/ai/AdvisorChat.jsx` | Streaming send(), AbortController, cursor, exec cards |

### Operational Notes

- Non-streaming `POST /api/advisor/ask` is UNCHANGED — fully backward-compatible
- AbortController in AdvisorChat aborts stream on clearChat() or new send()
- "Writing..." shown in header during token stream; "Thinking..." while waiting for first token
- Executive cards appear only after streaming is done (not during stream)

---

## Phase 3B — Intelligence Visualization & Executive UX Polish (COMPLETE — 2026-06-13)

### What Was Built

Executive-grade intelligence workstation upgrade: centralized signal framework,
inline SVG visualizations, progressive disclosure UX, streaming polish,
AI memory timeline, analyst mode scaffold, recent market changes engine,
and deterministic market narrative generation.

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/services/recent_market_changes.py` | `MarketChangeSignal`, `detect_recent_changes()`, `generate_market_narrative()`, `get_recent_changes_for()` — pure deterministic, zero LLM |

### Modified Backend Files

| File | Change |
|------|--------|
| `backend/services/ai_forecast_narrator.py` | Added `price_series_30d` to return dict (`df["y"].tail(30).tolist()`) — no extra DuckDB call |
| `backend/services/advisor_ai_router.py` | After agent pipeline: inject `price_series_30d` into `agent_insights`; `isinstance(insight, dict)` guard for `additional_facts` loop; trace excludes price_series_30d key |
| `backend/api/routes/briefing.py` | Added `GET /api/briefing/recent/{crop}/{state}` — validates crop/state, delegates to `get_recent_changes_for()` |
| `backend/data/schema/models.py` | Added `view_mode: str \| None = None` to `AdvisorRequest` (analyst mode scaffold); `min_length=2` (down from 10) to allow short messages like "hi" |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ai/AISignalBadge.jsx` | `SIGNAL_CONFIG` (22 verdict keys) — centralized single source of truth; `getSignalConfig()` helper; `AISignalBadge` component (xs/sm/md/lg) |
| `frontend/src/components/ai/AIVisualization.jsx` | `MiniSparkline`, `VolatilityMeter`, `ConfidenceGauge`, `RiskHeatBar`, `SeasonalPosition`, `MomentumArrow`, `AIVisualizationStrip` — pure SVG, no external chart lib |
| `frontend/src/components/ai/AIResponseLayout.jsx` | Executive wrapper: `ExecutiveStrip`, `CollapsibleNarrative` (8-line fold), `ConfidenceDiagnostics` (expandable), `ResponseSkeleton` (animated pulse), full post-stream panel |
| `frontend/src/components/ai/RecentMarketChanges.jsx` | Fetches `/api/briefing/recent/{crop}/{state}`; renders analyst narrative + ChangeCards; refresh button; skeleton loading |
| `frontend/src/components/ai/AIMemoryTimeline.jsx` | Session context chips: crop (emerald), state (blue), up to 4 topic chips from message intents; `memo` wrapped |
| `frontend/src/components/ai/AIAnalystModeSelector.jsx` | Analyst presentation mode scaffold (farmer/trader/wholesale/analyst); wires `view_mode` into `AdvisorRequest` via `askStream()` |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/components/ai/AIExecutiveSummaryCards.jsx` | Replaced internal `VERDICT_CFG` with `getSignalConfig` from `AISignalBadge` (centralized signal framework) |
| `frontend/src/components/ai/AdvisorChat.jsx` | Imports `AIResponseLayout`, `AIMemoryTimeline`, `AIAnalystModeSelector`; `viewMode` state; `clearCrop/clearState` callbacks; AI message body → `<AIResponseLayout>`; analyst selector + memory timeline in header |
| `frontend/src/pages/AIAdvisor.jsx` | Grid `lg:grid-cols-3`; added `RecentMarketChanges`; badge → "Intelligence Visualization · Phase 3B" |

### Signal Framework (AISignalBadge.jsx)

22 verdict types covered:
- **Trend**: STRONG_BULLISH, BULLISH, MILD_BULLISH, NEUTRAL, MILD_BEARISH, BEARISH, STRONG_BEARISH
- **Risk**: LOW_RISK, MODERATE_RISK, HIGH_RISK, EXTREME_RISK
- **Seasonal**: DEEP_PEAK, PEAK_SEASON, LEAN_SEASON, DEEP_TROUGH, NORMAL
- **Recommendation**: SELL_NOW, SELL_SOON, HOLD, WAIT, WATCH, UNKNOWN

Each entry has: `label, icon, group, text, bg, border, bar, dot` Tailwind classes.
`getSignalConfig(verdict)` returns UNKNOWN config for unrecognised values (safe fallback).

### price_series_30d Flow

```
DuckDB → df["y"].tail(30)        ← ai_forecast_narrator.py
    → raw_ctx["price_series_30d"] ← advisor_ai_router.py (via build_with_raw)
    → agent_insights["price_series_30d"]
    → SSE "done" event → agentInsights prop
    → AIVisualizationStrip → MiniSparkline (SVG path)
```

No extra DuckDB call — reuses the `df` already fetched for insight context.

### Recent Market Changes Engine

`detect_recent_changes(insight)` emits up to 6 `MarketChangeSignal` objects (sorted by severity):
- `anomaly`: price spikes/crashes from anomaly engine
- `momentum`: 7d vs 30d average shift with direction
- `seasonal`: seasonal phase position
- `volatility`: CV-based stability assessment
- `price`: current price vs 1-year average
- `data`: data staleness warning

`generate_market_narrative(crop, state, insight, signals)` produces a 2-sentence analyst
narrative from templates — deterministic, zero LLM involvement.

### New Endpoint

```
GET /api/briefing/recent/{crop}/{state}
→ {crop, state, has_data, changes[{type,icon,severity,headline,detail,direction}],
   narrative, last_price, price_vs_year, generated_at}
```

### AIResponseLayout — Progressive Disclosure

During stream (isStreaming=True):
- Skeleton pulse when no text yet
- Live text rendered as tokens arrive

After stream completes (!isStreaming):
1. `ExecutiveStrip` — 4 signal pills + grounded badge + latency
2. `CollapsibleNarrative` — full answer, folded at 8 lines
3. `AIVisualizationStrip` — sparkline + volatility + seasonal + confidence + risk
4. `ConfidenceDiagnostics` — expandable opportunity score + driver bullets
5. `AIExecutiveSummaryCards` — 2×2 Bloomberg cards
6. `AIReasoningPanel` — "Why AI suggested this" (agent verdicts)

### Operational Notes

- `AdvisorRequest.min_length` is now 2 — short messages like "hi" are accepted
- `view_mode` field is passed to backend but not yet routed to prompt templates (Phase 4)
- `price_series_30d` must NOT be included in the `additional_facts` agent loop — guarded by `isinstance(insight, dict)` check
- Backend restart required whenever routes or `.env` change (DuckDB is exclusive-access)

---

## Phase 3C — Premium Analytics Dashboard & Visual Balance (COMPLETE — 2026-06-13)

### What Was Built

Enterprise-grade dashboard polish: DashPanel reusable card framework, page hierarchy reorder,
executive focus mode, insight prioritization engine, bezier sparkline smoothing, and consistent
premium typography across all panels.

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ui/DashPanel.jsx` | Reusable collapsible panel: priority dot/chip, actions slot, smooth grid-row animation, hover elevation, compact mode |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/pages/AIAdvisor.jsx` | Full hierarchy reorder: Signals → Alerts (priority-sorted) → Strategic Insights → Intelligence Grid → Chat → Deep Analysis (all behind Focus Mode toggle); `DashPanel` replaces `Card` for all collapsible sections; `KpiCard` with accent border-l; `SectionDivider`; `prioritizeInsights()` engine |
| `frontend/src/components/ai/AIVisualization.jsx` | Bezier-smoothed sparkline (cubic C-commands instead of L-commands); halo dot on last price; percentage change label; subtle grid line at 50%; gradient area uses same bezier path |
| `frontend/src/components/ai/AIMarketBriefing.jsx` | Premium compact header; collapsible deep briefing via CSS grid-row trick; tighter spacing |
| `frontend/src/components/ai/RecentMarketChanges.jsx` | Premium header with gradient icon; analyst note block in primary-50; improved signal cards |
| `frontend/src/components/ai/AIResponseLayout.jsx` | Tighter `ExecutiveStrip` (1-gap pills); `▸` list bullets in primary-400; `text-[13px]` body text; uppercase section headings at `text-[11px]` |

### Dashboard Hierarchy (Step 2)

```
1. Page header + Focus Mode toggle
2. Executive Signal Strip (3 KPI cards with left accent borders)
3. Critical Alerts — DashPanel, priority=critical, defaultOpen when severity=high
4. Strategic Market Insights — DashPanel, defaultOpen
5. Intelligence Grid (3-col) — Briefing | Simulation | Recent Changes
6. AI Advisor Chat
── SectionDivider "Deep Analysis" (hidden in Focus Mode) ──
7. Cross-Crop Comparison — DashPanel, defaultOpen=false
8. Momentum Intelligence — DashPanel, defaultOpen=false
9. Volatility Intelligence — DashPanel, defaultOpen=false
10. Seasonal Intelligence — DashPanel, defaultOpen=false
11. Forecast Reliability — DashPanel, defaultOpen=false
```

### Focus Mode (Step 12)

Toggle button in page header (▣ / ⊞). When active:
- Hides all Deep Analysis panels (items 7–11)
- Shows only KPIs + Alerts + Insights + Intelligence Grid + Chat
- `SectionDivider` and the `{!focusMode && ...}` block hidden

### DashPanel Animation

Uses CSS `grid-template-rows: 0fr → 1fr` transition — no height calculation, no layout shift.
The `overflow-hidden` on inner div prevents content from leaking during animation.

### Insight Prioritization Engine (Step 9)

`prioritizeInsights(insights, anomalies)` assigns priority scores:
- Risk Alert: +30
- Seasonal Signal: +20
- Price Intelligence: +15
- Stability: +10

Anomaly alerts are always shown at top (before strategic insights), sorted by severity
(high → medium → low) when multiple events exist.

### Chart Polish (Step 7)

Sparkline now uses cubic bezier control points:
```
C (mid-x, prev-y) (mid-x, next-y) (next-x, next-y)
```
This produces a smooth S-curve between data points while preserving exact price values at each x.
`pad=6` (was 4) gives breathing room. Last-price halo adds depth without noise.

### Vite Build Verification

Phase 3C build: 1558 modules, 0 errors, 8.0s. No new dependencies added.

### Preview Tool Note

The sandboxed preview browser cannot access `localhost:*` on Windows. Visual verification
was done via Vite build (0 errors) + import-path audit. The existing Vite dev server on
`:5173` has HMR and picks up all file changes automatically.

---

## Phase 4A — True AI Intelligence & Analyst Reasoning System (COMPLETE — 2026-06-14)

Transforms AgroPrice AI from "AI dashboard" into "AI agricultural market analyst."
Personas materially change prompt framing; correlation + confidence engines deepen grounding.

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/services/analyst_persona.py` | 4 analyst personas: farmer / trader / wholesale / analyst — each materially changes Gemini framing |
| `backend/services/confidence_engine.py` | Dynamic confidence scoring from deterministic signals: training depth, volatility CV, anomaly count, momentum coherence, forecast availability, tier |
| `backend/services/correlation_engine.py` | Confirms and contradicts agent signals (e.g., bull momentum + peak season = confirming; bull trend + extreme risk = contradiction) |
| `backend/api/routes/watchlist.py` | `GET /api/watchlist` — dynamic buckets: momentum_leaders, risk_watch, safest_picks, seasonal_peaks, top_opportunity |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/services/watchlistService.js` | API client for `/api/watchlist` |
| `frontend/src/components/ai/AIWatchlist.jsx` | Watchlist panel: 4 buckets + top opportunity banner + refresh |

### Modified Backend Files

| File | Change |
|------|--------|
| `backend/services/llm/prompt_builder.py` | `PromptContext` extended: `persona_section`, `correlation_signals`, `confidence_narrative/contributors/detractors`, `topic_context`. New section builders. Upgraded `_SYSTEM_IDENTITY` to analyst-grade. New section order: persona → market → forecast → **correlations** → seasonal → **confidence (enhanced)** → anomaly → historical → topic_context → additional → question → style |
| `backend/services/advisor_ai_router.py` | `view_mode` param added to `_prepare_query_context`, `route_advisor_query`, `route_advisor_query_stream`. Steps 7a/7b/7c added: confidence engine, correlation engine, persona injection. `store_turn` now passes `intent=`. `reasoning_trace` built and returned |
| `backend/services/advisor_memory_manager.py` | `_empty_session()` adds `topic_chain`, `crops_seen`. `store_turn()` accepts `intent` param, maintains topic chain. `get_history_string()` upgraded: includes intent label per turn. New `get_topic_context()` method on both in-process and Redis backends |
| `backend/data/schema/models.py` | `AdvisorResponse` extended: `reasoning_trace: str | None`, `persona: str | None` |
| `backend/api/routes/advisor.py` | Both `/ask` and `/ask/stream` now pass `view_mode=request.view_mode`. `AdvisorResponse` construction includes `reasoning_trace` and `persona` |
| `backend/main.py` | Registers `/api/watchlist` router |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/components/ai/AIReasoningPanel.jsx` | Explainability Panel 2.0: correlation signals with CONFIRMING/CONTRADICTION/MIXED styling, reasoning trace pill display, persona tag, confidence bar from agent score |
| `frontend/src/components/ai/AdvisorChat.jsx` | `done` chunk now captures `reasoning_trace` and `persona` from SSE event |
| `frontend/src/components/ai/AIResponseLayout.jsx` | Passes `reasoning_trace` and `persona` props to `AIReasoningPanel` |
| `frontend/src/pages/AIAdvisor.jsx` | Added `AIWatchlist` import; Zone 5 grid expanded to 4 columns (xl) with AIWatchlist in DashPanel; badge updated to "Analyst AI · Phase 4A" |

### Persona System (analyst_persona.py)

| Mode | Framing | Focus |
|------|---------|-------|
| `farmer` | Plain language, action-oriented | Harvest timing, local mandi, perishability |
| `trader` | Commercial, momentum-focused | 7–30d price trajectory, volatility as opportunity |
| `wholesale` | Supply-chain, cost-conscious | Procurement timing, bulk pricing, cold storage |
| `analyst` | Intelligence brief, statistical | Full rigour, cite CV, structured Outlook → Risk → Recommendation |
| (none) | General advisory | Balanced, practical |

All 4 modes prepended to prompt BEFORE system identity — sets audience framing first.

### Confidence Engine (confidence_engine.py)

Inputs from `raw_ctx` (deterministic): training rows, staleness_days, volatility CV, anomaly count, momentum coherence, forecast availability, seasonal pattern, forecast tier.
Output: `ConfidenceAssessment(score, label, contributors, detractors, narrative)`.
Injected into `PromptContext.confidence_narrative / contributors / detractors`.

### Correlation Engine (correlation_engine.py)

Reads agent verdicts (trend, risk, seasonal, recommendation) + anomaly count.
Returns `list[str]` of pre-formatted signals (max 5). Examples:
- `"CONFIRMING — Bullish momentum + peak season: ..."`
- `"CONTRADICTION — Prices falling despite peak season: ..."`
- `"MIXED SIGNAL — Peak season + high volatility: ..."`
- `"ANOMALY CONTEXT — 3 recent price anomalies alongside upward trend: ..."`

### Reasoning Trace Format

Compact pipe-separated summary built in `_build_reasoning_trace()`:
`"crop: Tomato | state: Karnataka | intent: price_now | trend: BULLISH (72%) | risk: LOW RISK (85%) | seasonal: PEAK SEASON (91%) | recommendation: SELL SOON (77%) | confidence: high (74%) | correlations: 2"`

Stored in `AdvisorResponse.reasoning_trace`, SSE `done` event, and rendered in frontend's Explainability Panel 2.0 as pill chips.

### Memory Enrichment (Phase 4A)

- `topic_chain` tracks last 5 `{intent, crop}` dicts per session
- `crops_seen` tracks all unique crops mentioned across turns
- History string now includes `[intent | crop]` label prefix per turn
- `get_topic_context()` returns: "User has been asking about: price_now → volatility → seasonal. Crops discussed: Tomato, Onion." — injected as `PromptContext.topic_context`

### Watchlist Endpoint

```
GET /api/watchlist?max_crops=8
→ {
    momentum_leaders:  [{crop, state, verdict, score, headline, opportunity_score}],  # bullish trend
    risk_watch:        [{crop, state, verdict, score, headline, opportunity_score}],  # high/extreme risk
    safest_picks:      [{crop, state, verdict, score, headline, opportunity_score}],  # low/moderate risk
    seasonal_peaks:    [{crop, state, verdict, score, headline, opportunity_score}],  # peak/deep_peak season
    top_opportunity:   {crop, state, headline, opportunity_score, verdict} | null,
    crops_analysed:    int,
    generated_at:      ISO timestamp,
  }
```

### Vite Build Verification (Phase 4A)

1560 modules, 0 errors, 7.90s. 2 new modules vs Phase 3D (AIWatchlist + watchlistService).

### Architectural Invariants (unchanged from Phase 3D)

1. Persona framing changes Gemini's OUTPUT style — never its input data
2. Confidence engine reads ONLY deterministic signals — never invents scores
3. Correlation engine reads ONLY agent verdicts — no LLM calls
4. Watchlist endpoint uses ONLY the deterministic agent pipeline — no Gemini
5. Zone 3 (AdvisorChat) fully intact — streaming, voice, memory, reasoning panel all work
6. `enforce_agriculture_scope()` still called before EVERY Gemini call
7. `PromptContext` fields still sourced only from real DuckDB/ML data

---

## Phase 4B — Autonomous Market Intelligence System (COMPLETE — 2026-06-14)

### What Was Built

6 new backend services + 1 API route + 4 new frontend components. The system now acts as
a live agricultural intelligence operator: autonomous cross-crop monitoring with priority
scoring, escalation detection, regime classification, temporal acceleration analysis,
Bloomberg-style executive briefing, and an executive command mode overlay.

### New Backend Files

| File | Purpose |
|------|---------|
| `backend/services/regime_detector.py` | 7-regime market classification: BULLISH_EXPANSION, STABLE, PANIC_VOLATILITY, SEASONAL_CORRECTION, RECOVERY_PHASE, SEASONAL_PEAK_RUN, TRANSITIONAL |
| `backend/services/temporal_intelligence.py` | `TemporalAnalysis` dataclass; detects accelerating/decelerating/reversing/stable momentum from 7d vs 30d comparison |
| `backend/services/signal_fusion.py` | `fuse_signals()` combines regime + escalations + priority + synthesis into a single flat dict; pure deterministic |
| `backend/services/market_monitor.py` | `build_crop_intelligence(crop, state, briefing, raw_ctx)` → complete flat intelligence dict per crop (all keys JSON-serialisable) |
| `backend/services/executive_briefing_engine.py` | `generate_executive_briefing(items)` → up to 8 Bloomberg-style briefing dicts; deterministic, zero LLM |
| `backend/api/routes/intelligence.py` | `GET /api/intelligence/monitor?max_crops=N`, `GET /api/intelligence/compare/{crop}/{state}` |

### Modified Backend Files

| File | Change |
|------|--------|
| `backend/main.py` | Registers `intelligence.router` at `/api/intelligence` |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/services/intelligenceService.js` | `getIntelligenceMonitor(maxCrops)`, `getStrategicComparison(crop, state)` |
| `frontend/src/components/ai/AIRegimeBadge.jsx` | `REGIME_CFG` (7 regimes), `PRIORITY_CFG` (4 levels), `AIRegimeBadge`, `AIPriorityBadge` components — centralized styling |
| `frontend/src/components/ai/AIAutonomousMonitor.jsx` | Priority-sorted crop cards with regime badges, escalation pills, temporal direction, executive briefing; `onDataLoad` prop bubbles data to parent |
| `frontend/src/components/ai/AICommandMode.jsx` | Full-screen dark terminal overlay: alert stats, regime distribution bar, escalation list, priority matrix 3x2, top opportunity — executive command view |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/pages/AIAdvisor.jsx` | Added `AIAutonomousMonitor` DashPanel in Zone 4; `AICommandMode` overlay; CMD button in Zone 1 header; `monitorData` state + `handleMonitorData` callback; badge → "Autonomous · Phase 4B" |

### Intelligence Monitor Response Shape

```
GET /api/intelligence/monitor?max_crops=8
{
  generated_at, crops_scanned, critical_alerts, high_attention, watch,
  total_escalations, reversal_risks,
  regime_distribution: {REGIME_NAME: count},
  items: [{
    crop, state, has_data,
    regime_name, regime_label, regime_color, regime_icon, regime_description,
    priority_level,     # CRITICAL | HIGH_ATTENTION | WATCH | STABLE
    priority_score,     # 0–100
    escalations,        # list[str] max 4 — VOLATILITY_SURGE / ANOMALY_CLUSTER / RAPID_MOMENTUM / etc.
    dominant_signal,    # most important signal in plain text
    synthesis,          # one-sentence market synthesis
    temporal_direction, # accelerating | decelerating | reversing | stable | unknown
    temporal_label, reversal_risk, velocity, prior_velocity,
    trend_verdict, risk_verdict, seasonal_verdict, recommendation_verdict,
    opportunity_score, confidence_score, confidence_label, confidence_aligned,
    correlation_signals,
  }],
  executive_briefing: [{ category, headline, detail, severity, crop, state }]
}
```

### Regime System

| Regime | Trigger condition | Color |
|--------|------------------|-------|
| BULLISH_EXPANSION | Bullish + peak season (without extreme risk) | Emerald |
| SEASONAL_PEAK_RUN | Bullish trend + PEAK season | Purple |
| RECOVERY_PHASE | Mild bullish + trough season | Teal |
| STABLE | Neutral trend + low risk + CV < 20% | Blue |
| SEASONAL_CORRECTION | Bearish during peak (contradiction) | Amber |
| PANIC_VOLATILITY | Extreme risk OR CV>45+anomalies OR bearish+high-risk | Red |
| TRANSITIONAL | Mixed / unclassified | Gray |

### Escalation Types

| Key | Trigger |
|-----|---------|
| VOLATILITY_SURGE | CV > 40% |
| ELEVATED_VOLATILITY | CV > 30% |
| ANOMALY_CLUSTER | >= 3 anomalies in 90-day window |
| ANOMALY_PAIR | >= 2 anomalies |
| RAPID_MOMENTUM | abs(7d change) > 15% |
| CONTRADICTORY_SIGNALS | CONTRADICTION or TRIPLE BEAR from correlation engine |
| DIVERGENCE_ALERT | Bullish trend + EXTREME_RISK verdict |

### Temporal Intelligence

Compares `momentum.7d_change_pct` vs `momentum.30d_change_pct / 4` (weekly rate):
- `accelerating`: recent weekly > prior by > 20%
- `decelerating`: recent weekly < prior by > 20%
- `reversing`: both > 2% absolute, signs flipped
- `stable`: within 20% of prior rate
- `unknown`: both < 0.5% (negligible movement)

### Command Mode Data Flow

`AIAutonomousMonitor` fetches `/api/intelligence/monitor` and calls `onDataLoad(result)`.
`AIAdvisor` stores in `monitorData` state. `AICommandMode` receives `data={monitorData}`.
Zero extra API calls when command mode is opened after monitor has loaded.

### Vite Build

1564 modules, 0 errors, 8.80s (4 new modules vs Phase 4A's 1560).

### Architectural Invariants (Phase 4B — in addition to all prior phases)

1. All 6 Phase 4B backend services are pure deterministic Python — no Gemini calls
2. `build_crop_intelligence()` returns a flat JSON-serialisable dict — no nested dataclasses
3. `executive_briefing_engine.py` uses only template strings — zero LLM involvement
4. `onDataLoad` callback in `AIAutonomousMonitor` bubbles data to parent; avoids duplicate API call for command mode
5. All Phase 4A systems untouched: personas, confidence, correlation, watchlist, streaming, voice, memory, reasoning panel
6. DuckDB exclusive-access rule: restart backend after any route or `.env` changes
---

## Phase 5 — Collaborative Decision Intelligence System (COMPLETE — 2026-06-14)

### What Was Built

7-agent specialist council, probabilistic decision intelligence, cross-market influence
analysis, mode-specific strategy engine, explainable decision traces, Bloomberg-style
executive synthesis, and a 7-dimensional crop opportunity matrix.

All intelligence is deterministic and grounded. Gemini is NOT invoked by any Phase 5 service.

### New Backend Services

| File | Purpose |
|------|---------|
| `backend/services/agent_council.py` | 7 specialist agents (TrendAnalyst, RiskAnalyst, SeasonalAnalyst, SupplyDemandAnalyst, VolatilityAnalyst, ForecastReliabilityAnalyst, OpportunityAnalyst); AgentVote dataclass; weighted aggregation; CouncilResult |
| `backend/services/consensus_engine.py` | Dynamic confidence scoring from agent agreement, CV, anomaly count, tier, staleness; ConsensusDecision with stability_label / risk_adjustment / confidence_collapse detection |
| `backend/services/cross_market_engine.py` | Hardcoded South Indian crop relationship graph (25+ crops, 7 types: complement/substitute/seasonal/regional/storage/premium/spice); coupling_score, contagion_risk |
| `backend/services/probability_engine.py` | Heuristic statistical probabilities: upside/downside/sideways (sum ~1.0), volatility_shock_prob, reversal_probability, confidence_interval_pct; ProbabilisticOutlook |
| `backend/services/strategy_engine.py` | Mode-specific strategy (farmer/trader/wholesale/analyst/general); 9 ACTION types; rationale, timing, caution, entry/exit guidance, watch triggers; StrategyRecommendation |
| `backend/services/decision_trace_engine.py` | 6-stage pipeline trace; agreed/dissenting agents; strongest/weakest evidence; anomaly/seasonal impact narratives; evidence_quality score |
| `backend/services/executive_synthesis_engine.py` | Bloomberg-style institutional briefing; 5 market postures (CRISIS/OPPORTUNISTIC/DEFENSIVE/CAUTIOUS/NEUTRAL); executive_summary, strategic_outlook, institutional_commentary, briefing_cards |
| `backend/services/opportunity_matrix.py` | 7-dimensional scoring: opportunity, stability, risk, confidence, timing, seasonal, market_quality; overall_rank formula; OpportunityMatrix with 5 sorted lists |

### New Backend Routes

| File | Purpose |
|------|---------|
| `backend/api/routes/decision_intelligence.py` | `_run_full_decision_pipeline()` shared helper; 6 endpoints under `/api/decision/` |

### Decision Intelligence Endpoints

`
GET  /api/decision/council/{crop}/{state}
     → council (7 agents + vote breakdown + consensus) + consensus dict + trace

GET  /api/decision/probability/{crop}/{state}
     → probabilistic outlook (upside/downside/sideways/shock/reversal/CI/basis)

GET  /api/decision/strategy/{crop}/{state}?mode=general
     → mode-specific strategy (farmer/trader/wholesale/analyst/general)

GET  /api/decision/relationships/{crop}
     → crop relationship graph (influences list, coupling_score, contagion_risk, substitutes, complements)

GET  /api/decision/opportunities?max_crops=12
     → opportunity matrix (top_opportunities, most_dangerous, best_stability, highest_momentum, best_seasonal)

GET  /api/decision/executive-summary?max_crops=8
     → cross-crop institutional synthesis (posture_distribution, dominant_posture, high_priority_cards, critical_escalations)
`

### New Frontend Service

| File | Purpose |
|------|---------|
| `frontend/src/services/decisionService.js` | 6 API calls: getCouncil, getProbability, getStrategy, getRelationships, getOpportunities, getExecutiveSummary |

### New Frontend Components

| File | Purpose |
|------|---------|
| `frontend/src/components/ai/AICouncilPanel.jsx` | 7-agent council visualization; AgentCard (expandable, reasoning bullets, escalation flags); vote breakdown bar; contradiction pulse badge; consensus %; confidence decomposition |
| `frontend/src/components/ai/AIProbabilityPanel.jsx` | Directional probability bars; GaugeArc SVG (shock + reversal); confidence interval gradient; probability basis bullets; outlook label chip |
| `frontend/src/components/ai/AIRelationshipMap.jsx` | Cross-market influence grid; 7 relationship type configs; filter pills; strength bars; complements/substitutes groups; contagion risk badge |
| `frontend/src/components/ai/AIStrategyPanel.jsx` | Mode selector (5 modes); primary action card; rationale block; detail rows (timing/entry/exit/seasonal/risk); caution notes; watch triggers |
| `frontend/src/components/ai/AIExecutiveSynthesis.jsx` | Bloomberg-style posture banner (5 colors); posture distribution bar; priority briefing cards; critical escalations; generated-at timestamp |
| `frontend/src/components/ai/AIOpportunityMatrix.jsx` | Summary stats (crops, top pick, highest risk); view tabs (5 categories); MatrixRow expandable with 7 dimension bars; overall rank color coding |
| `frontend/src/components/ai/AIDecisionTrace.jsx` | Evidence quality banner with bar; agreed vs dissenting agents; strongest/weakest evidence blocks; anomaly/seasonal impact; 6-stage pipeline timeline |

### Modified Files

| File | Change |
|------|--------|
| `backend/main.py` | Registers `decision_intelligence.router` at `/api/decision` |
| `frontend/src/pages/AIAdvisor.jsx` | Zone 8 added: crop+state selector, Executive Synthesis, Opportunity Matrix, Council, Probability, Strategy, Relationship Map, Decision Trace panels; badge → "Decision Intelligence · Phase 5"; imports PHASE4_ALL_CROPS + SOUTH_INDIAN_STATES |
| `frontend/src/components/ai/AICommandMode.jsx` | Phase 5 section added: internal fetch of `/api/decision/executive-summary`, market posture banner, decision briefing cards, critical escalations |

### Agent Council — Weight System

| Agent | Weight | Specialty |
|-------|--------|-----------|
| TrendAnalyst | 0.22 | Price direction from momentum + 30d vs 90d comparison |
| RiskAnalyst | 0.18 | Volatility CV + anomaly count + tier risk |
| SeasonalAnalyst | 0.15 | Seasonal phase positioning |
| SupplyDemandAnalyst | 0.15 | Price-vs-year inference (no arrival data in AGMARKNET) |
| VolatilityAnalyst | 0.12 | CV patterns and recent price std |
| OpportunityAnalyst | 0.10 | Opportunity score from combined signals |
| ForecastReliabilityAnalyst | 0.08 | Training depth + model tier |
| **Total** | **1.00** | |

Stances: BULLISH / BEARISH / NEUTRAL / HIGH_RISK / FAVORABLE
CouncilResult: dominant_view, minority_view, contradiction_detected, consensus_strength, dissent_agents, weighted_recommendation

### Probability Engine — Heuristic Design

All probabilities are derived from deterministic signals — NO ML, NO LLM:
- `upside_probability` — boosted by bullish momentum + high seasonal + no anomalies
- `downside_probability` — boosted by bearish trend + trough season + anomaly cluster
- `sideways_probability` — default residual when neither up/down dominates
- `volatility_shock_prob` — from CV base × anomaly density multiplier
- `reversal_probability` — base 0.15 + divergent momentum + season contradiction + extreme momentum + anomalies
- `confidence_interval_pct` — `cv × 0.40 + n_anom × 3.0` (clamped 3–50%)

### Executive Synthesis — Posture Classification

| Posture | Trigger | Color |
|---------|---------|-------|
| CRISIS | High risk + bearish + anomalies | Red |
| OPPORTUNISTIC | Bullish momentum + peak season + low risk | Emerald |
| DEFENSIVE | Bearish or moderate risk, no crisis | Amber |
| CAUTIOUS | Contradiction detected or confidence collapse | Orange |
| NEUTRAL | None of the above / mixed signals | Blue |

### Opportunity Matrix — Scoring Formula

`overall_rank = opportunity × 0.35 + stability × 0.20 + confidence × 0.20 + timing × 0.15 + seasonal × 0.10`

5 sorted output lists: top_opportunities / most_dangerous / best_stability / highest_momentum / best_seasonal

### Vite Build Verification (Phase 5)

1572 modules, 0 errors, 8.74s (8 new vs Phase 4B's 1564).

### Architectural Invariants (Phase 5 — in addition to all prior phases)

1. All 8 Phase 5 backend services are pure deterministic Python — zero Gemini calls
2. Agent council stances are derived ONLY from raw_ctx dict (same format as Phase 4B agents)
3. `_run_full_decision_pipeline()` is a synchronous function run via `asyncio.to_thread` — safe for FastAPI async routes
4. Supply/Demand analyst uses price-vs-year + momentum inference (no arrival data in AGMARKNET — clearly documented as inference)
5. Probability values are heuristic (not trained ML) — always include basis bullets explaining derivation
6. Cross-market relationship graph is domain-knowledge hardcoded — not data-driven; 25+ crops, 7 relationship types
7. CommandMode fetches Phase 5 executive summary lazily on mount — zero pre-loading needed from parent
8. Zone 8 in AIAdvisor uses PHASE4_ALL_CROPS (27 crops) + SOUTH_INDIAN_STATES (5 states) for the p5Crop/p5State selectors
9. All Phase 1–4B systems completely intact: streaming, voice, memory, personas, agents, regime, watchlist, opportunity matrix

---

## Phase 5 Stabilization (COMPLETE — 2026-06-14)

### Root Causes Fixed

#### AIDecisionTrace — completely broken (wrong pipeline stage keys)
Frontend used `stage.name` / `stage.detail` / `stage.key_outputs` / `stage.duration_ms`.
Backend `trace_to_dict` uses `stage.stage` / `stage.description` / `stage.result` / `stage.status`.
Also: `trace` key was missing from the council endpoint response.
**Fix:** Complete rewrite of AIDecisionTrace.jsx with correct keys. Added `"trace": result["trace"]` to council endpoint.

#### AIStrategyPanel — wrong field names + array rendering bug
`s.urgency_label` → correct field is `s.urgency`
`s.rationale` is `list[str]` but rendered as `{s.rationale}` (React joins array as comma string)
`s.escalation_awareness` is `list[str]` but passed raw to InfoRow
**Fix:** `urgency_label` → `urgency`; rationale rendered as bullet list via `Array.isArray()` guard; escalation_awareness joined with ` · `.

#### AIRelationshipMap — `inf.type_label` doesn't exist
Backend returns `inf.type` (not `inf.type_label`).
**Fix:** Badge now shows `{cfg.icon} {inf.type}`.

#### AIOpportunityMatrix — `rank_notes` doesn't exist + `crops_scored` missing
`rank_notes` not in any matrix entry; `data.crops_scored` not returned by endpoint.
**Fix:** Removed `rank_notes`, replaced with `entry.recommendation`. Added `"crops_scored": len(entries)` to opportunities endpoint.

#### AIExecutiveSynthesis — repetitive cards + empty posture_headline
`high_priority_cards` aggregated across all crops → many duplicate headlines.
`posture_headline` field wasn't set by synthesis engine so showed nothing.
**Fix:** Deduplication by headline (Set), "show N more" toggle, fallback headline.

### Backend Route Fixes (decision_intelligence.py)
- Council endpoint: added `"trace": result["trace"]` to response dict
- Opportunities endpoint: added `"crops_scored": len(entries)` to response dict

### DashPanel — maxHeight prop added
New optional `maxHeight` prop (e.g. `maxHeight="480px"`) applies `max-height + overflow-y-auto`
to the panel body. Used on heavy Phase 5 panels (AIExecutiveSynthesis 520px, AIOpportunityMatrix 520px,
AICouncilPanel 560px, AIProbabilityPanel 560px, AIDecisionTrace 640px).

### Files Changed (Stabilization)

| File | Change |
|------|--------|
| `frontend/src/components/ai/AIDecisionTrace.jsx` | Complete rewrite — correct pipeline stage keys, trace fields |
| `frontend/src/components/ai/AIStrategyPanel.jsx` | urgency_label→urgency; rationale bullet list; escalation_awareness join |
| `frontend/src/components/ai/AIRelationshipMap.jsx` | inf.type_label → inf.type |
| `frontend/src/components/ai/AIOpportunityMatrix.jsx` | Remove rank_notes; show entry.recommendation instead |
| `frontend/src/components/ai/AIExecutiveSynthesis.jsx` | Deduplicate cards, "show more" toggle, posture_headline fallback, retry button |
| `frontend/src/components/ui/DashPanel.jsx` | maxHeight prop + overflow-y-auto on panel body |
| `frontend/src/pages/AIAdvisor.jsx` | maxHeight applied to Phase 5 DashPanels |
| `backend/api/routes/decision_intelligence.py` | trace + crops_scored in response dicts |

### Vite Build Verification (Stabilization)

1572 modules, 0 errors, 9.14s.

---

## Institutional Architecture Pass (COMPLETE — 2026-06-14)

Row-first dashboard restructure and Decision Trace visual enhancement.
Target aesthetic: Bloomberg Terminal × Palantir × TradingView Enterprise.

### Layout Architecture Change

**Before:** Multi-column compression forcing narrow cards. 4-column Zone 5 at xl=1280px gave each panel ~300px — too tight for AIMarketBriefing + AISimulationPanel inner grids. Phase 5 used a 3-column grid that squashed Strategy + RelationshipMap + DecisionTrace.

**After:** Row-first institutional layout. Each row groups semantically related panels. Column splits use 5-unit grids (3/5 + 2/5) or clean 2-col halves. Decision Trace gets full width.

### New Zone Map

| Zone | Content | Grid |
|------|---------|------|
| Zone 4 | KPI row + {Autonomous Monitor \| Executive Synthesis} | auto-fit / xl:grid-cols-5 (3+2) |
| Zone 5 | {Strategic Insights \| AI Watchlist} | xl:grid-cols-5 (3+2) |
| Zone 6 | {Market Briefing \| Simulation \| Recent Changes} | md:grid-cols-2 xl:grid-cols-3 |
| Zone 7 | Selector → Opportunity Matrix → {Council \| Probability} → {Strategy \| Cross-Market} → Decision Trace | Full-width, xl:grid-cols-2, xl:grid-cols-2, full-width |
| Zone 8 | Historical Archive (unchanged) | — |

### Key Changes

1. **KPI row**: `grid-cols-1 sm:grid-cols-3` → `grid` with `gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'` — never creates ultra-narrow cards.
2. **Executive Synthesis moved**: From Phase 5 (paired with OpportunityMatrix at 50% width) to Zone 4 (paired with AutoMonitor at 40% width) — visible at the top of the page without scrolling.
3. **Watchlist moved**: From 4-col Zone 5 to paired with Strategic Insights in Zone 5 — both given appropriate width.
4. **Sim Lab**: `xl:grid-cols-4` → `xl:grid-cols-3` — 3 panels at wider minimum widths (~400px each at 1280px).
5. **Opportunity Matrix**: From 50% width (paired with ExecSynthesis) → full width — the 7-dimension table needs space.
6. **Council + Probability**: From `lg:grid-cols-2` → `xl:grid-cols-2` — breaks to 2-col at 1280px+ not 1024px+, giving each proper minimum width.
7. **Strategy + Cross-Market**: From 1/3 of a 3-col → `xl:grid-cols-2` equal split — both components need ≥400px.
8. **Decision Trace**: From 1/3 of a 3-col, `defaultOpen=false`, `maxHeight="640px"` → **full width, `defaultOpen=true`, no maxHeight** — explainability deserves maximum surface area.
9. **All `maxHeight` props removed** from Phase 5 panels — eliminated awkward blank space in shorter panels.

### AIDecisionTrace — Visual Enhancement

Redesigned from plain dot-list to institutional reasoning visualization.

**New layout:**
1. **Horizontal Pipeline Flow** (PipelineFlow component) — numbered circles (✓/1–6) connected by colored lines. Emerald = complete, amber = partial, gray = skipped. Always visible at panel top.
2. **Decision Summary** (dark banner) — unchanged.
3. **Evidence Quality** (color-keyed bar) — unchanged.
4. **Agent Consensus** — 2-col agreed/dissenting — unchanged.
5. **Evidence Intelligence** — 2-col: {Strongest Evidence | Confidence Drivers}.
6. **Risk & Uncertainty** — 2-col: {Risk Factors | Caveats}.
7. **Impact Narratives** — 2-col: {Anomaly Impact | Seasonal Impact}.
8. **Stage Details** — expandable vertical list with inline result blocks.

Uses `Fragment` from React (imported) for keyed Fragment nodes in PipelineFlow.
Skeleton loading state mirrors the pipeline flow layout.

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/AIAdvisor.jsx` | Row-first layout restructure (Zones 4-7), auto-fit KPI grid, remove all maxHeight props |
| `frontend/src/components/ai/AIDecisionTrace.jsx` | Complete rewrite — PipelineFlow component, 2-col evidence layout, updated skeleton |

### Vite Build Verification (Institutional Architecture Pass)

1572 modules, 0 errors, 9.76s.

---

## Institutional Intelligence Completion Pass (COMPLETE — 2026-06-14)

### What Was Built

Institutional empty states, fallback intelligence, and universal panel controls for all Phase 5 components. Transforms "missing data" into "structured uncertainty intelligence." Dead panels are eliminated — every component renders meaningful diagnostics when primary intelligence is unavailable.

**Core principle:** The goal is NOT fake intelligence. The goal is transparent institutional uncertainty modeling. The system admits uncertainty intelligently; it does not collapse visually.

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/ai/AICouncilPanel.jsx` | Full rewrite: `CouncilFallback` (quorum unavailable / pipeline failed), `forceExpanded` prop on `AgentCard`, "Expand All" control always visible, `CouncilData` extracted |
| `frontend/src/components/ai/AIProbabilityPanel.jsx` | Full rewrite: `ProbabilityFallback` (indeterminate bars + calibration diagnostic), "Basis" toggle always visible, `ProbabilityData` extracted |
| `frontend/src/components/ai/AIStrategyPanel.jsx` | Full rewrite: `StrategyFallback` (cautionary WAIT stance), `ModeSelector` extracted and rendered ALWAYS (before loading/error), `StrategyData` extracted |
| `frontend/src/components/ai/AIRelationshipMap.jsx` | Added `RelationshipFallback` (sparse relationship diagnostic + general market principles); merged error + no-relationships into single fallback path |
| `frontend/src/components/ai/AIOpportunityMatrix.jsx` | Added `MatrixFallback` (scoring threshold diagnostic + dimension preview with zeroed bars); merged error + no-matrix into single fallback path |
| `frontend/src/components/ai/AIDecisionTrace.jsx` | Added `TraceFallback` (skeleton pipeline + unavailable evidence grid); "Stages" toggle always visible; `showStages` gates section 8 |

### Institutional Fallback Pattern

Every fallback follows this structure:
1. **Amber diagnostic header** (`border-amber-200 bg-amber-50`) — title (FAILED vs UNAVAILABLE), explanation, confidence implication
2. **Default stance / analytical skeleton** (`bg-gray-50`) — what the system would show if data existed, in a muted/zeroed form
3. **Next step** — actionable guidance (e.g., "Select a Tier-A crop")

This is NOT a placeholder. It is a structured uncertainty signal.

### Universal Panel Controls Added

| Component | Control | Always visible? |
|-----------|---------|----------------|
| `AICouncilPanel` | "Expand All / Collapse All" button | Yes (disabled when fallback) |
| `AIProbabilityPanel` | "Basis" toggle (show/hide analytical basis) | Yes (disabled when fallback) |
| `AIStrategyPanel` | Mode selector (5 modes) | Yes — moved before loading/error |
| `AIDecisionTrace` | "Stages" toggle (show/hide stage details) | Yes |
| `AIRelationshipMap` | Type filter pills | Existing ✓ (shown only with data) |
| `AIOpportunityMatrix` | View tabs (5 categories) | Existing ✓ (shown only with data) |

### Key Architectural Rules (Completion Pass)

1. Fallback states render the STRUCTURE of intelligence (dimension names, stage labels, stance format) with muted/zeroed values — never generic error messages
2. `ModeSelector` in `AIStrategyPanel` is always rendered (even during loading) — mode switching should not require waiting for data
3. `forceExpanded` in `AgentCard` is additive — clicking still toggles local state; `forceExpanded` acts as a floor
4. `TraceFallback` reuses `TRACE_STAGE_LABELS` constant for the skeleton pipeline — identical visual to real PipelineFlow
5. All fallback components use `memo()` for performance consistency with the rest of the codebase

### Vite Build Verification (Completion Pass)

1572 modules, 0 errors, 8.29s (identical module count — all changes are within existing files).
