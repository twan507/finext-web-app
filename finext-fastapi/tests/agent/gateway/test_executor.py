from typing import Any

import pytest
from pymongo.errors import PyMongoError

from app.agent.gateway.executor import MongoGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext

CTX = GatewayContext(request_id="test-req", user_id="test-user")


class FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs

    def limit(self, n: int) -> "FakeCursor":
        return FakeCursor(self._docs[:n])

    def sort(self, spec: Any) -> "FakeCursor":
        return self

    def max_time_ms(self, ms: int) -> "FakeCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return self._docs


class FakeCollection:
    def __init__(self, docs: list[dict[str, Any]], plan: str = "IXSCAN") -> None:
        self._docs = docs
        self._plan = plan
        self.last_projection: dict[str, Any] | None = None

    def find(self, filter: dict[str, Any], projection: dict[str, Any] | None = None) -> FakeCursor:
        self.last_projection = projection
        return FakeCursor(self._docs)

    def aggregate(self, pipeline: list[dict[str, Any]], **kwargs: Any) -> FakeCursor:
        return FakeCursor(self._docs)


class FakeDB:
    def __init__(self, collection: FakeCollection) -> None:
        self._collection = collection

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collection

    async def command(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"queryPlanner": {"winningPlan": {"stage": self._collection._plan}}}


async def test_find_returns_docs_and_meta():
    collection = FakeCollection([{"ticker": "FPT", "price": 118.5}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert result.data == [{"ticker": "FPT", "price": 118.5}]
    assert result.meta["collection"] == "stock_snapshot"
    assert result.meta["bytes"] > 0
    assert "ms" in result.meta


async def test_find_forces_id_exclusion_in_projection():
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1)
    assert collection.last_projection == {"ticker": 1, "_id": 0}


async def test_invalid_query_never_touches_mongo():
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection=None)
    assert result.ok is False
    assert collection.last_projection is None  # chưa hề gọi find()
    assert result.error is not None and "projection" in result.error


async def test_response_over_cap_is_truncated():
    docs = [{"ticker": f"T{i:04d}", "blob": "x" * 2000} for i in range(50)]
    collection = FakeCollection(docs)
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "blob": 1}, limit=50
    )
    assert result.ok is True
    assert result.data is not None
    assert len(result.data) < 50
    assert result.meta["truncated"] is True
    assert result.meta["bytes"] <= 50 * 1024


async def test_explain_mode_on_rejects_collscan():
    collection = FakeCollection([{"ticker": "FPT"}], plan="COLLSCAN")
    gateway = MongoGateway(FakeDB(collection), Policy.load(), explain_mode="on")
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is False
    assert result.error is not None
    assert "quét toàn bộ" in result.error


async def test_explain_mode_off_skips_explain(monkeypatch: pytest.MonkeyPatch):
    collection = FakeCollection([{"ticker": "FPT"}], plan="COLLSCAN")
    gateway = MongoGateway(FakeDB(collection), Policy.load(), explain_mode="off")
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is True  # heuristic: tin require_filter, không explain


async def test_aggregate_strips_id_from_docs():
    # V1: aggregate không ép được _id:0 qua projection → phải strip post-hoc để không lộ ObjectId.
    collection = FakeCollection([{"_id": "abc123", "ticker": "FPT", "price": 100}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX, "stock_snapshot", pipeline=[{"$sort": {"ticker": 1}}, {"$limit": 5}]
    )
    assert result.ok is True
    assert result.data == [{"ticker": "FPT", "price": 100}]
    assert all("_id" not in doc for doc in result.data)


class RaisingCursor:
    def limit(self, n: int) -> "RaisingCursor":
        return self

    def sort(self, spec: Any) -> "RaisingCursor":
        return self

    def max_time_ms(self, ms: int) -> "RaisingCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        raise PyMongoError("boom")


class RaisingCollection:
    def find(self, filter: dict[str, Any], projection: dict[str, Any] | None = None) -> RaisingCursor:
        return RaisingCursor()

    def aggregate(self, pipeline: list[dict[str, Any]], **kwargs: Any) -> RaisingCursor:
        return RaisingCursor()


class RaisingDB:
    def __getitem__(self, name: str) -> RaisingCollection:
        return RaisingCollection()

    async def command(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"queryPlanner": {"winningPlan": {}}}


async def test_find_mongo_error_returns_gateway_result():
    # V2: lỗi Motor/pymongo phải thành GatewayResult(ok=False), không bay ra 500 trần.
    gateway = MongoGateway(RaisingDB(), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is False
    assert result.error is not None and "thu hẹp" in result.error


async def test_aggregate_mongo_error_returns_gateway_result():
    gateway = MongoGateway(RaisingDB(), Policy.load())
    result = await gateway.aggregate(
        CTX, "stock_snapshot", pipeline=[{"$sort": {"ticker": 1}}, {"$limit": 5}]
    )
    assert result.ok is False
    assert result.error is not None and "thu hẹp" in result.error


class RejectedPlanDB:
    def __init__(self, collection: FakeCollection) -> None:
        self._collection = collection

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collection

    async def command(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        # winningPlan dùng index; chỉ rejectedPlans mới chứa COLLSCAN.
        return {
            "queryPlanner": {
                "winningPlan": {"stage": "IXSCAN"},
                "rejectedPlans": [{"stage": "COLLSCAN"}],
            }
        }


async def test_explain_mode_on_ignores_collscan_in_rejected_plans():
    # V3: chỉ soi winningPlan — rejectedPlan chứa COLLSCAN không được reject oan.
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(RejectedPlanDB(collection), Policy.load(), explain_mode="on")
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is True


async def test_aggregate_response_over_cap_is_truncated():
    # LƯỚI CHẮN CUỐI: aggregate trên collection phẳng có thể gộp cả collection vào ít doc khổng lồ.
    # Validator KHÔNG chặn khối lượng này (pipeline có $limit là hợp lệ) — chỉ _cap_bytes chặn được.
    docs = [{"ticker": f"T{i:04d}", "blob": "x" * 2000} for i in range(50)]
    collection = FakeCollection(docs)
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX,
        "stock_snapshot",
        pipeline=[{"$sort": {"ticker": 1}}, {"$limit": 50}],
    )
    assert result.ok is True
    assert result.data is not None
    assert len(result.data) < 50
    assert result.meta["truncated"] is True
    assert result.meta["bytes"] <= 50 * 1024
