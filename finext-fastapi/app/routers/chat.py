import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.agent.adapters.echo import EchoAdapter
from app.agent.adapters.base import SystemBlock
from app.agent.events import DoneEvent, ErrorEvent, TokenEvent
from app.auth.dependencies import get_current_active_user
from app.schemas.chat import ChatStreamRequest
from app.schemas.users import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags thêm ở main.py

HEARTBEAT_SECONDS = 10.0
MAX_OUTPUT_TOKENS = 1200


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


async def _run_agent(queue: asyncio.Queue, body: ChatStreamRequest) -> None:
    """Producer: chạy agent, đẩy frame vào queue. None = kết thúc stream."""
    adapter = EchoAdapter()
    try:
        async for event in adapter.stream_chat(
            system=[SystemBlock(text="stub", cache_hint=True)],
            messages=[{"role": "user", "content": body.message}],
            tools=[],
            max_tokens=MAX_OUTPUT_TOKENS,
        ):
            if isinstance(event, TokenEvent):
                await queue.put(sse_frame("token", {"text": event.text}))
            elif isinstance(event, DoneEvent):
                await queue.put(sse_frame("done", {"usage": event.usage}))
            elif isinstance(event, ErrorEvent):
                await queue.put(sse_frame("error", {"message": event.message}))
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent")
        await queue.put(sse_frame("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."}))
    finally:
        await queue.put(None)


async def _event_stream(request: Request, body: ChatStreamRequest, user_id: str) -> AsyncIterator[str]:
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    conversation_id = body.conversation_id or str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    yield sse_frame("meta", {"conversation_id": conversation_id, "message_id": message_id, "as_of": None})

    task = asyncio.create_task(_run_agent(queue, body))
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if frame is None:
                break
            yield frame
    finally:
        if not task.done():
            task.cancel()  # user đóng tab → ngừng trả tiền token ngay
        logger.info("chat stream kết thúc user_id=%s conversation_id=%s", user_id, conversation_id)


@router.post("/stream", summary="[User] Chat với Finext AI (SSE)", tags=["chat"])
async def chat_stream(
    request: Request,
    body: ChatStreamRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(request, body, str(current_user.id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
