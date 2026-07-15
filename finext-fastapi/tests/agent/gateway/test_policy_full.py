import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_aggregate, validate_find

POLICY = Policy.load()

ALL_33 = [
    "stock_info", "stock_snapshot", "stock_recent", "stock_finstats", "stock_nntd", "stock_itd",
    "industry_info", "industry_snapshot", "industry_recent", "industry_finstats",
    "group_snapshot", "group_recent",
    "market_snapshot", "market_recent", "market_nntd", "market_itd",
    "history_stock", "history_industry", "history_index",
    "history_finratios_stock", "history_finratios_industry",
    "market_phase", "market_phase_history", "phase_basket", "phase_trading", "phase_industry", "phase_perf",
    "other_data", "data_briefing",
    "news_today_feed", "news_today_content", "news_history_feed", "news_history_content",
]


def test_all_33_collections_whitelisted():
    assert len(ALL_33) == 33
    for name in ALL_33:
        assert POLICY.rule_for(name) is not None, f"{name} thiếu trong policy"


def test_unknown_still_rejected():
    assert POLICY.rule_for("temp_stock_snapshot") is None
    assert POLICY.rule_for("users") is None


def test_stock_snapshot_point_read_ok():
    limit = validate_find(POLICY, "stock_snapshot", {"ticker": "FPT"}, {"price": 1}, None, 1)
    assert limit == 1


def test_history_stock_requires_slice():
    with pytest.raises(ValidationError):
        validate_find(POLICY, "history_stock", {"ticker": "FPT"}, {"series": 1}, None, 1)
    validate_find(POLICY, "history_stock", {"ticker": "FPT"}, {"series": {"$slice": -104}}, None, 1)


def test_history_finratios_aggregate_blocked():
    with pytest.raises(ValidationError):
        validate_aggregate(POLICY, "history_finratios_stock", [{"$match": {"ticker": "HPG"}}])


def test_market_phase_history_date_range_ok():
    validate_find(
        POLICY, "market_phase_history",
        {"date": {"$gte": "2022-01-01", "$lte": "2022-12-31"}},
        {"date": 1, "phase_label": 1}, [["date", 1]], 20,
    )


def test_industry_rank_aggregate_ok():
    # Workflow 3.6: rank ngành, anchor-match, không cần $limit (Task 3 nới)
    validate_aggregate(
        POLICY, "industry_snapshot",
        [{"$match": {"industry_name": "Tài chính ngân hàng"}}, {"$project": {"ws": "$money_flow_score.week_score"}}],
    )
