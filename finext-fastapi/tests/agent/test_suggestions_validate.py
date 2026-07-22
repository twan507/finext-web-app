"""Validate gợi ý câu hỏi — rào chắn chống mã bịa, số tuyệt đối, giọng khuyến nghị."""
import json

from app.agent.suggestions import validate_suggestions

TICKERS = {"HPG", "FPT", "SSI"}


def _raw(items: list[str]) -> str:
    return json.dumps(items, ensure_ascii=False)


def _ok_five() -> list[str]:
    return [
        "Thị trường hôm nay diễn biến ra sao?",
        "Vì sao nhóm thép biến động mạnh phiên nay?",
        "HPG đang ở trạng thái nào?",
        "Nhóm ngành nào đang dẫn dắt thị trường?",
        "Thị trường đang ở pha nào?",
    ]


def test_bo_qua_json_hong():
    assert validate_suggestions("khong phai json", TICKERS) is None


def test_bo_qua_khi_khong_du_5_cau():
    assert validate_suggestions(_raw(_ok_five()[:4]), TICKERS) is None


def test_bo_qua_khi_thieu_dau_hoi():
    items = _ok_five()
    items[0] = "Thị trường hôm nay diễn biến ra sao."
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_phan_tram():
    items = _ok_five()
    items[0] = "Vì sao VNINDEX giảm 2% phiên nay?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_so_tuyet_doi():
    items = _ok_five()
    items[0] = "Vì sao chỉ số mất 120 điểm phiên nay?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_giong_khuyen_nghi():
    items = _ok_five()
    items[0] = "Có nên mua HPG lúc này?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_ma_khong_co_trong_snapshot():
    items = _ok_five()
    items[2] = "VIC đang ở trạng thái nào?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_khong_loai_nham_cum_mua_rong():
    """'khối ngoại mua ròng' là mô tả hợp lệ — KHÔNG được coi là khuyến nghị."""
    items = _ok_five()
    items[1] = "Khối ngoại mua ròng ở nhóm ngành nào?"
    assert validate_suggestions(_raw(items), TICKERS) is not None


def test_khong_loai_nham_viet_tat_tai_chinh():
    """GDP/ETF không phải mã cổ phiếu, không được loại."""
    items = _ok_five()
    items[3] = "Dòng tiền ETF đang vào nhóm nào?"
    assert validate_suggestions(_raw(items), TICKERS) is not None


def test_set_hop_le_di_qua_va_duoc_strip():
    items = _ok_five()
    items[0] = "  Thị trường hôm nay diễn biến ra sao?  "
    out = validate_suggestions(_raw(items), TICKERS)
    assert out is not None
    assert len(out) == 5
    assert out[0] == "Thị trường hôm nay diễn biến ra sao?"


# --- Vớt output bị cắt cụt --------------------------------------------------


def test_vot_duoc_mang_thieu_dau_dong():
    """Model quên ']' (hoặc stream bị cắt) — 5 câu HOÀN CHỈNH vẫn phải dùng được.

    Đã gặp thật khi chạy MiniMax-M3: cả bộ bị vứt vì thiếu đúng một ký tự.
    """
    raw = json.dumps(_ok_five(), ensure_ascii=False).rstrip("]")
    assert validate_suggestions(raw, TICKERS) is not None


def test_khong_vot_cau_dang_viet_do():
    """Câu thứ 5 bị cắt giữa chừng → chỉ còn 4 chuỗi hoàn chỉnh → loại cả bộ."""
    raw = json.dumps(_ok_five(), ensure_ascii=False)
    cut = raw.rfind('", "') + 4  # cắt ngay sau dấu mở của câu thứ 5
    assert validate_suggestions(raw[:cut] + "Thị trường hôm nay", TICKERS) is None


def test_khong_vot_khi_khong_co_dau_mo_mang():
    assert validate_suggestions('"chỉ là một chuỗi rời?"', TICKERS) is None
