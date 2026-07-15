import json
from typing import Any

import pytest
from bson import ObjectId

from app.agent.events import ToolCall
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext, GatewayResult
from app.agent.tools.registry import execute_tool
from app.agent.tools.user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

CTX = GatewayContext(request_id="r1", user_id="507f1f77bcf86cd799439011")
EVIL_ARGS: dict[str, Any] = {"user_id": "507f1f77bcf86cd799439099", "ticker": "HACK"}


class FakeWatchlistDB:
    def __init__(self, tickers: list[str]) -> None:
        self._tickers = tickers
        self.queried_user_id: Any = None

    def __getitem__(self, name: str) -> "FakeWatchlistDB":
        return self

    async def find_one(self, filter: dict[str, Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
        self.queried_user_id = filter.get("user_id")
        return {"tickers": self._tickers}


class RejectingGateway:
    """Gateway giả luôn từ chối find — mô phỏng policy đổi luật khiến join giá bị reject."""

    async def find(self, ctx: GatewayContext, collection: str, **kwargs: Any) -> GatewayResult:
        return GatewayResult(
            ok=False, error="Query bị từ chối bởi policy.", meta={"collection": collection, "ms": 3, "rejected": True}
        )

    async def aggregate(self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]) -> GatewayResult:
        return GatewayResult(ok=False, error="n/a", meta={"collection": collection})


def test_schema_has_no_user_id_parameter():
    props = GET_WATCHLIST_SCHEMA["function"]["parameters"]["properties"]
    assert props == {}  # model KHÔNG được truyền user_id — chặn IDOR-qua-AI


async def test_returns_watchlist_joined_with_prices():
    user_db = FakeWatchlistDB(["FPT"])
    result = await run_get_my_watchlist(user_db, FixtureGateway(Policy.load()), CTX, {})
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["ticker"] == "FPT"
    assert result.data[0]["price"] == 118.5
    assert str(user_db.queried_user_id) == CTX.user_id  # user_id lấy từ ctx, không từ model


async def test_empty_watchlist_returns_empty_list():
    result = await run_get_my_watchlist(FakeWatchlistDB([]), FixtureGateway(Policy.load()), CTX, {})
    assert result.ok is True
    assert result.data == []


async def test_malicious_user_id_in_args_is_ignored_uses_ctx():
    """V2 lock-in: model nhét user_id/ticker vào args cũng phải bị bỏ — query LUÔN theo ctx.user_id."""
    user_db = FakeWatchlistDB(["FPT"])
    result = await run_get_my_watchlist(user_db, FixtureGateway(Policy.load()), CTX, EVIL_ARGS)
    assert result.ok is True
    assert user_db.queried_user_id == ObjectId(CTX.user_id)  # KHÔNG phải user_id trong EVIL_ARGS


async def test_execute_tool_ignores_user_id_in_arguments(monkeypatch: pytest.MonkeyPatch):
    """V2 lock-in qua execute_tool: arguments chứa user_id lạ vẫn query đúng ctx.user_id."""
    user_db = FakeWatchlistDB(["FPT"])
    monkeypatch.setattr("app.agent.tools.registry.get_database", lambda name: user_db)
    call = ToolCall(id="w1", name="get_my_watchlist", arguments=EVIL_ARGS)
    content, meta = await execute_tool(FixtureGateway(Policy.load()), CTX, call)
    assert meta["ok"] is True
    assert user_db.queried_user_id == ObjectId(CTX.user_id)
    assert json.loads(content)[0]["ticker"] == "FPT"


async def test_execute_tool_watchlist_returns_error_text_not_null_when_gateway_rejects(
    monkeypatch: pytest.MonkeyPatch,
):
    """V1: khi join giá bị gateway từ chối (ok=False), model phải nhận error, KHÔNG phải chuỗi 'null'."""
    user_db = FakeWatchlistDB(["FPT"])
    monkeypatch.setattr("app.agent.tools.registry.get_database", lambda name: user_db)
    call = ToolCall(id="w2", name="get_my_watchlist", arguments={})
    content, meta = await execute_tool(RejectingGateway(), CTX, call)
    assert content != "null"
    assert meta["ok"] is False
    assert "từ chối" in content
