# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated, Tuple, Any, Optional, List, Dict
from datetime import datetime, timezone, timedelta

import httpx # THÊM IMPORT HTTPX
from google.oauth2 import id_token as google_id_token # THÊM IMPORT CHO GOOGLE ID TOKEN
from google.auth.transport import requests as google_auth_requests # THÊM IMPORT

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import jwt, JWTError

from app.auth.dependencies import get_current_active_user, verify_active_session
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_refresh_token_from_cookie,
    verify_token_and_get_payload,
)
from app.core.database import get_database
# THÊM get_or_create_user_from_google TỪ crud.users
from app.crud.users import get_user_by_email_db, get_user_by_id_db, create_user_db, update_user_password, get_or_create_user_from_google
from app.crud.sessions import (
    count_sessions_by_user_id,
    find_and_delete_oldest_session,
    create_session,
    delete_session_by_jti,
    delete_sessions_for_user_except_jti,
)
import app.crud.licenses as crud_licenses
import app.crud.subscriptions as crud_subscriptions
from app.crud.otps import verify_and_use_otp as crud_verify_otp, create_otp_record as crud_create_otp_record
from app.schemas.sessions import SessionCreate
# THÊM GoogleLoginRequest, GoogleUser TỪ schemas.auth
from app.schemas.auth import JWTTokenResponse, TokenData, ResetPasswordWithOtpRequest, ChangePasswordRequest, GoogleLoginRequest, GoogleUser
from app.schemas.users import UserPublic, UserInDB, UserCreate
from app.schemas.otps import OtpVerificationRequest, OtpTypeEnum, OtpCreateInternal
from app.schemas.emails import MessageResponse
from bson import ObjectId
from app.utils.response_wrapper import api_response_wrapper, StandardApiResponse
from app.utils.security import verify_password
from app.core.config import (
    SECRET_KEY,
    ALGORITHM,
    MAX_SESSIONS_PER_USER,
    REFRESH_TOKEN_COOKIE_NAME,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    COOKIE_DOMAIN,
    OTP_EXPIRE_MINUTES,
    GOOGLE_CLIENT_ID,         # THÊM IMPORT CONFIG GOOGLE
    GOOGLE_CLIENT_SECRET,     # THÊM IMPORT CONFIG GOOGLE
    GOOGLE_REDIRECT_URI       # THÊM IMPORT CONFIG GOOGLE (Backend redirect URI)
)
from app.utils.otp_utils import generate_otp_code
from app.utils.email_utils import send_otp_email


logger = logging.getLogger(__name__)
router = APIRouter()

if SECRET_KEY is None:
    raise ValueError("SECRET_KEY không được thiết lập.")

CookieList = Optional[List[Dict[str, Any]]]
LogoutResponse = Tuple[None, CookieList, Optional[List[str]]]


@router.post(
    "/register",
    response_model=StandardApiResponse[MessageResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký người dùng mới và gửi OTP xác thực email",
    tags=["authentication"],
)
@api_response_wrapper(default_success_message="Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.")
async def register_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_user = await create_user_db(db, user_create_data=user_data, set_active_on_create=False)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    if not created_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo người dùng. Vui lòng thử lại sau.",
        )

    raw_otp = generate_otp_code()
    now = datetime.now(timezone.utc)
    internal_otp_payload = OtpCreateInternal(
        user_id=str(created_user.id),
        otp_type=OtpTypeEnum.EMAIL_VERIFICATION,
        otp_code=raw_otp,
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES),
        created_at=now,
    )
    otp_record = await crud_create_otp_record(db, internal_otp_payload)
    if not otp_record:
        await db.users.delete_one({"_id": ObjectId(created_user.id)})
        logger.info(f"Đã xóa user {created_user.email} do không thể tạo OTP record.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi khi tạo mã xác thực. Vui lòng thử đăng ký lại.")

    background_tasks.add_task(
        send_otp_email,
        email_to=created_user.email,
        full_name=created_user.full_name,
        otp_code=raw_otp,
        otp_type=OtpTypeEnum.EMAIL_VERIFICATION,
        expiry_minutes=OTP_EXPIRE_MINUTES,
    )
    return MessageResponse(message="Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.")


@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
):
    return UserPublic.model_validate(current_user)


@router.get(
    "/me/features",
    response_model=StandardApiResponse[List[str]],
    summary="Lấy danh sách các feature key mà người dùng hiện tại có quyền truy cập",
    description="Trả về một danh sách các 'key' của features dựa trên subscription hiện tại và còn hạn của người dùng.",
)
@api_response_wrapper(default_success_message="Lấy danh sách features thành công.")
async def read_my_features(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    subscription_id = current_user.subscription_id
    if not subscription_id:
        logger.info(f"User {current_user.email} has no active subscription ID.")
        return []
    subscription = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if not subscription:
        logger.warning(f"User {current_user.email}'s subscription ID ({subscription_id}) not found. Clearing from user doc.")
        await db.users.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"subscription_id": None}})
        return []
    now = datetime.now(timezone.utc)
    expiry_date = subscription.expiry_date
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    if not subscription.is_active or expiry_date < now:
        logger.info(f"User {current_user.email}'s subscription ({subscription_id}) is not active or has expired.")
        return []
    license_data = await crud_licenses.get_license_by_id(db, license_id=subscription.license_id)
    if not license_data:
        logger.warning(
            f"User {current_user.email}'s license (ID: {subscription.license_id}) from subscription ({subscription_id}) not found in DB."
        )
        return []
    feature_keys = license_data.feature_keys
    logger.info(f"User {current_user.email} has access to features: {feature_keys} via sub {subscription_id}")
    return feature_keys


@router.post("/logout", response_model=StandardApiResponse[None])
@api_response_wrapper(default_success_message="Đăng xuất thành công.", success_status_code=status.HTTP_200_OK)
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
    return None, None, [REFRESH_TOKEN_COOKIE_NAME]


@router.post("/refresh-token", response_model=JWTTokenResponse)
async def refresh_access_token(
    request: Request,
    refresh_token_str: str = Depends(get_refresh_token_from_cookie),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:
    try:
        payload = decode_refresh_token(refresh_token_str)
        user_id: str = payload["user_id"]
    except Exception as e:
        logger.error(f"Lỗi khi xử lý refresh token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token. Please log in again.",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    user = await get_user_by_id_db(db, user_id=user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc không hoạt động.",
        )
    current_session_count = await count_sessions_by_user_id(db, user_id)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id)
    new_token_data_payload = {"sub": user.email, "user_id": str(user.id)}
    new_access_token = create_access_token(data=new_token_data_payload)
    new_refresh_token_str, new_refresh_expires = create_refresh_token(data=new_token_data_payload)
    try:
        new_access_payload = jwt.decode(new_access_token, SECRET_KEY, algorithms=[ALGORITHM]) # type: ignore
        new_jti = new_access_payload.get("jti")
        if not new_jti:
            logger.error("JTI not found in new access token after refresh.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error creating session identifier (JTI) on refresh."
            )
    except JWTError as e:
        logger.error(f"Lỗi khi giải mã token mới (refresh) để lấy JTI: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing new token on refresh.")
    user_agent = request.headers.get("user-agent", "Unknown (Refresh)")
    client_host = request.client.host if request.client else "Unknown (Refresh)"
    device_info = f"{user_agent} ({client_host})"
    await create_session(db, SessionCreate(user_id=user_id, jti=new_jti, device_info=device_info)) # type: ignore
    response_content_data = JWTTokenResponse(access_token=new_access_token)
    actual_response = JSONResponse(content=response_content_data.model_dump())
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
    actual_response.set_cookie(**new_cookie_params)
    logger.info(f"Tokens refreshed successfully for user: {user.email}")
    return actual_response


@router.post("/login", response_model=JWTTokenResponse)
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:
    user = await get_user_by_email_db(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is inactive",
        )
    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)
    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM]) # type: ignore
        jti = access_payload.get("jti")
        if not jti:
            logger.error("JTI not found in new access token during login.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error creating session identifier (JTI).")
    except JWTError as e:
        logger.error(f"Error decoding access token to get JTI: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing token.")
    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"
    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info)) # type: ignore
    response_content_data = JWTTokenResponse(access_token=access_token_str)
    actual_response = JSONResponse(content=response_content_data.model_dump())
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "max_age": int(refresh_expires_delta.total_seconds()),
        "path": "/",
    }
    actual_response.set_cookie(**cookie_params)
    logger.info(f"Login successful for user: {user.email}")
    return actual_response


@router.post("/login-otp", response_model=JWTTokenResponse, summary="Đăng nhập bằng email và OTP (Passwordless)", tags=["authentication"])
async def login_with_otp(
    request: Request,
    otp_login_data: OtpVerificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if otp_login_data.otp_type != OtpTypeEnum.PWDLESS_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loại OTP không hợp lệ cho chức năng đăng nhập không mật khẩu. Cần: {OtpTypeEnum.PWDLESS_LOGIN.value}",
        )
    user = await get_user_by_email_db(db, email=otp_login_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mã OTP không chính xác.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản người dùng chưa được kích hoạt hoặc đã bị khóa.",
        )
    is_otp_valid = await crud_verify_otp(
        db,
        user_id=str(user.id),
        otp_type=otp_login_data.otp_type,
        plain_otp_code=otp_login_data.otp_code,
    )
    if not is_otp_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mã OTP không chính xác.",
        )
    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
        logger.info(f"Đã xóa session cũ nhất cho user {user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions.")
    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)
    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM]) # type: ignore
        jti = access_payload.get("jti")
        if not jti:
            logger.error("JTI not found in new access token during OTP login.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo định danh session (JTI).")
    except JWTError as e:
        logger.error(f"Lỗi giải mã access token để lấy JTI khi login OTP: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token.")
    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"
    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info)) # type: ignore
    response_content_data = JWTTokenResponse(access_token=access_token_str)
    actual_response = JSONResponse(content=response_content_data.model_dump())
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "max_age": int(refresh_expires_delta.total_seconds()),
        "path": "/",
    }
    actual_response.set_cookie(**cookie_params)
    logger.info(f"Đăng nhập bằng OTP thành công cho user: {user.email}")
    return actual_response


@router.post(
    "/reset-password-otp",
    response_model=StandardApiResponse[MessageResponse],
    summary="Đặt lại mật khẩu bằng email, OTP và mật khẩu mới",
    tags=["authentication"],
)
@api_response_wrapper(default_success_message="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.")
async def reset_password_with_otp(
    reset_data: ResetPasswordWithOtpRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await get_user_by_email_db(db, email=reset_data.email)
    if not user:
        logger.warning(f"Yêu cầu đặt lại mật khẩu cho email không tồn tại: {reset_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thông tin không hợp lệ hoặc yêu cầu không thể được xử lý.",
        )
    if not user.is_active:
        logger.warning(f"Yêu cầu đặt lại mật khẩu cho tài khoản không hoạt động: {reset_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản này không hoạt động. Vui lòng liên hệ hỗ trợ.",
        )
    is_otp_valid = await crud_verify_otp(
        db,
        user_id=str(user.id),
        otp_type=OtpTypeEnum.RESET_PASSWORD,
        plain_otp_code=reset_data.otp_code,
    )
    if not is_otp_valid:
        logger.warning(f"Mã OTP không hợp lệ hoặc đã hết hạn cho yêu cầu đặt lại mật khẩu của {reset_data.email}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã OTP không hợp lệ hoặc đã hết hạn.",
        )
    password_updated = await update_user_password(db, user_id=str(user.id), new_password=reset_data.new_password)
    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {user.email} (quên mật khẩu) dù OTP hợp lệ.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đặt lại mật khẩu. Vui lòng thử lại sau.",
        )
    return MessageResponse(message="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.")


@router.post(
    "/me/change-password",
    response_model=StandardApiResponse[MessageResponse],
    summary="Người dùng tự đổi mật khẩu khi đã đăng nhập",
    tags=["authentication", "users"],
)
@api_response_wrapper(default_success_message="Đổi mật khẩu thành công.")
async def user_change_own_password(
    change_password_data: ChangePasswordRequest,
    payload: TokenData = Depends(verify_active_session),
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not verify_password(change_password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác.",
        )
    if verify_password(change_password_data.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu cũ.",
        )
    password_updated = await update_user_password(
        db, user_id=str(current_user.id), new_password=change_password_data.new_password
    )
    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {current_user.email} (tự đổi).")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đổi mật khẩu. Vui lòng thử lại sau.",
        )
    current_jti = payload.jti
    if current_jti:
        deleted_sessions_count = await delete_sessions_for_user_except_jti(db, str(current_user.id), current_jti)
        logger.info(f"Đã đăng xuất {deleted_sessions_count} session khác của user {current_user.email} sau khi đổi mật khẩu.")
    else:
        logger.warning(f"Không tìm thấy JTI trong token của user {current_user.email} khi đổi mật khẩu, không thể hủy các session khác.")
    return MessageResponse(message="Đổi mật khẩu thành công.")

@router.post("/google/callback", response_model=JWTTokenResponse, tags=["authentication"])
async def google_oauth_callback(
    request: Request,
    login_request_data: GoogleLoginRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth Client ID hoặc Secret chưa được cấu hình trên server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tính năng đăng nhập Google chưa được cấu hình đúng cách trên máy chủ.",
        )

    token_url = "https://oauth2.googleapis.com/token"

    # --- DEBUG LOGGING ---
    logger.info(f"GOOGLE_REDIRECT_URI from config: '{GOOGLE_REDIRECT_URI}' (Type: {type(GOOGLE_REDIRECT_URI)})")
    logger.info(f"login_request_data.redirect_uri from frontend: '{login_request_data.redirect_uri}' (Type: {type(login_request_data.redirect_uri)})")
    # --- END DEBUG LOGGING ---

    effective_redirect_uri = login_request_data.redirect_uri or GOOGLE_REDIRECT_URI

    # --- DEBUG LOGGING ---
    logger.info(f"Effective redirect_uri for Google token exchange: '{effective_redirect_uri}'")
    # --- END DEBUG LOGGING ---

    if not effective_redirect_uri:
        logger.error("Không thể xác định redirect_uri cho việc trao đổi Google OAuth code.") # Lỗi của bạn xuất hiện ở đây
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="redirect_uri is required for Google token exchange.")


    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(
                token_url,
                data={
                    "code": login_request_data.code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": effective_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            logger.info(f"Google token request sent with redirect_uri: {effective_redirect_uri}") # Log URI đã gửi
            token_response.raise_for_status()
            token_data = token_response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Lỗi khi trao đổi Google authorization code: {e.response.text}") # Đây là lỗi bạn gặp
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể trao đổi mã ủy quyền với Google: {e.response.text}",
            )
        except Exception as e:
            logger.error(f"Lỗi không mong muốn khi gọi Google token endpoint: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi kết nối đến dịch vụ xác thực Google.",
            )

    google_access_token = token_data.get("access_token")
    google_id_token_str = token_data.get("id_token")

    if not google_id_token_str:
        logger.error("Không nhận được id_token từ Google.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể lấy thông tin người dùng từ Google (thiếu id_token).",
        )

    try:
        id_info = google_id_token.verify_oauth2_token(
            google_id_token_str, google_auth_requests.Request(), GOOGLE_CLIENT_ID
        )
        if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")
        
        g_user_data = GoogleUser(
            id=id_info["sub"],
            email=id_info["email"],
            verified_email=id_info.get("email_verified", False),
            name=id_info.get("name"),
            given_name=id_info.get("given_name"),
            family_name=id_info.get("family_name"),
            picture=id_info.get("picture"),
            locale=id_info.get("locale"),
        )
    except ValueError as e:
        logger.error(f"Google ID token không hợp lệ: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token không hợp lệ.",
        )
    except Exception as e:
        logger.error(f"Lỗi không mong muốn khi xác thực Google ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi khi xử lý thông tin từ Google.",
        )

    if not g_user_data.verified_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email Google chưa được xác thực. Vui lòng xác thực email với Google trước.",
        )

    user = await get_or_create_user_from_google(db, g_user_data)
    if not user:
        logger.error(f"Không thể lấy hoặc tạo người dùng từ Google data cho email: {g_user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể xử lý thông tin người dùng trong hệ thống.",
        )

    if not user.is_active:
        logger.warning(f"Người dùng {user.email} đăng nhập bằng Google nhưng tài khoản đang không hoạt động trong hệ thống.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn hiện không hoạt động trong hệ thống. Vui lòng liên hệ hỗ trợ.",
        )

    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
        logger.info(f"Đã xóa session cũ nhất cho user {user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions.")

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM]) # type: ignore
        jti = access_payload.get("jti")
        if not jti:
            logger.error("JTI not found in new access token during Google login.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo định danh session (JTI).")
    except JWTError as e:
        logger.error(f"Lỗi giải mã access token để lấy JTI khi login Google: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token.")

    user_agent = request.headers.get("user-agent", "Unknown (Google Login)")
    client_host = request.client.host if request.client else "Unknown (Google Login)"
    device_info = f"{user_agent} ({client_host})"
    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info)) # type: ignore
    response_content_data = JWTTokenResponse(access_token=access_token_str)
    actual_response = JSONResponse(content=response_content_data.model_dump())
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "max_age": int(refresh_expires_delta.total_seconds()),
        "path": "/",
    }
    actual_response.set_cookie(**cookie_params)
    logger.info(f"Đăng nhập bằng Google thành công cho user: {user.email}")
    return actual_response