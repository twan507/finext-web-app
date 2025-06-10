# finext-fastapi/app/routers/subscriptions.py
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query  # Thêm Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.subscriptions import SubscriptionCreate, SubscriptionPublic
from app.schemas.users import UserInDB  # Giữ UserInDB cho current_user
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission
import app.crud.subscriptions as crud_subscriptions
from bson import ObjectId

# <<<< PHẦN BỔ SUNG MỚI HOẶC THAY THẾ >>>>
from app.schemas.common import PaginatedResponse  # Đảm bảo bạn đã tạo file này
# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI HOẶC THAY THẾ >>>>

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được thêm ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[SubscriptionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo subscription mới cho user",
    dependencies=[Depends(require_permission("subscription", "create"))],
    tags=["subscriptions"],
)
@api_response_wrapper(
    default_success_message="Subscription được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_subscription_endpoint(
    sub_data: SubscriptionCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user_doc = await db.users.find_one({"_id": ObjectId(sub_data.user_id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User với ID {sub_data.user_id} không tồn tại.")

    try:
        created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_data=sub_data)
        if not created_sub:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể tạo subscription. Vui lòng kiểm tra User ID và License Key ('{sub_data.license_key}') có hợp lệ không, hoặc license có active không.",
            )
        return SubscriptionPublic.model_validate(created_sub)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ license không active)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/{subscription_id}/activate",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Kích hoạt lại một subscription cụ thể cho user",
    dependencies=[Depends(require_permission("subscription", "update_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Kích hoạt subscription thành công.")
async def activate_subscription_endpoint(
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(f"Admin {current_admin.email} yêu cầu kích hoạt subscription ID: {subscription_id}")

    sub_to_activate = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if not sub_to_activate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subscription với ID {subscription_id} không tìm thấy.")

    user_id_of_sub = str(sub_to_activate.user_id)

    try:
        activated_sub = await crud_subscriptions.activate_specific_subscription_for_user(
            db,
            user_id_str=user_id_of_sub,
            subscription_id_to_activate_str=subscription_id,
        )
        if not activated_sub:
            # Lỗi này có thể do logic bên trong activate_specific_subscription_for_user không tìm thấy sub hoặc user
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể kích hoạt subscription {subscription_id}. Có thể nó không thuộc user hoặc lỗi khác.",
            )
        return SubscriptionPublic.model_validate(activated_sub)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ license gốc không active)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/{subscription_id}",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="Lấy chi tiết subscription theo ID",
    dependencies=[Depends(require_permission("subscription", "read_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin subscription thành công.")
async def read_subscription_by_id(  # Đổi tên hàm nếu bị trùng
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user: UserInDB = Depends(get_current_active_user), # Bỏ nếu không dùng trực tiếp current_user
):
    sub = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription với ID {subscription_id} không tìm thấy.",
        )
    return SubscriptionPublic.model_validate(sub)


@router.get(
    "/user/{user_id}",
    response_model=StandardApiResponse[List[SubscriptionPublic]],
    summary="Lấy lịch sử subscriptions của user",
    dependencies=[Depends(require_permission("subscription", "read_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy lịch sử subscription thành công.")
async def read_user_subscriptions(  # Đổi tên hàm nếu bị trùng
    user_id: PyObjectId,
    skip: int = Query(0, ge=0),  # Thêm Query cho skip, limit
    limit: int = Query(100, ge=1, le=99999),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user: UserInDB = Depends(get_current_active_user), # Bỏ nếu không dùng
):
    subs = await crud_subscriptions.get_subscriptions_for_user_db(db, user_id, skip, limit)
    return [SubscriptionPublic.model_validate(s) for s in subs]


@router.get(
    "/me/current",
    response_model=StandardApiResponse[Optional[SubscriptionPublic]],
    summary="[User] Lấy thông tin subscription đang hoạt động của người dùng hiện tại",
    dependencies=[Depends(require_permission("subscription", "read_own"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin subscription hiện tại thành công.")
async def read_my_current_subscription_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    active_sub = await crud_subscriptions.get_active_subscription_for_user_db(db, current_user.id)  # type: ignore
    if not active_sub:
        return None
    return SubscriptionPublic.model_validate(active_sub)


@router.put(
    "/{subscription_id}/deactivate",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Hủy kích hoạt một subscription",
    dependencies=[Depends(require_permission("subscription", "deactivate_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Hủy kích hoạt subscription thành công.")
async def deactivate_subscription(  # Đổi tên hàm nếu bị trùng
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deactivated_sub = await crud_subscriptions.deactivate_subscription_db(db, subscription_id)
        if not deactivated_sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription với ID {subscription_id} không tìm thấy hoặc đã bị hủy kích hoạt.",
            )
        return SubscriptionPublic.model_validate(deactivated_sub)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# <<<< PHẦN BỔ SUNG MỚI >>>>
@router.get(
    "/admin/all",
    response_model=StandardApiResponse[PaginatedResponse[SubscriptionPublic]],
    summary="[Admin] Lấy danh sách tất cả subscriptions (hỗ trợ filter và phân trang)",
    dependencies=[Depends(require_permission("subscription", "read_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách tất cả subscriptions thành công.")
async def admin_read_all_subscriptions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số bản ghi tối đa mỗi trang (99999 cho 'All')"),
    user_id: Optional[PyObjectId] = Query(None, description="Lọc theo User ID"),
    license_key: Optional[str] = Query(None, description="Lọc theo License Key (ví dụ: 'EXAMPLE_PRO')"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái active (true/false)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not hasattr(crud_subscriptions, "get_all_subscriptions_admin"):
        logger.error("CRUD function 'get_all_subscriptions_admin' is not implemented in crud_subscriptions.py")
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Admin list subscriptions feature not fully implemented in CRUD."
        )

    subscriptions_docs, total = await crud_subscriptions.get_all_subscriptions_admin(
        db,
        skip=skip,
        limit=limit,
        user_id_filter=user_id,
        license_key_filter=license_key.upper() if license_key else None,  # Chuẩn hóa license_key
        is_active_filter=is_active,
    )
    items = [SubscriptionPublic.model_validate(s) for s in subscriptions_docs]
    return PaginatedResponse[SubscriptionPublic](items=items, total=total)


@router.delete(
    "/{subscription_id}",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Xóa một subscription",
    dependencies=[Depends(require_permission("subscription", "delete_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Xóa subscription thành công.")
async def delete_subscription_endpoint(
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(f"Admin {current_admin.email} yêu cầu xóa subscription ID: {subscription_id}")

    try:
        deleted_sub = await crud_subscriptions.delete_subscription_db(db, subscription_id)
        if not deleted_sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription với ID {subscription_id} không tìm thấy hoặc không thể xóa.",
            )
        return SubscriptionPublic.model_validate(deleted_sub)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>
