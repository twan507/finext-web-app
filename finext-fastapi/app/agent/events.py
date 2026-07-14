"""Event nội bộ giữa adapter ↔ loop ↔ router. KHÔNG phải wire format (wire = doc 02 §3)."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class TokenEvent:
    text: str


@dataclass
class ToolCallsEvent:
    calls: list[ToolCall]


@dataclass
class DoneEvent:
    usage: dict[str, int] = field(default_factory=dict)  # {"in": N, "out": M}


@dataclass
class ErrorEvent:
    message: str


AgentEvent = TokenEvent | ToolCallsEvent | DoneEvent | ErrorEvent
