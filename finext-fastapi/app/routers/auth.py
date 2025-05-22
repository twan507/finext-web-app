# app/routers/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm # Dùng cho endpoint /token
from typing import Annotated

# Schemas
from app.schemas.auth import NextAuthUser # Cho callback từ NextAuth
from app.schemas.token import JWTTokenResponse, TokenData # Cho JWT response và payload
from app.schemas.users import UserInDB, UserPublic # Để trả về thông tin user nếu cần

# Database and CRUD
from app.core.database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
# Import các hàm CRUD helper từ users router
# Giả định rằng các hàm này đã được định nghĩa trong app.routers.users và có thể được import
from app.routers.users import _get_user_by_email_db, _get_user_by_id_db

# Security and JWT
from app.utils.security import verify_password
from app.auth.jwt_handler import create_access_token, verify_token_and_get_payload
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper

import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Dependency để lấy user hiện tại từ token, kiểm tra trong DB và trạng thái active
async def get_current_active_user(
    payload: TokenData = Depends(verify_token_and_get_payload),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db"))
) -> UserInDB:
    """
    Dependency để lấy thông tin người dùng hiện tại đang hoạt động từ payload token.
    Hàm này sẽ:
    1. Xác thực token JWT (thông qua verify_token_and_get_payload).
    2. Lấy user_id từ payload của token.
    3. Truy vấn cơ sở dữ liệu để lấy thông tin đầy đủ của người dùng.
    4. Kiểm tra xem người dùng có tồn tại và có cờ is_active là True không.

    Args:
        payload: Dữ liệu payload từ token đã được xác thực.
        db: Instance của AsyncIOMotorDatabase.

    Returns:
        Đối tượng UserInDB nếu người dùng hợp lệ và active.

    Raises:
        HTTPException: Nếu user_id không hợp lệ, người dùng không tìm thấy, hoặc người dùng không active.
    """
    if payload.user_id is None:
        logger.warning("Attempt to get current active user with no user_id in token payload.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid user ID in token"
        )
    
    # _get_user_by_id_db mong muốn user_id là string (PyObjectId)
    user = await _get_user_by_id_db(db, user_id=payload.user_id) 
    
    if user is None:
        logger.warning(f"User with ID {payload.user_id} from token not found in DB.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User not found from token"
        )
    if not user.is_active:
        logger.warning(f"User {user.email} (ID: {user.id}) is inactive.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    return user


@router.post("/token", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db"))
):
    """
    Endpoint đăng nhập cho người dùng.
    Sử dụng OAuth2PasswordRequestForm, client cần gửi dữ liệu dạng x-www-form-urlencoded
    với các trường 'username' và 'password'.
    Trong ứng dụng này, trường 'username' từ form sẽ được coi là 'email' của người dùng.
    """
    # form_data.username sẽ chứa email mà người dùng nhập vào form đăng nhập.
    user_email_from_form = form_data.username
    logger.info(f"Attempting login for user with email: {user_email_from_form}")
    
    # Sử dụng hàm helper từ users.py để lấy user bằng email
    user = await _get_user_by_email_db(db, email=user_email_from_form)
    
    if not user:
        logger.warning(f"Login failed: User with email '{user_email_from_form}' not found.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password", # Thông báo chung chung để bảo mật
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Xác thực mật khẩu
    if not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login failed: Incorrect password for user with email '{user_email_from_form}'.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password", # Thông báo chung chung
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Tạo JWT access token
    # 'sub' (subject) của token sẽ là email của người dùng.
    # 'user_id' cũng được thêm vào payload để dễ dàng truy xuất.
    token_data_payload = {"sub": user.email, "user_id": str(user.id)} 
    access_token = create_access_token(data=token_data_payload)
    
    logger.info(f"Login successful for user: {user.email} (ID: {user.id})")
    return JWTTokenResponse(access_token=access_token, token_type="bearer")


@router.post("/login/nextauth-callback", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công qua Authjs.",
    success_status_code=status.HTTP_200_OK,
)
async def login_via_nextauth_callback(
    user_data_from_nextauth: NextAuthUser, # Schema cho dữ liệu từ NextAuth
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db"))
):
    """
    Xử lý callback từ NextAuth sau khi người dùng được xác thực bởi NextAuth (ví dụ: qua Google).
    Endpoint này sẽ:
    1. Nhận thông tin người dùng từ NextAuth.
    2. Kiểm tra xem người dùng này (dựa trên email) đã tồn tại trong DB của FastAPI chưa.
    3. Nếu chưa, có thể tạo mới (tùy theo logic ứng dụng, hiện tại sẽ báo lỗi nếu chưa có).
    4. Nếu có, tạo và trả về một JWT của FastAPI cho người dùng đó.
    """
    logger.info(f"Received user data from NextAuth callback: {user_data_from_nextauth.model_dump_json(indent=2)}")

    if not user_data_from_nextauth.email: # NextAuth có thể không trả về userId nếu là provider như Google
         logger.warning("NextAuth callback received without an email.")
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required from NextAuth callback for processing."
        )

    # Kiểm tra xem user đã tồn tại trong DB của FastAPI chưa, dựa trên email
    user_in_fastapi_db = await _get_user_by_email_db(db, email=user_data_from_nextauth.email)

    if not user_in_fastapi_db:
        # Logic xử lý nếu user chưa tồn tại trong DB FastAPI:
        # - Có thể tự động tạo user mới nếu đây là luồng đăng ký/đăng nhập kết hợp.
        # - Hoặc yêu cầu người dùng đăng ký qua hệ thống FastAPI trước.
        # Hiện tại: Báo lỗi nếu user không tồn tại.
        logger.warning(f"User from NextAuth callback (email: {user_data_from_nextauth.email}) not found in FastAPI DB.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {user_data_from_nextauth.email} not found in our system. Please register or ensure emails match."
        )

    # User đã tồn tại trong DB FastAPI, tạo token cho họ
    token_data_payload = {"sub": user_in_fastapi_db.email, "user_id": str(user_in_fastapi_db.id)}
    access_token = create_access_token(data=token_data_payload)
    
    logger.info(f"Generated FastAPI token for NextAuth user: {user_in_fastapi_db.email} (ID: {user_in_fastapi_db.id})")
    return JWTTokenResponse(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(
    default_success_message="Lấy thông tin người dùng thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)]
):
    """
    Endpoint để lấy thông tin của người dùng đang đăng nhập (đã được xác thực qua JWT).
    Sử dụng dependency `get_current_active_user` để đảm bảo token hợp lệ và user active.
    """
    logger.info(f"Fetching profile for user: {current_user.email} (ID: {current_user.id})")
    # current_user đã là đối tượng UserInDB, cần chuyển sang UserPublic để response
    return UserPublic.model_validate(current_user)

