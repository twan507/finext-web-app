from collections.abc import AsyncIterator
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.events import AgentEvent, DoneEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.loop import MAX_ITERS, run_agent

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
    assert "giới hạn" in emitted[-1][1]["message"]
    assert len(adapter.calls) == MAX_ITERS
