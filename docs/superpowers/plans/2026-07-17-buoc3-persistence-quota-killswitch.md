# Bước 3 — Persistence · Quota · Kill-switch Budget (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu hội thoại vào `user_db`, chặn quota 60 msg/user/ngày (429), và kill-switch token budget GLOBAL fail-closed ("AI tạm nghỉ") — go-live blocker chống cháy tiền token.

**Architecture:** Persistence chạy **sidecar** quanh đường stream hiện có (KHÔNG đụng `run_agent`/loop coherence+dedup vừa tinh chỉnh): quota gate + lưu user-msg TRƯỚC khi mở stream; thu câu trả lời + usage qua wrapper của `emit`, lưu assistant-msg + cộng token counter khi thấy `done`. Contract giữ **client-held history** (FE gửi `history` như cũ). REST phụ (không stream) để liệt kê/xem/xoá hội thoại.

**Tech Stack:** FastAPI + Motor (MongoDB standalone `user_db`), Pydantic v2, pytest + pytest-asyncio (fake Mongo tự viết — KHÔNG thêm dep).

## Global Constraints

- **Phạm vi chốt (owner 2026-07-17):** backend + REST ONLY. HOÃN: FE wiring (sidebar tải DB), `agent_user_profile` (Bước 4), concurrency semaphore Lớp 3, feedback 👍👎. KHÔNG làm ngoài phạm vi này.
- **Contract history = sidecar:** KHÔNG đổi `ChatStreamRequest.history`/`_messages_from`; KHÔNG sửa `app/agent/loop.py` hay logic agent. Persistence là lớp bọc ngoài.
- **Collections (`user_db` only):** `chat_conversations`, `chat_messages`, `chat_quota`. Tên hằng: `CONVERSATIONS="chat_conversations"`, `MESSAGES="chat_messages"`, `QUOTA="chat_quota"`.
- **Kiểu `user_id`:** `chat_conversations.user_id` + `chat_messages.user_id` = `ObjectId` (theo pattern watchlists). `chat_quota.user_id` = **string** (cho phép sentinel global `"__global__"`). Ghi rõ trong comment.
- **usage schema:** dict `{"in": N, "out": M}` (khớp `DoneEvent.usage` từ adapter + doc 08 §3). record_usage đọc key `"in"`/`"out"`.
- **Quota số (env, default trong code):** `AGENT_MSG_PER_DAY=60`, `AGENT_MSG_PER_MIN=6`, `AGENT_DAILY_TOKEN_BUDGET=4_000_000`, `CHAT_MAX_CONVERSATIONS=50`.
- **HTTP mã lỗi:** hết lượt ngày/phút → **429**; kill-switch budget → **503**. Thông điệp tiếng Việt thân thiện, KHÔNG lộ số/tên collection (K-hygiene).
- **Lifecycle:** user-msg lưu TRƯỚC stream; assistant-msg + record_usage CHỈ khi `done` (lỗi/huỷ → KHÔNG lưu assistant → FE thấy user-msg trống reply → "Thử lại"). `interrupted` field để dành, v1 chưa set.
- **Layering:** `routers/ → crud/ → schemas/`. crud KHÔNG raise HTTPException (trả `QuotaDecision`/bool/None; router dịch sang HTTP — như pattern watchlists dùng ValueError).
- **Persistence best-effort:** lưu assistant-msg/record_usage bọc try/except log — bug lưu KHÔNG được làm hỏng câu trả lời đang chạy.
- **KHÔNG thêm dependency** (owner duyệt). **KHÔNG sửa `.env*`.** Comment tiếng Việt theo style repo.
- **Test verify:** `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/<file> -v`. Toàn bộ: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest -q 2>&1 | tail -20; echo "rc=${PIPESTATUS[0]}"` — rc=0.
- **Commit:** CHỈ khi owner bảo. **Push:** CHỈ khi owner cho phép rõ. (Plan này chỉ code + test, chưa commit tự động trừ khi owner nói.)

---

## File Structure

- `app/core/config.py` (MODIFY) — thêm 4 hằng env trong mục Agent.
- `app/core/database.py` (MODIFY) — thêm indexes 3 collection chat vào block `user_db`.
- `app/schemas/chat.py` (MODIFY) — thêm `ToolCallMeta`, `ConversationSummary`, `MessagePublic`, `ConversationDetail`. Giữ nguyên `ChatTurn`/`ChatStreamRequest`.
- `app/crud/chat.py` (CREATE) — persistence (conversations/messages/prune) + quota/kill-switch (`check_and_reserve_quota`, `record_usage`, `QuotaDecision`).
- `app/routers/chat.py` (MODIFY) — quota gate + start_turn trước stream; `_AnswerCollector` + persist khi done; 3 REST endpoints.
- `tests/agent/_fake_mongo.py` (CREATE) — fake Mongo async tối giản dùng chung cho test crud.
- `tests/agent/test_chat_crud.py` (CREATE) — persistence + prune (Task 3).
- `tests/agent/test_chat_quota.py` (CREATE) — quota 429 + per-minute + kill-switch 503 + record_usage (Task 4).
- `tests/agent/test_chat_persistence_flow.py` (CREATE) — _produce lưu assistant on done / không lưu on error + quota gate router (Task 5).
- `tests/agent/test_chat_rest.py` (CREATE) — REST list/detail/delete + ownership 404 (Task 6).

---

## Task 1: Config env + DB indexes

**Files:**
- Modify: `app/core/config.py` (sau dòng `AGENT_PACK_DIR = ...`, mục "--- Agent / LLM Configuration ---")
- Modify: `app/core/database.py` (trong block `user_db`, sau `uploads` indexes, trước `logger.info("Đã đảm bảo...")`)
- Test: `tests/agent/test_chat_config.py` (Create)

**Interfaces:**
- Produces: `app.core.config.AGENT_MSG_PER_DAY: int`, `AGENT_MSG_PER_MIN: int`, `AGENT_DAILY_TOKEN_BUDGET: int`, `CHAT_MAX_CONVERSATIONS: int`.

- [ ] **Step 1: Write the failing test**

Create `tests/agent/test_chat_config.py`:

```python
from app.core import config


def test_chat_quota_defaults_present_and_positive():
    assert config.AGENT_MSG_PER_DAY == 60
    assert config.AGENT_MSG_PER_MIN == 6
    assert config.AGENT_DAILY_TOKEN_BUDGET == 4_000_000
    assert config.CHAT_MAX_CONVERSATIONS == 50
    for v in (config.AGENT_MSG_PER_DAY, config.AGENT_MSG_PER_MIN,
              config.AGENT_DAILY_TOKEN_BUDGET, config.CHAT_MAX_CONVERSATIONS):
        assert isinstance(v, int) and v > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_config.py -v`
Expected: FAIL (AttributeError: module has no attribute 'AGENT_MSG_PER_DAY')

- [ ] **Step 3: Add config constants**

Trong `app/core/config.py`, ngay sau dòng `AGENT_PACK_DIR = os.getenv("AGENT_PACK_DIR")  # None → dùng pack stub trong repo`:

```python

# --- Chat persistence / quota / kill-switch (Bước 3) ---
# Số lấy default trong code; owner chỉnh qua env sau 2 tuần chạy nhóm nhỏ (doc 03 §4-5).
AGENT_MSG_PER_DAY = int(os.getenv("AGENT_MSG_PER_DAY") or 60)  # trần msg/user/ngày → vượt trả 429
AGENT_MSG_PER_MIN = int(os.getenv("AGENT_MSG_PER_MIN") or 6)  # trần msg/user/phút → vượt trả 429
AGENT_DAILY_TOKEN_BUDGET = int(os.getenv("AGENT_DAILY_TOKEN_BUDGET") or 4_000_000)  # kill-switch global/ngày (token)
CHAT_MAX_CONVERSATIONS = int(os.getenv("CHAT_MAX_CONVERSATIONS") or 50)  # giữ N hội thoại mới nhất/user (prune)
```

- [ ] **Step 4: Add DB indexes**

Trong `app/core/database.py`, ngay sau block `uploads` indexes (dòng `await db.uploads.create_index("object_name", unique=True)`), thêm:

```python

            # chat collections indexes (agent — Bước 3)
            await db.chat_conversations.create_index([("user_id", 1), ("updated_at", -1)])
            await db.chat_messages.create_index([("conversation_id", 1), ("created_at", 1)])
            await db.chat_messages.create_index([("user_id", 1), ("created_at", -1)])  # rate-limit đếm msg/phút
            await db.chat_quota.create_index([("user_id", 1), ("date", 1)], unique=True)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_config.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/core/config.py app/core/database.py tests/agent/test_chat_config.py
git commit -m "feat(chat): env quota/budget + indexes chat collections (Bước 3 T1)"
```

---

## Task 2: Schemas cho persistence + REST

**Files:**
- Modify: `app/schemas/chat.py`
- Test: `tests/agent/test_chat_schemas.py` (Create)

**Interfaces:**
- Produces: `ToolCallMeta`, `ConversationSummary`, `MessagePublic`, `ConversationDetail` trong `app.schemas.chat`. Tất cả `populate_by_name=True` (nhận `_id` alias + tên field). Giữ nguyên `ChatTurn`, `ChatStreamRequest`.

- [ ] **Step 1: Write the failing test**

Create `tests/agent/test_chat_schemas.py`:

```python
from datetime import datetime, timezone

from bson import ObjectId

from app.schemas.chat import ConversationDetail, ConversationSummary, MessagePublic


def _now():
    return datetime.now(timezone.utc)


def test_conversation_summary_from_mongo_doc():
    doc = {"_id": ObjectId(), "user_id": ObjectId(), "title": "FPT", "created_at": _now(),
           "updated_at": _now(), "msg_count": 3}
    s = ConversationSummary.model_validate(doc)
    assert s.title == "FPT" and s.msg_count == 3
    assert isinstance(s.id, str)  # PyObjectId serialize thành str


def test_message_public_defaults_and_tool_calls():
    doc = {"_id": ObjectId(), "role": "assistant", "content": "xin chào",
           "tool_calls": [{"name": "db_find", "args_summary": "stock_snapshot FPT", "ok": True, "ms": 12}],
           "usage": {"in": 100, "out": 20}, "created_at": _now()}
    m = MessagePublic.model_validate(doc)
    assert m.role == "assistant" and m.tool_calls[0].name == "db_find"
    assert m.usage == {"in": 100, "out": 20} and m.interrupted is False


def test_message_public_minimal_user_msg():
    doc = {"_id": ObjectId(), "role": "user", "content": "hi", "created_at": _now()}
    m = MessagePublic.model_validate(doc)
    assert m.tool_calls == [] and m.usage is None


def test_conversation_detail_nests_messages():
    conv = {"_id": ObjectId(), "user_id": ObjectId(), "title": "T", "created_at": _now(),
            "updated_at": _now(), "msg_count": 1,
            "messages": [{"_id": ObjectId(), "role": "user", "content": "hi", "created_at": _now()}]}
    d = ConversationDetail.model_validate(conv)
    assert len(d.messages) == 1 and d.messages[0].content == "hi"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_schemas.py -v`
Expected: FAIL (ImportError: cannot import ConversationDetail)

- [ ] **Step 3: Add schemas**

Trong `app/schemas/chat.py`, thêm ở đầu file các import cần thiết và các class ở cuối file (KHÔNG xoá `ChatTurn`/`ChatStreamRequest`):

Thêm/mở rộng import ở đầu:

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.utils.types import PyObjectId
```

Thêm ở cuối file:

```python


# ── Persistence / REST (Bước 3) ─────────────────────────────────────────
class ToolCallMeta(BaseModel):
    name: str
    args_summary: str = ""
    ok: bool = True
    ms: int = 0


class ConversationSummary(BaseModel):
    id: PyObjectId = Field(alias="_id")
    title: str
    created_at: datetime
    updated_at: datetime
    msg_count: int = 0

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class MessagePublic(BaseModel):
    id: PyObjectId = Field(alias="_id")
    role: Literal["user", "assistant"]
    content: str
    tool_calls: list[ToolCallMeta] = Field(default_factory=list)
    usage: dict[str, int] | None = None
    interrupted: bool = False
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ConversationDetail(ConversationSummary):
    messages: list[MessagePublic] = Field(default_factory=list)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_schemas.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add app/schemas/chat.py tests/agent/test_chat_schemas.py
git commit -m "feat(chat): schemas Conversation/Message cho persistence+REST (Bước 3 T2)"
```

---

## Task 3: crud/chat.py — persistence conversations & messages + prune

**Files:**
- Create: `app/crud/chat.py`
- Create: `tests/agent/_fake_mongo.py`
- Test: `tests/agent/test_chat_crud.py`

**Interfaces:**
- Consumes: `app.core.config.CHAT_MAX_CONVERSATIONS` (Task 1).
- Produces (trong `app.crud.chat`):
  - `start_turn(db, user_id: str, conversation_id: str | None, message: str) -> str` — lưu user-msg, tạo hội thoại nếu cần (title=60 ký tự đầu), prune, trả conversation_id (str).
  - `add_message(db, conversation_id: str, user_id: str, role: str, content: str, tool_calls: list[dict] | None = None, usage: dict | None = None, interrupted: bool = False) -> str`
  - `list_conversations(db, user_id: str) -> list[dict]` (sort updated_at desc)
  - `get_conversation_detail(db, conversation_id: str, user_id: str) -> dict | None` (kèm `messages`, kiểm quyền)
  - `delete_conversation(db, conversation_id: str, user_id: str) -> bool` (cascade messages)
  - Hằng: `CONVERSATIONS`, `MESSAGES`, `QUOTA`, `GLOBAL_QUOTA_KEY`.
- Produces (trong `tests.agent._fake_mongo`): `FakeDB` (async), `FakeCollection`.

- [ ] **Step 1: Write the fake Mongo helper**

Create `tests/agent/_fake_mongo.py`:

```python
"""Fake Mongo async tối giản cho test crud/chat — CHỈ hỗ trợ ops crud dùng.
Không thay Mongo thật; đủ test logic prune/quota/persistence không cần DB.
Hỗ trợ filter: eq + $gte/$gt/$lte/$lt/$in/$ne; update: $set/$inc/$setOnInsert (upsert)."""
from __future__ import annotations

from typing import Any

from bson import ObjectId


def _matches(doc: dict, flt: dict) -> bool:
    for key, cond in flt.items():
        val = doc.get(key)
        if isinstance(cond, dict) and any(str(op).startswith("$") for op in cond):
            for op, operand in cond.items():
                if op == "$gte" and not (val is not None and val >= operand):
                    return False
                if op == "$gt" and not (val is not None and val > operand):
                    return False
                if op == "$lte" and not (val is not None and val <= operand):
                    return False
                if op == "$lt" and not (val is not None and val < operand):
                    return False
                if op == "$in" and val not in operand:
                    return False
                if op == "$ne" and val == operand:
                    return False
        elif val != cond:
            return False
    return True


class _Result:
    def __init__(self, **kw: Any) -> None:
        self.__dict__.update(kw)


class _Cursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    def sort(self, field: str, direction: int = 1) -> "_Cursor":
        self._docs = sorted(self._docs, key=lambda d: d.get(field), reverse=direction < 0)
        return self

    def skip(self, n: int) -> "_Cursor":
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int) -> "_Cursor":
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        docs = self._docs if length is None else self._docs[:length]
        return [dict(d) for d in docs]


class FakeCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict) -> _Result:
        d = dict(doc)
        d.setdefault("_id", ObjectId())
        self.docs.append(d)
        return _Result(inserted_id=d["_id"])

    async def find_one(self, flt: dict, projection: Any = None) -> dict | None:
        for d in self.docs:
            if _matches(d, flt):
                return dict(d)
        return None

    def find(self, flt: dict | None = None) -> _Cursor:
        flt = flt or {}
        return _Cursor([dict(d) for d in self.docs if _matches(d, flt)])

    async def count_documents(self, flt: dict) -> int:
        return sum(1 for d in self.docs if _matches(d, flt))

    async def update_one(self, flt: dict, update: dict, upsert: bool = False) -> _Result:
        target = next((d for d in self.docs if _matches(d, flt)), None)
        if target is None:
            if not upsert:
                return _Result(matched_count=0, modified_count=0, upserted_id=None)
            target = {k: v for k, v in flt.items() if not isinstance(v, dict)}
            target.setdefault("_id", ObjectId())
            self.docs.append(target)
            for k, v in update.get("$setOnInsert", {}).items():
                target[k] = v
        for k, v in update.get("$set", {}).items():
            target[k] = v
        for k, v in update.get("$inc", {}).items():
            target[k] = target.get(k, 0) + v
        return _Result(matched_count=1, modified_count=1, upserted_id=None)

    async def delete_one(self, flt: dict) -> _Result:
        for i, d in enumerate(self.docs):
            if _matches(d, flt):
                del self.docs[i]
                return _Result(deleted_count=1)
        return _Result(deleted_count=0)

    async def delete_many(self, flt: dict) -> _Result:
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, flt)]
        return _Result(deleted_count=before - len(self.docs))


class FakeDB:
    def __init__(self) -> None:
        self._colls: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self._colls.setdefault(name, FakeCollection())
```

- [ ] **Step 2: Write the failing test (persistence + prune)**

Create `tests/agent/test_chat_crud.py`:

```python
import pytest
from bson import ObjectId

import app.crud.chat as crud
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())
OTHER = str(ObjectId())


async def test_start_turn_creates_conversation_with_title_and_user_msg():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "Phân tích cổ phiếu FPT giúp tôi rất chi tiết dài dòng quá 60 ký tự luôn nhé bạn")
    convs = db[crud.CONVERSATIONS].docs
    assert len(convs) == 1
    assert convs[0]["title"] == "Phân tích cổ phiếu FPT giúp tôi rất chi tiết dài dòng quá 60 k"  # 60 ký tự đầu
    assert len(convs[0]["title"]) == 60
    msgs = db[crud.MESSAGES].docs
    assert len(msgs) == 1 and msgs[0]["role"] == "user"
    assert convs[0]["msg_count"] == 1  # add_message bump
    assert convs[0]["_id"] == ObjectId(conv_id)


async def test_start_turn_reuses_owned_conversation():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu 1")
    conv_id2 = await crud.start_turn(db, USER, conv_id, "câu 2")
    assert conv_id2 == conv_id
    assert len(db[crud.CONVERSATIONS].docs) == 1
    assert db[crud.CONVERSATIONS].docs[0]["msg_count"] == 2


async def test_start_turn_ignores_foreign_conversation_creates_new():
    db = FakeDB()
    mine = await crud.start_turn(db, USER, None, "của tôi")
    hijack = await crud.start_turn(db, OTHER, mine, "cướp hội thoại người khác")
    assert hijack != mine  # không dùng được conversation của user khác → tạo mới
    assert len(db[crud.CONVERSATIONS].docs) == 2


async def test_add_message_persists_tool_calls_and_usage():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "trả lời",
                           tool_calls=[{"name": "db_find", "args_summary": "x", "ok": True, "ms": 5}],
                           usage={"in": 100, "out": 20})
    asst = [m for m in db[crud.MESSAGES].docs if m["role"] == "assistant"][0]
    assert asst["usage"] == {"in": 100, "out": 20}
    assert asst["tool_calls"][0]["name"] == "db_find"
    assert db[crud.CONVERSATIONS].docs[0]["msg_count"] == 2


async def test_prune_keeps_max_and_cascades(monkeypatch):
    monkeypatch.setattr(crud, "CHAT_MAX_CONVERSATIONS", 3)
    db = FakeDB()
    ids = []
    for i in range(5):
        ids.append(await crud.start_turn(db, USER, None, f"hội thoại {i}"))
    convs = db[crud.CONVERSATIONS].docs
    assert len(convs) == 3  # chỉ giữ 3 mới nhất
    kept_ids = {str(c["_id"]) for c in convs}
    assert ids[0] not in kept_ids and ids[1] not in kept_ids  # 2 cũ nhất bị xoá
    # cascade: message của hội thoại bị xoá cũng biến mất
    remaining_conv_ids = {c["_id"] for c in convs}
    for m in db[crud.MESSAGES].docs:
        assert m["conversation_id"] in remaining_conv_ids


async def test_get_conversation_detail_returns_messages_ordered_and_checks_owner():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "câu trả lời")
    detail = await crud.get_conversation_detail(db, conv_id, USER)
    assert detail is not None and len(detail["messages"]) == 2
    assert detail["messages"][0]["role"] == "user"
    assert await crud.get_conversation_detail(db, conv_id, OTHER) is None  # không phải chủ


async def test_delete_conversation_cascades_and_checks_owner():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    await crud.add_message(db, conv_id, USER, "assistant", "y")
    assert await crud.delete_conversation(db, conv_id, OTHER) is False  # không phải chủ
    assert await crud.delete_conversation(db, conv_id, USER) is True
    assert db[crud.CONVERSATIONS].docs == []
    assert db[crud.MESSAGES].docs == []  # cascade


async def test_list_conversations_sorted_desc_and_scoped_to_user():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "a")
    await crud.start_turn(db, OTHER, None, "b")
    c = await crud.start_turn(db, USER, None, "c")
    lst = await crud.list_conversations(db, USER)
    assert len(lst) == 2  # chỉ của USER
    assert str(lst[0]["_id"]) == c  # mới nhất trước
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_crud.py -v`
Expected: FAIL (ModuleNotFoundError: app.crud.chat)

- [ ] **Step 4: Implement crud/chat.py (persistence phần)**

Create `app/crud/chat.py`:

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_crud.py -v`
Expected: PASS (8 passed)

- [ ] **Step 6: Commit**

```bash
git add app/crud/chat.py tests/agent/_fake_mongo.py tests/agent/test_chat_crud.py
git commit -m "feat(chat): crud persistence conversations/messages + prune 50 (Bước 3 T3)"
```

---

## Task 4: crud/chat.py — quota + kill-switch budget

**Files:**
- Modify: `app/crud/chat.py` (thêm phần quota vào cuối file)
- Test: `tests/agent/test_chat_quota.py` (Create)

**Interfaces:**
- Consumes: `AGENT_MSG_PER_DAY`, `AGENT_MSG_PER_MIN`, `AGENT_DAILY_TOKEN_BUDGET` (Task 1); `MESSAGES`/`QUOTA`/`GLOBAL_QUOTA_KEY` (Task 3).
- Produces:
  - `@dataclass QuotaDecision(ok: bool, status_code: int = 200, message: str = "")`
  - `check_and_reserve_quota(db, user_id: str) -> QuotaDecision` — kill-switch (503) → daily (429) → per-minute (429) → reserve `$inc msg_count`. Chỉ reserve khi ok.
  - `record_usage(db, user_id: str, usage: dict[str, int]) -> None` — `$inc` tok_in/tok_out cho doc user-ngày + doc global-ngày.

- [ ] **Step 1: Write the failing test**

Create `tests/agent/test_chat_quota.py`:

```python
import pytest
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_quota.py -v`
Expected: FAIL (AttributeError: module 'app.crud.chat' has no attribute 'check_and_reserve_quota')

- [ ] **Step 3: Implement quota/kill-switch**

Thêm vào cuối `app/crud/chat.py`:

```python


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_quota.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add app/crud/chat.py tests/agent/test_chat_quota.py
git commit -m "feat(chat): quota 60/ngày + rate 6/phút + kill-switch budget fail-closed (Bước 3 T4)"
```

---

## Task 5: router — quota gate + persistence hooks trong stream

**Files:**
- Modify: `app/routers/chat.py`
- Modify: `tests/agent/test_sse_contract.py` (cập nhật signature `_produce`)
- Test: `tests/agent/test_chat_persistence_flow.py` (Create)

**Interfaces:**
- Consumes: `crud_chat.check_and_reserve_quota`, `crud_chat.start_turn`, `crud_chat.add_message`, `crud_chat.record_usage` (Task 3/4); `get_database` (`app.core.database`).
- Produces: `_produce(queue, body, ctx, conversation_id)` (thêm tham số `conversation_id`); `_AnswerCollector`; `chat_stream` chặn quota + lưu user-msg trước stream.
- **Ràng buộc:** KHÔNG sửa `app/agent/loop.py`. Contract SSE (`meta`/`token`/`tool_*`/`done`/`error`) GIỮ NGUYÊN.

- [ ] **Step 1: Write the failing test**

Create `tests/agent/test_chat_persistence_flow.py`:

```python
import asyncio

import pytest
from bson import ObjectId
from fastapi import HTTPException

import app.routers.chat as chat_router
from app.agent.gateway.types import GatewayContext
from app.schemas.chat import ChatStreamRequest
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())


class _ScriptedEmitAdapter:
    """run_agent thật quá nặng để dựng; ở đây ta giả run_agent bằng cách emit trực tiếp."""


async def _fake_run_agent_done(*, emit, **kwargs):
    await emit("token", {"text": "Xin chào, "})
    await emit("token", {"text": "đây là câu trả lời."})
    await emit("done", {"usage": {"in": 500, "out": 40}, "truncated": False})


async def _fake_run_agent_error(*, emit, **kwargs):
    await emit("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."})


def _wire(monkeypatch, db, run_agent_impl):
    async def _blocks(gateway, ctx):
        from app.agent.adapters.base import SystemBlock
        return [SystemBlock(text="stub", cache_hint=True)], None
    monkeypatch.setattr(chat_router, "build_gateway", lambda: None)
    monkeypatch.setattr(chat_router, "build_adapter", lambda **_: None)
    monkeypatch.setattr(chat_router, "build_system_blocks", _blocks)
    monkeypatch.setattr(chat_router, "run_agent", run_agent_impl)
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)


async def _drain(queue):
    frames = []
    while True:
        f = await queue.get()
        if f is None:
            break
        frames.append(f)
    return frames


async def test_produce_persists_assistant_and_usage_on_done(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)
    # dựng sẵn hội thoại + user-msg như chat_stream đã làm
    conv_id = await __import__("app.crud.chat", fromlist=["x"]).start_turn(db, USER, None, "câu hỏi")
    ctx = GatewayContext(request_id="r1", user_id=USER)
    body = ChatStreamRequest(message="câu hỏi")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id)
    await _drain(queue)
    import app.crud.chat as crud
    msgs = db[crud.MESSAGES].docs
    asst = [m for m in msgs if m["role"] == "assistant"]
    assert len(asst) == 1
    assert asst[0]["content"] == "Xin chào, đây là câu trả lời."
    assert asst[0]["usage"] == {"in": 500, "out": 40}
    g = await db[crud.QUOTA].find_one({"user_id": crud.GLOBAL_QUOTA_KEY, "date": crud._today()})
    assert g["tok_in"] == 500 and g["tok_out"] == 40  # record_usage đã chạy


async def test_produce_does_not_persist_assistant_on_error(monkeypatch):
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_error)
    import app.crud.chat as crud
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    ctx = GatewayContext(request_id="r2", user_id=USER)
    body = ChatStreamRequest(message="câu hỏi")
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    await chat_router._produce(queue, body, ctx, conv_id)
    await _drain(queue)
    assert [m for m in db[crud.MESSAGES].docs if m["role"] == "assistant"] == []  # user-msg trống reply → FE "Thử lại"


async def test_chat_stream_blocks_when_quota_denied(monkeypatch):
    import app.crud.chat as crud
    db = FakeDB()
    monkeypatch.setattr(chat_router, "get_database", lambda name: db)

    async def _deny(db_, uid):
        return crud.QuotaDecision(False, 429, "hết lượt")
    monkeypatch.setattr(chat_router.crud_chat, "check_and_reserve_quota", _deny)

    class _User:
        id = USER

    class _Req:
        async def is_disconnected(self):
            return False
    with pytest.raises(HTTPException) as ei:
        await chat_router.chat_stream(request=_Req(), body=ChatStreamRequest(message="x"), current_user=_User())
    assert ei.value.status_code == 429


async def test_chat_stream_saves_user_msg_and_returns_stream(monkeypatch):
    import app.crud.chat as crud
    db = FakeDB()
    _wire(monkeypatch, db, _fake_run_agent_done)

    class _User:
        id = USER

    class _Req:
        async def is_disconnected(self):
            return True  # ngắt ngay để không phải chạy hết stream

    body = ChatStreamRequest(message="câu hỏi đầu tiên")
    resp = await chat_router.chat_stream(request=_Req(), body=body, current_user=_User())
    assert resp.media_type == "text/event-stream"
    # user-msg đã lưu + quota đã reserve TRƯỚC khi mở stream
    assert [m for m in db[crud.MESSAGES].docs if m["role"] == "user"][0]["content"] == "câu hỏi đầu tiên"
    q = await db[crud.QUOTA].find_one({"user_id": USER, "date": crud._today()})
    assert q["msg_count"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_persistence_flow.py -v`
Expected: FAIL (`_produce()` takes 3 positional args / AttributeError crud_chat)

- [ ] **Step 3: Rewrite app/routers/chat.py**

Thay toàn bộ `app/routers/chat.py` bằng:

```python
import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.chat as crud_chat
from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, run_agent
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database
from app.schemas.chat import (
    ChatStreamRequest,
    ConversationDetail,
    ConversationSummary,
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags thêm ở main.py

HEARTBEAT_SECONDS = 10.0

STREAM_END = None


def _messages_from(body: ChatStreamRequest) -> list[dict[str, str]]:
    """Ghép history (client giữ) + message hiện tại thành messages cho run_agent (sidecar, không đổi)."""
    return [*(t.model_dump() for t in body.history), {"role": "user", "content": body.message}]


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


def _put_sentinel_nowait(queue: asyncio.Queue) -> None:
    """Nhánh CANCEL: user đóng tab, consumer đã thoát — best-effort, KHÔNG block (carryover #3)."""
    try:
        queue.put_nowait(STREAM_END)
    except asyncio.QueueFull:
        pass


class _AnswerCollector:
    """Quan sát các frame emit để thu câu trả lời + usage + tool metadata cho persistence.
    KHÔNG can thiệp stream — chỉ đọc. Chỉ lưu assistant khi thấy 'done' (done_seen)."""

    def __init__(self) -> None:
        self._parts: list[str] = []
        self._starts: list[dict[str, Any]] = []
        self._ends: list[dict[str, Any]] = []
        self.usage: dict[str, int] = {}
        self.done_seen = False

    def observe(self, event_type: str, payload: dict[str, Any]) -> None:
        if event_type == "token":
            self._parts.append(payload.get("text", ""))
        elif event_type == "tool_start":
            self._starts.append(payload)
        elif event_type == "tool_end":
            self._ends.append(payload)
        elif event_type == "done":
            self.usage = payload.get("usage", {}) or {}
            self.done_seen = True

    def text(self) -> str:
        return "".join(self._parts)

    def tool_calls(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for s, e in zip(self._starts, self._ends):
            out.append({
                "name": s.get("name", ""),
                "args_summary": s.get("label", ""),
                "ok": bool(e.get("ok", True)),
                "ms": int(e.get("ms", 0)),
            })
        return out


async def _persist_answer(user_id: str, conversation_id: str, collector: _AnswerCollector) -> None:
    """Lưu assistant-msg + cộng token — CHỈ khi stream đã 'done'. Best-effort (không làm sập stream)."""
    if not collector.done_seen:
        return  # lỗi/huỷ giữa chừng → không lưu assistant → FE thấy user-msg trống reply → "Thử lại"
    db = get_database("user_db")
    try:
        await crud_chat.add_message(
            db, conversation_id, user_id, "assistant",
            collector.text(), tool_calls=collector.tool_calls(), usage=collector.usage or None,
        )
        await crud_chat.record_usage(db, user_id, collector.usage)
    except Exception:
        logger.exception("Lưu câu trả lời/usage thất bại conversation_id=%s", conversation_id)


async def _produce(queue: asyncio.Queue, body: ChatStreamRequest, ctx: GatewayContext, conversation_id: str) -> None:
    """Chạy agent, đẩy frame vào queue, thu câu trả lời để persistence. None = kết thúc stream."""
    collector = _AnswerCollector()

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        collector.observe(event_type, payload)
        await queue.put(sse_frame(event_type, payload))

    try:
        gateway = build_gateway()  # M1: trong try → lỗi khởi tạo vẫn ra error frame + sentinel
        system, _as_of = await build_system_blocks(gateway, ctx)
        await run_agent(
            adapter=build_adapter(thinking="adaptive" if body.thinking else "disabled"),
            gateway=gateway,
            ctx=ctx,
            system=system,
            messages=_messages_from(body),
            emit=emit,
        )
    except asyncio.CancelledError:
        _put_sentinel_nowait(queue)  # cancel → không được block trên put khi queue đầy
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent request_id=%s", ctx.request_id)
        await queue.put(sse_frame("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."}))
    else:
        # CHỈ path sạch (không exception, run_agent tự return kể cả khi emit "error"): lưu nếu đã 'done'.
        await _persist_answer(ctx.user_id, conversation_id, collector)
    # Nhánh BÌNH THƯỜNG: consumer còn drain → sentinel chắc chắn tới.
    await queue.put(STREAM_END)


async def _event_stream(request: Request, body: ChatStreamRequest, user_id: str, conversation_id: str) -> AsyncIterator[str]:
    request_id = str(uuid.uuid4())
    ctx = GatewayContext(request_id=request_id, user_id=user_id)

    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    task = asyncio.create_task(_produce(queue, body, ctx, conversation_id))

    # meta.as_of = null ở v1: briefing đọc trong task nền, không chặn frame đầu (doc 02 §5.2)
    yield sse_frame("meta", {"conversation_id": conversation_id, "message_id": request_id, "as_of": None})

    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if frame is STREAM_END:
                break
            yield frame
    finally:
        if not task.done():
            task.cancel()  # user đóng tab → hủy LLM call, ngừng trả tiền token
        logger.info("chat stream kết thúc request_id=%s user_id=%s", request_id, user_id)


@router.post("/stream", summary="[User] Chat với Finext AI (SSE)", tags=["chat"])
async def chat_stream(
    request: Request,
    body: ChatStreamRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> StreamingResponse:
    user_id = str(current_user.id)
    db = get_database("user_db")
    # Quota + kill-switch: chặn TRƯỚC khi mở stream (429 lượt / 503 budget).
    decision = await crud_chat.check_and_reserve_quota(db, user_id)
    if not decision.ok:
        raise HTTPException(status_code=decision.status_code, detail=decision.message)
    # Lưu user-msg + tạo/nối hội thoại → conversation_id thật để trả về meta.
    conversation_id = await crud_chat.start_turn(db, user_id, body.conversation_id, body.message)
    return StreamingResponse(
        _event_stream(request, body, user_id, conversation_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

> Ghi chú implementer: import `ConversationDetail`/`ConversationSummary`/`StandardApiResponse`/`api_response_wrapper` được đưa vào ngay ở Task 5 (Task 6 dùng liền sau, cùng file). Backend KHÔNG có lint gate trong lệnh test (chỉ pytest) → import "chưa dùng" trong khoảng giữa T5→T6 không chặn gì. 3 REST endpoint (Task 6) append SAU khối `chat_stream`.

- [ ] **Step 4: Cập nhật test cũ `_produce` signature**

Trong `tests/agent/test_sse_contract.py`, hàm `test_produce_cancel_does_not_block_on_full_queue`: sửa dòng tạo task để truyền thêm `conversation_id`:

Đổi:
```python
    task = asyncio.create_task(_produce(queue, body, ctx))
```
Thành:
```python
    task = asyncio.create_task(_produce(queue, body, ctx, "conv-test"))
```

(Cancel path re-raise trước khi persist → không gọi `get_database`, test giữ nguyên hành vi.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_persistence_flow.py tests/agent/test_sse_contract.py -v`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add app/routers/chat.py tests/agent/test_chat_persistence_flow.py tests/agent/test_sse_contract.py
git commit -m "feat(chat): quota gate + lưu user/assistant msg quanh stream (sidecar) (Bước 3 T5)"
```

---

## Task 6: router — REST list/detail/delete conversations

**Files:**
- Modify: `app/routers/chat.py` (thêm 3 endpoint sau `chat_stream`)
- Test: `tests/agent/test_chat_rest.py` (Create)

**Interfaces:**
- Consumes: `crud_chat.list_conversations/get_conversation_detail/delete_conversation` (Task 3); `ConversationSummary`/`ConversationDetail` (Task 2); `api_response_wrapper`/`StandardApiResponse` (đã import ở Task 5).
- Produces: `GET /conversations`, `GET /conversations/{conversation_id}`, `DELETE /conversations/{conversation_id}` — gate `get_current_active_user`, scope theo user, 404 khi không thuộc user.

- [ ] **Step 1: Write the failing test**

Create `tests/agent/test_chat_rest.py`:

```python
import json

from bson import ObjectId

import app.crud.chat as crud
import app.routers.chat as chat_router
from tests.agent._fake_mongo import FakeDB

USER = str(ObjectId())
OTHER = str(ObjectId())


class _User:
    def __init__(self, uid):
        self.id = uid


def _body(resp):
    return json.loads(bytes(resp.body))


async def test_list_conversations_returns_only_mine():
    db = FakeDB()
    await crud.start_turn(db, USER, None, "của tôi")
    await crud.start_turn(db, OTHER, None, "của người khác")
    resp = await chat_router.list_my_conversations(current_user=_User(USER), db=db)
    payload = _body(resp)
    assert payload["status"] == 200
    assert len(payload["data"]) == 1
    assert payload["data"][0]["title"] == "của tôi"


async def test_get_conversation_detail_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "câu hỏi")
    await crud.add_message(db, conv_id, USER, "assistant", "trả lời")
    ok = await chat_router.get_my_conversation(conversation_id=conv_id, current_user=_User(USER), db=db)
    data = _body(ok)["data"]
    assert len(data["messages"]) == 2 and data["messages"][0]["role"] == "user"
    # user khác → 404
    denied = await chat_router.get_my_conversation(conversation_id=conv_id, current_user=_User(OTHER), db=db)
    assert _body(denied)["status"] == 404


async def test_delete_conversation_ok_and_ownership_404():
    db = FakeDB()
    conv_id = await crud.start_turn(db, USER, None, "x")
    denied = await chat_router.delete_my_conversation(conversation_id=conv_id, current_user=_User(OTHER), db=db)
    assert _body(denied)["status"] == 404
    ok = await chat_router.delete_my_conversation(conversation_id=conv_id, current_user=_User(USER), db=db)
    assert _body(ok)["status"] == 200
    assert db[crud.CONVERSATIONS].docs == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_rest.py -v`
Expected: FAIL (AttributeError: module 'app.routers.chat' has no attribute 'list_my_conversations')

- [ ] **Step 3: Add REST endpoints**

Thêm vào cuối `app/routers/chat.py`:

```python


@router.get(
    "/conversations",
    response_model=StandardApiResponse[list[ConversationSummary]],
    summary="[User] Danh sách hội thoại của tôi",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Lấy danh sách hội thoại thành công.")
async def list_my_conversations(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    docs = await crud_chat.list_conversations(db, str(current_user.id))
    return [ConversationSummary.model_validate(d) for d in docs]


@router.get(
    "/conversations/{conversation_id}",
    response_model=StandardApiResponse[ConversationDetail],
    summary="[User] Chi tiết 1 hội thoại (kèm messages)",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Lấy chi tiết hội thoại thành công.")
async def get_my_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    detail = await crud_chat.get_conversation_detail(db, conversation_id, str(current_user.id))
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.",
        )
    return ConversationDetail.model_validate(detail)


@router.delete(
    "/conversations/{conversation_id}",
    response_model=StandardApiResponse[None],
    summary="[User] Xoá 1 hội thoại (kèm toàn bộ messages)",
    tags=["chat"],
)
@api_response_wrapper(default_success_message="Đã xoá hội thoại.")
async def delete_my_conversation(
    conversation_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    ok = await crud_chat.delete_conversation(db, conversation_id, str(current_user.id))
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hội thoại hoặc bạn không có quyền xoá.",
        )
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest tests/agent/test_chat_rest.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Full suite regression**

Run: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest -q 2>&1 | tail -20; echo "rc=${PIPESTATUS[0]}"`
Expected: rc=0, tất cả PASS (350 cũ + test mới).

- [ ] **Step 6: Commit**

```bash
git add app/routers/chat.py tests/agent/test_chat_rest.py
git commit -m "feat(chat): REST list/detail/delete conversations (Bước 3 T6)"
```

---

## Điều kiện hoàn thành (doc 03 §7 + 08 §7 — phần v1 backend)

- [x-plan] (a) Hội thoại lưu `user_db` (Task 3) — reload không mất ở tầng DB/REST (Task 6 GET trả lại).
- [x-plan] (b) Quota 60/ngày → 429; 6/phút → 429 (Task 4).
- [x-plan] (c) Kill-switch budget → 503 fail-closed khi chạm ngưỡng (Task 4 test set budget thấp).
- [x-plan] (d) Indexes + crud đúng layering routers/crud/schemas (Task 1/2/3).
- [x-plan] (e) pytest xanh: quota 429/503 + persistence + prune + record_usage + REST (Task 3-6).
- [x-plan] Usage ghi vào `chat_messages.usage` khớp key `{in,out}` provider (Task 5).
- [x-plan] Prune 50 hội thoại/user + cascade messages (Task 3).

**Ngoài phạm vi (đã chốt owner):** FE wiring sidebar, `agent_user_profile`, semaphore Lớp 3, feedback 👍👎, đo pack thật bằng count_tokens (Bước 5/6). `chat_quota` prune 90 ngày (job APScheduler — Bước 5 ops).
