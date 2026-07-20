"""Kiểm tra query theo policy. Thuần logic — unit test không cần Mongo (doc 01 §3-A)."""

from typing import Any

from .policy import CollectionRule, Policy
from .stats_compute import STATS_OPS

# Stage có thể cắt mảng dài bằng $slice trong aggregate.
SLICE_STAGES = ("$project", "$addFields", "$set")
SCALAR_TYPES = (str, int, float, bool)

# Toán tử khoảng hợp lệ cho require_filter của find (đã bị _effective_limit cap ≤ max_limit).
# KHÔNG dùng cho anchor $match của aggregate — range không neo cardinality (xem _has_anchor_match).
_RANGE_OPS = frozenset(("$gte", "$gt", "$lte", "$lt"))

# Nợ kỹ thuật đã duyệt: tên field mảng dài hard-code, không tham số hoá qua policy.
SERIES_FIELD = "series"
SERIES_REF = "$series"

# Biến hệ thống trả về NGUYÊN document — không chứa tên field nào nên mọi checker từ vựng đều mù.
SYSTEM_VARS = ("$$ROOT", "$$CURRENT")


class ValidationError(Exception):
    """Lỗi từ chối query. `message` viết bằng ngôn ngữ model hiểu + gợi ý sửa (doc 01 §1)."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _find_banned(node: Any, banned: list[str]) -> str | None:
    """Quét đệ quy mọi key trong filter/projection/pipeline tìm operator cấm."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key in banned:
                return key
            found = _find_banned(value, banned)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_banned(item, banned)
            if found:
                return found
    return None


def _find_banned_in_sort(sort: Any, banned: list[str]) -> str | None:
    """sort dạng [[field, direction]] — field nằm ở vị trí phần tử, không phải key của dict."""
    if isinstance(sort, list):
        for entry in sort:
            if isinstance(entry, (list, tuple)) and entry and entry[0] in banned:
                return str(entry[0])
    return _find_banned(sort, banned)


def _find_system_var(node: Any) -> str | None:
    """Quét đệ quy tìm tham chiếu "$$ROOT"/"$$CURRENT" (hoặc "$$ROOT.x") ở bất kỳ độ sâu nào."""
    if isinstance(node, str):
        for var in SYSTEM_VARS:
            if node == var or node.startswith(var + "."):
                return var
        return None
    if isinstance(node, dict):
        for key, value in node.items():
            found = _find_system_var(key) or _find_system_var(value)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_system_var(item)
            if found:
                return found
    return None


def _check_no_system_var(node: Any, where: str) -> None:
    """F3: $$ROOT/$$CURRENT trả về nguyên document -> bê được cả mảng dài mà không nhắc tên field."""
    found = _find_system_var(node)
    if found:
        raise ValidationError(
            f"Biến hệ thống '{found}' không được phép trong {where} vì nó trả về nguyên document. "
            'Hãy liệt kê tường minh các field cần lấy. Ví dụ: {"ticker": 1, "price": 1}'
        )


def _require_rule(policy: Policy, collection: str) -> CollectionRule:
    rule = policy.rule_for(collection)
    if rule is None:
        raise ValidationError(
            f"Collection '{collection}' không nằm trong phạm vi dữ liệu. "
            "Hãy dùng một collection đã được mô tả trong tài liệu dữ liệu."
        )
    return rule


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _slice_count(rule: CollectionRule, raw: Any) -> int:
    """Số phần tử mà $slice của find lấy ra. $slice hợp lệ: int, hoặc mảng 1-2 int."""
    if _is_int(raw):
        return abs(raw)
    if isinstance(raw, list) and 1 <= len(raw) <= 2 and all(_is_int(n) for n in raw):
        return abs(raw[-1])
    raise ValidationError(
        f"$slice không hợp lệ cho '{rule.name}': phải là số nguyên (ví dụ {{\"series\": {{\"$slice\": -20}}}}) "
        'hoặc mảng [skip, limit] gồm 2 số nguyên (ví dụ {"series": {"$slice": [-20, 20]}}).'
    )


def _check_max_slice(rule: CollectionRule, count: int) -> None:
    if rule.max_slice is not None and count > rule.max_slice:
        raise ValidationError(
            f"$slice quá lớn cho '{rule.name}': tối đa {rule.max_slice} phần tử. Hãy giảm số phần tử yêu cầu."
        )


def _has_unsliced_series_ref(node: Any, inside_slice: bool = False) -> bool:
    """True nếu có tham chiếu "$series" (hoặc "$series.x") KHÔNG nằm trong một $slice.

    Chặn alias kiểu {"series_full": "$series"} — bê nguyên mảng dài qua một tên field khác.
    """
    if isinstance(node, str):
        return not inside_slice and (node == SERIES_REF or node.startswith(SERIES_REF + "."))
    if isinstance(node, dict):
        return any(
            _has_unsliced_series_ref(value, inside_slice or key == "$slice")
            for key, value in node.items()
        )
    if isinstance(node, list):
        return any(_has_unsliced_series_ref(item, inside_slice) for item in node)
    return False


def _check_no_series_alias(rule: CollectionRule, node: Any) -> None:
    if _has_unsliced_series_ref(node):
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài — mọi tham chiếu tới '{SERIES_REF}' "
            "phải nằm trong $slice. Không được gán nguyên mảng series sang field khác. "
            'Ví dụ: {"$project": {"series": {"$slice": ["$series", -20]}}}'
        )


def _has_series_ref(node: Any) -> bool:
    """True nếu có BẤT KỲ tham chiếu nào tới "$series" — kể cả khi nó nằm trong một $slice."""
    if isinstance(node, str):
        return node == SERIES_REF or node.startswith(SERIES_REF + ".")
    if isinstance(node, dict):
        return any(_has_series_ref(value) for value in node.values())
    if isinstance(node, list):
        return any(_has_series_ref(item) for item in node)
    return False


def _check_series_ref_only_in_series_key(rule: CollectionRule, projection: dict[str, Any]) -> None:
    """G6/F5: trong projection, CHỈ key 'series' được tham chiếu $series.

    Chặn {"series_all": {"$slice": ["$series", 100000]}} — "nằm trong $slice" nhưng lấy nguyên mảng.
    """
    for key, value in projection.items():
        if key == SERIES_FIELD or not _has_series_ref(value):
            continue
        raise ValidationError(
            f"Trong projection của '{rule.name}', chỉ field 'series' được phép tham chiếu tới "
            f"'{SERIES_REF}' — field '{key}' cũng đang lấy dữ liệu từ mảng series. Hãy bỏ field này và "
            'chỉ dùng {"series": {"$slice": -20}} để lấy N phần tử mới nhất.'
        )


def _check_series_slice(rule: CollectionRule, projection: dict[str, Any] | None) -> None:
    if not rule.require_series_slice:
        return
    series = (projection or {}).get(SERIES_FIELD)
    if not isinstance(series, dict) or "$slice" not in series:
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài. "
            'Bắt buộc dùng projection dạng {"series": {"$slice": -20}} để lấy N phần tử mới nhất.'
        )
    _check_no_series_alias(rule, projection)
    _check_series_ref_only_in_series_key(rule, projection or {})
    _check_max_slice(rule, _slice_count(rule, series["$slice"]))


def _check_find_banned(
    banned_ops: list[str],
    filter: dict[str, Any] | None,
    projection: dict[str, Any] | None,
    sort: list[list[Any]] | None,
) -> None:
    """Mongo >= 4.4 cho phép aggregation expression trong projection -> phải quét cả 3 nơi."""
    banned = (
        _find_banned(filter, banned_ops)
        or _find_banned(projection, banned_ops)
        or _find_banned_in_sort(sort, banned_ops)
    )
    if banned:
        raise ValidationError(
            f"Toán tử '{banned}' không được phép (kể cả trong projection/sort). "
            "Hãy viết lại query không dùng toán tử này."
        )


def _effective_limit(policy: Policy, limit: int | None) -> int:
    defaults = policy.defaults
    effective = defaults.default_limit if limit is None else limit
    if not _is_int(effective) or effective <= 0:
        raise ValidationError(
            f"limit={effective!r} không hợp lệ — limit phải là số nguyên dương. "
            f"Hãy dùng limit trong khoảng 1..{defaults.max_limit}."
        )
    if effective > defaults.max_limit:
        raise ValidationError(
            f"limit={effective} vượt mức cho phép (tối đa {defaults.max_limit}). Hãy giảm limit hoặc thu hẹp filter."
        )
    return effective


def _check_find_types(filter: Any, projection: Any, sort: Any) -> None:
    """V1: input đến từ LLM chưa chắc đúng kiểu — chặn sớm để tránh AttributeError/TypeError (500)."""
    if filter is not None and not isinstance(filter, dict):
        raise ValidationError(
            f"filter phải là object (dict) hoặc bỏ trống — nhận được {type(filter).__name__}. "
            'Ví dụ: filter={"ticker": "FPT"}'
        )
    if projection is not None and not isinstance(projection, dict):
        raise ValidationError(
            f"projection phải là object (dict) hoặc bỏ trống — nhận được {type(projection).__name__}. "
            'Ví dụ: projection={"ticker": 1, "price": 1}'
        )
    if sort is not None and not isinstance(sort, list):
        raise ValidationError(
            f"sort phải là mảng (list) dạng [[field, 1]] hoặc bỏ trống — nhận được {type(sort).__name__}. "
            'Ví dụ: sort=[["change_pct", -1]]'
        )


def _check_find_require_filter(policy: Policy, rule: CollectionRule, filter: dict[str, Any]) -> None:
    """V3: khoá require_filter phải CÓ MẶT và mang giá trị cụ thể (đồng bộ anchor $match của aggregate)."""
    keys = rule.require_filter
    if not keys:
        return
    hint = " hoặc ".join(keys)
    present = [filter[key] for key in keys if key in filter]
    if not present:
        raise ValidationError(
            f"Collection '{rule.name}' bắt buộc lọc theo khoá: {hint}. "
            f'Ví dụ: filter={{"{keys[0]}": "FPT"}}'
        )
    max_items = policy.defaults.max_limit
    if not any(_is_narrowing_value(value, max_items) for value in present):
        raise ValidationError(
            f"Collection '{rule.name}' phải lọc khoá {hint} theo giá trị cụ thể "
            f'(ví dụ filter={{"{keys[0]}": "FPT"}} hoặc filter={{"{keys[0]}": {{"$in": ["FPT", "HPG"]}}}}), '
            'hoặc khoảng ngày với cận cụ thể ví dụ filter={"date": {"$gte": "2022-01-01"}}. '
            "Không dùng $ne/$nin/$regex/$exists hay cận rỗng vì chúng quét toàn bộ collection. "
            f"Danh sách $in tối đa {max_items} phần tử — hãy thu hẹp lại."
        )


def _check_projection_values(collection: str, projection: dict[str, Any] | None) -> None:
    """Giá trị projection phải là 0/1, hoặc biểu thức dạng dict (vd {"$slice": -20}).

    BẪY THẬT ĐÃ GẶP: từ Mongo 4.4, value trong projection được hiểu là aggregation expression.
    Nên {"title": "1"} — CHUỖI thay vì SỐ — là một hằng số: mọi document trả về đúng chữ "1",
    query vẫn thành công, không log lỗi nào. Model không hiểu vì sao dữ liệu vô nghĩa nên gọi
    lại vòng này tới vòng khác; một lượt từng lặp 10 vòng, đốt hơn 600 nghìn token rồi trả cho
    khách một câu vô dụng. Chặn tại đây để model nhận lỗi rõ ràng và sửa ngay ở vòng sau.
    """
    if not projection:
        return
    for key, value in projection.items():
        if isinstance(value, dict):
            continue  # biểu thức — đã có _check_find_banned và _check_series_* lo phần ngữ nghĩa
        if isinstance(value, bool) or (isinstance(value, (int, float)) and value in (0, 1)):
            continue
        raise ValidationError(
            f"Trong projection của '{collection}', field '{key}' có giá trị {value!r} không hợp lệ. "
            'Giá trị phải là SỐ 1 (lấy field) hoặc 0 (bỏ field), ví dụ {"ticker": 1, "price": 1}. '
            'Đặc biệt KHÔNG dùng chuỗi "1" — Mongo hiểu đó là hằng số nên mọi document sẽ trả về '
            "đúng chữ đó thay vì dữ liệu thật."
        )


def validate_find(
    policy: Policy,
    collection: str,
    filter: Any,
    projection: Any,
    sort: Any,
    limit: int | None,
) -> int:
    """Trả limit hiệu lực. Raise ValidationError nếu vi phạm.

    filter/projection/sort để kiểu Any vì đến từ LLM, chưa đảm bảo đúng cấu trúc (xem _check_find_types).
    """
    _check_find_types(filter, projection, sort)
    rule = _require_rule(policy, collection)

    _check_find_banned(policy.defaults.banned_operators, filter, projection, sort)
    _check_no_system_var(projection, "projection")

    _check_find_require_filter(policy, rule, filter or {})

    if rule.size == "large" and not projection:
        example = f'{{"{rule.key}": 1}}' if rule.key else '{"<field_1>": 1, "<field_2>": 1}'
        raise ValidationError(
            f"Collection '{collection}' lớn — bắt buộc có projection để chỉ lấy field cần thiết. "
            f"Ví dụ: projection={example}"
        )

    _check_series_slice(rule, projection)
    # Đặt CUỐI có chủ đích: các luật series ở trên cho thông báo cụ thể hơn nhiều (chỉ rõ phải
    # dùng $slice thế nào). Check này là lưới chung, chỉ nên bắt phần các luật kia không phủ.
    _check_projection_values(collection, projection)

    return _effective_limit(policy, limit)


def _require_pipeline(pipeline: Any) -> list[dict[str, Any]]:
    """G1: pipeline là mảng, mỗi stage là dict có ĐÚNG 1 key bắt đầu bằng '$'."""
    example = 'Ví dụ: pipeline=[{"$match": {"ticker": "FPT"}}, {"$limit": 5}]'
    if not isinstance(pipeline, list):
        raise ValidationError(f"pipeline phải là một mảng các stage. {example}")
    for stage in pipeline:
        if not isinstance(stage, dict):
            raise ValidationError(
                f'Mỗi stage trong pipeline phải là object dạng {{"$match": ...}} — '
                f"nhận được {type(stage).__name__}. {example}"
            )
        if len(stage) != 1:
            raise ValidationError(
                f"Mỗi stage trong pipeline phải có đúng 1 toán tử — nhận được {len(stage)} key: "
                f"{sorted(stage)}. Hãy tách thành nhiều stage riêng. {example}"
            )
        name = next(iter(stage))
        if not (isinstance(name, str) and name.startswith("$")):
            raise ValidationError(
                f"Tên stage '{name}' không hợp lệ — stage phải bắt đầu bằng '$'. {example}"
            )
    return pipeline


def _is_specific_value(value: Any, max_items: int) -> bool:
    """Giá trị khoá đủ hẹp: scalar, hoặc {"$in": [scalar,...]}. Loại $ne/$gt/$regex/$nin...

    F4: $in dài hơn max_items không còn là "cụ thể" — nó quét gần như cả collection.
    """
    if isinstance(value, SCALAR_TYPES):
        return True
    if isinstance(value, dict) and list(value.keys()) == ["$in"]:
        candidates = value["$in"]
        return (
            isinstance(candidates, list)
            and 0 < len(candidates) <= max_items
            and all(isinstance(item, SCALAR_TYPES) for item in candidates)
        )
    return False


def _is_narrowing_value(value: Any, max_items: int) -> bool:
    """Giá trị THU HẸP hợp lệ cho require_filter của find (KHÔNG dùng cho anchor $match của aggregate):
    scalar, {"$in": [scalar...]}, hoặc khoảng $gte/$gt/$lte/$lt (một hoặc hai đầu) với MỌI cận là scalar
    khác rỗng/None.

    An toàn cho find vì _effective_limit đã cap số dòng ≤ max_limit. Chặn sentinel quét-toàn-bộ {"$gt": ""}.
    KHÔNG chấp nhận $ne/$nin/$regex/$exists (phủ định/quét), cũng KHÔNG chấp nhận bool (date/số thật không phải bool).
    """
    if _is_specific_value(value, max_items):
        return True
    if not (isinstance(value, dict) and value and set(value).issubset(_RANGE_OPS)):
        return False
    return all(type(v) in (str, int, float) and v not in ("", None) for v in value.values())


def _check_aggregate_anchor_match(
    policy: Policy, rule: CollectionRule, pipeline: list[dict[str, Any]]
) -> None:
    """G3: có require_filter -> stage ĐẦU TIÊN phải là $match theo khoá với giá trị cụ thể.

    Neo ở pipeline[0]: $match đặt sau $group/$sort chỉ là decoy — collection đã bị quét hết rồi.
    """
    keys = rule.require_filter
    if not keys:
        return
    max_items = policy.defaults.max_limit
    hint = " hoặc ".join(str(k) for k in keys)
    example = f'{{"$match": {{"{keys[0]}": "FPT"}}}}'
    first = pipeline[0] if pipeline else {}
    match = first.get("$match")
    values = [match[key] for key in keys if key in match] if isinstance(match, dict) else []
    if not values:
        raise ValidationError(
            f"Collection '{rule.name}' lớn — stage ĐẦU TIÊN của pipeline bắt buộc là $match theo khoá: {hint} "
            f"($match ở vị trí khác không được tính vì các stage trước nó đã quét toàn bộ collection). "
            f"Ví dụ: pipeline=[{example}, ...]"
        )
    if not any(_is_specific_value(value, max_items) for value in values):
        raise ValidationError(
            f"Collection '{rule.name}' lớn — $match phải lọc theo giá trị cụ thể của khoá {hint}, "
            f'ví dụ {example} hoặc {{"$match": {{"{keys[0]}": {{"$in": ["FPT", "VNM"]}}}}}}. '
            "Không dùng $ne/$nin/$gt/$regex/$exists trên khoá này vì chúng quét toàn bộ collection. "
            f"Danh sách $in tối đa {max_items} phần tử — hãy thu hẹp lại."
        )


def _has_anchor_match(rule: CollectionRule, stages: list[dict[str, Any]], max_items: int) -> bool:
    """Pipeline[0] là $match neo rule.key với giá trị CỤ THỂ (scalar/$in) -> key-set bị chốt, khỏi cần $limit.

    CHỈ scalar/$in mới neo cardinality. Range ($gte/$lte) có thể match cả collection nên KHÔNG được waive
    $limit ở đây (aggregate không có _effective_limit cap số dòng như find). Chỉ tính $match ở stage ĐẦU TIÊN
    ($match sau $group/$sort là decoy — collection đã bị quét trước đó).
    """
    if not stages or "$match" not in stages[0] or not rule.key:
        return False
    match = stages[0]["$match"]
    return isinstance(match, dict) and rule.key in match and _is_specific_value(match[rule.key], max_items)


def _check_aggregate_limit(policy: Policy, rule: CollectionRule, pipeline: list[dict[str, Any]]) -> None:
    """G4: large mà không có require_filter -> bắt buộc $limit, nếu không sẽ kéo cả collection."""
    if rule.size != "large" or rule.require_filter:
        return
    if _has_anchor_match(rule, pipeline, policy.defaults.max_limit):
        return
    max_limit = policy.defaults.max_limit
    values = [stage["$limit"] for stage in pipeline if "$limit" in stage]
    if any(_is_int(value) and 1 <= value <= max_limit for value in values):
        return
    if values:
        raise ValidationError(
            f"$limit={values[0]!r} không hợp lệ — phải là số nguyên trong khoảng 1..{max_limit}. "
            'Ví dụ: {"$limit": 20}'
        )
    raise ValidationError(
        f"Collection '{rule.name}' lớn — pipeline bắt buộc có stage $limit (1..{max_limit}) để giới hạn "
        'kết quả. Ví dụ: pipeline=[{"$sort": {"change_pct": -1}}, {"$limit": 20}]'
    )


def _check_aggregate_slice_size(rule: CollectionRule, raw: Any) -> None:
    """$slice trong aggregate: {"$slice": ["$series", -20]} hoặc ["$series", skip, n] -> lấy phần tử cuối."""
    tail = raw[-1] if isinstance(raw, list) and raw else raw
    if _is_int(tail):
        _check_max_slice(rule, abs(tail))


def _check_aggregate_series(rule: CollectionRule, pipeline: list[dict[str, Any]]) -> None:
    """G5: mọi tham chiếu series phải nằm trong $slice, và phải có ít nhất một stage cắt series."""
    if not rule.require_series_slice:
        return
    _check_no_series_alias(rule, pipeline)
    sliced = False
    for stage in pipeline:
        for name in SLICE_STAGES:
            spec = stage.get(name)
            if not isinstance(spec, dict) or SERIES_FIELD not in spec:
                continue
            series = spec[SERIES_FIELD]
            if not isinstance(series, dict) or "$slice" not in series:
                raise ValidationError(
                    f"Collection '{rule.name}' có mảng series rất dài — trong {name}, field 'series' "
                    'bắt buộc phải được cắt bằng $slice. Ví dụ: {"$project": {"series": {"$slice": ["$series", -20]}}}'
                )
            _check_aggregate_slice_size(rule, series["$slice"])
            sliced = True
    if not sliced:
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài — pipeline bắt buộc cắt series bằng $slice. "
            'Ví dụ: {"$project": {"series": {"$slice": ["$series", -20]}}}'
        )


def _check_allow_aggregate(rule: CollectionRule) -> None:
    """F2: collection có mảng lớn -> aggregate là đường exfil không chặn nổi bằng quét từ vựng.

    ($$ROOT, alias, $slice khổng lồ... đều lấy được nguyên mảng). find + $slice đủ dùng.
    """
    if rule.allow_aggregate:
        return
    raise ValidationError(
        f"Collection '{rule.name}' chứa chuỗi lịch sử rất dài nên không hỗ trợ aggregate. "
        'Hãy dùng db_find với projection={"series": {"$slice": -20}} để lấy N điểm dữ liệu gần nhất '
        "rồi tự tính toán trên đó."
    )


def validate_aggregate(policy: Policy, collection: str, pipeline: Any) -> None:
    """`pipeline` để kiểu Any vì dữ liệu đến từ LLM, chưa được đảm bảo đúng cấu trúc."""
    rule = _require_rule(policy, collection)
    _check_allow_aggregate(rule)
    stages = _require_pipeline(pipeline)

    banned = _find_banned(stages, policy.defaults.banned_operators)
    if banned:
        raise ValidationError(
            f"Toán tử '{banned}' không được phép trong pipeline. "
            "Hãy viết lại query không dùng toán tử này."
        )

    _check_no_system_var(stages, "pipeline")
    _check_aggregate_anchor_match(policy, rule, stages)
    _check_aggregate_limit(policy, rule, stages)
    _check_aggregate_series(rule, stages)


def validate_stats(
    policy: Policy, collection: str, field: Any, ops: Any, filter: Any
) -> CollectionRule:
    """Kiểm tra call db_stats. Trả về rule khi hợp lệ; raise ValidationError kèm gợi ý khi sai.

    db_stats an toàn vì server dựng phép đọc + chỉ trả scalar — nhưng vẫn ép: collection whitelist,
    stats_fields opt-in, chỉ collection series, field ∈ allowlist, ops ⊆ STATS_OPS, filter theo require_filter.
    """
    if filter is not None and not isinstance(filter, dict):
        raise ValidationError(
            f"filter phải là object (dict) hoặc bỏ trống — nhận được {type(filter).__name__}. "
            'Ví dụ: filter={"industry_name": "Toàn bộ thị trường"}'
        )
    rule = _require_rule(policy, collection)
    if not rule.stats_fields:
        raise ValidationError(
            f"Collection '{collection}' không hỗ trợ tính thống kê bằng db_stats. Hãy dùng db_find để đọc dữ liệu."
        )
    if not rule.require_series_slice:
        raise ValidationError(
            f"db_stats hiện chỉ hỗ trợ collection dạng chuỗi lịch sử. '{collection}' không phải dạng đó — "
            "hãy dùng db_find hoặc db_aggregate."
        )
    if not (isinstance(field, str) and field in rule.stats_fields):
        allowed = ", ".join(rule.stats_fields)
        raise ValidationError(
            f"field '{field}' không hợp lệ cho '{collection}'. Các field được phép: {allowed}."
        )
    if not (isinstance(ops, list) and ops):
        raise ValidationError(
            'ops phải là mảng không rỗng, ví dụ ops=["min", "max", "latest"]. '
            f"Các phép hợp lệ: {', '.join(sorted(STATS_OPS))}."
        )
    bad_ops = [op for op in ops if op not in STATS_OPS]
    if bad_ops:
        raise ValidationError(
            f"Phép không hợp lệ: {bad_ops}. Các phép hợp lệ: {', '.join(sorted(STATS_OPS))}."
        )
    banned = _find_banned(filter, policy.defaults.banned_operators)
    if banned:
        raise ValidationError(
            f"Toán tử '{banned}' không được phép trong filter. Hãy viết lại filter không dùng toán tử này."
        )
    _check_find_require_filter(policy, rule, filter or {})
    return rule
