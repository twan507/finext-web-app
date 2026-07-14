from pathlib import Path

import yaml

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


# --- Fix round 4: V2 ép bất biến require_series_slice => allow_aggregate=false ở loader ---


def _write_policy(tmp_path: Path, collections: dict) -> Path:
    """Ghi một policy YAML tạm để test riêng logic loader, không đụng file YAML thật."""
    raw = {
        "version": 1,
        "defaults": {
            "max_response_kb": 50,
            "max_time_ms": 5000,
            "default_limit": 20,
            "max_limit": 50,
            "banned_operators": ["$where"],
        },
        "collections": collections,
    }
    path = tmp_path / "policy_tmp.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")
    return path


def test_require_series_slice_forces_allow_aggregate_false(tmp_path):
    """V2: require_series_slice:true + allow_aggregate:true (YAML quên tắt) -> loader ép về False."""
    path = _write_policy(
        tmp_path,
        {
            "big_array_coll": {
                "size": "large",
                "key": "ticker",
                "require_filter": ["ticker"],
                "require_series_slice": True,
                "allow_aggregate": True,  # cố tình để hở — loader phải ép False
            }
        },
    )
    rule = Policy.load(path).rule_for("big_array_coll")
    assert rule is not None
    assert rule.allow_aggregate is False


def test_require_series_slice_default_aggregate_also_forced_false(tmp_path):
    """V2: require_series_slice:true mà không nêu allow_aggregate (mặc định True) -> vẫn ép False."""
    path = _write_policy(
        tmp_path,
        {"big_array_coll": {"size": "large", "require_series_slice": True}},
    )
    rule = Policy.load(path).rule_for("big_array_coll")
    assert rule is not None
    assert rule.allow_aggregate is False


def test_flat_collection_keeps_allow_aggregate_true(tmp_path):
    """V2 không ép oan: collection không require_series_slice giữ nguyên allow_aggregate=True."""
    path = _write_policy(
        tmp_path,
        {"flat_coll": {"size": "large", "key": "ticker"}},
    )
    rule = Policy.load(path).rule_for("flat_coll")
    assert rule is not None
    assert rule.allow_aggregate is True
