# finext-fastapi/app/auth/dependencies.py
import logging

from app.auth.jwt_handler import verify_token_and_get_payload
from app.core.database import get_database
from app.crud.users import get_user_by_id_db
from app.crud.sessions import get_session_by_jti, update_last_active  # THÊM IMPORT
from app.schemas.auth import TokenData
from app.schemas.users import UserInDB
from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def verify_active_session(
    payload: TokenData = Depends(verify_token_and_get_payload),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> TokenData:
    """
    (MỚI) Dependency để xác thực token VÀ kiểm tra session có hoạt động không.
    """
    # Check if jti exists in payload
    if not payload.jti:
        logger.warning("Session check failed: No JTI found in token payload.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing session identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = await get_session_by_jti(db, payload.jti)
    if not session:
        logger.warning(
            f"Session check failed: JTI {payload.jti} not found in active sessions."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not found or invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Cập nhật thời gian hoạt động cuối cùng của session
    await update_last_active(db, payload.jti)

    # Trả về payload nếu session hợp lệ
    return payload


async def get_current_active_user(
    # THAY ĐỔI: Sử dụng dependency mới verify_active_session
    payload: TokenData = Depends(verify_active_session),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> UserInDB:
    """
    Dependency để lấy người dùng hiện tại, ĐÃ bao gồm kiểm tra session.
    """
    if payload.user_id is None:
        logger.warning(
            "Attempt to get current active user with no user_id in token payload."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID in token"
        )

    user = await get_user_by_id_db(db, user_id=payload.user_id)

    if user is None:
        logger.warning(f"User with ID {payload.user_id} from token not found in DB.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found from token"
        )
    if not user.is_active:
        logger.warning(f"User {user.email} (ID: {user.id}) is inactive.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return user
