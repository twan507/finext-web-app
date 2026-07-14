import asyncio
import json

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.echo import EchoAdapter
from app.agent.events import DoneEvent, TokenEvent
from app.routers.chat import _run_agent, sse_frame
from app.schemas.chat import ChatStreamRequest


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


async def test_run_agent_no_deadlock_when_cancelled_with_full_queue():
    """Cancel producer lúc nó đang block trên queue đầy: finally KHÔNG được block trên put(None)."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=2)
    body = ChatStreamRequest(message="một hai ba bốn năm sáu bảy tám chín mười")
    task = asyncio.create_task(_run_agent(queue, body))

    await asyncio.sleep(0.3)  # producer điền đầy queue rồi block trên put (không ai drain)
    assert queue.full()

    task.cancel()
    await asyncio.sleep(0.1)  # cho vòng cancel + finally chạy xong

    # Bug cũ (await queue.put(None) trong finally): treo vĩnh viễn → task không bao giờ done.
    assert task.done()
    assert task.cancelled()
