# finext-fastapi/app/crud/transactions.py
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple, Set  # Đảm bảo Tuple được import

import app.crud.licenses as crud_licenses
import app.crud.subscriptions as crud_subscriptions
import app.crud.brokers as crud_brokers
import app.crud.promotions as crud_promotions
from app.crud.users import get_user_by_id_db  # Đảm bảo import này đúng
from app.schemas.licenses import LicenseInDB
from app.schemas.subscriptions import (
    SubscriptionCreate as AppSubscriptionCreateSchema,
)
from app.schemas.transactions import (
    PaymentStatusEnum,
    TransactionCreateByUser,
    TransactionCreateForAdmin,
    TransactionInDB,  # Sử dụng TransactionInDB để lấy từ DB
    TransactionTypeEnum,
    TransactionUpdateByAdmin,
    TransactionPaymentConfirmationRequest,
)
from app.schemas.users import UserInDB as AppUserInDB  # Đổi tên alias để tránh nhầm lẫn
from app.utils.types import PyObjectId
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.config import (
    BROKER_DISCOUNT_PERCENTAGE,
    PROTECTED_LICENSE_KEYS,
    PROTECTED_ROLE_NAMES,
)


logger = logging.getLogger(__name__)
TRANSACTIONS_COLLECTION = "transactions"  # Định nghĩa tên collection


async def _get_user_role_names(db: AsyncIOMotorDatabase, user_id_obj: ObjectId) -> Set[str]:
    """Hàm helper để lấy danh sách tên các role của user."""
    user_doc = await db.users.find_one({"_id": user_id_obj}, {"role_ids": 1})
    if not user_doc or not user_doc.get("role_ids"):
        return set()

    role_object_ids_from_user: List[ObjectId] = user_doc.get("role_ids", [])
    if not role_object_ids_from_user:
        return set()

    roles_cursor = db.roles.find({"_id": {"$in": role_object_ids_from_user}}, {"name": 1})
    role_names: Set[str] = set()
    async for role in roles_cursor:
        if "name" in role:
            role_names.add(role["name"])
    return role_names


async def get_transaction_by_id(db: AsyncIOMotorDatabase, transaction_id_str: PyObjectId) -> Optional[TransactionInDB]:
    if not ObjectId.is_valid(transaction_id_str):
        return None
    transaction_doc = await db[TRANSACTIONS_COLLECTION].find_one({"_id": ObjectId(transaction_id_str)})
    if transaction_doc:
        for key in ["buyer_user_id", "license_id", "target_subscription_id"]:
            if transaction_doc.get(key) and isinstance(transaction_doc[key], ObjectId):
                transaction_doc[key] = str(transaction_doc[key])
        return TransactionInDB(**transaction_doc)
    return None


async def get_transactions_by_user_id(
    db: AsyncIOMotorDatabase, user_id_str: PyObjectId, skip: int = 0, limit: int = 100
) -> List[TransactionInDB]:
    if not ObjectId.is_valid(user_id_str):
        return []
    transactions_cursor = (
        db[TRANSACTIONS_COLLECTION].find({"buyer_user_id": ObjectId(user_id_str)}).sort("created_at", -1).skip(skip).limit(limit)
    )
    transactions_docs = await transactions_cursor.to_list(length=limit)
    results = []
    for trans_doc in transactions_docs:
        for key in ["buyer_user_id", "license_id", "target_subscription_id"]:
            if trans_doc.get(key) and isinstance(trans_doc[key], ObjectId):
                trans_doc[key] = str(trans_doc[key])
        results.append(TransactionInDB(**trans_doc))
    return results


# <<<< PHẦN CẬP NHẬT HÀM get_all_transactions >>>>
async def get_all_transactions(
    db: AsyncIOMotorDatabase,
    payment_status: Optional[PaymentStatusEnum] = None,
    transaction_type: Optional[TransactionTypeEnum] = None,
    buyer_user_id_str: Optional[PyObjectId] = None,
    broker_code_applied_filter: Optional[str] = None,
    promotion_code_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[TransactionInDB], int]:  # Đảm bảo trả về List[TransactionInDB]
    query = {}
    if payment_status:
        query["payment_status"] = payment_status.value
    if transaction_type:
        query["transaction_type"] = transaction_type.value
    if buyer_user_id_str and ObjectId.is_valid(buyer_user_id_str):
        query["buyer_user_id"] = ObjectId(buyer_user_id_str)
    if broker_code_applied_filter:
        query["broker_code_applied"] = broker_code_applied_filter.upper()
    if promotion_code_filter:
        query["promotion_code_applied"] = promotion_code_filter.upper()

    total_count = await db[TRANSACTIONS_COLLECTION].count_documents(query)
    transactions_cursor = db[TRANSACTIONS_COLLECTION].find(query).sort("created_at", -1).skip(skip).limit(limit)
    transactions_docs_from_db = await transactions_cursor.to_list(length=limit)

    results: List[TransactionInDB] = []
    for trans_doc in transactions_docs_from_db:
        # Chuyển đổi ObjectId sang str cho các trường cần thiết trước khi parse Pydantic
        for key in ["buyer_user_id", "license_id", "target_subscription_id"]:
            if trans_doc.get(key) and isinstance(trans_doc[key], ObjectId):
                trans_doc[key] = str(trans_doc[key])
        results.append(TransactionInDB(**trans_doc))  # Parse bằng TransactionInDB

    return results, total_count


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


async def _prepare_transaction_data(
    db: AsyncIOMotorDatabase,
    buyer_user_id_str: PyObjectId,
    transaction_type: TransactionTypeEnum,
    license_id_for_new_purchase_str: Optional[PyObjectId],
    subscription_id_to_renew_str: Optional[PyObjectId],
    purchased_duration_days_override: Optional[int],
    input_promotion_code: Optional[str],
    input_broker_code_for_user_create: Optional[str],  # Được dùng khi user tự tạo order
    admin_broker_code_override: Optional[str],  # Được dùng khi admin cập nhật GIAO DỊCH PENDING
    notes: Optional[str],
    is_admin_update_pending: bool = False,  # Cờ để biết đây là admin đang update giao dịch PENDING
) -> dict:  # Trả về dict để insert vào DB
    # ... (logic hiện có của hàm này, không thay đổi)
    # Đảm bảo hàm này trả về dict với các ObjectId nếu trường đó là ObjectId trong DB
    # và các giá trị enum là .value
    buyer_user = await get_user_by_id_db(db, buyer_user_id_str)
    if not buyer_user:
        raise ValueError(f"Người mua với ID {buyer_user_id_str} không tồn tại.")

    if not is_admin_update_pending:
        buyer_role_names = await _get_user_role_names(db, ObjectId(buyer_user.id))
        is_buyer_admin_or_broker = any(
            role_name in PROTECTED_ROLE_NAMES for role_name in buyer_role_names if role_name in ["admin", "broker"]
        )
        if is_buyer_admin_or_broker:
            logger.warning(
                f"Tài khoản đặc biệt (vai trò: {buyer_role_names}) '{buyer_user.email}' (ID: {buyer_user_id_str}) "
                f"không được phép tự tạo giao dịch qua luồng này."
            )
            raise ValueError(f"Tài khoản {buyer_user.email} có vai trò đặc biệt không thể tự thực hiện giao dịch này. ")

    license_doc: Optional[LicenseInDB] = None
    target_subscription_id_for_renewal_obj: Optional[ObjectId] = None
    original_price_for_calc: float
    duration_for_calc: int

    if transaction_type == TransactionTypeEnum.NEW_PURCHASE:
        if not license_id_for_new_purchase_str:
            raise ValueError("license_id_for_new_purchase là bắt buộc khi mua mới.")
        license_doc = await crud_licenses.get_license_by_id(db, license_id_for_new_purchase_str)
        if not license_doc:
            raise ValueError(f"License với ID {license_id_for_new_purchase_str} không tồn tại.")
        if not license_doc.is_active:
            raise ValueError(f"License '{license_doc.key}' hiện không hoạt động, không thể tạo giao dịch.")
        original_price_for_calc = license_doc.price
        duration_for_calc = purchased_duration_days_override or license_doc.duration_days
    elif transaction_type == TransactionTypeEnum.RENEWAL:
        if not subscription_id_to_renew_str:
            raise ValueError("subscription_id_to_renew là bắt buộc khi gia hạn.")
        renewal_sub_doc = await crud_subscriptions.get_subscription_by_id_db(db, subscription_id_to_renew_str)
        if not renewal_sub_doc:
            raise ValueError(f"Subscription ID {subscription_id_to_renew_str} để gia hạn không tìm thấy.")
        if str(renewal_sub_doc.user_id) != str(buyer_user_id_str):  # So sánh str với str
            raise ValueError("Subscription gia hạn không thuộc về người mua này.")
        license_doc = await crud_licenses.get_license_by_id(db, renewal_sub_doc.license_id)  # license_id đã là str
        if not license_doc:
            raise ValueError(f"Lỗi nội bộ: License ID {renewal_sub_doc.license_id} của subscription {renewal_sub_doc.id} không tìm thấy.")
        target_subscription_id_for_renewal_obj = ObjectId(renewal_sub_doc.id)  # renewal_sub_doc.id đã là str
        original_price_for_calc = license_doc.price
        duration_for_calc = purchased_duration_days_override or license_doc.duration_days
    else:
        raise ValueError("Loại giao dịch không hợp lệ.")

    if not license_doc or not license_doc.id:  # Kiểm tra thêm license_doc.id
        raise ValueError("Không thể xác định thông tin license cho giao dịch.")

    # Broker Code Application Logic
    broker_code_to_apply_str: Optional[str] = None
    broker_discount_amount_val: float = 0.0  # Ưu tiên admin_broker_code_override nếu admin có cung cấp (tạo mới hoặc update pending)
    if admin_broker_code_override is not None:
        if admin_broker_code_override == "":  # Admin muốn xóa broker code
            broker_code_to_apply_str = None
        else:
            is_valid_override = await crud_brokers.is_broker_code_valid_and_active(db, admin_broker_code_override)
            if is_valid_override:
                broker_code_to_apply_str = admin_broker_code_override.upper()
            else:
                raise ValueError(f"Mã đối tác '{admin_broker_code_override}' do admin cung cấp không hợp lệ.")
    # Tiếp theo, nếu user tự tạo order và nhập broker code
    elif not is_admin_update_pending and input_broker_code_for_user_create:
        is_valid_input = await crud_brokers.is_broker_code_valid_and_active(db, input_broker_code_for_user_create)
        if is_valid_input:
            broker_code_to_apply_str = input_broker_code_for_user_create.upper()
        else:
            raise ValueError(f"Mã đối tác '{input_broker_code_for_user_create}' bạn nhập không hợp lệ hoặc không hoạt động.")
    # Cuối cùng, nếu không có override hoặc input, dùng referral_code từ user (nếu có và valid)
    elif buyer_user.referral_code and await crud_brokers.is_broker_code_valid_and_active(db, buyer_user.referral_code):
        broker_code_to_apply_str = buyer_user.referral_code.upper()

    if broker_code_to_apply_str and license_doc.key not in PROTECTED_LICENSE_KEYS:
        broker_discount_amount_val = round(original_price_for_calc * (BROKER_DISCOUNT_PERCENTAGE / 100), 2)
        logger.info(
            f"Áp dụng mã đối tác '{broker_code_to_apply_str}', giảm giá: {broker_discount_amount_val} cho license '{license_doc.key}'"
        )
    elif broker_code_to_apply_str:  # Mã broker được ghi nhận nhưng không giảm giá cho license protected
        logger.info(
            f"Mã đối tác '{broker_code_to_apply_str}' được ghi nhận cho giao dịch với license được bảo vệ '{license_doc.key}', không áp dụng giảm giá broker."
        )

    price_after_broker_discount = original_price_for_calc - broker_discount_amount_val
    if price_after_broker_discount < 0:
        price_after_broker_discount = 0.0

    # Promotion Code Application Logic
    applied_promo_code_str: Optional[str] = None
    promotion_discount_amount_val: float = 0.0
    if input_promotion_code:
        valid_promo_obj = await crud_promotions.is_promotion_code_valid_and_active(
            db, promotion_code=input_promotion_code, license_key_to_check=license_doc.key
        )
        if valid_promo_obj:
            applied_promo_code_str = valid_promo_obj.promotion_code  # Dùng mã đã chuẩn hóa
            if license_doc.key not in PROTECTED_LICENSE_KEYS:
                # Tính giảm giá khuyến mãi trên giá ĐÃ GIẢM bởi broker (nếu có)
                discount_val, _ = crud_promotions.calculate_discounted_amount(price_after_broker_discount, valid_promo_obj)
                promotion_discount_amount_val = discount_val
                logger.info(
                    f"Áp dụng mã khuyến mãi '{applied_promo_code_str}', giảm thêm: {promotion_discount_amount_val} cho license '{license_doc.key}' (trên giá đã có thể giảm bởi broker)."
                )
            else:  # Khuyến mãi được ghi nhận nhưng không giảm giá cho license protected
                logger.info(
                    f"Mã khuyến mãi '{applied_promo_code_str}' được ghi nhận cho giao dịch với license được bảo vệ '{license_doc.key}', không áp dụng giảm giá khuyến mãi."
                )
        elif not is_admin_update_pending:  # Nếu user tạo và mã KM không hợp lệ -> lỗi
            raise ValueError(f"Mã khuyến mãi '{input_promotion_code}' không hợp lệ hoặc không thể áp dụng cho đơn hàng này.")
        # Nếu admin update pending và mã KM không hợp lệ -> bỏ qua, không áp dụng KM

    total_discount_val = round(broker_discount_amount_val + promotion_discount_amount_val, 2)
    final_transaction_amount_calc = round(original_price_for_calc - total_discount_val, 2)
    if final_transaction_amount_calc < 0:
        final_transaction_amount_calc = 0.0
        total_discount_val = original_price_for_calc  # Giảm giá tối đa bằng giá gốc

    dt_now = datetime.now(timezone.utc)
    return {
        "buyer_user_id": ObjectId(buyer_user_id_str),  # Lưu ObjectId
        "license_id": ObjectId(license_doc.id),  # Lưu ObjectId
        "license_key": license_doc.key,
        "original_license_price": original_price_for_calc,
        "purchased_duration_days": duration_for_calc,
        "promotion_code_applied": applied_promo_code_str,
        "promotion_discount_amount": promotion_discount_amount_val if applied_promo_code_str else None,
        "broker_code_applied": broker_code_to_apply_str,
        "broker_discount_amount": broker_discount_amount_val if broker_code_to_apply_str else None,
        "total_discount_amount": total_discount_val if (broker_code_to_apply_str or applied_promo_code_str) else None,
        "transaction_amount": final_transaction_amount_calc,
        "payment_status": PaymentStatusEnum.PENDING.value,
        "transaction_type": transaction_type.value,
        "notes": notes,
        "target_subscription_id": target_subscription_id_for_renewal_obj,  # Đây là ObjectId hoặc None
        "created_at": dt_now,
        "updated_at": dt_now,
    }


# ... (các hàm CRUD khác như create_transaction_for_admin_db, create_transaction_by_user_db,
# update_transaction_details_db, confirm_transaction_payment_db, cancel_transaction_db
# cần được giữ nguyên logic nhưng đảm bảo các ObjectId được xử lý đúng khi tương tác với DB
# và khi chuẩn bị dữ liệu cho Pydantic models thì chuyển lại thành str nếu cần)
async def create_transaction_for_admin_db(
    db: AsyncIOMotorDatabase, transaction_create_data: TransactionCreateForAdmin
) -> Optional[TransactionInDB]:
    try:
        prepared_data = await _prepare_transaction_data(
            db=db,
            buyer_user_id_str=transaction_create_data.buyer_user_id,
            transaction_type=transaction_create_data.transaction_type,
            license_id_for_new_purchase_str=transaction_create_data.license_id_for_new_purchase,
            subscription_id_to_renew_str=transaction_create_data.subscription_id_to_renew,
            purchased_duration_days_override=transaction_create_data.purchased_duration_days,
            input_promotion_code=transaction_create_data.promotion_code,
            input_broker_code_for_user_create=None,  # Admin không dùng tham số này
            admin_broker_code_override=transaction_create_data.broker_code,  # Sử dụng broker_code từ admin
            notes=transaction_create_data.notes,
            is_admin_update_pending=False,
        )

        insert_result = await db[TRANSACTIONS_COLLECTION].insert_one(prepared_data)
        if insert_result.inserted_id:
            return await get_transaction_by_id(db, str(insert_result.inserted_id))
        logger.error(f"Admin creating transaction: Failed to insert prepared data for user: {transaction_create_data.buyer_user_id}")
        raise ValueError("Không thể lưu giao dịch vào cơ sở dữ liệu sau khi chuẩn bị dữ liệu.")
    except ValueError as ve:
        logger.error(f"Lỗi logic khi admin tạo giao dịch cho user {transaction_create_data.buyer_user_id}: {ve}", exc_info=False)
        raise
    except Exception as e:
        logger.error(
            f"Admin creating transaction: Unexpected error for {transaction_create_data.buyer_user_id}: {e}",
            exc_info=True,
        )
        raise ValueError(f"Lỗi máy chủ không mong muốn khi tạo giao dịch: {str(e)}")


async def create_transaction_by_user_db(
    db: AsyncIOMotorDatabase,
    transaction_data: TransactionCreateByUser,
    current_user: AppUserInDB,
) -> Optional[TransactionInDB]:
    try:
        prepared_data = await _prepare_transaction_data(
            db=db,
            buyer_user_id_str=str(current_user.id),
            transaction_type=transaction_data.transaction_type,
            license_id_for_new_purchase_str=transaction_data.license_id_for_new_purchase,
            subscription_id_to_renew_str=transaction_data.subscription_id_to_renew,
            purchased_duration_days_override=None,  # User không override duration khi tự tạo
            input_promotion_code=transaction_data.promotion_code,
            input_broker_code_for_user_create=transaction_data.broker_code,
            admin_broker_code_override=None,  # Không có override ở đây
            notes=transaction_data.user_notes,
            is_admin_update_pending=False,
        )

        insert_result = await db[TRANSACTIONS_COLLECTION].insert_one(prepared_data)
        if insert_result.inserted_id:
            return await get_transaction_by_id(db, str(insert_result.inserted_id))
        logger.error(f"User creating transaction: Failed to insert prepared data for user: {current_user.email}")
        raise ValueError("Không thể lưu đơn hàng của bạn vào cơ sở dữ liệu sau khi chuẩn bị dữ liệu.")
    except ValueError as ve:
        logger.error(f"Lỗi logic khi user {current_user.email} tạo giao dịch: {ve}", exc_info=False)
        raise
    except Exception as e:
        logger.error(
            f"User creating transaction: Unexpected error for {current_user.email}: {e}",
            exc_info=True,
        )
        raise ValueError(f"Lỗi máy chủ không mong muốn khi tạo đơn hàng: {str(e)}")


async def update_transaction_details_db(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
    update_data_admin: TransactionUpdateByAdmin,
) -> Optional[TransactionInDB]:
    original_transaction = await get_transaction_by_id(db, transaction_id_str)
    if not original_transaction:
        raise ValueError(f"Giao dịch với ID {transaction_id_str} không tồn tại.")

    if original_transaction.payment_status != PaymentStatusEnum.PENDING:
        raise ValueError("Chỉ có thể cập nhật chi tiết các giao dịch đang chờ xử lý (pending).")

    try:
        # Sử dụng original_transaction.buyer_user_id (đã là str)
        # Sử dụng original_transaction.license_id (đã là str)
        # Sử dụng original_transaction.target_subscription_id (đã là str hoặc None)
        new_prepared_data = await _prepare_transaction_data(
            db=db,
            buyer_user_id_str=original_transaction.buyer_user_id,
            transaction_type=original_transaction.transaction_type,
            license_id_for_new_purchase_str=original_transaction.license_id
            if original_transaction.transaction_type == TransactionTypeEnum.NEW_PURCHASE
            else None,
            subscription_id_to_renew_str=original_transaction.target_subscription_id
            if original_transaction.transaction_type == TransactionTypeEnum.RENEWAL
            else None,
            purchased_duration_days_override=update_data_admin.purchased_duration_days
            if update_data_admin.purchased_duration_days is not None
            else original_transaction.purchased_duration_days,
            input_promotion_code=update_data_admin.promotion_code
            if update_data_admin.promotion_code is not None  # Cho phép admin xóa promo bằng cách gửi ""
            else original_transaction.promotion_code_applied,
            input_broker_code_for_user_create=None,  # User không tạo ở bước này
            admin_broker_code_override=update_data_admin.broker_code_applied_override,  # Admin có thể override
            notes=update_data_admin.notes if update_data_admin.notes is not None else original_transaction.notes,
            is_admin_update_pending=True,  # Đánh dấu đây là admin update giao dịch PENDING
        )
    except ValueError as ve:
        raise ve  # Re-raise lỗi validation từ _prepare_transaction_data

    # Chỉ lấy các trường cần thiết từ new_prepared_data để cập nhật
    update_fields_for_db = {
        "purchased_duration_days": new_prepared_data["purchased_duration_days"],
        "original_license_price": new_prepared_data[
            "original_license_price"
        ],  # Giá gốc có thể thay đổi nếu license_id thay đổi (ít xảy ra)
        "promotion_code_applied": new_prepared_data["promotion_code_applied"],
        "promotion_discount_amount": new_prepared_data["promotion_discount_amount"],
        "broker_code_applied": new_prepared_data["broker_code_applied"],
        "broker_discount_amount": new_prepared_data["broker_discount_amount"],
        "total_discount_amount": new_prepared_data["total_discount_amount"],
        "transaction_amount": new_prepared_data["transaction_amount"],
        "notes": new_prepared_data["notes"],
        "updated_at": datetime.now(timezone.utc),  # Luôn cập nhật updated_at
    }

    # Không nên cho phép thay đổi license_id, license_key, buyer_user_id, transaction_type, target_subscription_id
    # của một giao dịch PENDING thông qua endpoint này. _prepare_transaction_data sẽ lấy lại chúng.

    updated_result = await db[TRANSACTIONS_COLLECTION].update_one({"_id": ObjectId(transaction_id_str)}, {"$set": update_fields_for_db})

    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)

    # Nếu không match (ví dụ transaction_id không tìm thấy khi update)
    logger.error(f"Không tìm thấy transaction {transaction_id_str} để cập nhật chi tiết bởi admin.")
    raise ValueError(f"Không thể cập nhật giao dịch {transaction_id_str} sau khi chuẩn bị dữ liệu.")


async def confirm_transaction_payment_db(
    db: AsyncIOMotorDatabase, transaction_id_str: PyObjectId, confirmation_request: TransactionPaymentConfirmationRequest
) -> Optional[TransactionInDB]:
    transaction = await get_transaction_by_id(db, transaction_id_str)  # Hàm này đã trả về TransactionInDB
    if not transaction:
        raise ValueError(f"Giao dịch với ID {transaction_id_str} không tồn tại.")

    if transaction.payment_status != PaymentStatusEnum.PENDING:
        raise ValueError(f"Giao dịch không ở trạng thái chờ xử lý. Trạng thái hiện tại: {transaction.payment_status.value}")

    dt_now = datetime.now(timezone.utc)
    update_fields_for_transaction = {
        "payment_status": PaymentStatusEnum.SUCCEEDED.value,
        "updated_at": dt_now,
    }

    if confirmation_request.final_transaction_amount_override is not None:
        if confirmation_request.final_transaction_amount_override < 0:
            raise ValueError("Số tiền giao dịch ghi đè không thể âm.")
        current_transaction_amount_in_db = transaction.transaction_amount
        if confirmation_request.final_transaction_amount_override != current_transaction_amount_in_db:
            update_fields_for_transaction["transaction_amount"] = confirmation_request.final_transaction_amount_override
            logger.info(
                f"Admin ghi đè số tiền giao dịch {transaction_id_str} từ {current_transaction_amount_in_db} thành: {confirmation_request.final_transaction_amount_override}"
            )

    if confirmation_request.duration_days_override is not None:
        if confirmation_request.duration_days_override <= 0:
            raise ValueError("Số ngày gia hạn ghi đè phải lớn hơn 0.")
        current_duration_days_in_db = transaction.purchased_duration_days
        if confirmation_request.duration_days_override != current_duration_days_in_db:
            update_fields_for_transaction["purchased_duration_days"] = confirmation_request.duration_days_override
            logger.info(
                f"Admin ghi đè số ngày gia hạn giao dịch {transaction_id_str} từ {current_duration_days_in_db} thành: {confirmation_request.duration_days_override}"
            )

    if confirmation_request.admin_notes:
        existing_notes = transaction.notes or ""
        update_fields_for_transaction["notes"] = (
            f"{existing_notes}\n[Admin xác nhận: {dt_now.strftime('%Y-%m-%d %H:%M')}] {confirmation_request.admin_notes}".strip()
        )

    newly_created_or_updated_sub_id: Optional[ObjectId] = None  # transaction.license_id đã là str từ get_transaction_by_id
    license_of_transaction = await crud_licenses.get_license_by_id(db, transaction.license_id)
    if not license_of_transaction or not license_of_transaction.id:
        raise ValueError(f"Không tìm thấy license (ID: {transaction.license_id}) của giao dịch {transaction.id}")

    if transaction.transaction_type == TransactionTypeEnum.NEW_PURCHASE:
        sub_create_payload = AppSubscriptionCreateSchema(  # user_id và license_id cần là PyObjectId (str)
            user_id=transaction.buyer_user_id,
            license_key=transaction.license_key,  # Dùng license_key từ transaction
            duration_override_days=confirmation_request.duration_days_override or transaction.purchased_duration_days,
        )
        created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_payload)
        if not created_sub or not created_sub.id:
            raise Exception(f"Không thể tạo subscription mới cho giao dịch {transaction.id} với license key '{transaction.license_key}'.")
        newly_created_or_updated_sub_id = ObjectId(created_sub.id)  # created_sub.id là str
        update_fields_for_transaction["target_subscription_id"] = newly_created_or_updated_sub_id

    elif transaction.transaction_type == TransactionTypeEnum.RENEWAL:
        if not transaction.target_subscription_id:
            raise Exception(f"Giao dịch gia hạn {transaction.id} thiếu target_subscription_id.")

        renewal_target_sub_id_str = str(transaction.target_subscription_id)  # Đảm bảo là str
        if not ObjectId.is_valid(renewal_target_sub_id_str):
            raise Exception("target_subscription_id không hợp lệ cho gia hạn.")

        target_sub_to_renew = await crud_subscriptions.get_subscription_by_id_db(db, renewal_target_sub_id_str)
        if not target_sub_to_renew or not target_sub_to_renew.id:
            raise Exception(f"Subscription đích {renewal_target_sub_id_str} để gia hạn không tìm thấy.")

        if target_sub_to_renew.license_key != transaction.license_key:
            raise ValueError(
                f"Không thể gia hạn subscription '{target_sub_to_renew.license_key}' "
                f"bằng giao dịch cho license '{transaction.license_key}'."
            )

        # transaction.buyer_user_id đã là str
        user_obj_id_for_renewal = ObjectId(transaction.buyer_user_id)
        sub_obj_id_for_renewal = ObjectId(target_sub_to_renew.id)

        if target_sub_to_renew.license_key not in PROTECTED_LICENSE_KEYS:
            await crud_subscriptions.deactivate_all_active_subscriptions_for_user(
                db, user_obj_id_for_renewal, exclude_sub_id=sub_obj_id_for_renewal
            )

        start_renewal_from = target_sub_to_renew.expiry_date
        if start_renewal_from < dt_now:  # Nếu sub đã hết hạn, bắt đầu gia hạn từ bây giờ
            start_renewal_from = dt_now

        # Sử dụng duration_days_override nếu có, nếu không thì dùng purchased_duration_days từ transaction
        duration_days_to_use = confirmation_request.duration_days_override or transaction.purchased_duration_days
        new_expiry_date = start_renewal_from + timedelta(days=duration_days_to_use)

        updated_sub_result = await db.subscriptions.update_one(
            {"_id": sub_obj_id_for_renewal},
            {
                "$set": {
                    "expiry_date": new_expiry_date,
                    "start_date": start_renewal_from if start_renewal_from == dt_now else target_sub_to_renew.start_date,
                    "updated_at": dt_now,
                    "is_active": True,
                }
            },
        )
        if updated_sub_result.modified_count == 0 and updated_sub_result.matched_count == 0:
            raise Exception(f"Không thể cập nhật subscription {renewal_target_sub_id_str} khi gia hạn.")
        newly_created_or_updated_sub_id = sub_obj_id_for_renewal

    # Cập nhật user.subscription_id
    if newly_created_or_updated_sub_id:
        await db.users.update_one(
            {"_id": ObjectId(transaction.buyer_user_id)},  # transaction.buyer_user_id đã là str
            {"$set": {"subscription_id": newly_created_or_updated_sub_id, "updated_at": dt_now}},
        )

    # Tăng usage_count cho promotion nếu có và license không phải là protected
    if transaction.promotion_code_applied and license_of_transaction.key not in PROTECTED_LICENSE_KEYS:
        await crud_promotions.increment_promotion_usage(db, transaction.promotion_code_applied)
        logger.info(f"Đã tăng lượt sử dụng cho mã khuyến mãi '{transaction.promotion_code_applied}' của giao dịch {transaction_id_str}.")

    updated_result = await db[TRANSACTIONS_COLLECTION].update_one(
        {"_id": ObjectId(transaction_id_str)}, {"$set": update_fields_for_transaction}
    )

    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)

    # Lỗi này không nên xảy ra nếu logic đúng
    raise ValueError(f"Lỗi nghiêm trọng: Không thể cập nhật trạng thái giao dịch {transaction_id_str} sau khi xử lý logic.")


async def cancel_transaction_db(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
) -> Optional[TransactionInDB]:
    transaction = await get_transaction_by_id(db, transaction_id_str)
    if not transaction:
        raise ValueError(f"Giao dịch với ID {transaction_id_str} không tồn tại.")

    if transaction.payment_status != PaymentStatusEnum.PENDING:
        raise ValueError(f"Chỉ giao dịch đang chờ xử lý mới có thể hủy. Trạng thái hiện tại: {transaction.payment_status.value}")

    dt_now = datetime.now(timezone.utc)
    update_fields = {
        "payment_status": PaymentStatusEnum.CANCELED.value,
        "updated_at": dt_now,
    }
    updated_result = await db[TRANSACTIONS_COLLECTION].update_one({"_id": ObjectId(transaction_id_str)}, {"$set": update_fields})
    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)
    return None  # Hoặc raise lỗi nếu không tìm thấy khi update
