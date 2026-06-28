from fastapi import APIRouter, HTTPException, Query

from backend.data.loaders.duckdb_queries import (
    query_coverage_matrix,
    query_distinct_crops,
    query_distinct_markets,
    query_distinct_states,
)
from backend.data.pipeline.ingestion import get_dataset_stats
from backend.utils.constants import (
    ALL_RECOMMENDED_CROPS,
    SOUTH_INDIAN_STATES,
    TIER1_CROPS,
    TIER2_CROPS,
    TIER3_CROPS,
)

router = APIRouter()


@router.get("/")
def list_crops(south_india_only: bool = Query(True)):
    """Return all distinct crop names available in the dataset."""
    try:
        crops = query_distinct_crops(south_india_only=south_india_only)
    except Exception:
        crops = ALL_RECOMMENDED_CROPS
    return {"crops": crops, "recommended": TIER1_CROPS}


@router.get("/recommended")
def list_recommended_crops():
    """Return crops tiered by forecasting suitability for South India."""
    return {
        "tier1": TIER1_CROPS,
        "tier2": TIER2_CROPS,
        "tier3": TIER3_CROPS,
    }


@router.get("/states")
def list_states():
    return {"states": SOUTH_INDIAN_STATES}


@router.get("/markets")
def list_markets(state: str | None = Query(None, description="Filter markets by state")):
    """List APMC mandis, optionally filtered by state."""
    try:
        markets = query_distinct_markets(state=state)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}")
    return {"markets": markets, "state": state}


@router.get("/coverage")
def crop_coverage(
    crops: list[str] = Query(default=TIER1_CROPS, description="Crops to check"),
):
    """
    Return how many distinct trading days each crop has per state.
    Use this to decide whether a crop+state combo is forecastable.
    """
    try:
        df = query_coverage_matrix(crops=crops)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"coverage": df.to_dict(orient="records")}


@router.get("/dataset/stats")
def dataset_stats():
    """Row counts, date range, and unique crop/state counts for the loaded dataset."""
    return get_dataset_stats()
