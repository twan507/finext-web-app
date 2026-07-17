from app.core import config


def test_chat_quota_defaults_present_and_positive():
    assert config.AGENT_MSG_PER_DAY == 60
    assert config.AGENT_MSG_PER_MIN == 6
    assert config.AGENT_DAILY_TOKEN_BUDGET == 4_000_000
    assert config.CHAT_MAX_CONVERSATIONS == 50
    for v in (config.AGENT_MSG_PER_DAY, config.AGENT_MSG_PER_MIN,
              config.AGENT_DAILY_TOKEN_BUDGET, config.CHAT_MAX_CONVERSATIONS):
        assert isinstance(v, int) and v > 0
