from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.assistant import ChatRequest, ImportRequest
from app.services.assistant import chat, store
from app.services.tracker import daily
from app.services.tracker.history import HistoryQuery, history

router = APIRouter(tags=["History & assistant"])

Split = Literal["pull", "push", "legs", "cardio", "full_body", "rest", "other"]


@router.get("/history")
async def list_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=5, le=100),
    q: str = Query("", max_length=100),
    start: date | None = None,
    end: date | None = None,
    workout: Literal["any", "trained", "rest"] = "any",
    split: Split | None = None,
    balance: Literal["any", "deficit", "surplus", "pending"] = "any",
    status: Literal["any", "critical", "warning", "ok"] = "any",
    weighed: bool | None = None,
    sort: Literal["date", "calories", "protein", "deficit", "weight", "exercise"] = "date",
    order: Literal["asc", "desc"] = "desc",
    db: AsyncSession = Depends(get_db),
):
    user = await daily.get_user(db)
    query = HistoryQuery(page, page_size, q.strip(), start, end, workout, split, balance, status, weighed, sort, order)
    return await history(db, user, query)


@router.get("/assistant/suggestions")
async def suggestions():
    return {"suggestions": chat.SUGGESTIONS}


@router.post("/assistant/chat")
async def ask(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    user = await daily.get_user(db)
    return await chat.ask_and_save(db, user, body.message, [t.model_dump() for t in body.history], body.conversation_id)


@router.get("/assistant/conversations")
async def conversations(db: AsyncSession = Depends(get_db)):
    return await store.conversations(db)


@router.get("/assistant/conversations/{conversation_id}")
async def conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    msgs = await store.messages(db, conversation_id)
    if not msgs:
        raise HTTPException(404, "Conversation not found")
    return {"id": conversation_id, "messages": msgs}


@router.post("/assistant/import")
async def import_conversation(body: ImportRequest, db: AsyncSession = Depends(get_db)):
    return await store.import_turns(db, [t.model_dump() for t in body.messages])
