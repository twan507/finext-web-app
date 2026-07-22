# finext-fastapi/app/crud/sse/chat_suggestions.py
"""Keyword `chat_suggestions` — câu hỏi gợi ý cho màn hình chat rỗng.

Khác các fetcher khác trong thư mục này (đọc stock_db), fetcher này đọc user_db vì gợi ý
do chính app sinh ra.

Đặt ở registry công khai (không auth) là CÓ CHỦ Ý: frontend lấy bằng server-side render,
mà SSR không có session user nên endpoint yêu cầu auth sẽ trả 401. Nội dung là câu hỏi
thị trường chung, không nhạy cảm.
"""
from typing import Any, Dict

from app.core.database import get_database
from app.crud.chat_suggestions import get_latest_suggestions


async def chat_suggestions(**kwargs) -> Dict[str, Any]:
    """Trả {"questions": [5 câu]}. Luôn có dữ liệu — rơi về hằng số tĩnh nếu chưa sinh."""
    db = get_database("user_db")
    return {"questions": await get_latest_suggestions(db)}
