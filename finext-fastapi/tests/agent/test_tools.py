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
