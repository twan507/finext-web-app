"""Lắp system prompt: pack (data) + briefing. Server chỉ GHÉP, không hiểu nội dung (doc 02 §5)."""

import logging
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

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

# Nhận thức thời gian: LLM không biết "bây giờ" — server tính giờ VN + trạng thái phiên rồi tiêm vào.
# Phiên HOSE ~9:00–15:00 (gồm ATC). Phân biệt realtime-trong-phiên vs giá-đóng-cửa-chốt (bug model tưởng đã đóng cửa).
_VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_OPEN_MIN, _CLOSE_MIN = 9 * 60, 15 * 60


def _as_of_date(as_of: str | None) -> date | None:
    if not as_of:
        return None
    s = str(as_of)
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _session_note(as_of: str | None) -> str:
    """Diễn giải trạng thái phiên từ giờ VN hiện tại + so as_of với hôm nay (bắt cả cuối tuần/nghỉ lễ)."""
    now = datetime.now(_VN_TZ)
    now_str, hhmm = now.strftime("%d/%m/%Y %H:%M"), now.strftime("%H:%M")
    minutes = now.hour * 60 + now.minute
    weekend = now.weekday() >= 5
    same_day = (_as_of_date(as_of) == now.date()) if _as_of_date(as_of) is not None else None
    lbl = as_of or "phiên gần nhất"

    if weekend:
        s = f"Hôm nay {now_str} là CUỐI TUẦN — thị trường nghỉ, không giao dịch. Số liệu là của phiên gần nhất ({lbl}); đừng nói 'hôm nay' cho các số này."
    elif _OPEN_MIN <= minutes < _CLOSE_MIN and same_day is not False:
        s = (
            f"Bây giờ {now_str} — thị trường ĐANG TRONG PHIÊN. Giá/chỉ số/khối lượng là số REALTIME TẠM TÍNH lúc {hhmm}, "
            f"CHƯA phải giá đóng cửa. Diễn đạt 'hiện tại / tạm tính lúc {hhmm}', TUYỆT ĐỐI không nói 'đóng cửa'. "
            "Thanh khoản/khối lượng là lũy kế tới giờ này, còn tăng tới hết phiên."
        )
    elif minutes < _OPEN_MIN:
        s = f"Bây giờ {now_str} — CHƯA MỞ CỬA phiên hôm nay. Số liệu đang có là của phiên giao dịch gần nhất ({lbl})."
    elif minutes >= _CLOSE_MIN and same_day:
        s = f"Bây giờ {now_str} — phiên hôm nay ĐÃ ĐÓNG CỬA. Giá đóng cửa {lbl} là số chính thức."
    else:
        s = (
            f"Bây giờ {now_str}, nhưng dữ liệu mới nhất là phiên {lbl} (không phải hôm nay) — có thể hôm nay là NGÀY NGHỈ LỄ "
            "hoặc phiên hôm nay chưa có dữ liệu. Trình bày số liệu là của phiên gần nhất, đừng khẳng định 'hôm nay'."
        )
    return "THỜI GIAN & PHIÊN GIAO DỊCH (server tính theo giờ VN — tin cậy hơn suy đoán, LUÔN tuân theo): " + s


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
        blocks.append(SystemBlock(text=_session_note(None), cache_hint=False))  # đổi mỗi request → không cache
        return blocks, None
    blocks.append(
        SystemBlock(text=f"{briefing}\n\n{FRESHNESS_NOTE.format(as_of=as_of)}", cache_hint=True)
    )
    blocks.append(SystemBlock(text=_session_note(as_of), cache_hint=False))  # đổi mỗi request → không cache
    return blocks, as_of
