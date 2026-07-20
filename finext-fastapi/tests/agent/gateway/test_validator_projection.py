"""Hồi quy: projection phải là 0/1, không được là hằng số chuỗi.

BUG THẬT đo được trong eval: model sinh projection {"title": "1"} — chuỗi thay vì số.
Từ Mongo 4.4, value trong projection là aggregation expression, nên chuỗi "1" là một HẰNG SỐ:
mọi document trả về đúng chữ "1", query báo thành công, không log lỗi nào. Model thấy dữ liệu
vô nghĩa nên gọi lại vòng này tới vòng khác — một lượt lặp 10 vòng, đốt hơn 600 nghìn token,
rồi trả cho khách một câu vô dụng.

Validator trước đây chỉ quét operator cấm và biến hệ thống, KHÔNG kiểm giá trị projection.
"""

import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_find

POLICY = Policy.load()
COLL = "stock_snapshot"
FILTER = {"ticker": "FPT"}


def _find(projection):
    return validate_find(POLICY, COLL, FILTER, projection, None, 5)


def test_chan_projection_hang_so_chuoi():
    """Đây chính là bug đã đốt hơn 600 nghìn token."""
    with pytest.raises(ValidationError) as exc:
        _find({"ticker": 1, "title": "1"})
    msg = str(exc.value)
    assert "title" in msg, "phải chỉ đúng field sai để model sửa được"
    assert "1" in msg


def test_chan_projection_tro_toi_field_khac():
    """{"x": "$ticker"} là biểu thức đổi tên — không phải cách lấy field, dễ ra dữ liệu sai lệch."""
    with pytest.raises(ValidationError):
        _find({"ticker": 1, "alias": "$ticker"})


def test_chan_projection_gia_tri_la_mang():
    with pytest.raises(ValidationError):
        _find({"ticker": [1, 2]})


def test_chan_projection_so_khac_0_1():
    with pytest.raises(ValidationError):
        _find({"ticker": 2})


def test_cho_phep_projection_so_1_va_0():
    assert _find({"ticker": 1, "price": 1}) > 0
    assert _find({"ticker": 1, "price": 0}) > 0


def test_cho_phep_projection_bool():
    """Mongo chấp nhận true/false; Python bool là int nên phải chắc chắn không bị chặn nhầm."""
    assert _find({"ticker": True, "price": False}) > 0


def test_cho_phep_bieu_thuc_dict_van_di_qua():
    """Biểu thức dạng dict ($slice…) vẫn phải qua được — phần ngữ nghĩa đã có luật riêng lo."""
    assert _find({"ticker": 1, "price": {"$slice": -5}}) > 0
