# finext-fastapi/app/routers/licenses.py
import logging
from typing import Union
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.licenses import LicenseCreate, LicensePublic, LicenseAdminResponse, LicenseUpdate
from app.schemas.users import UserInDB  # Thêm import này
from app.auth.dependencies import get_current_active_user  # Thêm import này

# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse  # Import schema phân trang

# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission
import app.crud.licenses as crud_licenses

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được đặt ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[LicenseAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một license mới",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],  # Thêm tags ở đây
)
@api_response_wrapper(
    default_success_message="License được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_license(
    license_data: LicenseCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_license = await crud_licenses.create_license(db, license_create_data=license_data)
        # crud_licenses.create_license đã raise ValueError nếu có lỗi logic
        if not created_license:
            # Lỗi này có thể là lỗi DB không mong muốn
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo license do lỗi máy chủ.",
            )
        return LicenseAdminResponse.model_validate(created_license)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# <<<< PHẦN CẬP NHẬT ENDPOINT LIST ALL LICENSES >>>>
@router.get(
    "/",
    response_model=StandardApiResponse[
        PaginatedResponse[Union[LicenseAdminResponse, LicensePublic]]
    ],  # SỬA RESPONSE MODEL: Support cả 2 type
    summary="Lấy danh sách các licenses (User: minimal, Admin: full)",
    dependencies=[Depends(require_permission("license", "read"))],  # Đổi thành "read" để user xem được
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="Lấy danh sách licenses thành công.")
async def read_all_licenses(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số lượng bản ghi tối đa trả về"),
    include_inactive: bool = Query(False, description="Bao gồm cả các license không hoạt động"),
    # Thêm các filter nếu cần:
    # key_filter: Optional[str] = Query(None, description="Lọc theo key license (chứa)"),
    # name_filter: Optional[str] = Query(None, description="Lọc theo tên license (chứa)"),
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Kiểm tra quyền admin để quyết định trả về full hay minimal
    from app.auth.access import _get_user_permissions

    user_permissions = await _get_user_permissions(db, str(current_user.id))
    is_admin_or_manager = "license:manage" in user_permissions

    licenses_docs, total_count = await crud_licenses.get_licenses(
        db,
        skip=skip,
        limit=limit,
        include_inactive=include_inactive if is_admin_or_manager else False,  # User thường k được xem inactive
        # key_filter=key_filter,
        # name_filter=name_filter,
    )

    if is_admin_or_manager:
        items = [LicenseAdminResponse.model_validate(lic) for lic in licenses_docs]
        return PaginatedResponse[LicenseAdminResponse](items=items, total=total_count)
    else:
        items = [LicensePublic.model_validate(lic) for lic in licenses_docs]
        return PaginatedResponse[LicensePublic](items=items, total=total_count)


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


@router.get(
    "/{license_id}",
    response_model=StandardApiResponse[LicensePublic],
    summary="Lấy thông tin chi tiết một license theo ID",
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="Lấy thông tin license thành công.")
async def read_license_by_id_endpoint(
    license_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Kiểm tra permissions - cần có license:read hoặc license:manage
    from app.auth.access import _get_user_permissions

    user_permissions = await _get_user_permissions(db, str(current_user.id))

    if not ("license:read" in user_permissions or "license:manage" in user_permissions):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập thông tin license này.")

    license_obj = await crud_licenses.get_license_by_id(db, license_id=license_id)
    if license_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"License với ID {license_id} không được tìm thấy.",
        )
    return LicensePublic.model_validate(license_obj)


@router.put(
    "/{license_id}",
    response_model=StandardApiResponse[LicenseAdminResponse],
    summary="[Admin] Cập nhật thông tin một license",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="Cập nhật license thành công.")
async def update_existing_license(
    license_id: PyObjectId,
    license_data: LicenseUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_license = await crud_licenses.update_license(db, license_id=license_id, license_update_data=license_data)
        if updated_license is None:  # Có thể do license_id không tồn tại
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không thể cập nhật. License với ID {license_id} không tồn tại.",
            )
        return LicenseAdminResponse.model_validate(updated_license)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ: không cho sửa license được bảo vệ)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/{license_id}/deactivate",
    response_model=StandardApiResponse[LicenseAdminResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Vô hiệu hoá một license",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="License đã được vô hiệu hoá thành công.", success_status_code=status.HTTP_200_OK)
async def deactivate_existing_license(
    license_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deactivated_license = await crud_licenses.deactivate_license_db(db, license_id=license_id)
        # crud_licenses.deactivate_license_db đã raise ValueError nếu có lỗi logic
        if not deactivated_license:  # Lỗi không mong muốn khác
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,  # Hoặc 404 nếu không tìm thấy sau khi check
                detail=f"Không thể vô hiệu hoá license với ID {license_id} sau khi kiểm tra.",
            )
        return LicenseAdminResponse.model_validate(deactivated_license)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/{license_id}/activate",
    response_model=StandardApiResponse[LicenseAdminResponse],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Kích hoạt một license",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="License đã được kích hoạt thành công.", success_status_code=status.HTTP_200_OK)
async def activate_existing_license(
    license_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        activated_license = await crud_licenses.activate_license_db(db, license_id=license_id)
        # crud_licenses.activate_license_db đã raise ValueError nếu có lỗi logic
        if not activated_license:  # Lỗi không mong muốn khác
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,  # Hoặc 404 nếu không tìm thấy sau khi check
                detail=f"Không thể kích hoạt license với ID {license_id} sau khi kiểm tra.",
            )
        return LicenseAdminResponse.model_validate(activated_license)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# Endpoint DELETE một license có thể nguy hiểm nếu license đó đã được sử dụng trong các subscription
# hoặc transaction. Thay vào đó, việc "vô hiệu hóa" (is_active=False) thường an toàn hơn.
# Nếu bạn vẫn muốn có endpoint DELETE, cần cân nhắc kỹ các ràng buộc.
# Hiện tại, endpoint `deactivate_existing_license` đã xử lý việc này.
