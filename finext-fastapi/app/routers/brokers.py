# finext-fastapi/app/routers/brokers.py
import logging
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.brokers as crud_brokers
import app.crud.licenses as crud_licenses
import app.crud.subscriptions as crud_subscriptions
import app.crud.users as crud_users
from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database
from app.schemas.brokers import (
    BrokerCreate,
    BrokerInDB,
    BrokerPublic,
    BrokerUpdate,
    BrokerValidationResponse,
)
from app.schemas.subscriptions import (
    SubscriptionCreate as AppSubscriptionCreateSchema,
    SubscriptionInDB,
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.core.config import BROKER_EMAIL_1, BROKER_EMAIL_2


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/brokers", tags=["brokers"])


@router.post(
    "/",
    response_model=StandardApiResponse[BrokerPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo Đối tác mới từ một User ID",
    dependencies=[Depends(require_permission("broker", "create"))],
)
@api_response_wrapper(
    default_success_message="Đối tác được tạo/kích hoạt thành công và các quyền lợi đã được gán/cập nhật.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_or_reactivate_broker_endpoint(
    broker_create_data: BrokerCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(f"Admin {current_admin.email} yêu cầu tạo/kích hoạt Đối tác cho user ID: {broker_create_data.user_id}")

    broker_record: Optional[BrokerInDB] = None
    try:
        broker_record = await crud_brokers.create_or_reactivate_broker_for_user(db, user_id=broker_create_data.user_id)  # type: ignore

        if not broker_record or not broker_record.id or not broker_record.broker_code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo hoặc kích hoạt bản ghi Đối tác.",
            )

        user_id_for_broker = broker_create_data.user_id

        broker_role = await db.roles.find_one({"name": "broker"})
        if not broker_role or not broker_role.get("_id"):
            logger.error("Vai trò 'broker' không được tìm thấy trong hệ thống.")
            if broker_record and broker_record.id:  # Check if broker_record exists before trying to access id
                await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)  # type: ignore
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi cấu hình hệ thống: Vai trò 'broker' không tồn tại.",
            )

        await crud_users.assign_roles_to_user(db, user_id_for_broker, [str(broker_role["_id"])])
        logger.info(f"Đã đảm bảo user ID: {user_id_for_broker} có vai trò 'broker'.")

        partner_sub: Optional[SubscriptionInDB] = None  # type: ignore
        existing_inactive_partner_sub = await crud_subscriptions.find_inactive_partner_subscription_for_user(db, user_id_for_broker)  # type: ignore

        if existing_inactive_partner_sub and existing_inactive_partner_sub.id:
            logger.info(
                f"Tìm thấy inactive 'PARTNER' subscription (ID: {existing_inactive_partner_sub.id}) cho user {user_id_for_broker}. Sẽ kích hoạt lại."
            )
            partner_sub = await crud_subscriptions.activate_specific_subscription_for_user(
                db,
                user_id_str=user_id_for_broker,  # type: ignore
                subscription_id_to_activate_str=existing_inactive_partner_sub.id,  # type: ignore
            )
            if partner_sub:
                logger.info(f"Đã kích hoạt lại 'PARTNER' subscription (ID: {partner_sub.id}) cho user ID: {user_id_for_broker}")

        if not partner_sub:
            logger.info(f"Sẽ tạo mới 'PARTNER' subscription cho user {user_id_for_broker}.")
            partner_license_sub_create = AppSubscriptionCreateSchema(
                user_id=user_id_for_broker,  # type: ignore
                license_key="PARTNER",
            )
            partner_sub = await crud_subscriptions.create_subscription_db(db, partner_license_sub_create)

        if not partner_sub:
            logger.error(f"Không thể gán hoặc kích hoạt license 'PARTNER' cho user ID: {user_id_for_broker}.")
            if broker_record and broker_record.id:  # Check again
                await crud_users.revoke_roles_from_user(db, user_id_for_broker, [str(broker_role["_id"])])  # type: ignore
                await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)  # type: ignore
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể gán/kích hoạt license 'PARTNER'. Vui lòng kiểm tra cấu hình license 'PARTNER'.",
            )
        logger.info(f"Đã đảm bảo user ID: {user_id_for_broker} có license 'PARTNER' (Sub ID: {partner_sub.id}).")

        final_broker_record = await crud_brokers.get_broker_by_id(db, str(broker_record.id))  # type: ignore
        if not final_broker_record:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể lấy thông tin broker sau khi cập nhật."
            )

        return BrokerPublic.model_validate(final_broker_record)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Lỗi không mong muốn khi tạo/kích hoạt Đối tác cho user {broker_create_data.user_id}: {e}", exc_info=True)
        if "broker_record" in locals() and broker_record and hasattr(broker_record, "id") and broker_record.id:
            await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Lỗi máy chủ nội bộ khi tạo/kích hoạt đối tác: {str(e)}"
        )


@router.get(
    "/",
    response_model=StandardApiResponse[List[BrokerPublic]],
    summary="[Admin] Lấy danh sách tất cả Đối tác",
    dependencies=[Depends(require_permission("broker", "list"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách Đối tác thành công.")
async def list_all_brokers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    brokers_in_db = await crud_brokers.get_brokers(db, skip=skip, limit=limit)
    return [BrokerPublic.model_validate(b) for b in brokers_in_db]


@router.get(
    "/{broker_id_or_code}",
    response_model=StandardApiResponse[BrokerPublic],
    summary="[Admin] Lấy chi tiết một Đối tác bằng ID hoặc broker_code",
    dependencies=[Depends(require_permission("broker", "read_any"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin Đối tác thành công.")
async def get_broker_details(
    broker_id_or_code: str,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker: Optional[BrokerInDB] = None
    if ObjectId.is_valid(broker_id_or_code):
        broker = await crud_brokers.get_broker_by_id(db, broker_id_or_code)

    if not broker:
        broker = await crud_brokers.get_broker_by_code(db, broker_id_or_code)

    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Đối tác với ID hoặc mã: '{broker_id_or_code}'.",
        )
    return BrokerPublic.model_validate(broker)


@router.put(
    "/{broker_id_or_code}",
    response_model=StandardApiResponse[BrokerPublic],
    summary="[Admin] Cập nhật trạng thái (is_active) của một Đối tác",
    dependencies=[Depends(require_permission("broker", "update_any"))],
)
@api_response_wrapper(default_success_message="Cập nhật trạng thái Đối tác thành công.")
async def update_broker_active_status(
    broker_id_or_code: str,
    broker_update_data: BrokerUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(
        f"Admin {current_admin.email} yêu cầu cập nhật trạng thái cho broker '{broker_id_or_code}' thành is_active={broker_update_data.is_active}"
    )
    if broker_update_data.is_active is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trường 'is_active' là bắt buộc để cập nhật.",
        )

    try:
        updated_broker = await crud_brokers.update_broker_status(db, broker_id_or_code, broker_update_data.is_active)
        if not updated_broker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy Đối tác với ID hoặc mã '{broker_id_or_code}' để cập nhật.",
            )
        return BrokerPublic.model_validate(updated_broker)
    except ValueError as ve:  # Catch protection error from CRUD
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(ve))


@router.put(
    "/{broker_id_or_code}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Hủy kích hoạt một Đối tác và thu hồi các quyền lợi liên quan",
    dependencies=[Depends(require_permission("broker", "delete_any"))],
)
@api_response_wrapper(
    default_success_message="Đối tác đã được hủy kích hoạt và các quyền lợi đã bị thu hồi/hủy.", success_status_code=status.HTTP_200_OK
)
async def deactivate_specific_broker(
    broker_id_or_code: str,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(f"Admin {current_admin.email} yêu cầu hủy kích hoạt broker: {broker_id_or_code}")

    broker_to_deactivate: Optional[BrokerInDB] = None
    if ObjectId.is_valid(broker_id_or_code):
        broker_to_deactivate = await crud_brokers.get_broker_by_id(db, broker_id_or_code)  # type: ignore
    if not broker_to_deactivate:
        broker_to_deactivate = await crud_brokers.get_broker_by_code(db, broker_id_or_code)

    if not broker_to_deactivate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Đối tác với ID hoặc mã '{broker_id_or_code}' để hủy kích hoạt.",
        )

    # Check if this broker is a protected one
    user_of_broker = await crud_users.get_user_by_id_db(db, str(broker_to_deactivate.user_id))
    if user_of_broker and user_of_broker.email in [BROKER_EMAIL_1, BROKER_EMAIL_2]:
        logger.warning(f"Attempt to deactivate protected broker (via delete endpoint): {user_of_broker.email}. Denied.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Không thể hủy kích hoạt (xóa) đối tác mặc định '{user_of_broker.email}'.",
        )

    if not broker_to_deactivate.is_active:
        logger.info(f"Broker {broker_id_or_code} đã ở trạng thái inactive.")
        return None

    user_id_of_broker_str = str(broker_to_deactivate.user_id)

    broker_role = await db.roles.find_one({"name": "broker"})
    if broker_role and broker_role.get("_id"):
        await crud_users.revoke_roles_from_user(db, user_id_of_broker_str, [str(broker_role["_id"])])  # type: ignore
        logger.info(f"Đã thu hồi vai trò 'broker' từ user ID: {user_id_of_broker_str}")
    else:
        logger.warning("Không tìm thấy vai trò 'broker' để thu hồi.")

    partner_license = await crud_licenses.get_license_by_key(db, "PARTNER")
    if partner_license and partner_license.id:
        partner_subs_cursor = db.subscriptions.find(
            {
                "user_id": ObjectId(user_id_of_broker_str),
                "license_id": ObjectId(str(partner_license.id)),  # Ensure license_id is ObjectId
                "is_active": True,
            }
        )
        async for sub_doc in partner_subs_cursor:
            try:
                await crud_subscriptions.deactivate_subscription_db(db, str(sub_doc["_id"]), assign_free_if_none_active=False)
                logger.info(f"Đã hủy kích hoạt subscription 'PARTNER' (ID: {str(sub_doc['_id'])}) cho user ID: {user_id_of_broker_str}.")
            except ValueError as e:  # Catch error if deactivating protected sub
                logger.error(f"Error deactivating PARTNER sub {str(sub_doc['_id'])} for broker {broker_id_or_code}: {e}")

    try:
        # update_broker_status now contains the protection logic
        deactivated = await crud_brokers.update_broker_status(db, broker_id_or_code, is_active=False)
        if not deactivated:  # Should be caught by ValueError if protected. This is a fallback.
            logger.error(f"Hủy kích hoạt bản ghi broker '{broker_id_or_code}' thất bại.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể hủy kích hoạt bản ghi Đối tác.",
            )
        logger.info(f"Đã hủy kích hoạt bản ghi broker: {broker_id_or_code} và xóa referral code của user liên quan.")
    except ValueError as ve:  # Catch protection error from update_broker_status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(ve))

    return None


@router.get(
    "/me",
    response_model=StandardApiResponse[BrokerPublic],
    summary="[Broker] Lấy thông tin Đối tác của người dùng hiện tại",
    dependencies=[Depends(require_permission("broker", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin Đối tác của bạn thành công.")
async def get_my_broker_details(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker_info = await crud_brokers.get_broker_by_user_id(db, current_user.id)
    if not broker_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bạn hiện không phải là một Đối tác hoặc thông tin Đối tác không tìm thấy.",
        )
    return BrokerPublic.model_validate(broker_info)


@router.get(
    "/validate/{broker_code}",
    response_model=StandardApiResponse[BrokerValidationResponse],
    summary="[Public/User] Kiểm tra tính hợp lệ của một mã Đối tác",
    dependencies=[Depends(require_permission("broker", "validate"))],
)
@api_response_wrapper(default_success_message="Kiểm tra mã Đối tác hoàn tất.")
async def validate_broker_code(
    broker_code: str,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker = await crud_brokers.get_broker_by_code(db, broker_code)
    if broker and broker.is_active:
        user_of_broker = await db.users.find_one({"_id": ObjectId(broker.user_id)})
        broker_name = user_of_broker.get("full_name") if user_of_broker else None
        return BrokerValidationResponse(is_valid=True, broker_name=broker_name, broker_code=broker.broker_code)

    return BrokerValidationResponse(is_valid=False, broker_code=broker_code)
