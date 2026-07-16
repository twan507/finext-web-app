"""Thống kê server-side cho db_stats — thuần Python, KHÔNG chạm Mongo/policy.

Nhận điểm dữ liệu gateway đã đọc, trả về SỐ VÔ HƯỚNG. Không bao giờ trả chuỗi thô ra ngoài.
Tách riêng để unit test tính toán không cần DB (doc 01 §3-A)."""

import math
from typing import Any

# Whitelist phép rút gọn — model chỉ được chọn trong tập này (validate_stats ép).
STATS_OPS = frozenset(
    {
        "min", "max", "mean", "median",
        "p05", "p25", "p75", "p95",
        "count", "first", "last", "latest", "drawdown_from_peak",
    }
)

_PERCENTILE_Q = {"p05": 5.0, "p25": 25.0, "p75": 75.0, "p95": 95.0}

# Trần điểm đọc nội bộ — chặn phình bộ nhớ nếu filter trúng chuỗi khổng lồ.
INTERNAL_MAX_POINTS = 200_000


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def extract_series_points(docs: list[dict[str, Any]], sub: str) -> list[tuple[str, float]]:
    """Gom (date, value) từ mảng series của các doc. Bỏ điểm thiếu/không phải số."""
    points: list[tuple[str, float]] = []
    for doc in docs:
        series = doc.get("series")
        if not isinstance(series, list):
            continue
        for element in series:
            if not isinstance(element, dict):
                continue
            value = element.get(sub)
            if not _is_number(value):
                continue
            date = element.get("date")
            points.append((date if isinstance(date, str) else "", float(value)))
    return points


def filter_range(
    points: list[tuple[str, float]], date_range: dict[str, str] | None
) -> list[tuple[str, float]]:
    """Lọc theo {from, to} trên date (chuỗi ISO, so sánh chuỗi). Bao gồm hai đầu."""
    if not isinstance(date_range, dict):
        return points
    low = date_range.get("from")
    high = date_range.get("to")
    out: list[tuple[str, float]] = []
    for date, value in points:
        if low and (not date or date < low):
            continue
        if high and (not date or date > high):
            continue
        out.append((date, value))
    return out


def _percentile(sorted_vals: list[float], q: float) -> float:
    """Nội suy tuyến tính (numpy 'linear'/type 7). q ∈ [0, 100]. sorted_vals đã sắp tăng, không rỗng."""
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    rank = (len(sorted_vals) - 1) * (q / 100.0)
    low = math.floor(rank)
    high = math.ceil(rank)
    if low == high:
        return sorted_vals[low]
    return sorted_vals[low] + (sorted_vals[high] - sorted_vals[low]) * (rank - low)


def compute_stats(field: str, points: list[tuple[str, float]], ops: list[str]) -> dict[str, Any]:
    """Tính các phép trong `ops` trên points (đã lọc range). points KHÔNG rỗng (executor đã chặn)."""
    ordered = sorted(points, key=lambda point: point[0])
    values = [value for _, value in ordered]
    sorted_vals = sorted(values)
    count = len(values)
    peak = max(values)
    latest = ordered[-1][1]

    result: dict[str, Any] = {"field": field, "n": count}
    for op in ops:
        if op == "min":
            result["min"] = min(values)
        elif op == "max":
            result["max"] = peak
        elif op == "mean":
            result["mean"] = sum(values) / count
        elif op == "median":
            result["median"] = _percentile(sorted_vals, 50.0)
        elif op in _PERCENTILE_Q:
            result[op] = _percentile(sorted_vals, _PERCENTILE_Q[op])
        elif op == "count":
            result["count"] = count
        elif op == "first":
            result["first"] = ordered[0][1]
        elif op in ("last", "latest"):
            result[op] = latest
        elif op == "drawdown_from_peak":
            result["drawdown_from_peak"] = (latest - peak) / peak if peak > 0 else None
    return result
