# app/crud/chat.py — persistence hội thoại + quota/kill-switch (user_db, Bước 3)
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any

from bson import ObjectId

from app.core.config import (
    AGENT_ADVANCED_LICENSES,
    AGENT_ADVANCED_MULT,
    AGENT_DAILY_TOKEN_BUDGET,
    AGENT_SESSION_HOURS,
    AGENT_TOKENS_5H,
    AGENT_TOKENS_WEEK,
    AGENT_UNLIMITED_LICENSES,
    AGENT_WEEK_DAYS,
    CHAT_MAX_CONVERSATIONS,
    LLM_PRICE_CACHED,
    LLM_PRICE_INPUT,
    LLM_PRICE_OUTPUT,
)
from app.crud.subscriptions import get_active_subscription_for_user_db

logger = logging.getLogger(__name__)

CONVERSATIONS = "chat_conversations"
MESSAGES = "chat_messages"
QUOTA = "chat_quota"
GLOBAL_QUOTA_KEY = "__global__"  # sentinel: doc đếm token toàn hệ thống/ngày cho kill-switch
TITLE_MAX = 60


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Persistence: conversations & messages ────────────────────────────────
async def add_message(
    db: Any, conversation_id: str, user_id: str, role: str, content: str,
    tool_calls: list[dict] | None = None, usage: dict | None = None, interrupted: bool = False,
) -> str:
    """Chèn 1 message + bump updated_at/msg_count của hội thoại. Trả message_id (str)."""
    now = _now()
    doc: dict[str, Any] = {
        "conversation_id": ObjectId(conversation_id),
        "user_id": ObjectId(user_id),
        "role": role,
        "content": content,
        "tool_calls": tool_calls or [],
        "created_at": now,
    }
    if usage:
        doc["usage"] = usage
    if interrupted:
        doc["interrupted"] = True
    res = await db[MESSAGES].insert_one(doc)
    await db[CONVERSATIONS].update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {"updated_at": now}, "$inc": {"msg_count": 1}},
    )
    return str(res.inserted_id)


async def _prune_conversations(db: Any, user_id: str) -> None:
    """Giữ CHAT_MAX_CONVERSATIONS hội thoại KHÔNG-ghim mới nhất/user; xoá lố + cascade messages.
    Hội thoại đã ghim (pinned) MIỄN NHIỄM prune (không bao giờ tự xoá)."""
    olds = await (
        db[CONVERSATIONS]
        .find({"user_id": ObjectId(user_id), "pinned": {"$ne": True}})
        .sort("updated_at", -1)
        .skip(CHAT_MAX_CONVERSATIONS)
        .to_list(length=None)
    )
    if not olds:
        return
    old_ids = [d["_id"] for d in olds]
    await db[MESSAGES].delete_many({"conversation_id": {"$in": old_ids}})
    await db[CONVERSATIONS].delete_many({"_id": {"$in": old_ids}})
    logger.info("prune %d hội thoại cũ user_id=%s", len(old_ids), user_id)


async def start_turn(
    db: Any, user_id: str, conversation_id: str | None, message: str, source: str = "chat"
) -> str:
    """Lưu user-msg; tạo hội thoại nếu chưa có/không thuộc user. Trả conversation_id (str).

    source: "chat" (mặc định) | "portfolio" — gắn 1 lần lúc tạo doc; dùng để tách list hội thoại.
    """
    conv_oid: ObjectId | None = None
    if conversation_id and ObjectId.is_valid(conversation_id):
        existing = await db[CONVERSATIONS].find_one(
            {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)}
        )
        if existing:
            conv_oid = existing["_id"]
    if conv_oid is None:
        now = _now()
        title = message.strip()[:TITLE_MAX] or "Cuộc trò chuyện mới"
        res = await db[CONVERSATIONS].insert_one(
            {"user_id": ObjectId(user_id), "title": title,
             "created_at": now, "updated_at": now, "msg_count": 0, "pinned": False, "source": source}
        )
        conv_oid = res.inserted_id
        await _prune_conversations(db, user_id)
    await add_message(db, str(conv_oid), user_id, "user", message)
    return str(conv_oid)


async def update_title(db: Any, conversation_id: str, title: str) -> None:
    """Đặt lại tiêu đề hội thoại (AI sinh ở lượt đầu)."""
    await db[CONVERSATIONS].update_one({"_id": ObjectId(conversation_id)}, {"$set": {"title": title}})


async def set_feedback(db: Any, message_id: str, user_id: str, rating: int, reason: str | None = None) -> bool:
    """Lưu 👍/👎 (+ lý do) cho 1 message ASSISTANT của user (kiểm quyền). rating: 1 hoặc -1."""
    if not ObjectId.is_valid(message_id):
        return False
    fb: dict[str, Any] = {"rating": int(rating), "at": _now()}
    if reason:
        fb["reason"] = reason.strip()[:200]
    res = await db[MESSAGES].update_one(
        {"_id": ObjectId(message_id), "user_id": ObjectId(user_id), "role": "assistant"},
        {"$set": {"feedback": fb}},
    )
    return res.matched_count > 0


async def list_conversations(db: Any, user_id: str, source: str | None = None) -> list[dict]:
    # Ghim trước (pinned desc), rồi mới nhất trước (updated_at desc).
    # source: "portfolio" → chỉ hội thoại portfolio; "chat" → loại portfolio (gồm hội thoại cũ
    # thiếu field source); None → không lọc.
    flt: dict[str, Any] = {"user_id": ObjectId(user_id)}
    if source == "portfolio":
        flt["source"] = "portfolio"
    elif source == "chat":
        flt["source"] = {"$ne": "portfolio"}
    return await (
        db[CONVERSATIONS]
        .find(flt)
        .sort([("pinned", -1), ("updated_at", -1)])
        .to_list(length=None)
    )


async def set_pinned(db: Any, conversation_id: str, user_id: str, pinned: bool) -> bool:
    """Ghim/bỏ ghim hội thoại (kiểm quyền). True nếu hội thoại thuộc user + cập nhật."""
    if not ObjectId.is_valid(conversation_id):
        return False
    res = await db[CONVERSATIONS].update_one(
        {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)},
        {"$set": {"pinned": bool(pinned)}},
    )
    return res.matched_count > 0


async def rename_conversation(db: Any, conversation_id: str, user_id: str, title: str) -> bool:
    """User tự đổi tên hội thoại (kiểm quyền + trim + cap 120). True nếu thuộc user + tên hợp lệ."""
    if not ObjectId.is_valid(conversation_id):
        return False
    clean = title.strip()[:120]
    if not clean:
        return False
    res = await db[CONVERSATIONS].update_one(
        {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)},
        {"$set": {"title": clean}},
    )
    return res.matched_count > 0


async def get_conversation_detail(db: Any, conversation_id: str, user_id: str) -> dict | None:
    if not ObjectId.is_valid(conversation_id):
        return None
    conv = await db[CONVERSATIONS].find_one(
        {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)}
    )
    if not conv:
        return None
    conv["messages"] = await (
        db[MESSAGES].find({"conversation_id": ObjectId(conversation_id)}).sort("created_at", 1).to_list(length=None)
    )
    return conv


async def delete_conversation(db: Any, conversation_id: str, user_id: str) -> bool:
    if not ObjectId.is_valid(conversation_id):
        return False
    res = await db[CONVERSATIONS].delete_one(
        {"_id": ObjectId(conversation_id), "user_id": ObjectId(user_id)}
    )
    if res.deleted_count == 0:
        return False
    await db[MESSAGES].delete_many({"conversation_id": ObjectId(conversation_id)})
    return True


# ── Quota theo license: cửa sổ 5h (anchored) + weekly + kill-switch global 24h ──
# ĐƠN VỊ ĐẾM là "đơn vị quy đổi theo chi phí" (billable_units), KHÔNG phải token thô — mọi trần,
# mọi trường s5_tokens/wk_tokens/g_tokens trong DB đều mang đơn vị này (tên trường giữ nguyên).
# chat_quota.user_id = STRING (real user = str(ObjectId); global sentinel = "__global__").
# Doc user: {user_id, s5_start, s5_tokens, wk_start, wk_tokens}. Global: {user_id, g_start, g_tokens}.
@dataclass
class QuotaDecision:
    ok: bool
    status_code: int = 200
    message: str = ""


SESSION_DUR = timedelta(hours=AGENT_SESSION_HOURS)
WEEK_DUR = timedelta(days=AGENT_WEEK_DAYS)
DAY_DUR = timedelta(hours=24)

# Thông điệp NGẮN GỌN, KHÔNG lộ số trần / tên collection (K-hygiene). Chi tiết reset xem ở /profile/ai-usage.
_MSG_SESSION_DENY = "Bạn đã đạt giới hạn sử dụng trong phiên này."
_MSG_WEEK_DENY = "Bạn đã đạt giới hạn sử dụng trong tuần này."
_MSG_BUDGET_DENY = "Server đang quá tải, vui lòng thử lại sau."

# Cảnh báo SỚM (không chặn): nhắc user khi mức dùng vừa vượt các mốc này.
WARN_THRESHOLDS = (50, 75)
# CHỈ nói phần trăm — không số token, không số trần (K-hygiene).
_MSG_WARN = {
    "session": "Bạn đã dùng {pct}% hạn mức trong phiên này.",
    "week": "Bạn đã dùng {pct}% hạn mức trong tuần này.",
}


def _tier_limits(tier: str) -> tuple[int | None, int | None]:
    """(limit_5h, limit_week); None,None = không giới hạn."""
    if tier == "unlimited":
        return None, None
    mult = AGENT_ADVANCED_MULT if tier == "advanced" else 1
    return AGENT_TOKENS_5H * mult, AGENT_TOKENS_WEEK * mult


async def resolve_tier(db: Any, user_id: str) -> str:
    """Tier theo LICENSE đang hiệu lực (không theo role)."""
    try:
        sub = await get_active_subscription_for_user_db(db, str(user_id))
    except Exception:
        sub = None
    key = ((sub.license_key if sub else "") or "").upper()
    if key in AGENT_UNLIMITED_LICENSES:
        return "unlimited"
    if key in AGENT_ADVANCED_LICENSES:
        return "advanced"
    return "standard"


def _as_utc(value: Any) -> datetime | None:
    """Mốc thời gian đọc từ Mongo là naive (giá trị đã là UTC nhưng driver bỏ tzinfo).
    Gắn lại UTC để so sánh được với _now() — thiếu bước này là TypeError, sập cả lượt chat."""
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _window_used(start: Any, used: Any, now: datetime, dur: timedelta) -> tuple[int, datetime | None]:
    """(token đã dùng trong cửa sổ còn hiệu lực, reset_at). Cửa sổ hết hạn/chưa có → (0, None)."""
    start = _as_utc(start)
    if not start or now >= start + dur:
        return 0, None
    return int(used or 0), start + dur


async def check_quota(db: Any, user_id: str) -> QuotaDecision:
    """Chặn TRƯỚC stream: global kill-switch (503) → 5h (429) → weekly (429). Unlimited bỏ qua per-user.
    KHÔNG reserve token ở đây (token thật cộng ở record_usage sau khi done)."""
    now = _now()
    # Cầu dao global TẮT khi trần <= 0. Bắt buộc phải kiểm trước: nếu không, "đã dùng 0 >= trần 0"
    # là đúng, và MỌI request sẽ bị chặn 503 ngay từ lượt đầu.
    if AGENT_DAILY_TOKEN_BUDGET > 0:
        g = await db[QUOTA].find_one({"user_id": GLOBAL_QUOTA_KEY})
        g_used, _ = _window_used(g.get("g_start") if g else None, g.get("g_tokens") if g else 0, now, DAY_DUR)
        if g_used >= AGENT_DAILY_TOKEN_BUDGET:
            return QuotaDecision(False, 503, _MSG_BUDGET_DENY)
    tier = await resolve_tier(db, user_id)
    lim5, limw = _tier_limits(tier)
    if lim5 is None:
        return QuotaDecision(True)
    doc = await db[QUOTA].find_one({"user_id": str(user_id)}) or {}
    used5, _ = _window_used(doc.get("s5_start"), doc.get("s5_tokens"), now, SESSION_DUR)
    if used5 >= lim5:
        return QuotaDecision(False, 429, _MSG_SESSION_DENY)
    usedw, _ = _window_used(doc.get("wk_start"), doc.get("wk_tokens"), now, WEEK_DUR)
    if usedw >= limw:
        return QuotaDecision(False, 429, _MSG_WEEK_DENY)
    return QuotaDecision(True)


def billable_units(usage: dict[str, int]) -> int:
    """usage của 1 lượt → ĐƠN VỊ QUY ĐỔI THEO CHI PHÍ (1 đơn vị = 1 token input giá thường).

    Đếm token thô (in+out) làm user bị trừ hạn mức gấp nhiều lần chi phí thật, vì ~99% token đầu vào
    là cache hit (rẻ hơn 5 lần) trong khi output đắt hơn 4 lần. Quy đổi theo giá cho công bằng.

    Quy ước usage (mọi adapter tuân thủ): "in" = TỔNG token đầu vào (ĐÃ gồm phần cache),
    "cache_read" = phần trong đó là cache hit. Thiếu khoá "cache_read" → coi như 0 (tương thích ngược
    với nhà cung cấp không báo cache). Giá trị âm/vượt ngưỡng bị kẹp về biên hợp lệ.
    """
    total_in = max(0, int(usage.get("in", 0) or 0))
    out = max(0, int(usage.get("out", 0) or 0))
    cache_read = min(max(0, int(usage.get("cache_read", 0) or 0)), total_in)
    uncached = total_in - cache_read
    units = (
        uncached * 1.0
        + cache_read * (LLM_PRICE_CACHED / LLM_PRICE_INPUT)
        + out * (LLM_PRICE_OUTPUT / LLM_PRICE_INPUT)
    )
    return ceil(units)


def crossed_threshold(before: int, after: int, limit: int) -> int | None:
    """Mốc % CAO NHẤT mà lượt này vừa vượt qua: trước lượt còn dưới mốc, sau lượt đã chạm/vượt.

    Đây cũng là cơ chế chống nhắc lại: lượt sau `before` đã nằm trên mốc nên không mốc nào
    thoả điều kiện nữa → im lặng cho tới khi chạm mốc kế tiếp (hoặc cửa sổ reset về 0).
    """
    if limit <= 0:
        return None
    for pct in sorted(WARN_THRESHOLDS, reverse=True):
        need = pct * limit / 100
        if before < need <= after:
            return pct
    return None


async def _quota_warning(
    db: Any, user_id: str, used5: tuple[int, int], usedw: tuple[int, int]
) -> dict[str, Any] | None:
    """Cảnh báo sớm cho lượt vừa rồi, từ cặp (trước, sau) của mỗi cửa sổ. None = không nhắc.

    Ưu tiên PHIÊN hơn TUẦN (phiên chặn sớm hơn nên gấp hơn); vượt cả 50 lẫn 75 trong một lượt
    thì báo mốc cao. Gói không giới hạn không bao giờ bị nhắc."""
    tier = await resolve_tier(db, user_id)
    lim5, limw = _tier_limits(tier)
    if lim5 is None or limw is None:
        return None
    for window, (before, after), limit in (("session", used5, lim5), ("week", usedw, limw)):
        pct = crossed_threshold(before, after, limit)
        if pct is not None:
            return {"threshold": pct, "window": window, "message": _MSG_WARN[window].format(pct=pct)}
    return None


async def _bump_window(db: Any, key: str, start_f: str, tok_f: str, now: datetime, dur: timedelta, tok: int) -> int:
    """Cộng tok vào một cửa sổ anchored bằng thao tác NGUYÊN TỬ, trả về tổng sau khi cộng.

    Trước đây là read-compute-$set: hai lượt kết thúc gần nhau (cùng worker interleave
    tại await, hoặc khác worker) sẽ ghi đè nhau và làm mất token của một lượt. Với cầu
    dao ngân sách global thì đó là đếm thiếu đúng thứ đang bảo vệ chi phí.

    $inc chỉ áp khi cửa sổ còn hạn (start > now - dur). Không khớp nghĩa là cửa sổ đã
    hết hạn hoặc chưa có doc → mở cửa sổ mới.
    """
    res = await db[QUOTA].update_one(
        {"user_id": key, start_f: {"$gt": now - dur}},
        {"$inc": {tok_f: tok}},
    )
    if res.modified_count == 0:
        await db[QUOTA].update_one(
            {"user_id": key},
            {"$set": {start_f: now, tok_f: tok}},
            upsert=True,
        )
        return tok
    doc = await db[QUOTA].find_one({"user_id": key}) or {}
    return int(doc.get(tok_f) or 0)


async def record_usage(db: Any, user_id: str, usage: dict[str, int]) -> dict[str, Any] | None:
    """Sau done: cộng ĐƠN VỊ QUY ĐỔI (billable_units) vào cửa sổ 5h + weekly của user + global 24h.
    Mọi trần (AGENT_TOKENS_5H/WEEK, AGENT_DAILY_TOKEN_BUDGET) đều hiểu theo cùng đơn vị này.

    Trả về cảnh báo sớm {threshold, window, message} nếu lượt này VỪA vượt mốc %, ngược lại None."""
    tok = billable_units(usage)
    if tok <= 0:
        return None
    now = _now()
    doc = await db[QUOTA].find_one({"user_id": str(user_id)}) or {}
    # Mức đã dùng TRƯỚC lượt này (cửa sổ hết hạn → 0), đọc từ chính doc cũ vừa lấy — không truy vấn thêm.
    used5_before, _ = _window_used(doc.get("s5_start"), doc.get("s5_tokens"), now, SESSION_DUR)
    usedw_before, _ = _window_used(doc.get("wk_start"), doc.get("wk_tokens"), now, WEEK_DUR)
    s5_tokens = await _bump_window(db, str(user_id), "s5_start", "s5_tokens", now, SESSION_DUR, tok)
    wk_tokens = await _bump_window(db, str(user_id), "wk_start", "wk_tokens", now, WEEK_DUR, tok)
    await _bump_window(db, GLOBAL_QUOTA_KEY, "g_start", "g_tokens", now, DAY_DUR, tok)
    return await _quota_warning(db, user_id, (used5_before, s5_tokens), (usedw_before, wk_tokens))


async def quota_status(db: Any, user_id: str) -> dict[str, Any]:
    """Cho trang /profile: tier + usage 5h/weekly + reset_at ISO."""
    now = _now()
    tier = await resolve_tier(db, user_id)
    lim5, limw = _tier_limits(tier)
    if lim5 is None:
        return {"tier": tier, "unlimited": True, "session": None, "weekly": None}
    doc = await db[QUOTA].find_one({"user_id": str(user_id)}) or {}
    used5, reset5 = _window_used(doc.get("s5_start"), doc.get("s5_tokens"), now, SESSION_DUR)
    usedw, resetw = _window_used(doc.get("wk_start"), doc.get("wk_tokens"), now, WEEK_DUR)
    return {
        "tier": tier,
        "unlimited": False,
        "session": {"used": used5, "limit": lim5, "reset_at": reset5.isoformat() if reset5 else None},
        "weekly": {"used": usedw, "limit": limw, "reset_at": resetw.isoformat() if resetw else None},
    }
