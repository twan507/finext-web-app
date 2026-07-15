from app.routers.chat import _messages_from
from app.schemas.chat import ChatStreamRequest


def test_messages_from_appends_current_after_history():
    body = ChatStreamRequest(
        message="giá bây giờ?",
        history=[
            {"role": "user", "content": "HPG thế nào?"},
            {"role": "assistant", "content": "HPG đang tăng."},
        ],
    )
    assert _messages_from(body) == [
        {"role": "user", "content": "HPG thế nào?"},
        {"role": "assistant", "content": "HPG đang tăng."},
        {"role": "user", "content": "giá bây giờ?"},
    ]


def test_messages_from_empty_history_is_single_turn():
    body = ChatStreamRequest(message="FPT giá bao nhiêu?")
    assert _messages_from(body) == [{"role": "user", "content": "FPT giá bao nhiêu?"}]


def test_history_role_is_constrained():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ChatStreamRequest(message="x", history=[{"role": "system", "content": "y"}])
