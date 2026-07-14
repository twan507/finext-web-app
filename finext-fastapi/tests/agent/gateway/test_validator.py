import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_aggregate, validate_find

POLICY = Policy.load()


def test_unknown_collection_rejected_without_leaking_whitelist():
    with pytest.raises(ValidationError) as exc:
        validate_find(POLICY, "users", filter={}, projection={"email": 1}, sort=None, limit=1)
    msg = exc.value.message
    assert "không nằm trong phạm vi dữ liệu" in msg
    assert "stock_snapshot" not in msg  # R6: không tiết lộ collection ngoài whitelist


def test_large_collection_requires_projection():
    with pytest.raises(ValidationError) as exc:
        validate_find(POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection=None, sort=None, limit=1)
    assert "projection" in exc.value.message


def test_large_collection_accepts_valid_query_and_returns_limit():
    limit = validate_find(
        POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, sort=None, limit=None
    )
    assert limit == POLICY.defaults.default_limit


def test_limit_over_max_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection={"price": 1}, sort=None, limit=500
        )
    assert "50" in exc.value.message


def test_small_collection_allows_empty_filter_and_no_projection():
    limit = validate_find(POLICY, "market_phase", filter={}, projection=None, sort=None, limit=None)
    assert limit == POLICY.defaults.default_limit


def test_require_filter_enforced():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={},
            projection={"series": {"$slice": -20}},
            sort=None,
            limit=1,
        )
    assert "ticker" in exc.value.message


def test_require_series_slice_enforced():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY, "history_stock", filter={"ticker": "FPT"}, projection={"series": 1}, sort=None, limit=1
        )
    assert "$slice" in exc.value.message


def test_history_stock_valid_query_passes():
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "series": {"$slice": -20}},
        sort=None,
        limit=1,
    )
    assert limit == 1


def test_banned_operator_nested_in_filter_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"$and": [{"ticker": "FPT"}, {"$where": "this.price > 0"}]},
            projection={"price": 1},
            sort=None,
            limit=1,
        )
    assert "$where" in exc.value.message


def test_banned_stage_in_pipeline_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [{"$match": {"ticker": "FPT"}}, {"$lookup": {"from": "stock_info", "as": "x"}}],
        )
    assert "$lookup" in exc.value.message


def test_aggregate_on_large_collection_requires_match_with_key():
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "history_stock", [{"$group": {"_id": "$ticker"}}])
    assert "$match" in exc.value.message


def test_aggregate_valid_pipeline_passes():
    validate_aggregate(
        POLICY,
        "history_stock",
        [{"$match": {"ticker": "FPT"}}, {"$project": {"series": {"$slice": ["$series", -20]}}}],
    )
