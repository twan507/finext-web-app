"""Vòng lặp LLM ↔ tools. Không biết provider nào, không biết gateway nào (doc 02 §4.2)."""

import asyncio
import hashlib
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.agent.adapters.anthropic_compat import AnthropicCompatAdapter
from app.agent.adapters.base import ModelAdapter, SystemBlock
from app.agent.adapters.openai_compat import REQUEST_TIMEOUT, OpenAICompatAdapter
from app.agent.events import DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.agent.labels import label_for
from app.agent.sanitize import sanitize_answer
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool
from app.core.config import (
    LLM_API_KEY,
    LLM_API_STYLE,
    LLM_BASE_URL,
    LLM_MAX_OUTPUT_TOKENS,
    LLM_MODEL,
    LLM_REASONING_EFFORT,
    LLM_TEMPERATURE,
    LLM_THINKING,
)

logger = logging.getLogger(__name__)

MAX_ITERS = 8
# Trần token/lượt trả lời. Trần cứng v4-flash/pro = 384K; default 64K cho câu phân tích dài, dư đầu cho thinking sau.
MAX_OUTPUT_TOKENS = int(LLM_MAX_OUTPUT_TOKENS) if LLM_MAX_OUTPUT_TOKENS else 64000
MAX_TOTAL_TOOL_CHARS = 30_000
STREAM_CHUNK = 12  # ký tự/đoạn khi nhả lại câu đã sanitize — cắt ở khoảng trắng.
STREAM_CHUNK_DELAY_S = 0.05  # nhịp giữa các đoạn (giả "nhả chữ" ~240 ký tự/giây, tự nhiên hơn); câu cuối buffer trọn nên tự tạo nhịp.

_REPEAT_FEEDBACK = (
    "Query này đã được thử ở trên và bị lỗi. Đừng lặp lại y hệt — hãy đổi cách: thu hẹp phạm vi, "
    "sửa tham số theo gợi ý lỗi trước, hoặc dùng db_stats để lấy số tổng hợp (min/đỉnh/đáy/percentile) "
    "thay vì tự tính trên chuỗi dài."
)


def _call_signature(call: ToolCall) -> str:
    """Chữ ký ổn định cho 1 tool call (name + arguments) — để phát hiện lặp lại query đã lỗi."""
    args = call.arguments if isinstance(call.arguments, dict) else {}
    payload = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(f"{call.name}|{payload}".encode("utf-8")).hexdigest()


def _stream_chunks(text: str) -> list[str]:
    """Cắt text thành đoạn ~STREAM_CHUNK ký tự ở ranh giới khoảng trắng/xuống dòng (không cắt giữa từ)."""
    chunks: list[str] = []
    i, n = 0, len(text)
    while i < n:
        j = min(i + STREAM_CHUNK, n)
        if j < n:
            cut = max(text.rfind(" ", i, j), text.rfind("\n", i, j))
            if cut > i:
                j = cut + 1
        chunks.append(text[i:j])
        i = j
    return chunks


Emit = Callable[[str, dict[str, Any]], Awaitable[None]]

# Carryover #2: 1 AsyncClient dùng chung, lazy-init ở module — tránh rò connection pool khi mỗi
# request tạo-rồi-bỏ client mới. Mọi request FastAPI chạy chung 1 event loop nên singleton an toàn.
_shared_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
    return _shared_client


def build_adapter() -> ModelAdapter:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    temp = float(LLM_TEMPERATURE) if LLM_TEMPERATURE else None
    if LLM_API_STYLE == "anthropic":
        return AnthropicCompatAdapter(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            model=LLM_MODEL,
            client=_get_client(),
            temperature=temp,
            thinking=LLM_THINKING,
            reasoning_effort=LLM_REASONING_EFFORT,
        )
    return OpenAICompatAdapter(
        base_url=LLM_BASE_URL,
        api_key=LLM_API_KEY,
        model=LLM_MODEL,
        client=_get_client(),
        temperature=temp,
        thinking=LLM_THINKING,
        reasoning_effort=LLM_REASONING_EFFORT,
    )


def _merge_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    """Carryover #1: cộng dồn usage qua các vòng LLM. Vòng kết thúc bằng ToolCallsEvent không mang
    usage (known-gap v1 — cần thêm field usage vào ToolCallsEvent ở task sau)."""
    for key, value in usage.items():
        if isinstance(value, int):
            total[key] = total.get(key, 0) + value


async def _run_tools(
    gateway: GatewayProtocol, ctx: GatewayContext, calls: list[ToolCall], emit: Emit, failed_sig: set[str]
) -> list[dict[str, Any]]:
    for call in calls:
        await emit("tool_start", {"name": call.name, "label": label_for(call)})

    async def _run_one(call: ToolCall) -> tuple[str, dict[str, Any]]:
        # Chữ ký đã lỗi ở lượt trước → KHÔNG chạm gateway, trả feedback mạnh để model đổi cách.
        if _call_signature(call) in failed_sig:
            return _REPEAT_FEEDBACK, {"ok": False, "ms": 0}
        return await execute_tool(gateway, ctx, call)

    results = await asyncio.gather(*(_run_one(call) for call in calls))

    messages: list[dict[str, Any]] = []
    budget = MAX_TOTAL_TOOL_CHARS
    for call, (content, meta) in zip(calls, results, strict=True):
        await emit("tool_end", {"name": call.name, "ok": meta["ok"], "ms": meta["ms"]})
        if not meta["ok"]:
            failed_sig.add(_call_signature(call))
        if len(content) > budget:
            content = content[:budget] + " …[đã cắt do vượt ngân sách]" if budget > 0 else "[đã cắt do vượt ngân sách]"
        budget = max(0, budget - len(content))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": content})
    return messages


def _assistant_tool_message(calls: list[ToolCall], reasoning_content: str | None = None) -> dict[str, Any]:
    message: dict[str, Any] = {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False)},
            }
            for call in calls
        ],
    }
    if reasoning_content is not None:
        message["reasoning_content"] = reasoning_content
    return message


async def _drive_turn(
    adapter: ModelAdapter,
    system: list[SystemBlock],
    working: list[dict[str, Any]],
    emit: Emit,
    usage_total: dict[str, int],
) -> tuple[list[ToolCall], str | None, bool]:
    """Chạy 1 lượt stream. Buffer text: lượt gọi-tool (interim) BỎ text; lượt cuối sanitize rồi nhả chunk."""
    pending: list[ToolCall] = []
    pending_reasoning: str | None = None
    buffer: list[str] = []
    async for event in adapter.stream_chat(
        system=system, messages=working, tools=TOOL_SCHEMAS, max_tokens=MAX_OUTPUT_TOKENS
    ):
        if isinstance(event, TokenEvent):
            buffer.append(event.text)  # KHÔNG emit ngay — chờ biết interim hay final
        elif isinstance(event, ToolCallsEvent):
            pending = event.calls
            pending_reasoning = event.reasoning_content
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            for i, chunk in enumerate(_stream_chunks(sanitize_answer("".join(buffer)))):
                if i:
                    await asyncio.sleep(STREAM_CHUNK_DELAY_S)  # tạo nhịp → FE nhả chữ dần, không đổ 1 lần
                await emit("token", {"text": chunk})
            await emit("done", {"usage": usage_total, "truncated": event.truncated})
            return pending, pending_reasoning, True
        elif isinstance(event, ErrorEvent):
            await emit("error", {"message": event.message})
            return pending, pending_reasoning, True
    return pending, pending_reasoning, False  # interim: buffer bị bỏ (preamble không lộ)


async def run_agent(
    adapter: ModelAdapter,
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    system: list[SystemBlock],
    messages: list[dict[str, Any]],
    emit: Emit,
) -> None:
    working: list[dict[str, Any]] = list(messages)
    usage_total: dict[str, int] = {}
    failed_sig: set[str] = set()

    for _ in range(MAX_ITERS):
        pending, pending_reasoning, stop = await _drive_turn(adapter, system, working, emit, usage_total)
        if stop:
            return
        if not pending:
            await emit("done", {"usage": usage_total, "truncated": False})
            return
        working.append(_assistant_tool_message(pending, pending_reasoning))
        working.extend(await _run_tools(gateway, ctx, pending, emit, failed_sig))

    logger.warning("Agent chạm MAX_ITERS request_id=%s", ctx.request_id)
    await emit("error", {"message": "Có lỗi khi tra cứu dữ liệu cho câu này. Bạn thử hỏi lại hoặc diễn đạt theo cách khác giúp mình nhé."})
