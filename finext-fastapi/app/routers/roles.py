# finext-fastapi/app/routers/roles.py
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.roles import RoleCreate, RolePublic, RoleUpdate
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission  # Sử dụng dependency đã tạo
import app.crud.roles as crud_roles

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
        # create_role có thể trả về None nếu có lỗi (ví dụ perm_id không hợp lệ)
        # hoặc có thể raise Exception trực tiếp từ CRUD nếu muốn rõ ràng hơn
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
    except ValueError as ve:  # Bắt lỗi tên trùng từ CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if updated_role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,  # Hoặc 400 nếu lỗi do permission_ids không hợp lệ
            detail=f"Không thể cập nhật vai trò với ID {role_id}. Vai trò không tồn tại hoặc dữ liệu không hợp lệ.",
        )
    return RolePublic.model_validate(updated_role)


@router.delete(
    "/{role_id}",
    response_model=StandardApiResponse[None], # Response model cho biết data sẽ là null
    status_code=status.HTTP_200_OK,          # Status code mong muốn khi thành công
    summary="Xóa một vai trò",
    dependencies=[Depends(require_permission("role", "delete_any"))],
    tags=["roles"],
)
@api_response_wrapper(
    default_success_message="Vai trò đã được xóa thành công.", # Message khi thành công
    success_status_code=status.HTTP_200_OK # Đảm bảo wrapper dùng status code này
)
async def delete_existing_role(
    role_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Kiểm tra xem role có phải là "admin" hoặc "user" không, nếu vậy thì không cho xóa
    role_to_delete = await crud_roles.get_role_by_id(db, role_id)
    
    if role_to_delete is None: # Thêm kiểm tra nếu role không tồn tại ngay từ đầu
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vai trò với ID {role_id} không được tìm thấy.",
        )

    # Danh sách các tên role hệ thống không được phép xóa
    protected_role_names = ["admin", "user"] # Bạn có thể mở rộng danh sách này nếu cần

    if role_to_delete.name in protected_role_names:
        logger.warning(f"Attempt to delete protected system role: {role_to_delete.name} (ID: {role_id})")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # Hoặc 403 Forbidden
            detail=f"Không thể xóa vai trò hệ thống mặc định: '{role_to_delete.name}'.",
        )

    # Kiểm tra xem role có đang được sử dụng bởi user nào không
    # (Đây là một bước tùy chọn nhưng rất nên có để đảm bảo tính toàn vẹn dữ liệu)
    users_using_role_count = await db.users.count_documents({"role_ids": str(role_id)}) # role_id trong users là string
    if users_using_role_count > 0:
        logger.warning(f"Attempt to delete role '{role_to_delete.name}' (ID: {role_id}) which is currently in use by {users_using_role_count} user(s).")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trò '{role_to_delete.name}' đang được sử dụng bởi {users_using_role_count} người dùng và không thể xóa. Vui lòng thu hồi vai trò này khỏi tất cả người dùng trước.",
        )

    deleted = await crud_roles.delete_role(db, role_id_str=role_id)
    if not deleted:
        # Trường hợp này ít xảy ra nếu role_to_delete đã được tìm thấy ở trên
        # và không có lỗi nào khác trong crud_roles.delete_role
        logger.error(f"Role {role_to_delete.name} (ID: {role_id}) found but delete_one in CRUD failed.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Hoặc 404 nếu delete_role trả về False do không tìm thấy
            detail=f"Không thể xóa vai trò với ID {role_id} sau khi kiểm tra.",
        )
    
    # Trả về None để @api_response_wrapper tạo ra response chuẩn với message thành công
    return None
