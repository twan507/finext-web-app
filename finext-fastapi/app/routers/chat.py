import asyncio
import json
import logging
import uuid
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.chat as crud_chat
from app.agent.adapters.base import SystemBlock
from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, generate_title, run_agent
from app.agent.portfolio import build_portfolio_block
from app.auth.access import get_user_feature_keys
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database
from app.schemas.chat import (
    ChatStreamRequest,
    ConversationDetail,
    ConversationPinRequest,
    ConversationRenameRequest,
    ConversationSummary,
    MessageFeedbackRequest,
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags thêm ở main.py

HEARTBEAT_SECONDS = 10.0

STREAM_END = None


# ── Registry chạy nền + hàng đợi per-user (in-memory, module-level, có lock) ─────────────────────
# Mỗi user tối đa 1 turn chạy ĐỒNG THỜI; câu gửi thêm khi đang bận → xếp hàng FIFO tối đa 3.
# In-memory: server restart mất turn đang chạy + đang chờ (câu đã xong vẫn ở DB) — chấp nhận (spec).
MAX_QUEUE_PER_USER = 3


@dataclass
class _QueuedTurn:
    body: ChatStreamRequest
    conversation_id: str
    is_new: bool


@dataclass
class _UserRunner:
    current: asyncio.Task[None] | None = None
    queue: deque[_QueuedTurn] = field(default_factory=deque)


_runners: dict[str, _UserRunner] = {}
_runners_lock = asyncio.Lock()


def _messages_from(body: ChatStreamRequest) -> list[dict[str, str]]:
    """Ghép history (client giữ) + message hiện tại thành messages cho run_agent (sidecar, không đổi)."""
    return [*(t.model_dump() for t in body.history), {"role": "user", "content": body.message}]


_PAGE_CONTEXT_HEADER = "[NGỮ CẢNH TRANG — để hiểu user đang xem gì; KHÔNG nhắc lại nội dung này cho user]"


def _page_context_block(page_context: str | None) -> SystemBlock | None:
    """Khối system mô tả trang user đang xem (bubble chat). None khi không có ngữ cảnh.

    cache_hint=False vì đổi theo từng trang/lượt — cùng kiểu với ghi chú phiên.
    """
    if not page_context or not page_context.strip():
        return None
    return SystemBlock(text=f"{_PAGE_CONTEXT_HEADER}\n{page_context.strip()}", cache_hint=False)


# Gate tính năng nâng cao /portfolio — khớp ADVANCED_AND_ABOVE_STRICT của frontend (loại basic).
_ADVANCED_FEATURE_KEYS = {"advanced_feature", "broker_feature", "manager_feature", "admin_feature"}


def portfolio_access_ok(feature_keys: list[str]) -> bool:
    """True nếu user đủ gói (advanced trở lên) để dùng chế độ tư vấn danh mục."""
    return bool(set(feature_keys) & _ADVANCED_FEATURE_KEYS)


def portfolio_system_block(mode: str | None) -> SystemBlock | None:
    """Persona tư vấn danh mục — chỉ khi mode=='portfolio'; None cho chat thường."""
    return build_portfolio_block() if mode == "portfolio" else None


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


def _put_sentinel_nowait(queue: asyncio.Queue) -> None:
    """Nhánh CANCEL: user đóng tab, consumer đã thoát — best-effort, KHÔNG block (carryover #3)."""
    try:
        queue.put_nowait(STREAM_END)
    except asyncio.QueueFull:
        pass


class _AnswerCollector:
    """Quan sát các frame emit để thu câu trả lời + usage + tool metadata cho persistence.
    KHÔNG can thiệp stream — chỉ đọc. Chỉ lưu assistant khi thấy 'done' (done_seen)."""

    def __init__(self) -> None:
        self._parts: list[str] = []
        self._starts: list[dict[str, Any]] = []
        self._ends: list[dict[str, Any]] = []
        self.usage: dict[str, int] = {}
        self.done_seen = False

    def observe(self, event_type: str, payload: dict[str, Any]) -> None:
        if event_type == "token":
            self._parts.append(payload.get("text", ""))
        elif event_type == "tool_start":
            self._starts.append(payload)
        elif event_type == "tool_end":
            self._ends.append(payload)
        elif event_type == "done":
            self.usage = payload.get("usage", {}) or {}
            self.done_seen = True

    def text(self) -> str:
        return "".join(self._parts)

    def tool_calls(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for s, e in zip(self._starts, self._ends):
            out.append({
                "name": s.get("name", ""),
                "args_summary": s.get("label", ""),
                "ok": bool(e.get("ok", True)),
                "ms": int(e.get("ms", 0)),
            })
        return out


async def _maybe_generate_title(user_id: str, conversation_id: str, first_message: str, emit: Any) -> None:
    """Hội thoại MỚI: sinh tiêu đề tiếng Việt bằng AI (1 call rẻ) → cập nhật DB + emit event 'title'.
    Best-effort: lỗi thì giữ tiêu đề mặc định (60 ký tự đầu do start_turn đặt)."""
    try:
        title_usage: dict[str, int] = {}
        title = await generate_title(build_adapter(thinking="disabled"), first_message, title_usage)
        if not title:
            return
        db = get_database("user_db")
        await crud_chat.update_title(db, conversation_id, title)
        await crud_chat.record_usage(db, user_id, title_usage)
        await emit("title", {"conversation_id": conversation_id, "title": title})
    except Exception:
        logger.exception("Đặt tiêu đề AI thất bại conversation_id=%s", conversation_id)


async def _persist_answer(user_id: str, conversation_id: str, collector: _AnswerCollector, emit: Any) -> None:
    """Lưu assistant-msg + cộng token — CHỈ khi stream đã 'done'. Best-effort (không làm sập stream).
    Emit 'message_saved' {message_id} để FE gắn id thật cho câu vừa trả lời (dùng cho 👍/👎)."""
    if not collector.done_seen:
        return  # lỗi/huỷ giữa chừng → không lưu assistant → FE thấy user-msg trống reply → "Thử lại"
    db = get_database("user_db")
    try:
        message_id = await crud_chat.add_message(
            db, conversation_id, user_id, "assistant",
            collector.text(), tool_calls=collector.tool_calls(), usage=collector.usage or None,
        )
        warn = await crud_chat.record_usage(db, user_id, collector.usage)
        await emit("message_saved", {"message_id": message_id})
        # Cảnh báo sớm 50%/75%: chỉ NHẮC, user vẫn chat tiếp được (khác 429/503 là chặn hẳn).
        if warn:
            await emit("quota_warn", warn)
    except Exception:
        logger.exception("Lưu câu trả lời/usage thất bại conversation_id=%s", conversation_id)


async def _produce(
    queue: asyncio.Queue, body: ChatStreamRequest, ctx: GatewayContext, conversation_id: str, is_new: bool = False
) -> None:
    """Chạy agent, đẩy frame vào queue, thu câu trả lời để persistence. None = kết thúc stream."""
    collector = _AnswerCollector()

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        collector.observe(event_type, payload)
        await queue.put(sse_frame(event_type, payload))

    try:
        gateway = build_gateway()  # M1: trong try → lỗi khởi tạo vẫn ra error frame + sentinel
        system, _as_of = await build_system_blocks(gateway, ctx)
        pf_block = portfolio_system_block(body.mode)
        if pf_block is not None:
            system.append(pf_block)  # persona tư vấn danh mục — TRƯỚC page_context
        page_block = _page_context_block(body.page_context)
        if page_block is not None:
            system.append(page_block)  # nối CUỐI: giữ nguyên cache prefix của các khối thường trú
        await run_agent(
            adapter=build_adapter(thinking="adaptive" if body.thinking else "disabled"),
            gateway=gateway,
            ctx=ctx,
            system=system,
            messages=_messages_from(body),
            emit=emit,
        )
    except asyncio.CancelledError:
        _put_sentinel_nowait(queue)  # cancel → không được block trên put khi queue đầy
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent request_id=%s", ctx.request_id)
        await queue.put(sse_frame("error", {"message": "Server đang quá tải, vui lòng thử lại sau nhé."}))
    else:
        # CHỈ path sạch (không exception, run_agent tự return kể cả khi emit "error"): lưu nếu đã 'done'.
        await _persist_answer(ctx.user_id, conversation_id, collector, emit)
        # Hội thoại mới → đặt tiêu đề AI (sau khi đã trả lời xong, không chặn câu trả lời).
        if is_new:
            await _maybe_generate_title(ctx.user_id, conversation_id, body.message, emit)
    # Nhánh BÌNH THƯỜNG: consumer còn drain → sentinel chắc chắn tới.
    await queue.put(STREAM_END)


def _forward(sink: asyncio.Queue | None, frame: Any, *, critical: bool = False) -> None:
    """Đẩy frame cho relay live (nếu có) — KHÔNG chặn: relay chậm/đã rời → sink đầy → drop.
    Turn nền (dequeue) không có relay (sink=None) → bỏ qua. Persistence KHÔNG phụ thuộc frame này
    (collector trong _produce đã thu chữ TRƯỚC khi frame vào queue).

    critical=True dành cho frame kết thúc: nó KHÔNG được rơi. Nếu STREAM_END bị drop,
    relay không bao giờ biết turn đã xong và sẽ heartbeat tới khi proxy cắt (600s), còn
    người dùng thấy câu trả lời cụt. Sink đầy thì bỏ frame cũ nhất để nhường chỗ — mất
    một mẩu token hiển thị vẫn hơn treo cả connection. Mỗi turn chỉ có một producer nên
    một lần nhường chỗ là đủ."""
    if sink is None:
        return
    try:
        sink.put_nowait(frame)
    except asyncio.QueueFull:
        if not critical:
            return
        try:
            sink.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            sink.put_nowait(frame)
        except asyncio.QueueFull:
            logger.warning("Không đẩy được frame kết thúc cho relay: sink vẫn đầy")


async def _run_turn(
    user_id: str,
    sink: asyncio.Queue | None,
    frame_queue: asyncio.Queue,
    body: ChatStreamRequest,
    ctx: GatewayContext,
    conversation_id: str,
    is_new: bool,
) -> None:
    """Chạy 1 turn tới HẾT (detached, thuộc registry). Bơm frame từ _produce sang relay live (nếu còn),
    LUÔN drain frame_queue để _produce không kẹt khi FE đã ngắt. Xong/lỗi → dequeue turn kế (FIFO)."""
    produce_task = asyncio.create_task(_produce(frame_queue, body, ctx, conversation_id, is_new))
    try:
        while True:
            frame = await frame_queue.get()
            _forward(sink, frame, critical=frame is STREAM_END)
            if frame is STREAM_END:
                break
        await produce_task  # _persist_answer đã chạy TRƯỚC STREAM_END — chỉ chờ _produce trả về
    except asyncio.CancelledError:
        produce_task.cancel()  # chỉ khi shutdown huỷ task nền — KHÔNG do FE ngắt
        raise
    except Exception:
        logger.exception("Turn nền lỗi user_id=%s conversation_id=%s", user_id, conversation_id)
        if not produce_task.done():
            produce_task.cancel()
    await _advance_queue(user_id)  # lỗi vẫn dequeue (không kẹt); bị cancel thì đã raise ở trên nên bỏ qua


async def _admit_turn(
    user_id: str, body: ChatStreamRequest, conversation_id: str, is_new: bool
) -> tuple[asyncio.Queue, str, asyncio.Task[None]] | None:
    """Dưới lock: RẢNH → chạy turn detached, trả (sink, request_id, task) cho relay live.
    BẬN + còn chỗ → xếp hàng, trả None (FE nhận 'queued' rồi poll DB). BẬN + đầy (3) → 429."""
    async with _runners_lock:
        runner = _runners.get(user_id)
        if runner is None:
            runner = _UserRunner()
            _runners[user_id] = runner
        if runner.current is None:
            sink: asyncio.Queue = asyncio.Queue(maxsize=64)
            frame_queue: asyncio.Queue = asyncio.Queue(maxsize=64)
            request_id = str(uuid.uuid4())
            ctx = GatewayContext(request_id=request_id, user_id=user_id)
            runner.current = asyncio.create_task(
                _run_turn(user_id, sink, frame_queue, body, ctx, conversation_id, is_new)
            )
            return sink, request_id, runner.current
        if len(runner.queue) >= MAX_QUEUE_PER_USER:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Đang bận, thử lại sau.")
        runner.queue.append(_QueuedTurn(body=body, conversation_id=conversation_id, is_new=is_new))
        return None


async def _advance_queue(user_id: str) -> None:
    """Turn vừa xong: dưới lock pop turn kế (FIFO) → chạy tiếp (sink=None vì user đã rời, FE đọc DB).
    Hàng đợi rỗng + không còn turn → xoá runner (dọn registry)."""
    async with _runners_lock:
        runner = _runners.get(user_id)
        if runner is None:
            return
        if runner.queue:
            qt = runner.queue.popleft()
            frame_queue: asyncio.Queue = asyncio.Queue(maxsize=64)
            ctx = GatewayContext(request_id=str(uuid.uuid4()), user_id=user_id)
            runner.current = asyncio.create_task(
                _run_turn(user_id, None, frame_queue, qt.body, ctx, qt.conversation_id, qt.is_new)
            )
        else:
            runner.current = None
            _runners.pop(user_id, None)


async def _is_queue_full(user_id: str) -> bool:
    """Peek nhanh (KHÔNG giữ chỗ): user đang bận và hàng đợi đã đầy → chặn sớm ở endpoint TRƯỚC
    start_turn, tránh để lại user-msg mồ côi trong DB. _admit_turn vẫn 429 authoritative (race hiếm)."""
    async with _runners_lock:
        runner = _runners.get(user_id)
        return runner is not None and runner.current is not None and len(runner.queue) >= MAX_QUEUE_PER_USER


_QUEUED_MSG = "Mình đang trả lời câu trước, câu này sẽ được xử lý ngay sau đó nhé."


async def _queued_stream(conversation_id: str) -> AsyncIterator[str]:
    """User đang bận (1 turn chạy): báo 'queued' rồi ĐÓNG stream — FE hiện 'đang suy nghĩ' + poll DB."""
    yield sse_frame("meta", {"conversation_id": conversation_id, "message_id": str(uuid.uuid4()), "as_of": None})
    yield sse_frame("queued", {"conversation_id": conversation_id, "message": _QUEUED_MSG})


async def _event_stream(
    request: Request,
    sink: asyncio.Queue,
    user_id: str,
    conversation_id: str,
    request_id: str,
    task: asyncio.Task[None],
) -> AsyncIterator[str]:
    """Relay live SSE cho turn đang chạy: đọc frame từ sink tới disconnect/STREAM_END. KHÔNG sở hữu
    turn task (thuộc registry) — FE ngắt thì thôi relay, turn vẫn chạy nền tới hết + persist."""
    # meta.as_of = null ở v1: briefing đọc trong task nền, không chặn frame đầu (doc 02 §5.2)
    yield sse_frame("meta", {"conversation_id": conversation_id, "message_id": request_id, "as_of": None})
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                frame = await asyncio.wait_for(sink.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if frame is STREAM_END:
                break
            yield frame
    finally:
        # chat-background-queue: KHÔNG task.cancel() khi FE ngắt — turn chạy nền tới hết + _persist_answer
        # ghi DB (trước đây cancel ở đây làm MẤT câu trả lời dở khi user đóng tab). task giữ ref ở registry.
        logger.info("chat relay kết thúc request_id=%s user_id=%s", request_id, user_id)


@router.post("/stream", summary="[User] Chat với Finext AI (SSE)", tags=["chat"])
async def chat_stream(
    request: Request,
    body: ChatStreamRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> StreamingResponse:
    user_id = str(current_user.id)
    db = get_database("user_db")
    # Tính năng nâng cao /portfolio: chặn SỚM nếu không đủ gói (advanced trở lên) — hàng rào thật
    # phía server (gate frontend chỉ là UX). Kiểm trước start_turn để không để user-msg mồ côi.
    if body.mode == "portfolio":
        feature_keys = await get_user_feature_keys(db, current_user)
        if not portfolio_access_ok(feature_keys):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tính năng tư vấn danh mục yêu cầu gói hội viên phù hợp.",
            )
    # Quota + kill-switch: chặn TRƯỚC khi mở stream (429 lượt / 503 budget).
    decision = await crud_chat.check_quota(db, user_id)
    if not decision.ok:
        raise HTTPException(status_code=decision.status_code, detail=decision.message)
    # Hàng đợi đã đầy → 429 SỚM (trước khi persist) để không để lại user-msg mồ côi trong DB.
    if await _is_queue_full(user_id):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Đang bận, thử lại sau.")
    # Lưu user-msg + tạo/nối hội thoại → conversation_id thật để trả về meta.
    # is_new: FE không gửi conversation_id = bắt đầu hội thoại mới → sẽ đặt tiêu đề AI ở cuối lượt.
    is_new = not (body.conversation_id and body.conversation_id.strip())
    source = "portfolio" if body.mode == "portfolio" else "chat"
    conversation_id = await crud_chat.start_turn(db, user_id, body.conversation_id, body.message, source=source)
    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    # Registry per-user: RẢNH → chạy turn nền + relay live; BẬN → xếp hàng ('queued') hoặc 429 nếu đầy.
    admission = await _admit_turn(user_id, body, conversation_id, is_new)
    if admission is None:
        return StreamingResponse(_queued_stream(conversation_id), media_type="text/event-stream", headers=headers)
    sink, request_id, task = admission
    return StreamingResponse(
        _event_stream(request, sink, user_id, conversation_id, request_id, task),
        media_type="text/event-stream",
        headers=headers,
    )


@router.get(
    "/quota",
    response_model=StandardApiResponse[dict],
    summary="[User] Hạn mức token còn lại (5h + tuần)",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Lấy hạn mức thành công.")
async def my_quota(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    return await crud_chat.quota_status(db, str(current_user.id))


@router.get(
    "/conversations",
    response_model=StandardApiResponse[list[ConversationSummary]],
    summary="[User] Danh sách hội thoại của tôi",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Lấy danh sách hội thoại thành công.")
async def list_my_conversations(
    source: str | None = None,  # "portfolio" → chỉ hội thoại tư vấn danh mục; "chat" → loại portfolio
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    docs = await crud_chat.list_conversations(db, str(current_user.id), source=source)
    return [ConversationSummary.model_validate(d) for d in docs]


@router.get(
    "/conversations/{conversation_id}",
    response_model=StandardApiResponse[ConversationDetail],
    summary="[User] Chi tiết 1 hội thoại (kèm messages)",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Lấy chi tiết hội thoại thành công.")
async def get_my_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    detail = await crud_chat.get_conversation_detail(db, conversation_id, str(current_user.id))
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.",
        )
    return ConversationDetail.model_validate(detail)


@router.patch(
    "/conversations/{conversation_id}/pin",
    response_model=StandardApiResponse[None],
    summary="[User] Ghim / bỏ ghim 1 hội thoại",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Đã cập nhật ghim hội thoại.")
async def pin_my_conversation(
    conversation_id: str,
    body: ConversationPinRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    ok = await crud_chat.set_pinned(db, conversation_id, str(current_user.id), body.pinned)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền.",
        )
    return None


@router.patch(
    "/conversations/{conversation_id}/rename",
    response_model=StandardApiResponse[None],
    summary="[User] Đổi tên 1 hội thoại",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Đã đổi tên hội thoại.")
async def rename_my_conversation(
    conversation_id: str,
    body: ConversationRenameRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    ok = await crud_chat.rename_conversation(db, conversation_id, str(current_user.id), body.title)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền.",
        )
    return None


@router.patch(
    "/messages/{message_id}/feedback",
    response_model=StandardApiResponse[None],
    summary="[User] Đánh giá 👍/👎 một câu trả lời",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Đã ghi nhận đánh giá.")
async def feedback_message(
    message_id: str,
    body: MessageFeedbackRequest,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    ok = await crud_chat.set_feedback(db, message_id, str(current_user.id), body.rating, body.reason)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy câu trả lời hoặc bạn không có quyền.",
        )
    return None


@router.delete(
    "/conversations/{conversation_id}",
    response_model=StandardApiResponse[None],
    summary="[User] Xoá 1 hội thoại (kèm toàn bộ messages)",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Đã xoá hội thoại.")
async def delete_my_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    ok = await crud_chat.delete_conversation(db, conversation_id, str(current_user.id))
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền xoá.",
        )
    return None
