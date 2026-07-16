"""Event nội bộ giữa adapter ↔ loop ↔ router. KHÔNG phải wire format (wire = doc 02 §3)."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    arg_error: str | None = None  # set khi arguments model gửi không parse được JSON — loop báo model gọi lại


@dataclass
class TokenEvent:
    text: str


@dataclass
class ToolCallsEvent:
    calls: list[ToolCall]
    reasoning_content: str | None = None


@dataclass
class DoneEvent:
    usage: dict[str, int] = field(default_factory=dict)  # {"in": N, "out": M}
    truncated: bool = False


@dataclass
class ErrorEvent:
    message: str


AgentEvent = TokenEvent | ToolCallsEvent | DoneEvent | ErrorEvent
