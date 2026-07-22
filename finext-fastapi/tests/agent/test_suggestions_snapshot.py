"""Rút gọn dữ liệu thô thành snapshot nhỏ để đưa vào prompt."""
from app.agent.suggestions import build_snapshot


def _stock(ticker: str, pct: float, industry: str, top100: int = 1, trading_value: float = 1e9) -> dict:
    """Mặc định top100=1 vì hầu hết test ở đây kiểm logic xếp hạng, không kiểm bộ lọc."""
    return {
        "ticker": ticker,
        "pct_change": pct,
        "industry_name": industry,
        "top100": top100,
        "trading_value": trading_value,
    }


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


# --- Lọc mã phổ biến (FNX100) ---------------------------------------------


def test_loai_ma_ngoai_top100():
    """Mã penny ngoài FNX100 không được xuất hiện dù biến động mạnh nhất."""
    rows = [
        _stock("HPG", 3.0, "Thép"),
        _stock("DGT", 14.9, "Xây dựng", top100=0),  # tăng mạnh nhất nhưng lạ
    ]
    snap = build_snapshot([], rows, [])
    assert [g["ticker"] for g in snap["gainers"]] == ["HPG"]
    assert "DGT" not in snap["tickers"]


def test_allowlist_chi_gom_ma_duoc_trinh_bay():
    """Siết guard: LLM chỉ được nhắc mã thực sự đưa vào prompt, không phải toàn sàn."""
    rows = [_stock(f"T{i:02d}", i - 15.0, "Thép") for i in range(30)]
    snap = build_snapshot([], rows, [])
    presented = {g["ticker"] for g in snap["gainers"]} | {l["ticker"] for l in snap["losers"]}
    assert set(snap["tickers"]) == presented


def test_fallback_thanh_khoan_khi_khong_co_ma_top100():
    """Dữ liệu thiếu cờ top100 → không được trả rỗng, rơi về top thanh khoản."""
    rows = [
        _stock("AAA", 5.0, "Thép", top100=0, trading_value=9e9),
        _stock("BBB", 4.0, "Thép", top100=0, trading_value=1e9),
    ]
    snap = build_snapshot([], rows, [])
    assert snap["gainers"], "không được rỗng khi thiếu cờ top100"
    assert "AAA" in snap["tickers"]


def test_fallback_uu_tien_thanh_khoan_cao():
    """Khi phải fallback, mã thanh khoản thấp bị loại trước."""
    rows = [_stock(f"T{i:02d}", 1.0, "Thép", top100=0, trading_value=float(i)) for i in range(200)]
    snap = build_snapshot([], rows, [])
    # T00 thanh khoản thấp nhất → không lọt vào rổ 100 mã thanh khoản nhất.
    assert "T00" not in snap["tickers"]
    assert "T199" in snap["tickers"]
