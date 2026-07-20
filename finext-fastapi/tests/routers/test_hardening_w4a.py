"""Hardening W4a — vá các lỗ backend còn sót (đợt review 2026-07-20).

Bao phủ các bug đã kiểm chứng:
  1. [MEDIUM] Đăng nhập Google: phần verify token dùng ``httpx.get`` + ``time.sleep`` ĐỒNG BỘ
     (fetch Google public keys, retry/backoff). Phải chạy qua ``run_in_threadpool`` để không
     nghẽn event loop (verify bằng thread id KHÁC luồng loop).
  2. [LOW-MED] Không lộ ``str(e)``/chi tiết exception nội bộ ra client ở các handler cục bộ:
     emails, transactions, brokers, storage (R2), uploads (nén ảnh), permissions.
  3. [P4] Log ``delete_sessions_for_user_except_jti`` ghi ĐÚNG khi xóa toàn bộ phiên
     (trước đây ghi "giữ lại JTI: TOÀN BỘ" — sai nghĩa).

Tất cả test gọi trực tiếp hàm (unit) — không dựng server thật. Endpoint bọc
``@api_response_wrapper`` trả ``JSONResponse`` khi có HTTPException -> assert theo status + body.
Các hàm thuần (compress_image, upload_file_to_r2) raise HTTPException trực tiếp -> assert .detail.
"""

import io
import json
import logging
import threading
from typing import Any, Optional

import pytest
from bson import ObjectId
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

import app.routers.auth as auth
import app.routers.emails as emails
import app.routers.transactions as transactions
import app.routers.brokers as brokers
import app.routers.permissions as permissions
import app.routers.uploads as uploads
import app.utils.storage as storage
import app.crud.sessions as crud_sessions

from app.schemas.auth import GoogleLoginRequest
from app.schemas.emails import ConsultationRequest, OpenAccountRequest, PlanInquiryRequest
from app.schemas.transactions import TransactionPaymentConfirmationRequest
from app.schemas.brokers import BrokerCreate
from app.schemas.permissions import PermissionCreate, PermissionUpdate


SECRET = "mongodb://user:SECRETpass@10.0.0.9:27017/internal-leak-detail"


# --------------------------------------------------------------------------- #
# Fakes chung
# --------------------------------------------------------------------------- #
class _FakeClient:
    def __init__(self, host: str) -> None:
        self.host = host


class _FakeRequest:
    """Đủ cho _check_rate_limit (chỉ đọc request.client.host)."""

    def __init__(self, host: str) -> None:
        self.client = _FakeClient(host)


class _FakeUser:
    def __init__(self, email: str = "admin@example.com") -> None:
        self.id = str(ObjectId())
        self.email = email


def _body(resp: JSONResponse) -> dict[str, Any]:
    return json.loads(bytes(resp.body))


def _raw(resp: JSONResponse) -> str:
    return bytes(resp.body).decode()


# --------------------------------------------------------------------------- #
# 1. Đăng nhập Google: verify token (blocking) chạy qua threadpool
# --------------------------------------------------------------------------- #
class _FakeGoogleResp:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {"id_token": "fake-id-token"}


class _FakeAsyncClient:
    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def post(self, *args: Any, **kwargs: Any) -> _FakeGoogleResp:
        return _FakeGoogleResp()


async def test_google_login_offloads_blocking_verify_to_threadpool(monkeypatch) -> None:
    loop_tid = threading.get_ident()
    seen: dict[str, int] = {}

    def _spy_verify(token: str, client_id: str) -> dict[str, Any]:
        # Phần này trong thực tế gọi httpx.get + time.sleep ĐỒNG BỘ -> phải ở worker thread.
        seen["tid"] = threading.get_ident()
        return {"sub": "google-123", "email": "u@example.com", "email_verified": True}

    async def _stop(db: Any, data: Any):
        # Dừng luồng sớm bằng ValueError -> endpoint trả 400 sạch (tid đã ghi nhận xong).
        raise ValueError("stop-after-capture")

    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(auth, "GOOGLE_CLIENT_SECRET", "csecret")
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda *a, **k: _FakeAsyncClient())
    monkeypatch.setattr(auth, "get_google_user_info_from_token", _spy_verify)
    monkeypatch.setattr(auth, "get_or_create_user_from_google_sub_email", _stop)

    with pytest.raises(HTTPException) as ei:
        await auth.google_oauth_callback(
            request=_FakeRequest("10.0.1.1"),
            login_request_data=GoogleLoginRequest(code="c", redirect_uri="http://frontend/cb"),
            db=object(),
        )

    assert ei.value.status_code == status.HTTP_400_BAD_REQUEST  # đã đi tới bước get_or_create
    assert "tid" in seen  # verify thực sự được gọi
    assert seen["tid"] != loop_tid  # chạy ở worker thread -> KHÔNG nghẽn event loop


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — emails (3 endpoint)
# --------------------------------------------------------------------------- #
async def _assert_email_endpoint_no_leak(monkeypatch, func, request_data, host: str) -> None:
    async def _boom(*a: Any, **k: Any) -> bool:
        raise RuntimeError(SECRET)

    monkeypatch.setattr(emails, "send_email_async", _boom)
    resp = await func(request=_FakeRequest(host), request_data=request_data)
    assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert SECRET not in _raw(resp)
    assert "SECRETpass" not in _raw(resp)
    assert _body(resp)["message"]  # vẫn có thông điệp chung


async def test_emails_consultation_no_leak(monkeypatch) -> None:
    await _assert_email_endpoint_no_leak(
        monkeypatch,
        emails.send_consultation_request,
        ConsultationRequest(customer_name="A", phone_number="0900000000"),
        "10.0.2.1",
    )


async def test_emails_open_account_no_leak(monkeypatch) -> None:
    await _assert_email_endpoint_no_leak(
        monkeypatch,
        emails.send_open_account_request,
        OpenAccountRequest(customer_name="A", phone_number="0900000000"),
        "10.0.2.2",
    )


async def test_emails_plan_inquiry_no_leak(monkeypatch) -> None:
    await _assert_email_endpoint_no_leak(
        monkeypatch,
        emails.send_plan_inquiry_request,
        PlanInquiryRequest(customer_name="A", phone_number="0900000000"),
        "10.0.2.3",
    )


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — transactions confirm-payment
# --------------------------------------------------------------------------- #
async def test_transactions_confirm_no_leak(monkeypatch) -> None:
    async def _boom(db: Any, tx_id: Any, req: Any):
        raise RuntimeError(SECRET)

    monkeypatch.setattr(transactions.crud_transactions, "confirm_transaction_payment_db", _boom)

    resp = await transactions.admin_confirm_transaction_payment(
        transaction_id=str(ObjectId()),
        confirmation_request=TransactionPaymentConfirmationRequest(),
        db=object(),
    )
    assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert SECRET not in _raw(resp)
    assert _body(resp)["message"]


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — brokers create/reactivate
# --------------------------------------------------------------------------- #
async def test_brokers_create_no_leak(monkeypatch) -> None:
    async def _boom(db: Any, user_id: Any):
        raise RuntimeError(SECRET)

    monkeypatch.setattr(brokers.crud_brokers, "create_or_reactivate_broker_for_user", _boom)

    resp = await brokers.create_or_reactivate_broker_endpoint(
        broker_create_data=BrokerCreate(user_id=str(ObjectId())),
        db=object(),
        current_admin=_FakeUser(),
    )
    assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert SECRET not in _raw(resp)
    assert _body(resp)["message"]


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — storage R2 (ClientError message)
# --------------------------------------------------------------------------- #
async def test_storage_client_error_no_leak(monkeypatch) -> None:
    class _FakeS3Raises:
        def upload_fileobj(self, Fileobj: Any, Bucket: str, Key: str, ExtraArgs: dict) -> None:
            raise ClientError({"Error": {"Code": "AccessDenied", "Message": SECRET}}, "PutObject")

    monkeypatch.setattr(storage, "_s3_client", _FakeS3Raises())
    monkeypatch.setattr(storage.config, "R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(storage.config, "R2_PUBLIC_URL_BASE", "https://cdn.example.com")

    with pytest.raises(HTTPException) as ei:
        await storage.upload_file_to_r2(io.BytesIO(b"payload"), "images/x.jpg", acl="public-read")

    assert ei.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert SECRET not in str(ei.value.detail)


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — uploads.compress_image (lỗi PIL)
# --------------------------------------------------------------------------- #
def test_compress_image_no_leak(monkeypatch) -> None:
    def _boom_open(*a: Any, **k: Any):
        raise RuntimeError(SECRET)

    monkeypatch.setattr(uploads.Image, "open", _boom_open)

    with pytest.raises(HTTPException) as ei:
        uploads.compress_image(b"not-an-image", "image/png")

    assert ei.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert SECRET not in str(ei.value.detail)


# --------------------------------------------------------------------------- #
# 2. Không lộ str(e) — permissions create/update (ValueError)
# --------------------------------------------------------------------------- #
async def test_permissions_create_no_leak(monkeypatch) -> None:
    async def _boom(db: Any, permission: Any):
        raise ValueError(SECRET)

    monkeypatch.setattr(permissions.crud_permissions, "create_permission", _boom)

    resp = await permissions.create_permission(
        permission=PermissionCreate(name="test:action", category="test"),
        db=object(),
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert SECRET not in _raw(resp)
    assert _body(resp)["message"]


async def test_permissions_update_no_leak(monkeypatch) -> None:
    async def _boom(db: Any, permission_id: str, permission_update: Any):
        raise ValueError(SECRET)

    monkeypatch.setattr(permissions.crud_permissions, "update_permission", _boom)

    resp = await permissions.update_permission(
        permission_update=PermissionUpdate(name="test:action2"),
        permission_id=str(ObjectId()),
        db=object(),
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert SECRET not in _raw(resp)
    assert _body(resp)["message"]


# --------------------------------------------------------------------------- #
# 3. Log delete_sessions_for_user_except_jti: ghi đúng khi xóa toàn bộ
# --------------------------------------------------------------------------- #
class _FakeDeleteResult:
    def __init__(self, count: int) -> None:
        self.deleted_count = count


class _FakeSessionsColl:
    def __init__(self, count: int) -> None:
        self._count = count
        self.last_query: Optional[dict] = None

    async def delete_many(self, query: dict) -> _FakeDeleteResult:
        self.last_query = query
        return _FakeDeleteResult(self._count)


class _FakeSessionsDB:
    def __init__(self, count: int) -> None:
        self._coll = _FakeSessionsColl(count)

    def __getitem__(self, name: str) -> _FakeSessionsColl:
        return self._coll


async def test_delete_all_sessions_log_wording(caplog) -> None:
    db = _FakeSessionsDB(count=3)
    with caplog.at_level(logging.INFO, logger=crud_sessions.logger.name):
        n = await crud_sessions.delete_sessions_for_user_except_jti(db, str(ObjectId()), None)

    assert n == 3
    msgs = " ".join(r.getMessage() for r in caplog.records)
    # Log cũ (sai nghĩa) phải biến mất; log mới nói rõ là xóa toàn bộ, không giữ phiên nào.
    assert "giữ lại JTI: TOÀN BỘ" not in msgs
    assert "KHÔNG giữ lại phiên nào" in msgs


async def test_delete_sessions_keeps_jti_log_wording(caplog) -> None:
    db = _FakeSessionsDB(count=2)
    keep = "jti-keep-abc"
    with caplog.at_level(logging.INFO, logger=crud_sessions.logger.name):
        await crud_sessions.delete_sessions_for_user_except_jti(db, str(ObjectId()), keep)

    msgs = " ".join(r.getMessage() for r in caplog.records)
    assert f"giữ lại JTI: {keep}" in msgs
