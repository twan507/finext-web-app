"""EchoAdapter — giả lập LLM để test stream/nginx/FE trước khi có LLM key (doc 02 §8)."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.agent.events import AgentEvent, DoneEvent, TokenEvent

from .base import SystemBlock


class EchoAdapter:
    async def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply = f"[echo] Bạn vừa hỏi: {last_user}"
        for word in reply.split(" "):
            await asyncio.sleep(0.05)
            yield TokenEvent(text=word + " ")
        yield DoneEvent(usage={"in": 0, "out": len(reply.split())})
