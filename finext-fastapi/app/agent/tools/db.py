"""tool generic — model tự viết query, luật do policy quyết (doc 02 §4.1)."""

import json
import re
from typing import Any

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

DB_FIND_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_find",
        "description": (
            "Đọc document từ agent_db. Luôn kèm projection để chỉ lấy field cần thiết. "
            "Với collection lớn phải lọc theo khoá chính (ví dụ ticker)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string", "description": "Tên collection trong agent_db"},
                "filter": {"type": "object", "description": "Điều kiện lọc kiểu MongoDB"},
                "projection": {"type": "object", "description": 'Field cần lấy, ví dụ {"ticker": 1, "price": 1}'},
                "sort": {"type": "array", "items": {"type": "array"}, "description": 'Ví dụ [["date", -1]]'},
                "limit": {"type": "integer", "description": "Số doc tối đa"},
            },
            "required": ["collection"],
        },
    },
}

DB_AGGREGATE_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_aggregate",
        "description": "Chạy aggregation pipeline trên agent_db để tính thống kê (trung bình, xếp hạng, tổng hợp).",
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string"},
                "pipeline": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["collection", "pipeline"],
        },
    },
}

# --- Sửa quirk M3: bọc SỐ thành CHUỖI / bẻ MẢNG thành DICT ở vị trí không bao giờ hợp lệ chuỗi số ---
# M3 (eval production) gửi "25"/"-1" thay số, bẻ đối số mảng của $slice/$arrayElemAt thành dict, và nhét
# cả cặp key:value vào KEY của $project. Model không tự sửa nổi dù nhận đúng thông điệp lỗi → mỗi câu đốt
# 2-7 vòng rồi cầu dao ép bỏ cuộc. Ta ép TẠI CHỖ, chỉ ở vị trí mà chuỗi số KHÔNG BAO GIỜ là giá trị hợp lệ.
# TUYỆT ĐỐI không đụng: so-sánh-bằng ("ticker": "HPG"), tham chiếu "$field", $text, mọi chuỗi không thuần số.

# "Chuỗi số" = thuần số (âm/thập phân được) sau khi strip. Value rỗng "" KHÔNG khớp (quan trọng cho key-mangle).
_NUM_RE = re.compile(r"^-?\d+(\.\d+)?$")
_CMP_OPS = {"$gt", "$gte", "$lt", "$lte"}


def _is_num_str(v: Any) -> bool:
    """True nếu v là chuỗi thuần số (M3 hay bọc số thành chuỗi)."""
    return isinstance(v, str) and bool(_NUM_RE.match(v.strip()))


def _to_int(v: Any) -> Any:
    """Chuỗi số → int. Dùng cho vị trí LUÔN là số nguyên: limit, hướng sort, chỉ số $slice/$arrayElemAt."""
    return int(float(v.strip())) if _is_num_str(v) else v


def _to_num(v: Any) -> Any:
    """Chuỗi số → number (int nếu nguyên, float nếu có phần thập phân). Dùng cho ngưỡng $gt/$gte/$lt/$lte."""
    if not _is_num_str(v):
        return v
    s = v.strip()
    return float(s) if "." in s else int(s)


def _unmangle_index_dict(d: dict[str, Any]) -> Any:
    """M3 bẻ đối số MẢNG của $slice/$arrayElemAt thành dict — số nằm ở KEY, value rỗng.

    {"item": X, "<chuỗi số>": ""} → [X, int]   (đối số mảng [mảng, chỉ số])
    {"<chuỗi số>": ""}            → int         (chỉ còn chỉ số)
    Không khớp dạng nào → giữ nguyên dict để nhánh khác/validator xử lý.
    """
    if "item" in d and len(d) == 2:
        (k,) = [key for key in d if key != "item"]
        if _is_num_str(k) and d[k] == "":
            return [d["item"], _to_int(k)]
    elif len(d) == 1:
        (k,) = d
        if _is_num_str(k) and d[k] == "":
            return _to_int(k)
    return d


def _coerce_index_expr(v: Any) -> Any:
    """Chuẩn hoá đối số $slice/$arrayElemAt: chuỗi số → int, mảng → phần tử số hoá, dict-bẻ-mảng → mảng."""
    if _is_num_str(v):
        return _to_int(v)
    if isinstance(v, list):
        return [_to_int(e) for e in v]
    if isinstance(v, dict):
        return _unmangle_index_dict(v)
    return v


def _coerce_expr(node: Any) -> Any:
    """Đệ quy chuẩn hoá biểu thức Mongo ở MỌI độ sâu (gồm $and/$or lồng nhau).

    Chỉ ép ở vị trí chuỗi số không bao giờ hợp lệ: ngưỡng $gt/$gte/$lt/$lte và đối số $slice/$arrayElemAt.
    Giữ nguyên "$field", so-sánh-bằng, $text và mọi chuỗi khác.
    """
    if isinstance(node, list):
        return [_coerce_expr(e) for e in node]
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for k, v in node.items():
            if k in _CMP_OPS and _is_num_str(v):
                out[k] = _to_num(v)
            elif k in ("$slice", "$arrayElemAt"):
                # Bóc dict-bẻ-mảng ở tầng này trước, rồi đệ quy để bắt biểu thức lồng bên trong.
                out[k] = _coerce_expr(_coerce_index_expr(v))
            else:
                out[k] = _coerce_expr(v)
        return out
    return node


def _unmangle_key(key: str, value: Any) -> tuple[str, Any] | None:
    """M3 nhét cả cặp 'key: value' vào KEY của projection/$project, value để rỗng ("").

    Ví dụ: key = 'recent_4q: {"$slice": ["$arr", -4]}', value = "" → ('recent_4q', {"$slice": [...]}).
    Không phải chuỗi / không có ':' / không khôi phục được → None (giữ nguyên cặp cũ).
    """
    if not isinstance(key, str) or value != "" or ":" not in key:
        return None
    # Dạng 1: model giữ dấu nháy của key ('"k": v') → bọc ngoặc nhọn là JSON hợp lệ ngay.
    try:
        parsed = json.loads("{" + key + "}")
    except ValueError:
        parsed = None
    if isinstance(parsed, dict) and len(parsed) == 1:
        return next(iter(parsed.items()))
    # Dạng 2: key không có dấu nháy ('recent_4q: {...}') → tách ở ':' đầu, phần phải là JSON value.
    left, _, right = key.partition(":")
    left = left.strip()
    try:
        return (left, json.loads(right)) if left else None
    except ValueError:
        return None


def _coerce_projection_value(v: Any) -> Any:
    """Giá trị projection: '0'/'1' → int; dict/list → chuẩn hoá $slice/$arrayElemAt bên trong.

    KHÔNG đụng chuỗi khác — "$field" là biểu thức hợp lệ trong $project.
    """
    if isinstance(v, str) and v.strip() in ("0", "1"):
        return int(v.strip())
    if isinstance(v, (dict, list)):
        return _coerce_expr(v)
    return v


def _coerce_projection(proj: Any) -> Any:
    """Chuẩn hoá projection/$project: '0'/'1' → int, đối số $slice/$arrayElemAt, và key-mangle."""
    if not isinstance(proj, dict):
        return proj
    out: dict[str, Any] = {}
    for k, v in proj.items():
        pair = _unmangle_key(k, v)
        if pair is not None:
            k, v = pair
        out[k] = _coerce_projection_value(v)
    return out


def _coerce_sort_arg(sort: Any) -> Any:
    """sort của db_find là list [field, hướng]; hướng là chuỗi số → int (M3 hay bọc '-1')."""
    if not isinstance(sort, list):
        return sort
    return [[_to_int(e) for e in item] if isinstance(item, list) else item for item in sort]


async def run_db_find(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    # Ép quirk M3 theo từng vị trí trước khi tới gateway (filter/projection/sort/limit).
    filter_ = args.get("filter")
    projection = args.get("projection")
    return await gateway.find(
        ctx,
        collection=args["collection"],
        filter=_coerce_expr(filter_) if isinstance(filter_, (dict, list)) else filter_,
        projection=_coerce_projection(projection) if isinstance(projection, dict) else projection,
        sort=_coerce_sort_arg(args.get("sort")),
        limit=_to_int(args.get("limit")),
    )


def _repair_stage(stage: Any) -> Any:
    """M3 đôi khi bọc stage thành {"$text": "<chuỗi JSON>"} hoặc gửi thẳng chuỗi JSON.

    $text không bao giờ là stage hợp lệ ở cấp cao nhất của pipeline Mongo, nên bóc ra
    parse lại là an toàn tuyệt đối. Parse hỏng thì giữ nguyên cho validator báo lỗi.
    """
    raw: str | None = None
    if isinstance(stage, str):
        raw = stage
    elif isinstance(stage, dict) and set(stage) == {"$text"} and isinstance(stage["$text"], str):
        raw = stage["$text"]
    if raw is None:
        return stage
    try:
        parsed = json.loads(raw.strip())
    except ValueError:
        return stage
    return parsed if isinstance(parsed, dict) else stage


def _coerce_stage(stage: Any) -> Any:
    """Chuẩn hoá 1 stage aggregate (SAU _repair_stage). Chỉ ép vị trí chuỗi số không bao giờ hợp lệ."""
    if not isinstance(stage, dict):
        return stage
    out: dict[str, Any] = {}
    for k, v in stage.items():
        if k in ("$limit", "$skip"):
            out[k] = _to_int(v)
        elif k == "$sort":
            out[k] = {sk: _to_int(sv) for sk, sv in v.items()} if isinstance(v, dict) else v
        elif k == "$project":
            out[k] = _coerce_projection(v)
        else:
            # $match và mọi stage/toán tử biểu thức khác — truyền CẢ key để _coerce_expr thấy
            # $slice/$arrayElemAt/$gt... (M3 có khi để $slice ngay ở cấp stage), bắt cả lồng sâu.
            out.update(_coerce_expr({k: v}))
    return out


async def run_db_aggregate(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    pipeline = args["pipeline"]
    # Chuẩn hoá quirk của model: bóc stage bị bọc {"$text": ...} / chuỗi JSON, rồi ép kiểu theo vị trí.
    # Không phải list thì giữ nguyên để đường lỗi sẵn có (gateway/validator) xử lý.
    if isinstance(pipeline, list):
        pipeline = [_coerce_stage(_repair_stage(stage)) for stage in pipeline]
    return await gateway.aggregate(ctx, collection=args["collection"], pipeline=pipeline)
