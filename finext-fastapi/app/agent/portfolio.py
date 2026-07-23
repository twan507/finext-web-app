"""Chế độ tư vấn danh mục: nạp persona riêng thành 1 system block khi mode=portfolio.

Persona nằm ở `kb/system_prompt_portfolio.md` (runtime behavior, kế thừa agent_db_06). Server chỉ
GHÉP, không hiểu nội dung — cùng nguyên tắc với context.py.
"""
import logging
from pathlib import Path

from app.agent.adapters.base import SystemBlock
from app.agent.tools.kb import KB_DIR

logger = logging.getLogger(__name__)

_PORTFOLIO_DOC = "system_prompt_portfolio"

# Fallback tối thiểu khi thiếu file (CI/dev) — vẫn giữ ranh giới compliance A cốt lõi.
_FALLBACK = (
    "Chế độ tư vấn danh mục: tư vấn các mã trong danh mục user đang chọn, khung theo giai đoạn "
    "thị trường. Hỏi kĩ vị thế (đang giữ/định mua, giá vốn, mục tiêu) trước khi nhận định. "
    "Khung điều kiện, KHÔNG phát lệnh mua/bán; kèm disclaimer tham khảo."
)


def build_portfolio_block() -> SystemBlock:
    """System block persona tư vấn danh mục. cache_hint=False: append cùng nhóm non-cache với
    page_context để không phá cache-prefix của các khối thường trú (xem spec §4.2)."""
    path = KB_DIR / f"{_PORTFOLIO_DOC}.md"
    if path.is_file():
        text = path.read_text(encoding="utf-8")
    else:
        logger.warning("Thiếu %s tại %s — dùng fallback persona portfolio", _PORTFOLIO_DOC, KB_DIR)
        text = _FALLBACK
    return SystemBlock(text=text, cache_hint=False)
