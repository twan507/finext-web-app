"""Chat chạy nền + hàng đợi per-user (chat-background-queue).

Cốt lõi: FE ngắt SSE giữa chừng → turn KHÔNG bị cancel → chạy tới hết + _persist_answer ghi DB.
Mỗi user 1 turn đồng thời; câu thêm khi bận → xếp hàng FIFO (tối đa 3), đầy → 429; lỗi vẫn dequeue.

Dùng fake mongo + fake run_agent (KHÔNG gọi LLM thật). Reset registry qua conftest.py."""
import asyncio

import pytest
from bson import ObjectId
from fastapi import HTTPException

import app.crud.chat as crud
import app.routers.chat as chat_router
from app.agent.adapters.base import SystemBlock
from app.schemas.chat import ChatStreamRequest
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


def _wire(monkeypatch, db, run_agent_impl):
    """Vá build_gateway/adapter/system + run_agent + get_database + generate_title về fake."""
    async def _blocks(gateway, ctx):
        return [SystemBlock(text="stub", cache_hint=True)], None

    async def _fake_title(adapter, first_message, usage_total=None):
        return "Tiêu đề"

    monkeypatch.setattr(chat_router, "build_gateway", lambda: None)
    monkeypatch.setattr(chat_router, "build_adapter", lambda **_: None)
    monkeypatch.setattr(chat_router, "build_system_blocks", _blocks)
    monkeypatch.setattr(chat_router, "run_agent", run_agent_impl)
    monkeypatch.setattr(chat_router, "generate_title", _fake_title)
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)


class _User:
    def __init__(self, uid: str) -> None:
        self.id = uid


class _Req:
    def __init__(self, disconnected: bool) -> None:
        self._d = disconnected

    async def is_disconnected(self) -> bool:
        return self._d


async def _consume(resp) -> list[str]:
    """Chạy hết generator relay của StreamingResponse, gom frame."""
    return [chunk async for chunk in resp.body_iterator]


async def _assistant_contents(db) -> list[str]:
    return [m["content"] for m in db[crud.MESSAGES].docs if m["role"] == "assistant"]


async def _finish_all(user_id: str) -> None:
    """Dọn chuỗi FIFO còn lại: await current tới khi registry rỗng (chặn vòng lặp vô hạn)."""
    for _ in range(20):
        runner = chat_router._runners.get(user_id)
        if runner is None or runner.current is None:
            return
        try:
            await asyncio.wait_for(runner.current, timeout=2)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            return


async def test_disconnect_does_not_cancel_turn_persists(monkeypatch):
    """CỐT LÕI (reverse-check): FE ngắt giữa chừng → turn nền vẫn chạy hết → assistant reply CÓ trong DB.
    RED nếu khôi phục task.cancel() ở finally của _event_stream."""
    db = FakeDB()
    gate = asyncio.Event()

    async def _run(*, emit, **kwargs):
        await emit("token", {"text": "Xin chào, "})
        await gate.wait()  # giữ turn ở GIỮA CHỪNG khi FE ngắt
        await emit("token", {"text": "đã xong."})
        await emit("done", {"usage": {"in": 100, "out": 10}, "truncated": False})

    _wire(monkeypatch, db, _run)
    body = ChatStreamRequest(message="câu hỏi")
    resp = await chat_router.chat_stream(request=_Req(True), body=body, current_user=_User(USER))
    task = chat_router._runners[USER].current  # nắm task nền TRƯỚC khi nó xong
    assert task is not None and not task.done()

    await _consume(resp)  # FE ngắt ngay → relay kết thúc, KHÔNG cancel task
    assert not task.done()  # turn nền vẫn SỐNG dù relay đã đóng

    gate.set()
    await asyncio.wait_for(task, timeout=2)
    asst = await _assistant_contents(db)
    assert asst == ["Xin chào, đã xong."]  # persist tới đích dù FE đã rời
    assert USER not in chat_router._runners  # xong + rỗng → dọn registry


async def test_busy_enqueues_and_runs_fifo(monkeypatch):
    """Đang bận → câu 2 enqueue (SSE 'queued'); câu 1 xong → câu 2 tự chạy (FIFO, đúng thứ tự)."""
    db = FakeDB()
    g1, g2 = asyncio.Event(), asyncio.Event()

    async def _run(*, emit, messages, **kwargs):
        last = messages[-1]["content"]
        await (g1 if last == "q1" else g2).wait()
        await emit("token", {"text": f"reply-{last}"})
        await emit("done", {"usage": {"in": 1, "out": 1}, "truncated": False})

    _wire(monkeypatch, db, _run)
    await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="q1"), current_user=_User(USER))
    t1 = chat_router._runners[USER].current
    assert not chat_router._runners[USER].queue

    resp2 = await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="q2"), current_user=_User(USER))
    assert len(chat_router._runners[USER].queue) == 1
    assert chat_router._runners[USER].current is t1  # câu 2 KHÔNG chiếm slot đang chạy
    frames2 = await _consume(resp2)
    assert any('"type": "queued"' in f for f in frames2)

    g1.set()
    await asyncio.wait_for(t1, timeout=2)  # câu 1 xong → advance chạy câu 2
    t2 = chat_router._runners[USER].current
    assert t2 is not None and t2 is not t1
    g2.set()
    await asyncio.wait_for(t2, timeout=2)

    assert await _assistant_contents(db) == ["reply-q1", "reply-q2"]  # FIFO
    assert USER not in chat_router._runners


async def test_queue_full_returns_429(monkeypatch):
    """Hàng đợi đầy (3 câu chờ) → câu thứ 4 (turn thứ 5) bị HTTP 429."""
    db = FakeDB()
    gate = asyncio.Event()

    async def _run(*, emit, **kwargs):
        await gate.wait()
        await emit("token", {"text": "x"})
        await emit("done", {"usage": {}, "truncated": False})

    _wire(monkeypatch, db, _run)
    await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="m1"), current_user=_User(USER))
    for i in range(2, 5):  # 3 câu vào hàng đợi
        resp = await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message=f"m{i}"), current_user=_User(USER))
        await _consume(resp)
    assert len(chat_router._runners[USER].queue) == 3

    with pytest.raises(HTTPException) as ei:
        await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="m5"), current_user=_User(USER))
    assert ei.value.status_code == 429
    assert ei.value.detail == "Đang bận, thử lại sau."

    gate.set()
    await _finish_all(USER)  # dọn: thả gate → cả chuỗi drain


async def test_background_turn_error_still_dequeues(monkeypatch):
    """Turn nền lỗi → không kẹt hàng đợi: turn kế vẫn chạy + persist bình thường."""
    db = FakeDB()
    g1, g2 = asyncio.Event(), asyncio.Event()

    async def _run(*, emit, messages, **kwargs):
        last = messages[-1]["content"]
        if last == "bad":
            await g1.wait()
            raise RuntimeError("boom")  # _produce nuốt lỗi (emit 'error', không persist) → vẫn advance
        await g2.wait()
        await emit("token", {"text": "reply-good"})
        await emit("done", {"usage": {"in": 1, "out": 1}, "truncated": False})

    _wire(monkeypatch, db, _run)
    await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="bad"), current_user=_User(USER))
    t1 = chat_router._runners[USER].current
    resp2 = await chat_router.chat_stream(request=_Req(False), body=ChatStreamRequest(message="good"), current_user=_User(USER))
    await _consume(resp2)
    assert len(chat_router._runners[USER].queue) == 1

    g1.set()
    await asyncio.wait_for(t1, timeout=2)  # turn lỗi kết thúc → advance
    t2 = chat_router._runners[USER].current
    assert t2 is not None and t2 is not t1  # hàng đợi KHÔNG kẹt
    g2.set()
    await asyncio.wait_for(t2, timeout=2)

    assert await _assistant_contents(db) == ["reply-good"]  # câu lỗi không lưu; câu kế lưu bình thường
    assert USER not in chat_router._runners


async def test_registry_cleanup_when_idle(monkeypatch):
    """Turn xong + hàng đợi rỗng → registry dọn sạch (không rò runner)."""
    db = FakeDB()

    async def _run(*, emit, **kwargs):
        await emit("token", {"text": "hi"})
        await emit("done", {"usage": {"in": 1, "out": 1}, "truncated": False})

    _wire(monkeypatch, db, _run)
    await chat_router.chat_stream(request=_Req(True), body=ChatStreamRequest(message="q"), current_user=_User(USER))
    task = chat_router._runners[USER].current
    await asyncio.wait_for(task, timeout=2)
    assert USER not in chat_router._runners
