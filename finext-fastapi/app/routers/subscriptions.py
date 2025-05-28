# finext-fastapi/app/routers/subscriptions.py
import logging
from typing import List, Optional

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
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

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
async def create_new_subscription_endpoint( # Đổi tên hàm để tránh trùng
    sub_data: SubscriptionCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Kiểm tra user tồn tại trước khi gọi CRUD
    user_doc = await db.users.find_one({"_id": ObjectId(sub_data.user_id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User với ID {sub_data.user_id} không tồn tại.")

    created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_data=sub_data)
    if not created_sub:
        # crud_subscriptions.create_subscription_db có thể trả về None nếu license_key không tồn tại
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể tạo subscription. Vui lòng kiểm tra User ID và License Key ('{sub_data.license_key}') có hợp lệ không.",
        )
    return SubscriptionPublic.model_validate(created_sub)

@router.post(
    "/{subscription_id}/activate",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Kích hoạt lại một subscription cụ thể cho user",
    dependencies=[Depends(require_permission("subscription", "update_any"))], # Sử dụng quyền update_any
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Kích hoạt subscription thành công.")
async def activate_subscription_endpoint( # Đổi tên hàm
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user) # Để ghi log
):
    logger.info(f"Admin {current_admin.email} yêu cầu kích hoạt subscription ID: {subscription_id}")
    
    sub_to_activate = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if not sub_to_activate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subscription với ID {subscription_id} không tìm thấy.")

    # Lấy user_id từ subscription cần kích hoạt
    user_id_of_sub = str(sub_to_activate.user_id)

    activated_sub = await crud_subscriptions.activate_specific_subscription_for_user(
        db, 
        user_id_str=user_id_of_sub, 
        subscription_id_to_activate_str=subscription_id,
    )
    if not activated_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # Hoặc 500 tùy theo nguyên nhân
            detail=f"Không thể kích hoạt subscription {subscription_id}. Có thể nó không thuộc user hoặc lỗi khác.",
        )
    return SubscriptionPublic.model_validate(activated_sub)

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

@router.get( # MỚI: Endpoint cho user tự xem sub của mình
    "/me/current",
    response_model=StandardApiResponse[Optional[SubscriptionPublic]], # Có thể là None nếu không có active sub
    summary="[User] Lấy thông tin subscription đang hoạt động của người dùng hiện tại",
    dependencies=[Depends(require_permission("subscription", "read_own"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin subscription hiện tại thành công.")
async def read_my_current_subscription_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    active_sub = await crud_subscriptions.get_active_subscription_for_user_db(db, current_user.id) # type: ignore
    if not active_sub:
        # Không raise lỗi, trả về data là None nếu không có active sub
        return None 
    return SubscriptionPublic.model_validate(active_sub)

@router.delete(
    "/{subscription_id}/deactivate",
    response_model=StandardApiResponse[SubscriptionPublic],
    summary="[Admin] Hủy kích hoạt một subscription",
    dependencies=[Depends(require_permission("subscription", "deactivate_any"))],
    tags=["subscriptions"],
)
@api_response_wrapper(default_success_message="Hủy kích hoạt subscription thành công.")
async def deactivate_subscription(
    subscription_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Lấy thông tin subscription trước khi deactivate
    subscription = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription với ID {subscription_id} không tìm thấy.",
        )
    
    # Kiểm tra license_key để ngăn không cho deactivate ADMIN hoặc PARTNER
    if subscription.license_key in ["ADMIN", "PARTNER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Không thể hủy kích hoạt subscription với license key '{subscription.license_key}'. Đây là subscription hệ thống.",
        )
    
    deactivated_sub = await crud_subscriptions.deactivate_subscription_db(db, subscription_id)
    if not deactivated_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription với ID {subscription_id} đã bị hủy kích hoạt trước đó.",
        )
    return SubscriptionPublic.model_validate(deactivated_sub)
