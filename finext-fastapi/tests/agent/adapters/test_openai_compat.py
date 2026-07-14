from collections.abc import AsyncIterator

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
