"""Imports an edited fitness_tracker.xlsx / .xlsm back into the database (bi-directional sync).

Rows with an existing ID are updated; rows without an ID (or with an ID this database doesn't have) are inserted.
Only the Food Log, Workout Log and Body Weight sheets are read — the others are computed.

Workbooks edited in Excel come back with Excel's types (numbers as floats, times as time objects, dates as
datetimes or serial numbers, typed words in any case), so every cell is coerced and validated here. A bad row is
skipped and reported instead of failing the whole file, and everything is written in one transaction: either the
whole import lands or nothing changes.
"""
import io
import re
import zipfile
from datetime import date, datetime, time, timedelta
from typing import get_args

from openpyxl import load_workbook
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FoodLog, WorkoutLog, WorkoutSession
from app.schemas.tracking import MealType, Split
from app.services.nutrition.tagging import add_time_tags, infer_tags
from app.services.tracker import daily

MAX_BYTES = 20 * 1024 * 1024
MAX_ERRORS = 50
MEALS = set(get_args(MealType))
SPLITS = set(get_args(Split))
MEAL_ALIASES = {"snack": "evening_snack", "morning snack": "morning_snack", "evening snack": "evening_snack", "pre workout": "pre_workout",
                "post workout": "post_workout", "preworkout": "pre_workout", "postworkout": "post_workout", "supper": "dinner"}
SPLIT_ALIASES = {"full body": "full_body", "fullbody": "full_body", "leg": "legs", "upper": "other", "lower": "legs"}
EXCEL_EPOCH = date(1899, 12, 30)
SHEETS = ("Food Log", "Workout Log", "Body Weight")


class ImportError_(ValueError):
    """The file can't be imported at all (wrong type, not a FitTrack workbook)."""


class RowError(ValueError):
    """One row is invalid; it is skipped and reported."""


def _cols(model, name: str) -> int | None:
    return getattr(model.__table__.c[name].type, "length", None)


def _rows(ws) -> list[tuple[int, dict]]:
    values = list(ws.iter_rows(values_only=True))
    if not values:
        return []
    headers = [str(h).strip() if h is not None else "" for h in values[0]]
    return [(i, dict(zip(headers, row))) for i, row in enumerate(values[1:], start=2) if any(c not in (None, "") for c in row)]


def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _f(v, field: str = "") -> float | None:
    if _blank(v):
        return None
    if isinstance(v, bool):
        raise RowError(f"{field}: expected a number, got {v!r}")
    try:
        x = float(str(v).replace(",", "").strip()) if isinstance(v, str) else float(v)
    except (TypeError, ValueError):
        raise RowError(f"{field}: expected a number, got {v!r}") from None
    if x != x or x in (float("inf"), float("-inf")):
        raise RowError(f"{field}: expected a number, got {v!r}")
    return x


def _nonneg(v, field: str) -> float | None:
    x = _f(v, field)
    if x is not None and x < 0:
        raise RowError(f"{field}: can't be negative ({x:g})")
    return x


def _id(v) -> int | None:
    """12, 12.0, "12", "12.0", "S12" → 12."""
    if _blank(v):
        return None
    s = str(v).strip().lstrip("Ss")
    try:
        x = float(s)
    except ValueError:
        return None
    return int(x) if x.is_integer() and x > 0 else None


def _d(v) -> date | None:
    if _blank(v):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if 20000 < v < 80000:  # Excel serial day number
            return EXCEL_EPOCH + timedelta(days=int(v))
        raise RowError(f"Date: can't read {v!r}")
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%m/%d/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s[:10] if fmt == "%Y-%m-%d" else s, fmt).date()
        except ValueError:
            continue
    raise RowError(f"Date: can't read {v!r} (use YYYY-MM-DD)")


def _t(v) -> str | None:
    """Clock time as HH:MM from "6:36", "06:36:00", "6:36 PM", a time/datetime, or an Excel day fraction."""
    if _blank(v):
        return None
    if isinstance(v, datetime):
        v = v.time()
    if isinstance(v, time):
        return f"{v.hour:02d}:{v.minute:02d}"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if 0 <= v < 1:
            minutes = round(v * 24 * 60)
            return f"{minutes // 60 % 24:02d}:{minutes % 60:02d}"
        raise RowError(f"Time: can't read {v!r}")
    m = re.fullmatch(r"\s*(\d{1,2})[:.](\d{2})(?::\d{2}(?:\.\d+)?)?\s*([AaPp][Mm])?\s*", str(v))
    if not m:
        raise RowError(f"Time: can't read {v!r} (use HH:MM)")
    h, mi = int(m[1]), int(m[2])
    if m[3]:
        if not 1 <= h <= 12:
            raise RowError(f"Time: can't read {v!r}")
        h = h % 12 + (12 if m[3].lower() == "pm" else 0)
    if h > 23 or mi > 59:
        raise RowError(f"Time: can't read {v!r}")
    return f"{h:02d}:{mi:02d}"


def _s(v, length: int | None = None) -> str | None:
    """Text cell → stripped string (numbers/dates turned into text), cut to the column length."""
    if _blank(v):
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    if isinstance(v, datetime):
        v = v.date() if v.time() == time(0) else v
    s = (v.isoformat() if isinstance(v, (date, datetime, time)) else str(v)).strip()
    return s[:length] if length else s


def _choice(v, allowed: set[str], aliases: dict[str, str], default: str) -> str:
    s = (_s(v) or "").lower().strip()
    if not s:
        return default
    s = aliases.get(s, s).replace("-", "_").replace(" ", "_")
    s = aliases.get(s, s)
    return s if s in allowed else default


def _same(existing_date: date | None, existing_name: str | None, d: date, name) -> bool:
    """An ID in the file only updates this database's row when it is plausibly the same entry (same day or same name),
    so a workbook from another install can't overwrite unrelated rows that happen to share an ID."""
    return existing_date == d or (bool(existing_name) and (_s(name) or "").lower() == existing_name.lower())


def _open(data: bytes):
    if not data:
        raise ImportError_("The file is empty.")
    if len(data) > MAX_BYTES:
        raise ImportError_("The file is larger than 20 MB — that isn't a FitTrack workbook.")
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise ImportError_("That isn't an Excel workbook (.xlsx / .xlsm). Export one from Settings → Your data first.")
    try:
        wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001  openpyxl raises many types for damaged files
        raise ImportError_(f"Excel couldn't be read ({type(exc).__name__}). Save it again as .xlsx and retry.") from exc
    if not any(s in wb.sheetnames for s in SHEETS):
        raise ImportError_("No Food Log, Workout Log or Body Weight sheet found — is this a FitTrack export?")
    return wb


def _food(r: dict, row: FoodLog, user) -> None:
    name = _s(r.get("Food"), _cols(FoodLog, "food_name"))
    if not name:
        raise RowError("Food: name is empty")
    ingredients = [x.strip() for x in str(_s(r.get("Ingredients")) or "").split(",") if x.strip()]
    renamed = (row.food_name, row.ingredients_json or []) != (name, ingredients)
    row.food_name = name
    row.time = _t(r.get("Time"))
    row.meal_type = _choice(r.get("Meal"), MEALS, MEAL_ALIASES, "other")
    row.ingredients_json = ingredients
    row.quantity = _nonneg(r.get("Quantity"), "Quantity")
    row.portion_unit = _s(r.get("Unit"), _cols(FoodLog, "portion_unit"))
    row.weight_grams = _nonneg(r.get("Weight (g)"), "Weight (g)")
    row.calories = _nonneg(r.get("Calories"), "Calories") or 0
    row.protein = _nonneg(r.get("Protein (g)"), "Protein (g)") or 0
    row.carbs = _nonneg(r.get("Carbs (g)"), "Carbs (g)") or 0
    row.fat = _nonneg(r.get("Fat (g)"), "Fat (g)") or 0
    row.fibre = _nonneg(r.get("Fibre (g)"), "Fibre (g)") or 0
    row.calories_low, row.calories_high = _nonneg(r.get("Calories Low"), "Calories Low"), _nonneg(r.get("Calories High"), "Calories High")
    conf = _f(r.get("Confidence"), "Confidence")
    row.confidence_score = None if conf is None else max(0.0, min(1.0, conf / 100 if conf > 1 else conf))
    row.research_source = _s(r.get("Source"), _cols(FoodLog, "research_source")) or row.research_source or "Imported from Excel"
    row.notes = _s(r.get("Notes"))
    # keep tags the app worked out (e.g. from the meal parser) unless the food itself was changed in Excel
    if renamed or not row.tags:
        row.tags = add_time_tags(infer_tags(row.food_name, ingredients), row.time, user.bedtime)


def _workout(r: dict, row: WorkoutLog, kind: str, sessions: dict[int, int]) -> None:
    row.workout_type = kind
    row.exercise_name = _s(r.get("Exercise"), _cols(WorkoutLog, "exercise_name")) or "Exercise"
    row.target_muscle = _s(r.get("Target Muscle"), _cols(WorkoutLog, "target_muscle"))
    sets = _nonneg(r.get("Sets"), "Sets")
    row.sets = int(round(sets)) if sets else None
    row.reps = _s(r.get("Reps"), _cols(WorkoutLog, "reps"))
    row.weight_kg = _nonneg(r.get("Weight (kg)"), "Weight (kg)")
    row.cardio_duration_min = _nonneg(r.get("Cardio (min)"), "Cardio (min)")
    row.met_value = _nonneg(r.get("MET"), "MET")
    row.rpe = _s(r.get("RPE"), _cols(WorkoutLog, "rpe"))
    row.notes = _s(r.get("Notes"))
    sid = _id(r.get("Session ID"))
    row.session_id = sessions.get(sid, sid) if sid else None


async def import_workbook(db: AsyncSession, data: bytes) -> dict:
    wb = _open(data)
    user = await daily.get_user(db)
    touched: set[date] = set()
    counts = {"food": 0, "workouts": 0, "weights": 0}
    created = {"food": 0, "workouts": 0}
    errors: list[dict] = []
    failed = 0

    def fail(sheet: str, line: int, exc: Exception) -> None:
        nonlocal failed
        failed += 1
        if len(errors) < MAX_ERRORS:
            errors.append({"sheet": sheet, "row": line, "error": str(exc)})

    try:
        if "Food Log" in wb.sheetnames:
            for line, r in _rows(wb["Food Log"]):
                try:
                    d = _d(r.get("Date"))
                    if not d:
                        raise RowError("Date is empty")
                    fid = _id(r.get("ID"))
                    row = await db.get(FoodLog, fid) if fid else None
                    if row is not None and not _same(row.date, row.food_name, d, r.get("Food")):
                        row = None
                    summary = await daily.ensure_summary(db, user, d)
                    is_new = row is None
                    if row is None:
                        row = FoodLog(food_name="", tags=[])
                    old_date = row.date
                    _food(r, row, user)
                    row.daily_summary_id, row.date = summary.id, d
                    db.add(row)
                    await db.flush()
                    touched.update(x for x in (d, old_date) if x)
                    counts["food"] += 1
                    created["food"] += is_new
                except RowError as exc:
                    fail("Food Log", line, exc)

        if "Workout Log" in wb.sheetnames:
            rows = _rows(wb["Workout Log"])
            sessions: dict[int, int] = {}  # Session ID in the file → id in this database
            # sessions first, so exercises below can point at sessions created by this import
            for line, r in [x for x in rows if str(x[1].get("Type") or "").strip().lower() == "lifting_block"]:
                try:
                    d = _d(r.get("Date"))
                    if not d:
                        raise RowError("Date is empty")
                    file_id = _id(r.get("ID")) or _id(r.get("Session ID"))
                    sess = await db.get(WorkoutSession, file_id) if file_id else None
                    if sess is not None and sess.date != d and sess.split != _choice(r.get("Split"), SPLITS, SPLIT_ALIASES, "other"):
                        sess = None
                    summary = await daily.ensure_summary(db, user, d)
                    is_new = sess is None
                    if sess is None:
                        sess = WorkoutSession(daily_summary_id=summary.id, date=d)
                    old_date = sess.date
                    sess.daily_summary_id, sess.date = summary.id, d
                    sess.split = _choice(r.get("Split"), SPLITS, SPLIT_ALIASES, "other")
                    sess.lifting_duration_min = _nonneg(r.get("Lifting (min)"), "Lifting (min)")
                    sess.lifting_met = _nonneg(r.get("MET"), "MET") or 4.0
                    sess.notes = _s(r.get("Notes"))
                    db.add(sess)
                    await db.flush()
                    if file_id:
                        sessions[file_id] = sess.id
                    touched.update(x for x in (d, old_date) if x)
                    counts["workouts"] += 1
                    created["workouts"] += is_new
                except RowError as exc:
                    fail("Workout Log", line, exc)

            for line, r in rows:
                kind = str(r.get("Type") or "").strip().lower()
                if kind == "lifting_block":
                    continue
                try:
                    if kind not in ("cardio", "strength"):
                        raise RowError(f"Type: must be strength, cardio or lifting_block (got {r.get('Type')!r})")
                    d = _d(r.get("Date"))
                    if not d:
                        raise RowError("Date is empty")
                    wid = _id(r.get("ID"))
                    row = await db.get(WorkoutLog, wid) if wid else None
                    if row is not None and not _same(row.date, row.exercise_name, d, r.get("Exercise")):
                        row = None
                    summary = await daily.ensure_summary(db, user, d)
                    is_new = row is None
                    if row is None:
                        row = WorkoutLog(exercise_name="")
                    old_date = row.date
                    _workout(r, row, kind, sessions)
                    if row.session_id and await db.get(WorkoutSession, row.session_id) is None:
                        row.session_id = None  # the session isn't in this database: keep the exercise, unlinked
                    row.daily_summary_id, row.date = summary.id, d
                    db.add(row)
                    await db.flush()
                    touched.update(x for x in (d, old_date) if x)
                    counts["workouts"] += 1
                    created["workouts"] += is_new
                except RowError as exc:
                    fail("Workout Log", line, exc)

        if "Body Weight" in wb.sheetnames:
            for line, r in _rows(wb["Body Weight"]):
                try:
                    d, w = _d(r.get("Date")), _f(r.get("Morning Weight (kg)"), "Morning Weight (kg)")
                    if not d or w is None:
                        continue
                    if not 20 <= w <= 400:
                        raise RowError(f"Morning Weight (kg): {w:g} doesn't look like a body weight")
                    (await daily.ensure_summary(db, user, d)).morning_weight = w
                    touched.add(d)
                    counts["weights"] += 1
                except RowError as exc:
                    fail("Body Weight", line, exc)

        await db.commit()
    except Exception:
        await db.rollback()
        raise
    finally:
        wb.close()

    for d in sorted(touched):
        await daily.recompute(db, user, d)
    return {
        "imported": counts,
        "created": created,
        "skipped": failed,
        "errors": errors,
        "dates": [d.isoformat() for d in sorted(touched)],
    }
