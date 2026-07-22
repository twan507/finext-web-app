"""Lưu/đọc câu hỏi gợi ý cho màn hình chat rỗng (user_db.chat_suggestions).

Mỗi lần sinh ghi một document mới; đọc lấy bản mới nhất. Giữ lịch sử để owner soi lại
đã publish gì lúc nào khi tinh chỉnh prompt. TTL tự dọn sau RETENTION_DAYS.
"""
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

SUGGESTIONS_COLLECTION = "chat_suggestions"
RETENTION_DAYS = 7

# Số câu hiển thị cho user mỗi lần vào chat. Kho lưu nhiều hơn (xem ROUNDS trong
# agent/suggestions.py) rồi bốc ngẫu nhiên để mỗi lần vào thấy khác nhau.
DISPLAY_COUNT = 5

# Dùng khi chưa từng sinh được bộ nào (lần đầu deploy) hoặc TTL đã dọn sạch.
# Cố ý KHÔNG gắn thời điểm để không bao giờ bị lệch với diễn biến thị trường.
# Nhiều hơn DISPLAY_COUNT để ngay cả lúc fallback vẫn có cảm giác đổi mới.
FALLBACK_SUGGESTIONS: list[str] = [
    "Thị trường hôm nay diễn biến ra sao?",
    "Nhóm ngành nào đang thu hút dòng tiền?",
    "Thị trường đang ở pha nào?",
    "Khối ngoại đang giao dịch thế nào?",
    "Cổ phiếu nào đang được quan tâm nhất?",
    "Nhóm ngành nào đang yếu nhất?",
    "Thanh khoản thị trường đang ra sao?",
    "Cổ phiếu nào đang phá đỉnh?",
    "Nhóm vốn hoá lớn đang vận động thế nào?",
    "Lọc giúp tôi các mã đang tăng mạnh?",
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
    """TOÀN BỘ kho gợi ý mới nhất. LUÔN trả về danh sách dùng được — không bao giờ rỗng.

    Không ép đúng một con số cụ thể: một lượt sinh có thể ra 10 câu (đủ 2 vòng) hoặc 5
    câu (vòng 2 trượt validate). Miễn đủ DISPLAY_COUNT để bốc là dùng được.
    """
    try:
        doc = await db[SUGGESTIONS_COLLECTION].find_one({}, sort=[("generated_at", -1)])
    except Exception:
        logger.exception("Đọc chat_suggestions thất bại — dùng fallback")
        return list(FALLBACK_SUGGESTIONS)

    questions = (doc or {}).get("questions")
    if isinstance(questions, list) and len(questions) >= DISPLAY_COUNT:
        return [q for q in questions if isinstance(q, str)]
    return list(FALLBACK_SUGGESTIONS)


async def sample_suggestions(db: Any, count: int = DISPLAY_COUNT) -> list[str]:
    """Bốc ngẫu nhiên `count` câu từ kho — mỗi lần user vào chat thấy một tổ hợp khác.

    Kho có ~10 câu nên số tổ hợp đủ lớn để không lặp lại cảm giác, mà vẫn chỉ tốn đúng
    một lượt sinh cho mỗi 30 phút.
    """
    pool = await get_latest_suggestions(db)
    if len(pool) <= count:
        return pool
    return random.sample(pool, count)
