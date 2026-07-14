import pytest

from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext

CTX = GatewayContext(request_id="test-req", user_id="test-user")


@pytest.fixture
def gateway() -> FixtureGateway:
    return FixtureGateway(Policy.load())


async def test_find_returns_matching_docs(gateway: FixtureGateway):
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["ticker"] == "FPT"
    assert result.data[0]["price"] == 118.5
    assert "price" in result.data[0]
    assert "volume" not in result.data[0]  # projection được áp dụng
    assert result.meta["collection"] == "stock_snapshot"


async def test_find_applies_limit(gateway: FixtureGateway):
    result = await gateway.find(CTX, "stock_snapshot", filter={}, projection={"ticker": 1}, limit=1)
    assert result.data is not None
    assert len(result.data) == 1


async def test_find_rejects_invalid_query_with_hint(gateway: FixtureGateway):
    result = await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection=None)
    assert result.ok is False
    assert result.data is None
    assert result.error is not None
    assert "projection" in result.error


async def test_find_rejects_collection_outside_whitelist(gateway: FixtureGateway):
    result = await gateway.find(CTX, "users", filter={}, projection={"email": 1})
    assert result.ok is False
    assert result.error is not None
    assert "không nằm trong phạm vi dữ liệu" in result.error


async def test_find_on_small_collection_without_projection(gateway: FixtureGateway):
    result = await gateway.find(CTX, "data_briefing", filter={"type": "core"})
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["as_of"] == "2026-07-14T15:02"
