from app.core import config


def test_chat_quota_defaults_present_and_positive():
    assert config.AGENT_DAILY_TOKEN_BUDGET == 4_000_000
    assert config.CHAT_MAX_CONVERSATIONS == 50
    assert config.AGENT_TOKENS_5H == 500_000
    assert config.AGENT_TOKENS_WEEK == 5_000_000
    assert config.AGENT_ADVANCED_MULT == 5
    assert config.AGENT_SESSION_HOURS == 5
    assert config.AGENT_WEEK_DAYS == 7
    assert "PATRON" in config.AGENT_ADVANCED_LICENSES
    assert "ADMIN" in config.AGENT_UNLIMITED_LICENSES
    for v in (config.AGENT_DAILY_TOKEN_BUDGET, config.CHAT_MAX_CONVERSATIONS,
              config.AGENT_TOKENS_5H, config.AGENT_TOKENS_WEEK, config.AGENT_ADVANCED_MULT,
              config.AGENT_SESSION_HOURS, config.AGENT_WEEK_DAYS):
        assert isinstance(v, int) and v > 0
