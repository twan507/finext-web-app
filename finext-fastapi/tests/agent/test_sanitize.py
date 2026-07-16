from app.agent.sanitize import sanitize_answer


# --- VSI: giữ số, đổi nhãn thành đơn vị tự nhiên ---
def test_vsi_with_number_keeps_number():
    assert "0,92× TB 5 phiên" in sanitize_answer("thanh khoản (VSI 0,92) thấp")
    assert "VSI" not in sanitize_answer("thanh khoản (VSI 0,92) thấp")


def test_vsi_with_equals_drops_label_keeps_number():
    out = sanitize_answer("dưới trung bình 5 phiên (VSI = 0,92).")
    assert "0,92× TB 5 phiên" in out and "VSI" not in out


def test_vsi_with_operator_keeps_operator():
    out = sanitize_answer("Thanh khoản đột biến (VSI ≥ 2)")
    assert "≥2× TB 5 phiên" in out and "VSI" not in out


def test_bare_vsi_table_header_replaced():
    out = sanitize_answer("| Mã | Giá | VSI | Điểm |")
    assert "VSI" not in out and "thanh khoản" in out.lower()


# --- exposure ---
def test_exposure_replaced():
    out = sanitize_answer("pha TRANSITION với exposure 0.7, hạ exposure về 0")
    assert "exposure" not in out
    assert out.count("tỷ lệ nắm giữ") == 2
    assert "0.7" in out and "TRANSITION" in out  # số + nhãn pha giữ nguyên


# --- token điểm/độ rộng: cả backtick lẫn trần ---
def test_score_tokens_mapped_backtick_and_bare():
    assert "điểm dòng tiền tuần" in sanitize_answer("Dòng tiền: `week_score` -14.7")
    assert "week_score" not in sanitize_answer("Dòng tiền: `week_score` -14.7")
    assert "điểm dòng tiền ngày" in sanitize_answer("nếu 2-3 phiên tới day_score tiếp tục âm")
    assert "độ rộng xu hướng tuần" in sanitize_answer("khi w_trend vượt 0,30")


def test_score_token_keeps_number():
    assert "-14.7" in sanitize_answer("Dòng tiền: `week_score` -14.7")


# --- tên collection/field nội bộ: xóa ---
def test_internal_collection_names_removed():
    out = sanitize_answer("Dữ liệu `stock_finstats` và `industry_finstats` cho thấy")
    assert "stock_finstats" not in out and "industry_finstats" not in out
    assert "`" not in out


def test_internal_name_in_prose_removed():
    out = sanitize_answer("Từ doc core đã có, thị trường yếu")
    assert "core" not in out.split()  # 'core' như một từ bị gỡ


# --- backtick ticker được GIỮ nội dung (gỡ backtick) ---
def test_valid_ticker_backtick_unwrapped():
    out = sanitize_answer("Mã `FPT` đang mạnh")
    assert "FPT" in out and "`" not in out


# --- grade zone (A)/(B)/(C) dính sau từ: xóa parenthetical ---
def test_zone_grade_paren_after_word_removed():
    out = sanitize_answer("vùng kỹ thuật ở mức yếu (C) và năm tích cực (A)")
    assert "(C)" not in out and "(A)" not in out
    assert "yếu" in out and "tích cực" in out


def test_zone_grade_list_marker_not_touched():
    # "(A)" đầu dòng như đánh dấu danh sách KHÔNG bị xóa (không có \w ngay trước)
    out = sanitize_answer("Phương án:\n(A) mua dần\n(B) chờ thêm")
    assert "(A) mua dần" in out


# --- VAL/VAH/POC (§15 denylist) ---
def test_va_compound_drops_labels_keeps_numbers():
    out = sanitize_answer("Vùng giá chấp nhận tháng (VAL-VAH: 1.837-1.875) đã thủng")
    assert "VAL" not in out and "VAH" not in out
    assert "1.837-1.875" in out


def test_poc_and_bare_va_replaced():
    out = sanitize_answer("giá quanh POC và trên VAH")
    assert "POC" not in out and "VAH" not in out


# --- grade zone trần "mức A/B/C" → nhãn VN ---
def test_muc_grade_mapped():
    out = sanitize_answer("cải thiện lên ít nhất mức B, tránh mức C")
    assert "mức B" not in out and "mức C" not in out
    assert "trung tính" in out and "yếu" in out


# --- token M3 mới: y_trend, industry_rank ---
def test_y_trend_and_industry_rank_mapped():
    assert "độ rộng xu hướng năm" in sanitize_answer("khung năm `y_trend` 0,18")
    assert "y_trend" not in sanitize_answer("khung năm `y_trend` 0,18")
    out = sanitize_answer("industry_rank 57% trong ngành")
    assert "industry_rank" not in out and "phân vị xếp hạng trong ngành" in out
    out2 = sanitize_answer("rank_pct 62 toàn thị trường")
    assert "rank_pct" not in out2 and "phân vị xếp hạng thị trường" in out2


# --- preamble lượt-cuối bị cắt ---
def test_final_turn_preamble_stripped():
    out = sanitize_answer("Tôi sẽ tổng hợp dữ liệu một năm qua của VNM:\n\n**P/E** dao động 13–16 lần.")
    assert not out.startswith("Tôi sẽ")
    assert "**P/E** dao động 13–16 lần." in out


def test_double_preamble_stripped():
    out = sanitize_answer("Tôi sẽ phân tích VNM.\nĐầu tiên nạp dữ liệu.\n\nVNM đang ở vùng hấp dẫn.")
    assert "Tôi sẽ" not in out and "Đầu tiên nạp" not in out
    assert "VNM đang ở vùng hấp dẫn." in out


def test_non_preamble_first_line_kept():
    # câu bắt đầu bằng nội dung thật (không phải narration) → GIỮ NGUYÊN
    clean = "Tôi thấy VNM đang hấp dẫn ở vùng giá này.\n\nP/E 11,3 lần."
    assert sanitize_answer(clean) == clean  # "Tôi thấy" không match narration (chỉ 'sẽ/xin')


# --- Negative: input sạch giữ nguyên; số/URL/nhãn pha không hỏng ---
def test_clean_input_unchanged():
    clean = "VNINDEX đang ở 1.776,89 điểm, giảm 0,29%. Thị trường ở pha TRANSITION, xem https://finext.vn/guide."
    assert sanitize_answer(clean) == clean


def test_empty_string():
    assert sanitize_answer("") == ""


def test_no_double_spaces_left_after_removal():
    out = sanitize_answer("Dữ liệu `stock_finstats` cho thấy yếu")
    assert "  " not in out
