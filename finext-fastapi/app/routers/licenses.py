# finext-fastapi/app/routers/licenses.py
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.licenses import LicenseCreate, LicensePublic, LicenseUpdate
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission
import app.crud.licenses as crud_licenses

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/",
    response_model=StandardApiResponse[LicensePublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một license mới",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(
    default_success_message="License được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_license(
    license_data: LicenseCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user: UserInDB = Depends(get_current_active_user) # Đã được inject bởi require_permission
):
    existing_license = await crud_licenses.get_license_by_key(db, license_data.key)
    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"License với key '{license_data.key}' đã tồn tại.",
        )

    created_license = await crud_licenses.create_license(db, license_create_data=license_data)
    if not created_license:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Không thể tạo license do lỗi máy chủ hoặc feature key không hợp lệ.",
        )
    return LicensePublic.model_validate(created_license)


@router.get(
    "/",
    response_model=StandardApiResponse[List[LicensePublic]],
    summary="[Admin] Lấy danh sách các licenses",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="Lấy danh sách licenses thành công.")
async def read_all_licenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    licenses_in_db = await crud_licenses.get_licenses(db, skip=skip, limit=limit)
    return [LicensePublic.model_validate(lic) for lic in licenses_in_db]


@router.get(
    "/{license_id}",
    response_model=StandardApiResponse[LicensePublic],
    summary="[Admin] Lấy thông tin chi tiết một license theo ID",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(default_success_message="Lấy thông tin license thành công.")
async def read_license_by_id_endpoint( # Đổi tên để tránh trùng với crud
    license_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    license_obj = await crud_licenses.get_license_by_id(db, license_id=license_id)
    if license_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"License với ID {license_id} không được tìm thấy.",
        )
    return LicensePublic.model_validate(license_obj)


@router.put(
    "/{license_id}",
    response_model=StandardApiResponse[LicensePublic],
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
        updated_license = await crud_licenses.update_license(
            db, license_id=license_id, license_update_data=license_data
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if updated_license is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không thể cập nhật. License với ID {license_id} không tồn tại hoặc dữ liệu không hợp lệ.",
        )
    return LicensePublic.model_validate(updated_license)


@router.delete(
    "/{license_id}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Xóa một license",
    dependencies=[Depends(require_permission("license", "manage"))],
    tags=["licenses"],
)
@api_response_wrapper(
    default_success_message="License đã được xóa thành công.",
    success_status_code=status.HTTP_200_OK
)
async def delete_existing_license(
    license_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user: UserInDB = Depends(get_current_active_user) # Đã inject
):
    license_to_delete = await crud_licenses.get_license_by_id(db, license_id)
    if license_to_delete is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"License với ID {license_id} không được tìm thấy.",
        )

    # Logic kiểm tra PROTECTED_LICENSE_KEYS và license đang sử dụng đã có trong crud_licenses.delete_license
    try:
        deleted = await crud_licenses.delete_license(db, license_id=license_id)
        if not deleted:
            # This case should ideally be caught by ValueError if it's due to protection or usage
            logger.error(f"License {license_to_delete.key} (ID: {license_id}) found but delete_one in CRUD failed after checks.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Không thể xóa license với ID {license_id} sau khi kiểm tra.",
            )
    except ValueError as ve: # Catches errors from CRUD (e.g., protected, in use)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    return None