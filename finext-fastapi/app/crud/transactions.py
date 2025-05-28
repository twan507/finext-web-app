# finext-fastapi/app/crud/transactions.py
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import app.crud.licenses as crud_licenses
import app.crud.subscriptions as crud_subscriptions
from app.crud.users import get_user_by_id_db
from app.schemas.licenses import LicenseInDB
from app.schemas.subscriptions import (
    SubscriptionCreate as AppSubscriptionCreateSchema,
)
from app.schemas.subscriptions import (
    SubscriptionInDB as AppSubscriptionInDB,
)
from app.schemas.transactions import (
    PaymentStatusEnum,
    TransactionCreateByUser,  # Schema mới
    TransactionCreateForAdmin,  # Đổi tên
    TransactionInDB,
    TransactionTypeEnum,
    TransactionUpdateByAdmin,
)
from app.schemas.users import (
    UserInDB as AppUserInDB,
)  # Thêm để type hint cho current_user
from app.utils.types import PyObjectId
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def get_transaction_by_id(
    db: AsyncIOMotorDatabase, transaction_id_str: PyObjectId
) -> Optional[TransactionInDB]:
    if not ObjectId.is_valid(transaction_id_str):
        return None
    transaction_doc = await db.transactions.find_one(
        {"_id": ObjectId(transaction_id_str)}
    )
    if transaction_doc:
        # Cần đảm bảo các ObjectId con (nếu có) được chuyển đổi đúng khi khởi tạo TransactionInDB
        if transaction_doc.get("buyer_user_id"):
            transaction_doc["buyer_user_id"] = str(transaction_doc["buyer_user_id"])
        if transaction_doc.get("license_id"):
            transaction_doc["license_id"] = str(transaction_doc["license_id"])
        if transaction_doc.get("target_subscription_id"):
            transaction_doc["target_subscription_id"] = str(
                transaction_doc["target_subscription_id"]
            )
        return TransactionInDB(**transaction_doc)
    return None


async def get_transactions_by_user_id(
    db: AsyncIOMotorDatabase, user_id_str: PyObjectId, skip: int = 0, limit: int = 100
) -> List[TransactionInDB]:
    if not ObjectId.is_valid(user_id_str):
        return []

    transactions_cursor = (
        db.transactions.find({"buyer_user_id": ObjectId(user_id_str)})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    transactions_docs = await transactions_cursor.to_list(length=limit)

    results = []
    for trans_doc in transactions_docs:
        if trans_doc.get("buyer_user_id"):
            trans_doc["buyer_user_id"] = str(trans_doc["buyer_user_id"])
        if trans_doc.get("license_id"):
            trans_doc["license_id"] = str(trans_doc["license_id"])
        if trans_doc.get("target_subscription_id"):
            trans_doc["target_subscription_id"] = str(
                trans_doc["target_subscription_id"]
            )
        results.append(TransactionInDB(**trans_doc))
    return results


async def get_all_transactions(
    db: AsyncIOMotorDatabase,
    payment_status: Optional[PaymentStatusEnum] = None,
    transaction_type: Optional[TransactionTypeEnum] = None,
    buyer_user_id_str: Optional[PyObjectId] = None,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[TransactionInDB], int]:
    query_filter = {}
    if payment_status:
        query_filter["payment_status"] = payment_status.value
    if transaction_type:
        query_filter["transaction_type"] = transaction_type.value
    if buyer_user_id_str and ObjectId.is_valid(buyer_user_id_str):
        query_filter["buyer_user_id"] = ObjectId(buyer_user_id_str)

    total_count = await db.transactions.count_documents(query_filter)

    transactions_cursor = (
        db.transactions.find(query_filter)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    transactions_docs = await transactions_cursor.to_list(length=limit)

    results = []
    for trans_doc in transactions_docs:
        if trans_doc.get("buyer_user_id"):
            trans_doc["buyer_user_id"] = str(trans_doc["buyer_user_id"])
        if trans_doc.get("license_id"):
            trans_doc["license_id"] = str(trans_doc["license_id"])
        if trans_doc.get("target_subscription_id"):
            trans_doc["target_subscription_id"] = str(
                trans_doc["target_subscription_id"]
            )
        results.append(TransactionInDB(**trans_doc))
    return results, total_count


async def create_transaction_for_admin_db(
    db: AsyncIOMotorDatabase, transaction_create_data: TransactionCreateForAdmin
) -> Optional[TransactionInDB]:  # Đổi tên hàm
    buyer_user = await get_user_by_id_db(db, transaction_create_data.buyer_user_id)
    if not buyer_user:
        logger.error(
            f"Admin creating transaction: Buyer user with ID {transaction_create_data.buyer_user_id} not found."
        )
        raise ValueError(
            f"Buyer user with ID {transaction_create_data.buyer_user_id} not found."
        )

    license_doc: Optional[LicenseInDB] = None
    target_subscription_id_for_renewal: Optional[PyObjectId] = None  # Đây là string ID

    if transaction_create_data.transaction_type == TransactionTypeEnum.new_purchase:
        if not transaction_create_data.license_id_for_new_purchase:
            raise ValueError(
                "license_id_for_new_purchase is required for new_purchase by admin."
            )
        license_doc = await crud_licenses.get_license_by_id(
            db, transaction_create_data.license_id_for_new_purchase
        )
        if not license_doc:
            logger.error(
                f"Admin creating transaction: License with ID {transaction_create_data.license_id_for_new_purchase} not found."
            )
            raise ValueError(
                f"License with ID {transaction_create_data.license_id_for_new_purchase} not found."
            )

    elif transaction_create_data.transaction_type == TransactionTypeEnum.renewal:
        if not transaction_create_data.subscription_id_to_renew:
            raise ValueError(
                "subscription_id_to_renew is required for renewal by admin."
            )

        renewal_sub_doc = await crud_subscriptions.get_subscription_by_id_db(
            db, transaction_create_data.subscription_id_to_renew
        )
        if not renewal_sub_doc:
            logger.error(
                f"Admin creating transaction: Subscription to renew ID {transaction_create_data.subscription_id_to_renew} not found."
            )
            raise ValueError(
                f"Subscription to renew ID {transaction_create_data.subscription_id_to_renew} not found."
            )

        if str(renewal_sub_doc.user_id) != str(transaction_create_data.buyer_user_id):
            logger.error(
                f"Admin creating transaction: Subscription {renewal_sub_doc.id} does not belong to buyer {transaction_create_data.buyer_user_id}."
            )
            raise ValueError("Subscription to renew does not belong to the buyer.")

        if not renewal_sub_doc.is_active:
            logger.error(
                f"Admin creating transaction: Subscription {renewal_sub_doc.id} is not active."
            )
            raise ValueError("Subscription to renew is not active.")

        license_doc = await crud_licenses.get_license_by_id(
            db, renewal_sub_doc.license_id
        )
        if not license_doc:
            logger.error(
                f"Admin creating transaction: License for subscription {renewal_sub_doc.id} (License ID: {renewal_sub_doc.license_id}) not found."
            )
            raise ValueError(
                "Internal error: License for existing subscription not found."
            )
        target_subscription_id_for_renewal = renewal_sub_doc.id  # PyObjectId (str)

    else:
        raise ValueError("Invalid transaction_type for admin creation.")

    if not license_doc:
        raise ValueError(
            "License information could not be determined for the transaction by admin."
        )

    dt_now = datetime.now(timezone.utc)
    transaction_doc_to_insert = {
        "buyer_user_id": ObjectId(transaction_create_data.buyer_user_id),
        "license_id": ObjectId(license_doc.id),
        "license_key": license_doc.key,
        "original_license_price": license_doc.price,  # Admin nhập transaction_amount riêng
        "purchased_duration_days": transaction_create_data.purchased_duration_days,  # Admin nhập
        "transaction_amount": transaction_create_data.transaction_amount,  # Admin nhập
        "promotion_code": transaction_create_data.promotion_code,
        "payment_status": PaymentStatusEnum.pending.value,
        "transaction_type": transaction_create_data.transaction_type.value,
        "notes": transaction_create_data.notes,
        "target_subscription_id": ObjectId(target_subscription_id_for_renewal)
        if target_subscription_id_for_renewal
        and ObjectId.is_valid(target_subscription_id_for_renewal)
        else None,
        "created_at": dt_now,
        "updated_at": dt_now,
    }

    try:
        insert_result = await db.transactions.insert_one(transaction_doc_to_insert)
        if insert_result.inserted_id:
            return await get_transaction_by_id(db, str(insert_result.inserted_id))
        logger.error(
            f"Admin creating transaction: Failed for user: {transaction_create_data.buyer_user_id}"
        )
        return None
    except Exception as e:
        logger.error(
            f"Admin creating transaction: Error for {transaction_create_data.buyer_user_id}: {e}",
            exc_info=True,
        )
        return None


# --- Hàm mới cho User tự tạo Transaction ---
async def create_transaction_by_user_db(
    db: AsyncIOMotorDatabase,
    transaction_data: TransactionCreateByUser,
    current_user: AppUserInDB,
) -> Optional[TransactionInDB]:
    license_doc: Optional[LicenseInDB] = None
    target_subscription_id_for_renewal: Optional[PyObjectId] = None  # PyObjectId (str)
    purchased_duration_auto: int
    transaction_amount_auto: float

    if transaction_data.transaction_type == TransactionTypeEnum.new_purchase:
        if not transaction_data.license_id_for_new_purchase:
            raise ValueError(
                "license_id_for_new_purchase is required for new_purchase by user."
            )
        license_doc = await crud_licenses.get_license_by_id(
            db, transaction_data.license_id_for_new_purchase
        )
        if not license_doc:
            logger.error(
                f"User creating transaction: License ID {transaction_data.license_id_for_new_purchase} not found."
            )
            raise ValueError(
                f"Selected license (ID: {transaction_data.license_id_for_new_purchase}) not found."
            )
        purchased_duration_auto = license_doc.duration_days
        transaction_amount_auto = license_doc.price

    elif transaction_data.transaction_type == TransactionTypeEnum.renewal:
        if not transaction_data.subscription_id_to_renew:
            raise ValueError(
                "subscription_id_to_renew is required for renewal by user."
            )

        renewal_sub_doc = await crud_subscriptions.get_subscription_by_id_db(
            db, transaction_data.subscription_id_to_renew
        )
        if not renewal_sub_doc:
            logger.error(
                f"User creating transaction: Subscription to renew ID {transaction_data.subscription_id_to_renew} not found."
            )
            raise ValueError(
                f"Subscription to renew (ID: {transaction_data.subscription_id_to_renew}) not found."
            )

        if str(renewal_sub_doc.user_id) != str(current_user.id):
            logger.error(
                f"User creating transaction: Subscription {renewal_sub_doc.id} does not belong to current user {current_user.id}."
            )
            raise ValueError("Subscription to renew does not belong to you.")

        if (
            not renewal_sub_doc.is_active
        ):  # Hoặc có thể cho phép gia hạn gói đã hết hạn? Hiện tại là không.
            logger.error(
                f"User creating transaction: Subscription {renewal_sub_doc.id} is not active."
            )
            raise ValueError("Subscription to renew is not currently active.")

        license_doc = await crud_licenses.get_license_by_id(
            db, renewal_sub_doc.license_id
        )
        if not license_doc:
            logger.error(
                f"User creating transaction: License for subscription {renewal_sub_doc.id} (License ID: {renewal_sub_doc.license_id}) not found."
            )
            raise ValueError(
                "Internal error: License for your current subscription not found."
            )
        target_subscription_id_for_renewal = renewal_sub_doc.id  # PyObjectId (str)
        purchased_duration_auto = (
            license_doc.duration_days
        )  # Gia hạn theo thời hạn gốc của license
        transaction_amount_auto = (
            license_doc.price
        )  # Giá gia hạn bằng giá gốc của license

    else:
        raise ValueError("Invalid transaction_type for user creation.")

    if not license_doc:
        raise ValueError(
            "License information could not be determined for the transaction by user."
        )

    # TODO: Logic xử lý promotion_code để điều chỉnh transaction_amount_auto nếu cần
    # if transaction_data.promotion_code:
    #     discount = await apply_promotion_code(db, transaction_data.promotion_code, transaction_amount_auto)
    #     if discount is not None:
    #         transaction_amount_auto -= discount

    dt_now = datetime.now(timezone.utc)
    transaction_doc_to_insert = {
        "buyer_user_id": ObjectId(current_user.id),  # Lấy từ current_user
        "license_id": ObjectId(license_doc.id),
        "license_key": license_doc.key,
        "original_license_price": license_doc.price,
        "purchased_duration_days": purchased_duration_auto,  # Từ license
        "transaction_amount": transaction_amount_auto,  # Từ license (sau này có thể có KM)
        "promotion_code": transaction_data.promotion_code,
        "payment_status": PaymentStatusEnum.pending.value,
        "transaction_type": transaction_data.transaction_type.value,
        "notes": transaction_data.user_notes,  # Ghi chú của user
        "target_subscription_id": ObjectId(target_subscription_id_for_renewal)
        if target_subscription_id_for_renewal
        and ObjectId.is_valid(target_subscription_id_for_renewal)
        else None,
        "created_at": dt_now,
        "updated_at": dt_now,
    }

    try:
        insert_result = await db.transactions.insert_one(transaction_doc_to_insert)
        if insert_result.inserted_id:
            return await get_transaction_by_id(db, str(insert_result.inserted_id))
        logger.error(
            f"User creating transaction: Failed for user: {current_user.email}"
        )
        return None
    except Exception as e:
        logger.error(
            f"User creating transaction: Error for {current_user.email}: {e}",
            exc_info=True,
        )
        return None


# --- Kết thúc hàm mới ---


async def update_transaction_details_db(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
    update_data: TransactionUpdateByAdmin,
) -> Optional[TransactionInDB]:
    transaction = await get_transaction_by_id(db, transaction_id_str)
    if not transaction:
        return None

    if transaction.payment_status != PaymentStatusEnum.pending:
        logger.warning(
            f"Attempted to update details of a non-pending transaction (ID: {transaction_id_str}, Status: {transaction.payment_status})."
        )
        raise ValueError("Only pending transactions can have their details updated.")

    update_payload = update_data.model_dump(exclude_unset=True)
    if not update_payload:
        return transaction

    update_payload["updated_at"] = datetime.now(timezone.utc)

    updated_result = await db.transactions.update_one(
        {"_id": ObjectId(transaction_id_str)}, {"$set": update_payload}
    )

    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)
    return None


async def confirm_transaction_payment_db(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
) -> Optional[TransactionInDB]:
    transaction = await get_transaction_by_id(db, transaction_id_str)
    if not transaction:
        logger.error(
            f"Transaction with ID {transaction_id_str} not found for confirmation."
        )
        return None  # Hoặc raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.payment_status != PaymentStatusEnum.pending:
        logger.warning(
            f"Transaction {transaction_id_str} is not pending, current status: {transaction.payment_status}."
        )
        raise ValueError(
            f"Transaction is not in pending state. Current status: {transaction.payment_status}"
        )

    dt_now = datetime.now(timezone.utc)
    update_fields_for_transaction = {
        "payment_status": PaymentStatusEnum.succeeded.value,
        "updated_at": dt_now,
    }

    newly_created_or_updated_sub_id: Optional[ObjectId] = None

    if transaction.transaction_type == TransactionTypeEnum.new_purchase:
        sub_create_payload = AppSubscriptionCreateSchema(
            user_id=str(transaction.buyer_user_id),
            license_key=transaction.license_key,
            duration_override_days=transaction.purchased_duration_days,
        )
        created_sub = await crud_subscriptions.create_subscription_db(
            db, sub_create_payload
        )
        if not created_sub:
            logger.error(
                f"Failed to create new subscription for transaction {transaction.id}."
            )
            raise Exception(
                f"Failed to create new subscription for transaction {transaction.id}."
            )
        newly_created_or_updated_sub_id = ObjectId(created_sub.id)
        update_fields_for_transaction["target_subscription_id"] = (
            newly_created_or_updated_sub_id
        )

    elif transaction.transaction_type == TransactionTypeEnum.renewal:
        if not transaction.target_subscription_id:
            logger.error(
                f"Renewal transaction {transaction.id} is missing target_subscription_id."
            )
            raise Exception(
                f"Renewal transaction {transaction.id} is missing target_subscription_id."
            )

        renewal_target_sub_id_str = str(transaction.target_subscription_id)
        target_sub: Optional[
            AppSubscriptionInDB
        ] = await crud_subscriptions.get_subscription_by_id_db(
            db, renewal_target_sub_id_str
        )

        if not target_sub or not target_sub.is_active:
            logger.error(
                f"Target subscription {renewal_target_sub_id_str} for renewal (Transaction: {transaction.id}) not found or not active."
            )
            raise Exception(
                f"Target subscription {renewal_target_sub_id_str} for renewal not found or not active."
            )

        new_expiry_date = target_sub.expiry_date + timedelta(
            days=transaction.purchased_duration_days
        )

        updated_sub_result = await db.subscriptions.update_one(
            {"_id": ObjectId(renewal_target_sub_id_str)},
            {
                "$set": {
                    "expiry_date": new_expiry_date,
                    "updated_at": dt_now,
                    "is_active": True,
                }
            },
        )
        if updated_sub_result.modified_count == 0:
            logger.error(
                f"Failed to update expiry date for subscription {renewal_target_sub_id_str} (Transaction: {transaction.id})."
            )
            raise Exception(
                f"Failed to update subscription {renewal_target_sub_id_str} for renewal."
            )
        newly_created_or_updated_sub_id = ObjectId(renewal_target_sub_id_str)

    updated_result = await db.transactions.update_one(
        {"_id": ObjectId(transaction_id_str)}, {"$set": update_fields_for_transaction}
    )

    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)

    logger.error(
        f"Failed to update transaction {transaction_id_str} to succeeded after subscription logic."
    )
    return None


async def cancel_transaction_db(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
) -> Optional[TransactionInDB]:
    transaction = await get_transaction_by_id(db, transaction_id_str)
    if not transaction:
        return None

    if transaction.payment_status != PaymentStatusEnum.pending:
        raise ValueError(
            f"Transaction is not in pending state. Current status: {transaction.payment_status}"
        )

    dt_now = datetime.now(timezone.utc)
    update_fields = {
        "payment_status": PaymentStatusEnum.canceled.value,
        "updated_at": dt_now,
    }

    updated_result = await db.transactions.update_one(
        {"_id": ObjectId(transaction_id_str)}, {"$set": update_fields}
    )
    if updated_result.matched_count > 0:
        return await get_transaction_by_id(db, transaction_id_str)
    return None
