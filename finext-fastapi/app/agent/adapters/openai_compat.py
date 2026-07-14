"""Adapter chuẩn OpenAI-compat — phủ DeepSeek/OpenRouter/Groq/vLLM… Đổi nhà = đổi env (doc 02 §6)."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.agent.events import AgentEvent, DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent

from .base import SystemBlock

logger = logging.getLogger(__name__)

RETRY_STATUS = {408, 429, 500, 502, 503, 504, 529}
MAX_RETRIES = 2
REQUEST_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)


def parse_sse_chunk(line: str) -> dict[str, Any] | None:
    """Trả payload JSON của 1 dòng SSE, hoặc None nếu là comment/[DONE]/dòng rỗng."""
    if not line.startswith("data: "):
        return None
    payload = line[len("data: ") :].strip()
    if not payload or payload == "[DONE]":
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        logger.warning("Bỏ qua chunk SSE không parse được từ provider")
        return None


class _ToolCallBuffer:
    """Tích luỹ tool_call theo index — arguments về theo mảnh JSON string."""

    def __init__(self) -> None:
        self._calls: dict[int, dict[str, str]] = {}

    def add(self, delta_calls: list[dict[str, Any]]) -> None:
        for item in delta_calls:
            index = item.get("index", 0)
            slot = self._calls.setdefault(index, {"id": "", "name": "", "arguments": ""})
            if item.get("id"):
                slot["id"] = item["id"]
            function = item.get("function") or {}
            if function.get("name"):
                slot["name"] = function["name"]
            if function.get("arguments"):
                slot["arguments"] += function["arguments"]

    def flush(self) -> list[ToolCall]:
        calls: list[ToolCall] = []
        for index in sorted(self._calls):
            slot = self._calls[index]
            try:
                arguments = json.loads(slot["arguments"]) if slot["arguments"] else {}
            except json.JSONDecodeError:
                logger.warning("Tool call arguments không phải JSON hợp lệ — trả dict rỗng cho loop xử lý")
                arguments = {}
            calls.append(ToolCall(id=slot["id"], name=slot["name"], arguments=arguments))
        return calls


@dataclass
class _TurnState:
    """State tích luỹ trong 1 lượt stream — reset mỗi attempt để retry không dính mảnh cũ."""

    buffer: _ToolCallBuffer = field(default_factory=_ToolCallBuffer)
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str | None = None


class OpenAICompatAdapter:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    def _payload(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> dict[str, Any]:
        system_messages = [{"role": "system", "content": block.text} for block in system]
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": system_messages + messages,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if tools:
            payload["tools"] = tools
        return payload

    async def _read_stream(
        self, response: httpx.Response, state: _TurnState
    ) -> AsyncIterator[TokenEvent]:
        """Đọc SSE của 1 lượt, yield token content, tích luỹ tool-call/usage/finish vào state."""
        async for line in response.aiter_lines():
            chunk = parse_sse_chunk(line)
            if chunk is None:
                continue
            usage = chunk.get("usage")
            if usage:
                state.usage = {
                    "in": usage.get("prompt_tokens", 0),
                    "out": usage.get("completion_tokens", 0),
                }
            for choice in chunk.get("choices") or []:
                delta = choice.get("delta") or {}
                if delta.get("content"):
                    yield TokenEvent(text=delta["content"])
                if delta.get("tool_calls"):
                    state.buffer.add(delta["tool_calls"])
                if choice.get("finish_reason"):
                    state.finish_reason = choice["finish_reason"]

    async def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]:
        payload = self._payload(system, messages, tools, max_tokens)
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
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

        if state.finish_reason == "tool_calls":
            yield ToolCallsEvent(calls=state.buffer.flush())
            return
        yield DoneEvent(usage=state.usage)
