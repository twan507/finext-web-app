from app.core import config


def test_chat_quota_defaults_present_and_positive():
    """Trần quota tính bằng ĐƠN VỊ QUY ĐỔI theo chi phí (xem billable_units), không phải token thô.
    Số đo thật: một lượt chat ≈ 130.000 đơn vị → trần 5h hiện tại ≈ 8 lượt."""
    assert config.CHAT_MAX_CONVERSATIONS == 50
    assert config.AGENT_TOKENS_5H == 1_000_000
    assert config.AGENT_TOKENS_WEEK == 10_000_000
    assert config.AGENT_ADVANCED_MULT == 5
    assert config.AGENT_SESSION_HOURS == 5
    assert config.AGENT_WEEK_DAYS == 7
    assert "PATRON" in config.AGENT_ADVANCED_LICENSES
    assert "ADMIN" in config.AGENT_UNLIMITED_LICENSES
    assert config.LLM_PRICE_INPUT == 0.30
    assert config.LLM_PRICE_CACHED == 0.06
    assert config.LLM_PRICE_OUTPUT == 1.20
    for v in (config.CHAT_MAX_CONVERSATIONS, config.AGENT_TOKENS_5H, config.AGENT_TOKENS_WEEK,
              config.AGENT_ADVANCED_MULT, config.AGENT_SESSION_HOURS, config.AGENT_WEEK_DAYS):
        assert isinstance(v, int) and v > 0


def test_cau_dao_global_mac_dinh_tat():
    """Owner chốt TẮT cầu dao global: đang dùng gói token trả trước của nhà cung cấp, hết gói thì
    chính nhà cung cấp báo lỗi. 0 = tắt; đặt env số dương để bật lại làm phanh an toàn."""
    assert config.AGENT_DAILY_TOKEN_BUDGET == 0
    assert isinstance(config.AGENT_DAILY_TOKEN_BUDGET, int)
