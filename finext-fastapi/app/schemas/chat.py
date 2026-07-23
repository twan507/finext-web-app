from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.utils.types import PyObjectId


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=16000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)  # client-held transcript
    thinking: bool = False  # user bật "suy nghĩ sâu" (M3 thinking=adaptive) — chậm hơn nhưng câu gọn/kỹ hơn
    # Ngữ cảnh trang user đang xem (bubble chat gửi lên). Không hiển thị cho user, không lưu lịch sử.
    page_context: str | None = Field(default=None, max_length=2000)
    # Chế độ chat. "portfolio" = trang Tư vấn Danh mục: cần gói advanced + persona riêng + tag source.
    mode: Literal["portfolio"] | None = None


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
    source: str = "chat"  # "chat" (mặc định) | "portfolio" — hội thoại cũ thiếu field → "chat"

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
    feedback: dict | None = None  # {rating: 1|-1, reason?, at} — 👍/👎 người dùng
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class MessageFeedbackRequest(BaseModel):
    rating: Literal[1, -1]
    reason: str | None = Field(default=None, max_length=200)


class ConversationDetail(ConversationSummary):
    messages: list[MessagePublic] = Field(default_factory=list)
