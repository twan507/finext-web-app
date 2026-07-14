import json

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.echo import EchoAdapter
from app.agent.events import DoneEvent, TokenEvent
from app.routers.chat import sse_frame


def test_sse_frame_format():
    frame = sse_frame("token", {"text": "xin chào"})
    assert frame.endswith("\n\n")
    assert frame.startswith("data: ")
    payload = json.loads(frame[len("data: ") : -2])
    assert payload == {"type": "token", "text": "xin chào"}


def test_sse_frame_keeps_vietnamese_unescaped():
    frame = sse_frame("token", {"text": "giá cổ phiếu"})
    assert "giá cổ phiếu" in frame


async def test_echo_adapter_streams_tokens_then_done():
    adapter = EchoAdapter()
    events = [
        event
        async for event in adapter.stream_chat(
            system=[SystemBlock(text="stub", cache_hint=True)],
            messages=[{"role": "user", "content": "FPT giá bao nhiêu?"}],
            tools=[],
            max_tokens=100,
        )
    ]
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert len(tokens) >= 2
    assert "FPT giá bao nhiêu?" in "".join(t.text for t in tokens)
    assert isinstance(events[-1], DoneEvent)
