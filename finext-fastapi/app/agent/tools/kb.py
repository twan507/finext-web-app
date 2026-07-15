"""Tool read_kb — model đọc tài liệu KB chuyên sâu theo nhu cầu. Whitelist ĐỘNG từ thư mục kb/."""

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

KB_DIR = Path(__file__).parent.parent / "kb"
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9_-]+$")
MAX_KB_CHARS = 60_000  # KB là tài liệu tĩnh của dự án — cap rộng, KHÁC cap 12k của db tool (chống exfil Mongo)

READ_KB_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "read_kb",
        "description": (
            "Đọc tài liệu phương pháp luận nội bộ (KB) khi cần chiều sâu diễn giải/anti-pattern/tin tức/phase. "
            "Xem manifest trong system prompt để biết tài liệu nào đọc khi nào. "
            "Tham số `doc` là tên tài liệu (ví dụ 'agent_db_04'), KHÔNG kèm đuôi .md."
        ),
        "parameters": {
            "type": "object",
            "properties": {"doc": {"type": "string", "description": "Tên tài liệu KB, ví dụ agent_db_05"}},
            "required": ["doc"],
        },
    },
}


def list_kb_docs() -> list[str]:
    if not KB_DIR.is_dir():
        return []
    return sorted(p.stem for p in KB_DIR.glob("*.md"))


def read_kb_doc(name: Any) -> tuple[str, bool]:
    """Trả (nội dung, True) nếu đọc được; (text lỗi liệt kê tài liệu, False) nếu tên không hợp lệ/không có."""
    docs = list_kb_docs()
    if not isinstance(name, str) or not _SAFE_NAME.match(name) or name not in docs:
        available = ", ".join(docs) or "(trống)"
        return f"Không có tài liệu '{name}'. Tài liệu khả dụng: {available}.", False
    try:
        text = (KB_DIR / f"{name}.md").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        logger.warning("read_kb không đọc được doc=%s", name)
        return f"Không đọc được tài liệu '{name}'. Hãy thử tài liệu khác.", False
    if len(text) > MAX_KB_CHARS:
        text = text[:MAX_KB_CHARS] + "\n\n…[tài liệu dài, đã cắt — hỏi cụ thể hơn nếu cần phần sau]"
    logger.info("read_kb doc=%s chars=%d", name, len(text))
    return text, True
