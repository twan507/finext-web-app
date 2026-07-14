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


# --- Fix round 1: các lỗ bypass phát hiện qua code review ---


def test_banned_operator_in_projection_rejected():
    """Bug 1: Mongo >= 4.4 cho phép aggregation expression trong projection."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"ticker": "FPT"},
            projection={"x": {"$function": {"body": "function() { return 1; }", "args": [], "lang": "js"}}},
            sort=None,
            limit=1,
        )
    assert "$function" in exc.value.message


def test_banned_operator_in_sort_rejected():
    """Bug 1: sort cũng phải bị quét."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"ticker": "FPT"},
            projection={"price": 1},
            sort=[["$where", -1]],
            limit=1,
        )
    assert "$where" in exc.value.message


@pytest.mark.parametrize(
    "match_value",
    [
        {"$ne": "___"},
        {"$gt": ""},
        {"$regex": ".*"},
        {"$nin": ["___"]},
        {"$exists": True},
        {"$in": "FPT"},  # $in không phải list
        {"$in": [{"a": 1}]},  # $in chứa phần tử không phải scalar
        {"$in": []},  # $in rỗng
        {"$ne": None, "$in": ["FPT"]},  # trộn thêm toán tử khác
    ],
)
def test_aggregate_match_key_must_be_specific_value(match_value):
    """Bug 2: $match theo khoá bằng toán tử phủ định vẫn quét toàn bộ collection."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "history_stock",
            [
                {"$match": {"ticker": match_value}},
                {"$project": {"series": {"$slice": ["$series", -20]}}},
            ],
        )
    assert "giá trị cụ thể" in exc.value.message


def test_aggregate_match_key_accepts_in_list_of_scalars():
    """Bug 2: dạng $in với danh sách scalar vẫn hợp lệ."""
    validate_aggregate(
        POLICY,
        "history_stock",
        [
            {"$match": {"ticker": {"$in": ["FPT", "VNM"]}}},
            {"$project": {"series": {"$slice": ["$series", -20]}}},
        ],
    )


def test_aggregate_requires_series_slice():
    """Bug 3: aggregate không áp luật require_series_slice -> trả nguyên mảng series."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "history_stock", [{"$match": {"ticker": "FPT"}}])
    assert "$slice" in exc.value.message
    assert "series" in exc.value.message


def test_aggregate_series_slice_via_addfields_passes():
    """Bug 3: $addFields/$set cũng là cách cắt series hợp lệ."""
    validate_aggregate(
        POLICY,
        "history_stock",
        [
            {"$match": {"ticker": "FPT"}},
            {"$addFields": {"series": {"$slice": ["$series", -5]}}},
        ],
    )


def test_aggregate_series_slice_without_slice_operator_rejected():
    """Bug 3: $project giữ nguyên series (không $slice) phải bị chặn."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "history_stock",
            [{"$match": {"ticker": "FPT"}}, {"$project": {"series": 1}}],
        )
    assert "$slice" in exc.value.message


def test_aggregate_banned_operator_message_has_fix_hint():
    """Bug 4: message banned-operator trong pipeline phải kèm gợi ý sửa."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [{"$match": {"ticker": "FPT"}}, {"$out": "leaked"}],
        )
    assert "$out" in exc.value.message
    assert "viết lại" in exc.value.message


@pytest.mark.parametrize("pipeline", [None, {"$match": {"ticker": "FPT"}}, "[]", 42])
def test_aggregate_non_list_pipeline_rejected(pipeline):
    """Bug 5: pipeline dị dạng phải ra ValidationError, không phải TypeError."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "stock_snapshot", pipeline)
    assert "pipeline" in exc.value.message


@pytest.mark.parametrize("stage", ["$limit", 5, None, ["$match", {"ticker": "FPT"}]])
def test_aggregate_non_dict_stage_rejected(stage):
    """Bug 5: stage không phải dict phải ra ValidationError, không phải TypeError."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "stock_snapshot", [{"$match": {"ticker": "FPT"}}, stage])
    assert "stage" in exc.value.message


@pytest.mark.parametrize("bad_slice", ["x", [], {"n": 1}, [1, 2, 3], ["a"], [-20, "x"], None])
def test_malformed_slice_in_projection_rejected(bad_slice):
    """Bug 6: $slice dị dạng phải ra ValidationError, không phải TypeError/IndexError."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": "FPT"},
            projection={"ticker": 1, "series": {"$slice": bad_slice}},
            sort=None,
            limit=1,
        )
    assert "$slice" in exc.value.message


def test_slice_as_two_element_list_passes():
    """Bug 6: dạng [skip, limit] hợp lệ vẫn phải qua."""
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "series": {"$slice": [-20, 20]}},
        sort=None,
        limit=1,
    )
    assert limit == 1


@pytest.mark.parametrize("bad_limit", [0, -1, -50])
def test_non_positive_limit_rejected(bad_limit):
    """Lỗi nhỏ: limit <= 0 không bị chặn."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"ticker": "FPT"},
            projection={"price": 1},
            sort=None,
            limit=bad_limit,
        )
    assert "limit" in exc.value.message
