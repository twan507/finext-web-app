"""Lắp system prompt: pack (data) + briefing. Server chỉ GHÉP, không hiểu nội dung (doc 02 §5)."""

import logging
import time
from pathlib import Path
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.agent.tools.kb import KB_DIR

logger = logging.getLogger(__name__)

PACK_STUB_DIR = Path(__file__).parent / "pack_stub"
RESIDENT_DOCS = ["system_prompt", "agent_db_01", "agent_db_02"]
BRIEFING_TTL_SECONDS = 600
MAX_BRIEFING_BYTES = 6_000

_briefing_cache: dict[str, Any] = {"at": 0.0, "text": None, "as_of": None}

FRESHNESS_NOTE = (
    "Mốc dữ liệu: {as_of}. Trong giờ giao dịch, giá/khối lượng cập nhật gần realtime; "
    "riêng dữ liệu PHASE chốt cuối ngày (có thể trễ 1 phiên)."
)
NO_BRIEFING_NOTE = "Hiện chưa có bản tin tổng hợp — hãy chủ động query dữ liệu khi cần."


def _read_resident() -> str:
    """Nối 3 tài liệu thường trực. Thiếu file thật → fallback pack stub (CI/dev)."""
    parts: list[str] = []
    missing: list[str] = []
    for name in RESIDENT_DOCS:
        path = KB_DIR / f"{name}.md"
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8"))
        else:
            missing.append(name)
    if not parts:
        logger.warning("KB resident trống tại %s — fallback pack stub", KB_DIR)
        return "\n\n".join(f.read_text(encoding="utf-8") for f in sorted(PACK_STUB_DIR.glob("*.md")))
    if missing:
        logger.warning("KB resident THIẾU tài liệu %s tại %s — system prompt nạp thiếu", missing, KB_DIR)
    logger.info("Nạp resident %d/%d tài liệu từ %s", len(parts), len(RESIDENT_DOCS), KB_DIR)
    return "\n\n".join(parts)


async def _read_briefing(gateway: GatewayProtocol, ctx: GatewayContext) -> tuple[str | None, str | None]:
    now = time.time()
    if _briefing_cache["text"] is not None and now - _briefing_cache["at"] < BRIEFING_TTL_SECONDS:
        return _briefing_cache["text"], _briefing_cache["as_of"]

    result = await gateway.find(ctx, "data_briefing", filter={"type": "core"}, limit=1)
    if not result.ok or not result.data:
        logger.warning("Không đọc được data_briefing — chạy không có briefing (doc 02 §5.2 case 2)")
        return None, None

    doc = result.data[0]
    as_of = doc.get("as_of")
    text = str(doc)[:MAX_BRIEFING_BYTES]
    _briefing_cache.update({"at": now, "text": text, "as_of": as_of})
    return text, as_of


async def build_system_blocks(
    gateway: GatewayProtocol, ctx: GatewayContext
) -> tuple[list[SystemBlock], str | None]:
    blocks = [SystemBlock(text=_read_resident(), cache_hint=True)]
    briefing, as_of = await _read_briefing(gateway, ctx)
    if briefing is None:
        blocks.append(SystemBlock(text=NO_BRIEFING_NOTE, cache_hint=True))
        return blocks, None
    blocks.append(
        SystemBlock(text=f"{briefing}\n\n{FRESHNESS_NOTE.format(as_of=as_of)}", cache_hint=True)
    )
    return blocks, as_of
