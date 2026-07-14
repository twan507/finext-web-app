"""Vòng lặp LLM ↔ tools. Không biết provider nào, không biết gateway nào (doc 02 §4.2)."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from app.agent.adapters.base import ModelAdapter, SystemBlock
from app.agent.adapters.openai_compat import REQUEST_TIMEOUT, OpenAICompatAdapter
from app.agent.events import DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.agent.labels import label_for
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool
from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

logger = logging.getLogger(__name__)

MAX_ITERS = 8
MAX_OUTPUT_TOKENS = 1200
MAX_TOTAL_TOOL_CHARS = 30_000

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
    return OpenAICompatAdapter(
        base_url=LLM_BASE_URL, api_key=LLM_API_KEY, model=LLM_MODEL, client=_get_client()
    )


def _merge_usage(total: dict[str, int], usage: dict[str, int]) -> None:
    """Carryover #1: cộng dồn usage qua các vòng LLM. Vòng kết thúc bằng ToolCallsEvent không mang
    usage (known-gap v1 — cần thêm field usage vào ToolCallsEvent ở task sau)."""
    for key, value in usage.items():
        if isinstance(value, int):
            total[key] = total.get(key, 0) + value


async def _run_tools(
    gateway: GatewayProtocol, ctx: GatewayContext, calls: list[ToolCall], emit: Emit
) -> list[dict[str, Any]]:
    for call in calls:
        await emit("tool_start", {"name": call.name, "label": label_for(call)})

    results = await asyncio.gather(*(execute_tool(gateway, ctx, call) for call in calls))

    messages: list[dict[str, Any]] = []
    budget = MAX_TOTAL_TOOL_CHARS
    for call, (content, meta) in zip(calls, results, strict=True):
        await emit("tool_end", {"name": call.name, "ok": meta["ok"], "ms": meta["ms"]})
        if len(content) > budget:
            content = content[:budget] + " …[đã cắt do vượt ngân sách]" if budget > 0 else "[đã cắt do vượt ngân sách]"
        budget = max(0, budget - len(content))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": content})
    return messages


def _assistant_tool_message(calls: list[ToolCall]) -> dict[str, Any]:
    return {
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


async def _drive_turn(
    adapter: ModelAdapter,
    system: list[SystemBlock],
    working: list[dict[str, Any]],
    emit: Emit,
    usage_total: dict[str, int],
) -> tuple[list[ToolCall], bool]:
    """Chạy 1 lượt stream. Trả (tool call đang chờ, stop) — stop=True nghĩa loop đã emit done/error."""
    pending: list[ToolCall] = []
    async for event in adapter.stream_chat(
        system=system, messages=working, tools=TOOL_SCHEMAS, max_tokens=MAX_OUTPUT_TOKENS
    ):
        if isinstance(event, TokenEvent):
            await emit("token", {"text": event.text})
        elif isinstance(event, ToolCallsEvent):
            pending = event.calls
        elif isinstance(event, DoneEvent):
            _merge_usage(usage_total, event.usage)
            await emit("done", {"usage": usage_total})
            return pending, True
        elif isinstance(event, ErrorEvent):
            await emit("error", {"message": event.message})
            return pending, True
    return pending, False


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

    for _ in range(MAX_ITERS):
        pending, stop = await _drive_turn(adapter, system, working, emit, usage_total)
        if stop:
            return
        if not pending:
            await emit("done", {"usage": usage_total})
            return
        working.append(_assistant_tool_message(pending))
        working.extend(await _run_tools(gateway, ctx, pending, emit))

    logger.warning("Agent chạm MAX_ITERS request_id=%s", ctx.request_id)
    await emit("error", {"message": "Vượt giới hạn bước xử lý. Bạn thử hỏi ngắn gọn hơn nhé."})
