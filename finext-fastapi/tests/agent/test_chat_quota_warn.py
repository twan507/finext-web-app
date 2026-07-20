"""Cảnh báo sớm hạn mức (50%/75%): chỉ báo ĐÚNG lượt vừa vượt mốc, không nhắc lại."""
import asyncio

from bson import ObjectId

import app.crud.chat as crud
import app.routers.chat as chat_router
from app.agent.gateway.types import GatewayContext
from app.schemas.chat import ChatStreamRequest
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())

LIM5 = crud.AGENT_TOKENS_5H  # trần phiên 5h (standard)
LIMW = crud.AGENT_TOKENS_WEEK  # trần tuần (standard)


def _units(n: int) -> dict[str, int]:
    """usage cho đúng n đơn vị quy đổi (input không cache = ×1)."""
    return {"in": n, "out": 0}


def _standard(monkeypatch) -> None:
    async def _tier(db, uid):
        return "standard"
    monkeypatch.setattr(crud, "resolve_tier", _tier)


async def _seed(db: FakeDB, s5: int = 0, wk: int = 0) -> None:
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now(), "s5_tokens": s5, "wk_start": crud._now(), "wk_tokens": wk}
    )


# ── Hàm thuần phát hiện vượt mốc ─────────────────────────────────────────
def test_crossed_threshold_chua_toi_moc():
    assert crud.crossed_threshold(0, 400, 1000) is None


def test_crossed_threshold_vua_cham_moc_50():
    assert crud.crossed_threshold(400, 500, 1000) == 50  # chạm đúng mốc cũng tính là vượt


def test_crossed_threshold_khong_nhac_lai_khi_da_o_tren_moc():
    """Lượt trước đã 60%, lượt này 70% — vẫn trên 50 nhưng KHÔNG được báo lại."""
    assert crud.crossed_threshold(600, 700, 1000) is None


def test_crossed_threshold_nhay_qua_ca_hai_moc_lay_moc_cao():
    assert crud.crossed_threshold(400, 800, 1000) == 75


def test_crossed_threshold_tran_khong_hop_le():
    assert crud.crossed_threshold(0, 999, 0) is None


# ── record_usage trả cảnh báo ────────────────────────────────────────────
async def test_khong_bao_khi_chua_toi_moc(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    warn = await crud.record_usage(db, USER, _units(LIM5 // 10))  # 10% phiên
    assert warn is None


async def test_bao_50_khi_vua_vuot_moc_phien(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4))  # 40% → +20% = 60%
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.2)))
    assert warn is not None
    assert warn["threshold"] == 50 and warn["window"] == "session"
    assert warn["message"] == "Bạn đã dùng 50% hạn mức trong phiên này."


async def test_khong_bao_lai_o_luot_sau_khi_van_tren_50(monkeypatch):
    """60% → 70%: vẫn trên mốc 50 nhưng chưa tới 75 → im lặng (chống spam mỗi lượt)."""
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.6))
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.1)))
    assert warn is None


async def test_nhay_tu_40_len_80_bao_moc_75(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4))
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.4)))
    assert warn is not None
    assert warn["threshold"] == 75 and warn["window"] == "session"


async def test_moc_tuan_dung_chu_tuan(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    # Phiên mới toanh (không vượt mốc nào) nhưng tuần 49% → 51%.
    await _seed(db, s5=0, wk=int(LIMW * 0.49))
    warn = await crud.record_usage(db, USER, _units(int(LIMW * 0.02)))
    assert warn is not None
    assert warn["window"] == "week"
    assert warn["message"] == "Bạn đã dùng 50% hạn mức trong tuần này."


async def test_vuot_ca_hai_cua_so_uu_tien_phien(monkeypatch):
    """Phiên chặn sớm hơn tuần nên gấp hơn → chỉ báo phiên."""
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4), wk=int(LIMW * 0.49))
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.2)))
    assert warn is not None
    assert warn["window"] == "session" and warn["threshold"] == 50


async def test_unlimited_khong_bao_gio_canh_bao(monkeypatch):
    async def _tier(db, uid):
        return "unlimited"
    monkeypatch.setattr(crud, "resolve_tier", _tier)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4), wk=int(LIMW * 0.49))
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 10)))
    assert warn is None


async def test_cua_so_het_han_reset_ve_0_thi_khong_bao(monkeypatch):
    """Cửa sổ 5h cũ đã hết hạn → mức trước tính là 0, lượt nhỏ không được coi là vượt mốc."""
    from datetime import timedelta
    _standard(monkeypatch)
    db = FakeDB()
    await db[crud.QUOTA].insert_one(
        {"user_id": USER, "s5_start": crud._now() - timedelta(hours=6), "s5_tokens": int(LIM5 * 0.9)}
    )
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.1)))
    assert warn is None


async def test_thong_diep_khong_lo_so_token_hay_tran(monkeypatch):
    """K-hygiene: chỉ được nói phần trăm, cấm lộ số đơn vị / số trần."""
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4))
    warn = await crud.record_usage(db, USER, _units(int(LIM5 * 0.2)))
    assert warn is not None
    msg = warn["message"]
    assert str(LIM5) not in msg and str(int(LIM5 * 0.6)) not in msg
    assert "token" not in msg.lower() and crud.QUOTA not in msg


# ── Đường đi SSE: _persist_answer emit 'quota_warn' ──────────────────────
async def _run_produce(monkeypatch, db, usage: dict[str, int]) -> list[str]:
    async def _fake_run_agent(*, emit, **kwargs):
        await emit("token", {"text": "câu trả lời"})
        await emit("done", {"usage": usage, "truncated": False})

    async def _blocks(gateway, ctx):
        from app.agent.adapters.base import SystemBlock
        return [SystemBlock(text="stub", cache_hint=True)], None

    monkeypatch.setattr(chat_router, "build_gateway", lambda: None)
    monkeypatch.setattr(chat_router, "build_adapter", lambda **_: None)
    monkeypatch.setattr(chat_router, "build_system_blocks", _blocks)
    monkeypatch.setattr(chat_router, "run_agent", _fake_run_agent)
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)

    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, ChatStreamRequest(message="câu hỏi"),
                               GatewayContext(request_id="rw", user_id=USER), conv_id)
    frames = []
    while True:
        f = await queue.get()
        if f is None:
            break
        frames.append(f)
    return frames


async def test_produce_emit_quota_warn_khi_vuot_moc(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    await _seed(db, s5=int(LIM5 * 0.4))
    frames = await _run_produce(monkeypatch, db, _units(int(LIM5 * 0.2)))
    warn_frames = [f for f in frames if '"type": "quota_warn"' in f]
    assert len(warn_frames) == 1
    assert '"threshold": 50' in warn_frames[0] and '"window": "session"' in warn_frames[0]
    # Vẫn phải giữ nguyên các frame cũ (không phá luồng hiện có).
    assert any('"type": "done"' in f for f in frames)
    assert any('"type": "message_saved"' in f for f in frames)


async def test_produce_khong_emit_quota_warn_khi_chua_toi_moc(monkeypatch):
    _standard(monkeypatch)
    db = FakeDB()
    frames = await _run_produce(monkeypatch, db, _units(int(LIM5 * 0.1)))
    assert not any('"type": "quota_warn"' in f for f in frames)
