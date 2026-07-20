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


def _repair_tool_json(raw: str, max_fix: int = 6) -> dict[str, Any] | None:
    """Vá lỗi JSON hay gặp của LLM: object phần tử mảng chưa đóng trước ', {' (thiếu '}' ở pipeline dài).

    CHỈ chèn '}' (đóng ngoặc) trước dấu phẩy liền trước lỗi, KHÔNG đổi key/value; re-parse mỗi vòng nên
    kết quả BẮT BUỘC json.loads được. An toàn 2 lớp: (1) phải parse ra dict; (2) query vá xong vẫn đi qua
    validator gateway (chặn ngữ nghĩa). Trả dict nếu vá được, None nếu không (khi đó báo model gọi lại).
    """
    s = raw
    for _ in range(max_fix):
        try:
            parsed = json.loads(s)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError as exc:
            # Chữ ký: đang chờ tên property nhưng gặp '{' → một object phần tử mảng chưa được đóng.
            if "property name" in exc.msg and exc.pos < len(s) and s[exc.pos] == "{":
                comma = s.rfind(",", 0, exc.pos)
                if comma == -1:
                    return None
                s = s[:comma] + "}" + s[comma:]
                continue
            return None
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
            arg_error: str | None = None
            try:
                arguments = json.loads(slot["arguments"]) if slot["arguments"] else {}
            except json.JSONDecodeError as exc:
                # Model (DeepSeek) đôi khi nhả JSON tool-args hỏng ở pipeline dài (thiếu dấu ngoặc).
                # Thử vá an toàn trước (chỉ chèn '}', re-parse + vẫn qua validator gateway); vá không được
                # thì báo model gọi lại (execute_tool đọc arg_error).
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

    buffer: _ToolCallBuffer = field(default_factory=_ToolCallBuffer)
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str | None = None
    reasoning: str = ""


class OpenAICompatAdapter:
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
        self._url = f"{base_url.rstrip('/')}/chat/completions"
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
        if self._temperature is not None:
            payload["temperature"] = self._temperature
        if self._thinking is not None:
            payload["thinking"] = {"type": self._thinking}
            if self._thinking == "enabled" and self._reasoning_effort is not None:
                payload["reasoning_effort"] = self._reasoning_effort
        return payload

    async def _read_stream(
        self, response: httpx.Response, state: _TurnState
    ) -> AsyncIterator[TokenEvent]:
        """Đọc SSE của 1 lượt, yield token content, tích luỹ tool-call/usage/finish/reasoning vào state."""
        async for line in response.aiter_lines():
            chunk = parse_sse_chunk(line)
            if chunk is None:
                continue
            usage = chunk.get("usage")
            if usage:
                # QUY ƯỚC USAGE CHUNG CHO MỌI ADAPTER (đừng đổi nếu chưa đọc cả 2 file adapter):
                #   "in"         = TỔNG token đầu vào của vòng, ĐÃ BAO GỒM phần đọc từ cache.
                #   "cache_read" = phần trong "in" là cache hit (tập con của "in", giá rẻ hơn).
                # Wire OpenAI-compat đã đúng ngữ nghĩa này sẵn: prompt_tokens ĐÃ GỒM cached_tokens
                # (khác wire Anthropic — xem anthropic_compat._apply_chunk).
                state.usage = {
                    "in": usage.get("prompt_tokens", 0),
                    "out": usage.get("completion_tokens", 0),
                }
                details = usage.get("prompt_tokens_details") or {}
                # Chỉ đặt khoá khi nhà cung cấp THẬT SỰ trả về — thiếu khoá ≠ cache_read = 0.
                if isinstance(details, dict) and "cached_tokens" in details:
                    state.usage["cache_read"] = int(details.get("cached_tokens") or 0)
            for choice in chunk.get("choices") or []:
                delta = choice.get("delta") or {}
                if delta.get("content"):
                    yield TokenEvent(text=delta["content"])
                if delta.get("reasoning_content"):
                    state.reasoning += delta["reasoning_content"]
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
            yield ToolCallsEvent(
                calls=state.buffer.flush(), reasoning_content=state.reasoning or None, usage=state.usage
            )
            return
        yield DoneEvent(usage=state.usage, truncated=state.finish_reason == "length")
