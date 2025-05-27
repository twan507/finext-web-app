# finext-fastapi/app/routers/auth.py
import logging
from typing import Annotated, Tuple, Any, Optional, List, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import jwt, JWTError
from bson import ObjectId

from app.auth.dependencies import get_current_active_user
from app.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_refresh_token_from_cookie,
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
# THAY ĐỔI: Import crud.licenses và crud.subscriptions
import app.crud.licenses as crud_licenses
import app.crud.subscriptions as crud_subscriptions
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

CookieList = Optional[List[Dict[str, Any]]]
LogoutResponse = Tuple[None, CookieList, Optional[List[str]]]
LoginResponse = Tuple[JWTTokenResponse, CookieList, Optional[List[str]]]
RefreshResponse = Tuple[JWTTokenResponse, CookieList, Optional[List[str]]]

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
    description="Trả về một danh sách các 'key' của features dựa trên subscription hiện tại và còn hạn của người dùng."
)
@api_response_wrapper(default_success_message="Lấy danh sách features thành công.")
async def read_my_features(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """
    Lấy danh sách các feature_keys mà người dùng hiện tại sở hữu dựa trên subscription_id.
    """
    subscription_id = current_user.subscription_id

    if not subscription_id:
        logger.info(f"User {current_user.email} has no active subscription ID.")
        return []

    subscription = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)

    if not subscription:
        logger.warning(f"User {current_user.email}'s subscription ID ({subscription_id}) not found. Clearing from user doc.")
        # Tùy chọn: Tự động xóa subscription_id không hợp lệ khỏi user
        await db.users.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"subscription_id": None}})
        return []

    now = datetime.now(timezone.utc)
    
    # Handle timezone comparison safely
    expiry_date = subscription.expiry_date
    if expiry_date.tzinfo is None:
        # If expiry_date is timezone-naive, assume it's UTC
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    
    if not subscription.is_active or expiry_date < now:
        logger.info(f"User {current_user.email}'s subscription ({subscription_id}) is not active or has expired.")
        # Tùy chọn: Có thể tự động set is_active = False nếu hết hạn
        # Tùy chọn: Có thể set user.subscription_id = None
        return []

    # Lấy thông tin license từ DB dựa trên license_id của subscription
    license_data = await crud_licenses.get_license_by_id(db, license_id=subscription.license_id)

    if not license_data:
        logger.warning(f"User {current_user.email}'s license (ID: {subscription.license_id}) "
                       f"from subscription ({subscription_id}) not found in DB.")
        return []

    feature_keys = license_data.feature_keys
    logger.info(f"User {current_user.email} has access to features: {feature_keys} via sub {subscription_id}")
    return feature_keys

# END POINT GỐc ---------------------------------------------------------------------------------------------------------------------------------------------

# @router.post("/login", response_model=StandardApiResponse[JWTTokenResponse])
# @api_response_wrapper(
#     default_success_message="Đăng nhập thành công.",
#     success_status_code=status.HTTP_200_OK,
# )
# async def login_for_access_token(
#     request: Request,
#     form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
#     db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
# ) -> LoginResponse:
#     user = await get_user_by_email_db(db, email=form_data.username)

#     if not user or not verify_password(form_data.password, user.hashed_password):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Incorrect email or password",
#             headers={"WWW-Authenticate": "Bearer"},
#         )

#     user_id_str = str(user.id)
#     current_session_count = await count_sessions_by_user_id(db, user_id_str)
#     if current_session_count >= MAX_SESSIONS_PER_USER:
#         await find_and_delete_oldest_session(db, user_id_str)

#     token_data_payload = {"sub": user.email, "user_id": user_id_str}
#     access_token = create_access_token(data=token_data_payload)
#     refresh_token_str, refresh_expires_delta = create_refresh_token(data=token_data_payload)

#     access_payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
#     jti = access_payload.get("jti")
#     if not jti:
#         raise HTTPException(status_code=500, detail="Lỗi tạo session (JTI).")

#     user_agent = request.headers.get("user-agent", "Unknown")
#     client_host = request.client.host if request.client else "Unknown"
#     device_info = f"{user_agent} ({client_host})"

#     await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info))

#     cookie_params = {
#         "key": REFRESH_TOKEN_COOKIE_NAME,
#         "value": refresh_token_str,
#         "httponly": True,
#         "secure": COOKIE_SECURE,
#         "samesite": COOKIE_SAMESITE,
#         "domain": COOKIE_DOMAIN,
#         "max_age": int(refresh_expires_delta.total_seconds()),
#         "path": "/",
#     }

#     logger.info(f"Login successful for user: {user.email}")
#     return JWTTokenResponse(access_token=access_token), [cookie_params], None


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

    return None, None, [REFRESH_TOKEN_COOKIE_NAME]

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
        response = JWTTokenResponse(access_token="")
        return response, None, [REFRESH_TOKEN_COOKIE_NAME]

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

# END POINT TEST SWAGGER ---------------------------------------------------------------------------------------------------------------------------------------------

@router.post("/login", response_model=JWTTokenResponse) # response_model để Swagger UI hiểu cấu trúc body
async def login_for_access_token(
    request: Request, # Cần Request để lấy user_agent, client_host
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> JSONResponse: # Kiểu trả về thực tế là JSONResponse để set cookie
    user = await get_user_by_email_db(db, email=form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        # Khi không dùng wrapper, bạn cần tự raise HTTPException
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active: # Thêm kiểm tra user có active không
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # Hoặc 403 Forbidden
            detail="User is inactive",
        )

    user_id_str = str(user.id) # user.id là PyObjectId (str)
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
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error creating session identifier (JTI).")
    except JWTError as e:
        logger.error(f"Error decoding access token to get JTI: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error processing token.")


    user_agent = request.headers.get("user-agent", "Unknown")
    client_host = request.client.host if request.client else "Unknown"
    device_info = f"{user_agent} ({client_host})"

    # user_id_str (PyObjectId) cần được truyền vào SessionCreate
    await create_session(db, SessionCreate(user_id=user_id_str, jti=jti, device_info=device_info))

    # 1. Chuẩn bị nội dung cho JSON response body (phải khớp với JWTTokenResponse)
    response_content = {
        "access_token": access_token_str,
        "token_type": "bearer" # Schema JWTTokenResponse có default là "bearer"
    }

    # 2. Tạo một đối tượng JSONResponse với nội dung trên
    actual_response = JSONResponse(content=response_content)

    # 3. Set HttpOnly cookie cho refresh token trên đối tượng JSONResponse này
    cookie_params = {
        "key": REFRESH_TOKEN_COOKIE_NAME,
        "value": refresh_token_str,
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN, # Có thể là None nếu chưa cấu hình cho localhost
        "max_age": int(refresh_expires_delta.total_seconds()),
        "path": "/",
    }
    actual_response.set_cookie(**cookie_params)

    logger.info(f"Login successful for user: {user.email}")
    
    # 4. Trả về đối tượng JSONResponse
    return actual_response