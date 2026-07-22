from typing import Any

import pytest
from pymongo.errors import OperationFailure, PyMongoError

from app.agent.gateway.executor import (
    MongoGateway,
    _coerce_in_scalars,
    _drop_shadowed_paths,
    _fix_find_style_slice,
)
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
        self.last_filter: dict[str, Any] | None = None

    def find(self, filter: dict[str, Any], projection: dict[str, Any] | None = None) -> FakeCursor:
        self.last_projection = projection
        self.last_filter = filter
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


class OpFailCursor:
    def limit(self, n: int) -> "OpFailCursor":
        return self

    def sort(self, spec: Any) -> "OpFailCursor":
        return self

    def max_time_ms(self, ms: int) -> "OpFailCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        raise OperationFailure("Path collision at series.date remaining portion date", 31249)


class OpFailCollection:
    def find(self, filter: dict[str, Any], projection: dict[str, Any] | None = None) -> OpFailCursor:
        return OpFailCursor()

    def aggregate(self, pipeline: list[dict[str, Any]], **kwargs: Any) -> OpFailCursor:
        return OpFailCursor()


class OpFailDB:
    def __getitem__(self, name: str) -> OpFailCollection:
        return OpFailCollection()

    async def command(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"queryPlanner": {"winningPlan": {}}}


async def test_find_operation_failure_teaches_real_errmsg_not_generic():
    # OperationFailure (vd 'Path collision' code 31249 khi model chiếu cả cha lẫn con) phải trả errmsg THẬT
    # để model tự sửa; thông điệp cứng "thu hẹp" là SAI và khiến model lặp query hỏng y hệt.
    gateway = MongoGateway(OpFailDB(), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is False
    assert result.error is not None
    assert "Mongo từ chối" in result.error
    assert "Path collision" in result.error  # errmsg thật của Mongo, không phải thông điệp cứng
    assert "thu hẹp" not in result.error


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


async def test_stats_rejects_multi_doc_pool():
    # filter $in khớp 2 doc → KHÔNG được gộp series trộn lẫn; phải reject dạy model gọi từng entity.
    d1 = {"industry_name": "A", "series": [{"date": "d1", "pe": 10.0}]}
    d2 = {"industry_name": "B", "series": [{"date": "d1", "pe": 20.0}]}
    collection = FakeCollection([d1, d2])
    gateway = MongoGateway(FakeDB(collection), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min"],
        filter={"industry_name": {"$in": ["A", "B"]}},
    )
    assert result.ok is False
    assert "MỘT thực thể" in result.error


async def test_stats_mongo_error_returns_gateway_result():
    gateway = MongoGateway(RaisingDB(), _stats_policy())
    result = await gateway.stats(
        CTX, "history_finratios_industry", field="series.pe", ops=["min"], filter={"industry_name": "X"}
    )
    assert result.ok is False
    assert result.error is not None and "thu hẹp" in result.error


# --- projection-absent-field feedback (fix: M3 chiếu field không tồn tại → doc gần rỗng → flail retry) ---


async def test_find_projection_missing_fields_adds_note():
    # M3 hay chiếu field không tồn tại (vd 'period' trên stock_finstats) → doc trả về gần rỗng, model tưởng
    # tool hỏng. Khi ≥nửa field chiếu (inclusion) vắng ở MỌI doc → gắn note (model đọc) liệt kê field vắng.
    collection = FakeCollection([{"ticker": "FPT"}])  # doc THIẾU period + nonexist
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot",
        filter={"ticker": "FPT"}, projection={"ticker": 1, "period": 1, "nonexist": 1}, limit=1,
    )
    assert result.ok is True  # KHÔNG đổi ok→False
    assert result.data == [{"ticker": "FPT"}]  # data thật vẫn trả
    note = result.meta.get("note")
    assert note is not None
    assert "period" in note and "nonexist" in note  # liệt kê field vắng
    assert "ticker" not in note  # field có thật không bị liệt kê


async def test_find_all_fields_present_no_note():
    collection = FakeCollection([{"ticker": "FPT", "price": 100.0}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert result.meta.get("note") is None  # toàn field có thật → không nhiễu


async def test_find_single_field_projection_no_false_note():
    # Chỉ 1 field chiếu (< ngưỡng ≥2) → không được cảnh báo oan dù doc rỗng field khác.
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is True
    assert result.meta.get("note") is None


async def test_exclusion_projection_no_note():
    # Projection thuần exclusion {_id:0} → không có field inclusion nào → không note.
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"_id": 0}, limit=1
    )
    assert result.ok is True
    assert result.meta.get("note") is None


async def test_find_partial_missing_below_half_no_note():
    # 1/3 field vắng (< nửa) → chưa đủ tín hiệu SAI TÊN → giữ im lặng.
    collection = FakeCollection([{"ticker": "FPT", "price": 100.0}])  # chỉ thiếu 'period'
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot",
        filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1, "period": 1}, limit=1,
    )
    assert result.ok is True
    assert result.meta.get("note") is None


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


# --- aggregate $project absent-field feedback (fix Q12: model $project field LỒNG sai tên → doc gần rỗng
#     → model BỊA toàn bộ bảng số mà không một cảnh báo nào; đường find đã có note, aggregate thì chưa) ---


async def test_aggregate_project_missing_nested_fields_adds_note():
    # Q12 tái hiện: model $project 6 field nhưng week_score/w_pct/m_pct/breadth_* thực nằm LỒNG trong
    # money_flow_score (không có ở top-level) → Mongo lặng lẽ bỏ → doc chỉ còn industry_name → model tưởng
    # "chỉ có danh sách tên" rồi tự chế bảng xếp hạng. Aggregate phải gắn note dạy model xem lại schema.
    collection = FakeCollection([{"industry_name": "Bán lẻ"}])  # 5 field số vắng
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX, "industry_snapshot",
        pipeline=[
            {"$project": {
                "industry_name": 1, "week_score": 1, "w_pct": 1,
                "m_pct": 1, "breadth_in": 1, "breadth_out": 1,
            }},
            {"$limit": 50},
        ],
    )
    assert result.ok is True  # KHÔNG đổi ok→False, data thật vẫn trả
    note = result.meta.get("note")
    assert note is not None
    assert "week_score" in note  # liệt kê field vắng
    assert "industry_name" not in note  # field có thật không bị liệt kê


async def test_aggregate_project_all_fields_present_no_note():
    # $project field ĐÚNG, docs chứa đủ key → không note (không nhiễu).
    collection = FakeCollection([
        {"industry_name": "Bán lẻ", "week_score": 9.27, "w_pct": 1.0, "m_pct": 2.0, "breadth_in": 5, "breadth_out": 3}
    ])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX, "industry_snapshot",
        pipeline=[
            {"$project": {
                "industry_name": 1, "week_score": 1, "w_pct": 1,
                "m_pct": 1, "breadth_in": 1, "breadth_out": 1,
            }},
            {"$limit": 50},
        ],
    )
    assert result.ok is True
    assert result.meta.get("note") is None


async def test_aggregate_without_project_no_note_no_raise():
    # Pipeline không có $project → không note, không raise.
    collection = FakeCollection([{"industry_name": "Bán lẻ"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX, "industry_snapshot",
        pipeline=[{"$sort": {"week_score": -1}}, {"$limit": 20}],
    )
    assert result.ok is True
    assert result.meta.get("note") is None


async def test_aggregate_project_expression_key_present_no_false_note():
    # $project có key giá trị biểu thức ({"week_score": "$money_flow_score.week_score"}); doc kết quả CHỨA
    # week_score → không báo oan (key output vẫn phải xuất hiện, nên kiểm-vắng-mặt trên pseudo-projection đúng).
    collection = FakeCollection([{"industry_name": "Bán lẻ", "week_score": 9.27}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.aggregate(
        CTX, "industry_snapshot",
        pipeline=[
            {"$project": {"industry_name": 1, "week_score": "$money_flow_score.week_score"}},
            {"$limit": 50},
        ],
    )
    assert result.ok is True
    assert result.meta.get("note") is None


# --- _drop_shadowed_paths (fix: M3 chiếu CẢ cha lẫn con → Mongo 'Path collision' code 31249) ---


def test_drop_shadowed_paths_drops_scalar_child_under_scalar_parent():
    # {"series": 1, "series.date": 1}: cha=1 đã bao gồm con → bỏ con để Mongo không lỗi collision.
    assert _drop_shadowed_paths({"series": 1, "series.date": 1}) == {"series": 1}


def test_drop_shadowed_paths_keeps_slice_parent_with_child():
    # Cha là expression $slice → {"series": {"$slice": -20}, "series.date": 1} hợp lệ Mongo, giữ NGUYÊN cả hai.
    proj = {"series": {"$slice": -20}, "series.date": 1}
    assert _drop_shadowed_paths(proj) == proj


def test_drop_shadowed_paths_keeps_unrelated_paths():
    # Không cặp cha-con dotted nào → giữ nguyên.
    proj = {"ticker": 1, "price": 1}
    assert _drop_shadowed_paths(proj) == proj


def test_drop_shadowed_paths_drops_deep_dotted_child():
    # Con dotted sâu "a.b.c" nằm dưới cha scalar "a" → bỏ con.
    assert _drop_shadowed_paths({"a": 1, "a.b.c": 1}) == {"a": 1}


# --- _coerce_in_scalars (fix: M3 đưa scalar vào $in/$nin → Mongo '$in needs an array'; đo 22/07/2026) ---


def test_coerce_in_scalars_wraps_scalar_in_array():
    # {"$in": "VNM"} (scalar) → ["VNM"]: Mongo đòi mảng, M3 hay quên bọc.
    assert _coerce_in_scalars({"ticker": {"$in": "VNM"}}) == {"ticker": {"$in": ["VNM"]}}


def test_coerce_in_scalars_keeps_existing_list():
    # $in đã là mảng → giữ nguyên, không đụng.
    node = {"ticker": {"$in": ["VNM", "HPG"]}}
    assert _coerce_in_scalars(node) == node


def test_coerce_in_scalars_wraps_nin_scalar():
    assert _coerce_in_scalars({"sector": {"$nin": "Banks"}}) == {"sector": {"$nin": ["Banks"]}}


def test_coerce_in_scalars_reaches_nested_match_in_pipeline():
    # $match nằm sâu trong pipeline (không ở stage đầu) → đệ quy cả pipeline mới phủ được.
    pipeline = [{"$sort": {"x": 1}}, {"$match": {"ticker": {"$in": "VNM"}}}]
    assert _coerce_in_scalars(pipeline) == [
        {"$sort": {"x": 1}},
        {"$match": {"ticker": {"$in": ["VNM"]}}},
    ]


def test_coerce_in_scalars_leaves_non_container_untouched():
    # Node không phải dict/list → trả nguyên trạng.
    assert _coerce_in_scalars("VNM") == "VNM"
    assert _coerce_in_scalars(42) == 42


# --- _fix_find_style_slice (fix: M3 bê $slice cú pháp find vào $project aggregate → 'Invalid $slice syntax') ---


def test_fix_find_style_slice_rewrites_scalar_slice():
    # {"$slice": 10} (cú pháp find) → {"$slice": ["$series", 10]} (expression aggregate).
    assert _fix_find_style_slice({"series": {"$slice": 10}}) == {"series": {"$slice": ["$series", 10]}}


def test_fix_find_style_slice_keeps_correct_aggregate_form():
    # Đã đúng dạng ["$series", 10] → giữ nguyên.
    proj = {"series": {"$slice": ["$series", 10]}}
    assert _fix_find_style_slice(proj) == proj


def test_fix_find_style_slice_keeps_plain_inclusion():
    # value 1 (inclusion thường) không phải dict $slice → giữ nguyên.
    proj = {"industry_name": 1, "week_score": 1}
    assert _fix_find_style_slice(proj) == proj


def test_fix_find_style_slice_rewrites_negative_slice():
    # $slice âm (lấy N phần tử cuối) cũng phải coerce.
    assert _fix_find_style_slice({"series": {"$slice": -20}}) == {"series": {"$slice": ["$series", -20]}}


async def test_find_coerces_in_scalar_to_array_before_mongo():
    # Integration mức gateway: M3 gửi {"$in": "VNM"} → gateway phải bọc ["VNM"] TRƯỚC khi chạm Mongo.
    collection = FakeCollection([{"ticker": "VNM", "price": 60.0}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": {"$in": "VNM"}}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert collection.last_filter == {"ticker": {"$in": ["VNM"]}}
