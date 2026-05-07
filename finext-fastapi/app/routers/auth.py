# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated, Tuple, Any, Optional, List, Dict, Literal, cast  # Thêm List, Dict nếu bạn dùng ở đâu đó
from datetime import datetime, timezone, timedelta  # noqa: F401  # timedelta giữ lại nếu cần (OTP register flow đã disabled)

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks  # noqa: F401  # BackgroundTasks giữ lại nếu cần
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import jwt, JWTError
from email_validator import validate_email, EmailNotValidError

from app.auth.dependencies import get_current_active_user, verify_active_session
from app.auth.access import get_user_permissions
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_refresh_token_from_cookie,
    verify_token_and_get_payload,
)
from app.core.database import get_database

# SỬA: Đổi tên hàm import từ crud.users
from app.crud.users import (
    get_user_by_email_db,
    get_user_by_id_db,
    create_user_db,  # Vẫn giữ nếu dùng cho register truyền thống
    update_user_password,
    get_or_create_user_from_google_sub_email,  # SỬA THÀNH HÀM MỚI
)
from app.crud.sessions import (
    count_sessions_by_user_id,
    find_and_delete_oldest_session,
    create_session,
    delete_session_by_access_jti,
    delete_sessions_for_user_except_jti,
    get_session_by_refresh_jti,
    update_session_jtis,
    delete_session_by_id,
)
import app.crud.licenses as crud_licenses  # Giữ lại nếu cần
import app.crud.subscriptions as crud_subscriptions  # Giữ lại nếu cần
from app.crud.otps import verify_and_use_otp as crud_verify_otp, create_otp_record as crud_create_otp_record  # noqa: F401  # crud_create_otp_record giữ lại nếu cần (OTP register flow disabled)
from app.schemas.sessions import SessionCreate

# SỬA: Sử dụng GoogleUserSchema từ app.schemas.users
from app.schemas.auth import JWTTokenResponse, TokenData, ResetPasswordWithOtpRequest, ChangePasswordRequest, GoogleLoginRequest
from app.schemas.users import UserPublic, UserInDB, UserCreate, GoogleUserSchema  # THÊM GoogleUserSchema
from app.schemas.otps import OtpVerificationRequest, OtpTypeEnum, OtpCreateInternal  # noqa: F401  # OtpCreateInternal giữ lại nếu cần
from app.schemas.emails import MessageResponse  # Giữ lại nếu cần
from bson import ObjectId
from app.utils.response_wrapper import api_response_wrapper, StandardApiResponse
from app.utils.security import verify_password
from app.utils.google_auth import get_google_user_info_from_token
from app.core.config import (
    SECRET_KEY,
    ALGORITHM,
    MAX_SESSIONS_PER_USER,
    REFRESH_TOKEN_COOKIE_NAME,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    COOKIE_DOMAIN,
    OTP_EXPIRE_MINUTES,  # noqa: F401  # giữ lại nếu cần (OTP register flow disabled)
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    # GOOGLE_REDIRECT_URI, # Không cần thiết ở đây nếu frontend gửi redirect_uri
)
from app.utils.otp_utils import generate_otp_code  # noqa: F401  # giữ lại nếu cần (OTP register flow disabled)
from app.utils.email_utils import send_otp_email, send_registration_received_email  # noqa: F401  # send_otp_email giữ lại nếu cần


logger = logging.getLogger(__name__)
router = APIRouter()

if SECRET_KEY is None:  # Kiểm tra một lần khi load module
    logger.critical("FATAL: SECRET_KEY không được thiết lập trong cấu hình.")
    raise ValueError("SECRET_KEY không được thiết lập.")

CookieList = Optional[List[Dict[str, Any]]]
LogoutResponse = Tuple[None, CookieList, Optional[List[str]]]


@router.post(
    "/register",
    response_model=StandardApiResponse[MessageResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký người dùng mới — admin xác nhận thủ công, không OTP",
    tags=["authentication"],
)
@api_response_wrapper(default_success_message="Yêu cầu tạo tài khoản đã được ghi nhận.")
async def register_user(
    user_data: UserCreate,  # UserCreate giờ có password là Optional
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not user_data.password:  # Kiểm tra password cho đăng ký truyền thống
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mật khẩu là bắt buộc cho hình thức đăng ký này.")

    # Compliance pivot 2026-05-07: verify DNS MX record của domain trước khi tạo user.
    # Catch domain không tồn tại (vd: "abc@mfgsdf.cocm") trước khi SMTP submission accept-then-bounce.
    try:
        validate_email(user_data.email, check_deliverability=True)
    except EmailNotValidError as e:
        logger.warning(f"Email validation failed for {user_data.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email không tồn tại. Vui lòng kiểm tra lại địa chỉ email.",
        )

    try:
        # set_active_on_create=False — admin sẽ kích hoạt thủ công sau khi xác minh
        created_user = await create_user_db(db, user_create_data=user_data, set_active_on_create=False)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    if not created_user:  # create_user_db trả về None nếu có lỗi không mong muốn
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo người dùng. Vui lòng thử lại sau.",
        )

    # Compliance pivot 2026-05-07: gửi mail "yêu cầu đã ghi nhận" SYNC để verify email tồn tại.
    # Nếu gửi thất bại (email không tồn tại / SMTP reject) → rollback xóa user vừa tạo.
    email_sent = await send_registration_received_email(
        email_to=created_user.email,
        full_name=created_user.full_name,
    )
    if not email_sent:
        await db.users.delete_one({"_id": ObjectId(created_user.id)})
        logger.warning(
            f"Đã xóa user {created_user.email} do gửi email registration_received thất bại."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể gửi email xác nhận. Vui lòng kiểm tra lại địa chỉ email và đăng ký lại.",
        )

    return MessageResponse(
        message="Yêu cầu tạo tài khoản đã được ghi nhận. Đội ngũ Finext sẽ xác nhận trong vòng 1 giờ. Vui lòng kiểm tra email để biết thêm chi tiết."
    )


@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(default_success_message="Lấy thông tin người dùng thành công.")
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Query role names từ database
    role_names = []
    if current_user.role_ids:
        roles_cursor = db.roles.find({"_id": {"$in": [ObjectId(rid) if isinstance(rid, str) else rid for rid in current_user.role_ids]}})
        async for role in roles_cursor:
            if "name" in role:
                role_names.append(role["name"])

    # Tạo response với role_names
    user_data = current_user.model_dump()
    user_data["role_names"] = role_names
    return UserPublic.model_validate(user_data)


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
        return []  # Trả về mảng rỗng nếu không có subscription_id

    # Đảm bảo subscription_id là PyObjectId (str) trước khi truyền vào CRUD
    sub_id_str = str(subscription_id) if isinstance(subscription_id, ObjectId) else subscription_id

    subscription = await crud_subscriptions.get_subscription_by_id_db(db, sub_id_str)  # type: ignore
    if not subscription:
        logger.warning(f"User {current_user.email}'s subscription ID ({sub_id_str}) not found. Clearing from user doc.")
        # Xóa subscription_id không hợp lệ khỏi user
        await db.users.update_one(
            {"_id": ObjectId(current_user.id)}, {"$set": {"subscription_id": None, "updated_at": datetime.now(timezone.utc)}}
        )
        return []

    now = datetime.now(timezone.utc)
    # Đảm bảo expiry_date là timezone-aware
    expiry_date = subscription.expiry_date
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)

    if not subscription.is_active or expiry_date < now:
        logger.info(f"User {current_user.email}'s subscription ({sub_id_str}) is not active or has expired.")
        # Cân nhắc: nếu sub hết hạn/inactive, có thể xóa subscription_id khỏi user ở đây không?
        # Hoặc để một background task xử lý việc này. Hiện tại chỉ trả về list rỗng.
        return []

    # Đảm bảo license_id là PyObjectId (str)
    license_id_str = str(subscription.license_id) if isinstance(subscription.license_id, ObjectId) else subscription.license_id

    license_data = await crud_licenses.get_license_by_id(db, license_id=license_id_str)  # type: ignore
    if not license_data:
        logger.warning(f"User {current_user.email}'s license (ID: {license_id_str}) from subscription ({sub_id_str}) not found in DB.")
        return []

    feature_keys = license_data.feature_keys
    logger.info(f"User {current_user.email} has access to features: {feature_keys} via sub {sub_id_str}")
    return feature_keys


@router.get(
    "/me/permissions",
    response_model=StandardApiResponse[List[str]],
    summary="Lấy danh sách permission names của người dùng hiện tại",
    description="Trả về danh sách các permission name dựa trên roles của user.",
)
@api_response_wrapper(default_success_message="Lấy danh sách permissions thành công.")
async def read_my_permissions(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    permissions = await get_user_permissions(db, str(current_user.id))
    return sorted(list(permissions))


@router.post("/logout", response_model=StandardApiResponse[None])
@api_response_wrapper(default_success_message="Đăng xuất thành công.", success_status_code=status.HTTP_200_OK)
async def logout(
    payload: TokenData = Depends(verify_token_and_get_payload),  # verify_token_and_get_payload không kiểm tra active session
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> LogoutResponse:  # Kiểu trả về cho wrapper
    jti_to_delete = payload.jti
    if not jti_to_delete:
        logger.warning("Logout attempt with no JTI in token payload.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing session identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    deleted = await delete_session_by_access_jti(db, jti_to_delete)
    if deleted:
        logger.info(f"User {payload.email} logged out successfully (Access JTI: {jti_to_delete}).")
    else:
        # Vẫn trả về thành công cho client để đảm bảo logout, dù session có thể đã bị xóa trước đó
        logger.warning(
            f"Logout attempt for Access JTI {jti_to_delete}, but session not found in DB (possibly already deleted or never existed)."
        )

    # Trả về tuple cho wrapper để xóa cookie
    return None, None, [REFRESH_TOKEN_COOKIE_NAME]


@router.post("/refresh-token", response_model=JWTTokenResponse)
async def refresh_access_token(
    request: Request,
    refresh_token_str: str = Depends(get_refresh_token_from_cookie),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:
    """
    NEW LOGIC: Refresh token với device validation và session lookup bằng refresh_jti
    """
    # Decode refresh token
    try:
        refresh_payload = decode_refresh_token(refresh_token_str)
        user_id: str = refresh_payload["user_id"]
        refresh_jti: str = refresh_payload["jti"]
    except Exception as e:
        logger.error(f"Lỗi khi decode refresh token: {e}", exc_info=True)
        # Xóa cookie lỗi
        response = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Could not validate refresh token. Please log in again."}
        )
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            domain=COOKIE_DOMAIN,
            path="/",
            secure=COOKIE_SECURE,
            httponly=True,
            samesite=cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token. Please log in again.",
        )

    # Lấy device info hiện tại (chỉ User-Agent, không bao gồm IP để tránh force logout khi đổi mạng)
    user_agent = request.headers.get("user-agent", "Unknown (Refresh)")
    client_host = request.client.host if request.client else "Unknown (Refresh)"
    current_device_info = user_agent

    # TÌM SESSION bằng refresh_jti (CORE LOGIC CHANGE)
    session = await get_session_by_refresh_jti(db, refresh_jti)
    if not session:
        logger.warning(f"Refresh token JTI {refresh_jti} not found in sessions")
        response = JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid refresh token session"})
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            domain=COOKIE_DOMAIN,
            path="/",
            secure=COOKIE_SECURE,
            httponly=True,
            samesite=cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token session")

    # VALIDATE DEVICE INFO (chỉ so sánh User-Agent, cho phép IP thay đổi)
    stored_device_info = session.device_info
    if stored_device_info != current_device_info:
        # Device (User-Agent) changed = XÓA SESSION + FORCE LOGOUT
        await delete_session_by_id(db, str(session.id))
        logger.warning(
            f"User-Agent changed for user {user_id}. Session deleted. Stored: {stored_device_info} vs Current: {current_device_info}"
        )

        # XÓA REFRESH TOKEN COOKIE
        response = JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Device changed. Please login again."})
        response.delete_cookie(
            REFRESH_TOKEN_COOKIE_NAME,
            domain=COOKIE_DOMAIN,
            path="/",
            secure=COOKIE_SECURE,
            httponly=True,
            samesite=cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device changed. Please login again.")
    elif client_host != "Unknown (Refresh)":
        # Log IP change nhưng KHÔNG force logout
        # Extract stored IP nếu có trong device_info cũ (format cũ có IP)
        logger.info(f"Refresh token used from IP {client_host} for user {user_id}")

    # Validate user
    user = await get_user_by_id_db(db, user_id=user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")

    # Tạo tokens mới
    new_token_data = {"sub": user.email, "user_id": str(user.id)}
    new_access_token = create_access_token(data=new_token_data)
    new_refresh_token, new_refresh_expires = create_refresh_token(data=new_token_data)

    # Lấy JTIs mới
    try:
        new_access_payload = jwt.decode(new_access_token, SECRET_KEY, algorithms=[ALGORITHM])
        new_refresh_payload = jwt.decode(new_refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

        new_access_jti = new_access_payload.get("jti")
        new_refresh_jti = new_refresh_payload.get("jti")

        if not new_access_jti or not new_refresh_jti:
            logger.error("JTI không tìm thấy trong tokens mới sau refresh")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo JTI")
    except JWTError as e:
        logger.error(f"Lỗi decode tokens mới: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token")

    # UPDATE SESSION với JTIs mới (giữ nguyên device_info)
    updated = await update_session_jtis(db, str(session.id), new_access_jti, new_refresh_jti)
    if not updated:
        logger.error(f"Không thể update session {session.id} với JTIs mới")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi cập nhật session")

    # Return new tokens with cookie
    response_data = JWTTokenResponse(access_token=new_access_token)
    response = JSONResponse(content=response_data.model_dump())

    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=new_refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),
        domain=COOKIE_DOMAIN,
        max_age=int(new_refresh_expires.total_seconds()),
        path="/",
    )

    logger.info(f"Tokens refreshed successfully for user: {user.email} with device validation")
    return response


@router.post("/login", response_model=JWTTokenResponse)  # response_model này chỉ mô tả JSON body
async def login_for_access_token(
    request: Request,  # Giữ lại Request
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:  # Trả về JSONResponse để set cookie
    user = await get_user_by_email_db(db, email=form_data.username)
    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        # Kiểm tra user.hashed_password để tránh lỗi nếu user tạo qua Google chưa set mật khẩu
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

    user_id_str = str(user.id)  # Đảm bảo user.id là string
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        deleted_oldest = await find_and_delete_oldest_session(db, user_id_str)
        if deleted_oldest:
            logger.info(f"Đã xóa session cũ nhất cho user {user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions khi đăng nhập.")
        else:
            logger.warning(f"Không thể xóa session cũ nhất cho user {user.email} dù đã đạt giới hạn.")

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    # Tạo session cho cả access_token và refresh_token
    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
        refresh_payload = jwt.decode(refresh_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore

        access_jti = access_payload.get("jti")
        refresh_jti = refresh_payload.get("jti")

        if not access_jti or not refresh_jti:
            logger.error("JTI không tìm thấy trong tokens khi đăng nhập.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo định danh session (JTI).")
    except JWTError as e:
        logger.error(f"Lỗi giải mã tokens để lấy JTI: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token.")

    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"  # noqa: F841  # giữ lại để debug nếu cần, không log để bảo mật IP
    device_info = user_agent  # Chỉ lưu User-Agent, không bao gồm IP

    logger.info(f"🔄 Creating session for user {user.email} with access_jti: {access_jti}")
    session_result = await create_session(
        db, SessionCreate(user_id=user_id_str, access_jti=access_jti, refresh_jti=refresh_jti, device_info=device_info)
    )

    if not session_result:
        logger.error(f"❌ Failed to create session for user {user.email}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể tạo session đăng nhập.")

    logger.info(f"✅ Login successful for user {user.email} with session ID: {session_result.id}")

    response_content_data = JWTTokenResponse(access_token=access_token_str)
    actual_response = JSONResponse(content=response_content_data.model_dump())

    # Set refresh token vào HttpOnly cookie
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,  # Sẽ là True nếu dùng HTTPS
        "samesite": cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),  # "lax" hoặc "strict"
        "domain": COOKIE_DOMAIN,  # None cho localhost, đặt domain cho production
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
            status_code=status.HTTP_401_UNAUTHORIZED,  # Có thể là 400 hoặc 404 tùy logic
            detail="Email hoặc mã OTP không chính xác.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản người dùng chưa được kích hoạt hoặc đã bị khóa.",
        )

    # Xác thực OTP
    is_otp_valid = await crud_verify_otp(
        db,
        user_id=str(user.id),  # Đảm bảo user.id là string
        otp_type=otp_login_data.otp_type,
        plain_otp_code=otp_login_data.otp_code,
    )
    if not is_otp_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mã OTP không chính xác.",  # Hoặc "Mã OTP không hợp lệ hoặc đã hết hạn."
        )

    # Logic tạo token và session tương tự login truyền thống
    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
        logger.info(f"Đã xóa session cũ nhất cho user {user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions.")

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
        refresh_payload = jwt.decode(refresh_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore

        access_jti = access_payload.get("jti")
        refresh_jti = refresh_payload.get("jti")

        if not access_jti or not refresh_jti:
            logger.error("JTI không tìm thấy trong tokens khi login OTP.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo định danh session (JTI).")
    except JWTError as e:
        logger.error(f"Lỗi giải mã tokens để lấy JTI khi login OTP: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token.")

    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"  # noqa: F841  # giữ lại để debug nếu cần, không log để bảo mật IP
    device_info = user_agent  # Chỉ lưu User-Agent, không bao gồm IP
    await create_session(db, SessionCreate(user_id=user_id_str, access_jti=access_jti, refresh_jti=refresh_jti, device_info=device_info))

    response_content_data = JWTTokenResponse(access_token=access_token_str)
    actual_response = JSONResponse(content=response_content_data.model_dump())
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": cast(Literal["lax", "none", "strict"], COOKIE_SAMESITE),
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
            status_code=status.HTTP_400_BAD_REQUEST,  # 400 vì thông tin cung cấp không hợp lệ chung
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
        otp_type=OtpTypeEnum.RESET_PASSWORD,  # Đảm bảo đúng type
        plain_otp_code=reset_data.otp_code,
    )
    if not is_otp_valid:
        logger.warning(f"Mã OTP không hợp lệ hoặc đã hết hạn cho yêu cầu đặt lại mật khẩu của {reset_data.email}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã OTP không hợp lệ hoặc đã hết hạn.",
        )

    # Cập nhật mật khẩu
    password_updated = await update_user_password(db, user_id=str(user.id), new_password=reset_data.new_password)
    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {user.email} (quên mật khẩu) dù OTP hợp lệ.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đặt lại mật khẩu. Vui lòng thử lại sau.",
        )
    # Mặc định sẽ trả về success message từ wrapper
    return MessageResponse(message="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.")


@router.post(
    "/me/change-password",
    response_model=StandardApiResponse[MessageResponse],
    summary="Người dùng tự đổi mật khẩu khi đã đăng nhập",
    tags=["authentication", "users"],  # Có thể thêm tag "users"
)
@api_response_wrapper(default_success_message="Đổi mật khẩu thành công.")
async def user_change_own_password(
    change_password_data: ChangePasswordRequest,
    payload: TokenData = Depends(verify_active_session),  # Sử dụng verify_active_session để đảm bảo session còn hoạt động
    current_user: UserInDB = Depends(get_current_active_user),  # Đã bao gồm kiểm tra session
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not current_user.hashed_password:  # Kiểm tra nếu user tạo qua Google chưa từng set mật khẩu
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn được tạo qua Google và chưa có mật khẩu Finext. Vui lòng sử dụng chức năng 'Quên mật khẩu' để tạo mật khẩu mới nếu cần.",
        )

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

    password_updated = await update_user_password(db, user_id=str(current_user.id), new_password=change_password_data.new_password)
    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {current_user.email} (tự đổi).")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đổi mật khẩu. Vui lòng thử lại sau.",
        )

    # Hủy tất cả các session khác của user này
    current_jti = payload.jti  # Lấy jti từ payload của token hiện tại (đã được verify_active_session)
    if current_jti:
        deleted_sessions_count = await delete_sessions_for_user_except_jti(db, str(current_user.id), current_jti)
        logger.info(f"Đã đăng xuất {deleted_sessions_count} session khác của user {current_user.email} sau khi đổi mật khẩu.")
    else:
        # Trường hợp này không nên xảy ra nếu verify_active_session hoạt động đúng
        logger.warning(f"Không tìm thấy JTI trong token của user {current_user.email} khi đổi mật khẩu, không thể hủy các session khác.")

    return MessageResponse(message="Đổi mật khẩu thành công.")


@router.post("/google/callback", response_model=JWTTokenResponse, tags=["authentication"])
async def google_oauth_callback(
    request: Request,  # Giữ lại Request
    login_request_data: GoogleLoginRequest,  # Schema cho body từ frontend
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth Client ID hoặc Secret chưa được cấu hình trên server.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tính năng đăng nhập Google chưa được cấu hình đúng cách trên máy chủ.",
        )

    token_url = "https://oauth2.googleapis.com/token"
    # redirect_uri mà backend sử dụng để trao đổi code PHẢI khớp với một trong các
    # Authorized redirect URIs đã đăng ký trên Google Cloud Console cho Client ID này.
    # Frontend sẽ gửi code và redirect_uri mà NÓ đã sử dụng để lấy code.
    # Backend sẽ dùng redirect_uri này.
    if not login_request_data.redirect_uri:
        logger.error("redirect_uri là bắt buộc từ frontend khi trao đổi Google OAuth code.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="redirect_uri is required from frontend for Google token exchange."
        )

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(
                token_url,
                data={
                    "code": login_request_data.code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": login_request_data.redirect_uri,  # Sử dụng redirect_uri từ frontend
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()  # Ném lỗi nếu status không phải 2xx
            token_data = token_response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Lỗi khi trao đổi Google authorization code: {e.response.text}")
            # Cung cấp chi tiết lỗi từ Google nếu có
            error_detail_from_google = e.response.json().get("error_description", e.response.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể trao đổi mã ủy quyền với Google: {error_detail_from_google}",
            )
        except Exception as e:  # Các lỗi khác như network
            logger.error(f"Lỗi không mong muốn khi gọi Google token endpoint: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi kết nối đến dịch vụ xác thực Google.",
            )

    google_id_token_str = token_data.get("id_token")
    if not google_id_token_str:
        logger.error("Không nhận được id_token từ Google.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể lấy thông tin người dùng từ Google (thiếu id_token).",
        )  # Xác thực id_token và lấy thông tin user với clock skew tolerance
    try:
        id_info = get_google_user_info_from_token(google_id_token_str, GOOGLE_CLIENT_ID)

        if not id_info:
            raise ValueError("Unable to verify Google ID token")

        # Tạo đối tượng GoogleUserSchema từ id_info
        g_user_data_for_crud = GoogleUserSchema(
            id=id_info["sub"],  # sub chính là google_id
            email=id_info["email"],
            verified_email=id_info.get("email_verified", False),
            name=id_info.get("name"),
            given_name=id_info.get("given_name"),
            family_name=id_info.get("family_name"),
            picture=id_info.get("picture"),
            locale=id_info.get("locale"),
        )
    except Exception as e:  # Các lỗi từ verification
        logger.error(f"Google ID token không hợp lệ: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token không hợp lệ.",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi khi xử lý thông tin từ Google.",
        )

    # Lấy hoặc tạo user Finext
    try:
        finext_user = await get_or_create_user_from_google_sub_email(db, g_user_data_for_crud)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ email đã liên kết Google khác, email Google chưa verify)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if not finext_user:
        logger.error(f"Không thể lấy hoặc tạo người dùng Finext từ Google data cho email: {g_user_data_for_crud.email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể xử lý thông tin người dùng trong hệ thống.",
        )

    if not finext_user.is_active:
        logger.warning(f"Người dùng {finext_user.email} đăng nhập bằng Google nhưng tài khoản đang không hoạt động trong hệ thống Finext.")
        # Dù email Google đã verified, nếu admin đã deactive user trong Finext, không cho đăng nhập.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,  # Hoặc 403 FORBIDDEN
            detail="Tài khoản của bạn hiện không hoạt động trong hệ thống Finext. Vui lòng liên hệ hỗ trợ.",
        )

    # Tạo token và session Finext (tương tự logic login truyền thống)
    user_id_str = str(finext_user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
        logger.info(f"Đã xóa session cũ nhất cho user {finext_user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions (Google login).")

    token_data_payload = {"sub": finext_user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
        refresh_payload = jwt.decode(refresh_token_str, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore

        access_jti = access_payload.get("jti")
        refresh_jti = refresh_payload.get("jti")

        if not access_jti or not refresh_jti:
            logger.error("JTI không tìm thấy trong tokens khi login Google.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi tạo định danh session (JTI).")
    except JWTError as e:
        logger.error(f"Lỗi giải mã tokens để lấy JTI khi login Google: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi xử lý token.")

    user_agent = request.headers.get("user-agent", "Unknown (Google Login)")
    # client_host = request.client.host if request.client else "Unknown (Google Login)"
    device_info = user_agent  # Chỉ lưu User-Agent, không bao gồm IP
    await create_session(db, SessionCreate(user_id=user_id_str, access_jti=access_jti, refresh_jti=refresh_jti, device_info=device_info))

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
    logger.info(f"Đăng nhập bằng Google thành công cho user: {finext_user.email} (Finext ID: {user_id_str})")
    return actual_response
