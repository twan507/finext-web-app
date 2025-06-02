# finext-fastapi/app/routers/brokers.py
import logging
from typing import Optional

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
# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse # Import schema phân trang
# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.subscriptions import (
    SubscriptionCreate as AppSubscriptionCreateSchema,
    SubscriptionInDB,
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.core.config import BROKER_EMAIL_1, BROKER_EMAIL_2 


logger = logging.getLogger(__name__)
router = APIRouter(tags=["brokers"]) # Prefix đã bị xóa, sẽ được thêm ở main.py


@router.post(
    "/", # Sẽ là /api/v1/brokers/
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
        broker_record = await crud_brokers.create_or_reactivate_broker_for_user(db, user_id=broker_create_data.user_id)

        if not broker_record or not broker_record.id or not broker_record.broker_code:
            # Lỗi này thường do ValueError từ CRUD (user không tồn tại) hoặc lỗi DB không mong muốn
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Hoặc 400 nếu lỗi từ input
                detail="Không thể tạo hoặc kích hoạt bản ghi Đối tác.",
            )

        user_id_for_broker = broker_create_data.user_id # Đây là PyObjectId (str)

        broker_role = await db.roles.find_one({"name": "broker"})
        if not broker_role or not broker_role.get("_id"):
            logger.error("Vai trò 'broker' không được tìm thấy trong hệ thống.")
            if broker_record and broker_record.id: 
                await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi cấu hình hệ thống: Vai trò 'broker' không tồn tại.",
            )
        
        # crud_users.assign_roles_to_user mong đợi user_id_str là PyObjectId (str)
        await crud_users.assign_roles_to_user(db, user_id_for_broker, [str(broker_role["_id"])])
        logger.info(f"Đã đảm bảo user ID: {user_id_for_broker} có vai trò 'broker'.")

        # Gán license PARTNER
        partner_sub: Optional[SubscriptionInDB] = None
        existing_inactive_partner_sub = await crud_subscriptions.find_inactive_partner_subscription_for_user(db, user_id_for_broker)

        if existing_inactive_partner_sub and existing_inactive_partner_sub.id:
            logger.info(
                f"Tìm thấy inactive 'PARTNER' subscription (ID: {existing_inactive_partner_sub.id}) cho user {user_id_for_broker}. Sẽ kích hoạt lại."
            )
            partner_sub = await crud_subscriptions.activate_specific_subscription_for_user(
                db,
                user_id_str=user_id_for_broker,
                subscription_id_to_activate_str=existing_inactive_partner_sub.id,
            )
            if partner_sub:
                logger.info(f"Đã kích hoạt lại 'PARTNER' subscription (ID: {partner_sub.id}) cho user ID: {user_id_for_broker}")

        if not partner_sub: # Nếu không có sub inactive để kích hoạt lại, hoặc kích hoạt lại thất bại
            logger.info(f"Sẽ tạo mới 'PARTNER' subscription cho user {user_id_for_broker}.")
            partner_license_sub_create = AppSubscriptionCreateSchema(
                user_id=user_id_for_broker, 
                license_key="PARTNER", # Key mặc định cho partner
                duration_override_days=None, # Sử dụng duration mặc định từ license
            )
            partner_sub = await crud_subscriptions.create_subscription_db(db, partner_license_sub_create)

        if not partner_sub: # Nếu cả kích hoạt lại và tạo mới đều thất bại
            logger.error(f"Không thể gán hoặc kích hoạt license 'PARTNER' cho user ID: {user_id_for_broker}.")
            if broker_record and broker_record.id: 
                await crud_users.revoke_roles_from_user(db, user_id_for_broker, [str(broker_role["_id"])])
                await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể gán/kích hoạt license 'PARTNER'. Vui lòng kiểm tra cấu hình license 'PARTNER'.",
            )
        logger.info(f"Đã đảm bảo user ID: {user_id_for_broker} có license 'PARTNER' (Sub ID: {partner_sub.id}).")

        # Lấy lại thông tin broker sau tất cả các cập nhật
        final_broker_record = await crud_brokers.get_broker_by_id(db, str(broker_record.id))
        if not final_broker_record: # Không nên xảy ra
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể lấy thông tin broker sau khi cập nhật."
            )

        return BrokerPublic.model_validate(final_broker_record)
    except ValueError as ve: # Bắt lỗi từ CRUD (ví dụ user không tồn tại)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e: # Bắt các lỗi không mong muốn khác
        logger.error(f"Lỗi không mong muốn khi tạo/kích hoạt Đối tác cho user {broker_create_data.user_id}: {e}", exc_info=True)
        # Cố gắng rollback nếu có thể
        if "broker_record" in locals() and broker_record and hasattr(broker_record, "id") and broker_record.id:
            try:
                await crud_brokers.update_broker_status(db, str(broker_record.id), is_active=False)
            except Exception as rollback_e:
                logger.error(f"Lỗi khi rollback trạng thái broker: {rollback_e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Lỗi máy chủ nội bộ khi tạo/kích hoạt đối tác: {str(e)}"
        )

# <<<< PHẦN CẬP NHẬT ENDPOINT LIST ALL BROKERS >>>>
@router.get(
    "/",
    response_model=StandardApiResponse[PaginatedResponse[BrokerPublic]], # SỬA RESPONSE MODEL
    summary="[Admin] Lấy danh sách tất cả Đối tác",
    dependencies=[Depends(require_permission("broker", "list"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách Đối tác thành công.")
async def list_all_brokers(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=200, description="Số lượng bản ghi tối đa trả về"),
    # Thêm các filter nếu cần, ví dụ:
    # user_id_filter: Optional[PyObjectId] = Query(None, description="Lọc theo User ID của Broker"),
    # broker_code_filter: Optional[str] = Query(None, description="Lọc theo Broker Code"),
    # is_active_filter: Optional[bool] = Query(None, description="Lọc theo trạng thái active"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    brokers_docs, total_count = await crud_brokers.get_brokers(
        db, 
        skip=skip, 
        limit=limit,
        # user_id_filter=user_id_filter, # Truyền các filter nếu có
        # broker_code_filter=broker_code_filter,
        # is_active_filter=is_active_filter,
    )
    
    items = [BrokerPublic.model_validate(b) for b in brokers_docs]
    return PaginatedResponse[BrokerPublic](items=items, total=total_count)
# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>

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

    if not broker: # Nếu không tìm thấy bằng ID hoặc ID không valid, thử tìm bằng code
        broker = await crud_brokers.get_broker_by_code(db, broker_id_or_code)

    if not broker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Đối tác với ID hoặc mã: '{broker_id_or_code}'.",
        )
    return BrokerPublic.model_validate(broker)


@router.put(
    "/{broker_id_or_code}", # Endpoint này dùng để cập nhật trạng thái is_active
    response_model=StandardApiResponse[BrokerPublic],
    summary="[Admin] Cập nhật trạng thái (is_active) của một Đối tác",
    dependencies=[Depends(require_permission("broker", "update_any"))],
)
@api_response_wrapper(default_success_message="Cập nhật trạng thái Đối tác thành công.")
async def update_broker_active_status(
    broker_id_or_code: str,
    broker_update_data: BrokerUpdate, # Chỉ chứa is_active
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(
        f"Admin {current_admin.email} yêu cầu cập nhật trạng thái cho broker '{broker_id_or_code}' thành is_active={broker_update_data.is_active}"
    )
    if broker_update_data.is_active is None: # is_active là bắt buộc trong BrokerUpdate
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
    except ValueError as ve: # Bắt lỗi từ CRUD (ví dụ: không cho deactive broker được bảo vệ)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(ve))

# Endpoint DELETE này có thể được coi là "Hủy tư cách đối tác" thay vì xóa hẳn record
# Nó sẽ set is_active=False và thu hồi các quyền lợi liên quan
# Frontend có thể gọi endpoint PUT ở trên với is_active=False cho hành động "Xóa/Deactivate"
# Nếu bạn muốn một endpoint DELETE thực sự xóa record broker (nguy hiểm), thì cần logic khác.
# Hiện tại, tôi giữ logic "xóa" tương đương với "hủy kích hoạt" như đã làm.
@router.delete( # Router này trong file gốc không có PUT, chỉ có POST, GET, DELETE. Sửa lại thành delete
    "/{broker_id_or_code}", # Sửa: Thường DELETE dùng để xóa hẳn, PUT để cập nhật.
                            # Nếu ý đồ là "hủy tư cách đối tác" thì có thể giữ PUT và đổi tên endpoint
                            # Hoặc dùng DELETE và CRUD sẽ xử lý logic is_active=False và thu hồi quyền
    response_model=StandardApiResponse[None], # Trả về None nếu thành công
    status_code=status.HTTP_200_OK,
    summary="[Admin] Hủy tư cách Đối tác (set is_active=False và thu hồi quyền lợi)",
    dependencies=[Depends(require_permission("broker", "delete_any"))], # "delete_any" cho hành động này
)
@api_response_wrapper(
    default_success_message="Đối tác đã được hủy kích hoạt và các quyền lợi liên quan đã được xử lý.", 
    success_status_code=status.HTTP_200_OK
)
async def deactivate_and_revoke_broker( # Đổi tên hàm cho rõ nghĩa
    broker_id_or_code: str,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),
):
    logger.info(f"Admin {current_admin.email} yêu cầu hủy tư cách broker: {broker_id_or_code}")

    broker_to_deactivate: Optional[BrokerInDB] = None
    if ObjectId.is_valid(broker_id_or_code):
        broker_to_deactivate = await crud_brokers.get_broker_by_id(db, broker_id_or_code)
    if not broker_to_deactivate:
        broker_to_deactivate = await crud_brokers.get_broker_by_code(db, broker_id_or_code)

    if not broker_to_deactivate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Đối tác với ID hoặc mã '{broker_id_or_code}' để hủy tư cách.",
        )

    # Kiểm tra xem broker này có phải là broker được bảo vệ không
    user_of_broker = await crud_users.get_user_by_id_db(db, str(broker_to_deactivate.user_id))
    if user_of_broker and user_of_broker.email in [BROKER_EMAIL_1, BROKER_EMAIL_2]:
        logger.warning(f"Attempt to deactivate (delete) protected broker: {user_of_broker.email}. Denied.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Không thể hủy tư cách đối tác mặc định '{user_of_broker.email}'.",
        )

    if not broker_to_deactivate.is_active:
        logger.info(f"Broker {broker_id_or_code} đã ở trạng thái inactive. Không cần xử lý thêm.")
        # Vẫn trả về success vì mục tiêu là broker không active
        return None 

    user_id_of_broker_str = str(broker_to_deactivate.user_id)

    # 1. Thu hồi vai trò "broker"
    broker_role = await db.roles.find_one({"name": "broker"})
    if broker_role and broker_role.get("_id"):
        await crud_users.revoke_roles_from_user(db, user_id_of_broker_str, [str(broker_role["_id"])])
        logger.info(f"Đã thu hồi vai trò 'broker' từ user ID: {user_id_of_broker_str}")
    else:
        logger.warning("Không tìm thấy vai trò 'broker' để thu hồi khi hủy tư cách đối tác.")

    # 2. Hủy kích hoạt subscription "PARTNER"
    partner_license = await crud_licenses.get_license_by_key(db, "PARTNER")
    if partner_license and partner_license.id:
        partner_subs_cursor = db.subscriptions.find(
            {
                "user_id": ObjectId(user_id_of_broker_str),
                "license_id": ObjectId(str(partner_license.id)),
                "is_active": True, # Chỉ hủy các sub PARTNER đang active
            }
        )
        async for sub_doc in partner_subs_cursor:
            try:
                # deactivate_subscription_db sẽ KHÔNG tự động gán FREE sub nếu license là PARTNER (vì PARTNER là protected)
                # nhưng nó sẽ set is_active=False cho sub PARTNER này.
                await crud_subscriptions.deactivate_subscription_db(db, str(sub_doc["_id"]))
                logger.info(f"Đã hủy kích hoạt subscription 'PARTNER' (ID: {str(sub_doc['_id'])}) cho user ID: {user_id_of_broker_str}.")
            except ValueError as e: # Bắt lỗi nếu cố hủy sub được bảo vệ (không nên xảy ra nếu logic đúng)
                logger.error(f"Lỗi khi hủy kích hoạt PARTNER sub {str(sub_doc['_id'])} cho broker {broker_id_or_code}: {e}")
    
    # 3. Cập nhật trạng thái is_active=False cho bản ghi broker và xóa referral_code của user
    try:
        # update_broker_status đã bao gồm logic xóa referral_code
        deactivated_broker_record = await crud_brokers.update_broker_status(db, broker_id_or_code, is_active=False)
        if not deactivated_broker_record:
            # Lỗi này có thể do broker_id_or_code không tìm thấy ở bước cuối (không nên xảy ra)
            logger.error(f"Hủy kích hoạt bản ghi broker '{broker_id_or_code}' thất bại ở bước cuối.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể hoàn tất việc hủy tư cách Đối tác.",
            )
        logger.info(f"Đã hủy kích hoạt bản ghi broker: {broker_id_or_code} và xử lý referral code của user liên quan.")
    except ValueError as ve: # Bắt lỗi từ update_broker_status (ví dụ broker được bảo vệ)
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
    broker_info = await crud_brokers.get_broker_by_user_id(db, current_user.id) # type: ignore
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
async def validate_broker_code( # Đổi tên hàm
    broker_code: str,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker = await crud_brokers.get_broker_by_code(db, broker_code)
    if broker and broker.is_active:
        user_of_broker = await db.users.find_one({"_id": ObjectId(broker.user_id)}) # broker.user_id đã là ObjectId
        broker_name = user_of_broker.get("full_name") if user_of_broker else None
        return BrokerValidationResponse(is_valid=True, broker_name=broker_name, broker_code=broker.broker_code)

    return BrokerValidationResponse(is_valid=False, broker_code=broker_code.upper())