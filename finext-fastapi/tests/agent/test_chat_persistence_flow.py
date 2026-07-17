import asyncio

import pytest
from bson import ObjectId
from fastapi import HTTPException

import app.crud.chat as crud
import app.routers.chat as chat_router
from app.agent.gateway.types import GatewayContext
from app.schemas.chat import ChatStreamRequest
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


async def _fake_run_agent_done(*, emit, **kwargs):
    await emit("token", {"text": "Xin chào, "})
    await emit("token", {"text": "đây là câu trả lời."})
    await emit("done", {"usage": {"in": 500, "out": 40}, "truncated": False})


async def _fake_run_agent_error(*, emit, **kwargs):
    await emit("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."})


def _wire(monkeypatch, db, run_agent_impl):
    async def _blocks(gateway, ctx):
        from app.agent.adapters.base import SystemBlock
        return [SystemBlock(text="stub", cache_hint=True)], None
    monkeypatch.setattr(chat_router, "build_gateway", lambda: None)
    monkeypatch.setattr(chat_router, "build_adapter", lambda **_: None)
    monkeypatch.setattr(chat_router, "build_system_blocks", _blocks)
    monkeypatch.setattr(chat_router, "run_agent", run_agent_impl)
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)


async def _drain(queue):
    frames = []
    while True:
        f = await queue.get()
        if f is None:
            break
        frames.append(f)
    return frames


async def test_produce_persists_assistant_and_usage_on_done(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    ctx = GatewayContext(request_id="r1", user_id=USER)
    body = ChatStreamRequest(message="câu hỏi")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id)
    await _drain(queue)
    asst = [m for m in db[crud.MESSAGES].docs if m["role"] == "assistant"]
    assert len(asst) == 1
    assert asst[0]["content"] == "Xin chào, đây là câu trả lời."
    assert asst[0]["usage"] == {"in": 500, "out": 40}
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY, "date": crud._today()})
    assert g["tok_in"] == 500 and g["tok_out"] == 40  # record_usage đã chạy


async def test_produce_generates_title_on_new_conversation(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)

    async def _fake_title(adapter, first_message, usage_total=None):
        return "Thị trường hôm nay"
    monkeypatch.setattr(chat_router, "generate_title", _fake_title)

    conv_id = await crud.start_turn(db, USER, None, "thị trường hôm nay thế nào")
    ctx = GatewayContext(request_id="r3", user_id=USER)
    body = ChatStreamRequest(message="thị trường hôm nay thế nào")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id, is_new=True)
    frames = await _drain(queue)
    # emit frame 'title' + DB cập nhật tiêu đề
    assert any('"type": "title"' in f and "Thị trường hôm nay" in f for f in frames)
    conv = await db[crud.CONVERSATIONS].find_one({"_id": __import__("bson").ObjectId(conv_id)})
    assert conv["title"] == "Thị trường hôm nay"


async def test_produce_no_title_when_not_new(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)

    async def _fake_title(adapter, first_message, usage_total=None):
        return "KHÔNG NÊN GỌI"
    monkeypatch.setattr(chat_router, "generate_title", _fake_title)

    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    ctx = GatewayContext(request_id="r4", user_id=USER)
    body = ChatStreamRequest(message="câu hỏi tiếp")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id, is_new=False)  # lượt nối tiếp → không đặt tiêu đề
    frames = await _drain(queue)
    assert not any('"type": "title"' in f for f in frames)


async def test_produce_does_not_persist_assistant_on_error(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_error)
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    ctx = GatewayContext(request_id="r2", user_id=USER)
    body = ChatStreamRequest(message="câu hỏi")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id)
    await _drain(queue)
    assert [m for m in db[crud.MESSAGES].docs if m["role"] == "assistant"] == []  # user-msg trống reply → FE "Thử lại"


async def test_chat_stream_blocks_when_quota_denied(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)

    async def _deny(db_, uid):
        return crud.QuotaDecision(False, 429, "hết lượt")
    monkeypatch.setattr(chat_router.crud_chat, "check_and_reserve_quota", _deny)

    class _User:
        id = USER

    class _Req:
        async def is_disconnected(self):
            return False
    with pytest.raises(HTTPException) as ei:
        await chat_router.chat_stream(request=_Req(), body=ChatStreamRequest(message="x"), current_user=_User())
    assert ei.value.status_code == 429


async def test_chat_stream_saves_user_msg_and_returns_stream(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)

    class _User:
        id = USER

    class _Req:
        async def is_disconnected(self):
            return True  # ngắt ngay để không phải chạy hết stream

    body = ChatStreamRequest(message="câu hỏi đầu tiên")
    resp = await chat_router.chat_stream(request=_Req(), body=body, current_user=_User())
    assert resp.media_type == "text/event-stream"
    # user-msg đã lưu + quota đã reserve TRƯỚC khi mở stream
    assert [m for m in db[crud.MESSAGES].docs if m["role"] == "user"][0]["content"] == "câu hỏi đầu tiên"
    q = await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()})
    assert q["msg_count"] == 1
