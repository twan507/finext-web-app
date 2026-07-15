import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, run_agent
from app.auth.dependencies import get_current_active_user
from app.schemas.chat import ChatStreamRequest
from app.schemas.users import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags thêm ở main.py

HEARTBEAT_SECONDS = 10.0

STREAM_END = None


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


def _put_sentinel_nowait(queue: asyncio.Queue) -> None:
    """Nhánh CANCEL: user đóng tab, consumer đã thoát — best-effort, KHÔNG block (carryover #3)."""
    try:
        queue.put_nowait(STREAM_END)
    except asyncio.QueueFull:
        pass


async def _produce(queue: asyncio.Queue, body: ChatStreamRequest, ctx: GatewayContext) -> None:
    """Chạy agent, đẩy frame vào queue. None = kết thúc stream."""

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        await queue.put(sse_frame(event_type, payload))

    try:
        gateway = build_gateway()  # M1: trong try → lỗi khởi tạo vẫn ra error frame + sentinel
        system, _as_of = await build_system_blocks(gateway, ctx)
        await run_agent(
            adapter=build_adapter(),
            gateway=gateway,
            ctx=ctx,
            system=system,
            messages=[{"role": "user", "content": body.message}],
            emit=emit,
        )
    except asyncio.CancelledError:
        _put_sentinel_nowait(queue)  # cancel → không được block trên put khi queue đầy
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent request_id=%s", ctx.request_id)
        await queue.put(sse_frame("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."}))
    # Nhánh BÌNH THƯỜNG (xong hoặc lỗi đã xử lý): consumer còn drain → sentinel chắc chắn tới.
    await queue.put(STREAM_END)


async def _event_stream(request: Request, body: ChatStreamRequest, user_id: str) -> AsyncIterator[str]:
    request_id = str(uuid.uuid4())
    ctx = GatewayContext(request_id=request_id, user_id=user_id)
    conversation_id = body.conversation_id or str(uuid.uuid4())

    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    task = asyncio.create_task(_produce(queue, body, ctx))

    # meta.as_of = null ở v1 slice: briefing đọc trong task nền, không chặn frame đầu (doc 02 §5.2)
    yield sse_frame(
        "meta", {"conversation_id": conversation_id, "message_id": request_id, "as_of": None}
    )

    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if frame is STREAM_END:
                break
            yield frame
    finally:
        if not task.done():
            task.cancel()  # user đóng tab → hủy LLM call, ngừng trả tiền token
        logger.info("chat stream kết thúc request_id=%s user_id=%s", request_id, user_id)


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
