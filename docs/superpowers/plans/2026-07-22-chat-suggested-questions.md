# Gợi ý câu hỏi động ở màn hình chat rỗng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện 5 câu hỏi gợi ý bám diễn biến thị trường ngay dưới ô nhập khi user mở `/chat` chưa có tin nhắn.

**Architecture:** Cron 30 phút trong giờ giao dịch gom snapshot thị trường → 1 call LLM không tool → validate nghiêm → lưu `user_db.chat_suggestions`. Frontend đọc qua keyword SSE registry bằng server-side render nên gợi ý nằm sẵn trong HTML lần paint đầu.

**Tech Stack:** FastAPI + Motor (Mongo standalone), APScheduler, Next.js 15 App Router, MUI 7.

**Spec:** `docs/superpowers/specs/2026-07-22-chat-suggested-questions-design.md`

## Global Constraints

- Mongo là **standalone** — không có multi-document transaction. Chỉ dùng thao tác nguyên tử một document.
- Job **không được** tính token vào quota của bất kỳ user nào. Chỉ cộng vào bộ đếm global.
- Câu gợi ý **cấm** con số tuyệt đối (`%`, số từ 3 chữ số) và giọng khuyến nghị.
- Backend **luôn** trả về danh sách dùng được (rơi về hằng số tĩnh) — không bao giờ trả rỗng.
- Không thêm dependency mới ở cả backend lẫn frontend.
- Test backend: `cd finext-fastapi && uv run pytest`. Frontend: `cd finext-nextjs && npx tsc --noEmit && npm test`.
- Repo chưa có React testing library → component frontend không unit test; chỉ tsc + build.

---

### Task 1: Validator câu gợi ý

Hàm thuần, không I/O. Đây là rào chắn chính chống gợi ý hỏng.

**Files:**
- Create: `finext-fastapi/app/agent/suggestions.py`
- Test: `finext-fastapi/tests/agent/test_suggestions_validate.py`

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces: `validate_suggestions(raw: str, allowed_tickers: set[str]) -> list[str] | None` — trả danh sách 5 câu đã strip nếu hợp lệ, `None` nếu trượt bất kỳ luật nào.

- [ ] **Step 1: Write the failing test**

Tạo `finext-fastapi/tests/agent/test_suggestions_validate.py`:

```python
"""Validate gợi ý câu hỏi — rào chắn chống mã bịa, số tuyệt đối, giọng khuyến nghị."""
import json

from app.agent.suggestions import validate_suggestions

TICKERS = {"HPG", "FPT", "SSI"}


def _raw(items: list[str]) -> str:
    return json.dumps(items, ensure_ascii=False)


def _ok_five() -> list[str]:
    return [
        "Thị trường hôm nay diễn biến ra sao?",
        "Vì sao nhóm thép biến động mạnh phiên nay?",
        "HPG đang ở trạng thái nào?",
        "Nhóm ngành nào đang dẫn dắt thị trường?",
        "Thị trường đang ở pha nào?",
    ]


def test_bo_qua_json_hong():
    assert validate_suggestions("khong phai json", TICKERS) is None


def test_bo_qua_khi_khong_du_5_cau():
    assert validate_suggestions(_raw(_ok_five()[:4]), TICKERS) is None


def test_bo_qua_khi_thieu_dau_hoi():
    items = _ok_five()
    items[0] = "Thị trường hôm nay diễn biến ra sao."
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_phan_tram():
    items = _ok_five()
    items[0] = "Vì sao VNINDEX giảm 2% phiên nay?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_so_tuyet_doi():
    items = _ok_five()
    items[0] = "Vì sao chỉ số mất 120 điểm phiên nay?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_co_giong_khuyen_nghi():
    items = _ok_five()
    items[0] = "Có nên mua HPG lúc này?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_bo_qua_khi_ma_khong_co_trong_snapshot():
    items = _ok_five()
    items[2] = "VIC đang ở trạng thái nào?"
    assert validate_suggestions(_raw(items), TICKERS) is None


def test_khong_loai_nham_cum_mua_rong():
    """'khối ngoại mua ròng' là mô tả hợp lệ — KHÔNG được coi là khuyến nghị."""
    items = _ok_five()
    items[1] = "Khối ngoại mua ròng ở nhóm ngành nào?"
    assert validate_suggestions(_raw(items), TICKERS) is not None


def test_khong_loai_nham_viet_tat_tai_chinh():
    """GDP/ETF không phải mã cổ phiếu, không được loại."""
    items = _ok_five()
    items[3] = "Dòng tiền ETF đang vào nhóm nào?"
    assert validate_suggestions(_raw(items), TICKERS) is not None


def test_set_hop_le_di_qua_va_duoc_strip():
    items = _ok_five()
    items[0] = "  Thị trường hôm nay diễn biến ra sao?  "
    out = validate_suggestions(_raw(items), TICKERS)
    assert out is not None
    assert len(out) == 5
    assert out[0] == "Thị trường hôm nay diễn biến ra sao?"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_validate.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.suggestions'`

- [ ] **Step 3: Write minimal implementation**

Tạo `finext-fastapi/app/agent/suggestions.py`:

```python
# finext-fastapi/app/agent/suggestions.py
"""Sinh và validate câu hỏi gợi ý cho màn hình chat rỗng.

Gợi ý được sinh tập trung theo lịch (xem app/core/scheduler.py) và dùng chung cho mọi
user, nên KHÔNG bao giờ gọi LLM theo request của người dùng.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)

# Câu hỏi phải là câu hoàn chỉnh, đủ ngắn để hiển thị một dòng.
MIN_LEN = 8
MAX_LEN = 80
COUNT = 5

# Giọng khuyến nghị — cấm theo lập trường compliance của dự án.
# LƯU Ý: không cấm riêng "mua"/"bán" vì "khối ngoại mua ròng" là mô tả hợp lệ.
_ADVICE_PATTERNS = ("có nên", "khuyến nghị", "nên mua", "nên bán", "giá mục tiêu", "target giá")

# Số từ 3 chữ số trở lên = điểm số/giá → dễ lệch khi gợi ý sinh lúc 10h hiện lúc 11h.
_BIG_NUMBER_RE = re.compile(r"\d{3,}")

# Token 3 ký tự in hoa = ứng viên mã cổ phiếu.
_TICKER_RE = re.compile(r"\b[A-Z]{3}\b")

# Viết tắt tài chính 3 ký tự KHÔNG phải mã cổ phiếu — không được loại nhầm.
_NON_TICKER = {"GDP", "CPI", "FED", "ETF", "IPO", "ROE", "ROA", "EPS", "PMI", "USD", "VND", "FDI"}


def validate_suggestions(raw: str, allowed_tickers: set[str]) -> list[str] | None:
    """Kiểm tra output thô của LLM. Trả list 5 câu đã strip, hoặc None nếu không dùng được.

    Trượt bất kỳ luật nào là loại CẢ SET — thà giữ set cũ còn hơn publish nửa vời.
    """
    try:
        items = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(items, list) or len(items) != COUNT:
        return None

    out: list[str] = []
    for item in items:
        if not isinstance(item, str):
            return None
        q = item.strip()
        if not (MIN_LEN <= len(q) <= MAX_LEN):
            return None
        if not q.endswith("?"):
            return None
        if "%" in q or _BIG_NUMBER_RE.search(q):
            return None
        low = q.lower()
        if any(p in low for p in _ADVICE_PATTERNS):
            return None
        for token in _TICKER_RE.findall(q):
            if token in _NON_TICKER:
                continue
            if token not in allowed_tickers:
                return None
        out.append(q)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_validate.py -q`
Expected: PASS — 10 passed

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/suggestions.py finext-fastapi/tests/agent/test_suggestions_validate.py
git commit -m "feat(chat): validator cho câu hỏi gợi ý động"
```

---

### Task 2: Lưu/đọc gợi ý trong user_db

**Files:**
- Create: `finext-fastapi/app/crud/chat_suggestions.py`
- Modify: `finext-fastapi/app/core/database.py` — thêm index vào khối `try` tạo index (khối bắt đầu ở dòng có `# chat collections indexes (agent — Bước 3)`)
- Test: `finext-fastapi/tests/crud/test_chat_suggestions.py`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `SUGGESTIONS_COLLECTION: str = "chat_suggestions"`
  - `FALLBACK_SUGGESTIONS: list[str]` — 5 câu tĩnh, không gắn thời điểm
  - `async save_suggestions(db, questions: list[str], context: dict, model: str, usage: dict) -> None`
  - `async get_latest_suggestions(db) -> list[str]` — luôn trả 5 câu (rơi về fallback)

- [ ] **Step 1: Write the failing test**

Tạo `finext-fastapi/tests/crud/test_chat_suggestions.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && uv run pytest tests/crud/test_chat_suggestions.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.crud.chat_suggestions'`

- [ ] **Step 3: Write minimal implementation**

Tạo `finext-fastapi/app/crud/chat_suggestions.py`:

```python
# finext-fastapi/app/crud/chat_suggestions.py
"""Lưu/đọc câu hỏi gợi ý cho màn hình chat rỗng (user_db.chat_suggestions).

Mỗi lần sinh ghi một document mới; đọc lấy bản mới nhất. Giữ lịch sử để owner soi lại
đã publish gì lúc nào khi tinh chỉnh prompt. TTL tự dọn sau RETENTION_DAYS.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

SUGGESTIONS_COLLECTION = "chat_suggestions"
RETENTION_DAYS = 7

# Dùng khi chưa từng sinh được bộ nào (lần đầu deploy) hoặc TTL đã dọn sạch.
# Cố ý KHÔNG gắn thời điểm để không bao giờ bị lệch với diễn biến thị trường.
FALLBACK_SUGGESTIONS: list[str] = [
    "Thị trường hôm nay diễn biến ra sao?",
    "Nhóm ngành nào đang thu hút dòng tiền?",
    "Thị trường đang ở pha nào?",
    "Khối ngoại đang giao dịch thế nào?",
    "Cổ phiếu nào đang được quan tâm nhất?",
]


async def save_suggestions(db: Any, questions: list[str], context: dict, model: str, usage: dict) -> None:
    """Ghi một bộ gợi ý mới. Chỉ gọi sau khi đã validate."""
    now = datetime.now(timezone.utc)
    await db[SUGGESTIONS_COLLECTION].insert_one(
        {
            "questions": questions,
            "generated_at": now,
            "context": context,  # snapshot đã đưa vào LLM — để chỉnh prompt về sau
            "model": model,
            "usage": usage,
            "expires_at": now + timedelta(days=RETENTION_DAYS),
        }
    )


async def get_latest_suggestions(db: Any) -> list[str]:
    """Bộ gợi ý mới nhất. LUÔN trả về danh sách dùng được — không bao giờ rỗng."""
    try:
        doc = await db[SUGGESTIONS_COLLECTION].find_one({}, sort=[("generated_at", -1)])
    except Exception:
        logger.exception("Đọc chat_suggestions thất bại — dùng fallback")
        return list(FALLBACK_SUGGESTIONS)

    questions = (doc or {}).get("questions")
    if isinstance(questions, list) and len(questions) == 5:
        return list(questions)
    return list(FALLBACK_SUGGESTIONS)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && uv run pytest tests/crud/test_chat_suggestions.py -q`
Expected: PASS — 4 passed

- [ ] **Step 5: Thêm index**

Trong `finext-fastapi/app/core/database.py`, ngay sau dòng `await db.chat_quota.create_index("user_id", unique=True)`, thêm:

```python
            # chat_suggestions: đọc bản mới nhất + TTL tự dọn (crud/chat_suggestions.py)
            await db.chat_suggestions.create_index([("generated_at", -1)])
            await db.chat_suggestions.create_index("expires_at", expireAfterSeconds=0)
```

- [ ] **Step 6: Run full backend suite**

Run: `cd finext-fastapi && uv run pytest -q`
Expected: PASS — không có test nào hỏng

- [ ] **Step 7: Commit**

```bash
git add finext-fastapi/app/crud/chat_suggestions.py finext-fastapi/tests/crud/test_chat_suggestions.py finext-fastapi/app/core/database.py
git commit -m "feat(chat): lưu/đọc câu hỏi gợi ý trong user_db + index TTL"
```

---

### Task 3: Gom snapshot thị trường

**Files:**
- Modify: `finext-fastapi/app/agent/suggestions.py`
- Test: `finext-fastapi/tests/agent/test_suggestions_snapshot.py`

**Interfaces:**
- Consumes: `validate_suggestions` (Task 1).
- Produces: `build_snapshot(phase_rows, stock_rows, news_rows) -> dict` — hàm thuần, nhận sẵn dữ liệu thô để test được không cần DB. Trả dict có khoá `phase: str | None`, `gainers: list[dict]`, `losers: list[dict]`, `industries: list[str]`, `headlines: list[str]`, `tickers: list[str]`.

- [ ] **Step 1: Write the failing test**

Tạo `finext-fastapi/tests/agent/test_suggestions_snapshot.py`:

```python
"""Rút gọn dữ liệu thô thành snapshot nhỏ để đưa vào prompt."""
from app.agent.suggestions import build_snapshot


def _stock(ticker: str, pct: float, industry: str) -> dict:
    return {"ticker": ticker, "pct_change": pct, "industry_name": industry}


def test_lay_final_phase_cua_phien_moi_nhat():
    phase = [{"date": "2026-07-21", "final_phase": "Cũ"}, {"date": "2026-07-22", "final_phase": "Tăng giá"}]
    snap = build_snapshot(phase, [], [])
    assert snap["phase"] == "Tăng giá"


def test_khong_co_du_lieu_pha_thi_phase_none():
    assert build_snapshot([], [], [])["phase"] is None


def test_lay_toi_da_10_ma_tang_va_10_ma_giam():
    rows = [_stock(f"T{i:02d}", i - 15.0, "Thép") for i in range(30)]
    snap = build_snapshot([], rows, [])
    assert len(snap["gainers"]) == 10
    assert len(snap["losers"]) == 10
    # gainers sắp giảm dần, losers sắp tăng dần
    assert snap["gainers"][0]["ticker"] == "T29"
    assert snap["losers"][0]["ticker"] == "T00"


def test_snapshot_khong_chua_gia_tri_so():
    """Cấm đưa số vào prompt — chỉ giữ CHIỀU biến động."""
    snap = build_snapshot([], [_stock("HPG", 6.9, "Thép")], [])
    assert "pct_change" not in snap["gainers"][0]
    assert snap["gainers"][0] == {"ticker": "HPG", "industry_name": "Thép"}


def test_industries_la_tap_nganh_cua_ma_bien_dong():
    rows = [_stock("HPG", 5.0, "Thép"), _stock("FPT", -4.0, "Công nghệ"), _stock("HSG", 4.0, "Thép")]
    snap = build_snapshot([], rows, [])
    assert sorted(snap["industries"]) == ["Công nghệ", "Thép"]


def test_tickers_la_allowlist_cho_validate():
    rows = [_stock("HPG", 5.0, "Thép"), _stock("FPT", -4.0, "Công nghệ")]
    snap = build_snapshot([], rows, [])
    assert sorted(snap["tickers"]) == ["FPT", "HPG"]


def test_lay_5_tieu_de_tin_moi_nhat():
    news = [{"title": f"Tin {i}"} for i in range(9)]
    snap = build_snapshot([], [], news)
    assert snap["headlines"] == [f"Tin {i}" for i in range(5)]


def test_bo_qua_ban_ghi_thieu_field():
    rows = [{"ticker": "HPG"}, _stock("FPT", 3.0, "Công nghệ")]
    snap = build_snapshot([], rows, [])
    assert snap["tickers"] == ["FPT"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_snapshot.py -q`
Expected: FAIL — `ImportError: cannot import name 'build_snapshot'`

- [ ] **Step 3: Write minimal implementation**

Thêm vào cuối `finext-fastapi/app/agent/suggestions.py`:

```python
TOP_N = 10
HEADLINE_N = 5


def build_snapshot(phase_rows: list[dict], stock_rows: list[dict], news_rows: list[dict]) -> dict:
    """Rút gọn dữ liệu thô thành snapshot nhỏ cho prompt.

    Hàm THUẦN (nhận sẵn dữ liệu) để test được không cần DB.
    Cố ý KHÔNG giữ giá trị số: prompt chỉ được biết CHIỀU biến động, tránh LLM chép số
    vào câu hỏi rồi lệch khi hiển thị ở nhịp sau.
    """
    phase = None
    if phase_rows:
        latest = max(phase_rows, key=lambda r: r.get("date") or "")
        phase = latest.get("final_phase")

    usable = [
        r for r in stock_rows
        if r.get("ticker") and isinstance(r.get("pct_change"), (int, float)) and r.get("industry_name")
    ]
    ranked = sorted(usable, key=lambda r: r["pct_change"], reverse=True)
    gainers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[:TOP_N]]
    losers = [{"ticker": r["ticker"], "industry_name": r["industry_name"]} for r in ranked[::-1][:TOP_N]]

    industries = sorted({r["industry_name"] for r in ranked[:TOP_N] + ranked[-TOP_N:]})
    tickers = sorted({r["ticker"] for r in usable})
    headlines = [r["title"] for r in news_rows[:HEADLINE_N] if r.get("title")]

    return {
        "phase": phase,
        "gainers": gainers,
        "losers": losers,
        "industries": industries,
        "headlines": headlines,
        "tickers": tickers,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_snapshot.py -q`
Expected: PASS — 8 passed

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/suggestions.py finext-fastapi/tests/agent/test_suggestions_snapshot.py
git commit -m "feat(chat): gom snapshot thị trường cho prompt gợi ý"
```

---

### Task 4: Sinh gợi ý bằng LLM

**Files:**
- Modify: `finext-fastapi/app/agent/suggestions.py`
- Test: `finext-fastapi/tests/agent/test_suggestions_generate.py`

**Interfaces:**
- Consumes: `validate_suggestions`, `build_snapshot` (Task 1, 3); `save_suggestions` (Task 2); `_complete` và `build_adapter` từ `app.agent.loop`; `SystemBlock` từ `app.agent.adapters.base`; `billable_units`, `_bump_window`, `GLOBAL_QUOTA_KEY`, `DAY_DUR`, `_now` từ `app.crud.chat`; `AGENT_DAILY_TOKEN_BUDGET` từ `app.core.config`.
- Produces: `async generate_and_store(db) -> bool` — `True` nếu đã publish bộ mới, `False` nếu bỏ nhịp (budget cạn / LLM lỗi / validate trượt).

- [ ] **Step 1: Write the failing test**

Tạo `finext-fastapi/tests/agent/test_suggestions_generate.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_generate.py -q`
Expected: FAIL — `AttributeError: module 'app.agent.suggestions' has no attribute '_load_sources'`

- [ ] **Step 3: Write minimal implementation**

Thêm vào đầu `finext-fastapi/app/agent/suggestions.py` (phần import) và cuối file:

```python
# --- thêm vào phần import ở đầu file ---
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.loop import _complete, build_adapter
from app.core.config import AGENT_DAILY_TOKEN_BUDGET, LLM_MODEL
from app.crud.chat import DAY_DUR, GLOBAL_QUOTA_KEY, QUOTA, _bump_window, _now, _window_used, billable_units
from app.crud.chat_suggestions import save_suggestions
from app.crud.sse.home_today_stock import home_today_stock
from app.crud.sse.news_daily import news_daily
from app.crud.sse.phase_signal import phase_signal


# --- thêm vào cuối file ---
_SYS = (
    "Bạn soạn câu hỏi gợi ý cho người dùng ứng dụng phân tích chứng khoán Việt Nam.\n"
    "Trả về DUY NHẤT một JSON array gồm đúng 5 chuỗi tiếng Việt, không kèm giải thích.\n"
    "Mỗi chuỗi là một câu hỏi hoàn chỉnh, 8-80 ký tự, kết thúc bằng dấu hỏi.\n"
    "Cơ cấu: 2 câu về bức tranh chung, 2 câu về ngành/mã đang biến động, "
    "1 câu giúp người dùng khám phá tính năng (pha thị trường, bộ lọc).\n"
    "BẮT BUỘC:\n"
    "- Chỉ nhắc mã và ngành có trong dữ liệu được cung cấp.\n"
    "- TUYỆT ĐỐI KHÔNG đưa con số vào câu hỏi (không phần trăm, không điểm số, không giá).\n"
    "- KHÔNG đưa ra khuyến nghị mua/bán, không hỏi 'có nên'."
)


async def _load_sources(db: Any) -> tuple[list[dict], list[dict], list[dict]]:
    """Đọc 3 nguồn thô. Tách riêng để test monkeypatch được mà không cần Mongo thật.

    phase_signal/home_today_stock trả list; news_daily trả {"items", "pagination"}.
    """
    phase_rows = await phase_signal()
    stock_rows = await home_today_stock()
    news_page = await news_daily(page=1, limit=5, sort_by="created_at", sort_order="desc")
    return list(phase_rows or []), list(stock_rows or []), list((news_page or {}).get("items") or [])


def _user_prompt(snapshot: dict) -> str:
    return (
        "Dữ liệu thị trường hiện tại:\n"
        f"- Pha thị trường: {snapshot.get('phase') or 'không rõ'}\n"
        f"- Mã tăng mạnh: {', '.join(g['ticker'] for g in snapshot['gainers']) or 'không có'}\n"
        f"- Mã giảm mạnh: {', '.join(l['ticker'] for l in snapshot['losers']) or 'không có'}\n"
        f"- Ngành đang biến động: {', '.join(snapshot['industries']) or 'không có'}\n"
        f"- Tin mới: {' | '.join(snapshot['headlines']) or 'không có'}\n\n"
        "Soạn 5 câu hỏi gợi ý theo đúng yêu cầu."
    )


async def _global_budget_exhausted(db: Any) -> bool:
    """Cầu dao chi phí: trần <= 0 nghĩa là TẮT (khớp check_quota trong crud/chat.py)."""
    if AGENT_DAILY_TOKEN_BUDGET <= 0:
        return False
    doc = await db[QUOTA].find_one({"user_id": GLOBAL_QUOTA_KEY}) or {}
    used, _ = _window_used(doc.get("g_start"), doc.get("g_tokens"), _now(), DAY_DUR)
    return used >= AGENT_DAILY_TOKEN_BUDGET


async def generate_and_store(db: Any) -> bool:
    """Sinh 1 bộ gợi ý mới và lưu nếu hợp lệ. Trả True nếu đã publish.

    Never-raise: lỗi ở đây không được ảnh hưởng gì tới hệ thống; bỏ nhịp, 30 phút sau
    tự thử lại. Token KHÔNG tính vào quota user nào — chỉ cộng bộ đếm global.
    """
    try:
        if await _global_budget_exhausted(db):
            logger.warning("Bỏ nhịp sinh gợi ý: ngân sách LLM global đã cạn.")
            return False

        phase_rows, stock_rows, news_rows = await _load_sources(db)
        snapshot = build_snapshot(phase_rows, stock_rows, news_rows)

        usage: dict[str, int] = {}
        raw = await _complete(
            build_adapter(thinking="disabled"),
            [SystemBlock(text=_SYS, cache_hint=False)],
            [{"role": "user", "content": _user_prompt(snapshot)}],
            usage,
        )

        tokens = billable_units(usage)
        if tokens > 0:
            await _bump_window(db, GLOBAL_QUOTA_KEY, "g_start", "g_tokens", _now(), DAY_DUR, tokens)

        questions = validate_suggestions(raw, set(snapshot["tickers"]))
        if questions is None:
            logger.warning("Gợi ý sinh ra không hợp lệ — giữ nguyên bộ cũ. Raw: %r", raw[:300])
            return False

        # context lưu kèm để soi lại khi tinh chỉnh prompt
        await save_suggestions(db, questions, snapshot, LLM_MODEL or "", usage)
        logger.info("Đã publish bộ gợi ý mới (%d token quy đổi).", tokens)
        return True
    except Exception:
        logger.exception("Sinh gợi ý thất bại — bỏ nhịp")
        return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_suggestions_generate.py -q`
Expected: PASS — 5 passed

- [ ] **Step 5: Run full backend suite**

Run: `cd finext-fastapi && uv run pytest -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/suggestions.py finext-fastapi/tests/agent/test_suggestions_generate.py
git commit -m "feat(chat): sinh gợi ý bằng LLM, không tính vào quota user"
```

---

### Task 5: Endpoint đọc gợi ý + job cron

**Files:**
- Create: `finext-fastapi/app/crud/sse/chat_suggestions.py`
- Modify: `finext-fastapi/app/crud/sse/__init__.py` — thêm import và một dòng trong `SSE_QUERY_REGISTRY`
- Modify: `finext-fastapi/app/core/scheduler.py` — thêm job
- Test: `finext-fastapi/tests/routers/test_sse_chat_suggestions.py`

**Interfaces:**
- Consumes: `get_latest_suggestions` (Task 2), `generate_and_store` (Task 4).
- Produces: keyword `chat_suggestions` trong registry → `GET /api/v1/sse/rest/chat_suggestions`.

- [ ] **Step 1: Write the failing test**

Tạo `finext-fastapi/tests/routers/test_sse_chat_suggestions.py`:

```python
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

    assert out == {"questions": crud_sug.FALLBACK_SUGGESTIONS}


async def test_tra_bo_moi_nhat_khi_da_co(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr("app.crud.sse.chat_suggestions.get_database", lambda name: db)
    qs = ["A?", "B?", "C?", "D?", "E?"]
    await crud_sug.save_suggestions(db, qs, {}, "m", {})

    out = await chat_suggestions()

    assert out == {"questions": qs}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd finext-fastapi && uv run pytest tests/routers/test_sse_chat_suggestions.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.crud.sse.chat_suggestions'`

- [ ] **Step 3: Write the fetcher**

Tạo `finext-fastapi/app/crud/sse/chat_suggestions.py`:

```python
# finext-fastapi/app/crud/sse/chat_suggestions.py
"""Keyword `chat_suggestions` — câu hỏi gợi ý cho màn hình chat rỗng.

Khác các fetcher khác trong thư mục này (đọc stock_db), fetcher này đọc user_db vì gợi ý
do chính app sinh ra.

Đặt ở registry công khai (không auth) là CÓ CHỦ Ý: frontend lấy bằng server-side render,
mà SSR không có session user nên endpoint yêu cầu auth sẽ trả 401. Nội dung là câu hỏi
thị trường chung, không nhạy cảm.
"""
from typing import Any, Dict

from app.core.database import get_database
from app.crud.chat_suggestions import get_latest_suggestions


async def chat_suggestions(**kwargs) -> Dict[str, Any]:
    """Trả {"questions": [5 câu]}. Luôn có dữ liệu — rơi về hằng số tĩnh nếu chưa sinh."""
    db = get_database("user_db")
    return {"questions": await get_latest_suggestions(db)}
```

- [ ] **Step 4: Đăng ký keyword**

Trong `finext-fastapi/app/crud/sse/__init__.py`, thêm import cạnh các import khác:

```python
from app.crud.sse.chat_suggestions import chat_suggestions
```

và thêm vào `SSE_QUERY_REGISTRY` (đặt cuối dict, trước dấu `}`):

```python
    # Chat — câu hỏi gợi ý (đọc user_db, do app tự sinh)
    "chat_suggestions": chat_suggestions,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd finext-fastapi && uv run pytest tests/routers/test_sse_chat_suggestions.py -q`
Expected: PASS — 3 passed

- [ ] **Step 6: Thêm job cron**

Trong `finext-fastapi/app/core/scheduler.py`:

Thêm import ở đầu file:

```python
from app.agent.suggestions import generate_and_store
```

Thêm hàm dưới `run_daily_maintenance_tasks`:

```python
async def run_refresh_chat_suggestions():
    """Làm mới câu hỏi gợi ý màn hình chat (30 phút/lần trong giờ giao dịch)."""
    db_user: AsyncIOMotorDatabase = get_database("user_db")
    await generate_and_store(db_user)  # never-raise, tự log
```

Thêm job trong `add_jobs_to_scheduler`, ngay sau job maintenance:

```python
        scheduler.add_job(
            run_refresh_chat_suggestions,
            # Giờ giao dịch VN, scheduler đã set timezone="Asia/Ho_Chi_Minh".
            trigger=CronTrigger(day_of_week="mon-fri", hour="8-15", minute="0,30"),
            id="refresh_chat_suggestions_job",
            name="Refresh chat suggested questions",
            replace_existing=True,
            misfire_grace_time=300,  # lỡ nhịp quá 5 phút thì bỏ, chờ nhịp sau
        )
```

- [ ] **Step 7: Run full backend suite**

Run: `cd finext-fastapi && uv run pytest -q`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add finext-fastapi/app/crud/sse/chat_suggestions.py finext-fastapi/app/crud/sse/__init__.py finext-fastapi/app/core/scheduler.py finext-fastapi/tests/routers/test_sse_chat_suggestions.py
git commit -m "feat(chat): endpoint đọc gợi ý + cron làm mới 30 phút trong phiên"
```

---

### Task 6: Hiển thị gợi ý ở frontend

Không có React testing library trong repo → không unit test component. Kiểm bằng tsc + build.

**Files:**
- Create: `finext-nextjs/app/(main)/chat/serverFetch.ts`
- Create: `finext-nextjs/app/(main)/chat/components/SuggestedQuestions.tsx`
- Modify: `finext-nextjs/app/(main)/chat/page.tsx`
- Modify: `finext-nextjs/app/(main)/chat/[id]/page.tsx`
- Modify: `finext-nextjs/app/(main)/chat/PageContent.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/sse/rest/chat_suggestions` → `{ status, message, data: { questions: string[] } }` (Task 5).
- Produces: prop `suggestions?: string[]` xuyên từ page → `PageContent` → `ChatApp`.

- [ ] **Step 1: Viết serverFetch**

Tạo `finext-nextjs/app/(main)/chat/serverFetch.ts`:

```ts
// finext-nextjs/app/(main)/chat/serverFetch.ts
// Server-side fetch câu hỏi gợi ý. Dùng native fetch (KHÔNG apiClient — apiClient là
// client-only và cần session). Lấy ở server để gợi ý nằm sẵn trong HTML lần paint đầu:
// không chớp, không nhảy layout.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StandardApiResponse<T> {
    status: number;
    message?: string;
    data: T;
}

/**
 * 5 câu hỏi gợi ý hiện tại. Backend luôn trả về bộ dùng được (có fallback tĩnh),
 * nên chỉ cần xử lý đúng trường hợp gọi hỏng → trả mảng rỗng, UI ẩn khu vực gợi ý.
 * revalidate 300s: cron sinh mỗi 30 phút nên user thấy bộ mới trong vòng 5 phút.
 */
export async function fetchChatSuggestions(): Promise<string[]> {
    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/sse/rest/chat_suggestions`, {
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return [];
        const json: StandardApiResponse<{ questions?: string[] }> = await res.json();
        const questions = json?.data?.questions;
        return Array.isArray(questions) ? questions : [];
    } catch {
        // Backend chết không được làm hỏng trang chat.
        return [];
    }
}
```

- [ ] **Step 2: Viết component**

Tạo `finext-nextjs/app/(main)/chat/components/SuggestedQuestions.tsx`:

```tsx
'use client';

import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import { getResponsiveFontSize } from 'theme/tokens';

// Câu hỏi gợi ý dưới ô nhập, chỉ hiện khi hội thoại còn rỗng. Bấm là gửi luôn.
export default function SuggestedQuestions({
    questions,
    disabled,
    onPick,
}: {
    questions: string[];
    disabled?: boolean;
    onPick: (q: string) => void;
}) {
    if (!questions.length) return null;

    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {questions.map((q) => (
                <ButtonBase
                    key={q}
                    disabled={disabled}
                    onClick={() => onPick(q)}
                    sx={(t) => ({
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 1,
                        textAlign: 'left',
                        color: 'text.secondary',
                        borderBottom: `1px solid ${alpha(t.palette.divider, 0.6)}`,
                        transition: 'background-color .2s, color .2s',
                        '&:last-of-type': { borderBottom: 'none' },
                        '&:hover': { backgroundColor: alpha(t.palette.primary.main, 0.06), color: 'text.primary' },
                        '&.Mui-disabled': { opacity: 0.5 },
                    })}
                >
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>{q}</Typography>
                    <ArrowOutwardRounded sx={{ fontSize: 16, opacity: 0.5, flexShrink: 0 }} />
                </ButtonBase>
            ))}
        </Box>
    );
}
```

- [ ] **Step 3: Truyền prop từ hai page**

Trong `finext-nextjs/app/(main)/chat/page.tsx`, đổi component thành async và fetch:

```tsx
import { fetchChatSuggestions } from './serverFetch';

export default async function ChatPage() {
  const suggestions = await fetchChatSuggestions();
  return (
    <Suspense>
      <PageContent suggestions={suggestions} />
    </Suspense>
  );
}
```

Trong `finext-nextjs/app/(main)/chat/[id]/page.tsx`, thêm fetch tương tự:

```tsx
import { fetchChatSuggestions } from '../serverFetch';

export default async function ChatConversationPage({ params }: Props) {
  const { id } = await params;
  const suggestions = await fetchChatSuggestions();
  return (
    <Suspense>
      <PageContent initialConversationId={id} suggestions={suggestions} />
    </Suspense>
  );
}
```

- [ ] **Step 4: Nối vào PageContent**

Trong `finext-nextjs/app/(main)/chat/PageContent.tsx`:

Thêm import:

```tsx
import SuggestedQuestions from './components/SuggestedQuestions';
```

Đổi signature `ChatApp` để nhận prop:

```tsx
function ChatApp({ initialConversationId, suggestions = [] }: { initialConversationId?: string; suggestions?: string[] }) {
```

Trong nhánh hội thoại rỗng, thêm ngay SAU `<Box sx={{ width: '100%' }}>...<Composer .../></Box>` và vẫn nằm trong khối `gap: 4`:

```tsx
                <Box sx={{ width: '100%' }}>
                  <SuggestedQuestions
                    questions={suggestions}
                    disabled={streaming}
                    onPick={(q) => store.send(q)}
                  />
                </Box>
```

Đổi component xuất khẩu để chuyển tiếp prop:

```tsx
export default function PageContent({ initialConversationId, suggestions }: { initialConversationId?: string; suggestions?: string[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <OptionalAuthWrapper requireAuth fillHeight loadingFallback={<ChatSkeleton />}>
        <ChatApp initialConversationId={initialConversationId} suggestions={suggestions} />
      </OptionalAuthWrapper>
    </Box>
  );
}
```

- [ ] **Step 5: Typecheck và test**

Run: `cd finext-nextjs && npx tsc --noEmit && npm test`
Expected: tsc không báo lỗi; test PASS (số test không đổi — không thêm test frontend)

- [ ] **Step 6: Build production trong Docker**

Không chạy `next build` trực tiếp vì có thể xung đột `.next` với dev server đang mở.

```bash
cd /d/twan_projects/finext-web-app
docker build -q -f finext-nextjs/dockerfile -t fxtest-next:suggestions \
  --build-arg NEXT_PUBLIC_API_URL_ARG=https://finext.vn \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID_ARG=test \
  --build-arg NEXT_PUBLIC_SYSTEM_LICENSE_KEYS_ARG=test \
  --build-arg NEXT_PUBLIC_BASIC_FEATURE_ARG=test \
  --build-arg NEXT_PUBLIC_SYSTEM_FEATURES_ARG=test \
  --build-arg NEXT_PUBLIC_SYSTEM_USERS_ARG=test \
  finext-nextjs
docker rmi -f fxtest-next:suggestions
```

Expected: build thành công (in ra sha256), không lỗi type/lint.

- [ ] **Step 7: Commit**

```bash
git add "finext-nextjs/app/(main)/chat"
git commit -m "feat(chat): hiện 5 câu hỏi gợi ý dưới ô nhập khi hội thoại rỗng"
```

---

## Kiểm tra thủ công sau khi xong

Owner tự kiểm (repo không có E2E):

1. Mở `/chat` khi chưa có tin nhắn → thấy 5 câu ngay, không chớp.
2. Bấm một câu → gửi luôn, khu vực gợi ý biến mất.
3. Tắt backend rồi mở `/chat` → không có khu vực gợi ý, trang vẫn chạy bình thường.
4. Xem `user_db.chat_suggestions` sau nhịp cron đầu tiên trong giờ giao dịch → có doc mới,
   trường `context` cho biết snapshot lúc sinh (dùng để tinh chỉnh prompt).
