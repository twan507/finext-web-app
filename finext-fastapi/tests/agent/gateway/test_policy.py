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


# --- Fix round 3: cờ allow_aggregate + max_slice cho collection có mảng lớn ---


def test_collection_with_big_array_disallows_aggregate_and_caps_slice():
    """F1: history_stock (mảng series dài) -> cấm aggregate + giới hạn $slice."""
    rule = Policy.load(POLICY_PATH).rule_for("history_stock")
    assert rule is not None
    assert rule.allow_aggregate is False
    assert rule.max_slice == 250


def test_flat_collections_allow_aggregate_by_default():
    """F1: mặc định allow_aggregate=True -> collection phẳng không đổi hành vi."""
    policy = Policy.load(POLICY_PATH)
    for name in ("stock_snapshot", "market_phase", "industry_snapshot"):
        rule = policy.rule_for(name)
        assert rule is not None
        assert rule.allow_aggregate is True
        assert rule.max_slice is None
