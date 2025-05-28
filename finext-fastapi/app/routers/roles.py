# finext-fastapi/app/routers/roles.py
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.roles import RoleCreate, RolePublic, RoleUpdate
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission 
import app.crud.roles as crud_roles
from app.core.config import PROTECTED_ROLE_NAMES # Import PROTECTED_ROLE_NAMES

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=StandardApiResponse[RolePublic],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo một vai trò mới",
    dependencies=[Depends(require_permission("role", "create"))],
    tags=["roles"],
)
@api_response_wrapper(
    default_success_message="Vai trò được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_role(
    role_data: RoleCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    existing_role = await crud_roles.get_role_by_name(db, role_data.name)
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trò với tên '{role_data.name}' đã tồn tại.",
        )

    created_role = await crud_roles.create_role(db, role_create_data=role_data)
    if not created_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo vai trò do lỗi máy chủ hoặc dữ liệu không hợp lệ (ví dụ: permission ID không tồn tại).",
        )
    return RolePublic.model_validate(created_role)


@router.get(
    "/",
    response_model=StandardApiResponse[List[RolePublic]],
    summary="Lấy danh sách các vai trò",
    dependencies=[Depends(require_permission("role", "list"))],
    tags=["roles"],
)
@api_response_wrapper(default_success_message="Lấy danh sách vai trò thành công.")
async def read_all_roles(
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    roles_in_db = await crud_roles.get_roles(db, skip=skip, limit=limit)
    return [RolePublic.model_validate(role) for role in roles_in_db]


@router.get(
    "/{role_id}",
    response_model=StandardApiResponse[RolePublic],
    summary="Lấy thông tin chi tiết một vai trò theo ID",
    dependencies=[Depends(require_permission("role", "read_any"))],
    tags=["roles"],
)
@api_response_wrapper(default_success_message="Lấy thông tin vai trò thành công.")
async def read_role_by_id(
    role_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    role = await crud_roles.get_role_by_id(db, role_id_str=role_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vai trò với ID {role_id} không được tìm thấy.",
        )
    return RolePublic.model_validate(role)


@router.put(
    "/{role_id}",
    response_model=StandardApiResponse[RolePublic],
    summary="Cập nhật thông tin một vai trò",
    dependencies=[Depends(require_permission("role", "update_any"))],
    tags=["roles"],
)
@api_response_wrapper(default_success_message="Cập nhật vai trò thành công.")
async def update_existing_role(
    role_id: PyObjectId,
    role_data: RoleUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_role = await crud_roles.update_role(
            db, role_id_str=role_id, role_update_data=role_data
        )
    except ValueError as ve: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if updated_role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Không thể cập nhật vai trò với ID {role_id}. Vai trò không tồn tại hoặc dữ liệu không hợp lệ.",
        )
    return RolePublic.model_validate(updated_role)


@router.delete(
    "/{role_id}",
    response_model=StandardApiResponse[None], 
    status_code=status.HTTP_200_OK,       
    summary="Xóa một vai trò",
    dependencies=[Depends(require_permission("role", "delete_any"))],
    tags=["roles"],
)
@api_response_wrapper(
    default_success_message="Vai trò đã được xóa thành công.", 
    success_status_code=status.HTTP_200_OK 
)
async def delete_existing_role(
    role_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    role_to_delete = await crud_roles.get_role_by_id(db, role_id)
    
    if role_to_delete is None: 
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vai trò với ID {role_id} không được tìm thấy.",
        )

    # Sử dụng PROTECTED_ROLE_NAMES từ config
    if role_to_delete.name in PROTECTED_ROLE_NAMES:
        logger.warning(f"Attempt to delete protected system role: {role_to_delete.name} (ID: {role_id})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa vai trò hệ thống mặc định: '{role_to_delete.name}'.",
        )
    
    try:
        deleted = await crud_roles.delete_role(db, role_id_str=role_id)
        if not deleted: # Should not happen if role was found and not protected, unless CRUD logic changes
            logger.error(f"Role {role_to_delete.name} (ID: {role_id}) found but delete_one in CRUD failed after checks.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"Không thể xóa vai trò với ID {role_id} sau khi kiểm tra.",
            )
    except ValueError as ve: # Catch ValueError from CRUD (e.g., role in use or protected)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        
    return None