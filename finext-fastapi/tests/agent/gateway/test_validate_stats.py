import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_stats


def _policy_with_stats() -> Policy:
    """Policy thật nhưng bật stats_fields cho 1 collection series (KHÔNG phụ thuộc giá trị YAML)."""
    policy = Policy.load()
    policy.collections["history_finratios_industry"].stats_fields = ["series.pe", "series.pb"]
    return policy


def test_valid_call_returns_rule():
    policy = _policy_with_stats()
    rule = validate_stats(
        policy, "history_finratios_industry",
        field="series.pe", ops=["min", "max", "latest"],
        filter={"industry_name": "Toàn bộ thị trường"},
    )
    assert rule.name == "history_finratios_industry"


def test_collection_without_stats_fields_is_rejected():
    policy = Policy.load()
    policy.collections["history_finratios_industry"].stats_fields = []  # ép rỗng, độc lập giá trị YAML
    with pytest.raises(ValidationError, match="không hỗ trợ"):
        validate_stats(
            policy, "history_finratios_industry",
            field="series.pe", ops=["min"], filter={"industry_name": "X"},
        )


def test_unknown_collection_rejected():
    with pytest.raises(ValidationError, match="phạm vi dữ liệu"):
        validate_stats(_policy_with_stats(), "khong_ton_tai", field="series.pe", ops=["min"], filter={})


def test_field_not_in_allowlist_rejected():
    with pytest.raises(ValidationError, match="field"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.secret", ops=["min"], filter={"industry_name": "X"},
        )


def test_op_outside_whitelist_rejected():
    with pytest.raises(ValidationError, match="Phép không hợp lệ"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.pe", ops=["min", "sum"], filter={"industry_name": "X"},
        )


def test_empty_ops_rejected():
    with pytest.raises(ValidationError, match="ops"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.pe", ops=[], filter={"industry_name": "X"},
        )


def test_missing_require_filter_rejected():
    # history_finratios_industry require_filter=[industry_name] → filter rỗng phải bị chặn.
    with pytest.raises(ValidationError, match="industry_name"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.pe", ops=["min"], filter={},
        )


def test_banned_operator_in_filter_rejected():
    with pytest.raises(ValidationError, match="không được phép"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.pe", ops=["min"],
            filter={"industry_name": "X", "$where": "1"},
        )


def test_non_dict_filter_rejected():
    with pytest.raises(ValidationError, match="filter"):
        validate_stats(
            _policy_with_stats(), "history_finratios_industry",
            field="series.pe", ops=["min"], filter=["industry_name"],
        )
