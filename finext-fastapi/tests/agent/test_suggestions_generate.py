"""Sinh gợi ý: bỏ nhịp khi budget cạn, không publish khi validate trượt."""
import json

import app.agent.suggestions as sug
import app.crud.chat_suggestions as crud_sug
from tests.crud._fake_mongo import FakeDB

GOOD = [
    "Thị trường hôm nay diễn biến ra sao?",
    "Nhóm thép biến động thế nào phiên nay?",
    "HPG đang ở trạng thái nào?",
    "Nhóm ngành nào đang dẫn dắt?",
    "Thị trường đang ở pha nào?",
]


def _patch_sources(monkeypatch, stock_rows=None):
    async def _fake_sources(db):
        return (
            [{"date": "2026-07-22", "final_phase": "Tăng giá"}],
            stock_rows if stock_rows is not None else [{"ticker": "HPG", "pct_change": 5.0, "industry_name": "Thép"}],
            [{"title": "Tin A"}],
        )

    monkeypatch.setattr(sug, "_load_sources", _fake_sources)


def _patch_llm(monkeypatch, output: str):
    async def _fake_complete(adapter, system, messages, usage):
        usage.update({"in": 100, "out": 50})
        return output

    monkeypatch.setattr(sug, "_complete", _fake_complete)
    monkeypatch.setattr(sug, "build_adapter", lambda thinking=None: object())


async def test_publish_khi_output_hop_le(monkeypatch):
    db = FakeDB()
    _patch_sources(monkeypatch)
    _patch_llm(monkeypatch, json.dumps(GOOD, ensure_ascii=False))

    assert await sug.generate_and_store(db) is True
    assert await crud_sug.get_latest_suggestions(db) == GOOD


async def test_khong_publish_khi_validate_truot(monkeypatch):
    db = FakeDB()
    _patch_sources(monkeypatch)
    # "VIC" không có trong snapshot → validate trượt
    bad = list(GOOD)
    bad[2] = "VIC đang ở trạng thái nào?"
    _patch_llm(monkeypatch, json.dumps(bad, ensure_ascii=False))

    assert await sug.generate_and_store(db) is False
    assert db[crud_sug.SUGGESTIONS_COLLECTION].docs == []


async def test_khong_publish_khi_llm_tra_rong(monkeypatch):
    db = FakeDB()
    _patch_sources(monkeypatch)
    _patch_llm(monkeypatch, "")

    assert await sug.generate_and_store(db) is False
    assert db[crud_sug.SUGGESTIONS_COLLECTION].docs == []


async def test_bo_nhip_khi_budget_global_da_can(monkeypatch):
    db = FakeDB()
    _patch_sources(monkeypatch)

    called = {"llm": False}

    async def _should_not_run(*a, **kw):
        called["llm"] = True
        return json.dumps(GOOD, ensure_ascii=False)

    monkeypatch.setattr(sug, "_complete", _should_not_run)
    monkeypatch.setattr(sug, "build_adapter", lambda thinking=None: object())
    monkeypatch.setattr(sug, "AGENT_DAILY_TOKEN_BUDGET", 1000)
    await db[crud_sug.SUGGESTIONS_COLLECTION].insert_one({"placeholder": True})
    # Bộ đếm global đã vượt trần
    await db["chat_quota"].insert_one({"user_id": "__global__", "g_start": sug._now(), "g_tokens": 5000})

    assert await sug.generate_and_store(db) is False
    assert called["llm"] is False, "không được gọi LLM khi budget đã cạn"


async def test_token_khong_tinh_vao_quota_user_nao(monkeypatch):
    db = FakeDB()
    _patch_sources(monkeypatch)
    _patch_llm(monkeypatch, json.dumps(GOOD, ensure_ascii=False))

    await sug.generate_and_store(db)

    quota_docs = db["chat_quota"].docs
    # Chỉ có document global, không có document nào mang user_id thật.
    assert all(d.get("user_id") == "__global__" for d in quota_docs)
    assert any(d.get("g_tokens", 0) > 0 for d in quota_docs), "chi phí phải hiện ở bộ đếm global"
