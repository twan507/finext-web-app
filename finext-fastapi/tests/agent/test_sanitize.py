from app.agent.sanitize import sanitize_answer


# --- VSI: giữ số, đổi nhãn thành đơn vị tự nhiên ---
def test_vsi_with_number_keeps_number():
    assert "92% trung bình 5 phiên" in sanitize_answer("thanh khoản (VSI 0,92) thấp")
    assert "VSI" not in sanitize_answer("thanh khoản (VSI 0,92) thấp")


def test_vsi_with_equals_drops_label_keeps_number():
    out = sanitize_answer("dưới trung bình 5 phiên (VSI = 0,92).")
    assert "92% trung bình 5 phiên" in out and "VSI" not in out


def test_vsi_with_operator_keeps_operator():
    out = sanitize_answer("Thanh khoản đột biến (VSI ≥ 2)")
    assert "≥200% trung bình 5 phiên" in out and "VSI" not in out


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
    out = sanitize_answer("khi w_trend vượt 0,30")
    assert "xu hướng tuần" in out and "độ rộng" not in out  # trend theo khung = "xu hướng", KHÔNG "độ rộng"


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
    assert "xu hướng năm" in sanitize_answer("khung năm `y_trend` 0,18")
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


# --- tháng tiếng Anh → tiếng Việt ---
def test_english_month_abbrev_to_vietnamese():
    assert sanitize_answer("đáy cuối Oct 2023 quanh 1.020") == "đáy cuối tháng 10/2023 quanh 1.020"
    assert sanitize_answer("hồi phục từ Nov 2022") == "hồi phục từ tháng 11/2022"


def test_english_month_no_year_kept_as_thang():
    assert sanitize_answer("đỉnh đầu Aug") == "đỉnh đầu tháng 8"
    assert "Sept" not in sanitize_answer("chạm đáy Sept 2025")


def test_may_only_month_when_next_to_year():
    assert sanitize_answer("rung lắc May 2023") == "rung lắc tháng 5/2023"
    # "may" (tiếng Việt) KHÔNG bị đụng
    assert sanitize_answer("nhà đầu tư may mắn giữ hàng") == "nhà đầu tư may mắn giữ hàng"


# --- Negative: input sạch giữ nguyên; số/URL/nhãn pha không hỏng ---
def test_clean_input_unchanged():
    clean = "VNINDEX đang ở 1.776,89 điểm, giảm 0,29%. Thị trường ở pha TRANSITION, xem https://finext.vn/guide."
    assert sanitize_answer(clean) == clean


def test_empty_string():
    assert sanitize_answer("") == ""


def test_no_double_spaces_left_after_removal():
    out = sanitize_answer("Dữ liệu `stock_finstats` cho thấy yếu")
    assert "  " not in out


# --- Khối finext-widget đi VERBATIM (không bị sanitize phá fence/JSON) ---
def test_widget_block_preserved_verbatim():
    # Bug cũ: _BACKTICK_RE gỡ backtick biến ```finext-widget → ``finext-widget (FE hết render).
    widget = '```finext-widget\n{"v":1,"type":"line","title":"P/E","series":[{"name":"P/E","points":[15.2,9.5]}]}\n```'
    out = sanitize_answer(f"Biểu đồ P/E:\n\n{widget}\n\nNhận xét: rẻ.")
    assert widget in out  # nguyên khối: fence 3-backtick + JSON không đụng


def test_widget_json_internal_names_not_stripped():
    # Tên giống mã nội bộ (marketcap/core) NẰM TRONG JSON widget không bị xóa (sẽ phá JSON).
    widget = '```finext-widget\n{"v":1,"type":"bar_list","title":"marketcap","items":[{"label":"core","value":1}]}\n```'
    assert widget in sanitize_answer(f"Xem:\n{widget}")


def test_text_around_widget_still_sanitized():
    widget = '```finext-widget\n{"v":1,"type":"line","series":[{"name":"x","points":[1]}]}\n```'
    out = sanitize_answer(f"Thanh khoản (VSI 0,92).\n{widget}\nHết.")
    assert "VSI" not in out.split("```finext-widget")[0]  # text NGOÀI widget vẫn dọn
    assert widget in out


# --- Taxonomy nội bộ (Workflow A-M / Kịch bản A-G) lọt → strip ---
def test_workflow_taxonomy_stripped():
    out = sanitize_answer("Tôi chạy Workflow E rồi Workflow I để lấy dữ liệu")
    assert "Workflow E" not in out and "Workflow I" not in out


def test_kich_ban_taxonomy_stripped():
    out = sanitize_answer("Áp dụng Kịch bản A và Kịch bản G cho câu này")
    assert "Kịch bản A" not in out and "Kịch bản G" not in out


def test_widget_block_still_verbatim_with_workflow_rule():
    # Khối finext-widget chứa chữ "Workflow" trong title KHÔNG bị đụng (fence 3-backtick nguyên).
    widget = '```finext-widget\n{"v":1,"type":"line","title":"Workflow E","series":[{"name":"x","points":[1]}]}\n```'
    out = sanitize_answer(f"Xem biểu đồ:\n{widget}\nKết thúc.")
    assert widget in out


# --- Token underscore/English lọt ở dạng TRẦN → gỡ span (giữ số) ---
def test_underscore_pct_tokens_stripped_keep_numbers():
    out = sanitize_answer("top 28,57% ngành (industry_rank_pct), thay đổi năm (y_pct) -34%")
    assert "industry_rank_pct" not in out and "y_pct" not in out
    assert "28,57%" in out and "-34%" in out


def test_more_pct_tokens_stripped():
    out = sanitize_answer("market_rank_pct 62, w_pct 3, m_pct 5, q_pct 8, free_float_pct 40")
    for tok in ("market_rank_pct", "w_pct", "m_pct", "q_pct", "free_float_pct"):
        assert tok not in out
    assert "62" in out and "40" in out


def test_breadth_mapped_to_vietnamese():
    out = sanitize_answer("chỉ số breadth đang cải thiện")
    assert "breadth" not in out and "độ rộng" in out


def test_exposure_capitalized_replaced():
    # "Exposure" viết hoa (đầu bullet) cũng phải dịch — bug thiếu IGNORECASE (Q22).
    out = sanitize_answer("- **Exposure gợi ý theo nhãn**: 70%")
    assert "Exposure" not in out and "exposure" not in out
    assert "tỷ lệ nắm giữ" in out


# --- Bậc 2b: cắt câu TỰ XIN LỖI / TỰ TỐ ẢO GIÁC vô căn cứ (đo thật multi-turn) ---
def test_self_apology_block_at_start_stripped():
    # moi T8 (rút gọn nguyên văn): 4 câu tự tố ở đầu → cắt trọn, giữ nội dung phân tích thật.
    text = (
        "Anh/chị ơi, anh/chị đúng — tôi đang mắc lỗi nghiêm trọng. "
        "Trong các câu trả lời trước tôi đã dùng số liệu từ trí nhớ thay vì gọi tool... "
        "Số liệu tôi đưa ra có thể sai hoàn toàn. Tôi xin lỗi anh/chị.\n\n"
        "Người mới nên CHIA NHIỀU MÃ để giảm rủi ro."
    )
    out = sanitize_answer(text)
    assert "xin lỗi" not in out and "trí nhớ" not in out
    assert not out.startswith("Anh/chị")
    assert "Người mới nên CHIA NHIỀU MÃ để giảm rủi ro." in out


def test_self_apology_inline_stripped_keeps_data():
    assert sanitize_answer("Tôi xin lỗi, tôi nhầm. VNM P/E 11,3 lần.") == "VNM P/E 11,3 lần."


def test_first_person_opinion_not_cut():
    # nhận định ngôi-thứ-nhất KHÔNG kèm dấu hiệu tự tố → GIỮ NGUYÊN.
    assert sanitize_answer("Tôi thấy VNM đang hấp dẫn.") == "Tôi thấy VNM đang hấp dẫn."


def test_third_person_mistake_not_cut():
    # "sai lầm" ngôi-thứ-ba, không phải tự tố → GIỮ NGUYÊN.
    assert sanitize_answer("Doanh nghiệp có thể sai lầm khi mở rộng.") == "Doanh nghiệp có thể sai lầm khi mở rộng."


def test_apology_only_answer_kept_not_empty():
    # câu trả lời CHỈ có apology (không nội dung sau) → giữ nguyên bản (không rỗng).
    pure = "Tôi xin lỗi anh/chị. Tôi nhầm số liệu rồi."
    out = sanitize_answer(pure)
    assert out == pure and out != ""


def test_self_apology_with_widget_preserves_both():
    # cắt apology NHƯNG chừa nguyên khối finext-widget (fence + JSON verbatim).
    widget = '```finext-widget\n{"v":1,"type":"line","series":[{"name":"x","points":[1]}]}\n```'
    out = sanitize_answer(f"Tôi xin lỗi, tôi nhầm. VNM vẫn ở vùng hấp dẫn.\n{widget}\nKết luận: nắm giữ.")
    assert widget in out
    assert "xin lỗi" not in out
    assert "VNM vẫn ở vùng hấp dẫn." in out


def test_think_block_stripped():
    """Khối <think>…</think> (M3 adaptive) bị bỏ; phần trả lời thật giữ nguyên."""
    out = sanitize_answer("<think>Calculating recovery from trough</think>\n\nP/B HPG hiện 1,34 lần.")
    assert "<think>" not in out and "Calculating" not in out
    assert "P/B HPG hiện 1,34 lần." in out
