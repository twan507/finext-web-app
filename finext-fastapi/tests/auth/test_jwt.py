"""Test P0 — vòng đời JWT (access/refresh) và thu hồi phiên (session revocation).

Nguyên tắc (bài học đắt): test phải gọi HÀM THẬT của app để tạo/verify token và
thu hồi phiên — KHÔNG tái tạo lại logic ký/giải mã. Nơi nào logic đọc DB (phiên/jti)
thì seed dữ liệu thật vào FakeDB (tests/auth/_fake_mongo.py) rồi để hàm app tự xử lý.

Bao phủ:
- Nhóm A: create/verify token — token hợp lệ giải mã đúng claim; chữ ký sai / alg=none
  / hết hạn / sai loại (refresh↔access) / thiếu claim đều bị từ chối 401.
- Nhóm B: thu hồi phiên — sau khi phiên bị xóa (logout / xóa theo _id) thì access token
  gắn phiên KHÔNG còn qua verify_active_session; refresh sau thu hồi bị 401; refresh khi
  phiên còn sống thì rotate access_jti và giữ refresh_jti.
- Nhóm C: đổi/đặt lại mật khẩu — change-password (đã đăng nhập) vô hiệu các phiên khác,
  giữ phiên hiện tại; reset-password-otp (khôi phục) vô hiệu TOÀN BỘ phiên (lỗ hổng đã vá).
"""
from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Tuple

import pytest
from bson import ObjectId
from fastapi import HTTPException
from jose import jwt

from app.auth import jwt_handler
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_token_and_get_payload,
)
from app.auth.dependencies import verify_active_session
from app.core.config import ALGORITHM, SECRET_KEY
from app.crud.sessions import (
    create_session,
    delete_session_by_access_jti,
    delete_session_by_id,
    delete_sessions_for_user_except_jti,
    get_session_by_access_jti,
    get_session_by_refresh_jti,
)
from app.routers.auth import (
    refresh_access_token,
    reset_password_with_otp,
    user_change_own_password,
)
from app.crud.users import get_user_by_id_db
from app.schemas.auth import ChangePasswordRequest, ResetPasswordWithOtpRequest, TokenData
from app.schemas.sessions import SessionCreate
from app.utils.security import get_password_hash, verify_password

from tests.auth._fake_mongo import FakeDB  # type: ignore[import-not-found]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _uid() -> str:
    """Một user_id hợp lệ dạng ObjectId string."""
    return str(ObjectId())


def _future_ts(minutes: int = 5) -> int:
    return int((datetime.now(timezone.utc) + timedelta(minutes=minutes)).timestamp())


def _future_dt(minutes: int = 5) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def _b64url(obj: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()


async def _seed_user(
    db: FakeDB, user_id: str, email: str, password: str, active: bool = True
) -> None:
    now = datetime.now(timezone.utc)
    await db.users.insert_one(
        {
            "_id": ObjectId(user_id),
            "full_name": "Test User",
            "email": email,
            "hashed_password": get_password_hash(password),
            "is_active": active,
            "role_ids": [],
            "created_at": now,
            "updated_at": now,
        }
    )


async def _seed_session(
    db: FakeDB, user_id: str, email: str = "u@example.com"
) -> Tuple[str, str, str, str, str]:
    """Đăng nhập giả lập bằng HÀM THẬT: tạo token qua app, ghi session qua CRUD thật.

    Trả (access_token, access_jti, refresh_token, refresh_jti, session_id).
    """
    data = {"sub": email, "user_id": user_id}
    access_token = create_access_token(data=data)
    a_payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
    refresh_token, _ = create_refresh_token(data=data)
    r_payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

    session = await create_session(
        db,
        SessionCreate(
            user_id=user_id,
            access_jti=a_payload["jti"],
            refresh_jti=r_payload["jti"],
            device_info="pytest",
        ),
    )
    assert session is not None and session.id is not None
    return access_token, a_payload["jti"], refresh_token, r_payload["jti"], str(session.id)


# ---------------------------------------------------------------------------
# Nhóm A — create / verify token
# ---------------------------------------------------------------------------
async def test_valid_access_token_decodes_claims() -> None:
    uid = _uid()
    token = create_access_token(data={"sub": "alice@example.com", "user_id": uid})

    payload = await verify_token_and_get_payload(token=token)

    assert payload.email == "alice@example.com"
    assert payload.user_id == uid
    assert payload.jti  # jti (uuid) phải có
    # token_type thật sự là "access"
    raw = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert raw["token_type"] == "access"


async def test_wrong_signature_rejected() -> None:
    uid = _uid()
    forged = jwt.encode(
        {
            "sub": "alice@example.com",
            "user_id": uid,
            "jti": "forged-jti",
            "token_type": "access",
            "exp": _future_dt(),
        },
        "a-totally-different-secret-key-000",
        algorithm=ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        await verify_token_and_get_payload(token=forged)
    assert exc.value.status_code == 401


async def test_alg_none_token_rejected() -> None:
    # Token "unsigned" (alg=none) — tấn công kinh điển. Phải bị từ chối vì verify
    # chỉ chấp nhận algorithms=[HS256].
    header = _b64url({"alg": "none", "typ": "JWT"})
    body = _b64url(
        {
            "sub": "alice@example.com",
            "user_id": _uid(),
            "jti": "none-jti",
            "token_type": "access",
            "exp": _future_ts(),
        }
    )
    none_token = f"{header}.{body}."
    with pytest.raises(HTTPException) as exc:
        await verify_token_and_get_payload(token=none_token)
    assert exc.value.status_code == 401


async def test_expired_access_token_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    # Dùng HÀM THẬT create_access_token nhưng ép hạn về quá khứ → token hết hạn thật.
    monkeypatch.setattr(jwt_handler, "ACCESS_TOKEN_EXPIRE_MINUTES", -1)
    expired = create_access_token(data={"sub": "alice@example.com", "user_id": _uid()})

    with pytest.raises(HTTPException) as exc:
        await verify_token_and_get_payload(token=expired)
    assert exc.value.status_code == 401


async def test_refresh_token_rejected_as_access() -> None:
    refresh_token, _ = create_refresh_token(
        data={"sub": "alice@example.com", "user_id": _uid()}
    )
    with pytest.raises(HTTPException) as exc:
        await verify_token_and_get_payload(token=refresh_token)
    assert exc.value.status_code == 401


async def test_access_token_rejected_as_refresh() -> None:
    access_token = create_access_token(data={"sub": "alice@example.com", "user_id": _uid()})
    with pytest.raises(HTTPException) as exc:
        decode_refresh_token(access_token)
    assert exc.value.status_code == 401


async def test_valid_refresh_token_decodes() -> None:
    uid = _uid()
    refresh_token, delta = create_refresh_token(
        data={"sub": "bob@example.com", "user_id": uid}
    )
    payload = decode_refresh_token(refresh_token)

    assert payload["token_type"] == "refresh"
    assert payload["sub"] == "bob@example.com"
    assert payload["user_id"] == uid
    assert payload["jti"]
    assert delta.total_seconds() > 0


async def test_access_token_missing_user_id_rejected() -> None:
    # Chữ ký ĐÚNG (ký bằng SECRET_KEY thật) nhưng thiếu claim user_id → phải 401.
    tok = jwt.encode(
        {
            "sub": "alice@example.com",
            "jti": "no-user-id",
            "token_type": "access",
            "exp": _future_dt(),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        await verify_token_and_get_payload(token=tok)
    assert exc.value.status_code == 401


async def test_expired_refresh_token_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(jwt_handler, "REFRESH_TOKEN_EXPIRE_DAYS", -1)
    expired, _ = create_refresh_token(data={"sub": "alice@example.com", "user_id": _uid()})
    with pytest.raises(HTTPException) as exc:
        decode_refresh_token(expired)
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# Nhóm B — thu hồi phiên (session revocation)
# ---------------------------------------------------------------------------
async def test_active_session_token_accepted() -> None:
    db = FakeDB()
    uid = _uid()
    _, a_jti, _, _, _ = await _seed_session(db, uid)

    payload = TokenData(email="u@example.com", user_id=uid, jti=a_jti)
    result = await verify_active_session(payload=payload, db=db)  # type: ignore[arg-type]
    assert result.jti == a_jti


async def test_revoked_session_token_rejected() -> None:
    db = FakeDB()
    uid = _uid()
    _, a_jti, _, _, sid = await _seed_session(db, uid)
    payload = TokenData(email="u@example.com", user_id=uid, jti=a_jti)

    # Trước thu hồi: hợp lệ.
    await verify_active_session(payload=payload, db=db)  # type: ignore[arg-type]

    # Thu hồi phiên bằng CRUD thật mà endpoint /sessions dùng (xóa theo _id).
    assert await delete_session_by_id(db, sid) is True

    # Sau thu hồi: access token gắn phiên KHÔNG còn dùng được.
    with pytest.raises(HTTPException) as exc:
        await verify_active_session(payload=payload, db=db)  # type: ignore[arg-type]
    assert exc.value.status_code == 401


async def test_logout_invalidates_access_token() -> None:
    db = FakeDB()
    uid = _uid()
    _, a_jti, _, _, _ = await _seed_session(db, uid)
    payload = TokenData(email="u@example.com", user_id=uid, jti=a_jti)

    # Logout xóa session theo access_jti.
    assert await delete_session_by_access_jti(db, a_jti) is True

    with pytest.raises(HTTPException) as exc:
        await verify_active_session(payload=payload, db=db)  # type: ignore[arg-type]
    assert exc.value.status_code == 401


async def test_missing_jti_in_payload_rejected() -> None:
    db = FakeDB()
    payload = TokenData(email="u@example.com", user_id=_uid(), jti=None)
    with pytest.raises(HTTPException) as exc:
        await verify_active_session(payload=payload, db=db)  # type: ignore[arg-type]
    assert exc.value.status_code == 401


async def test_refresh_with_active_session_rotates_access_jti() -> None:
    db = FakeDB()
    uid = _uid()
    await _seed_user(db, uid, "refresh@example.com", "OldPass1234")
    _, a_jti, refresh_token, r_jti, _ = await _seed_session(db, uid, "refresh@example.com")

    resp = await refresh_access_token(refresh_token_str=refresh_token, db=db)  # type: ignore[arg-type]
    assert resp.status_code == 200

    # refresh_jti được GIỮ nguyên (chống race đa-tab); access_jti được rotate.
    sess = await get_session_by_refresh_jti(db, r_jti)
    assert sess is not None
    assert sess.access_jti != a_jti


async def test_refresh_after_revocation_rejected() -> None:
    db = FakeDB()
    uid = _uid()
    await _seed_user(db, uid, "refresh@example.com", "OldPass1234")
    _, _, refresh_token, _, sid = await _seed_session(db, uid, "refresh@example.com")

    # Thu hồi phiên → refresh token gắn phiên không còn dùng được.
    assert await delete_session_by_id(db, sid) is True

    resp = await refresh_access_token(refresh_token_str=refresh_token, db=db)  # type: ignore[arg-type]
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Nhóm C — đổi / đặt lại mật khẩu và thu hồi phiên
# ---------------------------------------------------------------------------
async def test_delete_sessions_except_jti_keeps_current() -> None:
    db = FakeDB()
    uid = _uid()
    # 3 phiên: A (hiện tại), B, C.
    for jti in ("A", "B", "C"):
        await create_session(
            db,
            SessionCreate(
                user_id=uid,
                access_jti=jti,
                refresh_jti=f"r-{jti}",
                device_info="pytest",
            ),
        )

    removed = await delete_sessions_for_user_except_jti(db, uid, "A")
    assert removed == 2
    assert await get_session_by_access_jti(db, "A") is not None
    assert await get_session_by_access_jti(db, "B") is None
    assert await get_session_by_access_jti(db, "C") is None


async def test_change_password_invalidates_other_sessions() -> None:
    db = FakeDB()
    uid = _uid()
    await _seed_user(db, uid, "changer@example.com", "OldPass1234")

    # Phiên hiện tại (khớp token) + 2 phiên khác.
    _, current_jti, _, _, _ = await _seed_session(db, uid, "changer@example.com")
    for jti in ("other-1", "other-2"):
        await create_session(
            db,
            SessionCreate(
                user_id=uid, access_jti=jti, refresh_jti=f"r-{jti}", device_info="pytest"
            ),
        )

    current_user = await get_user_by_id_db(db, uid)
    assert current_user is not None

    resp = await user_change_own_password(
        change_password_data=ChangePasswordRequest(
            current_password="OldPass1234", new_password="BrandNew5678"
        ),
        payload=TokenData(email="changer@example.com", user_id=uid, jti=current_jti),
        current_user=current_user,
        db=db,  # type: ignore[arg-type]
    )
    assert resp.status_code == 200

    # Phiên hiện tại còn; các phiên khác bị vô hiệu.
    assert await get_session_by_access_jti(db, current_jti) is not None
    assert await get_session_by_access_jti(db, "other-1") is None
    assert await get_session_by_access_jti(db, "other-2") is None

    # Mật khẩu đã đổi thật.
    updated = await get_user_by_id_db(db, uid)
    assert updated is not None and updated.hashed_password is not None
    assert verify_password("BrandNew5678", updated.hashed_password) is True


async def test_reset_password_invalidates_all_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Luồng khôi phục (quên mật khẩu) PHẢI thu hồi TOÀN BỘ phiên hiện có: người dùng
    # thường reset khi nghi ngờ bị chiếm tài khoản; nếu không thu hồi thì token/phiên
    # của kẻ tấn công vẫn sống (kể cả refresh) → lỗ hổng.
    db = FakeDB()
    uid = _uid()
    await _seed_user(db, uid, "victim@example.com", "OldPass1234")
    for jti in ("sess-1", "sess-2"):
        await create_session(
            db,
            SessionCreate(
                user_id=uid, access_jti=jti, refresh_jti=f"r-{jti}", device_info="pytest"
            ),
        )

    # OTP là collaborator (không phải đối tượng test) → giả lập verify hợp lệ.
    async def _ok_otp(*args: object, **kwargs: object) -> bool:
        return True

    monkeypatch.setattr("app.routers.auth.crud_verify_otp", _ok_otp)

    resp = await reset_password_with_otp(
        reset_data=ResetPasswordWithOtpRequest(
            email="victim@example.com", otp_code="123456", new_password="ResetPass7890"
        ),
        db=db,  # type: ignore[arg-type]
    )
    assert resp.status_code == 200

    # Sau reset: KHÔNG còn phiên nào của user.
    assert await get_session_by_access_jti(db, "sess-1") is None
    assert await get_session_by_access_jti(db, "sess-2") is None
