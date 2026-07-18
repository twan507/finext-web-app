import types
from datetime import timedelta

from bson import ObjectId

import app.crud.chat as crud
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


async def test_check_quota_standard_allows_when_empty(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    d = await crud.check_quota(db, USER)
    assert d.ok is True


async def test_check_quota_denies_when_5h_exceeded(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": crud.AGENT_TOKENS_5H}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is False and d.status_code == 429 and "phiên" in d.message


async def test_5h_window_resets_after_expiry(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now() - timedelta(hours=6), "s5_tokens": crud.AGENT_TOKENS_5H * 10}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is True  # cửa sổ 5h đã hết hạn → coi như 0


async def test_check_quota_weekly_exceeded(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": 0,
         "wk_start": crud._now(), "wk_tokens": crud.AGENT_TOKENS_WEEK}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is False and d.status_code == 429 and "tuần" in d.message


async def test_advanced_tier_5x(monkeypatch):
    async def _tier(db, uid):
        return "advanced"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    # đủ chặn standard nhưng dưới trần advanced (×5)
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": crud.AGENT_TOKENS_5H}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is True


async def test_unlimited_tier_always_ok(monkeypatch):
    async def _tier(db, uid):
        return "unlimited"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": 10**12}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is True


async def test_global_kill_switch_503(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": crud.GLOBAL_QUOTA_KEY, "g_start": crud._now(), "g_tokens": crud.AGENT_DAILY_TOKEN_BUDGET}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is False and d.status_code == 503


async def test_record_usage_accumulates_and_global():
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 100, "out": 50})
    await crud.record_usage(db, USER, {"in": 100, "out": 50})
    doc = await db[crud.QUOTA].find_one({"user_id": USER})
    assert doc["s5_tokens"] == 300 and doc["wk_tokens"] == 300
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY})
    assert g["g_tokens"] == 300


async def test_record_usage_new_window_after_expiry():
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now() - timedelta(hours=6), "s5_tokens": 999999}
    )
    before = crud._now()
    await crud.record_usage(db, USER, {"in": 100, "out": 0})
    doc = await db[crud.QUOTA].find_one({"user_id": USER})
    assert doc["s5_tokens"] == 100  # cửa sổ cũ hết hạn → mở mới
    assert doc["s5_start"] >= before


async def test_record_usage_zero_noop():
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 0, "out": 0})
    assert await db[crud.QUOTA].find_one({"user_id": USER}) is None


async def test_resolve_tier_by_license(monkeypatch):
    db = FakeDB()
    for key, expected in [("PATRON", "advanced"), ("ADMIN", "unlimited"), ("BASIC", "standard")]:
        async def _sub(db_, uid, k=key):
            return types.SimpleNamespace(license_key=k)
        monkeypatch.setattr(crud, "get_active_subscription_for_user_db", _sub)
        assert await crud.resolve_tier(db, USER) == expected

    async def _none(db_, uid):
        return None
    monkeypatch.setattr(crud, "get_active_subscription_for_user_db", _none)
    assert await crud.resolve_tier(db, USER) == "standard"


async def test_quota_status_shape(monkeypatch):
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": 1000}
    )
    st = await crud.quota_status(db, USER)
    assert st["tier"] == "standard"
    assert st["unlimited"] is False
    assert st["session"]["used"] == 1000
    assert st["session"]["limit"] == crud.AGENT_TOKENS_5H
    assert st["weekly"] is not None
