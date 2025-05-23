import logging

from app.auth.jwt_handler import verify_token_and_get_payload
from app.core.database import get_database
from app.crud.users import get_user_by_id_db
from app.schemas.auth import TokenData
from app.schemas.users import UserInDB
from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def get_current_active_user(
    payload: TokenData = Depends(verify_token_and_get_payload),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> UserInDB:
    """
    Dependency để lấy thông tin người dùng hiện tại đang hoạt động từ payload token.
    Hàm này sẽ:
    1. Xác thực token JWT (thông qua verify_token_and_get_payload).
    2. Lấy user_id từ payload của token.
    3. Truy vấn cơ sở dữ liệu để lấy thông tin đầy đủ của người dùng.
    4. Kiểm tra xem người dùng có tồn tại và có cờ is_active là True không.
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
    if not user.is_active:  # Giả sử UserInDB có trường is_active
        logger.warning(f"User {user.email} (ID: {user.id}) is inactive.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    return user
