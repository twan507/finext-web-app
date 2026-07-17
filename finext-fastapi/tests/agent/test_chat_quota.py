from bson import ObjectId

import app.crud.chat as crud
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


async def test_first_message_allowed_and_reserves():
    db = FakeDB()
    d = await crud.check_and_reserve_quota(db, USER)
    assert d.ok is True
    q = await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()})
    assert q["msg_count"] == 1  # đã reserve


async def test_daily_quota_exceeded_returns_429(monkeypatch):
    monkeypatch.setattr(crud, "AGENT_MSG_PER_DAY", 3)
    monkeypatch.setattr(crud, "AGENT_MSG_PER_MIN", 1000)  # tắt rate-limit để test daily
    db = FakeDB()
    for _ in range(3):
        assert (await crud.check_and_reserve_quota(db, USER)).ok is True
    d = await crud.check_and_reserve_quota(db, USER)
    assert d.ok is False and d.status_code == 429
    q = await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()})
    assert q["msg_count"] == 3  # KHÔNG reserve khi bị từ chối


async def test_per_minute_rate_limit_returns_429(monkeypatch):
    monkeypatch.setattr(crud, "AGENT_MSG_PER_MIN", 2)
    monkeypatch.setattr(crud, "AGENT_MSG_PER_DAY", 1000)
    db = FakeDB()
    # tạo 2 user-msg "vừa gửi" trong 60s để chạm trần phút
    for _ in range(2):
        await crud.add_message(db, str(ObjectId()), USER, "user", "spam")
    d = await crud.check_and_reserve_quota(db, USER)
    assert d.ok is False and d.status_code == 429


async def test_kill_switch_budget_exceeded_returns_503(monkeypatch):
    monkeypatch.setattr(crud, "AGENT_DAILY_TOKEN_BUDGET", 1000)
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 800, "out": 300})  # global = 1100 >= 1000
    d = await crud.check_and_reserve_quota(db, USER)
    assert d.ok is False and d.status_code == 503


async def test_record_usage_increments_user_and_global():
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 100, "out": 20})
    await crud.record_usage(db, USER, {"in": 50, "out": 10})
    u = await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()})
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY, "date": crud._today()})
    assert u["tok_in"] == 150 and u["tok_out"] == 30
    assert g["tok_in"] == 150 and g["tok_out"] == 30


async def test_record_usage_zero_is_noop():
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 0, "out": 0})
    assert await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()}) is None
