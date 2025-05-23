# finext-fastapi/app/routers/permissions.py
import logging
from typing import List, Set

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.permissions import PermissionPublic
from app.schemas.users import UserInDB # Cần để lấy thông tin user hiện tại
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import _get_user_permissions # Import hàm helper lấy permissions của user
# Không cần import crud_permissions.get_permissions nữa nếu không dùng đến việc lấy toàn bộ

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get(
    "/",
    response_model=StandardApiResponse[List[PermissionPublic]],
    summary="Lấy danh sách các quyền mà người dùng hiện tại đang sở hữu",
    description="Trả về danh sách các đối tượng permission chi tiết mà người dùng hiện tại có thông qua các vai trò được gán.",
    dependencies=[Depends(get_current_active_user)], # Chỉ cần người dùng đã đăng nhập
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách quyền sở hữu thành công.")
async def read_my_permissions(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Lấy tất cả tên permissions mà người dùng hiện tại đang có
    current_user_permission_names: Set[str] = await _get_user_permissions(db, str(current_user.id))

    permissions_to_return: List[PermissionPublic] = []

    if not current_user_permission_names:
        # User không có quyền nào, trả về danh sách rỗng
        logger.info(f"User {current_user.email} has no assigned permissions.")
        return [] 
    
    logger.info(f"User {current_user.email} is fetching their assigned permissions: {current_user_permission_names}")
    
    # Lấy thông tin chi tiết của các permissions mà user có từ collection 'permissions'
    owned_permissions_cursor = db.permissions.find(
        {"name": {"$in": list(current_user_permission_names)}}
    )
    
    async for perm_doc in owned_permissions_cursor:
        permissions_to_return.append(PermissionPublic(**perm_doc))
            
    return permissions_to_return