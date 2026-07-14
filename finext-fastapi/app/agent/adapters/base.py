"""Seam duy nhất phụ thuộc provider (doc 02 §6)."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

from app.agent.events import AgentEvent


@dataclass
class SystemBlock:
    text: str
    cache_hint: bool = False  # provider nào hỗ trợ thì dùng; không thì bỏ qua (chỉ ảnh hưởng CHI PHÍ)


class ModelAdapter(Protocol):
    def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]: ...
