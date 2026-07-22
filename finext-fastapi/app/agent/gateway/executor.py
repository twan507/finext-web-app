"""MongoGateway — chạy query đã hợp lệ qua Motor. Lớp DUY NHẤT chạm agent_db."""

import json
import logging
import math
import sys
import time
from typing import Any

from pymongo.errors import OperationFailure, PyMongoError

from .policy import Policy
from .stats_compute import (
    INTERNAL_MAX_POINTS,
    compute_stats,
    extract_series_points,
    filter_range,
)
from .types import GatewayContext, GatewayResult
from .validator import ValidationError, validate_aggregate, validate_find, validate_stats

logger = logging.getLogger(__name__)

# Lỗi trả cho model khi Motor/pymongo gặp sự cố (timeout maxTimeMS, mất kết nối...) — lỗi "dạy model" sửa.
_MONGO_ERROR_MSG = "Truy vấn dữ liệu quá thời gian hoặc gặp sự cố, hãy thử thu hẹp phạm vi truy vấn."


def _cap_bytes(docs: list[dict[str, Any]], max_kb: int) -> tuple[list[dict[str, Any]], int, bool]:
    """Cắt danh sách doc cho vừa ngân sách bytes. Trả (docs, bytes, truncated)."""
    budget = max_kb * 1024
    kept: list[dict[str, Any]] = []
    total = 0
    for doc in docs:
        size = len(json.dumps(doc, ensure_ascii=False, default=str).encode("utf-8"))
        if total + size > budget:
            return kept, total, True
        kept.append(doc)
        total += size
    return kept, total, False


def _projection_field_hint(
    projection: dict[str, Any] | None, docs: list[dict[str, Any]]
) -> str | None:
    """Note (model đọc trong tool-result) khi inclusion-projection có ≥nửa field TOP-LEVEL vắng ở MỌI doc.

    Dấu hiệu M3 chiếu SAI TÊN FIELD (vd 'period' trên stock_finstats): Mongo lặng lẽ bỏ field không tồn tại
    → doc gần rỗng → model tưởng tool hỏng → flail retry. Note liệt kê field vắng để model tự sửa query.
    None nếu: không phải inclusion, <2 field chiếu, hoặc <nửa field vắng (tránh nhiễu).
    """
    if not projection or not docs:
        return None
    # Chỉ xét path inclusion (value == 1); bỏ _id và path $slice/expression (không phải "sai tên").
    requested_top = {path.split(".", 1)[0] for path, val in projection.items() if val == 1 and path != "_id"}
    if len(requested_top) < 2:
        return None
    present_top: set[str] = set()
    for doc in docs:
        present_top |= set(doc.keys())
    missing = requested_top - present_top
    if len(missing) < math.ceil(len(requested_top) / 2):
        return None
    fields = ", ".join(sorted(missing))
    return (
        f"Các field không tồn tại trong collection này (đã bị bỏ khỏi kết quả): {fields}. "
        "Hãy xem lại tên field đúng trong schema (read_kb agent_db_01) — đừng lặp lại query y hệt."
    )


def _drop_shadowed_paths(projection: dict[str, Any]) -> dict[str, Any]:
    """Bỏ key con dotted bị cha SCALAR che → tránh Mongo lỗi 'Path collision' (code 31249).

    M3 hay chiếu CẢ cha lẫn con (vd {"series": 1, "series.date": 1}); cha=1 vốn đã bao gồm con nên
    bỏ con không đổi ngữ nghĩa. CHỈ bỏ khi CẢ cha lẫn con là truthy scalar (1/True); cha $slice/
    expression ({"series": {"$slice": -20}}) hay cha value 0 là hợp lệ Mongo → giữ nguyên.
    """
    scalar_parents = {k for k, v in projection.items() if v in (1, True)}
    result: dict[str, Any] = {}
    for key, val in projection.items():
        if val in (1, True) and any(key.startswith(f"{p}.") for p in scalar_parents if p != key):
            continue  # key là con của một cha scalar truthy → bỏ để Mongo không collision
        result[key] = val
    return result


def _coerce_in_scalars(node: Any) -> Any:
    """Bọc scalar trong $in/$nin thành mảng 1 phần tử — quirk M3 đo 22/07/2026.

    M3 hay đưa scalar vào $in/$nin ({"ticker": {"$in": "VNM"}}) → Mongo lỗi '$in needs an array'. Đệ quy
    dict/list; CHỈ đụng value của key $in/$nin không phải list/tuple → bọc [value] (đúng ý hiển nhiên, không
    đổi ngữ nghĩa query hợp lệ nào); giữ nguyên phần còn lại.
    """
    if isinstance(node, dict):
        return {
            k: ([v] if k in ("$in", "$nin") and not isinstance(v, (list, tuple)) else _coerce_in_scalars(v))
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [_coerce_in_scalars(item) for item in node]
    return node


def _fix_find_style_slice(project: dict[str, Any]) -> dict[str, Any]:
    """Sửa $slice cú pháp FIND lọt vào $project của AGGREGATE — quirk M3 đo 22/07/2026.

    M3 bê {"series": {"$slice": 10}} (đúng cho find) sang aggregate $project → Mongo lỗi 'Invalid $slice
    syntax'; aggregate đòi expression {"$slice": ["$series", n]}. CHỈ viết lại khi value là dict đúng một key
    $slice với n là int (hoặc [int]); dạng đúng ["$field", n] hay mọi trường hợp khác giữ nguyên.
    """
    result: dict[str, Any] = {}
    for field, val in project.items():
        n: int | None = None
        if isinstance(val, dict) and list(val.keys()) == ["$slice"]:
            raw = val["$slice"]
            if isinstance(raw, int) and not isinstance(raw, bool):
                n = raw
            elif isinstance(raw, list) and len(raw) == 1 and isinstance(raw[0], int) and not isinstance(raw[0], bool):
                n = raw[0]
        result[field] = {"$slice": [f"${field}", n]} if n is not None else val
    return result


def _strip_id(docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Bỏ khoá _id khỏi mỗi doc — không lộ ObjectId cho model.

    Với find, projection đã ép _id:0 nên đây là no-op vô hại; với aggregate (pipeline model tự
    viết, không ép _id:0 qua projection được) đây là lớp bảo đảm cuối.
    """
    return [{k: v for k, v in doc.items() if k != "_id"} for doc in docs]


class MongoGateway:
    def __init__(self, db: Any, policy: Policy, explain_mode: str = "off") -> None:
        self._db = db
        self._policy = policy
        self._explain_mode = explain_mode

    async def _is_collscan(self, collection: str, filter: dict[str, Any], projection: dict[str, Any]) -> bool:
        """Chỉ soi winningPlan — rejectedPlans có thể chứa COLLSCAN mà kế hoạch thắng vẫn dùng index."""
        explain = await self._db.command(
            {"explain": {"find": collection, "filter": filter, "projection": projection}, "verbosity": "queryPlanner"}
        )
        winning = explain.get("queryPlanner", {}).get("winningPlan", {})
        return "COLLSCAN" in json.dumps(winning)

    def _mongo_error(self, ctx: GatewayContext, collection: str) -> GatewayResult:
        """V2: quy mọi lỗi Motor/pymongo về GatewayResult — không log filter, không 500 trần.

        Ghi KIỂU + thông điệp exception (không ghi filter, giữ nguyên chủ ý không lộ query):
        thiếu nó thì cảnh báo này không chẩn đoán được, phải dựng lại monkeypatch mới biết
        vì sao (đo 22/07/2026 — nguyên nhân thật là model tự viết pipeline/projection sai,
        Mongo từ chối, không phải collection hỏng).
        """
        exc = sys.exc_info()[1]
        logger.warning(
            "gateway mongo error request_id=%s collection=%s exc=%s: %s",
            ctx.request_id, collection, type(exc).__name__, exc,
        )
        if isinstance(exc, OperationFailure):
            # Mongo TỪ CHỐI query (vd model chiếu cả cha lẫn con → 'Path collision'): thông điệp cứng
            # "thu hẹp phạm vi" là SAI, khiến model lặp query hỏng y hệt. Trả errmsg thật để model tự sửa
            # (chỉ errmsg của Mongo, KHÔNG lộ filter/pipeline).
            errmsg = str((exc.details or {}).get("errmsg") or exc)[:200]
            return GatewayResult(
                ok=False,
                error=f"Mongo từ chối truy vấn: {errmsg}. Hãy sửa query theo thông báo trên, đừng lặp lại y hệt.",
                meta={"collection": collection, "error": True},
            )
        return GatewayResult(ok=False, error=_MONGO_ERROR_MSG, meta={"collection": collection, "error": True})

    def _ok_result(
        self, ctx: GatewayContext, collection: str, docs: list[dict[str, Any]], started: float, suffix: str = ""
    ) -> GatewayResult:
        """Chốt kết quả dùng chung cho find/aggregate: strip _id → cap bytes → log → GatewayResult."""
        rule = self._policy.rule_for(collection)
        cap_kb = rule.max_response_kb if (rule and rule.max_response_kb) else self._policy.defaults.max_response_kb
        data, size, truncated = _cap_bytes(_strip_id(docs), cap_kb)
        ms = int((time.perf_counter() - started) * 1000)
        if docs and not data:
            # Có doc khớp nhưng doc đầu tiên đã vượt ngân sách → không trả nổi doc nào. Báo lỗi "dạy model"
            # thay vì rỗng CÂM (rỗng câm khiến model tưởng không có dữ liệu và lặp query vô ích tới MAX_ITERS).
            logger.warning(
                "gateway oversize request_id=%s collection=%s max_kb=%d",
                ctx.request_id, collection, cap_kb,
            )
            return GatewayResult(
                ok=False,
                error=(
                    f"Kết quả quá lớn (vượt {cap_kb} KB) nên không trả được. "
                    "Hãy giảm số phần tử $slice (ví dụ -104) hoặc projection ít field hơn (chỉ date, pe, pb…)."
                ),
                meta={"collection": collection, "oversize": True},
            )
        logger.info(
            "gateway ok request_id=%s collection=%s ms=%d bytes=%d n=%d truncated=%s%s",
            ctx.request_id, collection, ms, size, len(data), truncated, suffix,
        )
        return GatewayResult(
            ok=True, data=data, meta={"collection": collection, "ms": ms, "bytes": size, "truncated": truncated}
        )

    async def _reject_collscan(
        self, ctx: GatewayContext, collection: str, query_filter: dict[str, Any], query_projection: dict[str, Any]
    ) -> GatewayResult | None:
        """explain_mode=on trên collection large: nếu winningPlan là COLLSCAN thì từ chối kèm gợi ý."""
        rule = self._policy.rule_for(collection)
        if not (self._explain_mode == "on" and rule is not None and rule.size == "large"):
            return None
        if not await self._is_collscan(collection, query_filter, query_projection):
            return None
        logger.warning("gateway collscan request_id=%s collection=%s", ctx.request_id, collection)
        return GatewayResult(
            ok=False,
            error=(
                f"Query trên '{collection}' phải quét toàn bộ collection. "
                "Hãy thêm filter theo khoá chính (ví dụ ticker) để dùng được index."
            ),
            meta={"collection": collection, "rejected": True, "plan": "COLLSCAN"},
        )

    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult:
        try:
            effective_limit = validate_find(self._policy, collection, filter, projection, sort, limit)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        query_filter = filter or {}
        # Dọn cha+con scalar trùng (vd {"series":1,"series.date":1}) trước khi build — Mongo cấm collision.
        query_projection = {**_drop_shadowed_paths(projection or {}), "_id": 0}
        # Bọc scalar trong $in/$nin thành mảng — quirk M3 đo 22/07/2026 ({"$in": "VNM"} → ["VNM"]).
        query_filter = _coerce_in_scalars(query_filter)
        started = time.perf_counter()
        try:
            rejection = await self._reject_collscan(ctx, collection, query_filter, query_projection)
            if rejection is not None:
                return rejection
            cursor = self._db[collection].find(query_filter, query_projection)
            if sort:
                cursor = cursor.sort(sort)
            cursor = cursor.limit(effective_limit).max_time_ms(self._policy.defaults.max_time_ms)
            docs = await cursor.to_list(length=effective_limit)
        except PyMongoError:
            return self._mongo_error(ctx, collection)
        result = self._ok_result(ctx, collection, docs, started)
        if result.ok:
            # Additive: chỉ THÊM note khi trả được data; không đụng nhánh oversize/reject.
            hint = _projection_field_hint(projection, docs)
            if hint:
                result.meta["note"] = hint
        return result

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        # Bọc scalar trong $in/$nin ở MỌI stage — quirk M3 đo 22/07/2026 ({"$in": "VNM"} → ["VNM"]); đệ quy cả
        # pipeline an toàn vì chỉ đụng key $in/$nin ($match có thể nằm ở bất kỳ vị trí nào).
        pipeline = [_coerce_in_scalars(stage) for stage in pipeline]
        for stage in pipeline:
            # Dọn cha+con scalar trùng trong MỌI $project (vd {"s":1,"s.d":1}) — Mongo cấm 'Path collision'; và
            # sửa $slice cú pháp find lọt vào $project ({"$slice": 10} → {"$slice": ["$field", 10]}) — quirk M3.
            if "$project" in stage and isinstance(stage["$project"], dict):
                stage["$project"] = _fix_find_style_slice(_drop_shadowed_paths(stage["$project"]))
        started = time.perf_counter()
        try:
            cursor = self._db[collection].aggregate(pipeline, maxTimeMS=self._policy.defaults.max_time_ms)
            docs = await cursor.to_list(length=self._policy.defaults.max_limit)
        except PyMongoError:
            return self._mongo_error(ctx, collection)
        result = self._ok_result(ctx, collection, docs, started, suffix=" (aggregate)")
        if result.ok:
            # Additive (giống nhánh find): bắt ca Q12 — model $project field LỒNG sai tên (week_score...
            # thực nằm trong money_flow_score) → Mongo bỏ field → doc gần rỗng → model BỊA số. Lấy $project
            # CUỐI trong pipeline, dựng pseudo-projection {key: 1} (kể cả key giá trị biểu thức — key đó vẫn
            # phải xuất hiện trong doc kết quả nên kiểm-vắng-mặt vẫn đúng) rồi tái dùng _projection_field_hint.
            last_project = None
            for stage in pipeline:
                if "$project" in stage and isinstance(stage["$project"], dict):
                    last_project = stage["$project"]
            if last_project:
                pseudo = {k: 1 for k, v in last_project.items() if k != "_id" and v not in (0, False)}
                hint = _projection_field_hint(pseudo, docs)
                if hint:
                    result.meta["note"] = hint
        return result

    async def stats(
        self,
        ctx: GatewayContext,
        collection: str,
        field: str,
        ops: list[str],
        filter: dict[str, Any] | None = None,
        date_range: dict[str, str] | None = None,
    ) -> GatewayResult:
        """Đọc TOÀN chuỗi series server-side (không áp cap-gửi-model) và tính scalar. An toàn: chỉ trả số."""
        try:
            validate_stats(self._policy, collection, field, ops, filter)
        except ValidationError as exc:
            logger.info("gateway stats rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        query_filter = filter or {}
        sub = field.split(".", 1)[1] if "." in field else field
        projection = {f"series.{sub}": 1, "series.date": 1, "_id": 0}
        started = time.perf_counter()
        try:
            cursor = self._db[collection].find(query_filter, projection)
            cursor = cursor.limit(self._policy.defaults.max_limit).max_time_ms(self._policy.defaults.max_time_ms)
            docs = await cursor.to_list(length=self._policy.defaults.max_limit)
        except PyMongoError:
            return self._mongo_error(ctx, collection)

        if len(docs) > 1:
            return GatewayResult(
                ok=False,
                error=(
                    "db_stats chỉ tính cho MỘT thực thể mỗi lần. Hãy lọc theo đúng một giá trị khoá "
                    "(một industry_name hoặc một ticker, không dùng $in nhiều giá trị) rồi gọi lại."
                ),
                meta={"collection": collection},
            )

        points = extract_series_points(docs, sub)
        if len(points) > INTERNAL_MAX_POINTS:
            return GatewayResult(
                ok=False,
                error="Chuỗi dữ liệu quá dài để tính. Hãy thu hẹp bằng range (ví dụ từ 2018-01-01).",
                meta={"collection": collection},
            )
        points = filter_range(points, date_range)
        if not points:
            return GatewayResult(
                ok=False,
                error="Không có dữ liệu số cho tiêu chí này. Hãy kiểm tra lại tên (ví dụ industry_name) hoặc field.",
                meta={"collection": collection},
            )
        row = compute_stats(field, points, ops)
        ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gateway stats ok request_id=%s collection=%s ms=%d n=%d", ctx.request_id, collection, ms, row["n"]
        )
        return GatewayResult(ok=True, data=[row], meta={"collection": collection, "ms": ms})
