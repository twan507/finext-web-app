import json

from app.agent.events import ToolCall
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.labels import label_for
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool

CTX = GatewayContext(request_id="r1", user_id="u1")


def test_tool_schemas_shape():
    names = {schema["function"]["name"] for schema in TOOL_SCHEMAS}
    assert names == {"db_find", "db_aggregate", "read_kb"}
    for schema in TOOL_SCHEMAS:
        assert schema["type"] == "function"
        # tool db bắt buộc có 'collection'; read_kb là tool tài liệu, dùng 'doc'
        if schema["function"]["name"] in {"db_find", "db_aggregate"}:
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


def test_label_uses_vietnamese_map_and_ticker():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}})
    assert label_for(call) == "Đang đọc dữ liệu cổ phiếu FPT…"


def test_label_falls_back_for_unmapped_collection():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "collection_la"})
    assert label_for(call) == "Đang tra cứu dữ liệu…"


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
    assert label_for(ToolCall(id="c7", name="db_find", arguments=None)) == "Đang tra cứu dữ liệu…"  # type: ignore[arg-type]
    assert label_for(ToolCall(id="c8", name="db_find", arguments=["x"])) == "Đang tra cứu dữ liệu…"  # type: ignore[arg-type]
    # filter là list (không phải dict) không được làm label_for raise.
    call = ToolCall(id="c9", name="db_find", arguments={"collection": "stock_snapshot", "filter": ["FPT"]})
    assert label_for(call) == "Đang đọc dữ liệu cổ phiếu…"
