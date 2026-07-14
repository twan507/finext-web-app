"""Kiểm tra query theo policy. Thuần logic — unit test không cần Mongo (doc 01 §3-A)."""

from typing import Any

from .policy import CollectionRule, Policy

# Stage có thể cắt mảng dài bằng $slice trong aggregate.
SLICE_STAGES = ("$project", "$addFields", "$set")
SCALAR_TYPES = (str, int, float, bool)


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


def _check_series_slice(rule: CollectionRule, projection: dict[str, Any] | None) -> None:
    if not rule.require_series_slice:
        return
    series = (projection or {}).get("series")
    if not isinstance(series, dict) or "$slice" not in series:
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài. "
            'Bắt buộc dùng projection dạng {"series": {"$slice": -20}} để lấy N phần tử mới nhất.'
        )
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


def validate_find(
    policy: Policy,
    collection: str,
    filter: dict[str, Any] | None,
    projection: dict[str, Any] | None,
    sort: list[list[Any]] | None,
    limit: int | None,
) -> int:
    """Trả limit hiệu lực. Raise ValidationError nếu vi phạm."""
    rule = _require_rule(policy, collection)

    _check_find_banned(policy.defaults.banned_operators, filter, projection, sort)

    if rule.require_filter and not any(key in (filter or {}) for key in rule.require_filter):
        keys = " hoặc ".join(rule.require_filter)
        raise ValidationError(
            f"Collection '{collection}' bắt buộc lọc theo khoá: {keys}. "
            f'Ví dụ: filter={{"{rule.require_filter[0]}": "FPT"}}'
        )

    if rule.size == "large" and not projection:
        example = f'{{"{rule.key}": 1}}' if rule.key else '{"<field_1>": 1, "<field_2>": 1}'
        raise ValidationError(
            f"Collection '{collection}' lớn — bắt buộc có projection để chỉ lấy field cần thiết. "
            f"Ví dụ: projection={example}"
        )

    _check_series_slice(rule, projection)

    return _effective_limit(policy, limit)


def _require_pipeline(pipeline: Any) -> list[dict[str, Any]]:
    """LLM có thể hallucinate cấu trúc — chuẩn hoá lỗi thành ValidationError dạy được model."""
    if not isinstance(pipeline, list):
        raise ValidationError(
            "pipeline phải là một mảng các stage. "
            'Ví dụ: pipeline=[{"$match": {"ticker": "FPT"}}, {"$limit": 5}]'
        )
    for stage in pipeline:
        if not isinstance(stage, dict):
            raise ValidationError(
                f"Mỗi stage trong pipeline phải là object dạng {{\"$match\": ...}} — "
                f"nhận được {type(stage).__name__}. "
                'Ví dụ: pipeline=[{"$match": {"ticker": "FPT"}}, {"$limit": 5}]'
            )
    return pipeline


def _is_specific_value(value: Any) -> bool:
    """Giá trị khoá đủ hẹp: scalar, hoặc {"$in": [scalar,...]}. Loại $ne/$gt/$regex/$nin..."""
    if isinstance(value, SCALAR_TYPES):
        return True
    if isinstance(value, dict) and list(value.keys()) == ["$in"]:
        candidates = value["$in"]
        return (
            isinstance(candidates, list)
            and len(candidates) > 0
            and all(isinstance(item, SCALAR_TYPES) for item in candidates)
        )
    return False


def _check_aggregate_key(rule: CollectionRule, pipeline: list[dict[str, Any]]) -> None:
    """Large collection: bắt buộc $match theo khoá VỚI giá trị cụ thể (không phủ định/dải rộng)."""
    keys = rule.require_filter or ([rule.key] if rule.key else [])
    if rule.size != "large" or not keys:
        return
    matches = [stage["$match"] for stage in pipeline if isinstance(stage.get("$match"), dict)]
    values = [match[key] for match in matches for key in keys if key in match]
    hint = " hoặc ".join(str(k) for k in keys)
    if not values:
        raise ValidationError(
            f"Collection '{rule.name}' lớn — pipeline bắt buộc bắt đầu bằng $match theo khoá: {hint}. "
            f'Ví dụ: {{"$match": {{"{keys[0]}": "FPT"}}}}'
        )
    if not any(_is_specific_value(value) for value in values):
        raise ValidationError(
            f"Collection '{rule.name}' lớn — $match phải lọc theo giá trị cụ thể của khoá {hint}, "
            f'ví dụ {{"$match": {{"{keys[0]}": "FPT"}}}} hoặc {{"$match": {{"{keys[0]}": {{"$in": ["FPT", "VNM"]}}}}}}. '
            "Không dùng $ne/$nin/$gt/$regex/$exists trên khoá này vì chúng quét toàn bộ collection."
        )


def _check_aggregate_series_slice(rule: CollectionRule, pipeline: list[dict[str, Any]]) -> None:
    """Aggregate cũng phải cắt mảng series như find, nếu không sẽ trả nguyên mảng dài."""
    if not rule.require_series_slice:
        return
    for stage in pipeline:
        for name in SLICE_STAGES:
            spec = stage.get(name)
            series = spec.get("series") if isinstance(spec, dict) else None
            if isinstance(series, dict) and "$slice" in series:
                raw = series["$slice"]
                tail = raw[-1] if isinstance(raw, list) and raw else raw
                if _is_int(tail):
                    _check_max_slice(rule, abs(tail))
                return
    raise ValidationError(
        f"Collection '{rule.name}' có mảng series rất dài — pipeline bắt buộc cắt series bằng $slice. "
        'Ví dụ: {"$project": {"series": {"$slice": ["$series", -20]}}}'
    )


def validate_aggregate(policy: Policy, collection: str, pipeline: Any) -> None:
    """`pipeline` để kiểu Any vì dữ liệu đến từ LLM, chưa được đảm bảo đúng cấu trúc."""
    rule = _require_rule(policy, collection)
    stages = _require_pipeline(pipeline)

    banned = _find_banned(stages, policy.defaults.banned_operators)
    if banned:
        raise ValidationError(
            f"Toán tử '{banned}' không được phép trong pipeline. "
            "Hãy viết lại query không dùng toán tử này."
        )

    _check_aggregate_key(rule, stages)
    _check_aggregate_series_slice(rule, stages)
