from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/pdf")
def download_pdf_report(
    crop: str = Query(...),
    state: str | None = Query(None),
    period: str = Query("monthly", description="daily | monthly | yearly"),
):
    # TODO: call reports/generator.py → reports/pdf_report.py
    # TODO: return FileResponse with generated PDF
    raise NotImplementedError("Implement PDF report in Phase 4")


@router.get("/excel")
def download_excel_report(
    crop: str = Query(...),
    state: str | None = Query(None),
):
    # TODO: call reports/generator.py → reports/excel_report.py
    # TODO: return FileResponse with generated Excel file
    raise NotImplementedError("Implement Excel report in Phase 4")


@router.get("/summary")
def get_summary_report(
    crop: str = Query(...),
    year: int = Query(...),
):
    # TODO: return a JSON summary report (min/max/avg/trend/anomalies)
    raise NotImplementedError("Implement summary report in Phase 4")
