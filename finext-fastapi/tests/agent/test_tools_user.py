from typing import Any

from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.tools.user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

CTX = GatewayContext(request_id="r1", user_id="507f1f77bcf86cd799439011")


class FakeWatchlistDB:
    def __init__(self, tickers: list[str]) -> None:
        self._tickers = tickers
        self.queried_user_id: Any = None

    def __getitem__(self, name: str) -> "FakeWatchlistDB":
        return self

    async def find_one(self, filter: dict[str, Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
        self.queried_user_id = filter.get("user_id")
        return {"tickers": self._tickers}


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
