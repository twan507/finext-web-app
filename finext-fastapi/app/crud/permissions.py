# finext-fastapi/app/crud/permissions.py
import logging
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase

# Sử dụng PermissionInDB để trả về dữ liệu từ DB
from app.schemas.permissions import PermissionInDB

logger = logging.getLogger(__name__)

async def get_permissions(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 1000) -> List[PermissionInDB]:
    """
    Lấy danh sách tất cả các permissions.
    Mặc định limit cao vì danh sách permission thường không quá lớn.
    """
    permissions_cursor = db.permissions.find().skip(skip).limit(limit)
    permissions = await permissions_cursor.to_list(length=limit)
    return [PermissionInDB(**perm) for perm in permissions]