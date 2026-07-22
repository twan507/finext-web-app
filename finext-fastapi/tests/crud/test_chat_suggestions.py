"""Lưu/đọc câu hỏi gợi ý. Đọc PHẢI luôn trả về danh sách dùng được."""
from datetime import datetime, timedelta, timezone

import app.crud.chat_suggestions as crud_sug
from tests.crud._fake_mongo import FakeDB


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def test_collection_rong_thi_tra_fallback():
    db = FakeDB()
    out = await crud_sug.get_latest_suggestions(db)
    assert out == crud_sug.FALLBACK_SUGGESTIONS
    # Fallback phải đủ để còn bốc ngẫu nhiên được, không chỉ vừa đủ hiển thị.
    assert len(out) > crud_sug.DISPLAY_COUNT


async def test_luu_roi_doc_lai_dung_bo_vua_luu():
    db = FakeDB()
    qs = ["Câu 1?", "Câu 2?", "Câu 3?", "Câu 4?", "Câu 5?"]
    await crud_sug.save_suggestions(db, qs, {"phase": "x"}, "model-x", {"in": 10, "out": 5})

    out = await crud_sug.get_latest_suggestions(db)
    assert out == qs


async def test_doc_ban_moi_nhat_khi_co_nhieu_ban():
    db = FakeDB()
    await crud_sug.save_suggestions(db, ["Cũ?"] * 5, {}, "m", {})
    db[crud_sug.SUGGESTIONS_COLLECTION].docs[0]["generated_at"] = _now() - timedelta(hours=2)
    await crud_sug.save_suggestions(db, ["Mới?"] * 5, {}, "m", {})

    out = await crud_sug.get_latest_suggestions(db)
    assert out == ["Mới?"] * 5


async def test_luu_kem_expires_at_de_ttl_don_duoc():
    db = FakeDB()
    await crud_sug.save_suggestions(db, ["A?"] * 5, {}, "m", {})
    doc = db[crud_sug.SUGGESTIONS_COLLECTION].docs[0]
    assert doc["expires_at"] > doc["generated_at"]


# --- Kho nhiều câu + bốc ngẫu nhiên ----------------------------------------


async def test_luu_duoc_kho_10_cau():
    db = FakeDB()
    qs = [f"Câu {i}?" for i in range(10)]
    await crud_sug.save_suggestions(db, qs, {}, "m", {})
    assert await crud_sug.get_latest_suggestions(db) == qs


async def test_sample_boc_dung_so_luong_va_khong_trung():
    db = FakeDB()
    qs = [f"Câu {i}?" for i in range(10)]
    await crud_sug.save_suggestions(db, qs, {}, "m", {})

    out = await crud_sug.sample_suggestions(db)
    assert len(out) == crud_sug.DISPLAY_COUNT
    assert len(set(out)) == len(out), "không được lặp câu trong cùng một lượt"
    assert set(out) <= set(qs)


async def test_sample_doi_to_hop_giua_cac_lan_goi():
    """Kho 10 bốc 5 → 252 tổ hợp; 30 lượt mà ra y hệt nhau là hỏng."""
    db = FakeDB()
    await crud_sug.save_suggestions(db, [f"Câu {i}?" for i in range(10)], {}, "m", {})
    seen = {tuple(await crud_sug.sample_suggestions(db)) for _ in range(30)}
    assert len(seen) > 1


async def test_sample_kho_nho_hon_thi_tra_het_khong_loi():
    db = FakeDB()
    qs = [f"Câu {i}?" for i in range(crud_sug.DISPLAY_COUNT)]
    await crud_sug.save_suggestions(db, qs, {}, "m", {})
    assert await crud_sug.sample_suggestions(db) == qs


async def test_kho_thieu_thi_dung_fallback():
    """Bộ cũ chỉ 3 câu (dữ liệu lỗi) → không đủ để bốc → dùng fallback."""
    db = FakeDB()
    await crud_sug.save_suggestions(db, ["A?", "B?", "C?"], {}, "m", {})
    assert await crud_sug.get_latest_suggestions(db) == crud_sug.FALLBACK_SUGGESTIONS
