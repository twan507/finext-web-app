# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request # THÊM Request
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth.dependencies import get_current_active_user
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_token_and_get_payload, # THÊM verify_token_and_get_payload
)
from app.core.database import get_database
from app.crud.users import get_user_by_email_db, get_user_by_id_db
from app.crud.sessions import ( # THÊM IMPORT CRUD SESSIONS
    count_sessions_by_user_id,
    find_and_delete_oldest_session,
    create_session,
    delete_session_by_jti
)
from app.schemas.sessions import SessionCreate # THÊM SessionCreate
from app.schemas.auth import (
    JWTTokenResponse,
    RefreshTokenRequest,
    TokenData, # THÊM TokenData
)
from app.schemas.users import UserPublic, UserInDB
from app.utils.response_wrapper import api_response_wrapper, StandardApiResponse
from app.utils.security import verify_password
from app.core.config import SECRET_KEY, ALGORITHM, MAX_SESSIONS_PER_USER
from jose import jwt


logger = logging.getLogger(__name__)
router = APIRouter()

if SECRET_KEY is None:
            raise ValueError("SECRET_KEY không được thiết lập. Vui lòng kiểm tra cấu hình.")

@router.post("/login", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def login_for_access_token(
    request: Request, # THÊM Request vào đây
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user_email_from_form = form_data.username
    logger.info(f"Attempting login for user with email: {user_email_from_form}")

    user = await get_user_by_email_db(db, email=user_email_from_form)

    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login failed: Incorrect email or password for '{user_email_from_form}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- LOGIC QUẢN LÝ SESSION ---
    user_id_str = str(user.id)
    current_session_count = await count_sessions_by_user_id(db, user_id_str)

    if current_session_count >= MAX_SESSIONS_PER_USER:
        logger.info(f"User {user.email} reached session limit ({MAX_SESSIONS_PER_USER}). Kicking oldest session.")
        await find_and_delete_oldest_session(db, user_id_str)
    # -----------------------------

    token_data_payload = {"sub": user.email, "user_id": user_id_str}
    access_token = create_access_token(data=token_data_payload) # Giả sử hàm này tự tạo JTI
    refresh_token = create_refresh_token(data=token_data_payload) # Refresh token cũng nên có JTI riêng

    # Trích xuất JTI từ access_token vừa tạo
    try:
        access_payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = access_payload.get("jti")
        if not jti:
             raise Exception("JTI not found in new access token")
    except Exception as e:
        logger.error(f"Lỗi khi giải mã token mới để lấy JTI: {e}")
        raise HTTPException(status_code=500, detail="Lỗi tạo session.")

    # Lấy thông tin thiết bị (ví dụ User-Agent)
    user_agent = request.headers.get("user-agent", "Unknown")
    # IP address (cẩn thận với proxy)
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"

    # Lưu session mới vào DB
    new_session_data = SessionCreate(
        user_id=user_id_str, # Phải là string
        jti=jti,
        device_info=device_info
    )
    await create_session(db, new_session_data)
    
    logger.info(f"Login successful for user: {user.email} (ID: {user_id_str}), JTI: {jti}")
    return JWTTokenResponse(
        token_type="bearer", access_token=access_token, refresh_token=refresh_token
    )

@router.post("/logout", response_model=StandardApiResponse[None])
@api_response_wrapper(default_success_message="Đăng xuất thành công.")
async def logout(
    payload: TokenData = Depends(verify_token_and_get_payload), # Chỉ cần token hợp lệ, chưa cần check session
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """
    Endpoint đăng xuất.
    Xóa session khỏi DB. Token sẽ tự động không hợp lệ ở lần gọi tiếp theo
    do không còn session trong DB.
    """
    jti_to_delete = payload.jti
    if not jti_to_delete:
         raise HTTPException(status_code=400, detail="Token không hợp lệ cho việc đăng xuất.")

    deleted = await delete_session_by_jti(db, jti_to_delete)
    
    if deleted:
        logger.info(f"User {payload.email} logged out successfully (JTI: {jti_to_delete}).")
    else:
        logger.warning(f"Logout attempt for JTI {jti_to_delete}, but session was not found (already logged out?).")

    return None # Wrapper sẽ xử lý response thành công


# Giữ nguyên /me và /refresh-token (đảm bảo /me dùng get_current_active_user đã cập nhật)
@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(
    default_success_message="Lấy thông tin người dùng thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
):
    logger.info(
        f"Fetching profile for user: {current_user.email} (ID: {current_user.id})"
    )
    return UserPublic.model_validate(current_user)

@router.post("/refresh-token", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Làm mới token thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def refresh_access_token(
    request: Request, # THÊM Request
    token_request: RefreshTokenRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        payload = decode_refresh_token(token_request.refresh_token)
        user_id: str = payload["user_id"]
        # refresh_jti: str = payload.get("jti") # Lấy JTI của refresh token

        # *** QUAN TRỌNG: Logic refresh token cần được xem xét lại ***
        # 1. Refresh token có nên được quản lý như session không? (Thường là không)
        # 2. Khi refresh, có nên tạo session MỚI và vô hiệu hóa session cũ không?
        #    -> Cách hiện tại: Tạo access token mới, refresh token mới, và CẦN tạo session MỚI, xóa session CŨ.

    except Exception as e:
        logger.error(f"Lỗi khi xử lý refresh token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token không hợp lệ hoặc đã hết hạn.",
             headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id_db(db, user_id=user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại cho refresh token này",
        )

    # *** TẠO SESSION MỚI KHI REFRESH ***
    # 1. Xóa session cũ (nếu có và nếu bạn muốn refresh sẽ vô hiệu hóa session cũ)
    #    Bạn cần JTI của *access token* cũ để xóa session cũ. Điều này khó!
    #    -> Cách tiếp cận thực tế hơn: Khi refresh, bạn tạo token MỚI và session MỚI.
    #       Client phải dùng token mới. Token cũ sẽ hết hạn hoặc bị "đá" nếu user đăng nhập
    #       quá 2 lần. Hoặc, bạn có thể *không* xóa session cũ khi refresh, cho phép nó
    #       tự hết hạn hoặc bị đá. Để đơn giản, ta sẽ tạo token/session mới mà không xóa cũ.
    #       Nhưng điều này có thể dẫn đến > 2 session nếu refresh nhiều.
    #    -> GIẢI PHÁP TỐT HƠN: Khi refresh, ta cũng kiểm tra và đá session cũ nếu cần.
    
    current_session_count = await count_sessions_by_user_id(db, user_id)
    if current_session_count >= MAX_SESSIONS_PER_USER:
        logger.info(f"User {user.email} reached session limit during refresh. Kicking oldest session.")
        await find_and_delete_oldest_session(db, user_id)

    # Tạo access token và refresh token mới
    new_token_data_payload = {"sub": user.email, "user_id": str(user.id)}
    new_access_token = create_access_token(data=new_token_data_payload)
    new_refresh_token = create_refresh_token(data=new_token_data_payload)

    # Trích xuất JTI mới
    try:
        new_access_payload = jwt.decode(new_access_token, SECRET_KEY, algorithms=[ALGORITHM])
        new_jti = new_access_payload.get("jti")
        if not new_jti:
             raise Exception("JTI not found in new access token after refresh")
    except Exception as e:
        logger.error(f"Lỗi khi giải mã token mới (refresh) để lấy JTI: {e}")
        raise HTTPException(status_code=500, detail="Lỗi tạo session khi refresh.")

    # Lấy thông tin thiết bị
    user_agent = request.headers.get("user-agent", "Unknown (Refresh)")
    client_host = request.client.host if request.client else "Unknown (Refresh)"
    device_info = f"{user_agent} ({client_host})"

    # Tạo session mới
    await create_session(db, SessionCreate(user_id=user_id, jti=new_jti, device_info=device_info))

    logger.info(f"Tokens refreshed successfully for user: {user.email} (ID: {user.id}), New JTI: {new_jti}")
    return JWTTokenResponse(
        token_type="bearer",
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )