# finext-fastapi/app/routers/permissions.py
import logging
from typing import List, Set
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.permissions import PermissionPublic, PermissionInDB, PermissionCreate, PermissionUpdate
from app.schemas.users import UserInDB
from app.schemas.common import PaginatedResponse
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import _get_user_permissions, require_permission
import app.crud.permissions as crud_permissions

logger = logging.getLogger(__name__)
router = APIRouter()


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

    owned_permissions_cursor = db.permissions.find({"name": {"$in": list(current_user_permission_names)}})

    async for perm_doc in owned_permissions_cursor:
        permissions_to_return.append(PermissionPublic(**perm_doc))

    return permissions_to_return


# <<<< PHẦN BỔ SUNG MỚI >>>>
@router.get(
    "/admin/definitions",
    response_model=StandardApiResponse[PaginatedResponse[PermissionInDB]],
    summary="[Admin] Lấy danh sách tất cả các permission được định nghĩa trong hệ thống",
    dependencies=[Depends(require_permission("permission", "list_all_definitions"))],  # Cần permission này
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách định nghĩa permission thành công.")
async def admin_read_all_permission_definitions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số bản ghi tối đa mỗi trang (99999 cho 'All')"),
    sort_by: str = Query("name", description="Trường để sắp xếp (name, description, created_at, updated_at)"),
    sort_order: str = Query("asc", regex="^(asc|desc)$", description="Thứ tự sắp xếp (asc hoặc desc)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # crud_permissions.get_permissions đã được cập nhật để trả về (docs, total_count)
    permission_docs, total = await crud_permissions.get_permissions(db, skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order)

    # Frontend admin page cần id, created_at, updated_at nên chúng ta dùng PermissionInDB
    items = [PermissionInDB.model_validate(p) for p in permission_docs]
    return PaginatedResponse[PermissionInDB](items=items, total=total)


# CRUD Routes for Admin
@router.post(
    "/",
    response_model=StandardApiResponse[PermissionPublic],
    summary="[Admin] Tạo permission mới",
    dependencies=[Depends(require_permission("permission", "create"))],
    tags=["permissions"],
    status_code=201,
)
@api_response_wrapper(default_success_message="Tạo permission thành công.")
async def create_permission(
    permission: PermissionCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Tạo permission mới trong hệ thống"""
    try:
        new_permission = await crud_permissions.create_permission(db, permission)
        return PermissionPublic(**new_permission.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating permission: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{permission_id}",
    response_model=StandardApiResponse[PermissionPublic],
    summary="[Admin] Lấy chi tiết permission theo ID",
    dependencies=[Depends(require_permission("permission", "read_any"))],
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin permission thành công.")
async def get_permission_by_id(
    permission_id: str = Path(..., description="ID của permission"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Lấy thông tin chi tiết permission theo ID"""
    permission = await crud_permissions.get_permission_by_id(db, permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")

    return PermissionPublic(**permission.model_dump())


@router.put(
    "/{permission_id}",
    response_model=StandardApiResponse[PermissionPublic],
    summary="[Admin] Cập nhật permission",
    dependencies=[Depends(require_permission("permission", "update_any"))],
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Cập nhật permission thành công.")
async def update_permission(
    permission_update: PermissionUpdate,
    permission_id: str = Path(..., description="ID của permission"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Cập nhật thông tin permission"""
    try:
        updated_permission = await crud_permissions.update_permission(db, permission_id, permission_update)
        if not updated_permission:
            raise HTTPException(status_code=404, detail="Permission not found")

        return PermissionPublic(**updated_permission.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating permission {permission_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete(
    "/{permission_id}",
    response_model=StandardApiResponse[dict],
    summary="[Admin] Xóa permission",
    dependencies=[Depends(require_permission("permission", "delete_any"))],
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Xóa permission thành công.")
async def delete_permission(
    permission_id: str = Path(..., description="ID của permission"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Xóa permission khỏi hệ thống"""
    success = await crud_permissions.delete_permission(db, permission_id)
    if not success:
        raise HTTPException(status_code=404, detail="Permission not found")

    return {"message": "Permission deleted successfully"}


# Additional utility routes
@router.get(
    "/categories/{category}",
    response_model=StandardApiResponse[List[PermissionPublic]],
    summary="[Admin] Lấy danh sách permission theo category",
    dependencies=[Depends(require_permission("permission", "list_all_definitions"))],
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách permission theo category thành công.")
async def get_permissions_by_category(
    category: str = Path(..., description="Tên category"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Lấy danh sách permissions thuộc một category cụ thể"""
    permissions_cursor = db.permissions.find({"category": category})
    permissions = []

    async for perm_doc in permissions_cursor:
        permissions.append(PermissionPublic(**perm_doc))

    return permissions


@router.get(
    "/validate/{permission_name}",
    response_model=StandardApiResponse[dict],
    summary="[Admin] Kiểm tra tính hợp lệ của permission name",
    dependencies=[Depends(require_permission("permission", "list_all_definitions"))],
    tags=["permissions"],
)
@api_response_wrapper(default_success_message="Kiểm tra permission thành công.")
async def validate_permission_name(
    permission_name: str = Path(..., description="Tên permission cần kiểm tra"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    """Kiểm tra tính hợp lệ của permission name và xem có tồn tại trong hệ thống không"""
    # Validate format
    is_valid_format = ":" in permission_name and len(permission_name.split(":")) == 2

    # Check if exists in system
    existing_permission = await crud_permissions.get_permission_by_name(db, permission_name)
    exists_in_system = existing_permission is not None

    return {
        "permission_name": permission_name,
        "is_valid_format": is_valid_format,
        "exists_in_system": exists_in_system,
        "is_valid": is_valid_format and exists_in_system,
    }


# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>
