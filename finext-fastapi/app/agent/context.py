"""Lắp system prompt: pack (data) + briefing. Server chỉ GHÉP, không hiểu nội dung (doc 02 §5)."""

import logging
import time
from pathlib import Path
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.core.config import AGENT_PACK_DIR

logger = logging.getLogger(__name__)

PACK_STUB_DIR = Path(__file__).parent / "pack_stub"
BRIEFING_TTL_SECONDS = 600
MAX_BRIEFING_BYTES = 6_000

_briefing_cache: dict[str, Any] = {"at": 0.0, "text": None, "as_of": None}

FRESHNESS_NOTE = (
    "Mốc dữ liệu: {as_of}. Trong giờ giao dịch, giá/khối lượng cập nhật gần realtime; "
    "riêng dữ liệu PHASE chốt cuối ngày (có thể trễ 1 phiên)."
)
NO_BRIEFING_NOTE = "Hiện chưa có bản tin tổng hợp — hãy chủ động query dữ liệu khi cần."


def _read_pack() -> str:
    pack_dir = Path(AGENT_PACK_DIR) if AGENT_PACK_DIR else PACK_STUB_DIR
    if not pack_dir.is_dir():
        logger.error("Không tìm thấy AGENT_PACK_DIR=%s — dùng pack stub", pack_dir)
        pack_dir = PACK_STUB_DIR
    files = sorted(pack_dir.glob("*.md"))
    logger.info("Nạp pack từ %s (%d file)", pack_dir, len(files))
    return "\n\n".join(f.read_text(encoding="utf-8") for f in files)


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
    blocks = [SystemBlock(text=_read_pack(), cache_hint=True)]
    briefing, as_of = await _read_briefing(gateway, ctx)
    if briefing is None:
        blocks.append(SystemBlock(text=NO_BRIEFING_NOTE, cache_hint=True))
        return blocks, None
    blocks.append(
        SystemBlock(text=f"{briefing}\n\n{FRESHNESS_NOTE.format(as_of=as_of)}", cache_hint=True)
    )
    return blocks, as_of
