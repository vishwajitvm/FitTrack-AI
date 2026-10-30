from typing import Literal

from pydantic import BaseModel, Field

Capability = Literal["chat", "vision", "reasoning", "fast", "long_context", "embedding"]
Task = Literal["vision", "reasoning", "fast", "medical"]


class ProviderUpdate(BaseModel):
    enabled: bool | None = None
    priority: int | None = None
    base_url: str | None = None  # "" resets to the default URL
    api_key: str | None = None  # "" removes the stored key
    extra: dict[str, str] | None = None


class ProviderReorder(BaseModel):
    order: list[str]


class ModelCreate(BaseModel):
    provider_id: str
    model_id: str
    display_name: str | None = None
    capabilities: list[Capability] = ["chat"]
    context_window: int | None = None


class ModelUpdate(BaseModel):
    enabled: bool | None = None
    priority: int | None = None
    capabilities: list[Capability] | None = None
    display_name: str | None = None


class PinnedModel(BaseModel):
    provider_id: str
    model_id: str


class TaskRouting(BaseModel):
    capability: Capability = "chat"
    pinned: list[PinnedModel] = []


class Routing(BaseModel):
    tasks: dict[str, TaskRouting]
    ollama_last_resort: bool = True
    timeout_seconds: int = Field(60, ge=5, le=600)
    max_attempts: int = Field(8, ge=1, le=50)


class PlaygroundRequest(BaseModel):
    task: Task = "fast"
    prompt: str


class OllamaConfig(BaseModel):
    base_url: str


class OllamaPull(BaseModel):
    name: str


class SettingsUpdate(BaseModel):
    integrations: dict[str, str] | None = None
    app: dict | None = None
