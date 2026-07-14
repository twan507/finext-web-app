"""MongoGateway — chạy query đã hợp lệ qua Motor. Lớp DUY NHẤT chạm agent_db."""

import json
import logging
import time
from typing import Any

from .policy import Policy
from .types import GatewayContext, GatewayResult
from .validator import ValidationError, validate_aggregate, validate_find

logger = logging.getLogger(__name__)


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


class MongoGateway:
    def __init__(self, db: Any, policy: Policy, explain_mode: str = "off") -> None:
        self._db = db
        self._policy = policy
        self._explain_mode = explain_mode

    async def _is_collscan(self, collection: str, filter: dict[str, Any], projection: dict[str, Any]) -> bool:
        explain = await self._db.command(
            {"explain": {"find": collection, "filter": filter, "projection": projection}, "verbosity": "queryPlanner"}
        )
        plan = json.dumps(explain.get("queryPlanner", {}))
        return "COLLSCAN" in plan

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

        rule = self._policy.rule_for(collection)
        query_filter = filter or {}
        query_projection = {**(projection or {}), "_id": 0}
        started = time.perf_counter()

        if self._explain_mode == "on" and rule is not None and rule.size == "large":
            if await self._is_collscan(collection, query_filter, query_projection):
                logger.warning("gateway collscan request_id=%s collection=%s", ctx.request_id, collection)
                return GatewayResult(
                    ok=False,
                    error=(
                        f"Query trên '{collection}' phải quét toàn bộ collection. "
                        "Hãy thêm filter theo khoá chính (ví dụ ticker) để dùng được index."
                    ),
                    meta={"collection": collection, "rejected": True, "plan": "COLLSCAN"},
                )

        cursor = self._db[collection].find(query_filter, query_projection)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.limit(effective_limit).max_time_ms(self._policy.defaults.max_time_ms)
        docs = await cursor.to_list(length=effective_limit)

        data, size, truncated = _cap_bytes(docs, self._policy.defaults.max_response_kb)
        ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gateway ok request_id=%s collection=%s ms=%d bytes=%d n=%d truncated=%s",
            ctx.request_id, collection, ms, size, len(data), truncated,
        )
        return GatewayResult(
            ok=True,
            data=data,
            meta={"collection": collection, "ms": ms, "bytes": size, "truncated": truncated},
        )

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        started = time.perf_counter()
        cursor = self._db[collection].aggregate(pipeline, maxTimeMS=self._policy.defaults.max_time_ms)
        docs = await cursor.to_list(length=self._policy.defaults.max_limit)
        data, size, truncated = _cap_bytes(docs, self._policy.defaults.max_response_kb)
        ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gateway ok request_id=%s collection=%s ms=%d bytes=%d n=%d (aggregate)",
            ctx.request_id, collection, ms, size, len(data),
        )
        return GatewayResult(
            ok=True, data=data, meta={"collection": collection, "ms": ms, "bytes": size, "truncated": truncated}
        )
