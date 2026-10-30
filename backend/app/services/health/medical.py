"""Medical / blood report analysis: text extraction (PDF) or vision (images), biomarker parsing.

Not medical advice — results are framed as nutrition & training considerations to discuss
with a doctor.
"""
import base64
import io
import logging

from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Biomarker, MedicalReport, User
from app.services.llm import router
from app.services.ml import lab_parser
from app.services.llm.client import ChatMessage
from app.services.nutrition.analyzer import prepare_image

log = logging.getLogger(__name__)

MAX_TEXT_CHARS = 24000
MAX_SCANNED_PAGES = 3

SYSTEM_PROMPT = """You are a clinical nutrition assistant reading a lab / medical report for an athlete on a fat-loss program.
Extract EVERY measured biomarker exactly as printed (name, value, unit, reference range). Do not invent values.
Then give practical nutrition and training considerations. You are not diagnosing; recommend seeing a doctor for abnormal results.

Return ONLY JSON:
{
 "summary": "3-5 sentence plain-language summary",
 "biomarkers": [
   {"name": "string", "category": "lipids|glucose|thyroid|liver|kidney|vitamins|minerals|blood_count|hormones|inflammation|other",
    "value": 0.0 or null, "value_text": "as printed", "unit": "string", "ref_low": 0.0 or null, "ref_high": 0.0 or null,
    "status": "low|normal|high|borderline|unknown", "notes": "string"}
 ],
 "nutrition_implications": ["string"],
 "training_implications": ["string"],
 "flags": ["short label of anything needing medical follow-up"]
}"""


def _status(value: float | None, low: float | None, high: float | None, given: str | None) -> str:
    if value is not None and (low is not None or high is not None):
        if low is not None and value < low:
            return "low"
        if high is not None and value > high:
            return "high"
        return "normal"
    return given if given in ("low", "normal", "high", "borderline") else "unknown"


def _num(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def extract_pdf(data: bytes) -> tuple[str, list[str]]:
    """Returns (text, base64 page images for scanned PDFs)."""
    reader = PdfReader(io.BytesIO(data))
    text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    images: list[str] = []
    if len(text) < 200:  # probably a scanned report
        for page in reader.pages[:MAX_SCANNED_PAGES]:
            for img in page.images[:1]:
                try:
                    b64, _ = prepare_image(img.data)
                    images.append(b64)
                except Exception:  # noqa: BLE001
                    continue
    return text, images


def _profile_context(user: User) -> str:
    return (
        f"Athlete: {user.age or 'age unknown'} y, {user.sex or 'sex unknown'}, {user.height_cm} cm, "
        f"{user.current_weight or user.starting_weight} kg. Goal: {user.goal or 'fat loss while preserving muscle'}. "
        f"Diet: {user.diet_type or 'unknown'}. Conditions: {', '.join(user.medical_conditions or []) or 'none reported'}. "
        f"Medications: {', '.join(user.medications or []) or 'none reported'}."
    )


RULES_MIN_MARKERS = 3  # enough markers read by rules → no LLM needed


def _load_file(report: MedicalReport) -> tuple[str, list[str]]:
    path = settings.upload_dir / report.file_path.removeprefix("/uploads/") if report.file_path else None
    if not path or not path.exists():
        return report.extracted_text or "", []
    data = path.read_bytes()
    if (report.mime_type or "").endswith("pdf") or path.suffix.lower() == ".pdf":
        return extract_pdf(data)
    return "", [base64.b64encode(data).decode()]


def _apply_rule_markers(report: MedicalReport, markers: list[dict]) -> None:
    report.biomarkers.clear()
    for m in markers:
        report.biomarkers.append(
            Biomarker(name=m["name"], category=m["category"], value=m["value"], value_text=m["value_text"], unit=m["unit"],
                      ref_low=m["ref_low"], ref_high=m["ref_high"], status=m["status"], notes=m["notes"])
        )
    nutrition, training, flags, summary = lab_parser.implications(markers)
    report.summary, report.nutrition_implications, report.training_implications, report.flags = summary, nutrition, training, flags


def _apply_ai_result(report: MedicalReport, data: dict, keep_rule_markers: bool) -> None:
    report.summary = data.get("summary") or report.summary
    report.nutrition_implications = [str(x) for x in data.get("nutrition_implications") or []] or report.nutrition_implications
    report.training_implications = [str(x) for x in data.get("training_implications") or []] or report.training_implications
    report.flags = [str(x) for x in data.get("flags") or []] or report.flags
    if keep_rule_markers:
        return
    report.biomarkers.clear()
    for b in data.get("biomarkers") or []:
        value, low, high = _num(b.get("value")), _num(b.get("ref_low")), _num(b.get("ref_high"))
        report.biomarkers.append(
            Biomarker(
                name=str(b.get("name") or "Unknown")[:120],
                category=(str(b["category"])[:60] if b.get("category") else None),
                value=value,
                value_text=str(b.get("value_text") or (value if value is not None else ""))[:80],
                unit=(str(b["unit"])[:40] if b.get("unit") else None),
                ref_low=low,
                ref_high=high,
                status=_status(value, low, high, b.get("status")),
                notes=b.get("notes"),
            )
        )


async def analyze_report(db: AsyncSession, report: MedicalReport, user: User, use_ai: bool = False) -> MedicalReport:
    """Rules first (regex biomarker extraction + reference ranges + rule implications).
    The LLM is used only for scanned/image reports, when rules find < RULES_MIN_MARKERS markers,
    or when the user explicitly asks for an AI review (`use_ai`)."""
    report.status, report.error = "analyzing", None
    await db.commit()
    try:
        text, images = _load_file(report)
        report.extracted_text = text[:MAX_TEXT_CHARS] or None
        if not text and not images and not report.notes:
            raise ValueError("Could not read any text or images from this file.")

        markers = lab_parser.parse(text) if text else []
        rules_ok = len(markers) >= RULES_MIN_MARKERS
        if rules_ok:
            _apply_rule_markers(report, markers)
            report.extraction_method, report.provider, report.model = "rules", None, None

        if use_ai or not rules_ok:
            prompt = _profile_context(user) + "\n\n"
            if report.notes:
                prompt += f"User notes: {report.notes}\n\n"
            prompt += f"REPORT TEXT:\n{text[:MAX_TEXT_CHARS]}" if text else "The report is attached as image(s)."
            messages = [ChatMessage("system", SYSTEM_PROMPT), ChatMessage("user", prompt, images_b64=images or None)]
            try:
                result = await router.complete(db, "medical", messages, json_mode=True, max_tokens=4000)
            except router.AllProvidersFailed:
                if not rules_ok:
                    raise
            else:
                _apply_ai_result(report, result.data or {}, keep_rule_markers=rules_ok)
                report.provider, report.model = result.provider, result.model
                report.extraction_method = "rules+ai" if rules_ok else "ai"
    except Exception as exc:  # noqa: BLE001  (AI failure, unreadable file, bad JSON …)
        log.warning("Medical report %s analysis failed: %s", report.id, exc)
        report.status = "failed"
        report.error = str(exc)
        await db.commit()
        return report

    report.status = "analyzed"
    await db.commit()
    await db.refresh(report)
    return report


def compute_status(value, low, high, given=None) -> str:
    return _status(value, low, high, given)


def serialize_biomarker(b: Biomarker) -> dict:
    return {
        "id": b.id,
        "report_id": b.report_id,
        "name": b.name,
        "category": b.category,
        "value": b.value,
        "value_text": b.value_text,
        "unit": b.unit,
        "ref_low": b.ref_low,
        "ref_high": b.ref_high,
        "status": b.status,
        "notes": b.notes,
    }


def serialize_report(r: MedicalReport) -> dict:
    return {
        "id": r.id,
        "report_date": r.report_date,
        "report_type": r.report_type,
        "lab_name": r.lab_name,
        "file_url": r.file_path,
        "file_name": r.file_name,
        "status": r.status,
        "summary": r.summary,
        "nutrition_implications": r.nutrition_implications or [],
        "training_implications": r.training_implications or [],
        "flags": r.flags or [],
        "biomarkers": [serialize_biomarker(b) for b in r.biomarkers],
        "provider": r.provider,
        "model": r.model,
        "extraction_method": r.extraction_method,
        "notes": r.notes,
        "error": r.error,
        "created_at": r.created_at,
    }
