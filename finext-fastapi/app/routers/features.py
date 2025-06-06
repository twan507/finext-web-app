# finext-fastapi/app/routers/features.py
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.features import FeatureCreate, FeaturePublic, FeatureUpdate
from app.schemas.common import PaginatedResponse
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.access import require_permission
import app.crud.features as crud_features

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/",  # Đường dẫn sẽ là /api/v1/features/
    response_model=StandardApiResponse[FeaturePublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một feature mới",
    dependencies=[Depends(require_permission("feature", "manage"))],
)
@api_response_wrapper(
    default_success_message="Feature được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_feature(
    feature_data: FeatureCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_feature = await crud_features.create_feature(db, feature_create_data=feature_data)
        # CRUD create_feature đã raise ValueError nếu key tồn tại
        if not created_feature:
            # Lỗi này có thể xảy ra nếu có vấn đề khác khi ghi DB
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo feature do lỗi máy chủ.",
            )
        return FeaturePublic.model_validate(created_feature)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/",  # Đường dẫn sẽ là /api/v1/features/ - endpoint này cho admin list all
    # Nếu bạn muốn một endpoint public cho user xem feature nào đó thì cần logic/permission khác
    response_model=StandardApiResponse[PaginatedResponse[FeaturePublic]],
    summary="[Admin] Lấy danh sách tất cả features (hỗ trợ phân trang)",
    dependencies=[Depends(require_permission("feature", "manage"))],  # Quyền "manage" cho phép xem list
)
@api_response_wrapper(default_success_message="Lấy danh sách features thành công.")
async def admin_read_all_features(  # Đổi tên để rõ ràng là cho admin
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số bản ghi tối đa mỗi trang (99999 cho 'All')"),
    # Thêm filter nếu cần:
    # key_filter: Optional[str] = Query(None, description="Lọc theo key (chứa, không phân biệt hoa thường)"),
    # name_filter: Optional[str] = Query(None, description="Lọc theo name (chứa, không phân biệt hoa thường)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    features_docs, total = await crud_features.get_features(
        db,
        skip=skip,
        limit=limit,
        # key_filter=key_filter, # Truyền filter nếu có
        # name_filter=name_filter
    )
    # FeaturePublic không có created_at, updated_at. Nếu muốn hiển thị cho admin,
    # có thể tạo FeatureAdminPublic kế thừa FeatureInDB hoặc trả về FeatureInDB trực tiếp (cần sửa response_model)
    items = [FeaturePublic.model_validate(f) for f in features_docs]
    return PaginatedResponse[FeaturePublic](items=items, total=total)


@router.get(
    "/{feature_id}",
    response_model=StandardApiResponse[FeaturePublic],  # Trả về FeaturePublic
    summary="[Admin] Lấy chi tiết một feature theo ID",
    dependencies=[Depends(require_permission("feature", "manage"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin feature thành công.")
async def read_feature_by_id(  # Đổi tên hàm để tránh trùng
    feature_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    feature = await crud_features.get_feature_by_id(db, feature_id)
    if feature is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Feature với ID {feature_id} không tìm thấy.",
        )
    return FeaturePublic.model_validate(feature)  # Validate qua FeaturePublic


@router.put(
    "/{feature_id}",
    response_model=StandardApiResponse[FeaturePublic],
    summary="[Admin] Cập nhật một feature",
    dependencies=[Depends(require_permission("feature", "manage"))],
)
@api_response_wrapper(default_success_message="Cập nhật feature thành công.")
async def update_existing_feature(  # Đổi tên hàm
    feature_id: PyObjectId,
    feature_data: FeatureUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    updated_feature = await crud_features.update_feature(db, feature_id, feature_data)
    if updated_feature is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không thể cập nhật. Feature với ID {feature_id} không tồn tại.",
        )
    return FeaturePublic.model_validate(updated_feature)


@router.delete(
    "/{feature_id}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Xóa một feature",
    dependencies=[Depends(require_permission("feature", "manage"))],
)
@api_response_wrapper(default_success_message="Feature đã được xóa thành công.", success_status_code=status.HTTP_200_OK)
async def delete_existing_feature(  # Đổi tên hàm
    feature_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deleted = await crud_features.delete_feature(db, feature_id)
        if not deleted:
            # CRUD không tìm thấy feature
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Feature với ID {feature_id} không tìm thấy để xóa.",
            )
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ: feature đang được sử dụng)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    return None  # API wrapper sẽ xử lý response thành công
