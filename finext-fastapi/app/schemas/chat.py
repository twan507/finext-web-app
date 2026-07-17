from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.utils.types import PyObjectId


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)  # client-held transcript
    thinking: bool = False  # user bật "suy nghĩ sâu" (M3 thinking=adaptive) — chậm hơn nhưng câu gọn/kỹ hơn


# ── Persistence / REST (Bước 3) ─────────────────────────────────────────
class ToolCallMeta(BaseModel):
    name: str
    args_summary: str = ""
    ok: bool = True
    ms: int = 0


class ConversationSummary(BaseModel):
    id: PyObjectId = Field(alias="_id")
    title: str
    created_at: datetime
    updated_at: datetime
    msg_count: int = 0
    pinned: bool = False

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ConversationPinRequest(BaseModel):
    pinned: bool


class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class MessagePublic(BaseModel):
    id: PyObjectId = Field(alias="_id")
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[ToolCallMeta] = Field(default_factory=list)
    usage: dict[str, int] | None = None
    interrupted: bool = False
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ConversationDetail(ConversationSummary):
    messages: list[MessagePublic] = Field(default_factory=list)
