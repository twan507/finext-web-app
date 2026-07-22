import asyncio

import app.routers.chat as chat
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


# ── CAP-01: frame kết thúc không được rơi khi relay chậm ──────────────────────────
def test_forward_khong_lam_roi_stream_end_khi_sink_day():
    """Sink đầy: STREAM_END phải chen được vào bằng cách bỏ frame cũ nhất.

    Nếu sentinel bị drop, relay không bao giờ biết turn đã xong → heartbeat cho tới
    khi proxy cắt (600s) và người dùng thấy câu trả lời cụt.
    """
    sink: asyncio.Queue = asyncio.Queue(maxsize=2)
    sink.put_nowait("frame-cu-1")
    sink.put_nowait("frame-cu-2")

    chat._forward(sink, chat.STREAM_END, critical=True)

    drained = []
    while not sink.empty():
        drained.append(sink.get_nowait())
    assert chat.STREAM_END in drained, "sentinel phải có mặt trong sink"
    assert "frame-cu-1" not in drained, "frame cũ nhất bị nhường chỗ"


def test_forward_van_drop_frame_thuong_khi_sink_day():
    """Frame token bình thường vẫn drop khi sink đầy — không đổi hành vi cũ."""
    sink: asyncio.Queue = asyncio.Queue(maxsize=1)
    sink.put_nowait("da-co")

    chat._forward(sink, "frame-moi")

    assert sink.qsize() == 1
    assert sink.get_nowait() == "da-co"
