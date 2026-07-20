"""Test S1 — C4: bất biến '1 subscription trả phí (non-BASIC) active / user'.

Trên Mongo standalone không thể tuyệt đối atomic; các test này khoá lại bất biến
tuần tự + cơ chế reconcile (deactivate_all trừ sub mới) mà bản vá dựa vào.
"""
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

import app.crud.subscriptions as crud_sub
from app.schemas.subscriptions import SubscriptionCreate
from tests.crud._fake_mongo import FakeDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_user(db: FakeDB, email: str = "buyer@example.com") -> ObjectId:
    uid = ObjectId()
    db["users"].docs.append(
        {"_id": uid, "email": email, "role_ids": [], "subscription_id": None, "created_at": _now(), "updated_at": _now()}
    )
    return uid


def _seed_license(db: FakeDB, key: str, price: float, duration: int = 30) -> ObjectId:
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


def _seed_sub(db: FakeDB, uid: ObjectId, key: str, is_active: bool, days_to_expiry: int = 30) -> ObjectId:
    sid = ObjectId()
    db["subscriptions"].docs.append(
        {
            "_id": sid,
            "user_id": uid,
            "user_email": "buyer@example.com",
            "license_id": ObjectId(),
            "license_key": key,
            "is_active": is_active,
            "start_date": _now() - timedelta(days=1),
            "expiry_date": _now() + timedelta(days=days_to_expiry),
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    return sid


def _active_paid(db: FakeDB):
    return [s for s in db["subscriptions"].docs if s.get("is_active") and s["license_key"] != "BASIC"]


async def test_create_non_basic_leaves_single_active_paid():
    db = FakeDB()
    uid = _seed_user(db)
    _seed_license(db, "BASIC", 0.0)
    _seed_license(db, "PRO", 200000.0)
    _seed_sub(db, uid, "BASIC", is_active=True)

    created = await crud_sub.create_subscription_db(db, SubscriptionCreate(user_id=str(uid), license_key="PRO"))

    assert created is not None
    paid = _active_paid(db)
    assert len(paid) == 1
    assert paid[0]["license_key"] == "PRO"


async def test_second_non_basic_create_rejected():
    db = FakeDB()
    uid = _seed_user(db)
    _seed_license(db, "BASIC", 0.0)
    _seed_license(db, "PRO", 200000.0)

    first = await crud_sub.create_subscription_db(db, SubscriptionCreate(user_id=str(uid), license_key="PRO"))
    assert first is not None

    with pytest.raises(ValueError):
        await crud_sub.create_subscription_db(db, SubscriptionCreate(user_id=str(uid), license_key="PRO"))

    assert len(_active_paid(db)) == 1


async def test_deactivate_all_excludes_new_sub_leaves_single_active():
    """Cơ chế reconcile: deactivate_all(exclude_sub_id=new) chỉ chừa lại đúng sub mới,
    hạ mọi sub trả phí active 'lạc' khác."""
    db = FakeDB()
    uid = _seed_user(db)
    stray = _seed_sub(db, uid, "PRO", is_active=True)
    newest = _seed_sub(db, uid, "PRO", is_active=True)

    n = await crud_sub.deactivate_all_active_subscriptions_for_user(db, uid, exclude_sub_id=newest)

    assert n == 1
    paid = _active_paid(db)
    assert len(paid) == 1
    assert paid[0]["_id"] == newest
    assert stray != newest
