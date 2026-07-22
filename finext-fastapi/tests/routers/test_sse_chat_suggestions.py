"""Keyword chat_suggestions phải có trong registry và luôn trả 5 câu."""
import app.crud.chat_suggestions as crud_sug
from app.crud.sse import SSE_QUERY_REGISTRY
from app.crud.sse.chat_suggestions import chat_suggestions
from tests.crud._fake_mongo import FakeDB


def test_keyword_da_dang_ky():
    assert "chat_suggestions" in SSE_QUERY_REGISTRY


async def test_tra_fallback_khi_chua_co_du_lieu(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr("app.crud.sse.chat_suggestions.get_database", lambda name: db)

    out = await chat_suggestions()

    # Endpoint BỐC NGẪU NHIÊN nên chỉ khẳng định: đúng số câu và đều lấy từ fallback.
    assert len(out["questions"]) == crud_sug.DISPLAY_COUNT
    assert set(out["questions"]) <= set(crud_sug.FALLBACK_SUGGESTIONS)


async def test_tra_bo_moi_nhat_khi_da_co(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr("app.crud.sse.chat_suggestions.get_database", lambda name: db)
    qs = [f"Câu {i}?" for i in range(10)]
    await crud_sug.save_suggestions(db, qs, {}, "m", {})

    out = await chat_suggestions()

    assert len(out["questions"]) == crud_sug.DISPLAY_COUNT
    assert set(out["questions"]) <= set(qs), "chỉ được bốc từ kho vừa lưu"
