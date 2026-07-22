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
from app.crud.chat_suggestions import sample_suggestions


async def chat_suggestions(**kwargs) -> Dict[str, Any]:
    """Trả {"questions": [5 câu]} bốc NGẪU NHIÊN từ kho ~10 câu của nhịp sinh mới nhất.

    Bốc ở backend (không phải frontend) để tránh hydration mismatch: server render sao thì
    client thấy đúng vậy, không có cảnh nhấp nháy đổi câu sau khi mount.
    Luôn có dữ liệu — rơi về hằng số tĩnh nếu chưa sinh được bộ nào.
    """
    db = get_database("user_db")
    return {"questions": await sample_suggestions(db)}
