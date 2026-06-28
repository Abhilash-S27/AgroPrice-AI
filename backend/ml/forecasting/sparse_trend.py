"""
Sparse-trend fallback forecaster (Tier C).

For crops whose continuity is too weak for a trustworthy Prophet fit
(e.g. Cardamoms: 2,940 historical days but only 78 in the last year),
Prophet's changepoint/seasonality machinery anchors on stale data and
produces misleadingly confident output. This model is deliberately simpler
and honest about its limits:

  point forecast = robust recent trend  ×  monthly seasonal multiplier
  uncertainty    = residual spread, widening with horizon (~80% band)

Components:
  1. Trend — Theil–Sen style median-of-slopes over the most recent
     observations (robust to the price spikes common in mandi data).
  2. Seasonality — monthly multipliers from the FULL history
     (month_avg / overall_avg), which survives sparse recent data.
  3. Uncertainty — std of detrended residuals in the trend window,
     scaled by sqrt(horizon/30) so the band widens over time.

NOT a substitute for Prophet — used only when Tier classification says
Prophet would be unreliable. The API response flags method="sparse_trend"
so the UI renders it as a trend estimate, not a full forecast.
"""
import numpy as np
import pandas as pd

from backend.ml.forecasting.base import BaseForecaster

_TREND_WINDOW = 120     # most recent observations used for the trend
_MIN_POINTS   = 20      # absolute minimum to attempt a trend at all
_Z80          = 1.28    # ~80% two-sided interval, matches Prophet's default


class SparseTrendForecaster(BaseForecaster):

    def __init__(self):
        self._is_fitted = False
        self._training_rows = 0
        self._anchor_date: pd.Timestamp | None = None
        self._anchor_price: float = 0.0
        self._slope_per_day: float = 0.0
        self._monthly_mult: dict[int, float] = {}
        self._resid_std: float = 0.0

    def fit(self, df: pd.DataFrame) -> "SparseTrendForecaster":
        df = df.sort_values("ds").reset_index(drop=True)
        if len(df) < _MIN_POINTS:
            raise ValueError(
                f"Sparse trend needs at least {_MIN_POINTS} observations, got {len(df)}"
            )
        self._training_rows = len(df)

        # ── 1. Monthly seasonal multipliers from full history ──────────────
        overall = float(df["y"].mean())
        by_month = df.groupby(df["ds"].dt.month)["y"].mean()
        self._monthly_mult = {
            int(m): float(v) / overall if overall > 0 else 1.0
            for m, v in by_month.items()
        }

        # ── 2. Robust trend over the recent window ─────────────────────────
        recent = df.tail(_TREND_WINDOW).reset_index(drop=True)
        t = (recent["ds"] - recent["ds"].iloc[0]).dt.days.to_numpy(dtype=float)
        y = recent["y"].to_numpy(dtype=float)

        # deseasonalize so the slope reflects trend, not season position
        months = recent["ds"].dt.month.to_numpy()
        y_deseason = y / np.array([self._monthly_mult.get(int(m), 1.0) for m in months])

        # median of pairwise slopes on a subsample (full Theil–Sen is O(n²))
        n = len(t)
        idx = np.linspace(0, n - 1, min(n, 40)).astype(int)
        slopes = [
            (y_deseason[j] - y_deseason[i]) / (t[j] - t[i])
            for k, i in enumerate(idx) for j in idx[k + 1:]
            if t[j] > t[i]
        ]
        self._slope_per_day = float(np.median(slopes)) if slopes else 0.0

        # cap runaway trends: ±0.5%/day of the anchor price keeps multi-month
        # extrapolation from sparse data within plausible bounds
        anchor = float(np.median(y_deseason[-min(14, n):]))
        cap = abs(anchor) * 0.005
        self._slope_per_day = float(np.clip(self._slope_per_day, -cap, cap))

        self._anchor_price = anchor
        self._anchor_date = recent["ds"].iloc[-1]

        # ── 3. Residual spread for uncertainty ─────────────────────────────
        fitted = anchor + self._slope_per_day * (t - t[-1])
        resid = y_deseason - fitted
        self._resid_std = float(np.std(resid)) if len(resid) > 2 else anchor * 0.15

        self._is_fitted = True
        return self

    def predict(self, days: int) -> pd.DataFrame:
        if not self._is_fitted:
            raise RuntimeError("Model is not fitted. Call fit() first.")

        future_ds = pd.date_range(
            self._anchor_date + pd.Timedelta(days=1), periods=days, freq="D"
        )
        h = np.arange(1, days + 1, dtype=float)

        base = self._anchor_price + self._slope_per_day * h
        mult = np.array([self._monthly_mult.get(d.month, 1.0) for d in future_ds])
        yhat = base * mult

        # band widens with sqrt of horizon (random-walk-like uncertainty growth)
        spread = _Z80 * self._resid_std * np.sqrt(np.maximum(h / 30.0, 1.0)) * mult

        out = pd.DataFrame({
            "ds":         future_ds,
            "yhat":       np.clip(yhat, 0, None),
            "yhat_lower": np.clip(yhat - spread, 0, None),
            "yhat_upper": np.clip(yhat + spread, 0, None),
        })
        return out

    @property
    def training_rows(self) -> int:
        return self._training_rows

    def get_model_name(self) -> str:
        return "sparse_trend"
