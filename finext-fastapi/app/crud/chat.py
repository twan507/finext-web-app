# app/crud/chat.py — persistence hội thoại + quota/kill-switch (user_db, Bước 3)
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId

from app.core.config import (
    AGENT_DAILY_TOKEN_BUDGET,
    AGENT_MSG_PER_DAY,
    AGENT_MSG_PER_MIN,
    CHAT_MAX_CONVERSATIONS,
)

logger = logging.getLogger(__name__)

CONVERSATIONS = "chat_conversations"
MESSAGES = "chat_messages"
QUOTA = "chat_quota"
GLOBAL_QUOTA_KEY = "__global__"  # sentinel: doc đếm token toàn hệ thống/ngày cho kill-switch
TITLE_MAX = 60


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> str:
    return _now().strftime("%Y-%m-%d")  # theo UTC — nhất quán với created_at toàn repo


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
    """Giữ CHAT_MAX_CONVERSATIONS hội thoại mới nhất/user; xoá lố + cascade messages."""
    olds = await (
        db[CONVERSATIONS]
        .find({"user_id": ObjectId(user_id)})
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


async def start_turn(db: Any, user_id: str, conversation_id: str | None, message: str) -> str:
    """Lưu user-msg; tạo hội thoại nếu chưa có/không thuộc user. Trả conversation_id (str)."""
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
             "created_at": now, "updated_at": now, "msg_count": 0}
        )
        conv_oid = res.inserted_id
        await _prune_conversations(db, user_id)
    await add_message(db, str(conv_oid), user_id, "user", message)
    return str(conv_oid)


async def list_conversations(db: Any, user_id: str) -> list[dict]:
    return await (
        db[CONVERSATIONS].find({"user_id": ObjectId(user_id)}).sort("updated_at", -1).to_list(length=None)
    )


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


# ── Quota (Lớp 1) + Kill-switch budget (Lớp 2) ───────────────────────────
# chat_quota.user_id = STRING (real user = str(ObjectId); global sentinel = "__global__").
@dataclass
class QuotaDecision:
    ok: bool
    status_code: int = 200
    message: str = ""


# Thông điệp thân thiện, KHÔNG lộ số trần / tên collection (K-hygiene).
_MSG_DAILY_DENY = "Bạn đã dùng hết lượt trò chuyện với Finext AI trong hôm nay. Vui lòng quay lại vào ngày mai nhé."
_MSG_RATE_DENY = "Bạn đang gửi câu hỏi hơi nhanh. Vui lòng chờ một chút rồi thử lại nhé."
_MSG_BUDGET_DENY = "Finext AI đang tạm nghỉ do đã đạt giới hạn sử dụng chung trong hôm nay. Vui lòng quay lại sau nhé."


async def _global_tokens_today(db: Any) -> int:
    doc = await db[QUOTA].find_one({"user_id": GLOBAL_QUOTA_KEY, "date": _today()})
    if not doc:
        return 0
    return int(doc.get("tok_in", 0)) + int(doc.get("tok_out", 0))


async def check_and_reserve_quota(db: Any, user_id: str) -> QuotaDecision:
    """Chặn TRƯỚC khi mở stream. Thứ tự: kill-switch budget (503, fail-closed) → daily (429)
    → per-minute (429) → reserve (+1 msg_count). Chỉ reserve khi được phép."""
    # Lớp 2 — global kill-switch (fail-closed: chạm ngưỡng là dừng, không âm thầm gọi tiếp)
    if await _global_tokens_today(db) >= AGENT_DAILY_TOKEN_BUDGET:
        return QuotaDecision(False, 503, _MSG_BUDGET_DENY)
    # Lớp 1a — per-user/ngày
    daily = await db[QUOTA].find_one({"user_id": str(user_id), "date": _today()})
    if daily and int(daily.get("msg_count", 0)) >= AGENT_MSG_PER_DAY:
        return QuotaDecision(False, 429, _MSG_DAILY_DENY)
    # Lớp 1b — per-user/phút (đếm user-msg 60s gần nhất; dùng chat_messages, không cần collection mới)
    since = _now() - timedelta(seconds=60)
    recent = await db[MESSAGES].count_documents(
        {"user_id": ObjectId(user_id), "role": "user", "created_at": {"$gte": since}}
    )
    if recent >= AGENT_MSG_PER_MIN:
        return QuotaDecision(False, 429, _MSG_RATE_DENY)
    # Reserve: +1 msg_count cho doc ngày (upsert)
    await db[QUOTA].update_one(
        {"user_id": str(user_id), "date": _today()},
        {"$inc": {"msg_count": 1}, "$setOnInsert": {"tok_in": 0, "tok_out": 0}},
        upsert=True,
    )
    return QuotaDecision(True)


async def record_usage(db: Any, user_id: str, usage: dict[str, int]) -> None:
    """Sau khi stream done: cộng token THẬT vào counter user-ngày + global-ngày (kill-switch)."""
    tok_in = int(usage.get("in", 0) or 0)
    tok_out = int(usage.get("out", 0) or 0)
    if tok_in == 0 and tok_out == 0:
        return
    for key in (str(user_id), GLOBAL_QUOTA_KEY):
        await db[QUOTA].update_one(
            {"user_id": key, "date": _today()},
            {"$inc": {"tok_in": tok_in, "tok_out": tok_out}, "$setOnInsert": {"msg_count": 0}},
            upsert=True,
        )
