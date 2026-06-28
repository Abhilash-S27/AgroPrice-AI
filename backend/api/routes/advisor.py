import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.core.logger import get_logger
from backend.data.schema.models import AdvisorRequest, AdvisorResponse
from backend.utils.validators import validate_crop, validate_state

logger = get_logger(__name__)
router = APIRouter()


@router.post("/ask", response_model=AdvisorResponse)
async def ask_advisor(request: AdvisorRequest) -> AdvisorResponse:
    """
    Grounded conversational AI Advisor — Phase 1B.

    Pipeline:
      sanitize → guardrails → memory → intent → context → prompt → Gemini → memory

    Errors are returned as STRUCTURED categories (never a bare 500):
      validation_error (422) · pipeline_error (502 with category + user-safe message)
    """
    from backend.services.advisor_ai_router import route_advisor_query
    from backend.services.advisor_memory_manager import AdvisorMemoryManager

    # Validate crop/state if provided
    if request.crop:
        try:
            request = request.model_copy(update={"crop": validate_crop(request.crop)})
        except ValueError as exc:
            raise HTTPException(status_code=422, detail={
                "category": "validation_error", "message": str(exc)})
    if request.state:
        try:
            request = request.model_copy(update={"state": validate_state(request.state)})
        except ValueError as exc:
            raise HTTPException(status_code=422, detail={
                "category": "validation_error", "message": str(exc)})

    session_id = request.session_id or AdvisorMemoryManager.generate_session_id()

    try:
        result = await route_advisor_query(
            question=request.question,
            crop=request.crop,
            state=request.state,
            session_id=session_id,
            view_mode=request.view_mode,
        )
    except Exception as exc:  # noqa: BLE001 — surfaced as a structured category
        logger.error("advisor_pipeline_error", error=str(exc), exc_info=True)
        raise HTTPException(status_code=502, detail={
            "category": "pipeline_error",
            "message": "The advisor pipeline hit an internal error while "
                       "grounding your question. The team has the full trace "
                       "— please retry in a moment.",
        })

    return AdvisorResponse(
        answer=result["answer"],
        model_used=result["model_used"],
        sources=result["sources"],
        session_id=session_id,
        intent=result.get("intent", "unknown"),
        inferred_context=result.get("inferred_context", []),
        error_type=result.get("error_type"),
        latency_ms=result.get("latency_ms", 0.0),
        grounded=result.get("grounded", False),
        agent_insights=result.get("agent_insights", {}),
        reasoning_trace=result.get("reasoning_trace"),
        persona=result.get("persona"),
    )


@router.post("/ask/stream")
async def ask_advisor_stream(request: AdvisorRequest) -> StreamingResponse:
    """
    Streaming AI Advisor — Phase 3A.

    Sends pipeline events as Server-Sent Events (SSE):
      data: {"type": "token", "token": "..."}       — incremental text
      data: {"type": "done",  "intent": ..., ...}   — final metadata
      data: {"type": "error", "error_type": ..., ...} — on failure

    The same grounded pipeline (sanitize → guardrail → memory → intent →
    context → agents → history → prompt) runs before streaming begins.
    Memory is updated after the stream completes.

    Bypass the Vite proxy for SSE — use VITE_API_BASE_URL (http://localhost:8001)
    directly so the dev proxy does not buffer the stream.
    """
    from backend.services.advisor_ai_router import route_advisor_query_stream
    from backend.services.advisor_memory_manager import AdvisorMemoryManager

    async def _validation_error_gen(message: str):
        yield f"data: {json.dumps({'type': 'error', 'error_type': 'validation_error', 'message': message})}\n\n"

    if request.crop:
        try:
            request = request.model_copy(update={"crop": validate_crop(request.crop)})
        except ValueError as exc:
            return StreamingResponse(
                _validation_error_gen(str(exc)),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
    if request.state:
        try:
            request = request.model_copy(update={"state": validate_state(request.state)})
        except ValueError as exc:
            return StreamingResponse(
                _validation_error_gen(str(exc)),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    session_id = request.session_id or AdvisorMemoryManager.generate_session_id()

    async def event_gen():
        try:
            async for chunk in route_advisor_query_stream(
                question=request.question,
                crop=request.crop,
                state=request.state,
                session_id=session_id,
                view_mode=request.view_mode,
            ):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error("stream_route_error", error=str(exc), exc_info=True)
            yield (
                f"data: {json.dumps({'type': 'error', 'error_type': 'pipeline_error', 'message': 'Streaming failed — please retry.'})}\n\n"
            )

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",     # disable nginx buffering for SSE
            "Connection": "keep-alive",
        },
    )


@router.get("/health")
def advisor_health() -> dict:
    """
    Lightweight readiness check for the AI Advisor subsystem.

    Returns component status without triggering any LLM or DB call.
    Safe to poll from frontend or monitoring systems.
    """
    from backend.core.config import settings
    from backend.core.database import db_manager
    from backend.services import advisor_ai_router
    from backend.services.advisor_memory_manager import memory_manager

    return {
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "gemini_ready":      advisor_ai_router._gemini.is_ready(),
        "duckdb_ready":      db_manager.is_connected(),
        "model":             advisor_ai_router._gemini.model_name(),
        "memory_backend":    type(memory_manager).__name__,
    }


@router.get("/debug")
def advisor_debug() -> dict:
    """
    Developer diagnostics (Phase 1B stabilization) — pipeline observability
    without log access: route status, Gemini connectivity, memory state,
    and the FULL stage trace of the most recent request.
    """
    from backend.core.config import settings
    from backend.services import advisor_ai_router
    from backend.services.advisor_memory_manager import memory_manager

    return {
        "route": "ok",
        "gemini": {
            "ready": advisor_ai_router._gemini.is_ready(),
            "model": advisor_ai_router._gemini.model_name(),
            "api_key_loaded": bool(settings.GEMINI_API_KEY),
        },
        "memory": {
            "backend": type(memory_manager).__name__,
            "active_sessions": memory_manager.active_session_count(),
        },
        "last_request_trace": advisor_ai_router.last_trace,
    }


@router.post("/analyse")
async def analyse_market(
    crop: str,
    state: str | None = None,
):
    # TODO: generate automatic market analysis using current price + forecast data
    raise NotImplementedError("Implement market analysis in Phase 5")


@router.get("/history")
def get_conversation_history(session_id: str) -> dict:
    """Return compact conversation history for a session."""
    from backend.services.advisor_memory_manager import memory_manager
    history = memory_manager.get_history_string(session_id, max_turns=10)
    exists  = memory_manager.session_exists(session_id)
    return {"session_id": session_id, "exists": exists, "history": history}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    """
    Clear a session — user-initiated conversation reset (Phase 1C).

    Deletes all stored turns and inherited crop/state context for the given
    session. Idempotent: deleting a non-existent session returns status=cleared.
    """
    from backend.services.advisor_memory_manager import memory_manager
    existed = memory_manager.session_exists(session_id)
    memory_manager.clear(session_id)
    return {"session_id": session_id, "status": "cleared", "existed": existed}
