"""Rút gọn dữ liệu thô thành snapshot nhỏ để đưa vào prompt."""
from app.agent.suggestions import build_snapshot


def _stock(ticker: str, pct: float, industry: str) -> dict:
    return {"ticker": ticker, "pct_change": pct, "industry_name": industry}


def test_lay_final_phase_cua_phien_moi_nhat():
    phase = [{"date": "2026-07-21", "final_phase": "Cũ"}, {"date": "2026-07-22", "final_phase": "Tăng giá"}]
    snap = build_snapshot(phase, [], [])
    assert snap["phase"] == "Tăng giá"


def test_khong_co_du_lieu_pha_thi_phase_none():
    assert build_snapshot([], [], [])["phase"] is None


def test_lay_toi_da_10_ma_tang_va_10_ma_giam():
    rows = [_stock(f"T{i:02d}", i - 15.0, "Thép") for i in range(30)]
    snap = build_snapshot([], rows, [])
    assert len(snap["gainers"]) == 10
    assert len(snap["losers"]) == 10
    # gainers sắp giảm dần, losers sắp tăng dần
    assert snap["gainers"][0]["ticker"] == "T29"
    assert snap["losers"][0]["ticker"] == "T00"


def test_snapshot_khong_chua_gia_tri_so():
    """Cấm đưa số vào prompt — chỉ giữ CHIỀU biến động."""
    snap = build_snapshot([], [_stock("HPG", 6.9, "Thép")], [])
    assert "pct_change" not in snap["gainers"][0]
    assert snap["gainers"][0] == {"ticker": "HPG", "industry_name": "Thép"}


def test_industries_la_tap_nganh_cua_ma_bien_dong():
    rows = [_stock("HPG", 5.0, "Thép"), _stock("FPT", -4.0, "Công nghệ"), _stock("HSG", 4.0, "Thép")]
    snap = build_snapshot([], rows, [])
    assert sorted(snap["industries"]) == ["Công nghệ", "Thép"]


def test_tickers_la_allowlist_cho_validate():
    rows = [_stock("HPG", 5.0, "Thép"), _stock("FPT", -4.0, "Công nghệ")]
    snap = build_snapshot([], rows, [])
    assert sorted(snap["tickers"]) == ["FPT", "HPG"]


def test_lay_5_tieu_de_tin_moi_nhat():
    news = [{"title": f"Tin {i}"} for i in range(9)]
    snap = build_snapshot([], [], news)
    assert snap["headlines"] == [f"Tin {i}" for i in range(5)]


def test_bo_qua_ban_ghi_thieu_field():
    rows = [{"ticker": "HPG"}, _stock("FPT", 3.0, "Công nghệ")]
    snap = build_snapshot([], rows, [])
    assert snap["tickers"] == ["FPT"]
