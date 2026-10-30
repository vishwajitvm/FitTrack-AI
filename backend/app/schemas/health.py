from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import limited

SymptomType = Literal[
    "bloating", "gas", "weakness", "low_energy", "acid_reflux", "poor_sleep", "soreness", "headache", "cramps", "nausea", "other"
]


class BioFeedbackCreate(BaseModel):
    timestamp: datetime | None = None
    symptom_type: SymptomType
    severity: int = Field(1, ge=0, le=3)
    trigger_suspect: limited(200) | None = None
    body_part: limited(80) | None = None
    notes: str | None = None


class BiomarkerCreate(BaseModel):
    name: limited(120)
    category: limited(60) | None = None
    value: float | None = None
    value_text: limited(80) | None = None
    unit: limited(40) | None = None
    ref_low: float | None = None
    ref_high: float | None = None
    status: Literal["low", "normal", "high", "borderline", "unknown"] | None = None
    notes: str | None = None


class BiomarkerUpdate(BaseModel):
    name: limited(120) | None = None
    category: limited(60) | None = None
    value: float | None = None
    value_text: limited(80) | None = None
    unit: limited(40) | None = None
    ref_low: float | None = None
    ref_high: float | None = None
    status: Literal["low", "normal", "high", "borderline", "unknown"] | None = None
    notes: str | None = None
