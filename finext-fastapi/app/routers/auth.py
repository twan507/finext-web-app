# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated, Tuple, Any, Optional, List, Dict
from datetime import datetime, timezone, timedelta

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
from app.crud.users import get_user_by_email_db, get_user_by_id_db, create_user_db, update_user_password
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
from app.schemas.auth import JWTTokenResponse, TokenData, ResetPasswordWithOtpRequest, ChangePasswordRequest
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
)
from app.utils.otp_utils import generate_otp_code

# Bỏ import crud_create_otp_record ở dòng này vì đã import ở trên cùng với crud_verify_otp
from app.utils.email_utils import send_otp_email


logger = logging.getLogger(__name__)
router = APIRouter()

logger = logging.getLogger(__name__)
router = APIRouter()

if SECRET_KEY is None:  # Giữ lại kiểm tra này
    raise ValueError("SECRET_KEY không được thiết lập.")

CookieList = Optional[List[Dict[str, Any]]]
LogoutResponse = Tuple[None, CookieList, Optional[List[str]]]
# LoginResponse và RefreshResponse không cần định nghĩa dạng Tuple ở đây nữa
# vì các hàm login/refresh sẽ trả về JSONResponse trực tiếp.


@router.post(
    "/register",
    response_model=StandardApiResponse[MessageResponse],  # Chỉ trả về thông báo
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký người dùng mới và gửi OTP xác thực email",
    tags=["authentication"],  # Thêm tag để gom nhóm API
)
@api_response_wrapper(default_success_message="Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.")
async def register_user(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        # Tạo user với is_active=False
        # crud_users.create_user_db đã được cập nhật để xử lý is_active dựa trên tham số
        created_user = await create_user_db(db, user_create_data=user_data, set_active_on_create=False)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ email tồn tại và active)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    if not created_user:
        # Lỗi không mong muốn khác từ create_user_db
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo người dùng. Vui lòng thử lại sau.",
        )

    # Gửi OTP xác thực email
    raw_otp = generate_otp_code()
    now = datetime.now(timezone.utc)

    # Tạo payload cho việc lưu OTP vào DB
    internal_otp_payload = OtpCreateInternal(
        user_id=str(created_user.id),  # created_user là UserInDB nên có id
        otp_type=OtpTypeEnum.EMAIL_VERIFICATION,
        otp_code=raw_otp,  # Mã OTP thuần
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES),  # Sẽ được ghi đè trong crud_create_otp_record
        created_at=now,
    )
    # Lưu OTP đã hash vào DB
    otp_record = await crud_create_otp_record(db, internal_otp_payload)
    if not otp_record:
        # Nếu không tạo được OTP record, đây là lỗi nghiêm trọng.
        # Có thể cân nhắc xóa user vừa tạo hoặc đánh dấu để xử lý sau.
        logger.error(f"Không thể tạo OTP record cho user {created_user.email} sau khi đăng ký.")
        # Không raise HTTP Exception ở đây để không lộ thông tin user đã được tạo.
        # User sẽ không nhận được OTP và không thể kích hoạt.
        # Tuy nhiên, để đảm bảo, ta nên raise lỗi để client biết.
        await db.users.delete_one({"_id": ObjectId(created_user.id)})  # Xóa user nếu không gửi được OTP
        logger.info(f"Đã xóa user {created_user.email} do không thể tạo OTP record.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi khi tạo mã xác thực. Vui lòng thử đăng ký lại.")

    # Gửi email OTP trong background
    background_tasks.add_task(
        send_otp_email,  # Hàm này đã được import từ routers.otps
        email_to=created_user.email,
        full_name=created_user.full_name,
        otp_code=raw_otp,  # Gửi mã OTP thuần cho user
        otp_type=OtpTypeEnum.EMAIL_VERIFICATION,
        expiry_minutes=OTP_EXPIRE_MINUTES,
    )

    # Wrapper sẽ trả về default_success_message, không cần trả về UserPublic ở đây
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
    # Wrapper sẽ xử lý việc xóa cookie từ [REFRESH_TOKEN_COOKIE_NAME]
    return None, None, [REFRESH_TOKEN_COOKIE_NAME]


@router.post("/refresh-token", response_model=JWTTokenResponse)  # Swagger hiển thị JWTTokenResponse thuần túy
async def refresh_access_token(
    request: Request,
    refresh_token_str: str = Depends(get_refresh_token_from_cookie),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:  # Trả về JSONResponse để set cookie
    try:
        payload = decode_refresh_token(refresh_token_str)
        user_id: str = payload["user_id"]
    except Exception as e:
        logger.error(f"Lỗi khi xử lý refresh token: {e}", exc_info=True)
        # custom_http_exception_handler sẽ bắt và trả về StandardApiResponse lỗi cho Next.js
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
        new_access_payload = jwt.decode(new_access_token, SECRET_KEY, algorithms=[ALGORITHM])
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

    await create_session(db, SessionCreate(user_id=user_id, jti=new_jti, device_info=device_info))

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


@router.post("/login", response_model=JWTTokenResponse)  # Swagger hiển thị JWTTokenResponse thuần túy
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse:  # Trả về JSONResponse để set cookie
    user = await get_user_by_email_db(db, email=form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        # custom_http_exception_handler sẽ bắt và trả về StandardApiResponse lỗi cho Next.js
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
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM])
        jti = access_payload.get("jti")
        if not jti:
            logger.error("JTI not found in new access token during login.")
            # Lỗi server
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error creating session identifier (JTI).")
    except JWTError as e:
        logger.error(f"Error decoding access token to get JTI: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing token.")

    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"

    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info))

    # Chuẩn bị nội dung là JWTTokenResponse thuần túy
    response_content_data = JWTTokenResponse(access_token=access_token_str)

    # Tạo JSONResponse với nội dung thuần túy này
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


@router.post(
    "/login-otp",
    response_model=JWTTokenResponse,  # Trả về access token trong body, refresh token trong cookie
    summary="Đăng nhập bằng email và OTP (Passwordless)",
    tags=["authentication"],
)
async def login_with_otp(
    request: Request,  # Để lấy user-agent, client_host cho session
    otp_login_data: OtpVerificationRequest,  # Sử dụng lại schema này
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Quan trọng: Xác định otp_type cho passwordless login
    # Hiện tại chúng ta dùng PWDLESS_LOGIN, nếu bạn tạo PASSWORDLESS_LOGIN thì dùng type đó
    if otp_login_data.otp_type != OtpTypeEnum.PWDLESS_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loại OTP không hợp lệ cho chức năng đăng nhập không mật khẩu. Cần: {OtpTypeEnum.PWDLESS_LOGIN.value}",
        )

    user = await get_user_by_email_db(db, email=otp_login_data.email)
    if not user:
        # Thông báo chung để tránh dò email, hoặc nếu OTP sai, user cũng không nên biết email có tồn tại không
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,  # Unauthorized vì thông tin đăng nhập sai
            detail="Email hoặc mã OTP không chính xác.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,  # Bad request vì user không đủ điều kiện đăng nhập
            detail="Tài khoản người dùng chưa được kích hoạt hoặc đã bị khóa.",
        )

    # Xác thực OTP
    is_otp_valid = await crud_verify_otp(
        db,
        user_id=str(user.id),
        otp_type=otp_login_data.otp_type,  # Sử dụng type từ request (PWDLESS_LOGIN)
        plain_otp_code=otp_login_data.otp_code,
    )

    if not is_otp_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mã OTP không chính xác.",  # Thông báo chung
        )

    # ---- Logic tạo token và session (tương tự như /login truyền thống) ----
    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        await find_and_delete_oldest_session(db, user_id_str)
        logger.info(f"Đã xóa session cũ nhất cho user {user.email} do đạt giới hạn {MAX_SESSIONS_PER_USER} sessions.")

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token_str = create_access_token(data=token_data_payload)
    refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

    try:
        access_payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=[ALGORITHM])
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

    # Tạo session mới
    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info))

    # Chuẩn bị nội dung là JWTTokenResponse thuần túy
    response_content_data = JWTTokenResponse(access_token=access_token_str)

    # Tạo JSONResponse với nội dung thuần túy này để có thể set cookie
    actual_response = JSONResponse(content=response_content_data.model_dump())

    # Set HttpOnly refresh token cookie
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

    # FastAPI sẽ tự động bọc response này bằng StandardApiResponse nếu bạn không dùng decorator @api_response_wrapper
    # Tuy nhiên, vì chúng ta cần set cookie, chúng ta trả về JSONResponse trực tiếp.
    # Để nhất quán, bạn có thể muốn /login truyền thống cũng trả về JSONResponse trực tiếp thay vì dựa vào wrapper để set cookie.
    # Hoặc, @api_response_wrapper cần được điều chỉnh để xử lý việc set cookie nếu hàm được decorate trả về một tuple chứa cookie.
    # Trong trường hợp này, vì Swagger cần thấy JWTTokenResponse thuần túy, nên trả JSONResponse trực tiếp là phù hợp.
    return actual_response
    # Yêu cầu OTP: Gọi POST /api/v1/otps/request với email của user đã active và otp_type: "pwdless_login". Kiểm tra email để nhận OTP.
    # Đăng nhập OTP: Gọi POST /api/v1/auth/login-otp với email, OTP vừa nhận, và otp_type: "pwdless_login".


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
        # Thông báo chung để tránh dò email.
        # Ngay cả khi OTP có thể đúng cho email này (nếu OTP không gắn chặt với user ID mà chỉ với email và type),
        # việc không tìm thấy user ở bước này là đủ để từ chối.
        logger.warning(f"Yêu cầu đặt lại mật khẩu cho email không tồn tại: {reset_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,  # Hoặc 404 nhưng 400 chung chung hơn
            detail="Thông tin không hợp lệ hoặc yêu cầu không thể được xử lý.",
        )

    if not user.is_active:
        # Nếu user không active, không cho phép reset password qua luồng này
        # Trừ khi bạn có logic đặc biệt cho phép kích hoạt lại qua quên mật khẩu.
        logger.warning(f"Yêu cầu đặt lại mật khẩu cho tài khoản không hoạt động: {reset_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản này không hoạt động. Vui lòng liên hệ hỗ trợ.",
        )

    # Xác thực OTP loại RESET_PASSWORD
    is_otp_valid = await crud_verify_otp(
        db,
        user_id=str(user.id),  # OTP phải thuộc về user này
        otp_type=OtpTypeEnum.RESET_PASSWORD,
        plain_otp_code=reset_data.otp_code,
    )

    if not is_otp_valid:
        logger.warning(f"Mã OTP không hợp lệ hoặc đã hết hạn cho yêu cầu đặt lại mật khẩu của {reset_data.email}.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã OTP không hợp lệ hoặc đã hết hạn.",
        )

    # Cập nhật mật khẩu mới cho user
    password_updated = await update_user_password(db, user_id=str(user.id), new_password=reset_data.new_password)

    if not password_updated:
        # Điều này không nên xảy ra nếu OTP hợp lệ và user tồn tại
        logger.error(f"Không thể cập nhật mật khẩu cho user {user.email} (quên mật khẩu) dù OTP hợp lệ.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đặt lại mật khẩu. Vui lòng thử lại sau.",
        )

    # (Tùy chọn nâng cao) Hủy tất cả các session đang hoạt động của user này
    # from app.crud.sessions import delete_sessions_for_user_except_current
    # await delete_sessions_for_user_except_current(db, str(user.id), None) # Xóa tất cả
    # logger.info(f"Đã đăng xuất tất cả các session của user {user.email} sau khi đặt lại mật khẩu.")

    return MessageResponse(message="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.")


@router.post(
    "/me/change-password",
    response_model=StandardApiResponse[MessageResponse],
    summary="Người dùng tự đổi mật khẩu khi đã đăng nhập",
    tags=["authentication", "users"],  # Gom nhóm vào cả users và authentication
)
@api_response_wrapper(default_success_message="Đổi mật khẩu thành công.")
async def user_change_own_password(
    change_password_data: ChangePasswordRequest,
    # Sử dụng verify_active_session để lấy payload có jti
    payload: TokenData = Depends(verify_active_session),
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Xác thực mật khẩu hiện tại
    if not verify_password(change_password_data.current_password, current_user.hashed_password):  #
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác.",
        )

    # Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
    if verify_password(change_password_data.new_password, current_user.hashed_password):  #
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu cũ.",
        )

    # Cập nhật mật khẩu mới
    password_updated = await update_user_password(  #
        db, user_id=str(current_user.id), new_password=change_password_data.new_password
    )

    if not password_updated:
        logger.error(f"Không thể cập nhật mật khẩu cho user {current_user.email} (tự đổi).")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi không xác định khi đổi mật khẩu. Vui lòng thử lại sau.",
        )

    # Hủy tất cả các session khác của user này (giữ lại session hiện tại)
    # current_jti được lấy từ payload của token hiện tại
    current_jti = payload.jti
    if current_jti:
        deleted_sessions_count = await delete_sessions_for_user_except_jti(db, str(current_user.id), current_jti)
        logger.info(f"Đã đăng xuất {deleted_sessions_count} session khác của user {current_user.email} sau khi đổi mật khẩu.")
    else:
        logger.warning(f"Không tìm thấy JTI trong token của user {current_user.email} khi đổi mật khẩu, không thể hủy các session khác.")

    return MessageResponse(message="Đổi mật khẩu thành công.")
