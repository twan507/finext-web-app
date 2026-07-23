"""Test gate advanced + chèn persona cho mode=portfolio (helper thuần trong router chat)."""
from app.agent.adapters.base import SystemBlock
from app.routers.chat import portfolio_access_ok, portfolio_system_block


def test_access_requires_advanced_feature():
    assert portfolio_access_ok(["advanced_feature"]) is True
    assert portfolio_access_ok(["broker_feature"]) is True
    assert portfolio_access_ok(["manager_feature"]) is True
    assert portfolio_access_ok(["admin_feature"]) is True


def test_access_denies_basic_or_none():
    assert portfolio_access_ok(["basic_feature"]) is False
    assert portfolio_access_ok([]) is False


def test_block_only_for_portfolio_mode():
    blk = portfolio_system_block("portfolio")
    assert isinstance(blk, SystemBlock)
    assert portfolio_system_block(None) is None
