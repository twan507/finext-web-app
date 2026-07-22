"""Lưu/đọc câu hỏi gợi ý cho màn hình chat rỗng (user_db.chat_suggestions).

Mỗi lần sinh ghi một document mới; đọc lấy bản mới nhất. Giữ lịch sử để owner soi lại
đã publish gì lúc nào khi tinh chỉnh prompt. TTL tự dọn sau RETENTION_DAYS.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

SUGGESTIONS_COLLECTION = "chat_suggestions"
RETENTION_DAYS = 7

# Dùng khi chưa từng sinh được bộ nào (lần đầu deploy) hoặc TTL đã dọn sạch.
# Cố ý KHÔNG gắn thời điểm để không bao giờ bị lệch với diễn biến thị trường.
FALLBACK_SUGGESTIONS: list[str] = [
    "Thị trường hôm nay diễn biến ra sao?",
    "Nhóm ngành nào đang thu hút dòng tiền?",
    "Thị trường đang ở pha nào?",
    "Khối ngoại đang giao dịch thế nào?",
    "Cổ phiếu nào đang được quan tâm nhất?",
]


async def save_suggestions(db: Any, questions: list[str], context: dict, model: str, usage: dict) -> None:
    """Ghi một bộ gợi ý mới. Chỉ gọi sau khi đã validate."""
    now = datetime.now(timezone.utc)
    await db[SUGGESTIONS_COLLECTION].insert_one(
        {
            "questions": questions,
            "generated_at": now,
            "context": context,  # snapshot đã đưa vào LLM — để chỉnh prompt về sau
            "model": model,
            "usage": usage,
            "expires_at": now + timedelta(days=RETENTION_DAYS),
        }
    )


async def get_latest_suggestions(db: Any) -> list[str]:
    """Bộ gợi ý mới nhất. LUÔN trả về danh sách dùng được — không bao giờ rỗng."""
    try:
        doc = await db[SUGGESTIONS_COLLECTION].find_one({}, sort=[("generated_at", -1)])
    except Exception:
        logger.exception("Đọc chat_suggestions thất bại — dùng fallback")
        return list(FALLBACK_SUGGESTIONS)

    questions = (doc or {}).get("questions")
    if isinstance(questions, list) and len(questions) == 5:
        return list(questions)
    return list(FALLBACK_SUGGESTIONS)
