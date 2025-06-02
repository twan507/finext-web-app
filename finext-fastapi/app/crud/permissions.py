# finext-fastapi/app/crud/permissions.py
import logging
from typing import List, Tuple # Thêm Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.permissions import PermissionInDB # Sử dụng PermissionInDB

logger = logging.getLogger(__name__)
PERMISSIONS_COLLECTION = "permissions" # Định nghĩa tên collection

# <<<< PHẦN CẬP NHẬT >>>>
async def get_permissions(
    db: AsyncIOMotorDatabase, 
    skip: int = 0, 
    limit: int = 1000 # Mặc định limit cao vì danh sách permission thường không quá lớn
) -> Tuple[List[PermissionInDB], int]: # Trả về Tuple
    """
    Lấy danh sách tất cả các permissions với phân trang và trả về total count.
    """
    query = {} # Có thể thêm filter nếu cần trong tương lai

    total_count = await db[PERMISSIONS_COLLECTION].count_documents(query)
    permissions_cursor = db[PERMISSIONS_COLLECTION].find(query).sort("name", 1).skip(skip).limit(limit)
    permissions_docs = await permissions_cursor.to_list(length=limit)
    
    results = [PermissionInDB(**perm) for perm in permissions_docs]
    return results, total_count
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>