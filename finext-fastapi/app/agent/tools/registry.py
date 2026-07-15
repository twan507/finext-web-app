"""Dispatch tool call. KHÔNG BAO GIỜ raise — lỗi trả về dạng text cho model tự sửa (doc 02 §4.2)."""

import json
import logging
from typing import Any

from app.agent.events import ToolCall
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.core.database import get_database

from .db import DB_AGGREGATE_SCHEMA, DB_FIND_SCHEMA, run_db_aggregate, run_db_find
from .kb import READ_KB_SCHEMA, read_kb_doc
from .user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

logger = logging.getLogger(__name__)

# get_my_watchlist tạm gỡ khỏi tool surface tới khi tích hợp watchlist thật (schema stock_symbols/multi-doc) — code giữ nguyên để nối lại
TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA, READ_KB_SCHEMA]

MAX_TOOL_RESULT_CHARS = 12_000

_HANDLERS = {"db_find": run_db_find, "db_aggregate": run_db_aggregate}


async def execute_tool(
    gateway: GatewayProtocol, ctx: GatewayContext, call: ToolCall
) -> tuple[str, dict[str, Any]]:
    """Trả (content cho model, meta cho event tool_end)."""
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

    meta = {"ok": result.ok, "ms": result.meta.get("ms", 0)}
    if not result.ok:
        return result.error or "Query bị từ chối.", meta

    content = json.dumps(result.data, ensure_ascii=False, default=str)
    if len(content) > MAX_TOOL_RESULT_CHARS:
        content = content[:MAX_TOOL_RESULT_CHARS] + " …[đã cắt]"
    return content, meta
