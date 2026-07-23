"""Test build_portfolio_block — system block persona tư vấn danh mục (mode=portfolio)."""
from app.agent.adapters.base import SystemBlock
from app.agent.portfolio import build_portfolio_block


def test_returns_system_block_with_key_rules():
    block = build_portfolio_block()
    assert isinstance(block, SystemBlock)
    text = block.text.lower()
    # Chủ đề danh mục + ràng buộc compliance A (không phát lệnh mua/bán).
    assert "danh mục" in text
    assert "mua/bán" in text
    # Có nhắc tận dụng giai đoạn thị trường / rổ hệ thống.
    assert "giai đoạn" in text


def test_block_not_cached_like_page_context():
    # An toàn cache-prefix: append cùng nhóm non-cache như page_context (xem spec §4.2).
    assert build_portfolio_block().cache_hint is False
