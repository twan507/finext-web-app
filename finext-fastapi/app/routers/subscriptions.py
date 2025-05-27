# finext-fastapi/app/routers/subscriptions.py
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.subscriptions import (
    SubscriptionCreate, SubscriptionPublic
)
from app.schemas.users import UserInDB
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission
import app.crud.subscriptions as crud_subscriptions

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/",
    response_model=StandardApiResponse[SubscriptionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo subscription mới cho user",
    dependencies=[Depends(require_permission("subscription", "create"))],
    tags=["subscriptions", "admin"],
)
@api_response_wrapper(
    default_success_message="Subscription được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_subscription(
    sub_data: SubscriptionCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_data=sub_data)
    if not created_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tạo subscription. Vui lòng kiểm tra User ID và License Key.",
        )
    return SubscriptionPublic.model_validate(created_sub)

@router.get(
    "/{subscription_id}",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="Lấy chi tiết subscription theo ID",
    dependencies=[Depends(require_permission("subscription", "read_any"))], # Hoặc "read_own" với logic phức tạp hơn
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin subscription thành công.")
async def read_subscription_by_id(
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user), # Cần user để check quyền (nếu có read_own)
):
    sub = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription với ID {subscription_id} không tìm thấy.",
        )
    # TODO: Thêm logic kiểm tra nếu user chỉ có quyền "read_own"
    # if "subscription:read_any" not in user_permissions and str(sub.user_id) != str(current_user.id):
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem subscription này.")
    return SubscriptionPublic.model_validate(sub)

@router.get(
    "/user/{user_id}",
    response_model=StandardApiResponse[List[SubscriptionPublic]],
    summary="Lấy lịch sử subscriptions của user",
    dependencies=[Depends(require_permission("subscription", "read_any"))], # Hoặc "read_own"
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy lịch sử subscription thành công.")
async def read_user_subscriptions(
    user_id: PyObjectId,
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_user: UserInDB = Depends(get_current_active_user),
):
    # TODO: Thêm logic kiểm tra nếu user chỉ có quyền "read_own"
    subs = await crud_subscriptions.get_subscriptions_for_user_db(db, user_id, skip, limit)
    return [SubscriptionPublic.model_validate(s) for s in subs]

@router.post(
    "/{subscription_id}/deactivate",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Hủy kích hoạt một subscription",
    dependencies=[Depends(require_permission("subscription", "deactivate_any"))],
    tags=["subscriptions", "admin"],
)
@api_response_wrapper(default_success_message="Hủy kích hoạt subscription thành công.")
async def deactivate_subscription(
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    deactivated_sub = await crud_subscriptions.deactivate_subscription_db(db, subscription_id)
    if not deactivated_sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription với ID {subscription_id} không tìm thấy hoặc đã bị hủy.",
        )
    return SubscriptionPublic.model_validate(deactivated_sub)

# PUT /api/v1/subscriptions/{subscription_id}: (Admin) Cập nhật (Tùy chọn)
# Bạn có thể thêm endpoint này nếu cần cập nhật, ví dụ: kéo dài ngày hết hạn.