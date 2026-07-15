from pydantic import BaseModel, Field


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
