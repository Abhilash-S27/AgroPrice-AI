from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.middleware.request_logger import RequestLoggerMiddleware
from backend.api.routes import advisor, ai_insights, briefing, crops, decision_intelligence, forecasts, intelligence, prices, reports, watchlist
from backend.core.config import settings
from backend.core.database import db_manager
from backend.core.logger import get_logger
from backend.data.pipeline.ingestion import get_dataset_stats, run_ingestion_pipeline

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AgroPrice AI starting", env=settings.APP_ENV)

    # ── Database ──────────────────────────────────────────────────────────────
    db_manager.connect()
    n = run_ingestion_pipeline()
    if n > 0:
        stats = get_dataset_stats()
        logger.info("Dataset loaded", **stats)

    # ── Cross-crop analytics cache pre-warm ──────────────────────────────────
    # Populates "cross_crop_analytics_v3" so Multi-Crop Compare, AI Battle,
    # Strategy Planner, and Watchlist work immediately without a Forecast page visit.
    try:
        from backend.api.routes.prices import get_cross_crop_analytics
        result = get_cross_crop_analytics()
        logger.info("Cross-crop cache warmed", crops=len(result.get("crops", [])))
    except Exception as exc:
        logger.warning("Cross-crop cache warm failed (non-fatal): %s", exc)

    # ── Gemini startup validation ─────────────────────────────────────────────
    # Import the already-initialized singleton (created at module import time in
    # advisor_ai_router). This validates the key and logs a masked prefix so
    # the operator can confirm the correct key loaded without seeing it in logs.
    try:
        from backend.services.advisor_ai_router import _gemini
        if _gemini.is_ready():
            logger.info("Gemini AI Advisor ready: model=%s", _gemini.model_name())
        else:
            logger.warning(
                "Gemini AI Advisor is NOT ready — GEMINI_API_KEY missing or invalid. "
                "Set GEMINI_API_KEY in backend/.env and restart. "
                "The advisor will return fallback responses until resolved."
            )
    except Exception as exc:
        logger.error("Gemini startup validation failed (non-fatal): %s", exc)

    yield
    db_manager.close()
    logger.info("AgroPrice AI shut down")


app = FastAPI(
    title="AgroPrice AI",
    description="South Indian Agricultural Market Intelligence API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Dev convenience: Vite may land on any localhost port when 5173 is taken
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)

app.include_router(prices.router,    prefix="/api/prices",    tags=["Prices"])
app.include_router(forecasts.router, prefix="/api/forecasts", tags=["Forecasts"])
app.include_router(crops.router,     prefix="/api/crops",     tags=["Crops"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["Reports"])
app.include_router(advisor.router,   prefix="/api/advisor",   tags=["AI Advisor"])
app.include_router(ai_insights.router, prefix="/api/ai",       tags=["GenAI Insights"])
app.include_router(briefing.router,   prefix="/api/briefing",  tags=["AI Briefing"])
app.include_router(watchlist.router,     prefix="/api/watchlist",     tags=["AI Watchlist"])
app.include_router(intelligence.router,        prefix="/api/intelligence",  tags=["Autonomous Intelligence"])
app.include_router(decision_intelligence.router, prefix="/api/decision", tags=["Decision Intelligence"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "AgroPrice AI", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    stats = get_dataset_stats() if db_manager.is_connected() else {}
    return {"status": "healthy", "db": db_manager.is_connected(), "dataset": stats}
