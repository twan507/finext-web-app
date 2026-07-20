"""Test S1 — C3: increment usage_count của promotion phải nguyên tử + tôn trọng usage_limit."""
from datetime import datetime, timezone

from bson import ObjectId

import app.crud.promotions as crud_promo
from tests.crud._fake_mongo import FakeDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_promo(db: FakeDB, code: str, usage_limit, usage_count: int = 0) -> None:
    db["promotions"].docs.append(
        {
            "_id": ObjectId(),
            "promotion_code": code,
            "description": None,
            "discount_type": "percentage",
            "discount_value": 10.0,
            "is_active": True,
            "start_date": None,
            "end_date": None,
            "usage_limit": usage_limit,
            "usage_count": usage_count,
            "applicable_license_keys": None,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )


async def test_increment_respects_usage_limit_no_overshoot():
    db = FakeDB()
    _seed_promo(db, "LIMIT1", usage_limit=1, usage_count=0)

    ok1 = await crud_promo.increment_promotion_usage(db, "LIMIT1")
    ok2 = await crud_promo.increment_promotion_usage(db, "LIMIT1")

    assert ok1 is True
    assert ok2 is False  # đã đạt limit -> không tăng nữa
    assert db["promotions"].docs[0]["usage_count"] == 1  # KHÔNG vượt limit


async def test_increment_at_limit_returns_false():
    db = FakeDB()
    _seed_promo(db, "FULL", usage_limit=3, usage_count=3)

    ok = await crud_promo.increment_promotion_usage(db, "FULL")

    assert ok is False
    assert db["promotions"].docs[0]["usage_count"] == 3


async def test_increment_unlimited_when_no_limit():
    db = FakeDB()
    _seed_promo(db, "UNLIM", usage_limit=None, usage_count=5)

    ok = await crud_promo.increment_promotion_usage(db, "UNLIM")

    assert ok is True
    assert db["promotions"].docs[0]["usage_count"] == 6


async def test_increment_missing_code_returns_false():
    db = FakeDB()
    ok = await crud_promo.increment_promotion_usage(db, "NOPE")
    assert ok is False
