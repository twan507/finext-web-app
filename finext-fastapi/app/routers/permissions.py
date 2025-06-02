# finext-fastapi/app/routers/permissions.py
import logging
from typing import List, Set # Thêm Optional

from fastapi import APIRouter, Depends, Query # Thêm Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.permissions import PermissionPublic, PermissionInDB # Thêm PermissionInDB
from app.schemas.users import UserInDB 
from app.schemas.common import PaginatedResponse # Import schema phân trang
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import _get_user_permissions, require_permission # Thêm require_permission
import app.crud.permissions as crud_permissions # Import crud_permissions

logger = logging.getLogger(__name__)
router = APIRouter() # Prefix và tags sẽ được thêm ở main.py

@router.get(
    "/",
    response_model=StandardApiResponse[List[PermissionPublic]],
    summary="Lấy danh sách các quyền mà người dùng hiện tại đang sở hữu",
    description="Trả về danh sách các đối tượng permission chi tiết mà người dùng hiện tại có thông qua các vai trò được gán.",
    dependencies=[Depends(get_current_active_user)], 
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách quyền sở hữu thành công.")
async def read_my_permissions(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    current_user_permission_names: Set[str] = await _get_user_permissions(db, str(current_user.id))
    permissions_to_return: List[PermissionPublic] = []

    if not current_user_permission_names:
        logger.info(f"User {current_user.email} has no assigned permissions.")
        return [] 
    
    logger.info(f"User {current_user.email} is fetching their assigned permissions: {current_user_permission_names}")
    
    owned_permissions_cursor = db.permissions.find(
        {"name": {"$in": list(current_user_permission_names)}}
    )
    
    async for perm_doc in owned_permissions_cursor:
        permissions_to_return.append(PermissionPublic(**perm_doc))
            
    return permissions_to_return

# <<<< PHẦN BỔ SUNG MỚI >>>>
@router.get(
    "/admin/definitions",
    response_model=StandardApiResponse[PaginatedResponse[PermissionInDB]],
    summary="[Admin] Lấy danh sách tất cả các permission được định nghĩa trong hệ thống",
    dependencies=[Depends(require_permission("permission", "list_all_definitions"))], # Cần permission này
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách định nghĩa permission thành công.")
async def admin_read_all_permission_definitions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=500, description="Số bản ghi tối đa mỗi trang (max 500)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # crud_permissions.get_permissions đã được cập nhật để trả về (docs, total_count)
    permission_docs, total = await crud_permissions.get_permissions(db, skip=skip, limit=limit)
    
    # Frontend admin page cần id, created_at, updated_at nên chúng ta dùng PermissionInDB
    items = [PermissionInDB.model_validate(p) for p in permission_docs]
    return PaginatedResponse[PermissionInDB](items=items, total=total)
# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>