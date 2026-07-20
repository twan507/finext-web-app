import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.events import AgentEvent, DoneEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.loop import (
    MAX_FAILED_TOOL_ROUNDS,
    MAX_ITERS,
    _last_assistant_text,
    _rebrief_overlap,
    _salient_numbers,
    _should_dedup,
    generate_title,
    run_agent,
)
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
    assert [e[0] for e in emitted] == ["token", "done"]
    assert "".join(e[1]["text"] for e in emitted if e[0] == "token") == "Chào bạn"
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
    # Số token event tuỳ STREAM_CHUNK — kiểm THỨ TỰ: tool_start → tool_end → (≥1 token) → done.
    assert types[0] == "tool_start" and types[1] == "tool_end" and types[-1] == "done"
    assert "token" in types
    assert "".join(e[1]["text"] for e in emitted if e[0] == "token") == "Giá FPT là 118,5"
    assert emitted[0][1]["label"] == "dữ liệu cổ phiếu FPT"
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
    await _produce(queue, body, CTX, "conv-test")  # không được raise, không được treo

    frames = []
    while not queue.empty():
        frames.append(queue.get_nowait())

    assert frames[-1] is STREAM_END
    assert any(f is not STREAM_END and '"type": "error"' in f for f in frames)


async def test_generate_title_cleans_quotes_label_and_period():
    """generate_title bỏ ngoặc kép + tiền tố 'Tiêu đề:' + dấu chấm cuối, lấy 1 dòng."""
    adapter = ScriptedAdapter([[TokenEvent(text='"Tiêu đề: Thị trường hôm nay."'), DoneEvent(usage={"in": 5, "out": 3})]])
    title = await generate_title(adapter, "thị trường hôm nay thế nào")
    assert title == "Thị trường hôm nay"


async def test_generate_title_empty_output_returns_empty():
    adapter = ScriptedAdapter([[DoneEvent(usage={})]])  # không có token
    assert await generate_title(adapter, "câu hỏi") == ""


async def test_interim_turn_text_is_discarded():
    """Text model sinh ra Ở LƯỢT GỌI-TOOL (preamble) phải bị bỏ, không stream ra client."""
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text="Tôi sẽ tra cứu giá FPT."), ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 5, "out": 3})],
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Tôi sẽ tra cứu" not in answer
    assert "Giá FPT là 118,5" in answer


async def test_final_answer_is_sanitized():
    """Câu trả lời cuối phải qua sanitize_answer (mã nội bộ bị dọn)."""
    adapter = ScriptedAdapter(
        [[TokenEvent(text="Thanh khoản (VSI 0,92) thấp, dữ liệu `stock_finstats`."),
          DoneEvent(usage={})]]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "VSI" not in answer and "stock_finstats" not in answer and "`" not in answer
    assert "92% trung bình 5 phiên" in answer


class CountingGateway:
    """Đếm số lần chạm gateway.find để kiểm anti-loop KHÔNG execute lại query đã lỗi."""

    def __init__(self, inner: Any) -> None:
        self._inner = inner
        self.find_calls = 0

    async def find(self, *args: Any, **kwargs: Any) -> Any:
        self.find_calls += 1
        return await self._inner.find(*args, **kwargs)

    async def aggregate(self, *args: Any, **kwargs: Any) -> Any:
        return await self._inner.aggregate(*args, **kwargs)

    async def stats(self, *args: Any, **kwargs: Any) -> Any:
        return await self._inner.stats(*args, **kwargs)


async def test_repeated_failed_query_blocked_and_not_re_executed():
    # Model lặp lại y hệt db_find hỏng (thiếu projection trên collection large → ok=False) mỗi vòng.
    bad = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}})
    adapter = ScriptedAdapter([[ToolCallsEvent(calls=[bad])]])  # không bao giờ Done
    gateway = CountingGateway(FixtureGateway(Policy.load()))

    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter, gateway=gateway, ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "x"}], emit=emit,
    )
    # Chỉ chạm gateway.find ĐÚNG 1 lần (vòng đầu); các vòng sau bị chặn trước khi execute.
    assert gateway.find_calls == 1
    # Model nhận feedback chống-lặp trong tool message vòng cuối.
    # (Vòng force nay chèn nudge ở cuối working nên tìm tool message gần nhất, không dùng [-1].)
    last_tool_msg = next(m for m in reversed(adapter.calls[-1]) if m["role"] == "tool")
    assert "Đừng lặp lại" in last_tool_msg["content"]
    # Vẫn kết thúc bằng error, không treo. Cầu dao tool-fail-storm dừng SỚM (2 vòng fail + 1 vòng ép),
    # KHÔNG còn đốt hết MAX_ITERS như trước — đây chính là mục tiêu của bản sửa.
    assert emitted[-1][0] == "error"
    assert len(adapter.calls) == MAX_FAILED_TOOL_ROUNDS + 1
    assert len(adapter.calls) < MAX_ITERS


async def test_distinct_failed_queries_each_execute_once():
    # 2 query KHÁC nhau (khác filter) → cả hai đều được chạy (không bị nhầm là lặp).
    call_a = ToolCall(id="a", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}})
    call_b = ToolCall(id="b", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "HPG"}})
    adapter = ScriptedAdapter([[ToolCallsEvent(calls=[call_a])], [ToolCallsEvent(calls=[call_b])]])
    gateway = CountingGateway(FixtureGateway(Policy.load()))

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        return None

    await run_agent(
        adapter=adapter, gateway=gateway, ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "x"}], emit=emit,
    )
    assert gateway.find_calls == 2  # hai chữ ký khác nhau, không chặn oan


class ToolsAwareAdapter:
    """Adapter đọc `tools`: tools rỗng → trả text (vòng-ép); tools non-rỗng → gọi tool mãi."""

    def __init__(self, tool_call: ToolCall, final_text: str) -> None:
        self._tool_call = tool_call
        self._final_text = final_text
        self.calls: list[list[dict[str, Any]]] = []
        self.tools_seen: list[list[dict[str, Any]]] = []

    async def stream_chat(
        self, system: list[SystemBlock], messages: list[dict[str, Any]], tools: list[dict[str, Any]], max_tokens: int
    ) -> AsyncIterator[AgentEvent]:
        self.calls.append(messages)
        self.tools_seen.append(tools)
        if tools:
            yield ToolCallsEvent(calls=[self._tool_call])
        else:
            yield TokenEvent(text=self._final_text)
            yield DoneEvent(usage={})


async def test_preamble_only_final_triggers_retry():
    # Lượt 1: chỉ có câu dẫn "Tôi sẽ..." + Done (KHÔNG gọi tool) → coi như chưa trả lời → nudge.
    # Lượt 2 (sau nudge): trả nội dung thật.
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text="Tôi sẽ lấy dữ liệu VNINDEX..."), DoneEvent(usage={})],
            [TokenEvent(text="VNINDEX 1804 điểm."), DoneEvent(usage={"in": 5, "out": 4})],
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Tôi sẽ" not in answer
    assert "VNINDEX 1804 điểm." in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)


async def test_empty_final_retries_then_answers():
    # Lượt 1: Done rỗng (0 token) → không stream rỗng cho khách, mà nudge tiếp.
    adapter = ScriptedAdapter(
        [
            [DoneEvent(usage={})],
            [TokenEvent(text="VNINDEX 1804 điểm."), DoneEvent(usage={"in": 5, "out": 4})],
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "VNINDEX 1804 điểm." in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)


async def test_max_iters_forces_answer_not_error():
    # Adapter gọi tool mãi khi còn tools; vòng cuối force (tools=[]) → trả text best-effort.
    tool_call = ToolCall(id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}})
    adapter = ToolsAwareAdapter(tool_call, "Trả lời best-effort.")
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Trả lời best-effort." in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)  # KHÔNG phải error rỗng
    assert adapter.tools_seen[-1] == []  # vòng cuối bị cấm tool


async def test_normal_answer_still_streams_chunks():
    long_text = "VNINDEX đang ở vùng 1.804 điểm, thanh khoản ổn định và dòng tiền lan tỏa nhiều nhóm ngành."
    adapter = ScriptedAdapter([[TokenEvent(text=long_text), DoneEvent(usage={"in": 3, "out": 40})]])
    emitted = await _collect(adapter)
    token_events = [e for e in emitted if e[0] == "token"]
    assert len(token_events) >= 2  # vẫn nhả nhiều chunk
    assert emitted[-1][0] == "done"
    assert "".join(e[1]["text"] for e in token_events) == long_text


async def test_tools_then_final_answer_unchanged():
    # Lượt 1 gọi tool → chạy tool (fake gateway) → lượt 2 text. Giữ hành vi cũ.
    tool_call = ToolCall(
        id="c1", name="db_find",
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
    assert types[0] == "tool_start" and types[1] == "tool_end" and types[-1] == "done"
    assert "token" in types
    assert "".join(e[1]["text"] for e in emitted if e[0] == "token") == "Giá FPT là 118,5"


# ── Round 3: grounding + force-nudge ─────────────────────────────────────────

_RANK_TABLE_GUESS = "| Hạng | Ngành | Điểm |\n| 1 | Ngân hàng | 8.5 |\n| 2 | Thép | 7.2 |\nƯớc lượng."
_RANK_TABLE_FINAL = "| Hạng | Ngành | Điểm |\n| 1 | Ngân hàng | 9.1 |\n| 2 | Thép | 6.8 |\nDữ liệu thật."


def test_looks_like_data_answer_table_only():
    from app.agent.loop import _looks_like_data_answer
    assert _looks_like_data_answer("| 1 | Ngân hàng | 8.5 |")  # bảng có ô số → data (grounding)
    # BỎ heuristic ≥6 số: câu nhiều số nhưng KHÔNG bảng KHÔNG còn bị coi là data (regression Q04).
    assert not _looks_like_data_answer("a 1,2 b 3,4 c 5,6 d 7,8 e 9,1 f 2,3")
    # Headline vài số (Q03-style) KHÔNG bị coi là data → không ép grounding.
    assert not _looks_like_data_answer("VNINDEX 1.804,24 tăng 22,12 (+1,24%)")
    assert not _looks_like_data_answer("Chào bạn, hôm nay thị trường ổn định.")


def test_looks_like_data_answer_price_claim():
    """Khẳng định GIÁ cụ thể 'X đồng' → data cần grounding (diệt bịa giá Q02); 'triệu đồng' khái niệm KHÔNG khớp."""
    from app.agent.loop import _looks_like_data_answer
    assert _looks_like_data_answer("Giá FPT hôm nay là 138.500 đồng, tăng nhẹ.")  # bịa giá inline → phải bắt
    assert _looks_like_data_answer("FPT đóng cửa 68.000 đ/cp.")
    # Câu tư vấn khái niệm "10 triệu đồng" — 'triệu' chen giữa số và 'đồng' → KHÔNG khớp (không ép grounding).
    assert not _looks_like_data_answer("Với 10 triệu đồng, anh nên phân bổ vào 2-3 mã.")


class NudgeAwareForceAdapter:
    """Còn tools → gọi tool mãi. tools==[] (vòng ép): CHỈ trả lời khi thấy _FORCE_ANSWER_NUDGE;
    không có nudge → trả RỖNG (tái hiện LỖI 1 để chứng minh nudge là bắt buộc)."""

    def __init__(self, tool_call: ToolCall, final_text: str) -> None:
        self._tool_call = tool_call
        self._final_text = final_text
        self.calls: list[list[dict[str, Any]]] = []
        self.tools_seen: list[list[dict[str, Any]]] = []

    async def stream_chat(
        self, system: list[SystemBlock], messages: list[dict[str, Any]], tools: list[dict[str, Any]], max_tokens: int
    ) -> AsyncIterator[AgentEvent]:
        from app.agent.loop import _FORCE_ANSWER_NUDGE
        self.calls.append(messages)
        self.tools_seen.append(tools)
        if tools:
            yield ToolCallsEvent(calls=[self._tool_call])
            return
        has_nudge = any(isinstance(m.get("content"), str) and _FORCE_ANSWER_NUDGE in m["content"] for m in messages)
        if has_nudge:
            yield TokenEvent(text=self._final_text)
        yield DoneEvent(usage={})


async def test_force_turn_injects_answer_nudge_not_empty():
    # LỖI 1: vòng force (tools=[]) phải được chèn _FORCE_ANSWER_NUDGE → M3 trả best-effort, KHÔNG error.
    tool_call = ToolCall(id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}})
    adapter = NudgeAwareForceAdapter(tool_call, "Best-effort answer.")
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Best-effort answer." in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    assert adapter.tools_seen[-1] == []  # vòng cuối cấm tool
    # Nudge thực sự có mặt trong messages của vòng ép cuối.
    from app.agent.loop import _FORCE_ANSWER_NUDGE
    assert any(isinstance(m.get("content"), str) and _FORCE_ANSWER_NUDGE in m["content"] for m in adapter.calls[-1])


async def test_data_answer_without_tool_retries_then_grounds():
    # LỖI 2: lượt 1 trả THẲNG bảng số (tools_ran==0) → ép grounding → lượt 2 gọi tool → lượt 3 bảng cuối.
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text=_RANK_TABLE_GUESS), DoneEvent(usage={})],                      # bảng bịa, chưa gọi tool
            [ToolCallsEvent(calls=[tool_call])],                                            # bị ép → gọi tool
            [TokenEvent(text=_RANK_TABLE_FINAL), DoneEvent(usage={"in": 5, "out": 9})],     # bảng cuối
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Dữ liệu thật." in answer          # khách nhận câu CUỐI
    assert "Ước lượng." not in answer          # bảng bịa lượt 1 bị bỏ, không stream ra
    assert any(e[0] == "tool_start" for e in emitted)  # đã bị ép gọi tool (>=1 tool_start)
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    # _GROUND_NUDGE đã được chèn cho lượt 2.
    assert any(isinstance(m.get("content"), str) and "CHƯA gọi tool" in m["content"] for m in adapter.calls[1])


async def test_headline_numbers_no_table_not_retried():
    # Headline vài số, KHÔNG bảng, tools_ran==0 → phát luôn (table-only check, không ép nhầm Q03-style).
    adapter = ScriptedAdapter(
        [[TokenEvent(text="VNINDEX 1.804,24 tăng 22,12 (+1,24%)"), DoneEvent(usage={"in": 3, "out": 8})]]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "1.804,24" in answer
    assert emitted[-1][0] == "done"
    assert len(adapter.calls) == 1  # không retry: chỉ 1 lượt LLM
    assert all(e[0] not in ("error", "tool_start") for e in emitted)  # không error, không ép gọi tool


async def test_answer_with_tool_and_numbers_not_retried():
    # Đã gọi tool (tools_ran>0) rồi trả bảng số → đã grounded → KHÔNG ép grounding lại.
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text=_RANK_TABLE_FINAL), DoneEvent(usage={"in": 5, "out": 9})],
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Dữ liệu thật." in answer
    assert emitted[-1][0] == "done"
    assert len(adapter.calls) == 2  # tool + final, KHÔNG có lượt grounding phụ
    assert all(e[0] != "error" for e in emitted)


# ── Round 4: table-only grounding + force preamble → clean error ─────────────

async def test_conceptual_answer_with_numbers_no_table_not_grounded():
    # Q04: tư vấn khái niệm CÓ nhiều số minh hoạ (>=6 số thập phân) nhưng KHÔNG bảng, tools_ran==0.
    # Trước Round 4: heuristic ≥6 số bắt nhầm → ép grounding (regression). Nay table-only → phát LUÔN.
    advice = (
        "Với 10 triệu, bạn có thể phân bổ 3,5 triệu cổ phiếu, 2,5 triệu trái phiếu, "
        "1,5 triệu vàng, 1,2 triệu tiền gửi, 0,8 triệu quỹ mở và 0,5 triệu dự phòng."
    )
    adapter = ScriptedAdapter([[TokenEvent(text=advice), DoneEvent(usage={"in": 3, "out": 20})]])
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "quỹ mở" in answer
    assert emitted[-1][0] == "done"
    assert len(adapter.calls) == 1  # KHÔNG grounding-retry: đúng 1 lượt LLM
    assert all(e[0] not in ("error", "tool_start") for e in emitted)  # không error, không ép gọi tool


async def test_data_table_without_tool_still_grounded():
    # Q10: answer CÓ bảng markdown số + tools_ran==0 → VẪN grounding-retry (giữ fix Round 3).
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text=_RANK_TABLE_GUESS), DoneEvent(usage={})],                   # bảng bịa, chưa gọi tool
            [ToolCallsEvent(calls=[tool_call])],                                         # bị ép → gọi tool
            [TokenEvent(text=_RANK_TABLE_FINAL), DoneEvent(usage={"in": 5, "out": 9})],  # bảng cuối
        ]
    )
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Dữ liệu thật." in answer               # khách nhận câu CUỐI (đã grounded)
    assert "Ước lượng." not in answer               # bảng bịa lượt 1 bị bỏ
    assert any(e[0] == "tool_start" for e in emitted)  # đã bị ép gọi tool
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)


async def test_force_turn_preamble_emits_error_not_narration():
    # Q04/Q21: lượt force (tools=[]) model nhả preamble cụt "Tôi sẽ thử lại..." → khách nhận ERROR
    # sạch (_MAX_ITERS_ERROR), KHÔNG nhận nửa câu narration.
    tool_call = ToolCall(id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}})
    adapter = ToolsAwareAdapter(tool_call, "Tôi sẽ thử lại với cách khác:")
    emitted = await _collect(adapter)
    assert emitted[-1][0] == "error"
    assert "có lỗi khi tra cứu dữ liệu" in emitted[-1][1]["message"].lower()
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Tôi sẽ thử lại" not in answer  # narration cụt KHÔNG được stream ra khách
    assert adapter.tools_seen[-1] == []    # vòng cuối cấm tool


async def test_force_turn_real_answer_still_emitted():
    # Lượt force trả câu THẬT (không preamble) → khách NHẬN câu đó, không bị nuốt nhầm.
    tool_call = ToolCall(id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}})
    adapter = ToolsAwareAdapter(tool_call, "Đây là kết luận best-effort dựa trên dữ liệu đã có.")
    emitted = await _collect(adapter)
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Đây là kết luận best-effort" in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)


# ── Round 5: numeric-grounding guard cho GIÁ (diệt bịa giá cổ phiếu Q02) ──────


def test_parse_number_vn():
    # VN: dot=thousands, comma=decimal. Diệt bịa giá cần parse ĐÚNG con số.
    from app.agent.loop import _parse_number
    assert _parse_number("145.500") == 145500.0   # dot thousands
    assert _parse_number("68.000") == 68000.0
    assert _parse_number("13,08") == 13.08         # comma decimal
    assert _parse_number("1.804,24") == 1804.24    # dot thousands + comma decimal


def test_ungrounded_price_detects_fabrication():
    # Tool trả close=68 → grounded nạp 68 & 68000; answer bịa "145.500 đồng" KHÔNG khớp → ungrounded.
    from app.agent.loop import _register_grounded, _ungrounded_price
    grounded: set[int] = set()
    _register_grounded('[{"ticker": "FPT", "close": 68}]', grounded)
    assert 68 in grounded and 68000 in grounded
    assert _ungrounded_price("FPT hiện 145.500 đồng.", grounded) is True


def test_grounded_price_ok():
    # Tool trả close=68 (→ 68000 qua nạp *1000); answer "68.000 đồng" khớp → KHÔNG nghi bịa.
    from app.agent.loop import _register_grounded, _ungrounded_price
    grounded: set[int] = set()
    _register_grounded('[{"ticker": "FPT", "close": 68}]', grounded)
    assert _ungrounded_price("FPT đóng cửa 68.000 đồng.", grounded) is False


def test_non_price_numbers_not_guarded():
    # CHỈ guard claim GIÁ (đơn vị "đồng"). Số phái sinh %/điểm/median KHÔNG bị guard (dù grounded rỗng).
    from app.agent.loop import _ungrounded_price
    grounded: set[int] = set()
    assert _ungrounded_price("Cả năm +45,98%, trung vị ngành 12,3 điểm.", grounded) is False


class _PriceGateway:
    """Gateway trả kết quả tool CÓ KIỂM SOÁT (close=68) → grounded_nums nạp 68 & 68000 để đối chiếu."""

    async def find(self, ctx: Any, collection: str, filter: Any = None, projection: Any = None,
                   sort: Any = None, limit: Any = None) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=True, data=[{"ticker": "FPT", "close": 68}], meta={"collection": collection, "ms": 0})

    async def aggregate(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})

    async def stats(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})


async def test_price_guard_retries_then_corrects():
    # M3 GỌI tool (close=68) nhưng lượt kế PHỚT LỜ, tự chế "145.500 đồng" → guard thấy giá không grounded
    # → nudge → lượt sau model sửa "68.000 đồng" (grounded) → phát câu ĐÚNG.
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"close": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text="FPT hiện 145.500 đồng."), DoneEvent(usage={})],                    # bịa giá
            [TokenEvent(text="FPT đóng cửa 68.000 đồng."), DoneEvent(usage={"in": 5, "out": 6})],  # đúng
        ]
    )
    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter, gateway=_PriceGateway(), ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "FPT giá bao nhiêu?"}], emit=emit,
    )
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "68.000 đồng" in answer     # khách nhận giá ĐÚNG
    assert "145.500" not in answer      # giá bịa bị chặn, KHÔNG stream ra khách
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    # _NUM_GUARD_NUDGE đã được chèn cho lượt sửa (lượt 3 = adapter.calls[2]).
    from app.agent.loop import _NUM_GUARD_NUDGE
    assert any(isinstance(m.get("content"), str) and _NUM_GUARD_NUDGE in m["content"] for m in adapter.calls[2])


def test_commodity_price_guard():
    """Bịa giá hàng hoá (cu T10: "593 USD/tấn" thật 3342 CNY/tấn) — mở guard sang đơn vị hàng hoá."""
    from app.agent.loop import _looks_like_data_answer, _ungrounded_price, _register_grounded
    assert _looks_like_data_answer("Giá thép HRC hiện khoảng 593 USD/tấn.")   # commodity → cần grounding
    assert _ungrounded_price("Giá thép HRC 593 USD/tấn.", set())              # chưa query → nghi bịa
    g = set(); _register_grounded('{"name":"Thép HRC","value":3342,"unit":"CNY/tấn"}', g)
    assert not _ungrounded_price("Giá thép HRC 3342 CNY/tấn.", g)             # đã query đúng → không nghi
    # số phái sinh %/khái niệm không đơn vị giá → KHÔNG đụng
    assert not _looks_like_data_answer("Biên lợi nhuận giảm 15% do giá đầu ra.")


def test_market_figure_guard():
    """Số thị trường thập phân + tỷ/lần (khối ngoại/P/E inline) → cần grounding; số làm tròn khái niệm thì không."""
    from app.agent.loop import _looks_like_data_answer
    assert _looks_like_data_answer("HSG khối ngoại mua ròng 17,82 tỷ tuần qua.")  # bịa foreign-flow inline
    assert _looks_like_data_answer("P/E HPG hiện 8.88 lần.")                       # P/E inline
    assert not _looks_like_data_answer("P/E khoảng 15 lần là hợp lý cho ngành này.")  # làm tròn/khái niệm → bỏ qua
    assert not _looks_like_data_answer("Nên để dành vài tỷ đồng tiền mặt.")           # 'vài tỷ' không thập phân


# ── Round 6: tổng quát hoá numeric-grounding guard (giá + tỷ + lần, dung sai tương đối 2%) ────────


def test_ungrounded_data_detects_fabricated_price():
    # DƯƠNG TÍNH: bịa giá "145.500 đồng" trong khi tool chỉ có 68/68000 → nghi bịa.
    from app.agent.loop import _ungrounded_data
    assert _ungrounded_data("Giá FPT 145.500 đồng", {68, 68000}) is True


def test_ungrounded_data_detects_fabricated_foreign_flow():
    # DƯƠNG TÍNH: khối ngoại thật 4.95 tỷ, model chế "17,82 tỷ" → không truy được → nghi bịa.
    from app.agent.loop import _register_grounded, _ungrounded_data
    g: set[int] = set()
    _register_grounded('{"ticker":"HSG","net":4.95}', g)
    assert _ungrounded_data("HSG mua ròng 17,82 tỷ", g) is True


def test_ungrounded_data_rounded_billion_not_flagged():
    # ÂM TÍNH (QUAN TRỌNG): tool trả 702.55, model làm tròn "700 tỷ" → dung sai 2% → KHÔNG báo nhầm.
    from app.agent.loop import _register_grounded, _ungrounded_data
    g: set[int] = set()
    _register_grounded('{"value":702.55}', g)
    assert _ungrounded_data("bán ròng 700 tỷ", g) is False


def test_ungrounded_data_rounded_pe_not_flagged():
    # ÂM TÍNH: P/E 8.88 làm tròn "8,9 lần" → khớp round → KHÔNG báo nhầm.
    from app.agent.loop import _register_grounded, _ungrounded_data
    g: set[int] = set()
    _register_grounded('{"pe":8.88}', g)
    assert _ungrounded_data("P/E 8,9 lần", g) is False


def test_ungrounded_data_median_from_db_stats_not_flagged():
    # ÂM TÍNH: median 13.16 từ db_stats → "median 13,16 lần" khớp → KHÔNG báo nhầm.
    from app.agent.loop import _register_grounded, _ungrounded_data
    g: set[int] = set()
    _register_grounded('{"median":13.16}', g)
    assert _ungrounded_data("median 13,16 lần", g) is False


def test_ungrounded_data_percent_is_not_checked():
    # ÂM TÍNH: '%' là số phái sinh → KHÔNG thuộc value-check (dù grounded rỗng) → không báo nhầm.
    from app.agent.loop import _ungrounded_data
    assert _ungrounded_data("sụt 41% từ đỉnh", set()) is False


def test_ungrounded_data_price_grounded_via_thousand():
    # ÂM TÍNH: "68.000 đồng" grounded qua *1000 từ close=68.
    from app.agent.loop import _ungrounded_data
    assert _ungrounded_data("68.000 đồng", {68}) is False


def test_ungrounded_price_alias_kept():
    # Alias tương thích: _ungrounded_price vẫn tồn tại và trỏ tới _ungrounded_data.
    from app.agent.loop import _ungrounded_data, _ungrounded_price
    assert _ungrounded_price is _ungrounded_data


def test_claims_no_data_detector():
    from app.agent.loop import _claims_no_data
    assert _claims_no_data("He chua co du lieu cho ma HPG.".replace("He","Hệ").replace("chua co du lieu","chưa có dữ liệu"))
    assert not _claims_no_data("HPG P/B hien 1,34 lan.")


async def test_no_data_verify_retries_when_no_tool_called():
    """Model ket luan 'khong co du lieu' ma tools_ran==0 -> ep kiem tra ky (retry) -> luot sau tra loi khac."""
    no_data = "Hệ chưa có dữ liệu định giá cho HPG."
    good = "Định giá HPG đang ở vùng thấp so với lịch sử."
    adapter = ScriptedAdapter([
        [TokenEvent(text=no_data), DoneEvent(usage={})],
        [TokenEvent(text=good), DoneEvent(usage={})],
    ])
    emitted = await _collect(adapter)
    ans = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert ans == good
    assert "chưa có dữ liệu" not in ans
    assert len(adapter.calls) == 2


# ── Guard chống re-briefing đa lượt ──────────────────────────────────────────────────────────────
def test_salient_numbers_extracts_and_skips_trivial():
    nums = _salient_numbers("Giá 67,7 và 1.234,5; đếm 1 mã, 0 mã; vốn hoá 116060 tỷ")
    assert 67.7 in nums and 1234.5 in nums and 116060 in nums
    assert 1 not in nums and 0 not in nums  # 0/1 (đếm mã) bị loại


def test_rebrief_overlap_high_when_numbers_repeat():
    prev = "A 12,3 B 45,6 C 78,9 D 101,2 E 131,4 F 151,6 G 171,8 H 192,0 I 212,2 J 232,4 K 252,6"
    draft = "Nhắc lại 12,3 45,6 78,9 101,2 131,4 151,6 171,8 192,0 212,2 232,4 và thêm 999,9"
    overlap, n = _rebrief_overlap(draft, prev)
    assert n >= 10 and overlap >= 0.75


def test_should_dedup_gate():
    prev = " ".join(f"{i + 10},{i}" for i in range(20))  # 20 số nổi bật
    draft = prev + " " + "x" * 1000  # dài + trùng cao
    assert _should_dedup(draft, prev) is True
    assert _should_dedup(draft, None) is False  # không có câu trước
    assert _should_dedup("ngắn 12,3 45,6", prev) is False  # quá ngắn
    fresh = "Nội dung mới " + " ".join(f"{i + 900},{i}" for i in range(20)) + " y" * 1000
    assert _should_dedup(fresh, prev) is False  # số khác hẳn → overlap thấp


def test_last_assistant_text_skips_tool_call_turns():
    msgs = [
        {"role": "user", "content": "hỏi 1"},
        {"role": "assistant", "content": "trả lời 1"},
        {"role": "assistant", "content": None, "tool_calls": [{}]},
        {"role": "user", "content": "hỏi 2"},
    ]
    assert _last_assistant_text(msgs) == "trả lời 1"


async def _run_with_history(adapter: Any, prev: str, question: str) -> str:
    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter,
        gateway=FixtureGateway(Policy.load()),
        ctx=CTX,
        system=SYSTEM,
        messages=[
            {"role": "user", "content": "phân tích FPT"},
            {"role": "assistant", "content": prev},
            {"role": "user", "content": question},
        ],
        emit=emit,
    )
    return "".join(p["text"] for t, p in emitted if t == "token")


async def test_guard_rewrites_rebriefing_followup():
    prev = "Phân tích FPT. " + " ".join(f"chỉ số {10 + i},{i}" for i in range(15))
    draft = "Nhìn chung không đổi. " + " ".join(f"vẫn {10 + i},{i}" for i in range(15)) + " chi tiết" * 200
    deduped = "So với phần trên, điểm mới đáng chú ý: thanh khoản cải thiện nhẹ."
    adapter = ScriptedAdapter(
        [
            [TokenEvent(text=draft), DoneEvent(usage={"in": 5, "out": 5})],  # lượt chính: re-brief
            [TokenEvent(text=deduped), DoneEvent(usage={"in": 3, "out": 3})],  # lượt viết lại
        ]
    )
    out = await _run_with_history(adapter, prev, "FPT dạo này thế nào?")
    assert out == deduped  # đã dùng bản viết lại, không phải bản re-brief
    assert len(adapter.calls) == 2  # main + rewrite
    assert prev in adapter.calls[1][0]["content"]  # call 2 là dedup prompt (nhúng câu trước)


async def test_guard_skips_when_answer_is_fresh():
    prev = "Phân tích FPT. " + " ".join(f"chỉ số {10 + i},{i}" for i in range(15))
    fresh = "Câu trả lời mới với số khác. " + " ".join(f"mục {900 + i},{i}" for i in range(15)) + " nội dung" * 200
    adapter = ScriptedAdapter([[TokenEvent(text=fresh), DoneEvent(usage={"in": 5, "out": 5})]])
    out = await _run_with_history(adapter, prev, "còn điểm nào đáng chú ý nữa không?")
    assert out == fresh  # giữ nguyên
    assert len(adapter.calls) == 1  # KHÔNG gọi rewrite


# ── Ngân sách kết quả tool: chia đều TRƯỚC khi chạy, bỏ cắt mù ────────────────────────────────────


def test_cap_text_cat_tai_ranh_gioi_dong():
    """read_kb trả markdown, không đi qua shrink. Cắt giữa chữ là mất nghĩa."""
    from app.agent.loop import _cap_text

    content = "\n".join(f"dòng số {i} có nội dung dài dài" for i in range(200))
    out = _cap_text(content, 500)
    assert len(out) <= 500 + 120, "phần ghi chú nối thêm phải ngắn"
    body = out.split("…[đã cắt")[0]
    assert body.endswith("dài") or body.endswith("\n"), "phải kết thúc ở ranh giới dòng"
    assert "đã cắt" in out


def test_cap_text_khong_dong_vao_noi_dung_vua_tran():
    from app.agent.loop import _cap_text

    content = "ngắn thôi"
    assert _cap_text(content, 500) == content


def test_ngan_sach_chia_deu_cho_cac_loi_goi_song_song():
    """Trước đây ngân sách tiêu theo thứ tự: tool cuối hàng có thể nhận về RỖNG."""
    from app.agent.loop import MAX_TOOL_RESULT_CHARS, MAX_TOTAL_TOOL_CHARS, _per_call_budget

    assert _per_call_budget(1) == MAX_TOOL_RESULT_CHARS
    assert _per_call_budget(4) == MAX_TOTAL_TOOL_CHARS // 4
    assert _per_call_budget(0) >= 1, "không được chia cho 0"
    assert _per_call_budget(100) >= 1, "nhiều lời gọi vẫn phải còn chỗ, không được ra 0"
    # Tổng không bao giờ vượt ngân sách chung.
    for n in (1, 2, 3, 5, 10):
        assert _per_call_budget(n) * n <= max(MAX_TOTAL_TOOL_CHARS, MAX_TOOL_RESULT_CHARS)


class _BulkGateway:
    """Mỗi lời gọi trả một kết quả LỚN — để soi cách chia ngân sách giữa các tool song song."""

    async def find(self, ctx: Any, collection: str, filter: Any = None, projection: Any = None,
                   sort: Any = None, limit: Any = None) -> Any:
        from app.agent.gateway.types import GatewayResult
        data = [{"ticker": f"M{i:03d}", "note": "x" * 400} for i in range(60)]
        return GatewayResult(ok=True, data=data, meta={"collection": collection, "ms": 0})

    async def aggregate(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})

    async def stats(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})


async def test_moi_tool_song_song_deu_nhan_du_lieu_that():
    """GHIM NGUYÊN NHÂN GỐC: ngân sách tiêu theo THỨ TỰ khiến tool THÀNH CÔNG ở cuối hàng
    nhận về đúng chuỗi '[đã cắt do vượt ngân sách]' — không một byte dữ liệu nào."""
    import json as _json

    from app.agent.loop import _run_tools

    calls = [
        ToolCall(
            id=f"c{i}", name="db_find",
            arguments={"collection": "stock_snapshot", "filter": {"ticker": f"T{i}"}, "projection": {"price": 1}},
        )
        for i in range(4)
    ]

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        return None

    messages, all_failed = await _run_tools(_BulkGateway(), CTX, calls, emit, set())

    assert len(messages) == 4
    assert all_failed is False  # mọi lời gọi đều thành công → không phải bão fail
    for msg in messages:
        body = msg["content"].split("\n\n[GHI CHÚ NỘI BỘ")[0].split("…[đã cắt")[0]
        docs = _json.loads(body)  # hành vi cũ: tool cuối hàng không có JSON để parse
        assert docs and docs[0]["ticker"] == "M000", "tool nào cũng phải nhận DỮ LIỆU THẬT"


# ── Cầu dao ÉP TRẢ LỜI: bão tool-fail (MAX_FAILED_TOOL_ROUNDS) + trần token (MAX_TURN_TOKENS) ──────


def _count_nudge(messages: list[dict[str, Any]], nudge: str) -> int:
    """Đếm số message user chứa đúng chuỗi nudge — để khẳng định nudge ép chỉ chèn 1 lần."""
    return sum(1 for m in messages if isinstance(m.get("content"), str) and nudge in m["content"])


class _AllFailGateway:
    """Mọi lời gọi đều fail (ok=False) — tái hiện bão db_aggregate hỏng liên tiếp trên production."""

    async def find(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="boom", meta={"ms": 0})

    async def aggregate(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="boom", meta={"ms": 0})

    async def stats(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="boom", meta={"ms": 0})


class _UsageToolAdapter:
    """tools != [] → gọi tool (thành công) + báo usage LỚN; tools == [] → trả text. Ghi lại `tools` mỗi vòng."""

    def __init__(self, tool_call: ToolCall, final_text: str, usage: dict[str, int]) -> None:
        self._tool_call = tool_call
        self._final_text = final_text
        self._usage = usage
        self.calls: list[list[dict[str, Any]]] = []
        self.tools_seen: list[list[dict[str, Any]]] = []

    async def stream_chat(
        self, system: list[SystemBlock], messages: list[dict[str, Any]], tools: list[dict[str, Any]], max_tokens: int
    ) -> AsyncIterator[AgentEvent]:
        self.calls.append(messages)
        self.tools_seen.append(tools)
        if tools:
            yield ToolCallsEvent(calls=[self._tool_call], usage=self._usage)
        else:
            yield TokenEvent(text=self._final_text)
            yield DoneEvent(usage={})


class _FailThenOkGateway:
    """find: lời gọi ĐẦU fail, các lời gọi sau ok — để test cầu dao KHÔNG kích hoạt oan (fail 1 vòng rồi ổn)."""

    def __init__(self) -> None:
        self.n = 0

    async def find(self, ctx: Any, collection: str, filter: Any = None, projection: Any = None,
                   sort: Any = None, limit: Any = None) -> Any:
        from app.agent.gateway.types import GatewayResult
        self.n += 1
        if self.n == 1:
            return GatewayResult(ok=False, error="boom", meta={"collection": collection, "ms": 0})
        return GatewayResult(ok=True, data=[{"ticker": "FPT", "close": 68}], meta={"collection": collection, "ms": 0})

    async def aggregate(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})

    async def stats(self, *a: Any, **k: Any) -> Any:
        from app.agent.gateway.types import GatewayResult
        return GatewayResult(ok=False, error="n/a", meta={})


async def test_tool_fail_storm_stops_early_and_answers_honestly():
    # Bão tool-fail: adapter gọi tool khi còn được phép, gateway luôn fail → sau MAX_FAILED_TOOL_ROUNDS
    # vòng fail sạch, cầu dao ép trả lời (tools=[]) → khách nhận câu THẬT, KHÔNG lặp tới 10 vòng.
    from app.agent.loop import _FORCE_ANSWER_NUDGE, _GIVE_UP_NUDGE
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"close": 1}},
    )
    adapter = _UsageToolAdapter(tool_call, "Chưa tra được dữ liệu, mình trả lời phần chắc chắn.", usage={})

    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter, gateway=_AllFailGateway(), ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "phân tích ngành thép"}], emit=emit,
    )
    # (a) khách nhận CÂU TRẢ LỜI, không phải error.
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Chưa tra được dữ liệu" in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    # (b) dừng SỚM: 2 vòng fail + 1 vòng ép = 3 ≤ 4 (KHÔNG chạm MAX_ITERS=10).
    assert len(adapter.calls) <= 4
    assert adapter.tools_seen[-1] == []  # vòng cuối là vòng ép (cấm tool)
    # (c) _GIVE_UP_NUDGE chèn ĐÚNG 1 lần; đường bão-fail KHÔNG dùng _FORCE_ANSWER_NUDGE.
    assert _count_nudge(adapter.calls[-1], _GIVE_UP_NUDGE) == 1
    assert _count_nudge(adapter.calls[-1], _FORCE_ANSWER_NUDGE) == 0


async def test_token_ceiling_forces_answer():
    # Trần token: mỗi vòng gọi tool THÀNH CÔNG nhưng báo usage lớn (350k in + 500 out) → sau 2 vòng
    # vượt 600k → vòng 3 phải là vòng ép (tools == []).
    from app.agent.loop import _FORCE_ANSWER_NUDGE, _GIVE_UP_NUDGE
    tool_call = ToolCall(
        id="c1", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"close": 1}},
    )
    adapter = _UsageToolAdapter(tool_call, "Kết luận dựa trên dữ liệu đã tra cứu.", usage={"in": 350_000, "out": 500})

    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter, gateway=_PriceGateway(), ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "phân tích FPT"}], emit=emit,
    )
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Kết luận dựa trên dữ liệu" in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    # 2 vòng tool (usage lớn) rồi vòng 3 ép; tools param của vòng 3 phải rỗng.
    assert len(adapter.calls) == 3
    assert adapter.tools_seen[0] and adapter.tools_seen[1]  # 2 vòng đầu CÓ tool
    assert adapter.tools_seen[2] == []                       # vòng 3 bị ép (cấm tool)
    # Trần-token dùng _FORCE_ANSWER_NUDGE (đủ dữ liệu, không phải bão fail) — KHÔNG dùng _GIVE_UP_NUDGE.
    assert _count_nudge(adapter.calls[-1], _FORCE_ANSWER_NUDGE) == 1
    assert _count_nudge(adapter.calls[-1], _GIVE_UP_NUDGE) == 0


async def test_transient_tool_fail_does_not_trip_breaker():
    # KHÔNG kích hoạt oan: fail 1 vòng rồi THÀNH CÔNG vòng sau, usage nhỏ → chạy đường bình thường,
    # _GIVE_UP_NUDGE KHÔNG xuất hiện.
    from app.agent.loop import _GIVE_UP_NUDGE
    call_a = ToolCall(id="a", name="db_find",
                      arguments={"collection": "stock_snapshot", "filter": {"ticker": "AAA"}, "projection": {"close": 1}})
    call_b = ToolCall(id="b", name="db_find",
                      arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"close": 1}})
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[call_a])],                                          # vòng 1: fail (n=1)
            [ToolCallsEvent(calls=[call_b])],                                          # vòng 2: ok (n=2) → reset
            [TokenEvent(text="Định giá HPG đang ở vùng hợp lý."), DoneEvent(usage={"in": 5, "out": 5})],
        ]
    )

    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter, gateway=_FailThenOkGateway(), ctx=CTX, system=SYSTEM,
        messages=[{"role": "user", "content": "định giá HPG"}], emit=emit,
    )
    answer = "".join(e[1]["text"] for e in emitted if e[0] == "token")
    assert "Định giá HPG đang ở vùng hợp lý." in answer
    assert emitted[-1][0] == "done"
    assert all(e[0] != "error" for e in emitted)
    assert len(adapter.calls) == 3  # tool-fail + tool-ok + final, KHÔNG ép sớm
    assert _count_nudge(adapter.calls[-1], _GIVE_UP_NUDGE) == 0  # cầu dao không kích hoạt oan


# ── _needs_retry: cắt 2 dạng câu hỏng đã lọt tới khách (độc thoại kế hoạch + câu cụt hai chấm) ─────


def test_needs_retry_plan_monologue_leaked_as_answer():
    # Ca 1 (eval hôm nay, Q2 nguyên văn): model nghĩ thành lời, 0 tool → khách đọc cả tên nội bộ.
    from app.agent.loop import _needs_retry
    q2 = (
        "User đang hỏi về rủi ro của rổ Mạo Hiểm (AGGRESSIVE) — tab đang mở. Cần đọc AGGRESSIVE + "
        "market_phase + phase_trading (sổ lệnh rổ) để đánh giá rủi ro thật."
    )
    assert _needs_retry(q2) is True


def test_needs_retry_plan_monologue_short_variant():
    from app.agent.loop import _needs_retry
    assert _needs_retry("Khách đang hỏi về HPG. Cần lấy dữ liệu.") is True


def test_needs_retry_colon_cut_headline():
    # Ca 2 (eval 2026-07-20 lượt 9, nguyên văn TOÀN BỘ câu trả lời): tiêu đề hứa danh sách rồi hết.
    from app.agent.loop import _needs_retry
    cut = "Top cổ phiếu có điểm dòng tiền ngày cao nhất (đã lọc thanh khoản tối thiểu):"
    assert _needs_retry(cut) is True


def test_needs_retry_short_valid_answer_not_flagged():
    # Câu THẬT ngắn hợp lệ (không mở đầu 'User hỏi', không kết thúc ':') → KHÔNG retry.
    from app.agent.loop import _needs_retry
    assert _needs_retry("VNINDEX hôm nay tăng nhẹ, thanh khoản cải thiện.") is False


def test_needs_retry_long_answer_with_midcolon_not_flagged():
    # Câu THẬT dài có dấu hai chấm GIỮA CHỪNG (>300 ký tự, kết thúc bằng dấu chấm) → KHÔNG retry.
    from app.agent.loop import _needs_retry
    long_ans = (
        "Ba điểm đáng chú ý: thứ nhất, thanh khoản toàn thị trường cải thiện rõ rệt so với tuần trước "
        "khi dòng tiền quay lại nhóm ngân hàng và chứng khoán. Thứ hai, khối ngoại mua ròng nhẹ ở một số "
        "mã vốn hoá lớn, cho thấy tâm lý nhà đầu tư ổn định hơn. Thứ ba, nhóm bất động sản vẫn phân hoá "
        "mạnh, nhà đầu tư nên chọn lọc kỹ thay vì mua dàn trải."
    )
    assert len(long_ans) > 300
    assert _needs_retry(long_ans) is False


def test_needs_retry_user_mention_midsentence_not_flagged():
    # Câu THẬT nhắc tới người dùng ở GIỮA bài nhưng mở đầu bằng nội dung thật → KHÔNG retry.
    from app.agent.loop import _needs_retry
    ans = (
        "Chiến lược tích luỹ cổ phiếu cơ bản tốt sẽ phù hợp khi người dùng đang hỏi về mục tiêu dài hạn "
        "và chấp nhận biến động ngắn hạn."
    )
    assert _needs_retry(ans) is False
