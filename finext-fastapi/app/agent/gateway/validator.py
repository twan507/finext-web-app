"""Kiểm tra query theo policy. Thuần logic — unit test không cần Mongo (doc 01 §3-A)."""

from typing import Any

from .policy import CollectionRule, Policy


class ValidationError(Exception):
    """Lỗi từ chối query. `message` viết bằng ngôn ngữ model hiểu + gợi ý sửa (doc 01 §1)."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _find_banned(node: Any, banned: list[str]) -> str | None:
    """Quét đệ quy mọi key trong filter/pipeline tìm operator cấm."""
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


def _require_rule(policy: Policy, collection: str) -> CollectionRule:
    rule = policy.rule_for(collection)
    if rule is None:
        raise ValidationError(
            f"Collection '{collection}' không nằm trong phạm vi dữ liệu. "
            "Hãy dùng một collection đã được mô tả trong tài liệu dữ liệu."
        )
    return rule


def _check_series_slice(rule: CollectionRule, projection: dict[str, Any] | None) -> None:
    if not rule.require_series_slice:
        return
    series = (projection or {}).get("series")
    if not isinstance(series, dict) or "$slice" not in series:
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài. "
            'Bắt buộc dùng projection dạng {"series": {"$slice": -20}} để lấy N phần tử mới nhất.'
        )
    if rule.max_slice is not None:
        raw = series["$slice"]
        count = abs(raw if isinstance(raw, int) else raw[-1])
        if count > rule.max_slice:
            raise ValidationError(
                f"$slice quá lớn cho '{rule.name}': tối đa {rule.max_slice} phần tử."
            )


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
    defaults = policy.defaults

    banned = _find_banned(filter, defaults.banned_operators)
    if banned:
        raise ValidationError(f"Toán tử '{banned}' không được phép. Hãy viết lại query không dùng toán tử này.")

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

    effective = defaults.default_limit if limit is None else limit
    if effective > defaults.max_limit:
        raise ValidationError(
            f"limit={effective} vượt mức cho phép (tối đa {defaults.max_limit}). Hãy giảm limit hoặc thu hẹp filter."
        )
    return effective


def validate_aggregate(policy: Policy, collection: str, pipeline: list[dict[str, Any]]) -> None:
    rule = _require_rule(policy, collection)

    banned = _find_banned(pipeline, policy.defaults.banned_operators)
    if banned:
        raise ValidationError(f"Toán tử '{banned}' không được phép trong pipeline.")

    match_stages = [stage["$match"] for stage in pipeline if "$match" in stage]
    if rule.size == "large":
        keys = rule.require_filter or ([rule.key] if rule.key else [])
        has_key = any(any(k in stage for k in keys) for stage in match_stages)
        if keys and not has_key:
            hint = " hoặc ".join(str(k) for k in keys)
            raise ValidationError(
                f"Collection '{collection}' lớn — pipeline bắt buộc bắt đầu bằng $match theo khoá: {hint}."
            )
