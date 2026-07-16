import asyncio

import httpx
import pytest

from app.agent.adapters.anthropic_compat import (
    AnthropicCompatAdapter,
    _build_system,
    _convert_messages,
    _convert_tools,
    parse_sse_lines,
)
from app.agent.adapters.base import SystemBlock
from app.agent.events import DoneEvent, ToolCallsEvent, TokenEvent

# --- Scripted SSE (wire Anthropic: có cả dòng event: và data:) ---

TEXT_STREAM = (
    "event: message_start\n"
    'data: {"type":"message_start","message":{"id":"msg_1","usage":'
    '{"input_tokens":1200,"cache_read_input_tokens":900,"cache_creation_input_tokens":100}}}\n\n'
    "event: content_block_start\n"
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Giá FPT "}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"là 118,5"}}\n\n'
    "event: content_block_stop\n"
    'data: {"type":"content_block_stop","index":0}\n\n'
    "event: message_delta\n"
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}\n\n'
    "event: message_stop\n"
    'data: {"type":"message_stop"}\n\n'
)

# tool_use: input về theo MẢNH partial_json — bẫy chính, phải ghép thành dict
TOOL_STREAM = (
    "event: message_start\n"
    'data: {"type":"message_start","message":{"id":"msg_2","usage":{"input_tokens":1000}}}\n\n'
    "event: content_block_start\n"
    'data: {"type":"content_block_start","index":0,"content_block":'
    '{"type":"tool_use","id":"toolu_1","name":"db_find","input":{}}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"collec"}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"tion\\":\\"stock_"}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"snapshot\\"}"}}\n\n'
    "event: content_block_stop\n"
    'data: {"type":"content_block_stop","index":0}\n\n'
    "event: message_delta\n"
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":20}}\n\n'
    "event: message_stop\n"
    'data: {"type":"message_stop"}\n\n'
)

THINKING_TOOL_STREAM = (
    "event: message_start\n"
    'data: {"type":"message_start","message":{"id":"msg_3","usage":{"input_tokens":50}}}\n\n'
    "event: content_block_start\n"
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Cần tra "}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"giá FPT."}}\n\n'
    "event: content_block_start\n"
    'data: {"type":"content_block_start","index":1,"content_block":'
    '{"type":"tool_use","id":"toolu_9","name":"db_find","input":{}}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{}"}}\n\n'
    "event: message_delta\n"
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":8}}\n\n'
    "event: message_stop\n"
    'data: {"type":"message_stop"}\n\n'
)

MAX_TOKENS_STREAM = (
    "event: message_start\n"
    'data: {"type":"message_start","message":{"id":"msg_4","usage":{"input_tokens":5}}}\n\n'
    "event: content_block_delta\n"
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Phân tích rất dài"}}\n\n'
    "event: message_delta\n"
    'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":64000}}\n\n'
    "event: message_stop\n"
    'data: {"type":"message_stop"}\n\n'
)


def _lines(raw: str) -> list[str]:
    return raw.split("\n")


# --- Unit convert: system ---

def test_build_system_cache_control_on_last_cache_hint_block() -> None:
    blocks = [
        SystemBlock(text="resident", cache_hint=True),
        SystemBlock(text="briefing", cache_hint=True),
        SystemBlock(text="session_note", cache_hint=False),
    ]
    result = _build_system(blocks)
    assert [b["text"] for b in result] == ["resident", "briefing", "session_note"]
    assert "cache_control" not in result[0]  # không phải block cache_hint cuối
    assert result[1]["cache_control"] == {"type": "ephemeral"}  # block cache=T CUỐI CÙNG
    assert "cache_control" not in result[2]  # cache=False → không đánh dấu


def test_build_system_without_cache_hint_has_no_cache_control() -> None:
    result = _build_system([SystemBlock(text="a"), SystemBlock(text="b")])
    assert all("cache_control" not in block for block in result)


# --- Unit convert: messages ---

def test_convert_messages_groups_consecutive_tool_results_into_one_user_turn() -> None:
    messages = [
        {"role": "user", "content": "giá FPT và VNM?"},
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {"id": "c1", "type": "function", "function": {"name": "db_find", "arguments": '{"symbol":"FPT"}'}},
                {"id": "c2", "type": "function", "function": {"name": "db_find", "arguments": '{"symbol":"VNM"}'}},
            ],
        },
        {"role": "tool", "tool_call_id": "c1", "content": "FPT 118"},
        {"role": "tool", "tool_call_id": "c2", "content": "VNM 60"},
    ]
    out = _convert_messages(messages)
    assert len(out) == 3  # user, assistant(tool_use x2), user(tool_result x2 GOM lại)

    # user text → block text
    assert out[0] == {"role": "user", "content": [{"type": "text", "text": "giá FPT và VNM?"}]}

    # assistant tool_calls → tool_use, input là DICT (json.loads arguments)
    assert out[1]["role"] == "assistant"
    tool_use = out[1]["content"]
    assert len(tool_use) == 2
    assert tool_use[0] == {"type": "tool_use", "id": "c1", "name": "db_find", "input": {"symbol": "FPT"}}
    assert isinstance(tool_use[0]["input"], dict)
    assert tool_use[1]["input"] == {"symbol": "VNM"}

    # 2 message role:tool LIÊN TIẾP → 1 user với 2 tool_result
    assert out[2]["role"] == "user"
    results = out[2]["content"]
    assert len(results) == 2
    assert results[0] == {"type": "tool_result", "tool_use_id": "c1", "content": "FPT 118"}
    assert results[1] == {"type": "tool_result", "tool_use_id": "c2", "content": "VNM 60"}


def test_convert_messages_assistant_text_becomes_text_block() -> None:
    out = _convert_messages([{"role": "assistant", "content": "Xin chào"}])
    assert out == [{"role": "assistant", "content": [{"type": "text", "text": "Xin chào"}]}]


def test_convert_messages_separate_tool_runs_stay_separate() -> None:
    # tool run, rồi assistant, rồi tool run nữa → 2 user turn tách biệt (không gom xuyên assistant)
    messages = [
        {"role": "tool", "tool_call_id": "a", "content": "1"},
        {"role": "assistant", "content": "giữa"},
        {"role": "tool", "tool_call_id": "b", "content": "2"},
    ]
    out = _convert_messages(messages)
    assert len(out) == 3
    assert out[0]["role"] == "user" and out[0]["content"][0]["tool_use_id"] == "a"
    assert out[1]["role"] == "assistant"
    assert out[2]["role"] == "user" and out[2]["content"][0]["tool_use_id"] == "b"


# --- Unit convert: tools ---

def test_convert_tools_maps_parameters_to_input_schema() -> None:
    tools = [
        {
            "type": "function",
            "function": {
                "name": "db_find",
                "description": "Tra cứu",
                "parameters": {"type": "object", "properties": {"collection": {"type": "string"}}},
            },
        }
    ]
    out = _convert_tools(tools)
    assert out == [
        {
            "name": "db_find",
            "description": "Tra cứu",
            "input_schema": {"type": "object", "properties": {"collection": {"type": "string"}}},
        }
    ]


# --- SSE parse (scripted, không network) ---

def test_text_stream_yields_tokens_then_done_with_usage() -> None:
    events = parse_sse_lines(_lines(TEXT_STREAM))
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert "".join(t.text for t in tokens) == "Giá FPT là 118,5"
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.truncated is False
    assert done.usage["in"] == 1200
    assert done.usage["out"] == 42
    assert done.usage["cache_read"] == 900
    assert done.usage["cache_write"] == 100


def test_tool_use_stream_yields_toolcalls_with_dict_args() -> None:
    events = parse_sse_lines(_lines(TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.id == "toolu_1"
    assert call.name == "db_find"
    assert call.arguments == {"collection": "stock_snapshot"}  # ghép 3 mảnh partial_json
    assert isinstance(call.arguments, dict)
    assert call.arg_error is None


def test_thinking_delta_accumulated_on_tool_calls_event() -> None:
    events = parse_sse_lines(_lines(THINKING_TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    assert tool_events[0].reasoning_content == "Cần tra giá FPT."
    assert tool_events[0].calls[0].arguments == {}


def test_max_tokens_marks_done_truncated() -> None:
    events = parse_sse_lines(_lines(MAX_TOKENS_STREAM))
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.truncated is True


def test_malformed_tool_json_sets_arg_error_without_crash() -> None:
    broken = (
        "event: content_block_start\n"
        'data: {"type":"content_block_start","index":0,"content_block":'
        '{"type":"tool_use","id":"toolu_x","name":"db_find","input":{}}}\n\n'
        "event: content_block_delta\n"
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{not json"}}\n\n'
        "event: message_delta\n"
        'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":3}}\n\n'
    )
    events = parse_sse_lines(_lines(broken))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.arguments == {}
    assert call.arg_error is not None and "JSON" in call.arg_error


# --- Payload / headers ---

def test_payload_builds_anthropic_body() -> None:
    adapter = AnthropicCompatAdapter(base_url="https://api.test", api_key="k", model="m", temperature=0.2)
    payload = adapter._payload(
        [SystemBlock(text="pack", cache_hint=True)],
        [{"role": "user", "content": "hi"}],
        [{"type": "function", "function": {"name": "db_find", "description": "d", "parameters": {"type": "object"}}}],
        512,
    )
    assert payload["model"] == "m"
    assert payload["max_tokens"] == 512
    assert payload["stream"] is True
    assert payload["temperature"] == 0.2
    assert payload["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert payload["messages"] == [{"role": "user", "content": [{"type": "text", "text": "hi"}]}]
    assert payload["tools"][0]["input_schema"] == {"type": "object"}
    assert "thinking" not in payload


def test_payload_thinking_enabled_adds_budget() -> None:
    adapter = AnthropicCompatAdapter(
        base_url="https://api.test", api_key="k", model="m", thinking="enabled", reasoning_effort="max"
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert payload["thinking"]["type"] == "enabled"
    assert payload["thinking"]["budget_tokens"] == 16000


def test_payload_thinking_disabled_omits_field() -> None:
    adapter = AnthropicCompatAdapter(
        base_url="https://api.test", api_key="k", model="m", thinking="disabled", reasoning_effort="high"
    )
    payload = adapter._payload([SystemBlock(text="s")], [{"role": "user", "content": "hi"}], [], 100)
    assert "thinking" not in payload


def test_url_appends_v1_messages() -> None:
    adapter = AnthropicCompatAdapter(base_url="https://api.minimax.io/anthropic/", api_key="k", model="m")
    assert adapter._url == "https://api.minimax.io/anthropic/v1/messages"


# --- Async wire path qua MockTransport (headers + full stream) ---

async def test_stream_chat_sets_anthropic_headers_and_streams() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(dict(request.headers))
        return httpx.Response(200, text=TEXT_STREAM, headers={"content-type": "text/event-stream"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = AnthropicCompatAdapter(base_url="https://api.test", api_key="sk-test", model="m", client=client)
    events = [
        e
        async for e in adapter.stream_chat(
            system=[SystemBlock(text="pack", cache_hint=True)],
            messages=[{"role": "user", "content": "FPT?"}],
            tools=[],
            max_tokens=100,
        )
    ]
    assert seen["x-api-key"] == "sk-test"
    assert seen["anthropic-version"] == "2023-06-01"
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert "".join(t.text for t in tokens) == "Giá FPT là 118,5"
    assert isinstance(events[-1], DoneEvent)


async def test_stream_chat_error_status_yields_error_event() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text="bad request")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = AnthropicCompatAdapter(base_url="https://api.test", api_key="k", model="m", client=client)
    events = [
        e
        async for e in adapter.stream_chat(
            system=[SystemBlock(text="s")], messages=[{"role": "user", "content": "x"}], tools=[], max_tokens=10
        )
    ]
    from app.agent.events import ErrorEvent

    assert len(events) == 1 and isinstance(events[0], ErrorEvent)


async def test_stream_chat_retries_on_5xx_before_token(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", _no_sleep)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(503, text="overloaded")
        return httpx.Response(200, text=TEXT_STREAM, headers={"content-type": "text/event-stream"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = AnthropicCompatAdapter(base_url="https://api.test", api_key="k", model="m", client=client)
    events = [
        e
        async for e in adapter.stream_chat(
            system=[SystemBlock(text="s")], messages=[{"role": "user", "content": "x"}], tools=[], max_tokens=10
        )
    ]
    assert calls["n"] == 2  # đã retry sau 503
    assert isinstance(events[-1], DoneEvent)
