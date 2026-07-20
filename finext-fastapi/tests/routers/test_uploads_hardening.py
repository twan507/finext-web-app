"""Test hardening cho router upload ảnh (chống OOM + chống nghẽn event loop + không lộ lỗi).

Bao phủ 3 bug đã kiểm chứng ở khảo sát B2:
  1. [HIGH] Size guard THỰC KHI ĐỌC: đọc theo chunk + cộng dồn, hủy ngay khi vượt max
     -> không bao giờ nạp quá max vào RAM, kể cả khi ``file.size`` (Content-Length) thiếu
     hoặc nói dối.
  2. [HIGH] Phần blocking (PIL ``compress_image`` + boto3 ``upload_fileobj``) chạy qua
     ``run_in_threadpool`` -> không nghẽn event loop (verify bằng thread id KHÁC luồng loop).
  3. [MED] Exception nội bộ KHÔNG lộ ``str(e)`` ra client (chỉ log, trả thông điệp chung).

Tất cả test gọi trực tiếp hàm (unit) — không dựng server thật. Endpoint được bọc
``@api_response_wrapper`` nên trả ``JSONResponse`` (HTTPException bị bắt) -> assert theo
``status_code`` + body.

QUAN TRỌNG: các test size đẩy dữ liệu vượt ngưỡng qua ĐÚNG hàm đọc của app
(``uploads._read_upload_limited``), không tự khẳng định trên mock.
"""

import io
import json
import threading
from typing import Any, Optional

import pytest
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from bson import ObjectId

import app.routers.uploads as uploads
import app.utils.storage as storage
from app.schemas.uploads import UploadKey


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #
class _FakeUploadFile:
    """Stand-in cho starlette UploadFile: read(size) trả TỐI ĐA ``size`` byte mỗi lần.

    Ghi lại tổng số byte đã phục vụ (``bytes_served``) để chứng minh guard hủy sớm,
    không nạp toàn bộ payload vào RAM.
    """

    def __init__(self, payload: bytes, content_type: str = "image/png", size: Optional[int] = None) -> None:
        self._buf = payload
        self._pos = 0
        self.content_type = content_type
        self.size = size
        self.bytes_served = 0
        self.closed = False

    async def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            chunk = self._buf[self._pos:]
        else:
            chunk = self._buf[self._pos:self._pos + size]
        self._pos += len(chunk)
        self.bytes_served += len(chunk)
        return chunk

    async def close(self) -> None:
        self.closed = True


class _FakeUser:
    def __init__(self, uid: str, email: str = "u@example.com") -> None:
        self.id = uid
        self.email = email


def _body(resp: JSONResponse) -> dict[str, Any]:
    return json.loads(bytes(resp.body))


def _new_user() -> _FakeUser:
    return _FakeUser(str(ObjectId()))


# --------------------------------------------------------------------------- #
# 1. Size guard ở tầng hàm đọc thật (_read_upload_limited)
# --------------------------------------------------------------------------- #
async def test_read_limited_accepts_exactly_at_limit() -> None:
    payload = b"a" * 4096
    f = _FakeUploadFile(payload)
    data = await uploads._read_upload_limited(f, max_bytes=4096)  # type: ignore[arg-type]
    assert data == payload  # đúng bằng ngưỡng -> chấp nhận, trả đủ bytes


async def test_read_limited_rejects_over_by_one_byte() -> None:
    f = _FakeUploadFile(b"a" * 4097)
    with pytest.raises(HTTPException) as ei:
        await uploads._read_upload_limited(f, max_bytes=4096)  # type: ignore[arg-type]
    assert ei.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE


async def test_read_limited_aborts_early_and_bounds_ram(monkeypatch) -> None:
    # Chunk nhỏ + payload LỚN hơn nhiều so với max -> phải hủy giữa chừng,
    # KHÔNG đọc hết payload (chống OOM).
    monkeypatch.setattr(uploads, "UPLOAD_READ_CHUNK_SIZE", 1024)
    max_bytes = 4096
    payload = b"x" * (1024 * 50)  # 50KB >> 4KB
    f = _FakeUploadFile(payload)

    with pytest.raises(HTTPException) as ei:
        await uploads._read_upload_limited(f, max_bytes=max_bytes)  # type: ignore[arg-type]

    assert ei.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    # Đã đọc dở chỉ tới ~max + 1 chunk, và tuyệt đối < toàn bộ payload.
    assert f.bytes_served <= max_bytes + 1024
    assert f.bytes_served < len(payload)


# --------------------------------------------------------------------------- #
# 2. Endpoint từ chối oversize kể cả khi Content-Length thiếu / nói dối
# --------------------------------------------------------------------------- #
async def test_endpoint_rejects_oversize_when_size_missing() -> None:
    # file.size=None (Content-Length thiếu) nhưng body thực > 5MB -> 413,
    # và KHÔNG nạp toàn bộ payload.
    payload = b"x" * (uploads.MAX_IMAGE_SIZE_BYTES + 200 * 1024)
    f = _FakeUploadFile(payload, content_type="image/png", size=None)

    resp = await uploads.upload_image(
        current_user=_new_user(), upload_key=UploadKey.OTHERS, db=object(), file=f
    )

    assert resp.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert f.bytes_served < len(payload)  # đã hủy sớm, không đọc hết vào RAM
    assert f.closed is True


async def test_endpoint_rejects_oversize_when_size_lies_small() -> None:
    # file.size nói dối là 10 byte nhưng body thực > 5MB -> read-guard vẫn chặn 413.
    payload = b"x" * (uploads.MAX_IMAGE_SIZE_BYTES + 200 * 1024)
    f = _FakeUploadFile(payload, content_type="image/png", size=10)

    resp = await uploads.upload_image(
        current_user=_new_user(), upload_key=UploadKey.OTHERS, db=object(), file=f
    )

    assert resp.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert f.bytes_served < len(payload)


async def test_endpoint_rejects_unsupported_content_type() -> None:
    f = _FakeUploadFile(b"whatever", content_type="application/pdf", size=8)
    resp = await uploads.upload_image(
        current_user=_new_user(), upload_key=UploadKey.OTHERS, db=object(), file=f
    )
    assert resp.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


# --------------------------------------------------------------------------- #
# 3. Không lộ chi tiết exception nội bộ ra client
# --------------------------------------------------------------------------- #
async def test_internal_exception_not_leaked(monkeypatch) -> None:
    secret = "mongodb://user:SECRETpass@10.0.0.1:27017/internal-detail"

    def _boom(image_bytes: bytes, content_type: str, target_size: int = uploads.TARGET_COMPRESSED_SIZE):
        raise RuntimeError(secret)

    monkeypatch.setattr(uploads, "compress_image", _boom)

    f = _FakeUploadFile(b"x" * 128, content_type="image/png", size=128)
    resp = await uploads.upload_image(
        current_user=_new_user(), upload_key=UploadKey.OTHERS, db=object(), file=f
    )

    assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    raw = bytes(resp.body).decode()
    assert "SECRETpass" not in raw
    assert "mongodb://" not in raw
    assert "10.0.0.1" not in raw
    assert "internal-detail" not in raw
    # Vẫn có thông điệp chung, an toàn.
    assert _body(resp)["message"]


# --------------------------------------------------------------------------- #
# 4. Blocking chạy qua threadpool (không nghẽn event loop)
# --------------------------------------------------------------------------- #
async def test_compress_image_runs_in_threadpool(monkeypatch) -> None:
    loop_tid = threading.get_ident()
    seen: dict[str, int] = {}

    def _spy_compress(image_bytes: bytes, content_type: str, target_size: int = uploads.TARGET_COMPRESSED_SIZE):
        seen["tid"] = threading.get_ident()
        # Dừng luồng ngay sau khi ghi nhận thread id (khỏi cần mock R2/DB).
        raise HTTPException(status_code=418, detail="stop-after-capture")

    monkeypatch.setattr(uploads, "compress_image", _spy_compress)

    f = _FakeUploadFile(b"x" * 128, content_type="image/png", size=128)
    resp = await uploads.upload_image(
        current_user=_new_user(), upload_key=UploadKey.OTHERS, db=object(), file=f
    )

    assert resp.status_code == 418  # sentinel -> đã thực sự gọi compress
    assert "tid" in seen
    assert seen["tid"] != loop_tid  # chạy ở worker thread, KHÔNG nghẽn event loop


async def test_r2_upload_offloaded_to_threadpool(monkeypatch) -> None:
    loop_tid = threading.get_ident()
    seen: dict[str, int] = {}

    class _FakeS3:
        def upload_fileobj(self, Fileobj: Any, Bucket: str, Key: str, ExtraArgs: dict) -> None:
            seen["tid"] = threading.get_ident()

    monkeypatch.setattr(storage, "_s3_client", _FakeS3())
    monkeypatch.setattr(storage.config, "R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(storage.config, "R2_PUBLIC_URL_BASE", "https://cdn.example.com")

    url = await storage.upload_file_to_r2(io.BytesIO(b"payload"), "images/x.jpg", acl="public-read")

    assert url == "https://cdn.example.com/images/x.jpg"
    assert seen["tid"] != loop_tid  # boto3 blocking đã đẩy sang worker thread
