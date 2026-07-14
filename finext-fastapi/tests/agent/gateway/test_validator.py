from dataclasses import replace

import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_aggregate, validate_find

POLICY = Policy.load()


def _policy_allowing_aggregate(collection: str) -> Policy:
    """Bản sao POLICY nhưng mở lại aggregate cho `collection`.

    Fix round 3 cấm aggregate trên history_stock (F2) nên các luật G3/G5 (neo $match, cắt series
    trong pipeline) không còn đường chạm tới qua policy thật. Code G5 vẫn giữ làm defense in depth
    cho collection tương lai có mảng lớn mà vẫn mở aggregate — policy này giữ nguyên độ phủ test đó.
    """
    rule = POLICY.collections[collection]
    collections = {**POLICY.collections, collection: replace(rule, allow_aggregate=True)}
    return Policy(version=POLICY.version, defaults=POLICY.defaults, collections=collections)


# history_stock nhưng aggregate được mở lại — chỉ dùng để test G3/G5.
AGG_POLICY = _policy_allowing_aggregate("history_stock")


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
        validate_aggregate(AGG_POLICY, "history_stock", [{"$group": {"_id": "$ticker"}}])
    assert "$match" in exc.value.message


def test_aggregate_valid_pipeline_passes():
    validate_aggregate(
        AGG_POLICY,
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
            AGG_POLICY,
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
        AGG_POLICY,
        "history_stock",
        [
            {"$match": {"ticker": {"$in": ["FPT", "VNM"]}}},
            {"$project": {"series": {"$slice": ["$series", -20]}}},
        ],
    )


def test_aggregate_requires_series_slice():
    """Bug 3: aggregate không áp luật require_series_slice -> trả nguyên mảng series."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(AGG_POLICY, "history_stock", [{"$match": {"ticker": "FPT"}}])
    assert "$slice" in exc.value.message
    assert "series" in exc.value.message


def test_aggregate_series_slice_via_addfields_passes():
    """Bug 3: $addFields/$set cũng là cách cắt series hợp lệ."""
    validate_aggregate(
        AGG_POLICY,
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
            AGG_POLICY,
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


# --- Fix round 2: 3 lỗ bypass mới (L1 alias series, L2 decoy $match, L3 $unionWith) ---


def test_aggregate_series_alias_bypass_rejected():
    """L1: field khác trong cùng $project bê nguyên mảng series (không qua $slice)."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {"$project": {"series": {"$slice": ["$series", -20]}, "series_full": "$series"}},
            ],
        )
    assert "series" in exc.value.message
    assert "$slice" in exc.value.message


def test_aggregate_series_alias_via_addfields_rejected():
    """L1: $addFields cũng có thể alias nguyên mảng series."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {"$addFields": {"series": {"$slice": ["$series", -5]}, "backup": "$series"}},
            ],
        )
    assert "$slice" in exc.value.message


def test_aggregate_series_ref_in_group_rejected():
    """L1: $group $push nguyên mảng series TRƯỚC stage $slice — stage $slice sau chỉ là bù nhìn."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {"$group": {"_id": "$ticker", "raw": {"$push": "$series"}}},
                {"$project": {"series": {"$slice": ["$series", -20]}}},
            ],
        )
    assert "$slice" in exc.value.message


def test_aggregate_series_subfield_ref_rejected():
    """L1: tham chiếu '$series.close' cũng kéo nguyên mảng."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {"$project": {"series": {"$slice": ["$series", -20]}, "closes": "$series.close"}},
            ],
        )
    assert "$slice" in exc.value.message


def test_find_projection_series_alias_bypass_rejected():
    """L1 (bản find): projection alias '$series' qua field khác."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": "FPT"},
            projection={"ticker": 1, "series": {"$slice": -20}, "series_full": "$series"},
            sort=None,
            limit=1,
        )
    assert "series" in exc.value.message
    assert "$slice" in exc.value.message


def test_find_projection_without_alias_still_passes():
    """G6 không chặn oan: projection chuẩn nhiều field + $slice vẫn qua."""
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "exchange": 1, "series": {"$slice": [-20, 20]}},
        sort=None,
        limit=1,
    )
    assert limit == 1


def test_aggregate_decoy_match_after_group_rejected():
    """L2: $match trên field GIẢ do $group tạo ra, đặt sau $group — chỉ để qua mặt validator."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [
                {
                    "$group": {
                        "_id": "$industry",
                        "avg_price": {"$avg": "$price"},
                        "ticker": {"$first": {"$literal": "FPT"}},
                    }
                },
                {"$match": {"ticker": "FPT"}},
            ],
        )
    assert "$limit" in exc.value.message


def test_aggregate_match_must_be_first_stage():
    """L2 (bản require_filter): $match không ở đầu pipeline thì $group đã quét cả collection."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$group": {"_id": "$ticker", "n": {"$sum": 1}}},
                {"$match": {"ticker": "FPT"}},
            ],
        )
    assert "$match" in exc.value.message


def test_aggregate_union_with_rejected():
    """L3: $unionWith truy vấn xuyên collection — phá whitelist."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "market_phase", [{"$unionWith": {"coll": "users", "pipeline": []}}])
    assert "$unionWith" in exc.value.message


def test_aggregate_large_without_require_filter_needs_limit():
    """G4: large + không require_filter -> bắt buộc có $limit, nếu không sẽ quét cả collection."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [{"$sort": {"change_pct": -1}}, {"$project": {"ticker": 1, "change_pct": 1}}],
        )
    assert "$limit" in exc.value.message


def test_aggregate_large_without_require_filter_passes_with_limit():
    """G4: 'top N mã tăng mạnh' vẫn hợp lệ khi có $limit trong ngưỡng."""
    validate_aggregate(
        POLICY,
        "stock_snapshot",
        [
            {"$sort": {"change_pct": -1}},
            {"$limit": 20},
            {"$project": {"ticker": 1, "change_pct": 1}},
        ],
    )


@pytest.mark.parametrize("bad_limit", [0, -5, 500, "20", True, None])
def test_aggregate_limit_stage_value_must_be_int_in_range(bad_limit):
    """G4: $limit dị dạng / vượt max_limit không được tính là hợp lệ."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "stock_snapshot", [{"$sort": {"price": -1}}, {"$limit": bad_limit}])
    assert "$limit" in exc.value.message


@pytest.mark.parametrize(
    "stage",
    [
        {},  # 0 key
        {"$match": {"ticker": "FPT"}, "$limit": 5},  # 2 key trong 1 stage
        {"match": {"ticker": "FPT"}},  # key không bắt đầu bằng $
    ],
)
def test_aggregate_stage_must_have_exactly_one_dollar_key(stage):
    """G1: hình dạng stage phải chuẩn — 1 key duy nhất, bắt đầu bằng $."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "stock_snapshot", [stage, {"$limit": 5}])
    assert "stage" in exc.value.message


def test_aggregate_history_stock_valid_pipeline_still_passes():
    """Regression: pipeline hợp lệ chuẩn trên history_stock không bị grammar mới chặn oan."""
    validate_aggregate(
        AGG_POLICY,
        "history_stock",
        [{"$match": {"ticker": "FPT"}}, {"$project": {"series": {"$slice": ["$series", -20]}}}],
    )


# --- Fix round 3: L4 ($slice khổng lồ ở field phụ) + L5 ($$ROOT) ---
# Ranh giới mới: collection có mảng lớn (history_stock) CẤM aggregate; collection phẳng vẫn cho.


def test_find_series_alias_inside_slice_rejected():
    """L4 (find): field phụ 'nằm trong $slice' nhưng $slice ["$series", 100000] = lấy nguyên mảng."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": "FPT"},
            projection={
                "ticker": 1,
                "series": {"$slice": -20},
                "series_all": {"$slice": ["$series", 100000]},
            },
            sort=None,
            limit=1,
        )
    assert "series_all" in exc.value.message
    assert "series" in exc.value.message


def test_aggregate_on_collection_with_big_array_rejected():
    """F2: history_stock không hỗ trợ aggregate — chặn ngay, kèm gợi ý dùng db_find."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {"$project": {"series": {"$slice": ["$series", -20]}, "raw": "$$ROOT"}},
            ],
        )
    msg = exc.value.message
    assert "aggregate" in msg
    assert "db_find" in msg
    assert "$slice" in msg
    assert "stock_snapshot" not in msg  # không tiết lộ collection khác


def test_aggregate_l4_slice_alias_on_big_array_collection_rejected():
    """L4 (aggregate): field phụ 'nằm trong $slice' nhưng slice 100000 = nguyên mảng — chặn bởi F2.

    Đây là lý do phải cấm aggregate: G5 chỉ soi $slice của key 'series', không soi field phụ.
    """
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "history_stock",
            [
                {"$match": {"ticker": "FPT"}},
                {
                    "$project": {
                        "series": {"$slice": ["$series", -20]},
                        "series_all": {"$slice": ["$series", 100000]},
                    }
                },
            ],
        )
    assert "không hỗ trợ aggregate" in exc.value.message


@pytest.mark.parametrize("system_var", ["$$ROOT", "$$CURRENT", "$$ROOT.series", "$$CURRENT.series"])
def test_aggregate_system_var_on_flat_collection_rejected(system_var):
    """F3/L5: $$ROOT bê nguyên document — cấm ở MỌI collection, kể cả pipeline hợp lệ có $limit."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [
                {"$sort": {"change_pct": -1}},
                {"$limit": 20},
                {"$project": {"ticker": 1, "raw": system_var}},
            ],
        )
    msg = exc.value.message
    assert system_var.split(".")[0] in msg
    assert "liệt kê tường minh" in msg


def test_aggregate_system_var_nested_in_group_rejected():
    """F3: $$ROOT lồng sâu trong $push cũng phải bị bắt (quét đệ quy)."""
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [
                {"$limit": 20},
                {"$group": {"_id": "$industry", "docs": {"$push": "$$ROOT"}}},
            ],
        )
    assert "$$ROOT" in exc.value.message


def test_find_projection_system_var_rejected():
    """F3 (bản find): projection cũng không được dùng $$ROOT."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"ticker": "FPT"},
            projection={"ticker": 1, "raw": "$$ROOT"},
            sort=None,
            limit=1,
        )
    assert "$$ROOT" in exc.value.message


def test_history_stock_find_still_passes_after_aggregate_ban():
    """Không chặn oan: đường dùng đúng của history_stock là db_find + $slice."""
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "series": {"$slice": -20}},
        sort=None,
        limit=1,
    )
    assert limit == 1


@pytest.mark.parametrize("big_slice", [-1000, 1000, [0, 100000], [-100000, 100000]])
def test_history_stock_find_slice_over_max_rejected(big_slice):
    """F1: max_slice=250 chặn $slice lấy nguyên mảng series qua đường find."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": "FPT"},
            projection={"ticker": 1, "series": {"$slice": big_slice}},
            sort=None,
            limit=1,
        )
    assert "250" in exc.value.message


def test_flat_collection_aggregate_with_limit_still_passes():
    """F2 không chặn oan: thống kê trên collection phẳng vẫn chạy."""
    validate_aggregate(
        POLICY,
        "stock_snapshot",
        [
            {"$match": {"industry": "Ngân hàng"}},
            {"$group": {"_id": "$industry", "avg_price": {"$avg": "$price"}}},
            {"$limit": 20},
        ],
    )


def test_aggregate_in_list_longer_than_max_limit_rejected():
    """F4: $in dài vô hạn = quét cả collection dù vẫn là 'giá trị cụ thể'."""
    tickers = [f"T{n:03d}" for n in range(POLICY.defaults.max_limit + 1)]
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            AGG_POLICY,
            "history_stock",
            [
                {"$match": {"ticker": {"$in": tickers}}},
                {"$project": {"series": {"$slice": ["$series", -20]}}},
            ],
        )
    msg = exc.value.message
    assert "$in" in msg
    assert str(POLICY.defaults.max_limit) in msg


def test_aggregate_in_list_at_max_limit_passes():
    """F4 không chặn oan: đúng ngưỡng max_limit vẫn hợp lệ."""
    tickers = [f"T{n:03d}" for n in range(POLICY.defaults.max_limit)]
    validate_aggregate(
        AGG_POLICY,
        "history_stock",
        [
            {"$match": {"ticker": {"$in": tickers}}},
            {"$project": {"series": {"$slice": ["$series", -20]}}},
        ],
    )


# --- Fix round 4: V1 (guard input non-dict cho find) + V3 (specificity require_filter) ---


def test_find_non_dict_projection_rejected():
    """V1: projection không phải dict -> ValidationError, không phải AttributeError (500)."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": "FPT"},
            projection="x",
            sort=None,
            limit=1,
        )
    assert "projection" in exc.value.message


def test_find_non_dict_filter_rejected():
    """V1: filter không phải dict -> ValidationError, không phải TypeError (500)."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter=1,
            projection={"series": {"$slice": -20}},
            sort=None,
            limit=1,
        )
    assert "filter" in exc.value.message


def test_find_non_list_sort_rejected():
    """V1: sort không phải list -> ValidationError, không phải TypeError (500)."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"ticker": "FPT"},
            projection={"price": 1},
            sort={"ticker": 1},
            limit=1,
        )
    assert "sort" in exc.value.message


def test_find_require_filter_ne_operator_rejected():
    """V3: require_filter ở find phải là giá trị cụ thể — $ne quét toàn bộ collection."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": {"$ne": "X"}},
            projection={"ticker": 1, "series": {"$slice": -20}},
            sort=None,
            limit=1,
        )
    assert "giá trị cụ thể" in exc.value.message


@pytest.mark.parametrize(
    "bad_value",
    [
        {"$regex": ".*"},
        {"$exists": True},
        {"$gt": ""},
        {"$nin": ["X"]},
    ],
)
def test_find_require_filter_non_specific_value_rejected(bad_value):
    """V3: mọi toán tử quét-rộng trên khoá require_filter đều bị chặn."""
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={"ticker": bad_value},
            projection={"ticker": 1, "series": {"$slice": -20}},
            sort=None,
            limit=1,
        )
    assert "giá trị cụ thể" in exc.value.message


def test_find_require_filter_scalar_still_passes():
    """V3 không chặn oan: giá trị scalar vẫn hợp lệ."""
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "series": {"$slice": -20}},
        sort=None,
        limit=1,
    )
    assert limit == 1


def test_find_require_filter_in_list_still_passes():
    """V3 không chặn oan: {"$in": [scalar,...]} trong ngưỡng max_limit vẫn hợp lệ."""
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": {"$in": ["FPT", "HPG"]}},
        projection={"ticker": 1, "series": {"$slice": -20}},
        sort=None,
        limit=1,
    )
    assert limit == 1
