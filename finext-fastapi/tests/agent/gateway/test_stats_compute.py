import pytest

from app.agent.gateway.stats_compute import (
    STATS_OPS,
    compute_stats,
    extract_series_points,
    filter_range,
)


def _pts(vals: list[float], start_day: int = 1) -> list[tuple[str, float]]:
    return [(f"2020-01-{start_day + i:02d}", float(v)) for i, v in enumerate(vals)]


def test_ops_whitelist_has_expected_members():
    assert "drawdown_from_peak" in STATS_OPS
    assert "min" in STATS_OPS and "p95" in STATS_OPS
    assert len(STATS_OPS) == 13


def test_basic_ops_use_chronological_order():
    pts = _pts([10, 20, 15])  # dates asc → peak 20 giữa chuỗi, latest = 15
    r = compute_stats(
        "series.pe", pts,
        ["min", "max", "mean", "median", "count", "first", "last", "latest", "drawdown_from_peak"],
    )
    assert r["field"] == "series.pe"
    assert r["n"] == 3
    assert r["min"] == 10.0
    assert r["max"] == 20.0
    assert r["mean"] == pytest.approx(15.0)
    assert r["median"] == pytest.approx(15.0)
    assert r["count"] == 3
    assert r["first"] == 10.0
    assert r["last"] == 15.0
    assert r["latest"] == 15.0
    assert r["drawdown_from_peak"] == pytest.approx(-0.25)  # (15-20)/20


def test_percentiles_linear_interpolation():
    r = compute_stats("series.pb", _pts([10, 12, 14, 16, 18]), ["p05", "p25", "p75", "p95"])
    assert r["p25"] == pytest.approx(12.0)
    assert r["p75"] == pytest.approx(16.0)
    assert r["p05"] == pytest.approx(10.4)  # 10 + (12-10)*0.2
    assert r["p95"] == pytest.approx(17.6)  # 16 + (18-16)*0.8


def test_single_point_all_ops_equal_value():
    r = compute_stats(
        "series.pe", [("2021-01-01", 42.0)],
        ["min", "max", "median", "p05", "latest", "drawdown_from_peak"],
    )
    assert r["min"] == r["max"] == r["median"] == r["p05"] == r["latest"] == 42.0
    assert r["drawdown_from_peak"] == 0.0


def test_extract_skips_non_numeric_and_missing():
    docs = [{"series": [
        {"date": "d1", "pe": 10.0},
        {"date": "d2", "pe": None},
        {"date": "d3", "pe": "x"},
        {"date": "d4", "pe": 12},
        {"date": "d5"},
    ]}]
    assert extract_series_points(docs, "pe") == [("d1", 10.0), ("d4", 12.0)]


def test_extract_ignores_bool_and_bad_shapes():
    docs = [{"series": [{"date": "d1", "pe": True}]}, {"series": "not-a-list"}, {"nope": 1}]
    assert extract_series_points(docs, "pe") == []


def test_filter_range_is_inclusive():
    out = filter_range(_pts([1, 2, 3, 4, 5]), {"from": "2020-01-02", "to": "2020-01-04"})
    assert [v for _, v in out] == [2.0, 3.0, 4.0]


def test_filter_range_none_returns_all():
    pts = _pts([1, 2, 3])
    assert filter_range(pts, None) == pts
