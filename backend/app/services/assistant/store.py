"""Ask FitTrack chat history in the database (so it survives browsers, devices and moving the app)."""
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AssistantMessage

TITLE_CHARS = 80


def new_conversation_id() -> str:
    return uuid.uuid4().hex


async def history(db: AsyncSession, conversation_id: str, limit: int = 20) -> list[dict]:
    """The last turns of a conversation as {role, content}, oldest first."""
    rows = (
        await db.scalars(
            select(AssistantMessage)
            .where(AssistantMessage.conversation_id == conversation_id)
            .order_by(AssistantMessage.created_at.desc(), AssistantMessage.id.desc())
            .limit(limit)
        )
    ).all()
    return [{"role": r.role, "content": r.content} for r in reversed(rows)]


async def save_turn(db: AsyncSession, conversation_id: str, question: str, answer: dict) -> tuple[int, int]:
    """Stores the question and the answer (with its metadata); returns their ids."""
    meta = {k: v for k, v in answer.items() if k != "answer"}
    q = AssistantMessage(conversation_id=conversation_id, role="user", content=question, meta={})
    a = AssistantMessage(conversation_id=conversation_id, role="assistant", content=answer["answer"], meta=meta)
    db.add_all([q, a])
    await db.commit()
    return q.id, a.id


async def conversations(db: AsyncSession) -> list[dict]:
    """Every conversation, newest first, titled by its first question."""
    stats = (
        await db.execute(
            select(
                AssistantMessage.conversation_id,
                func.min(AssistantMessage.created_at),
                func.max(AssistantMessage.created_at),
                func.count(),
            ).group_by(AssistantMessage.conversation_id)
        )
    ).all()
    out = []
    for cid, started, updated, count in stats:
        first = await db.scalar(
            select(AssistantMessage.content)
            .where(AssistantMessage.conversation_id == cid, AssistantMessage.role == "user")
            .order_by(AssistantMessage.created_at, AssistantMessage.id)
            .limit(1)
        )
        title = (first or "Conversation").strip().replace("\n", " ")
        out.append({
            "id": cid,
            "title": title if len(title) <= TITLE_CHARS else title[: TITLE_CHARS - 1] + "…",
            "started_at": started,
            "updated_at": updated,
            "messages": count,
        })
    return sorted(out, key=lambda c: c["updated_at"], reverse=True)


async def messages(db: AsyncSession, conversation_id: str) -> list[dict]:
    rows = (
        await db.scalars(
            select(AssistantMessage)
            .where(AssistantMessage.conversation_id == conversation_id)
            .order_by(AssistantMessage.created_at, AssistantMessage.id)
        )
    ).all()
    return [{"id": r.id, "role": r.role, "content": r.content, "meta": r.meta or {}, "created_at": r.created_at} for r in rows]


async def import_turns(db: AsyncSession, turns: list[dict]) -> dict:
    """Saves a conversation kept elsewhere (e.g. the browser's old local copy) as a new conversation.
    Importing the same conversation twice is a no-op."""
    turns = [t for t in turns if t.get("content")]
    if not turns:
        return {"conversation_id": None, "imported": 0, "skipped": True}
    first_q = next((t["content"] for t in turns if t["role"] == "user"), None)
    for c in await conversations(db):
        if c["messages"] == len(turns) and first_q is not None:
            existing = await messages(db, c["id"])
            if [(m["role"], m["content"]) for m in existing] == [(t["role"], t["content"]) for t in turns]:
                return {"conversation_id": c["id"], "imported": 0, "skipped": True}
    cid = new_conversation_id()
    now = datetime.now().astimezone()
    for t in turns:
        db.add(AssistantMessage(conversation_id=cid, role=t["role"], content=t["content"], meta=t.get("meta") or {},
                                created_at=t.get("created_at") or now))
    await db.commit()
    return {"conversation_id": cid, "imported": len(turns), "skipped": False}
