import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.events import AgentEvent, DoneEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.loop import MAX_ITERS, run_agent
from app.routers.chat import STREAM_END, _produce
from app.schemas.chat import ChatStreamRequest

CTX = GatewayContext(request_id="r1", user_id="u1")
SYSTEM = [SystemBlock(text="stub", cache_hint=True)]


class ScriptedAdapter:
    """Trả về kịch bản event định sẵn cho từng vòng gọi."""

    def __init__(self, scripts: list[list[AgentEvent]]) -> None:
        self._scripts = scripts
        self.calls: list[list[dict[str, Any]]] = []

    async def stream_chat(
        self, system: list[SystemBlock], messages: list[dict[str, Any]], tools: list[dict[str, Any]], max_tokens: int
    ) -> AsyncIterator[AgentEvent]:
        self.calls.append(messages)
        script = self._scripts[min(len(self.calls) - 1, len(self._scripts) - 1)]
        for event in script:
            yield event


async def _collect(adapter: Any) -> list[tuple[str, dict[str, Any]]]:
    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter,
        gateway=FixtureGateway(Policy.load()),
        ctx=CTX,
        system=SYSTEM,
        messages=[{"role": "user", "content": "FPT giá bao nhiêu?"}],
        emit=emit,
    )
    return emitted


async def test_plain_answer_emits_tokens_and_done():
    adapter = ScriptedAdapter([[TokenEvent(text="Chào "), TokenEvent(text="bạn"), DoneEvent(usage={"in": 10, "out": 2})]])
    emitted = await _collect(adapter)
    assert [e[0] for e in emitted] == ["token", "token", "done"]
    assert emitted[-1][1]["usage"] == {"in": 10, "out": 2}


async def test_tool_call_round_trip_feeds_result_back_to_model():
    tool_call = ToolCall(
        id="c1",
        name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 50, "out": 6})],
        ]
    )
    emitted = await _collect(adapter)
    types = [e[0] for e in emitted]
    assert types == ["tool_start", "tool_end", "token", "done"]
    assert emitted[0][1]["label"] == "Đang đọc dữ liệu cổ phiếu FPT…"
    assert emitted[1][1]["ok"] is True

    second_call_messages = adapter.calls[1]
    tool_message = second_call_messages[-1]
    assert tool_message["role"] == "tool"
    assert tool_message["tool_call_id"] == "c1"
    assert "118.5" in tool_message["content"]

    # M2 lock-in: message assistant-with-tool_calls đứng NGAY TRƯỚC message tool — đây chính là
    # shape DeepSeek trả 400 nếu sai (arguments phải là STRING json, không phải dict).
    assistant_message = second_call_messages[-2]
    assert assistant_message["role"] == "assistant"
    assert isinstance(assistant_message["tool_calls"], list)
    emitted_call = assistant_message["tool_calls"][0]
    assert emitted_call["id"] == "c1"
    assert emitted_call["type"] == "function"
    assert emitted_call["function"]["name"] == "db_find"
    assert isinstance(emitted_call["function"]["arguments"], str)


async def test_failed_tool_still_emits_tool_end_and_feeds_error_text():
    bad_call = ToolCall(id="c9", name="db_find", arguments={"collection": "stock_snapshot"})
    adapter = ScriptedAdapter(
        [[ToolCallsEvent(calls=[bad_call])], [TokenEvent(text="Xin lỗi"), DoneEvent(usage={})]]
    )
    emitted = await _collect(adapter)
    tool_end = next(e for e in emitted if e[0] == "tool_end")
    assert tool_end[1]["ok"] is False
    assert "projection" in adapter.calls[1][-1]["content"]


async def test_max_iters_guard_emits_error():
    looping_call = ToolCall(
        id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}}
    )
    adapter = ScriptedAdapter([[ToolCallsEvent(calls=[looping_call])]])  # không bao giờ Done
    emitted = await _collect(adapter)
    assert emitted[-1][0] == "error"
    # Message trung thực + tiếng Việt phổ thông: không đổ lỗi user "hỏi dài" mà nêu lỗi tra cứu (owner feedback 2026-07-15).
    assert "có lỗi khi tra cứu dữ liệu" in emitted[-1][1]["message"].lower()
    assert len(adapter.calls) == MAX_ITERS


def test_assistant_tool_message_includes_reasoning_when_present():
    from app.agent.loop import _assistant_tool_message
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot"})
    msg = _assistant_tool_message([call], reasoning_content="suy nghĩ nội bộ")
    assert msg["reasoning_content"] == "suy nghĩ nội bộ"


def test_assistant_tool_message_omits_reasoning_when_none():
    from app.agent.loop import _assistant_tool_message
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot"})
    msg = _assistant_tool_message([call])
    assert "reasoning_content" not in msg


async def test_reasoning_content_passed_back_in_tool_round_trip():
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call], reasoning_content="Cần tra giá FPT")],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 50, "out": 6})],
        ]
    )
    await _collect(adapter)
    assistant_message = adapter.calls[1][-2]
    assert assistant_message["role"] == "assistant"
    assert assistant_message["reasoning_content"] == "Cần tra giá FPT"


async def test_truncated_flag_flows_to_done_payload():
    adapter = ScriptedAdapter([[TokenEvent(text="dài"), DoneEvent(usage={"in": 1, "out": 1}, truncated=True)]])
    emitted = await _collect(adapter)
    assert emitted[-1][0] == "done"
    assert emitted[-1][1]["truncated"] is True


async def test_produce_emits_error_and_sentinel_when_gateway_init_fails(monkeypatch):
    """M1: build_gateway() raise trong _produce → phải có error frame + STREAM_END (không treo)."""

    def _boom():
        raise RuntimeError("mongo init failed")

    monkeypatch.setattr("app.routers.chat.build_gateway", _boom)

    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    body = ChatStreamRequest(message="FPT giá bao nhiêu?")
    await _produce(queue, body, CTX)  # không được raise, không được treo

    frames = []
    while not queue.empty():
        frames.append(queue.get_nowait())

    assert frames[-1] is STREAM_END
    assert any(f is not STREAM_END and '"type": "error"' in f for f in frames)
