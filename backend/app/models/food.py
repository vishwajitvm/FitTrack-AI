from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import SEMANTIC_DIM, Base, EmbeddingType, JSONType, TimestampMixin, utcnow


class FoodLog(TimestampMixin, Base):
    __tablename__ = "food_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    daily_summary_id: Mapped[int] = mapped_column(ForeignKey("daily_summaries.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    meal_type: Mapped[str] = mapped_column(String(20), default="other")
    time: Mapped[str | None] = mapped_column(String(5))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    food_name: Mapped[str] = mapped_column(String(200))
    ingredients_json: Mapped[list] = mapped_column(JSONType, default=list)
    quantity: Mapped[float | None] = mapped_column(Float)
    portion_unit: Mapped[str | None] = mapped_column(String(40))
    weight_grams: Mapped[float | None] = mapped_column(Float)

    calories: Mapped[float] = mapped_column(Float, default=0)
    protein: Mapped[float] = mapped_column(Float, default=0)
    carbs: Mapped[float] = mapped_column(Float, default=0)
    fat: Mapped[float] = mapped_column(Float, default=0)
    fibre: Mapped[float] = mapped_column(Float, default=0)
    calories_low: Mapped[float | None] = mapped_column(Float)
    calories_high: Mapped[float | None] = mapped_column(Float)

    confidence_score: Mapped[float | None] = mapped_column(Float)
    research_source: Mapped[str | None] = mapped_column(String(300))
    image_url: Mapped[str | None] = mapped_column(String(300))
    tags: Mapped[list] = mapped_column(JSONType, default=list)
    notes: Mapped[str | None] = mapped_column(Text)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("food_analyses.id", ondelete="SET NULL"))


class FoodAnalysis(Base):
    """A photo/description analysis run. Items are saved to food_logs only after user review."""

    __tablename__ = "food_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    image_path: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="completed")
    error: Mapped[str | None] = mapped_column(Text)
    input_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    result_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    # ML: perceptual hash (duplicate photos) and image embedding (similar meals)
    phash: Mapped[str | None] = mapped_column(String(16), index=True)
    image_embedding: Mapped[list | None] = mapped_column(EmbeddingType(SEMANTIC_DIM))


class FoodLibraryItem(Base):
    """Reference nutrition per 100 g (built-in IFCT/USDA-style values + cached lookups)."""

    __tablename__ = "food_library"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    aliases: Mapped[list] = mapped_column(JSONType, default=list)
    category: Mapped[str] = mapped_column(String(40), default="mixed")
    calories: Mapped[float] = mapped_column(Float)
    protein: Mapped[float] = mapped_column(Float)
    carbs: Mapped[float] = mapped_column(Float)
    fat: Mapped[float] = mapped_column(Float)
    fibre: Mapped[float] = mapped_column(Float, default=0)
    density_g_per_ml: Mapped[float | None] = mapped_column(Float)
    serving_hint: Mapped[str | None] = mapped_column(String(120))
    tags: Mapped[list] = mapped_column(JSONType, default=list)
    source: Mapped[str] = mapped_column(String(120), default="built-in")
    embedding: Mapped[list | None] = mapped_column(EmbeddingType())  # trigram (lexical)
    semantic_embedding: Mapped[list | None] = mapped_column(EmbeddingType(SEMANTIC_DIM))  # Nomic text


class MealMemory(Base):
    """A saved, user-confirmed meal photo: the 'personal meal memory' used for k-NN recognition."""

    __tablename__ = "meal_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("food_analyses.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    label: Mapped[str] = mapped_column(String(200))
    image_url: Mapped[str | None] = mapped_column(String(300))
    container_id: Mapped[str | None] = mapped_column(String(40))
    items_json: Mapped[list] = mapped_column(JSONType, default=list)
    calories: Mapped[float] = mapped_column(Float, default=0)
    weight_grams: Mapped[float | None] = mapped_column(Float)
    image_embedding: Mapped[list] = mapped_column(EmbeddingType(SEMANTIC_DIM))


class PortionCalibration(Base):
    """Running mean of log(user-corrected weight / estimated weight) per container x food type."""

    __tablename__ = "portion_calibrations"
    __table_args__ = (UniqueConstraint("container_id", "food_category", name="uq_portion_calibrations_container_category"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    container_id: Mapped[str] = mapped_column(String(40))
    food_category: Mapped[str] = mapped_column(String(40))
    samples: Mapped[int] = mapped_column(Integer, default=0)
    mean_log_ratio: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
