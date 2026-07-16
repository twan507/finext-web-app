"""FixtureGateway — cùng interface, data từ JSON tĩnh. Dev/CI không cần Mongo (doc 01 §7)."""

import json
import logging
from pathlib import Path
from typing import Any

from .policy import Policy
from .stats_compute import compute_stats, extract_series_points, filter_range
from .types import GatewayContext, GatewayResult
from .validator import ValidationError, validate_aggregate, validate_find, validate_stats

logger = logging.getLogger(__name__)

DEFAULT_FIXTURES = Path(__file__).parent / "fixtures" / "agent_db.json"


def _matches(doc: dict[str, Any], filter: dict[str, Any]) -> bool:
    """So khớp filter phẳng + toán tử $in (đủ cho fixture — không mô phỏng toàn bộ Mongo)."""
    for key, cond in filter.items():
        if isinstance(cond, dict) and "$in" in cond:
            if doc.get(key) not in cond["$in"]:
                return False
        elif doc.get(key) != cond:
            return False
    return True


def _project(doc: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    if not projection:
        return dict(doc)
    keys = [k for k, v in projection.items() if v and k != "_id"]
    return {k: doc[k] for k in keys if k in doc}


class FixtureGateway:
    def __init__(self, policy: Policy, fixtures_path: Path = DEFAULT_FIXTURES) -> None:
        self._policy = policy
        self._data: dict[str, list[dict[str, Any]]] = json.loads(fixtures_path.read_text(encoding="utf-8"))

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

        docs = self._data.get(collection, [])
        matched = [_project(d, projection) for d in docs if _matches(d, filter or {})]
        data = matched[:effective_limit]
        return GatewayResult(ok=True, data=data, meta={"collection": collection, "ms": 0, "plan": "FIXTURE"})

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})
        return GatewayResult(
            ok=False,
            error="Chế độ fixture không hỗ trợ aggregate. Hãy dùng db_find.",
            meta={"collection": collection},
        )

    async def stats(
        self,
        ctx: GatewayContext,
        collection: str,
        field: str,
        ops: list[str],
        filter: dict[str, Any] | None = None,
        date_range: dict[str, str] | None = None,
    ) -> GatewayResult:
        try:
            validate_stats(self._policy, collection, field, ops, filter)
        except ValidationError as exc:
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})
        sub = field.split(".", 1)[1] if "." in field else field
        docs = [doc for doc in self._data.get(collection, []) if _matches(doc, filter or {})]
        points = filter_range(extract_series_points(docs, sub), date_range)
        if not points:
            return GatewayResult(
                ok=False, error="Không có dữ liệu số cho tiêu chí này.", meta={"collection": collection}
            )
        return GatewayResult(
            ok=True, data=[compute_stats(field, points, ops)], meta={"collection": collection, "ms": 0}
        )
