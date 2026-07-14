from pathlib import Path

from app.agent.gateway.policy import Policy

POLICY_PATH = Path(__file__).parents[3] / "app" / "agent" / "gateway" / "policy.agent_db.yaml"


def test_load_policy_exposes_version_and_defaults():
    policy = Policy.load(POLICY_PATH)
    assert policy.version == 1
    assert policy.defaults.max_response_kb == 50
    assert policy.defaults.default_limit == 20
    assert "$where" in policy.defaults.banned_operators


def test_rule_for_known_collection():
    policy = Policy.load(POLICY_PATH)
    rule = policy.rule_for("history_stock")
    assert rule is not None
    assert rule.size == "large"
    assert rule.require_filter == ["ticker"]
    assert rule.require_series_slice is True


def test_rule_for_small_collection_has_defaults():
    policy = Policy.load(POLICY_PATH)
    rule = policy.rule_for("market_phase")
    assert rule is not None
    assert rule.size == "small"
    assert rule.require_filter == []
    assert rule.require_series_slice is False


def test_rule_for_unknown_collection_returns_none():
    policy = Policy.load(POLICY_PATH)
    assert policy.rule_for("temp_stock_snapshot") is None
    assert policy.rule_for("users") is None
