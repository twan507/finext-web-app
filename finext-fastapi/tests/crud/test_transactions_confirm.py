"""Test S1 — confirm thanh toán: idempotent/atomic (C1) + cơ sở giảm giá nhất quán (C2)."""
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

import app.crud.subscriptions as crud_subscriptions
import app.crud.transactions as crud_tx
from app.schemas.transactions import TransactionPaymentConfirmationRequest
from tests.crud._fake_mongo import FakeDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_user(db: FakeDB, email: str = "buyer@example.com") -> ObjectId:
    uid = ObjectId()
    db["users"].docs.append(
        {
            "_id": uid,
            "email": email,
            "role_ids": [],
            "referral_code": None,
            "subscription_id": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    return uid


def _seed_license(db: FakeDB, key: str = "PRO", price: float = 200000.0, duration: int = 30) -> ObjectId:
    lid = ObjectId()
    db["licenses"].docs.append(
        {
            "_id": lid,
            "key": key,
            "name": f"Gói {key}",
            "price": price,
            "duration_days": duration,
            "feature_keys": [],
            "color": "#1976D2",
            "is_active": True,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    return lid


def _seed_promo(db: FakeDB, code: str = "SALE10", pct: float = 10.0) -> ObjectId:
    pid = ObjectId()
    db["promotions"].docs.append(
        {
            "_id": pid,
            "promotion_code": code,
            "description": None,
            "discount_type": "percentage",
            "discount_value": pct,
            "is_active": True,
            "start_date": None,
            "end_date": None,
            "usage_limit": None,
            "usage_count": 0,
            "applicable_license_keys": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    return pid


def _seed_pending_new_purchase(
    db: FakeDB, uid: ObjectId, lid: ObjectId, key: str = "PRO", price: float = 200000.0, duration: int = 30, **extra
) -> ObjectId:
    txid = ObjectId()
    doc = {
        "_id": txid,
        "buyer_user_id": uid,
        "license_id": lid,
        "license_key": key,
        "original_license_price": price,
        "purchased_duration_days": duration,
        "transaction_amount": price,
        "payment_status": "pending",
        "transaction_type": "new_purchase",
        "promotion_code_applied": None,
        "promotion_discount_amount": None,
        "broker_code_applied": None,
        "broker_discount_amount": None,
        "total_discount_amount": None,
        "notes": None,
        "target_subscription_id": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    doc.update(extra)
    db["transactions"].docs.append(doc)
    return txid


# ---------------- C1: idempotent / atomic confirm ----------------


async def test_confirm_new_purchase_happy_path_single_sub():
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db)
    txid = _seed_pending_new_purchase(db, uid, lid)

    result = await crud_tx.confirm_transaction_payment_db(db, str(txid), TransactionPaymentConfirmationRequest())

    assert result is not None
    assert result.payment_status == "succeeded"
    assert len(db["subscriptions"].docs) == 1


async def test_confirm_claims_transaction_before_side_effects():
    """Cốt lõi C1: giao dịch phải được chuyển PENDING->SUCCEEDED (chiếm quyền nguyên tử)
    TRƯỚC khi chạy side-effect. Nếu còn PENDING lúc tạo sub thì 2 luồng có thể cùng qua."""
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db)
    txid = _seed_pending_new_purchase(db, uid, lid)

    seen: dict = {}
    real_create = crud_subscriptions.create_subscription_db

    async def spy_create(db_, payload, allow_protected_licenses: bool = False):
        doc = await db_["transactions"].find_one({"_id": txid})
        seen["status_at_side_effect"] = doc["payment_status"]
        return await real_create(db_, payload, allow_protected_licenses=allow_protected_licenses)

    crud_subscriptions.create_subscription_db = spy_create
    try:
        await crud_tx.confirm_transaction_payment_db(db, str(txid), TransactionPaymentConfirmationRequest())
    finally:
        crud_subscriptions.create_subscription_db = real_create

    assert seen["status_at_side_effect"] == "succeeded"


async def test_confirm_rejects_when_already_completed_no_side_effect():
    """Giao dịch đã HOÀN TẤT (SUCCEEDED + target_subscription_id đã set) → reject, không
    cấp quyền lợi lần hai. target_subscription_id set là marker của trạng thái đã xong."""
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db)
    txid = _seed_pending_new_purchase(
        db, uid, lid, payment_status="succeeded", target_subscription_id=ObjectId()
    )

    with pytest.raises(ValueError):
        await crud_tx.confirm_transaction_payment_db(db, str(txid), TransactionPaymentConfirmationRequest())

    assert len(db["subscriptions"].docs) == 0


async def test_confirm_resumes_incomplete_new_purchase():
    """REL-01: giao dịch kẹt SUCCEEDED nhưng target_subscription_id còn None (side-effect
    lần trước lỗi) phải chạy lại được và tạo sub — thay vì kẹt vĩnh viễn."""
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db)
    txid = _seed_pending_new_purchase(
        db, uid, lid, payment_status="succeeded", target_subscription_id=None
    )

    result = await crud_tx.confirm_transaction_payment_db(db, str(txid), TransactionPaymentConfirmationRequest())

    assert result is not None
    assert result.payment_status == "succeeded"
    assert len(db["subscriptions"].docs) == 1
    tx_doc = await db["transactions"].find_one({"_id": txid})
    assert tx_doc["target_subscription_id"] is not None


async def test_confirm_resume_khong_cap_doi_khi_da_co_sub():
    """REL-01 safety: nếu lần trước ĐÃ tạo sub (nhưng update target_sub lỗi), resume KHÔNG
    được tạo sub thứ hai. create_subscription_db chặn khi user đã có sub active non-BASIC."""
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db, key="PRO")
    # Sub active non-BASIC đã tồn tại (kết quả của lần confirm trước đã tạo được sub).
    db["subscriptions"].docs.append(
        {
            "_id": ObjectId(),
            "user_id": uid,
            "license_key": "PRO",
            "is_active": True,
            "expiry_date": _now() + timedelta(days=30),
            "start_date": _now(),
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    txid = _seed_pending_new_purchase(
        db, uid, lid, key="PRO", payment_status="succeeded", target_subscription_id=None
    )

    with pytest.raises((ValueError, Exception)):
        await crud_tx.confirm_transaction_payment_db(db, str(txid), TransactionPaymentConfirmationRequest())

    # Vẫn đúng 1 sub — không cấp đôi quyền lợi.
    assert len(db["subscriptions"].docs) == 1


# ---------------- C2: cơ sở giảm giá nhất quán ----------------


async def test_confirm_promo_override_uses_after_broker_base():
    """Giao dịch đã có broker (giảm 10% trên giá gốc = 20k). Admin ghi đè KM 10%.
    KM phải tính trên GIÁ SAU BROKER (180k -> 18k), final 162k — KHÔNG phải trên giá gốc (20k -> 160k)."""
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db, key="PRO", price=200000.0)
    _seed_promo(db, "SALE10", 10.0)
    txid = _seed_pending_new_purchase(
        db,
        uid,
        lid,
        key="PRO",
        price=200000.0,
        broker_code_applied="BRK1",
        broker_discount_amount=20000.0,
        total_discount_amount=20000.0,
        transaction_amount=180000.0,
    )

    result = await crud_tx.confirm_transaction_payment_db(
        db, str(txid), TransactionPaymentConfirmationRequest(promotion_code_override="SALE10")
    )

    assert result.broker_discount_amount == 20000.0
    assert result.promotion_discount_amount == 18000.0
    assert result.total_discount_amount == 38000.0
    assert result.transaction_amount == 162000.0


async def test_preview_and_confirm_agree_on_discount_base():
    db = FakeDB()
    uid = _seed_user(db)
    lid = _seed_license(db, key="PRO", price=200000.0)
    _seed_promo(db, "SALE10", 10.0)
    txid = _seed_pending_new_purchase(
        db,
        uid,
        lid,
        key="PRO",
        price=200000.0,
        broker_code_applied="BRK1",
        broker_discount_amount=20000.0,
        total_discount_amount=20000.0,
        transaction_amount=180000.0,
    )

    preview = await crud_tx.calculate_transaction_price_with_overrides(db, str(txid), promotion_code_override="SALE10")
    assert preview["calculated_transaction_amount"] == 162000.0

    result = await crud_tx.confirm_transaction_payment_db(
        db, str(txid), TransactionPaymentConfirmationRequest(promotion_code_override="SALE10")
    )
    assert result.transaction_amount == preview["calculated_transaction_amount"]
