"""Bio-feedback (symptoms + gut-health correlations) and medical reports."""
from datetime import date, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.serializers import biofeedback_out
from app.core.config import settings
from app.db.session import get_db
from app.models import Biomarker, BioFeedback, MedicalReport
from app.schemas.health import BioFeedbackCreate, BiomarkerCreate, BiomarkerUpdate
from app.services.coach import advisor
from app.services.health import correlation, medical
from app.services.nutrition.analyzer import save_upload
from app.services.tracker import daily

router = APIRouter(tags=["Bio-feedback & medical"])

ALLOWED_REPORT_TYPES = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


# ------------------------------------------------------------------ bio-feedback
@router.get("/biofeedback")
async def list_biofeedback(start: date | None = None, end: date | None = None, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    end = end or daily.today_for(user)
    start = start or end - timedelta(days=30)
    rows = (await db.scalars(
        select(BioFeedback).where(BioFeedback.user_id == user.id, BioFeedback.date.between(start, end)).order_by(BioFeedback.timestamp.desc())
    )).all()
    return [biofeedback_out(b) for b in rows]


@router.post("/biofeedback")
async def create_biofeedback(body: BioFeedbackCreate, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    ts = body.timestamp or daily.now_for(user)
    if ts.tzinfo is None:  # the UI sends local wall-clock time
        ts = ts.replace(tzinfo=daily.now_for(user).tzinfo or timezone.utc)
    row = BioFeedback(
        user_id=user.id,
        timestamp=ts,
        date=ts.date(),
        **body.model_dump(exclude={"timestamp"}),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return biofeedback_out(row)


@router.delete("/biofeedback/{entry_id}")
async def delete_biofeedback(entry_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(BioFeedback, entry_id)
    if row is None:
        raise HTTPException(404, "Entry not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get("/biofeedback/correlations")
async def correlations(days: int = 30, db: AsyncSession = Depends(get_db)):
    return await correlation.analyse(db, await daily.get_user(db), min(max(days, 3), 365))


@router.post("/biofeedback/insights")
async def insights(days: int = 30, db: AsyncSession = Depends(get_db)):
    result = await correlation.analyse(db, await daily.get_user(db), min(max(days, 3), 365))
    return await advisor.gut_insights(db, result)


# ------------------------------------------------------------------ medical reports
async def _report_or_404(db: AsyncSession, report_id: int) -> MedicalReport:
    report = await db.get(MedicalReport, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    return report


@router.get("/medical/reports")
async def list_reports(db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(MedicalReport).order_by(MedicalReport.report_date.desc().nulls_last(), MedicalReport.id.desc()))).all()
    return [medical.serialize_report(r) for r in rows]


@router.post("/medical/reports")
async def upload_report(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    report_date: date | None = Form(None),
    report_type: str | None = Form(None),
    lab_name: str | None = Form(None),
    notes: str | None = Form(None),
    analyze: bool = Form(True),
    db: AsyncSession = Depends(get_db),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_REPORT_TYPES:
        raise HTTPException(400, "Upload a PDF or an image (jpg, png, webp).")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File larger than {settings.max_upload_mb} MB")
    user = await daily.get_user(db)
    report = MedicalReport(
        user_id=user.id,
        report_date=report_date or daily.today_for(user),
        report_type=(report_type or "")[:80] or None,
        lab_name=(lab_name or "")[:120] or None,
        notes=notes,
        file_path=save_upload(data, "medical", suffix),
        file_name=file.filename,
        mime_type=file.content_type,
        status="analyzing" if analyze else "uploaded",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    if analyze:
        background.add_task(_analyze_in_background, report.id)
    return medical.serialize_report(report)


async def _analyze_in_background(report_id: int) -> None:
    from app.db.session import SessionLocal

    async with SessionLocal() as db:
        report = await db.get(MedicalReport, report_id)
        if report is not None:
            await medical.analyze_report(db, report, await daily.get_user(db))


@router.get("/medical/reports/{report_id}")
async def get_report(report_id: int, db: AsyncSession = Depends(get_db)):
    return medical.serialize_report(await _report_or_404(db, report_id))


@router.delete("/medical/reports/{report_id}")
async def delete_report(report_id: int, db: AsyncSession = Depends(get_db)):
    report = await _report_or_404(db, report_id)
    if report.file_path:
        (settings.upload_dir / report.file_path.removeprefix("/uploads/")).unlink(missing_ok=True)
    await db.delete(report)
    await db.commit()
    return {"ok": True}


@router.post("/medical/reports/{report_id}/analyze")
async def reanalyze(report_id: int, use_ai: bool = False, db: AsyncSession = Depends(get_db)):
    """Re-reads the report with rules; `?use_ai=true` adds an AI review on top."""
    report = await _report_or_404(db, report_id)
    report = await medical.analyze_report(db, report, await daily.get_user(db), use_ai=use_ai)
    return medical.serialize_report(report)


@router.post("/medical/reports/{report_id}/biomarkers")
async def add_biomarker(report_id: int, body: BiomarkerCreate, db: AsyncSession = Depends(get_db)):
    await _report_or_404(db, report_id)
    data = body.model_dump()
    data["status"] = medical.compute_status(body.value, body.ref_low, body.ref_high, body.status)
    row = Biomarker(report_id=report_id, **data)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return medical.serialize_biomarker(row)


@router.put("/medical/biomarkers/{biomarker_id}")
async def update_biomarker(biomarker_id: int, body: BiomarkerUpdate, db: AsyncSession = Depends(get_db)):
    row = await db.get(Biomarker, biomarker_id)
    if row is None:
        raise HTTPException(404, "Biomarker not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    row.status = medical.compute_status(row.value, row.ref_low, row.ref_high, body.status or row.status)
    await db.commit()
    return medical.serialize_biomarker(row)


@router.delete("/medical/biomarkers/{biomarker_id}")
async def delete_biomarker(biomarker_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Biomarker, biomarker_id)
    if row is None:
        raise HTTPException(404, "Biomarker not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get("/medical/biomarkers/trends")
async def biomarker_trends(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Biomarker, MedicalReport.report_date).join(MedicalReport).order_by(MedicalReport.report_date)
    )).all()
    trends: dict[str, list[dict]] = {}
    for b, report_date in rows:
        if b.value is None:
            continue
        trends.setdefault(b.name, []).append({"date": report_date, "value": b.value, "unit": b.unit, "status": b.status})
    return trends

