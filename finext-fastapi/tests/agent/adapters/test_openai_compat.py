import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.openai_compat import OpenAICompatAdapter
from app.agent.events import DoneEvent, ToolCallsEvent, TokenEvent

TEXT_STREAM = (
    'data: {"choices":[{"delta":{"role":"assistant","content":""},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"content":"Giá FPT "},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"content":"là 118,5"},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}\n\n'
    'data: {"choices":[],"usage":{"prompt_tokens":1200,"completion_tokens":42}}\n\n'
    "data: [DONE]\n\n"
)

# tool-call arguments về theo MẢNH — đây là bẫy chính (doc 02 §6)
TOOL_STREAM = (
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
    '"function":{"name":"db_find","arguments":""}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"collec"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"tion\\":\\"stock_"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"snapshot\\"}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)

REASONING_TOOL_STREAM = (
    'data: {"choices":[{"delta":{"reasoning_content":"Cần tra "},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"reasoning_content":"giá FPT."},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
    '"function":{"name":"db_find","arguments":"{}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)

LENGTH_STREAM = (
    'data: {"choices":[{"delta":{"content":"Phân tích rất dài"},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"length","index":0}]}\n\n'
    "data: [DONE]\n\n"
)


def _adapter_with(body: str, status: int = 200) -> OpenAICompatAdapter:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=body, headers={"content-type": "text/event-stream"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="sk-test", model="test-model", client=client
    )


async def _collect(adapter: OpenAICompatAdapter) -> list:
    return [
        e
        async for e in adapter.stream_chat(
            system=[SystemBlock(text="pack", cache_hint=True)],
            messages=[{"role": "user", "content": "FPT?"}],
            tools=[],
            max_tokens=100,
        )
    ]


async def test_text_stream_yields_tokens_then_done_with_usage():
    events = await _collect(_adapter_with(TEXT_STREAM))
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert "".join(t.text for t in tokens) == "Giá FPT là 118,5"
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.usage == {"in": 1200, "out": 42}


async def test_tool_call_arguments_accumulated_across_chunks():
    events = await _collect(_adapter_with(TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.id == "call_1"
    assert call.name == "db_find"
    assert call.arguments == {"collection": "stock_snapshot"}  # ghép từ 3 mảnh


async def test_malformed_tool_arguments_do_not_crash():
    broken = (
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function",'
        '"function":{"name":"db_find","arguments":"{not json"}}]},"index":0}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
        "data: [DONE]\n\n"
    )
    events = await _collect(_adapter_with(broken))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    assert tool_events[0].calls[0].arguments == {}  # parse hỏng → dict rỗng, loop sẽ trả error cho model


class _StreamThenError(httpx.AsyncByteStream):
    """Phát vài chunk rồi raise — giả lập rớt kết nối GIỮA lượt tool-call."""

    def __init__(self, chunks: list[bytes], exc: BaseException) -> None:
        self._chunks = chunks
        self._exc = exc

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self._chunks:
            yield chunk
        raise self._exc


# 2 tool call song song — index 0 và 1 mở cùng chunk rồi arguments về xen kẽ
PARALLEL_TOOL_STREAM = (
    'data: {"choices":[{"delta":{"tool_calls":['
    '{"index":0,"id":"call_a","type":"function","function":{"name":"db_find","arguments":""}},'
    '{"index":1,"id":"call_b","type":"function","function":{"name":"db_agg","arguments":""}}'
    ']},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"a\\":1}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{\\"b\\":2}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)

# tool không tham số — arguments là "" xuyên suốt (json.loads("") phải bị guard)
NOARG_TOOL_STREAM = (
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
    '"function":{"name":"get_market_status","arguments":""}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)

# provider gửi "choices": null (kèm usage) — không được crash TypeError
NULL_CHOICES_STREAM = (
    'data: {"choices":[{"delta":{"content":"Xin chào"},"index":0}]}\n\n'
    'data: {"choices":null,"usage":{"prompt_tokens":5,"completion_tokens":3}}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}\n\n'
    "data: [DONE]\n\n"
)


async def test_tool_buffer_resets_between_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_sleep(_seconds: float) -> None:  # bỏ backoff thật để test nhanh
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)
    partial = (
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
        '"function":{"name":"db_find","arguments":""}}]},"index":0}]}\n\n'
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"collec"}}]},"index":0}]}\n\n'
    ).encode()
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        headers = {"content-type": "text/event-stream"}
        if calls["n"] == 1:  # attempt đầu: nhả 1 mảnh dở rồi rớt GIỮA lượt tool-call
            return httpx.Response(
                200, stream=_StreamThenError([partial], httpx.ReadError("drop")), headers=headers
            )
        return httpx.Response(200, text=TOOL_STREAM, headers=headers)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="sk-test", model="test-model", client=client
    )
    events = await _collect(adapter)
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert calls["n"] == 2  # đã retry sau khi rớt (chưa nhả token)
    assert len(tool_events) == 1
    # buffer PHẢI reset mỗi attempt: không dính mảnh '{"collec' của attempt đầu
    assert tool_events[0].calls[0].arguments == {"collection": "stock_snapshot"}


async def test_parallel_tool_calls_accumulate_per_index() -> None:
    events = await _collect(_adapter_with(PARALLEL_TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    calls = tool_events[0].calls
    assert len(calls) == 2
    assert (calls[0].id, calls[0].name, calls[0].arguments) == ("call_a", "db_find", {"a": 1})
    assert (calls[1].id, calls[1].name, calls[1].arguments) == ("call_b", "db_agg", {"b": 2})


async def test_tool_call_without_arguments_yields_empty_dict() -> None:
    events = await _collect(_adapter_with(NOARG_TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.name == "get_market_status"
    assert call.arguments == {}  # rỗng suốt → {} , không json.loads("")


async def test_null_choices_chunk_does_not_crash() -> None:
    events = await _collect(_adapter_with(NULL_CHOICES_STREAM))
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert "".join(t.text for t in tokens) == "Xin chào"
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.usage == {"in": 5, "out": 3}


def test_payload_includes_temperature_when_set():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="deepseek-v4-flash", temperature=0.2)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["temperature"] == 0.2
    assert payload["model"] == "deepseek-v4-flash"


def test_payload_omits_temperature_when_none():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="m", temperature=None)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert "temperature" not in payload


def test_payload_thinking_enabled_includes_effort():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="k", model="deepseek-v4-flash",
        thinking="enabled", reasoning_effort="high",
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["thinking"] == {"type": "enabled"}
    assert payload["reasoning_effort"] == "high"


def test_payload_thinking_disabled_omits_effort():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="k", model="m",
        thinking="disabled", reasoning_effort="high",
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["thinking"] == {"type": "disabled"}
    assert "reasoning_effort" not in payload


def test_payload_omits_thinking_when_none():
    from app.agent.adapters.base import SystemBlock
    adapter = OpenAICompatAdapter(base_url="https://api.test/v1", api_key="k", model="m", thinking=None)
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert "thinking" not in payload


# --- Regression trên bytes THẬT của DeepSeek (bắt ở mốc lát cắt Task 9) ---
REAL_FIXTURE = Path(__file__).parent / "fixtures" / "deepseek_tool_stream.txt"


@pytest.mark.skipif(not REAL_FIXTURE.exists(), reason="Chưa bắt được bytes thật của DeepSeek")
async def test_parses_real_deepseek_tool_call_stream() -> None:
    events = await _collect(_adapter_with(REAL_FIXTURE.read_text(encoding="utf-8")))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1  # DeepSeek thật gọi đúng 1 tool
    call = tool_events[0].calls[0]
    assert call.name == "db_find"
    # Điểm cần chốt là PARSER: arguments stream về theo mảnh JSON được ghép thành dict hợp lệ (không phải {}).
    # KHÔNG assert giá trị collection cụ thể — đó là hành vi model+pack, không phải của adapter.
    assert isinstance(call.arguments, dict) and call.arguments
    assert "collection" in call.arguments


async def test_reasoning_content_accumulated_on_tool_calls_event():
    events = await _collect(_adapter_with(REASONING_TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    assert tool_events[0].reasoning_content == "Cần tra giá FPT."


async def test_tool_calls_event_reasoning_none_when_absent():
    events = await _collect(_adapter_with(TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert tool_events[0].reasoning_content is None


async def test_finish_reason_length_marks_done_truncated():
    events = await _collect(_adapter_with(LENGTH_STREAM))
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.truncated is True
