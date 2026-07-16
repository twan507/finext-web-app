"""Adapter wire Anthropic Messages API — chạy M3/DeepSeek-Claude-mode/Claude thật qua /v1/messages.

Cùng interface `ModelAdapter` với OpenAICompatAdapter; loop giữ định dạng message "OpenAI-ish" nội bộ,
adapter này tự convert sang wire Anthropic (system content block + tool_use/tool_result). Tái dùng
`parse_sse_chunk` + `_repair_tool_json` của adapter OpenAI (doc: 2026-07-16-anthropic-adapter-design §5).
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.agent.events import AgentEvent, DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent

from .base import SystemBlock
from .openai_compat import (
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_STATUS,
    _repair_tool_json,
    parse_sse_chunk,
)

logger = logging.getLogger(__name__)

ANTHROPIC_VERSION = "2023-06-01"


def _build_system(blocks: list[SystemBlock]) -> list[dict[str, Any]]:
    """`list[SystemBlock]` → list content block; đánh cache_control lên block cache_hint CUỐI CÙNG (§3.1)."""
    result: list[dict[str, Any]] = [{"type": "text", "text": block.text} for block in blocks]
    last_hint = max((i for i, block in enumerate(blocks) if block.cache_hint), default=-1)
    if last_hint >= 0:
        result[last_hint]["cache_control"] = {"type": "ephemeral"}
    return result


def _convert_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """OpenAI-ish → wire Anthropic; GOM chuỗi message role:"tool" liên tiếp thành 1 user turn (§3.2)."""
    out: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []

    def flush_tools() -> None:
        if tool_results:
            out.append({"role": "user", "content": list(tool_results)})
            tool_results.clear()

    for msg in messages:
        role = msg.get("role")
        if role == "tool":
            tool_results.append(
                {"type": "tool_result", "tool_use_id": msg.get("tool_call_id"), "content": msg.get("content")}
            )
            continue
        flush_tools()
        if role == "assistant" and msg.get("tool_calls"):
            out.append({"role": "assistant", "content": _tool_use_blocks(msg["tool_calls"])})
        else:  # user text hoặc assistant text (câu trả lời) → 1 block text
            out.append({"role": role, "content": [{"type": "text", "text": msg.get("content") or ""}]})
    flush_tools()
    return out


def _tool_use_blocks(tool_calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """assistant tool_calls → tool_use block; input là DICT (json.loads arguments string)."""
    blocks: list[dict[str, Any]] = []
    for call in tool_calls:
        function = call.get("function") or {}
        raw = function.get("arguments") or ""
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {}  # loop luôn dump JSON hợp lệ; guard phòng input ngoài luồng
        blocks.append(
            {
                "type": "tool_use",
                "id": call.get("id"),
                "name": function.get("name"),
                "input": parsed if isinstance(parsed, dict) else {},
            }
        )
    return blocks


def _convert_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """OpenAI `{function:{name, description, parameters}}` → Anthropic `{name, description, input_schema}` (§3.3)."""
    result: list[dict[str, Any]] = []
    for tool in tools:
        function = tool.get("function") or {}
        result.append(
            {
                "name": function.get("name"),
                "description": function.get("description", ""),
                "input_schema": function.get("parameters") or {},
            }
        )
    return result


def _thinking_budget(reasoning_effort: str | None) -> int:
    """reasoning_effort → budget_tokens: max→~16k, còn lại (high)→~8k (§3.4)."""
    return 16000 if reasoning_effort == "max" else 8000


class _ToolUseBuffer:
    """Tích luỹ tool_use theo index — id/name mở ở content_block_start, input về theo mảnh partial_json."""

    def __init__(self) -> None:
        self._calls: dict[int, dict[str, str]] = {}

    def _slot(self, index: int) -> dict[str, str]:
        return self._calls.setdefault(index, {"id": "", "name": "", "arguments": ""})

    def open(self, index: int, id_: str, name: str) -> None:
        slot = self._slot(index)
        slot["id"] = id_
        slot["name"] = name

    def append(self, index: int, partial_json: str) -> None:
        self._slot(index)["arguments"] += partial_json

    def flush(self) -> list[ToolCall]:
        calls: list[ToolCall] = []
        for index in sorted(self._calls):
            slot = self._calls[index]
            arg_error: str | None = None
            try:
                arguments = json.loads(slot["arguments"]) if slot["arguments"] else {}
            except json.JSONDecodeError as exc:
                # M3/DeepSeek đôi khi nhả JSON tool-args hỏng — thử vá an toàn (chỉ chèn '}', vẫn qua validator
                # gateway); vá không được thì báo model gọi lại (execute_tool đọc arg_error). Mirror adapter OpenAI.
                repaired = _repair_tool_json(slot["arguments"])
                if repaired is not None:
                    logger.info("Tool call arguments JSON hỏng — đã tự vá (chèn dấu ngoặc thiếu)")
                    arguments = repaired
                else:
                    logger.warning("Tool call arguments không phải JSON hợp lệ (%s) — báo model gọi lại", exc)
                    arguments = {}
                    arg_error = "tham số JSON của lần gọi trước không hợp lệ (sai cú pháp, thường do thiếu dấu ngoặc trong pipeline dài)"
            calls.append(ToolCall(id=slot["id"], name=slot["name"], arguments=arguments, arg_error=arg_error))
        return calls


@dataclass
class _TurnState:
    """State tích luỹ trong 1 lượt stream — reset mỗi attempt để retry không dính mảnh cũ."""

    buffer: _ToolUseBuffer = field(default_factory=_ToolUseBuffer)
    usage: dict[str, int] = field(default_factory=dict)
    stop_reason: str | None = None
    reasoning: str = ""


def _apply_chunk(chunk: dict[str, Any], state: _TurnState) -> TokenEvent | None:
    """Xử lý 1 chunk SSE Anthropic (switch theo data.type): cập nhật state, trả TokenEvent nếu text_delta (§5)."""
    ctype = chunk.get("type")
    if ctype == "message_start":
        message = chunk.get("message") or {}
        usage = message.get("usage") or chunk.get("usage") or {}
        if usage:
            state.usage["in"] = usage.get("input_tokens", 0)
            if "cache_read_input_tokens" in usage:
                state.usage["cache_read"] = usage.get("cache_read_input_tokens", 0)
            if "cache_creation_input_tokens" in usage:
                state.usage["cache_write"] = usage.get("cache_creation_input_tokens", 0)
        return None
    if ctype == "content_block_start":
        block = chunk.get("content_block") or {}
        if block.get("type") == "tool_use":
            state.buffer.open(chunk.get("index", 0), block.get("id", ""), block.get("name", ""))
        return None
    if ctype == "content_block_delta":
        delta = chunk.get("delta") or {}
        dtype = delta.get("type")
        if dtype == "text_delta":
            return TokenEvent(text=delta.get("text", ""))
        if dtype == "input_json_delta":
            state.buffer.append(chunk.get("index", 0), delta.get("partial_json", ""))
        elif dtype == "thinking_delta":
            state.reasoning += delta.get("thinking", "")
        return None
    if ctype == "message_delta":
        delta = chunk.get("delta") or {}
        if delta.get("stop_reason"):
            state.stop_reason = delta["stop_reason"]
        usage = chunk.get("usage") or {}
        if "output_tokens" in usage:
            state.usage["out"] = usage["output_tokens"]
        return None
    return None  # message_stop / ping / content_block_stop — bỏ qua


def _terminal_event(state: _TurnState) -> AgentEvent:
    """Cuối lượt: stop_reason=="tool_use" → ToolCallsEvent; else → DoneEvent(truncated=max_tokens) (§5)."""
    if state.stop_reason == "tool_use":
        return ToolCallsEvent(calls=state.buffer.flush(), reasoning_content=state.reasoning or None)
    return DoneEvent(usage=state.usage, truncated=state.stop_reason == "max_tokens")


def parse_sse_lines(lines: Iterable[str]) -> list[AgentEvent]:
    """Parse thuần chuỗi dòng SSE Anthropic → list event (không network) — dùng cho test scripted."""
    state = _TurnState()
    events: list[AgentEvent] = []
    for line in lines:
        chunk = parse_sse_chunk(line)
        if chunk is None:
            continue
        event = _apply_chunk(chunk, state)
        if event is not None:
            events.append(event)
    events.append(_terminal_event(state))
    return events


class AnthropicCompatAdapter:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.AsyncClient | None = None,
        temperature: float | None = None,
        thinking: str | None = None,
        reasoning_effort: str | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/v1/messages"
        self._api_key = api_key
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
        self._temperature = temperature
        self._thinking = thinking
        self._reasoning_effort = reasoning_effort

    def _payload(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "system": _build_system(system),
            "messages": _convert_messages(messages),
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            payload["tools"] = _convert_tools(tools)
        if self._temperature is not None:
            payload["temperature"] = self._temperature
        if self._thinking == "enabled":  # mặc định disabled → KHÔNG gửi field (§3.4)
            payload["thinking"] = {"type": "enabled", "budget_tokens": _thinking_budget(self._reasoning_effort)}
        return payload

    async def _read_stream(
        self, response: httpx.Response, state: _TurnState
    ) -> AsyncIterator[TokenEvent]:
        """Đọc SSE của 1 lượt, yield token text, tích luỹ tool_use/usage/stop_reason/reasoning vào state."""
        async for line in response.aiter_lines():
            chunk = parse_sse_chunk(line)
            if chunk is None:
                continue
            event = _apply_chunk(chunk, state)
            if event is not None:
                yield event

    async def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]:
        payload = self._payload(system, messages, tools, max_tokens)
        headers = {
            "x-api-key": self._api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        emitted_token = False
        state = _TurnState()

        for attempt in range(MAX_RETRIES + 1):
            state = _TurnState()  # reset mỗi attempt: retry không kế thừa mảnh tool-call dở
            try:
                async with self._client.stream("POST", self._url, json=payload, headers=headers) as response:
                    if response.status_code in RETRY_STATUS and not emitted_token and attempt < MAX_RETRIES:
                        await asyncio.sleep(2**attempt)
                        continue
                    if response.status_code >= 400:
                        await response.aread()
                        logger.error("Provider trả lỗi status=%s", response.status_code)
                        yield ErrorEvent(message="Hệ thống AI đang quá tải, thử lại sau ít phút.")
                        return
                    async for event in self._read_stream(response, state):
                        emitted_token = True
                        yield event
                break
            except (httpx.TimeoutException, httpx.TransportError):
                if emitted_token or attempt >= MAX_RETRIES:
                    logger.exception("Mất kết nối tới provider")
                    yield ErrorEvent(message="Mất kết nối tới hệ thống AI. Vui lòng thử lại.")
                    return
                await asyncio.sleep(2**attempt)

        yield _terminal_event(state)
