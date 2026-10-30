from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONType, utcnow


class Preset(Base):
    """A saved routine: a whole workout (cardio + lifting block + exercises) or a meal (list of foods).

    Applying a preset logs everything in one go — the core of fast daily logging.
    """

    __tablename__ = "presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)  # "workout" | "meal"
    name: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str | None] = mapped_column(String(40))
    color: Mapped[str | None] = mapped_column(String(20))
    split: Mapped[str | None] = mapped_column(String(20))
    meal_type: Mapped[str | None] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
