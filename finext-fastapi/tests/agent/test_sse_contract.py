import asyncio
import json

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.echo import EchoAdapter
from app.agent.events import DoneEvent, TokenEvent
from app.agent.gateway.types import GatewayContext
from app.routers.chat import _produce, sse_frame
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


async def test_produce_cancel_does_not_block_on_full_queue(monkeypatch):
    """Cancel producer lúc nó đang block trên queue đầy: nhánh cancel dùng put_nowait, KHÔNG block."""

    class _SlowAdapter:
        async def stream_chat(self, system, messages, tools, max_tokens):
            # Bậc 2: token được buffer tới DoneEvent rồi mới flush theo chunk. Nhả 1 câu dài +
            # Done nhanh → lúc flush, producer block trên put vào queue đầy (không ai drain).
            yield TokenEvent(text="mot hai ba bon nam sau bay tam chin muoi " * 6)
            await asyncio.sleep(0.02)
            yield DoneEvent(usage={})

    async def _blocks(gateway, ctx):
        return [SystemBlock(text="stub", cache_hint=True)], None

    monkeypatch.setattr("app.routers.chat.build_gateway", lambda: None)
    monkeypatch.setattr("app.routers.chat.build_adapter", lambda **_: _SlowAdapter())
    monkeypatch.setattr("app.routers.chat.build_system_blocks", _blocks)

    queue: asyncio.Queue = asyncio.Queue(maxsize=2)
    ctx = GatewayContext(request_id="r1", user_id="u1")
    body = ChatStreamRequest(message="một hai ba bốn năm sáu bảy tám chín mười")
    task = asyncio.create_task(_produce(queue, body, ctx, "conv-test"))

    await asyncio.sleep(0.3)  # producer điền đầy queue rồi block trên put (không ai drain)
    assert queue.full()

    task.cancel()
    await asyncio.sleep(0.1)  # cho vòng cancel chạy xong

    # Nhánh cancel dùng put_nowait → không treo trên queue đầy → task kết thúc ở trạng thái cancelled.
    assert task.done()
    assert task.cancelled()
