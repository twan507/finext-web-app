"""Test P0 — api_response_wrapper KHÔNG rò rỉ chi tiết exception nội bộ ra client.

Lỗ hổng (trước fix): nhánh `except Exception` trả `f"Lỗi máy chủ nội bộ: {str(e)}"`
→ lộ message của exception (đường dẫn nội bộ, lỗi driver DB, trace nghiệp vụ...) cho
kẻ tấn công. Fix: log đầy đủ nội bộ (exc_info), client chỉ nhận thông điệp chung.

HTTPException/ValueError vẫn giữ message (do lập trình viên tự soạn, an toàn) — test
giữ lại các nhánh đó để bảo đảm không "fix quá tay".
"""
import json

from fastapi import HTTPException
from fastapi import status as http_status
from fastapi.responses import JSONResponse

from app.utils.response_wrapper import api_response_wrapper

# Chuỗi bí mật giả lập chi tiết nội bộ nhạy cảm (vd: connection string, path, secret).
_SECRET = "mongodb://admin:SuperSecret@10.0.0.5:27017 /etc/finext/secret.key"


def _body(resp: JSONResponse) -> dict:
    return json.loads(bytes(resp.body))


async def test_generic_exception_does_not_leak_detail() -> None:
    @api_response_wrapper()
    async def boom() -> None:
        raise RuntimeError(f"connection failed: {_SECRET}")

    resp = await boom()
    assert isinstance(resp, JSONResponse)
    assert resp.status_code == http_status.HTTP_500_INTERNAL_SERVER_ERROR

    body = _body(resp)
    assert body["status"] == 500
    # Cốt lõi: chi tiết nội bộ KHÔNG được xuất hiện trong message trả cho client.
    assert _SECRET not in body["message"]
    assert "connection failed" not in body["message"]
    assert "RuntimeError" not in body["message"]


async def test_generic_exception_returns_generic_message() -> None:
    @api_response_wrapper()
    async def boom() -> None:
        raise KeyError(_SECRET)

    resp = await boom()
    body = _body(resp)
    # Client chỉ nhận thông điệp chung, có nội dung (không rỗng) để hiển thị.
    assert isinstance(body["message"], str) and body["message"].strip()
    assert _SECRET not in body["message"]


async def test_http_exception_detail_preserved() -> None:
    # Không fix quá tay: message của HTTPException (do dev soạn) vẫn phải giữ nguyên.
    @api_response_wrapper()
    async def forbidden() -> None:
        raise HTTPException(status_code=http_status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền X.")

    resp = await forbidden()
    assert resp.status_code == http_status.HTTP_403_FORBIDDEN
    assert _body(resp)["message"] == "Bạn không có quyền X."


async def test_value_error_message_preserved() -> None:
    # ValueError message (do dev raise chủ động) vẫn giữ — đây là contract nghiệp vụ hiện có.
    @api_response_wrapper()
    async def bad_value() -> None:
        raise ValueError("Tên watchlist đã tồn tại.")

    resp = await bad_value()
    assert resp.status_code == http_status.HTTP_400_BAD_REQUEST
    assert _body(resp)["message"] == "Tên watchlist đã tồn tại."


async def test_success_passthrough() -> None:
    @api_response_wrapper(default_success_message="OK")
    async def ok() -> dict:
        return {"value": 1}

    resp = await ok()
    assert resp.status_code == http_status.HTTP_200_OK
    body = _body(resp)
    assert body["message"] == "OK"
    assert body["data"] == {"value": 1}
