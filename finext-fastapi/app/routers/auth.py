# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated, Tuple, Any, Optional, List, Dict
from datetime import datetime, timezone # THÊM DATETIME, TIMEZONE

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import jwt
from bson import ObjectId # THÊM OBJECTID

from app.auth.dependencies import get_current_active_user
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_refresh_token_from_cookie, # Import dependency mới
    verify_token_and_get_payload,
)
from app.core.database import get_database
from app.crud.users import get_user_by_email_db, get_user_by_id_db
from app.crud.sessions import (
    count_sessions_by_user_id,
    find_and_delete_oldest_session,
    create_session,
    delete_session_by_jti
)
from app.crud.licenses import get_license_by_id # THÊM
from app.schemas.sessions import SessionCreate
from app.schemas.auth import (
    JWTTokenResponse,
    TokenData,
)
from app.schemas.users import UserPublic, UserInDB
from app.utils.response_wrapper import api_response_wrapper, StandardApiResponse
from app.utils.security import verify_password
from app.core.config import (
    SECRET_KEY, ALGORITHM, MAX_SESSIONS_PER_USER,
    REFRESH_TOKEN_COOKIE_NAME, COOKIE_SAMESITE, COOKIE_SECURE, COOKIE_DOMAIN
)

logger = logging.getLogger(__name__)
router = APIRouter()

if SECRET_KEY is None:
    raise ValueError("SECRET_KEY không được thiết lập.")

# Tuple type hint for clarity
CookieList = Optional[List[Dict[str, Any]]]
LogoutResponse = Tuple[None, CookieList, Optional[List[str]]]
LoginResponse = Tuple[JWTTokenResponse, CookieList, Optional[List[str]]]
RefreshResponse = Tuple[JWTTokenResponse, CookieList, Optional[List[str]]]


@router.post("/login", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> LoginResponse:
    user = await get_user_by_email_db(db, email=form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    access_payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
    jti = access_payload.get("jti")
    if not jti:
        raise HTTPException(status_code=500, detail="Lỗi tạo session (JTI).")

    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"

    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info))

    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "max_age": int(refresh_expires_delta.total_seconds()),
        "path": "/", # Thêm path để đảm bảo cookie được gửi đúng
    }

    logger.info(f"Login successful for user: {user.email}")
    return JWTTokenResponse(access_token=access_token), [cookie_params], None


@router.post("/logout", response_model=StandardApiResponse[None])
@api_response_wrapper(
    default_success_message="Đăng xuất thành công.",
    success_status_code=status.HTTP_200_OK
)
async def logout(
    payload: TokenData = Depends(verify_token_and_get_payload),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> LogoutResponse:
    jti_to_delete = payload.jti

    if not jti_to_delete:
        logger.warning("Logout attempt with no JTI in token payload.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing session identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    deleted = await delete_session_by_jti(db, jti_to_delete)
    if deleted:
        logger.info(f"User {payload.email} logged out successfully (JTI: {jti_to_delete}).")
    else:
        logger.warning(f"Logout attempt for JTI {jti_to_delete}, but session not found.")

    # Trả về (None, None, [cookie_name_to_delete])
    return None, None, [REFRESH_TOKEN_COOKIE_NAME]


@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
):
    return UserPublic.model_validate(current_user)

# --- THÊM ENDPOINT MỚI ---
@router.get(
    "/me/features",
    response_model=StandardApiResponse[List[str]],
    summary="Lấy danh sách các feature key mà người dùng hiện tại có quyền truy cập",
    description="Trả về một danh sách các 'key' của features dựa trên license hiện tại và còn hạn của người dùng."
)
@api_response_wrapper(default_success_message="Lấy danh sách features thành công.")
async def read_my_features(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """
    Lấy danh sách các feature_keys mà người dùng hiện tại sở hữu.
    """
    if not current_user.license_info or not current_user.license_info.active_license_id:
        logger.info(f"User {current_user.email} has no active license ID.")
        return []

    license_id = current_user.license_info.active_license_id
    expiry_date = current_user.license_info.license_expiry_date

    # Kiểm tra license_id hợp lệ
    if not ObjectId.is_valid(license_id):
         logger.warning(f"User {current_user.email} has an invalid license ID format: {license_id}.")
         return []

    # Kiểm tra license có hết hạn không
    if expiry_date and expiry_date < datetime.now(timezone.utc):
        logger.info(f"User {current_user.email}'s license (ID: {license_id}) has expired on {expiry_date}.")
        return []

    # Lấy thông tin license từ DB
    license_data = await get_license_by_id(db, license_id=license_id)

    if not license_data:
        logger.warning(f"User {current_user.email}'s license (ID: {license_id}) not found in DB.")
        return []

    feature_keys = license_data.feature_keys
    logger.info(f"User {current_user.email} has access to features: {feature_keys}")
    return feature_keys
# --- KẾT THÚC ENDPOINT MỚI ---

@router.post("/refresh-token", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(default_success_message="Làm mới token thành công.")
async def refresh_access_token(
    request: Request,
    refresh_token_str: str = Depends(get_refresh_token_from_cookie),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> RefreshResponse:
    try:
        payload = decode_refresh_token(refresh_token_str)
        user_id: str = payload["user_id"]
    except Exception as e:
        logger.error(f"Lỗi khi xử lý refresh token: {e}", exc_info=True)
        # Nếu refresh token không hợp lệ, cần xóa cookie
        response = JWTTokenResponse(access_token="") # Trả về rỗng
        return response, None, [REFRESH_TOKEN_COOKIE_NAME]


    user = await get_user_by_id_db(db, user_id=user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc không hoạt động.",
        )

    # --- TẠO SESSION MỚI KHI REFRESH ---
    current_session_count = await count_sessions_by_user_id(db, user_id)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id)

    new_token_data_payload = {"sub": user.email, "user_id": str(user.id)}
    new_access_token = create_access_token(data=new_token_data_payload)
    new_refresh_token_str, new_refresh_expires = create_refresh_token(data=new_token_data_payload)

    try:
        new_access_payload = jwt.decode(new_access_token, SECRET_KEY, algorithms=[ALGORITHM])
        new_jti = new_access_payload.get("jti")
        if not new_jti:
             raise Exception("JTI not found in new access token after refresh")
    except Exception as e:
        logger.error(f"Lỗi khi giải mã token mới (refresh) để lấy JTI: {e}")
        raise HTTPException(status_code=500, detail="Lỗi tạo session khi refresh.")

    user_agent = request.headers.get("user-agent", "Unknown (Refresh)")
    client_host = request.client.host if request.client else "Unknown (Refresh)"
    device_info = f"{user_agent} ({client_host})"

    await create_session(db, SessionCreate(user_id=user_id, jti=new_jti, device_info=device_info))

    new_cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": new_refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "max_age": int(new_refresh_expires.total_seconds()),
        "path": "/",
    }

    logger.info(f"Tokens refreshed successfully for user: {user.email}")
    return JWTTokenResponse(access_token=new_access_token), [new_cookie_params], None