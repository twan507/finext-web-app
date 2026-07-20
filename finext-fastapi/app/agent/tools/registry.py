"""Dispatch tool call. KHÔNG BAO GIỜ raise — lỗi trả về dạng text cho model tự sửa (doc 02 §4.2)."""

import json
import logging
from typing import Any

from app.agent.events import ToolCall
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.core.database import get_database

from .db import DB_AGGREGATE_SCHEMA, DB_FIND_SCHEMA, run_db_aggregate, run_db_find
from .db_stats import DB_STATS_SCHEMA, run_db_stats
from .kb import READ_KB_SCHEMA, read_kb_doc
from .shrink import shrink_note, shrink_result
from .user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

logger = logging.getLogger(__name__)

# get_my_watchlist tạm gỡ khỏi tool surface tới khi tích hợp watchlist thật (schema stock_symbols/multi-doc) — code giữ nguyên để nối lại
TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA, DB_STATS_SCHEMA, READ_KB_SCHEMA]

# Nâng từ 12.000: trần cũ cắt mất 5/9 kỳ báo cáo của một truy vấn thường gặp. Thêm 12.000
# ký tự ≈ 3.000 token ≈ 0,0009 USD, so với 0,039 USD một lượt — rẻ hơn nhiều so với việc
# model không có dữ liệu rồi bịa số.
MAX_TOOL_RESULT_CHARS = 24_000
# Chừa chỗ cho [GHI CHÚ NỘI BỘ] nối SAU phần JSON, để trần ngân sách ở loop.py không cắt mất nó.
_NOTE_RESERVE = 800
_OVERSIZE_MSG = (
    "Kết quả quá lớn nên không trả được. Hãy giảm số phần tử $slice (ví dụ -20) "
    "hoặc projection ít field hơn (chỉ các field thật sự cần)."
)

_HANDLERS = {"db_find": run_db_find, "db_aggregate": run_db_aggregate, "db_stats": run_db_stats}


async def execute_tool(
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    call: ToolCall,
    *,
    max_chars: int = MAX_TOOL_RESULT_CHARS,
) -> tuple[str, dict[str, Any]]:
    """Trả (content cho model, meta cho event tool_end)."""
    if call.arg_error is not None:
        # Adapter báo arguments model gửi hỏng JSON → cho model feedback ĐÚNG (thay vì "thiếu collection"
        # sai lệch khiến model retry y hệt), gợi ý dùng db_find đơn giản để tránh JSON dài dễ sai.
        return (
            f"Lỗi: {call.arg_error}. Hãy gọi lại với JSON hợp lệ. "
            "Nếu chỉ cần xếp hạng/so sánh, ưu tiên db_find (sort + limit) thay cho db_aggregate nhiều tầng.",
            {"ok": False, "ms": 0},
        )

    if call.name == "get_my_watchlist":
        try:
            result = await run_get_my_watchlist(get_database("user_db"), gateway, ctx, call.arguments)
        except Exception:
            logger.exception("Tool get_my_watchlist lỗi")
            return "Không đọc được danh sách theo dõi.", {"ok": False, "ms": 0}
        meta = {"ok": result.ok, "ms": result.meta.get("ms", 0)}
        if not result.ok:
            return result.error or "Không đọc được danh sách theo dõi.", meta
        return json.dumps(result.data, ensure_ascii=False, default=str), meta

    if call.name == "read_kb":
        args = call.arguments if isinstance(call.arguments, dict) else {}
        content, ok = read_kb_doc(args.get("doc"))
        return content, {"ok": ok, "ms": 0}

    handler = _HANDLERS.get(call.name)
    if handler is None:
        return f"Tool '{call.name}' không tồn tại.", {"ok": False, "ms": 0}

    # arguments đến từ json.loads của model -> có thể là None/list/scalar; chuẩn hoá để không raise.
    args = call.arguments if isinstance(call.arguments, dict) else {}
    if not args.get("collection"):
        return "Thiếu tham số bắt buộc 'collection'.", {"ok": False, "ms": 0}

    try:
        result = await handler(gateway, ctx, args)
    except KeyError as exc:
        return f"Thiếu tham số bắt buộc: {exc}.", {"ok": False, "ms": 0}
    except Exception:
        logger.exception("Tool %s lỗi không mong đợi", call.name)
        return "Lỗi khi truy vấn dữ liệu. Hãy thử query khác.", {"ok": False, "ms": 0}

    meta = {
        "ok": result.ok,
        "ms": result.meta.get("ms", 0),
        # Gateway đã biết mình bỏ bớt document; trước đây cờ này bị vứt nên không ai đo được.
        "truncated": bool(result.meta.get("truncated")),
        "bytes": result.meta.get("bytes", 0),
        "shrunk": False,
    }
    if not result.ok:
        return result.error or "Query bị từ chối.", meta

    data, report = shrink_result(result.data or [], max(1, max_chars - _NOTE_RESERVE))
    meta["shrunk"] = report.shrunk
    if report.shrunk and not data:
        # Không trả rỗng CÂM: rỗng câm khiến model tưởng không có dữ liệu và lặp query vô ích.
        meta["ok"] = False
        return _OVERSIZE_MSG, meta

    content = json.dumps(data, ensure_ascii=False, default=str)
    # Note nội bộ cho MODEL. Chỉ đi vào tool-result trung gian; câu trả lời khách vẫn qua
    # sanitize nên không lộ tên field/collection.
    notes = [n for n in (shrink_note(report), result.meta.get("note")) if n]
    if notes:
        content = f"{content}\n\n[GHI CHÚ NỘI BỘ — không đọc cho khách] " + " ".join(notes)
    return content, meta
