# app/routers/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm  # Dùng cho endpoint /token
from typing import Annotated

# Schemas
from app.schemas.auth import NextAuthUser  # Cho callback từ NextAuth
from app.schemas.token import (
    JWTTokenResponse,
    RefreshTokenRequest,
)  # Cho JWT response và payload
from app.schemas.users import UserInDB, UserPublic  # Để trả về thông tin user nếu cần

# Database and CRUD
from app.core.database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase

# Import các hàm CRUD helper từ users router
from app.crud.users import get_user_by_email_db, get_user_by_id_db

# Security and JWT
from app.utils.security import verify_password
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user

import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login/credentials", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
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
    user = await get_user_by_email_db(db, email=user_email_from_form)

    if not user:
        logger.warning(
            f"Login failed: User with email '{user_email_from_form}' not found."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",  # Thông báo chung chung để bảo mật
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Xác thực mật khẩu
    if not verify_password(form_data.password, user.hashed_password):
        logger.warning(
            f"Login failed: Incorrect password for user with email '{user_email_from_form}'."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",  # Thông báo chung chung
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Tạo JWT access token
    # 'sub' (subject) của token sẽ là email của người dùng.
    # 'user_id' cũng được thêm vào payload để dễ dàng truy xuất.
    token_data_payload = {"sub": user.email, "user_id": str(user.id)}
    access_token = create_access_token(data=token_data_payload)
    refresh_token = create_refresh_token(data=token_data_payload)

    logger.info(f"Login successful for user: {user.email} (ID: {user.id})")
    return JWTTokenResponse(
        token_type="bearer", access_token=access_token, refresh_token=refresh_token
    )


@router.post("/login/OAuth", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Đăng nhập thành công qua Authjs.",
    success_status_code=status.HTTP_200_OK,
)
async def login_via_nextauth_callback(
    user_data_from_nextauth: NextAuthUser,  # Schema cho dữ liệu từ NextAuth
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """
    Xử lý callback từ NextAuth sau khi người dùng được xác thực bởi NextAuth (ví dụ: qua Google).
    Endpoint này sẽ:
    1. Nhận thông tin người dùng từ NextAuth.
    2. Kiểm tra xem người dùng này (dựa trên email) đã tồn tại trong DB của FastAPI chưa.
    3. Nếu chưa, có thể tạo mới (tùy theo logic ứng dụng, hiện tại sẽ báo lỗi nếu chưa có).
    4. Nếu có, tạo và trả về một JWT của FastAPI cho người dùng đó.
    """
    logger.info(
        f"Received user data from NextAuth callback: {user_data_from_nextauth.model_dump_json(indent=2)}"
    )

    if (
        not user_data_from_nextauth.email
    ):  # NextAuth có thể không trả về userId nếu là provider như Google
        logger.warning("NextAuth callback received without an email.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required from NextAuth callback for processing.",
        )

    # Kiểm tra xem user đã tồn tại trong DB của FastAPI chưa, dựa trên email
    user_in_fastapi_db = await get_user_by_email_db(
        db, email=user_data_from_nextauth.email
    )

    if not user_in_fastapi_db:
        # Logic xử lý nếu user chưa tồn tại trong DB FastAPI:
        # - Có thể tự động tạo user mới nếu đây là luồng đăng ký/đăng nhập kết hợp.
        # - Hoặc yêu cầu người dùng đăng ký qua hệ thống FastAPI trước.
        # Hiện tại: Báo lỗi nếu user không tồn tại.
        logger.warning(
            f"User from NextAuth callback (email: {user_data_from_nextauth.email}) not found in FastAPI DB."
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {user_data_from_nextauth.email} not found in our system. Please register or ensure emails match.",
        )

    # User đã tồn tại trong DB FastAPI, tạo token cho họ
    token_data_payload = {
        "sub": user_in_fastapi_db.email,
        "user_id": str(user_in_fastapi_db.id),
    }
    access_token = create_access_token(data=token_data_payload)
    refresh_token = create_refresh_token(data=token_data_payload)

    logger.info(
        f"Generated FastAPI token for NextAuth user: {user_in_fastapi_db.email} (ID: {user_in_fastapi_db.id})"
    )
    return JWTTokenResponse(
        token_type="bearer", access_token=access_token, refresh_token=refresh_token
    )


@router.get("/me", response_model=StandardApiResponse[UserPublic])
@api_response_wrapper(
    default_success_message="Lấy thông tin người dùng thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
):
    """
    Endpoint để lấy thông tin của người dùng đang đăng nhập (đã được xác thực qua JWT).
    Sử dụng dependency `get_current_active_user` để đảm bảo token hợp lệ và user active.
    """
    logger.info(
        f"Fetching profile for user: {current_user.email} (ID: {current_user.id})"
    )
    # current_user đã là đối tượng UserInDB, cần chuyển sang UserPublic để response
    return UserPublic.model_validate(current_user)


@router.post("/refresh-token", response_model=StandardApiResponse[JWTTokenResponse])
@api_response_wrapper(
    default_success_message="Làm mới token thành công.",
    success_status_code=status.HTTP_200_OK,
)
async def refresh_access_token(
    token_request: RefreshTokenRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """
    Làm mới access token bằng cách sử dụng refresh token.
    Client gửi refresh token trong request body: {"refresh_token": "your_token_value"}
    """
    try:
        payload = decode_refresh_token(token_request.refresh_token)
        user_id: str = payload["user_id"]
        email: str = payload["sub"]

    except HTTPException as e:
        # Bắt các lỗi HTTPException được ném ra từ decode_refresh_token (ví dụ: token không hợp lệ, hết hạn).
        logger.warning(f"Xác thực refresh token thất bại: {e.detail}")
        raise e  # Ném lại lỗi để FastAPI xử lý và trả về response phù hợp.
    except ValueError as e:
        # Bắt các lỗi cấu hình, ví dụ như SECRET_KEY chưa được thiết lập trong decode_refresh_token.
        logger.error(f"Lỗi cấu hình trong quá trình làm mới token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
    except Exception as e:
        # Bắt các lỗi không mong muốn khác có thể xảy ra.
        logger.error(f"Lỗi không mong muốn khi xử lý refresh token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Lỗi xử lý refresh token.",
        )

    # Lấy thông tin người dùng từ database dựa trên user_id có trong refresh token.
    # Sử dụng hàm _get_user_by_id_db (được import từ app.routers.users theo yêu cầu ban đầu của bạn).
    # Lưu ý: Nếu bạn đã chuyển logic CRUD sang app.crud.user_crud.py,
    # thì nên sử dụng hàm get_user_by_id từ đó để tránh circular import và giữ cấu trúc rõ ràng.
    user = await get_user_by_id_db(db, user_id=user_id)

    # Kiểm tra xem người dùng có tồn tại không.
    # Ngay cả khi refresh token hợp lệ, người dùng có thể đã bị xóa khỏi hệ thống.
    if user is None:
        logger.warning(
            f"Người dùng với ID {user_id} từ refresh token không được tìm thấy trong DB."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,  # Lỗi không được phép vì user không còn hợp lệ
            detail="Người dùng không tồn tại cho refresh token này",
            # Header WWW-Authenticate có thể cung cấp thêm thông tin cho client về lỗi token.
            headers={
                "WWW-Authenticate": 'Bearer error="invalid_token", error_description="User not found"'
            },
        )
    # Tạo access token và refresh token mới
    new_token_data_payload = {"sub": user.email, "user_id": str(user.id)}
    new_access_token = create_access_token(data=new_token_data_payload)
    new_refresh_token = create_refresh_token(data=new_token_data_payload)

    logger.info(f"Tokens refreshed successfully for user: {user.email} (ID: {user.id})")
    return JWTTokenResponse(
        token_type="bearer",
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )
