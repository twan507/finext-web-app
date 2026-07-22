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


async def test_global_kill_switch_503_khi_bat(monkeypatch):
    """Cầu dao BẬT (trần > 0): chạm trần thì chặn 503 cho mọi user."""
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    monkeypatch.setattr(crud, "AGENT_DAILY_TOKEN_BUDGET", 4_000_000)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": crud.GLOBAL_QUOTA_KEY, "g_start": crud._now(), "g_tokens": 4_000_000}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is False and d.status_code == 503


async def test_global_kill_switch_tat_khi_tran_bang_khong(monkeypatch):
    """Cầu dao TẮT (trần <= 0) — mặc định hiện tại.

    Bẫy: nếu quên kiểm trần trước thì "đã dùng 0 >= trần 0" là ĐÚNG, và mọi request bị
    chặn 503 ngay lượt đầu — tức tắt cầu dao lại hoá ra chặn sạch.
    """
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    monkeypatch.setattr(crud, "AGENT_DAILY_TOKEN_BUDGET", 0)
    db = FakeDB()
    # Global đã tiêu rất nhiều nhưng cầu dao tắt → vẫn cho qua.
    await db[crud.QUOTA].insert_one(
        {"user_id": crud.GLOBAL_QUOTA_KEY, "g_start": crud._now(), "g_tokens": 999_000_000}
    )
    d = await crud.check_quota(db, USER)
    assert d.ok is True, "cầu dao tắt thì không được chặn"


# ── Quy đổi token → đơn vị chi phí (billable_units) ──────────────────────
# Hệ số theo giá mặc định: cache 0,06/0,30 = 0,2 ; output 1,20/0,30 = 4,0.

def test_billable_units_tru_phan_cache_theo_gia():
    # in=1000 (đã gồm 900 cache) → 100 token thường + 900×0,2 + 100 out×4 = 100+180+400 = 680
    assert crud.billable_units({"in": 1000, "out": 100, "cache_read": 900}) == 680


def test_billable_units_khong_cache_dat_hon_han():
    # Cùng lượng token nhưng không cache: 1000×1 + 100×4 = 1400 — đắt gấp hơn 2 lần bản có cache.
    assert crud.billable_units({"in": 1000, "out": 100, "cache_read": 0}) == 1400


def test_billable_units_thieu_khoa_cache_coi_nhu_khong_cache():
    """Tương thích ngược: nhà cung cấp không báo cache → không được vỡ, tính như cache_read=0."""
    assert crud.billable_units({"in": 1000, "out": 100}) == 1400


def test_billable_units_khong_duoc_coi_in_la_phan_chua_cache():
    """Bẫy ngữ nghĩa: "in" ĐÃ GỒM cache. Nếu ai đó tính uncached = in (không trừ) thì ra 1360, sai."""
    assert crud.billable_units({"in": 1000, "out": 100, "cache_read": 900}) != 1360


def test_billable_units_zero_va_rong():
    assert crud.billable_units({"in": 0, "out": 0, "cache_read": 0}) == 0
    assert crud.billable_units({}) == 0


def test_billable_units_lam_tron_len():
    # 1 token cache = 0,2 đơn vị → làm tròn LÊN thành 1 (không cho lọt lượt 0 đơn vị)
    assert crud.billable_units({"in": 1, "out": 0, "cache_read": 1}) == 1


def test_billable_units_gia_tri_am_bi_kep_ve_0():
    """Không thể xảy ra với provider lành mạnh, nhưng không được trả số âm (sẽ TRỪ ngược quota)."""
    assert crud.billable_units({"in": -5, "out": -3, "cache_read": -2}) == 0


def test_billable_units_cache_lon_hon_in_bi_kep():
    """cache_read > in là dữ liệu bẩn — kẹp về in, không để uncached âm."""
    assert crud.billable_units({"in": 100, "out": 0, "cache_read": 500}) == 20


def test_billable_units_du_lieu_that_re_hon_token_tho_nhieu_lan():
    """Số THẬT đã đo của 1 lượt agent. Cách cũ (in+out) trừ 331.513 đơn vị — quy đổi phải rẻ hơn hẳn.

    9.729 chưa cache ×1 + 314.562 cache ×0,2 + 7.222 out ×4 = 101.529,4 → 101.530.
    """
    real = {"in": 324_291, "out": 7_222, "cache_read": 314_562}
    units = crud.billable_units(real)
    assert units == 101_530
    raw = real["in"] + real["out"]  # 331.513 — cách tính cũ
    assert raw / units > 3.2  # cách cũ trừ gấp hơn 3 lần chi phí thật


async def test_record_usage_dung_don_vi_quy_doi_khong_phai_token_tho():
    db = FakeDB()
    await crud.record_usage(db, USER, {"in": 1000, "out": 100, "cache_read": 900})
    doc = await db[crud.QUOTA].find_one({"user_id": USER})
    assert doc["s5_tokens"] == 680  # KHÔNG phải 1100 (token thô)
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY})
    assert g["g_tokens"] == 680  # cầu dao global dùng CÙNG đơn vị


async def test_record_usage_accumulates_and_global():
    db = FakeDB()
    # Mỗi lượt (không cache): 100 in ×1 + 50 out ×4 = 300 đơn vị → 2 lượt = 600.
    await crud.record_usage(db, USER, {"in": 100, "out": 50})
    await crud.record_usage(db, USER, {"in": 100, "out": 50})
    doc = await db[crud.QUOTA].find_one({"user_id": USER})
    assert doc["s5_tokens"] == 600 and doc["wk_tokens"] == 600
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY})
    assert g["g_tokens"] == 600


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


async def test_record_usage_khong_mat_token_khi_hai_luot_xen_ke():
    """Hai lượt kết thúc xen kẽ phải cộng đủ token, không lượt nào bị ghi đè.

    Trước đây record_usage là read-compute-$set: cả hai lượt đọc cùng mốc cũ rồi ghi
    đè nhau → mất token của một lượt, kể cả trên bộ đếm ngân sách global. Test ép
    nhường event loop ĐÚNG giữa lúc đọc và lúc ghi — chỗ mà lost update xảy ra.

    Cửa sổ được seed sẵn (đang mở) vì đó là trạng thái thường trực; lúc cold-start
    cả hai bản đều còn một race biên hẹp do phải $set để mở cửa sổ mới.
    """
    import asyncio

    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": 100, "wk_start": crud._now(), "wk_tokens": 100}
    )
    coll = db[crud.QUOTA]
    orig_update_one = coll.update_one

    async def yielding_update_one(*a, **kw):
        await asyncio.sleep(0)  # nhường loop sau khi đã đọc, trước khi ghi
        return await orig_update_one(*a, **kw)

    coll.update_one = yielding_update_one

    # Mỗi lượt: 100 in ×1 + 50 out ×4 = 300 đơn vị.
    await asyncio.gather(
        crud.record_usage(db, USER, {"in": 100, "out": 50}),
        crud.record_usage(db, USER, {"in": 100, "out": 50}),
    )

    doc = await coll.find_one({"user_id": USER})
    assert doc["s5_tokens"] == 700, "100 seed + 300 + 300; ghi đè sẽ chỉ ra 400"
    assert doc["wk_tokens"] == 700
