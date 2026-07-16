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


async def test_single_oversize_doc_returns_teaching_error_not_silent_empty():
    # ROOT CAUSE bug HPG: 1 doc > max_response_kb → _cap_bytes drop sạch → xưa trả ok=True rows=0 (rỗng CÂM),
    # model tưởng không có data → loop tới MAX_ITERS. Giờ phải trả ok=False kèm gợi ý giảm $slice/projection.
    huge = {"ticker": "HPG", "type": "SXKD", "series": [{"i": i, "blob": "x" * 200} for i in range(400)]}
    collection = FakeCollection([huge])  # ~86 KB > 50 KB
    policy = Policy.load()
    policy.collections["history_finratios_stock"].max_response_kb = None  # kiểm guard ở cap mặc định (Task 6 nới cap thật 200)
    gateway = MongoGateway(FakeDB(collection), policy)
    result = await gateway.find(
        CTX, "history_finratios_stock",
        filter={"ticker": "HPG"}, projection={"ticker": 1, "type": 1, "series": {"$slice": -260}},
    )
    assert result.ok is False
    assert not result.data  # None hoặc [] — KHÔNG phải rỗng câm ok=True
    assert result.error is not None and "quá lớn" in result.error
    assert result.meta.get("oversize") is True


async def test_genuine_empty_match_stays_ok_not_oversize():
    # Phân biệt: Mongo match 0 doc (filter không trúng) → vẫn ok=True data=[] (không nhầm thành oversize).
    collection = FakeCollection([])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "history_finratios_stock",
        filter={"ticker": "ZZZ"}, projection={"ticker": 1, "series": {"$slice": -10}},
    )
    assert result.ok is True
    assert result.data == []
    assert result.meta.get("oversize") is None


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


# --- db_stats (Task 3) ---

def _stats_policy() -> Policy:
    policy = Policy.load()
    policy.collections["history_finratios_industry"].stats_fields = ["series.pe", "series.pb"]
    return policy


async def test_stats_returns_only_scalars_from_full_series():
    # series 28 điểm (raw sẽ > vài KB) → stats CHỈ trả scalar, không rò series.
    series = [{"date": f"2020-01-{i:02d}", "pe": 10.0 + i, "pb": 1.0} for i in range(1, 29)]
    collection = FakeCollection([{"industry_name": "Toàn bộ thị trường", "series": series}])
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry",
        field="series.pe", ops=["min", "max", "latest", "drawdown_from_peak", "median"],
        filter={"industry_name": "Toàn bộ thị trường"},
    )
    assert result.ok is True
    row = result.data[0]
    assert row["field"] == "series.pe"
    assert row["n"] == 28
    assert row["min"] == 11.0
    assert row["max"] == 38.0
    assert row["latest"] == 38.0
    assert row["drawdown_from_peak"] == 0.0
    assert "series" not in row and "date" not in row  # scalar-only, không rò raw


async def test_stats_rejects_collection_without_stats_fields():
    collection = FakeCollection([{"industry_name": "X", "series": []}])
    policy = Policy.load()
    policy.collections["history_finratios_industry"].stats_fields = []  # ép rỗng: kiểm path 'không hỗ trợ' độc lập YAML
    gateway = MongoGateway(FakeDB(collection), policy)
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min"], filter={"industry_name": "X"}
    )
    assert result.ok is False
    assert result.error is not None and "không hỗ trợ" in result.error


async def test_stats_empty_match_returns_teaching_error():
    collection = FakeCollection([])  # không doc khớp
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min"], filter={"industry_name": "ZZZ"}
    )
    assert result.ok is False
    assert result.error is not None and "không có dữ liệu" in result.error.lower()


async def test_stats_range_filter_applied():
    series = [{"date": f"2020-0{i}-01", "pe": float(i)} for i in range(1, 6)]  # 2020-01..05
    collection = FakeCollection([{"industry_name": "X", "series": series}])
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min", "max", "count"],
        filter={"industry_name": "X"}, date_range={"from": "2020-02-01", "to": "2020-04-01"},
    )
    assert result.ok is True
    row = result.data[0]
    assert row["min"] == 2.0 and row["max"] == 4.0 and row["count"] == 3


async def test_stats_mongo_error_returns_gateway_result():
    gateway = MongoGateway(RaisingDB(), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min"], filter={"industry_name": "X"}
    )
    assert result.ok is False
    assert result.error is not None and "thu hẹp" in result.error


async def test_find_cap_uses_per_rule_override():
    # Part B: collection có max_response_kb override → dùng cap lớn hơn default 50.
    policy = Policy.load()
    policy.collections["stock_snapshot"].max_response_kb = 200
    docs = [{"ticker": f"T{i:04d}", "blob": "x" * 2000} for i in range(50)]  # ~100 KB
    collection = FakeCollection(docs)
    gateway = MongoGateway(FakeDB(collection), policy)
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "blob": 1}, limit=50
    )
    assert result.ok is True
    assert result.data is not None and len(result.data) == 50  # 100 KB < 200 KB cap → không cắt
    assert result.meta["truncated"] is False
