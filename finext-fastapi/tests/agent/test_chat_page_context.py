import pytest
from pydantic import ValidationError

from app.routers.chat import _page_context_block
from app.schemas.chat import ChatStreamRequest


def test_khong_co_ngu_canh_thi_khong_tao_khoi():
    assert _page_context_block(None) is None
    assert _page_context_block("") is None
    assert _page_context_block("   \n  ") is None


def test_co_ngu_canh_thi_tao_khoi_khong_cache():
    blk = _page_context_block("Trang: Chi tiết cổ phiếu · Đang xem: HPG")
    assert blk is not None
    assert blk.cache_hint is False, "khối ngữ cảnh đổi mỗi request nên không được cache"
    assert "HPG" in blk.text
    assert blk.text.startswith("[NGỮ CẢNH TRANG")


def test_khoi_co_nhan_chong_nhai_lai():
    blk = _page_context_block("Trang: Trang chủ")
    assert blk is not None
    assert "KHÔNG nhắc lại" in blk.text


def test_schema_mac_dinh_khong_co_ngu_canh():
    req = ChatStreamRequest(message="xin chào")
    assert req.page_context is None


def test_schema_nhan_ngu_canh_hop_le():
    req = ChatStreamRequest(message="xin chào", page_context="Trang: Trang chủ")
    assert req.page_context == "Trang: Trang chủ"


def test_schema_chan_ngu_canh_qua_dai():
    with pytest.raises(ValidationError):
        ChatStreamRequest(message="xin chào", page_context="a" * 2001)


def test_ngu_canh_khong_lot_vao_messages_gui_model():
    """page_context chỉ đi đường khối system. Không được lẫn vào messages —
    vì messages cũng chính là thứ được lưu vào lịch sử hội thoại của user."""
    from app.routers.chat import _messages_from

    body = ChatStreamRequest(message="thị trường sao rồi", page_context="Trang: Trang chủ")
    msgs = _messages_from(body)
    assert msgs == [{"role": "user", "content": "thị trường sao rồi"}]
    assert all("Trang:" not in m["content"] for m in msgs)
