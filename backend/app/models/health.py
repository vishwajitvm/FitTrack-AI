from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONType, TimestampMixin, utcnow


class BioFeedback(Base):
    """A subjective symptom entry (bloating, weakness, reflux …). Severity 0-3."""

    __tablename__ = "bio_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    date: Mapped[date] = mapped_column(Date, index=True)
    symptom_type: Mapped[str] = mapped_column(String(30))
    severity: Mapped[int] = mapped_column(Integer, default=1)
    trigger_suspect: Mapped[str | None] = mapped_column(String(200))
    body_part: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)


class MedicalReport(TimestampMixin, Base):
    __tablename__ = "medical_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    report_date: Mapped[date | None] = mapped_column(Date)
    report_type: Mapped[str | None] = mapped_column(String(80))
    lab_name: Mapped[str | None] = mapped_column(String(120))
    file_path: Mapped[str | None] = mapped_column(String(300))
    file_name: Mapped[str | None] = mapped_column(String(200))
    mime_type: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    extracted_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    nutrition_implications: Mapped[list] = mapped_column(JSONType, default=list)
    training_implications: Mapped[list] = mapped_column(JSONType, default=list)
    flags: Mapped[list] = mapped_column(JSONType, default=list)
    provider: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(160))
    extraction_method: Mapped[str | None] = mapped_column(String(20))  # rules | ai | rules+ai
    notes: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)

    biomarkers: Mapped[list["Biomarker"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", lazy="selectin", order_by="Biomarker.id"
    )


class Biomarker(Base):
    __tablename__ = "biomarkers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("medical_reports.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str | None] = mapped_column(String(60))
    value: Mapped[float | None] = mapped_column(Float)
    value_text: Mapped[str | None] = mapped_column(String(80))
    unit: Mapped[str | None] = mapped_column(String(40))
    ref_low: Mapped[float | None] = mapped_column(Float)
    ref_high: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(12), default="unknown")
    notes: Mapped[str | None] = mapped_column(Text)

    report: Mapped[MedicalReport] = relationship(back_populates="biomarkers")
