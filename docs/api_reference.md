# API Reference

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## Prices

### GET /api/prices/
Fetch price records with filters.

| Param | Type | Required | Description |
|---|---|---|---|
| `crop` | string | Yes | Crop name (e.g. `tomato`) |
| `state` | string | No | State filter |
| `market` | string | No | Market/mandi filter |
| `start_date` | date | No | YYYY-MM-DD |
| `end_date` | date | No | YYYY-MM-DD |
| `limit` | int | No | Max rows (default 100, max 1000) |

### GET /api/prices/summary
Aggregate stats (min/max/avg/trend) for a crop.

### GET /api/prices/latest
Most recent price row for each requested crop.

---

## Forecasts

### POST /api/forecasts/
Run a new forecast.

Request body:
```json
{
  "crop": "tomato",
  "state": "Tamil Nadu",
  "days": 90,
  "model": "prophet"
}
```

### GET /api/forecasts/{crop}/cached
Return cached forecast result.

### GET /api/forecasts/{crop}/accuracy
Return backtested accuracy metrics (MAE, RMSE, MAPE).

---

## Crops

### GET /api/crops/
List all tracked crops.

### GET /api/crops/states
List all tracked states.

### GET /api/crops/{crop_name}
Crop metadata and description.

### GET /api/crops/{crop_name}/markets
Markets where this crop is traded.

---

## AI Advisor

### POST /api/advisor/ask
Ask the AI advisor a question.

Request body:
```json
{
  "question": "What is the best time to sell tomatoes in Tamil Nadu?",
  "crop": "tomato",
  "state": "Tamil Nadu",
  "include_price_context": true
}
```

---

## Reports

### GET /api/reports/pdf
Download a PDF report (returns file).

### GET /api/reports/excel
Download an Excel report (returns file).

---

## Health

### GET /
Service status.

### GET /health
Health check with DB connectivity.
