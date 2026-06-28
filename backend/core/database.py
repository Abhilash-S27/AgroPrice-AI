import duckdb

from backend.core.config import settings
from backend.core.logger import get_logger

logger = get_logger(__name__)


class DuckDBManager:
    """Manages a single persistent DuckDB connection for the application."""

    def __init__(self):
        self._conn: duckdb.DuckDBPyConnection | None = None

    def connect(self, read_only: bool = False) -> None:
        db_path = str(settings.DUCKDB_PATH)
        # Use ":memory:" if no path configured, otherwise persist to disk
        if not db_path or db_path == ":memory:":
            self._conn = duckdb.connect(":memory:")
            logger.info("DuckDB connected (in-memory)")
        else:
            settings.DUCKDB_PATH.parent.mkdir(parents=True, exist_ok=True)
            self._conn = duckdb.connect(db_path, read_only=read_only)
            mode = "read-only" if read_only else "read-write"
            logger.info("DuckDB connected (%s)", mode, path=db_path)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.info("DuckDB connection closed")

    def is_connected(self) -> bool:
        return self._conn is not None

    @property
    def conn(self) -> duckdb.DuckDBPyConnection:
        if self._conn is None:
            raise RuntimeError("DuckDB is not connected. Call db_manager.connect() first.")
        return self._conn

    def execute(self, query: str, params: list | None = None):
        """Execute a query and return a DuckDB relation.

        Uses a per-call cursor (connection clone): the base connection is NOT
        safe for concurrent queries across FastAPI's threadpool — interleaved
        execution corrupts cursor state (fetchone() returning None, empty
        DataFrames). Cursors share the database catalog, so the 'prices' view
        is visible to all of them.
        """
        cur = self.conn.cursor()
        if params:
            return cur.execute(query, params)
        return cur.execute(query)

    def query_df(self, query: str, params: list | None = None):
        """Execute a query and return a pandas DataFrame."""
        return self.execute(query, params).df()

db_manager = DuckDBManager()
