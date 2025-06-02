# finext-fastapi/app/routers/roles.py
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query # Thêm Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.roles import RoleCreate, RolePublic, RoleUpdate # Thêm RoleInDB
# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse # Import schema phân trang
# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission 
import app.crud.roles as crud_roles

logger = logging.getLogger(__name__)
router = APIRouter() # Prefix và tags sẽ được đặt ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[RolePublic],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo một vai trò mới",
    dependencies=[Depends(require_permission("role", "create"))],
    tags=["roles"], # Thêm tags ở đây
)
@api_response_wrapper(
    default_success_message="Vai trò được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_role(
    role_data: RoleCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_role = await crud_roles.create_role(db, role_create_data=role_data)
        # crud_roles.create_role đã raise ValueError nếu có lỗi logic
        if not created_role:
            # Lỗi này có thể là lỗi DB không mong muốn
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo vai trò do lỗi máy chủ.",
            )
        return RolePublic.model_validate(created_role)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

# <<<< PHẦN CẬP NHẬT ENDPOINT LIST ALL ROLES >>>>
@router.get(
    "/",
    response_model=StandardApiResponse[PaginatedResponse[RolePublic]], # SỬA RESPONSE MODEL
    summary="Lấy danh sách các vai trò",
    dependencies=[Depends(require_permission("role", "list"))],
    tags=["roles"],
)
@api_response_wrapper(default_success_message="Lấy danh sách vai trò thành công.")
async def read_all_roles(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=200, description="Số lượng bản ghi tối đa trả về"),
    # Thêm filter nếu cần, ví dụ:
    # name_filter: Optional[str] = Query(None, description="Lọc theo tên vai trò (chứa)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    roles_docs, total_count = await crud_roles.get_roles(
        db, 
        skip=skip, 
        limit=limit,
        # name_filter=name_filter # Truyền filter nếu có
    )
    
    items = [RolePublic.model_validate(role) for role in roles_docs]
    return PaginatedResponse[RolePublic](items=items, total=total_count)
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>

@router.get(
    "/{role_id}",
    response_model=StandardApiResponse[RolePublic],
    summary="Lấy thông tin chi tiết một vai trò theo ID",
    dependencies=[Depends(require_permission("role", "read_any"))],
    tags=["roles"],
)
@api_response_wrapper(default_success_message="Lấy thông tin vai trò thành công.")
async def read_role_by_id_endpoint( # Đổi tên hàm
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
async def update_existing_role( # Đổi tên hàm
    role_id: PyObjectId,
    role_data: RoleUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_role = await crud_roles.update_role(
            db, role_id_str=role_id, role_update_data=role_data
        )
        # crud_roles.update_role đã raise ValueError nếu có lỗi logic
        if updated_role is None: # Nếu không tìm thấy role để update
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Không thể cập nhật vai trò với ID {role_id}. Vai trò không tồn tại.",
            )
        return RolePublic.model_validate(updated_role)
    except ValueError as ve: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


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
async def delete_existing_role( # Đổi tên hàm
    role_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deleted = await crud_roles.delete_role(db, role_id_str=role_id)
        if not deleted: 
            # crud_roles.delete_role sẽ raise ValueError nếu là role được bảo vệ hoặc đang được sử dụng.
            # Trường hợp này có thể là role_id không tìm thấy.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vai trò với ID {role_id} không tìm thấy để xóa.",
            )
    except ValueError as ve: # Bắt lỗi từ CRUD (ví dụ: role được bảo vệ, role đang sử dụng)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        
    return None