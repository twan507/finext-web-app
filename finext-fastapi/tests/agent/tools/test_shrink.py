"""Thu gọn kết quả tool theo CẤU TRÚC, không cắt giữa chừng chuỗi.

BUG THẬT đã đo: registry.py cắt content[:12000] giữ phần ĐẦU. Kết quả HPG 28.026 ký tự
gồm 9 kỳ 2024_1…2026_1 bị cắt còn 4 kỳ 2024_1…2024_4 — mất sạch 5 kỳ MỚI NHẤT, đúng phần
khách hỏi, và JSON hỏng giữa chừng. Model không có dữ liệu 2025/2026 nên đã bịa số.
"""

import json

from app.agent.tools.shrink import ShrinkReport, shrink_note, shrink_result


def _quarter(period: str) -> dict:
    """Một kỳ báo cáo, hình dạng như financial_statements.quarterly thật (34 chỉ tiêu)."""
    return {
        "period": period,
        "metrics": [{"vi_name": f"Chỉ tiêu {i}", "value": 1_000_000 + i} for i in range(34)],
    }


def _hpg_doc(periods: list[str]) -> dict:
    return {"ticker": "HPG", "financial_statements": {"quarterly": [_quarter(p) for p in periods]}}


NINE_PERIODS = [
    "2024_1", "2024_2", "2024_3", "2024_4",
    "2025_1", "2025_2", "2025_3", "2025_4", "2026_1",
]


def test_vua_tran_thi_tra_nguyen():
    data = [{"ticker": "FPT", "price": 100}]
    out, report = shrink_result(data, 10_000)
    assert out == data
    assert report.shrunk is False
    assert report.docs_kept == 1


def test_data_rong_khong_coi_la_cat():
    out, report = shrink_result([], 10_000)
    assert out == []
    assert report.shrunk is False


def test_bo_document_tu_CUOI_danh_sach():
    """Danh sách doc đã theo thứ tự sort của truy vấn — doc đầu liên quan nhất, nên bỏ từ cuối."""
    data = [{"ticker": f"MA{i}", "pad": "x" * 500} for i in range(10)]
    out, report = shrink_result(data, 1_500)
    assert 1 <= len(out) < 10
    assert out == data[: len(out)], "phải giữ các doc ĐẦU"
    assert report.shrunk is True
    assert report.docs_kept == len(out)
    assert report.docs_dropped == 10 - len(out)


def test_HOI_QUY_giu_ky_MOI_bo_ky_CU():
    """ĐÂY LÀ TEST GHIM NGUYÊN NHÂN GỐC. Hành vi cũ giữ kỳ CŨ và vứt kỳ MỚI."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    out, report = shrink_result(data, full // 2)

    kept = [q["period"] for q in out[0]["financial_statements"]["quarterly"]]
    assert "2026_1" in kept, "kỳ MỚI NHẤT phải còn — đây chính là thứ hành vi cũ vứt đi"
    assert "2024_1" not in kept, "kỳ CŨ NHẤT phải bị bỏ trước"
    assert kept == NINE_PERIODS[-len(kept):], "phải là một đoạn đuôi liên tục"
    assert report.array_path == "financial_statements.quarterly"
    assert report.kept_last == "2026_1"
    assert report.items_kept == len(kept)
    assert report.items_dropped == 9 - len(kept)


def test_ket_qua_sau_khi_thu_luon_la_JSON_hop_le():
    """Hành vi cũ cắt giữa chuỗi nên JSON hỏng. Đây là ràng buộc không được vi phạm."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    for divisor in (2, 3, 5, 8):
        out, _ = shrink_result(data, full // divisor)
        json.loads(json.dumps(out, ensure_ascii=False))  # không được raise


def test_ton_trong_tran_ky_tu():
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    limit = full // 3
    out, _ = shrink_result(data, limit)
    assert len(json.dumps(out, ensure_ascii=False)) <= limit


def test_nhan_lay_tu_khoa_period_hoac_date():
    data = [{"series": [{"date": f"2026-01-{d:02d}", "v": "x" * 200} for d in range(1, 21)]}]
    out, report = shrink_result(data, 1_200)
    assert report.array_path == "series"
    assert report.kept_last == "2026-01-20"


def test_nhan_dung_chi_so_khi_khong_co_khoa_nhan():
    data = [{"rows": [{"v": "x" * 200} for _ in range(20)]}]
    _, report = shrink_result(data, 1_200)
    assert report.kept_last.startswith("#")


def test_mot_phan_tu_don_qua_lon_thi_bao_that_bai():
    data = [{"blob": "x" * 5_000}]
    out, report = shrink_result(data, 1_000)
    assert out == []
    assert report.shrunk is True


def test_ghi_chu_neu_dung_khoang_con_lai_va_cam_dien_so():
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    _, report = shrink_result(data, full // 2)
    note = shrink_note(report)
    assert note is not None
    assert "TUYỆT ĐỐI không tự điền số" in note
    assert "2026_1" in note
    assert "2024_1" in note, "phải liệt kê kỳ đã bỏ để model biết đường truy vấn lại"


def test_ghi_chu_neu_TEN_document_da_bo():
    """Hỏi so sánh nhiều mã mà rụng bớt mã thì model phải biết rụng mã NÀO để truy vấn lại.

    Chỉ đếm "đã bỏ 2 kết quả" là vi phạm nguyên tắc gốc: cắt thì được, cắt mà giấu thì không.
    """
    data = [{"ticker": t, "pad": "x" * 800} for t in ("HPG", "FPT", "VNM")]
    out, report = shrink_result(data, 1_200)
    assert len(out) < 3
    note = shrink_note(report)
    assert "VNM" in note, "phải nêu TÊN document đã bỏ, không chỉ đếm số lượng"


def test_nhanh_thu_mang_khong_bao_nham_la_bo_document():
    """Một document thì không có document nào bị bỏ — dropped_labels ở đây là nhãn KỲ."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    _, report = shrink_result(data, full // 2)
    note = shrink_note(report)
    assert "kết quả cuối danh sách" not in note


def test_ghi_chu_rong_khi_khong_cat():
    assert shrink_note(ShrinkReport()) is None


def test_ghi_chu_dat_chi_dan_quan_trong_len_TRUOC():
    """Ghi chú có thể bị trần ngân sách cắt đuôi — chỉ dẫn cấm bịa số phải nằm ở đầu."""
    data = [_hpg_doc(NINE_PERIODS)]
    full = len(json.dumps(data, ensure_ascii=False))
    _, report = shrink_result(data, full // 2)
    note = shrink_note(report)
    assert note.index("TUYỆT ĐỐI") < note.index("2026_1")
