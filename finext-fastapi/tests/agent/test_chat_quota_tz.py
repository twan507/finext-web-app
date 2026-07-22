"""Hồi quy: MongoDB trả datetime KHÔNG kèm tzinfo (giá trị vẫn là UTC).

Bug thật đã gặp: `_now()` trả datetime aware, còn mốc cửa sổ đọc từ Mongo là naive
→ `now >= start + dur` ném TypeError → toàn bộ chat sập từ lượt thứ hai trở đi
(lượt đầu chưa có bản ghi quota nên start=None, thoát sớm nên không lộ).

Bộ test cũ không bắt được vì Mongo giả giữ nguyên object Python (còn tzinfo).
Các test dưới đây mô phỏng đúng thứ Mongo thật trả về.

Ghi chú: đường cộng dồn (_accumulate) đã được thay bằng _bump_window, so sánh cửa sổ
bằng $gt phía Mongo nên miễn nhiễm với naive/aware theo thiết kế; hai test của nó đã
bỏ cùng hàm. _window_used vẫn so sánh phía Python nên vẫn cần phủ ở đây.
"""

from datetime import datetime, timedelta, timezone

from app.crud.chat import _window_used

SESSION = timedelta(hours=5)


def _mongo_naive(**ago: int) -> datetime:
    """Giống hệt Mongo trả về: đúng thời điểm UTC nhưng đã mất tzinfo."""
    return (datetime.now(timezone.utc) - timedelta(**ago)).replace(tzinfo=None)


def test_window_used_khong_vo_voi_moc_naive_tu_mongo():
    used, reset_at = _window_used(_mongo_naive(hours=1), 1234, datetime.now(timezone.utc), SESSION)
    assert used == 1234, "cửa sổ còn hiệu lực thì phải giữ nguyên số token đã dùng"
    assert reset_at is not None


def test_window_used_moc_naive_da_qua_han_thi_mo_cua_so_moi():
    used, reset_at = _window_used(_mongo_naive(hours=9), 999, datetime.now(timezone.utc), SESSION)
    assert used == 0
    assert reset_at is None
