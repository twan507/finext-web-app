import json

from typing import Any

from app.agent.events import ToolCall
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext, GatewayResult
from app.agent.labels import label_for
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool

CTX = GatewayContext(request_id="r1", user_id="u1")


def test_tool_schemas_shape():
    names = {schema["function"]["name"] for schema in TOOL_SCHEMAS}
    assert names == {"db_find", "db_aggregate", "db_stats", "read_kb"}
    for schema in TOOL_SCHEMAS:
        assert schema["type"] == "function"
        # tool db bắt buộc có 'collection'; read_kb là tool tài liệu, dùng 'doc'
        if schema["function"]["name"] in {"db_find", "db_aggregate", "db_stats"}:
            assert "collection" in schema["function"]["parameters"]["properties"]


async def test_execute_db_find_returns_json_content():
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(
        id="c1",
        name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    content, meta = await execute_tool(gateway, CTX, call)
    assert json.loads(content)[0]["price"] == 118.5
    assert meta["ok"] is True


async def test_execute_returns_error_text_instead_of_raising():
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(id="c2", name="db_find", arguments={"collection": "stock_snapshot"})
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is False
    assert "projection" in content


async def test_unknown_tool_returns_error_not_raise():
    gateway = FixtureGateway(Policy.load())
    content, meta = await execute_tool(gateway, CTX, ToolCall(id="c3", name="rm_rf", arguments={}))
    assert meta["ok"] is False
    assert "không tồn tại" in content


async def test_empty_arguments_returns_error():
    gateway = FixtureGateway(Policy.load())
    content, meta = await execute_tool(gateway, CTX, ToolCall(id="c4", name="db_find", arguments={}))
    assert meta["ok"] is False


async def test_arg_error_gives_model_actionable_feedback_not_missing_collection():
    # Adapter set arg_error khi model nhả JSON args hỏng (thiếu dấu ngoặc ở pipeline dài).
    # execute_tool phải trả feedback ĐÚNG (nhắc JSON + gợi ý db_find) thay vì "thiếu collection" sai lệch
    # khiến model retry y hệt tới MAX_ITERS. ms=0 (chưa chạm gateway).
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(id="cE", name="db_aggregate", arguments={}, arg_error="tham số JSON không hợp lệ")
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is False
    assert meta["ms"] == 0
    assert "JSON" in content and "db_find" in content
    assert "collection" not in content  # KHÔNG được đổ lỗi 'thiếu collection'


class _NoteGateway:
    """Gateway giả trả note trong meta — kiểm registry đưa note vào content model THẤY được."""

    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult:
        return GatewayResult(
            ok=True,
            data=[{"ticker": "FPT"}],
            meta={
                "collection": collection,
                "ms": 0,
                "note": "Các field không tồn tại trong collection này (đã bỏ): period, nonexist.",
            },
        )


async def test_execute_tool_surfaces_projection_note_to_model():
    # Note ở meta phải xuất hiện trong content (model đọc trong tool-result), nhưng data thật vẫn parse được.
    call = ToolCall(
        id="cN", name="db_find",
        arguments={"collection": "stock_finstats", "filter": {"ticker": "FPT"}, "projection": {"ticker": 1, "period": 1}},
    )
    content, meta = await execute_tool(_NoteGateway(), CTX, call)  # type: ignore[arg-type]
    assert meta["ok"] is True
    head, _, tail = content.partition("\n\n")
    assert json.loads(head)[0]["ticker"] == "FPT"  # data thật vẫn nguyên vẹn JSON
    assert "period" in tail and "nonexist" in tail  # field vắng được nêu cho model


async def test_execute_tool_no_note_stays_pure_json():
    # Không có note → content là JSON thuần (giữ hành vi cũ, các test json.loads khác không vỡ).
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(
        id="cP", name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is True
    assert json.loads(content)[0]["price"] == 118.5  # parse trọn, không có đuôi note


def test_label_uses_vietnamese_map_and_ticker():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}})
    # label giờ = CHI TIẾT (danh từ), FE tự thêm động từ đậm "Đọc".
    assert label_for(call) == "dữ liệu cổ phiếu FPT"


def test_label_falls_back_for_unmapped_collection():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "collection_la"})
    assert label_for(call) == "dữ liệu"


# --- Hardening: execute_tool KHÔNG BAO GIỜ raise, kể cả input dị dạng từ LLM (doc 02 §4.2) ---
# Adapter openai_compat dựng arguments bằng json.loads(...) nên model có thể trả None / list / scalar.


async def test_execute_tool_non_dict_arguments_does_not_raise():
    gateway = FixtureGateway(Policy.load())
    for bad_arguments in (None, ["stock_snapshot"], "stock_snapshot", 7):
        call = ToolCall(id="c5", name="db_find", arguments=bad_arguments)  # type: ignore[arg-type]
        content, meta = await execute_tool(gateway, CTX, call)
        assert meta["ok"] is False
        assert isinstance(content, str)


async def test_execute_tool_missing_second_required_key_does_not_raise():
    # db_aggregate có collection nhưng thiếu 'pipeline' -> trả text, không raise.
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(id="c6", name="db_aggregate", arguments={"collection": "market_phase"})
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is False
    assert isinstance(content, str)


def test_label_for_handles_non_dict_arguments():
    assert label_for(ToolCall(id="c7", name="db_find", arguments=None)) == "dữ liệu"  # type: ignore[arg-type]
    assert label_for(ToolCall(id="c8", name="db_find", arguments=["x"])) == "dữ liệu"  # type: ignore[arg-type]
    # filter là list (không phải dict) không được làm label_for raise.
    call = ToolCall(id="c9", name="db_find", arguments={"collection": "stock_snapshot", "filter": ["FPT"]})
    assert label_for(call) == "dữ liệu cổ phiếu"


# --- Thu gọn kết quả quá lớn: cắt theo CẤU TRÚC, không cắt mù giữa chuỗi ---
# Hành vi cũ content[:12000] giữ phần ĐẦU: kết quả 9 kỳ báo cáo bị cắt còn 4 kỳ CŨ NHẤT,
# JSON hỏng giữa chừng, model chỉ thấy "…[đã cắt]" nên đã bịa số cho các kỳ nó không nhìn thấy.


class _FakeGateway:
    """Gateway giả trả đúng data đã đặt trước — chỉ để soi hành vi của execute_tool."""

    def __init__(self, result: GatewayResult):
        self._result = result

    async def find(self, *args: Any, **kwargs: Any) -> GatewayResult:
        return self._result

    async def aggregate(self, *args: Any, **kwargs: Any) -> GatewayResult:
        return self._result

    async def stats(self, *args: Any, **kwargs: Any) -> GatewayResult:
        return self._result


def _call(name: str, arguments: dict[str, Any]) -> ToolCall:
    return ToolCall(id="cS", name=name, arguments=arguments)


def _big_doc(n_periods: int) -> dict[str, Any]:
    return {
        "ticker": "HPG",
        "financial_statements": {
            "quarterly": [
                {
                    "period": f"20{24 + i // 4}_{i % 4 + 1}",
                    "metrics": [{"vi_name": f"CT {k}", "value": 1_000_000 + k} for k in range(34)],
                }
                for i in range(n_periods)
            ]
        },
    }


async def test_ket_qua_qua_lon_van_la_JSON_hop_le_va_giu_ky_moi():
    """Hành vi cũ: content[:12000] → JSON hỏng + mất kỳ mới. Nay phải ngược lại."""
    result = GatewayResult(ok=True, data=[_big_doc(9)], meta={"ms": 5, "bytes": 30_000})
    content, meta = await execute_tool(
        _FakeGateway(result),  # type: ignore[arg-type]
        CTX,
        _call("db_find", {"collection": "stock_finstats"}),
        max_chars=6_000,
    )

    body = content.split("\n\n[GHI CHÚ NỘI BỘ")[0]
    data = json.loads(body)  # không được raise — hành vi cũ raise ở đây
    kept = [q["period"] for q in data[0]["financial_statements"]["quarterly"]]
    assert "2026_1" in kept
    assert "2024_1" not in kept
    assert meta["shrunk"] is True


async def test_ghi_chu_cat_di_kem_va_cam_bia_so():
    result = GatewayResult(ok=True, data=[_big_doc(9)], meta={"ms": 5})
    content, _ = await execute_tool(
        _FakeGateway(result),  # type: ignore[arg-type]
        CTX,
        _call("db_find", {"collection": "stock_finstats"}),
        max_chars=6_000,
    )
    assert "[GHI CHÚ NỘI BỘ" in content
    assert "TUYỆT ĐỐI không tự điền số" in content


async def test_chuyen_tiep_co_truncated_cua_gateway():
    """Gateway biết mình đã bỏ document nhưng registry đang VỨT cờ này — không ai đo được."""
    result = GatewayResult(
        ok=True, data=[{"ticker": "FPT"}], meta={"ms": 3, "bytes": 120, "truncated": True}
    )
    _, meta = await execute_tool(
        _FakeGateway(result),  # type: ignore[arg-type]
        CTX,
        _call("db_find", {"collection": "stock_snapshot"}),
    )
    assert meta["truncated"] is True
    assert meta["bytes"] == 120


async def test_giu_note_san_co_cua_gateway():
    result = GatewayResult(
        ok=True, data=[{"ticker": "FPT"}], meta={"ms": 3, "note": "Field abc không tồn tại."}
    )
    content, _ = await execute_tool(
        _FakeGateway(result),  # type: ignore[arg-type]
        CTX,
        _call("db_find", {"collection": "stock_snapshot"}),
    )
    assert "Field abc không tồn tại." in content


async def test_qua_lon_khong_thu_noi_thi_bao_loi_day_model():
    result = GatewayResult(ok=True, data=[{"blob": "x" * 5_000}], meta={"ms": 3})
    content, meta = await execute_tool(
        _FakeGateway(result),  # type: ignore[arg-type]
        CTX,
        _call("db_find", {"collection": "stock_snapshot"}),
        max_chars=1_000,
    )
    assert meta["ok"] is False
    assert "$slice" in content or "projection" in content


async def test_JSON_cong_ghi_chu_luon_vua_TRAN_da_cho():
    """Canh hợp đồng ngầm giữa _NOTE_RESERVE (registry) và _cap_text (loop).

    loop.py áp _cap_text lên MỌI content với đúng trần này. _cap_text cắt mù khi chuỗi
    không có xuống dòng ở nửa sau — mà JSON là một dòng. Nên nếu JSON cộng ghi chú vượt
    trần thì _cap_text sẽ xé giữa JSON, làm SỐNG LẠI đúng con bug đang sửa. Nới nội dung
    shrink_note mà quên nới _NOTE_RESERVE là đủ để tái sinh nó, và không test nào khác bắt được.
    """
    for limit in (3_000, 6_000, 12_000, 24_000):
        result = GatewayResult(ok=True, data=[_big_doc(40)], meta={"ms": 5})
        content, meta = await execute_tool(
            _FakeGateway(result),  # type: ignore[arg-type]
            CTX,
            _call("db_find", {"collection": "stock_finstats"}),
            max_chars=limit,
        )
        if not meta["ok"]:
            continue  # ca không thu nổi: trả thông điệp lỗi ngắn, không phải JSON
        assert meta["shrunk"] is True, f"limit={limit}: phải đi qua đường thu gọn"
        assert len(content) <= limit, (
            f"limit={limit}: JSON+ghi chú dài {len(content)} ký tự — _cap_text sẽ xé giữa JSON"
        )


# --- Bóc stage bị M3 bọc thành {"$text": "<chuỗi JSON>"} (bug production, doc eval) ---
# M3 đôi khi gửi mỗi stage aggregate dưới dạng {"$text": "<chuỗi JSON của stage>"} hoặc gửi thẳng
# chuỗi JSON. $text KHÔNG BAO GIỜ là stage hợp lệ ở cấp cao nhất của pipeline Mongo nên bóc ra
# parse lại là an toàn tuyệt đối. Tool phải chuẩn hoá trước khi tới gateway/validator.


class _CaptureAggGateway:
    """Gateway giả GHI LẠI pipeline nó nhận — soi xem tool đã bóc {"$text": ...} chưa."""

    def __init__(self) -> None:
        self.pipeline: Any = None

    async def aggregate(self, ctx: GatewayContext, collection: str, pipeline: Any) -> GatewayResult:
        self.pipeline = pipeline
        return GatewayResult(ok=True, data=[{"ok": 1}], meta={"ms": 0})


async def test_boc_stage_text_ba_tang_thanh_dict_that():
    # Nguyên văn biến thể 1 từ production: 3 stage đều bị bọc {"$text": "<chuỗi JSON>"}, gồm cả $limit.
    gateway = _CaptureAggGateway()
    pipeline = [
        {"$text": '{"$project": {"industry_name": 1, "week_score": "$money_flow_score.week_score"}}'},
        {"$text": '{"$sort": {"week_score": -1}}'},
        {"$text": '{"$limit": 24}'},
    ]
    _, meta = await execute_tool(
        gateway,  # type: ignore[arg-type]
        CTX,
        _call("db_aggregate", {"collection": "industry_snapshot", "pipeline": pipeline}),
    )
    assert meta["ok"] is True
    assert gateway.pipeline == [
        {"$project": {"industry_name": 1, "week_score": "$money_flow_score.week_score"}},
        {"$sort": {"week_score": -1}},
        {"$limit": 24},
    ]


async def test_boc_stage_text_co_tab_va_khoang_trang_dau_chuoi():
    # Biến thể có "\t" / khoảng trắng đầu chuỗi vẫn phải parse được (strip trước khi json.loads).
    gateway = _CaptureAggGateway()
    pipeline = [{"$text": '\t{"$limit": 24}'}, {"$text": ' {"$sort": {"week_score": -1}}'}]
    await execute_tool(
        gateway,  # type: ignore[arg-type]
        CTX,
        _call("db_aggregate", {"collection": "industry_snapshot", "pipeline": pipeline}),
    )
    assert gateway.pipeline == [{"$limit": 24}, {"$sort": {"week_score": -1}}]


async def test_boc_stage_la_chuoi_json_tran():
    # Stage gửi thẳng dưới dạng chuỗi JSON (không bọc $text) cũng phải được parse thành dict.
    gateway = _CaptureAggGateway()
    pipeline = ['{"$sort": {"week_score": -1}}', '{"$limit": 24}']
    await execute_tool(
        gateway,  # type: ignore[arg-type]
        CTX,
        _call("db_aggregate", {"collection": "industry_snapshot", "pipeline": pipeline}),
    )
    assert gateway.pipeline == [{"$sort": {"week_score": -1}}, {"$limit": 24}]


async def test_pipeline_hop_le_binh_thuong_truyen_qua_nguyen_ven():
    # Pipeline dict thật KHÔNG được sửa đổi khi đi qua tool.
    gateway = _CaptureAggGateway()
    pipeline = [{"$sort": {"week_score": -1}}, {"$limit": 24}]
    await execute_tool(
        gateway,  # type: ignore[arg-type]
        CTX,
        _call("db_aggregate", {"collection": "industry_snapshot", "pipeline": pipeline}),
    )
    assert gateway.pipeline == [{"$sort": {"week_score": -1}}, {"$limit": 24}]


async def test_boc_stage_text_khong_phai_json_giu_nguyen():
    # {"$text": "không phải json"} parse hỏng → giữ nguyên để validator báo lỗi như cũ, KHÔNG raise.
    gateway = _CaptureAggGateway()
    pipeline = [{"$text": "không phải json"}]
    await execute_tool(
        gateway,  # type: ignore[arg-type]
        CTX,
        _call("db_aggregate", {"collection": "industry_snapshot", "pipeline": pipeline}),
    )
    assert gateway.pipeline == [{"$text": "không phải json"}]


# --- Ép kiểu THEO VỊ TRÍ: M3 bọc SỐ thành CHUỖI / bẻ MẢNG thành DICT (bug production eval hôm nay) ---
# M3 gửi số dưới dạng chuỗi ("25", "-1") và bẻ đối số mảng của $slice/$arrayElemAt thành dict ở đúng
# những vị trí mà chuỗi số KHÔNG BAO GIỜ hợp lệ. Ép tại chỗ để validator/Mongo không từ chối câm — mỗi
# câu trước đây đốt 2-7 vòng rồi cầu dao ép bỏ cuộc. KHÔNG đụng so-sánh-bằng / tham chiếu '$field'.


class _CaptureFindGateway:
    """Gateway giả GHI LẠI tham số find nhận — soi xem tool đã ép kiểu đúng vị trí chưa."""

    def __init__(self) -> None:
        self.filter: Any = None
        self.projection: Any = None
        self.sort: Any = None
        self.limit: Any = None

    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: Any = None,
        projection: Any = None,
        sort: Any = None,
        limit: Any = None,
    ) -> GatewayResult:
        self.filter, self.projection, self.sort, self.limit = filter, projection, sort, limit
        return GatewayResult(ok=True, data=[{"ok": 1}], meta={"ms": 0})


async def _run_find(gateway: Any, args: dict[str, Any]) -> None:
    await execute_tool(gateway, CTX, _call("db_find", args))


async def _run_agg(gateway: Any, pipeline: Any) -> None:
    await execute_tool(gateway, CTX, _call("db_aggregate", {"collection": "c", "pipeline": pipeline}))


# ---- db_find: từng vị trí ----


async def test_find_limit_chuoi_so_thanh_int():
    # {"$limit": "25"} → ý là 25. limit của db_find không bao giờ là chuỗi.
    gw = _CaptureFindGateway()
    await _run_find(gw, {"collection": "c", "projection": {"x": 1}, "limit": "25"})
    assert gw.limit == 25 and isinstance(gw.limit, int)


async def test_find_sort_huong_chuoi_so_thanh_int():
    # "sort": [["created_at", "-1"]] → ý là -1.
    gw = _CaptureFindGateway()
    await _run_find(gw, {"collection": "c", "projection": {"x": 1}, "sort": [["created_at", "-1"]]})
    assert gw.sort == [["created_at", -1]]


async def test_find_projection_0_1_chuoi_thanh_int():
    # "projection": {"title": "1", "sapo": "1"} → ý là 1.
    gw = _CaptureFindGateway()
    await _run_find(gw, {"collection": "c", "projection": {"title": "1", "sapo": "1"}})
    assert gw.projection == {"title": 1, "sapo": 1}


async def test_find_filter_gt_chuoi_so_thanh_number():
    # {"$match": {"price.volume": {"$gt": "50000"}}} → ý là 50000 (áp cả cho filter db_find).
    gw = _CaptureFindGateway()
    await _run_find(gw, {"collection": "c", "projection": {"x": 1}, "filter": {"price.volume": {"$gt": "50000"}}})
    assert gw.filter == {"price.volume": {"$gt": 50000}}


async def test_find_projection_slice_dict_mangle_thanh_int():
    # "projection": {"financial_statements.quarterly": {"$slice": {"-2": ""}}} → ý là {"$slice": -2}.
    gw = _CaptureFindGateway()
    await _run_find(gw, {"collection": "c", "projection": {"financial_statements.quarterly": {"$slice": {"-2": ""}}}})
    assert gw.projection == {"financial_statements.quarterly": {"$slice": -2}}


# ---- db_aggregate: từng stage (SAU _repair_stage) ----


async def test_agg_limit_chuoi_so_thanh_int():
    # {"$limit": "25"} → ý là 25.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$limit": "25"}])
    assert gw.pipeline == [{"$limit": 25}]


async def test_agg_sort_huong_chuoi_so_thanh_int():
    # {"$sort": {"week_score": "-1"}} → ý là -1.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$sort": {"week_score": "-1"}}])
    assert gw.pipeline == [{"$sort": {"week_score": -1}}]


async def test_agg_project_0_1_chuoi_thanh_int():
    # {"$project": {"industry_name": "1"}} → ý là 1.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$project": {"industry_name": "1"}}])
    assert gw.pipeline == [{"$project": {"industry_name": 1}}]


async def test_agg_match_gt_chuoi_so_thanh_number():
    # {"$match": {"price.volume": {"$gt": "50000"}}} → ý là 50000.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$match": {"price.volume": {"$gt": "50000"}}}])
    assert gw.pipeline == [{"$match": {"price.volume": {"$gt": 50000}}}]


async def test_agg_match_gt_thap_phan_thanh_float():
    # Ngưỡng thập phân "50000.5" → 50000.5 (float), không phải int.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$match": {"$or": [{"a": {"$gte": "1.5"}}, {"b": {"$lte": "2"}}]}}])
    assert gw.pipeline == [{"$match": {"$or": [{"a": {"$gte": 1.5}}, {"b": {"$lte": 2}}]}}]


async def test_agg_slice_dict_mangle_thanh_mang():
    # {"$slice": {"item": "$...quarterly", "-5": ""}} → {"$slice": ["$...quarterly", -5]}.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$slice": {"item": "$financial_statements.quarterly", "-5": ""}}])
    assert gw.pipeline == [{"$slice": ["$financial_statements.quarterly", -5]}]


async def test_agg_arrayelemat_dict_mangle_thanh_mang():
    # {"$arrayElemAt": {"item": "$...quarterly", "-1": ""}} → {"$arrayElemAt": ["$...quarterly", -1]}.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$arrayElemAt": {"item": "$financial_statements.quarterly", "-1": ""}}])
    assert gw.pipeline == [{"$arrayElemAt": ["$financial_statements.quarterly", -1]}]


async def test_agg_project_key_mangle_ca_cap_nhet_vao_key():
    # {"$project": {"ticker": 1, "recent_4q: { \"$slice\": [ \"$...quarterly\", -4 ] }": ""}}
    # → cả cặp key:value bị nhét vào KEY, value rỗng. Khôi phục về cặp thật.
    gw = _CaptureAggGateway()
    mangled_key = 'recent_4q: { "$slice": [ "$financial_statements.quarterly", -4 ] }'
    await _run_agg(gw, [{"$project": {"ticker": 1, mangled_key: ""}}])
    assert gw.pipeline == [
        {"$project": {"ticker": 1, "recent_4q": {"$slice": ["$financial_statements.quarterly", -4]}}}
    ]


# ---- Test âm: đầu vào HỢP LỆ phải đi qua NGUYÊN VẸN, không bị coerce bừa ----


async def test_find_khong_dung_so_sanh_bang_va_tham_chieu_field():
    # {"ticker": "HPG"} (so sánh bằng) và "$money_flow_score.week_score" (tham chiếu) KHÔNG được đụng.
    gw = _CaptureFindGateway()
    await _run_find(
        gw,
        {
            "collection": "c",
            "filter": {"ticker": "HPG"},
            "projection": {"week_score": "$money_flow_score.week_score"},
        },
    )
    assert gw.filter == {"ticker": "HPG"}
    assert gw.projection == {"week_score": "$money_flow_score.week_score"}


async def test_agg_slice_mang_hop_le_di_qua_nguyen_ven():
    # {"$slice": ["$arr", -4]} đã đúng → đi qua nguyên vẹn.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$project": {"recent": {"$slice": ["$arr", -4]}}}])
    assert gw.pipeline == [{"$project": {"recent": {"$slice": ["$arr", -4]}}}]


async def test_agg_match_text_dict_khong_bi_dung():
    # $text với value DICT (không phải chuỗi) là toán tử tìm kiếm hợp lệ trong $match — không đụng.
    gw = _CaptureAggGateway()
    await _run_agg(gw, [{"$match": {"$text": {"$search": "abc"}}}])
    assert gw.pipeline == [{"$match": {"$text": {"$search": "abc"}}}]
