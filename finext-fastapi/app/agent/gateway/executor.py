"""MongoGateway — chạy query đã hợp lệ qua Motor. Lớp DUY NHẤT chạm agent_db."""

import json
import logging
import time
from typing import Any

from pymongo.errors import PyMongoError

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
        """V2: quy mọi lỗi Motor/pymongo về GatewayResult — không log filter, không 500 trần."""
        logger.warning("gateway mongo error request_id=%s collection=%s", ctx.request_id, collection)
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
        query_projection = {**(projection or {}), "_id": 0}
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
        return self._ok_result(ctx, collection, docs, started)

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        started = time.perf_counter()
        try:
            cursor = self._db[collection].aggregate(pipeline, maxTimeMS=self._policy.defaults.max_time_ms)
            docs = await cursor.to_list(length=self._policy.defaults.max_limit)
        except PyMongoError:
            return self._mongo_error(ctx, collection)
        return self._ok_result(ctx, collection, docs, started, suffix=" (aggregate)")

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
