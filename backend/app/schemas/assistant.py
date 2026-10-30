"""Request bodies for the assistant (chat over your own data)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import limited


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: limited(6000)


class ChatRequest(BaseModel):
    message: limited(1000) = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    # Continue a stored conversation (its turns are read from the database); omit to start a new one.
    conversation_id: limited(32) | None = None


class ImportTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: limited(20000)
    meta: dict = Field(default_factory=dict)
    created_at: datetime | None = None


class ImportRequest(BaseModel):
    messages: list[ImportTurn] = Field(max_length=500)
