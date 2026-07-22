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
    assert len(out) == 5


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
