"""Test tag `source` hội thoại + filter list (tách hội thoại portfolio khỏi chat thường)."""
from datetime import datetime, timezone

from bson import ObjectId

import app.crud.chat as crud
from app.schemas.chat import ChatStreamRequest, ConversationSummary
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


# ── schema ──────────────────────────────────────────────────────────────
def test_chat_request_accepts_mode_portfolio():
    assert ChatStreamRequest(message="hi", mode="portfolio").mode == "portfolio"


def test_chat_request_mode_default_none():
    assert ChatStreamRequest(message="hi").mode is None


def test_conversation_summary_source_default_chat():
    s = ConversationSummary.model_validate(
        {"_id": ObjectId(), "title": "t", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}
    )
    assert s.source == "chat"


# ── crud ────────────────────────────────────────────────────────────────
async def test_start_turn_default_source_chat():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "hỏi thường")
    assert db[crud.CONVERSATIONS].docs[0]["source"] == "chat"


async def test_start_turn_portfolio_source():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "tư vấn danh mục", source="portfolio")
    assert db[crud.CONVERSATIONS].docs[0]["source"] == "portfolio"


async def test_list_filters_portfolio_and_chat():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "chat thường")
    await crud.start_turn(db, USER, None, "danh mục", source="portfolio")
    port = await crud.list_conversations(db, USER, source="portfolio")
    assert len(port) == 1 and port[0]["source"] == "portfolio"
    chat = await crud.list_conversations(db, USER, source="chat")
    assert len(chat) == 1 and chat[0]["source"] == "chat"


async def test_list_chat_includes_legacy_without_source():
    db = FakeDB()
    # Hội thoại cũ (predate tính năng) không có field source → phải coi là "chat".
    db[crud.CONVERSATIONS].docs.append(
        {"_id": ObjectId(), "user_id": ObjectId(USER), "title": "cũ", "updated_at": crud._now(), "pinned": False}
    )
    chat = await crud.list_conversations(db, USER, source="chat")
    assert len(chat) == 1


async def test_list_no_source_returns_all():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "a")
    await crud.start_turn(db, USER, None, "b", source="portfolio")
    assert len(await crud.list_conversations(db, USER)) == 2
