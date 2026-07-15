# Tích hợp Knowledge Pack thật — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay pack stub bằng Knowledge Pack thật (system_prompt + agent_db_01→06), mở policy 33 collection, thêm tool `read_kb` để agent đọc KB chuyên sâu theo nhu cầu — agent tư vấn đầy đủ (giá/dòng tiền/BCTC/tin/vĩ mô/phase/lịch sử) trên schema thật.

**Architecture:** `system_prompt.md` + `agent_db_01` (schema) + `agent_db_02` (query) nạp thường trực vào system prompt (~30k tok, DeepSeek cache). `agent_db_03→06` (anti-pattern/methodology/news/phase) đọc qua tool `read_kb` động (glob `kb/`, không enum cứng). Policy YAML mở đủ 33 collection với luật chặt cho history (require_filter + `$slice` + cap). Ưu tiên validator; nới 2 chỗ chặn oan (range trong `require_filter`, aggregate có anchor-match khỏi bắt `$limit`).

**Tech Stack:** Python 3.13 · FastAPI · Motor · pytest (`asyncio_mode=auto`) · `uv` (cwd = `finext-fastapi`, chạy `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest` trên Windows để in tiếng Việt).

**Nguồn:** [spec](../specs/2026-07-15-knowledge-pack-integration-design.md) · pack gốc: `d:/twan_projects/notebook-runner/projects/finext/ai_agent/agent_db/` (7 file).

## Global Constraints

- KHÔNG thêm dependency backend. KHÔNG chạm `agent_db` ngoài gateway. Không hard-code tên collection/field trong code Python (chỉ trong policy YAML + KB text).
- Type hints mọi signature · không `except:` trần · không `print()` (dùng `logging.getLogger(__name__)`) · hàm ≤ ~40 dòng.
- Không log nội dung message/filter/token.
- `execute_tool` KHÔNG BAO GIỜ raise (kể cả `read_kb`) — lỗi trả text dạy model.
- **Không mở lại lỗ exfil đã vá:** mọi thay đổi `validator.py` phải giữ TOÀN BỘ test exfil cũ PASS (`test_validator.py` hiện 104+ test). Nới chỉ được phép ở đúng 2 chỗ nêu trong Task 3.
- Pack là DATA: sửa nội dung KB/system_prompt là sửa `.md`, không đổi code. CI test dùng pack stub tối giản (giữ `pack_stub/`), không phụ thuộc pack thật.
- Secrets chỉ ở `.env*`. Chỉ sửa file trong "Files" mỗi task.
- Nền tảng: branch hiện tại `feat/agent-v1-slice` (nối tiếp lát cắt v1). Test baseline hiện tại: 155 PASS.

---

### Task 1: Tool `read_kb` (động) + copy KB vào repo

**Files:**
- Create: `finext-fastapi/app/agent/kb/system_prompt.md` (copy từ pack gốc)
- Create: `finext-fastapi/app/agent/kb/agent_db_01.md` … `agent_db_06.md` (copy từ pack gốc)
- Create: `finext-fastapi/app/agent/tools/kb.py`
- Modify: `finext-fastapi/app/agent/tools/registry.py` (đăng ký tool + nhánh dispatch)
- Modify: `finext-fastapi/app/agent/labels.py` (label chip)
- Test: `finext-fastapi/tests/agent/tools/__init__.py`, `finext-fastapi/tests/agent/tools/test_kb.py`

**Interfaces:**
- Consumes: `ToolCall` (`app.agent.events`).
- Produces: `KB_DIR: Path` · `READ_KB_SCHEMA: dict` · `list_kb_docs() -> list[str]` · `read_kb_doc(name: str) -> tuple[str, bool]` (trả `(content_or_error, ok)`, không raise).

- [ ] **Step 1: Copy 7 file pack vào `kb/`**

```bash
cd finext-fastapi && mkdir -p app/agent/kb && cp "d:/twan_projects/notebook-runner/projects/finext/ai_agent/agent_db/system_prompt.md" app/agent/kb/ && for n in 01 02 03 04 05 06; do cp "d:/twan_projects/notebook-runner/projects/finext/ai_agent/agent_db/agent_db_${n}.md" app/agent/kb/; done && ls app/agent/kb/
```
Expected: 7 file `.md` (system_prompt + agent_db_01..06).

- [ ] **Step 2: Viết failing test**

Tạo `finext-fastapi/tests/agent/tools/__init__.py` (rỗng) và `finext-fastapi/tests/agent/tools/test_kb.py`:

```python
from pathlib import Path

import pytest

from app.agent.tools.kb import READ_KB_SCHEMA, list_kb_docs, read_kb_doc


def test_schema_shape():
    fn = READ_KB_SCHEMA["function"]
    assert fn["name"] == "read_kb"
    assert "doc" in fn["parameters"]["properties"]
    assert fn["parameters"]["required"] == ["doc"]


def test_list_kb_docs_includes_methodology_files():
    docs = list_kb_docs()
    assert "agent_db_04" in docs
    assert "agent_db_06" in docs


def test_read_existing_doc_returns_content():
    content, ok = read_kb_doc("agent_db_06")
    assert ok is True
    assert "Market Phase" in content or "phase" in content.lower()


def test_read_unknown_doc_returns_error_not_raise():
    content, ok = read_kb_doc("khong_ton_tai")
    assert ok is False
    assert "agent_db_04" in content  # liệt kê tài liệu khả dụng để model tự sửa


@pytest.mark.parametrize("evil", ["../config", "a/b", "a\\b", "..", "x.md", "agent_db_04;rm"])
def test_path_traversal_rejected(evil: str):
    content, ok = read_kb_doc(evil)
    assert ok is False


def test_dynamic_extension_new_file_readable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import app.agent.tools.kb as kb

    (tmp_path / "nganh_moi.md").write_text("Kiến thức ngành mới", encoding="utf-8")
    monkeypatch.setattr(kb, "KB_DIR", tmp_path)
    content, ok = kb.read_kb_doc("nganh_moi")
    assert ok is True and "ngành mới" in content  # thêm file .md là đọc được, không sửa code
```

- [ ] **Step 3: Chạy test — FAIL**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/tools/test_kb.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.tools.kb'`

- [ ] **Step 4: Viết `tools/kb.py`**

Tạo `finext-fastapi/app/agent/tools/kb.py`:

```python
"""Tool read_kb — model đọc tài liệu KB chuyên sâu theo nhu cầu. Whitelist ĐỘNG từ thư mục kb/."""

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

KB_DIR = Path(__file__).parent.parent / "kb"
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9_-]+$")
MAX_KB_CHARS = 60_000  # KB là tài liệu tĩnh của dự án — cap rộng, KHÁC cap 12k của db tool (chống exfil Mongo)

READ_KB_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "read_kb",
        "description": (
            "Đọc tài liệu phương pháp luận nội bộ (KB) khi cần chiều sâu diễn giải/anti-pattern/tin tức/phase. "
            "Xem manifest trong system prompt để biết tài liệu nào đọc khi nào. "
            "Tham số `doc` là tên tài liệu (ví dụ 'agent_db_04'), KHÔNG kèm đuôi .md."
        ),
        "parameters": {
            "type": "object",
            "properties": {"doc": {"type": "string", "description": "Tên tài liệu KB, ví dụ agent_db_05"}},
            "required": ["doc"],
        },
    },
}


def list_kb_docs() -> list[str]:
    if not KB_DIR.is_dir():
        return []
    return sorted(p.stem for p in KB_DIR.glob("*.md"))


def read_kb_doc(name: Any) -> tuple[str, bool]:
    """Trả (nội dung, True) nếu đọc được; (text lỗi liệt kê tài liệu, False) nếu tên không hợp lệ/không có."""
    docs = list_kb_docs()
    if not isinstance(name, str) or not _SAFE_NAME.match(name) or name not in docs:
        available = ", ".join(docs) or "(trống)"
        return f"Không có tài liệu '{name}'. Tài liệu khả dụng: {available}.", False
    text = (KB_DIR / f"{name}.md").read_text(encoding="utf-8")
    if len(text) > MAX_KB_CHARS:
        text = text[:MAX_KB_CHARS] + "\n\n…[tài liệu dài, đã cắt — hỏi cụ thể hơn nếu cần phần sau]"
    logger.info("read_kb doc=%s chars=%d", name, len(text))
    return text, True
```

- [ ] **Step 5: Đăng ký tool trong `registry.py`**

Trong `finext-fastapi/app/agent/tools/registry.py`:

```diff
 from .db import DB_AGGREGATE_SCHEMA, DB_FIND_SCHEMA, run_db_aggregate, run_db_find
+from .kb import READ_KB_SCHEMA, read_kb_doc
 from .user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

 # get_my_watchlist tạm gỡ khỏi tool surface tới khi tích hợp watchlist thật (schema stock_symbols/multi-doc) — code giữ nguyên để nối lại
-TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA]
+TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA, READ_KB_SCHEMA]
```

Thêm nhánh dispatch trong `execute_tool`, ngay sau nhánh `get_my_watchlist` (read_kb không có `collection`, phải tách trước guard):

```python
    if call.name == "read_kb":
        args = call.arguments if isinstance(call.arguments, dict) else {}
        content, ok = read_kb_doc(args.get("doc"))
        return content, {"ok": ok, "ms": 0}
```

- [ ] **Step 6: Thêm label trong `labels.py`**

```diff
 def label_for(call: ToolCall) -> str:
+    if call.name == "read_kb":
+        return "Đang tra cứu tài liệu phương pháp…"
     if call.name == "get_my_watchlist":
         return "Đang đọc danh sách theo dõi của bạn…"
```

- [ ] **Step 7: Chạy test — PASS + full suite**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -v`
Expected: test_kb.py 6 passed; full suite tất cả PASS (155 + 6).

- [ ] **Step 8: Commit**

```bash
git add finext-fastapi/app/agent/kb finext-fastapi/app/agent/tools/kb.py finext-fastapi/app/agent/tools/registry.py finext-fastapi/app/agent/labels.py finext-fastapi/tests/agent/tools
git commit -m "feat(agent): tool read_kb (whitelist động) + copy Knowledge Pack thật vào kb/"
```

---

### Task 2: `context.py` — resident system_prompt + 01 + 02

**Files:**
- Modify: `finext-fastapi/app/agent/context.py`
- Test: `finext-fastapi/tests/agent/test_context.py`

**Interfaces:**
- Consumes: `KB_DIR` (`app.agent.tools.kb`), `SystemBlock`, `GatewayProtocol`, `GatewayContext`.
- Produces: `build_system_blocks(gateway, ctx) -> tuple[list[SystemBlock], str | None]` (giữ chữ ký cũ) · `RESIDENT_DOCS = ["system_prompt", "agent_db_01", "agent_db_02"]`.

**Bối cảnh:** `context.py` hiện `_read_pack()` nối mọi `.md` trong `AGENT_PACK_DIR` (mặc định `pack_stub/`). Đổi: resident = đúng 3 file trong `kb/`; giữ fallback `pack_stub/` cho CI (khi `kb/` thiếu file hoặc `AGENT_PACK_DIR` set). Briefing block giữ nguyên.

- [ ] **Step 1: Viết failing test**

Tạo `finext-fastapi/tests/agent/test_context.py`:

```python
from app.agent.context import RESIDENT_DOCS, _read_resident


def test_resident_docs_order():
    assert RESIDENT_DOCS == ["system_prompt", "agent_db_01", "agent_db_02"]


def test_read_resident_concatenates_three_docs():
    text = _read_resident()
    assert "Finext" in text  # từ system_prompt
    assert "Collections Schema" in text or "stock_snapshot" in text  # từ agent_db_01
    assert "Query Patterns" in text or "Workflow" in text  # từ agent_db_02
    # KHÔNG nạp 03-06 vào resident (đọc qua read_kb)
    assert "News Methodology" not in text
```

- [ ] **Step 2: Chạy test — FAIL**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/test_context.py -v`
Expected: FAIL — `ImportError: cannot import name 'RESIDENT_DOCS'`

- [ ] **Step 3: Sửa `context.py`**

Thay hàm `_read_pack` bằng `_read_resident` (đọc đúng 3 file từ `KB_DIR`, fallback `pack_stub/` khi thiếu). Sửa import + `build_system_blocks`:

```python
from app.agent.tools.kb import KB_DIR

RESIDENT_DOCS = ["system_prompt", "agent_db_01", "agent_db_02"]


def _read_resident() -> str:
    """Nối 3 tài liệu thường trực. Thiếu file thật → fallback pack stub (CI/dev)."""
    parts: list[str] = []
    for name in RESIDENT_DOCS:
        path = KB_DIR / f"{name}.md"
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8"))
    if not parts:
        logger.warning("KB resident trống tại %s — fallback pack stub", KB_DIR)
        return "\n\n".join(f.read_text(encoding="utf-8") for f in sorted(PACK_STUB_DIR.glob("*.md")))
    logger.info("Nạp resident %d/%d tài liệu từ %s", len(parts), len(RESIDENT_DOCS), KB_DIR)
    return "\n\n".join(parts)
```

Trong `build_system_blocks`, đổi `blocks = [SystemBlock(text=_read_pack(), ...)]` → `_read_resident()`. Xoá `_read_pack` cũ + import `AGENT_PACK_DIR` nếu thành orphan (chỉ nếu chính thay đổi này làm nó unused — kiểm bằng grep).

- [ ] **Step 4: Chạy test — PASS + full suite**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -v`
Expected: test_context.py PASS; full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/context.py finext-fastapi/tests/agent/test_context.py
git commit -m "feat(agent): resident system_prompt + 01 + 02 (KB chuyên sâu qua read_kb)"
```

---

### Task 3: Nới validator 2 chỗ (range trong require_filter + aggregate anchor-no-limit)

**Files:**
- Modify: `finext-fastapi/app/agent/gateway/validator.py`
- Test: `finext-fastapi/tests/agent/gateway/test_validator.py`

**Interfaces:**
- Consumes/Produces: giữ chữ ký `validate_find` / `validate_aggregate` / `_is_specific_value`.

**Lý do (từ đối chiếu pack ↔ validator):** query lịch sử/tin dùng **date range** `{$gte, $lte}` (Workflow M.2 `market_phase_history`, Workflow L `created_at`), nhưng `_check_find_require_filter` hiện đòi scalar/`$in` → chặn oan. Và Workflow 3.6 rank ngành aggregate `industry_snapshot` (large, no require_filter) có `$match` hẹp nhưng validator G4 vẫn đòi `$limit`. **Cả hai là false-positive thu-hẹp-phạm-vi, không phải exfil** (range `$gte/$lte` thu hẹp; `$ne/$regex/$exists` vẫn cấm). Nới đúng 2 chỗ này, giữ mọi test exfil.

- [ ] **Step 1: Viết failing test (nới) + test giữ-nguyên-an-ninh**

Thêm vào `finext-fastapi/tests/agent/gateway/test_validator.py` (dùng `AGG_POLICY`/`POLICY` sẵn có; giả định policy test có collection `market_phase_history` với `require_filter:[date]` — nếu chưa, test dùng một CollectionRule dựng tay qua `dataclasses.replace`):

```python
from dataclasses import replace


def _rule_require(policy, name, keys):
    base = policy.rule_for("history_stock")
    return replace(base, name=name, key=keys[0], require_filter=keys, require_series_slice=False, allow_aggregate=True)


def test_require_filter_accepts_date_range(monkeypatch):
    # range $gte/$lte thu hẹp phạm vi -> hợp lệ cho require_filter
    from app.agent.gateway import validator as v

    rule = _rule_require(POLICY, "market_phase_history", ["date"])
    v._check_find_require_filter(POLICY, rule, {"date": {"$gte": "2022-01-01", "$lte": "2022-12-31"}})  # không raise


def test_require_filter_still_rejects_ne(monkeypatch):
    from app.agent.gateway import validator as v

    rule = _rule_require(POLICY, "market_phase_history", ["date"])
    with pytest.raises(ValidationError):
        v._check_find_require_filter(POLICY, rule, {"date": {"$ne": "2022-01-01"}})


def test_aggregate_large_with_anchor_match_no_limit_ok():
    # industry_snapshot ĐÃ có trong policy stub hiện tại (size large, key industry_name).
    # Có $match hẹp theo key ở stage đầu -> KHÔNG cần $limit nữa (Task 3 nới).
    validate_aggregate(
        POLICY,
        "industry_snapshot",
        [{"$match": {"industry_name": "Tài chính ngân hàng"}}, {"$project": {"week_score": "$money_flow_score.week_score"}}],
    )


def test_aggregate_large_no_anchor_still_needs_limit():
    # không $match hẹp, không $limit -> vẫn reject (giữ chặn quét vô hạn)
    with pytest.raises(ValidationError):
        validate_aggregate(POLICY, "industry_snapshot", [{"$group": {"_id": "$industry_name"}}])
```

> Lưu ý: `industry_snapshot` đã có sẵn trong `policy.agent_db.yaml` stub hiện tại (dòng `industry_snapshot: { size: large, key: industry_name }`), nên Task 3 dùng `POLICY = Policy.load()` thẳng — không cần policy dựng tay, không phụ thuộc Task 4. `POLICY` và `ValidationError`/`validate_aggregate` import ở đầu `test_validator.py` (đã có).

- [ ] **Step 2: Chạy test — FAIL**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/gateway/test_validator.py -k "date_range or anchor" -v`
Expected: FAIL (range bị reject; anchor-no-limit bị reject).

- [ ] **Step 3: Nới `_is_specific_value` cho range + tách helper**

Trong `finext-fastapi/app/agent/gateway/validator.py`, thêm nhận diện range vào giá trị "cụ thể" của `require_filter` (KHÔNG đụng logic `$in`/scalar cũ, KHÔNG cho `$ne/$nin/$regex/$exists`):

```python
_RANGE_OPS = {"$gte", "$gt", "$lte", "$lt"}


def _is_narrowing_value(value: Any, max_items: int) -> bool:
    """Giá trị THU HẸP phạm vi hợp lệ cho require_filter: scalar, {$in:[scalar...]}, hoặc range $gte/$gt/$lte/$lt.
    KHÔNG chấp nhận $ne/$nin/$regex/$exists (mở rộng/quét)."""
    if _is_specific_value(value, max_items):  # scalar hoặc $in (đã có)
        return True
    if isinstance(value, dict) and value and set(value).issubset(_RANGE_OPS):
        return all(not isinstance(v, (dict, list)) for v in value.values())
    return False
```

Sửa `_check_find_require_filter`: thay `_is_specific_value(...)` bằng `_is_narrowing_value(...)`. Message giữ nguyên tinh thần (nêu ví dụ scalar / `$in` / range date).

- [ ] **Step 4: Nới G4 — aggregate large có anchor-match khỏi bắt `$limit`**

Trong `_check_aggregate_limit` (hoặc chỗ enforce G4): nếu `pipeline[0]` là `$match` chứa `rule.key` với `_is_narrowing_value` thì coi như đã neo phạm vi → bỏ yêu cầu `$limit`. Giữ nguyên: không có anchor mà không `$limit` → vẫn raise.

```python
def _has_anchor_match(rule: CollectionRule, stages: list[dict[str, Any]], max_items: int) -> bool:
    if not stages or "$match" not in stages[0] or not rule.key:
        return False
    match = stages[0]["$match"]
    return isinstance(match, dict) and rule.key in match and _is_narrowing_value(match[rule.key], max_items)
```
Trong nhánh G4: `if _has_anchor_match(rule, stages, policy.defaults.max_limit): return` trước khi đòi `$limit`.

- [ ] **Step 5: Chạy test — PASS + TOÀN BỘ test_validator cũ PASS**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/gateway/test_validator.py -v`
Expected: test mới PASS; **tất cả test exfil cũ vẫn PASS** (không regression). Nếu bất kỳ test cũ FAIL → dừng, nới đã quá tay.

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/gateway/validator.py finext-fastapi/tests/agent/gateway/test_validator.py
git commit -m "fix(agent): nới validator — require_filter chấp nhận date-range, aggregate có anchor-match khỏi bắt limit"
```

---

### Task 4: Policy 33 collection

**Files:**
- Modify: `finext-fastapi/app/agent/gateway/policy.agent_db.yaml`
- Test: `finext-fastapi/tests/agent/gateway/test_policy_full.py`

**Interfaces:**
- Consumes: `Policy.load`, `validate_find`, `validate_aggregate` (đã có).
- Produces: policy 33 collection.

**Bảng policy đầy đủ** (đối chiếu schema `agent_db_01`). Doc phẳng → `allow_aggregate` mặc định true (bỏ trống). Mảng series lớn → `require_series_slice` + `allow_aggregate:false` + `max_slice`.

- [ ] **Step 1: Viết failing test**

Tạo `finext-fastapi/tests/agent/gateway/test_policy_full.py`:

```python
import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_aggregate, validate_find

POLICY = Policy.load()

ALL_33 = [
    "stock_info", "stock_snapshot", "stock_recent", "stock_finstats", "stock_nntd", "stock_itd",
    "industry_info", "industry_snapshot", "industry_recent", "industry_finstats",
    "group_snapshot", "group_recent",
    "market_snapshot", "market_recent", "market_nntd", "market_itd",
    "history_stock", "history_industry", "history_index",
    "history_finratios_stock", "history_finratios_industry",
    "market_phase", "market_phase_history", "phase_basket", "phase_trading", "phase_industry", "phase_perf",
    "other_data", "data_briefing",
    "news_today_feed", "news_today_content", "news_history_feed", "news_history_content",
]


def test_all_33_collections_whitelisted():
    assert len(ALL_33) == 33
    for name in ALL_33:
        assert POLICY.rule_for(name) is not None, f"{name} thiếu trong policy"


def test_unknown_still_rejected():
    assert POLICY.rule_for("temp_stock_snapshot") is None
    assert POLICY.rule_for("users") is None


def test_stock_snapshot_point_read_ok():
    limit = validate_find(POLICY, "stock_snapshot", {"ticker": "FPT"}, {"price": 1}, None, 1)
    assert limit == 1


def test_history_stock_requires_slice():
    with pytest.raises(ValidationError):
        validate_find(POLICY, "history_stock", {"ticker": "FPT"}, {"series": 1}, None, 1)
    validate_find(POLICY, "history_stock", {"ticker": "FPT"}, {"series": {"$slice": -104}}, None, 1)


def test_history_finratios_aggregate_blocked():
    with pytest.raises(ValidationError):
        validate_aggregate(POLICY, "history_finratios_stock", [{"$match": {"ticker": "HPG"}}])


def test_market_phase_history_date_range_ok():
    validate_find(
        POLICY, "market_phase_history",
        {"date": {"$gte": "2022-01-01", "$lte": "2022-12-31"}},
        {"date": 1, "phase_label": 1}, [["date", 1]], 20,
    )


def test_industry_rank_aggregate_ok():
    # Workflow 3.6: rank ngành, anchor-match, không cần $limit (Task 3 nới)
    validate_aggregate(
        POLICY, "industry_snapshot",
        [{"$match": {"industry_name": "Tài chính ngân hàng"}}, {"$project": {"ws": "$money_flow_score.week_score"}}],
    )
```

- [ ] **Step 2: Chạy test — FAIL**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest tests/agent/gateway/test_policy_full.py -v`
Expected: FAIL (nhiều collection chưa whitelist).

- [ ] **Step 3: Viết policy 33 collection**

Ghi đè phần `collections:` trong `finext-fastapi/app/agent/gateway/policy.agent_db.yaml` (bump `version: 2`):

```yaml
collections:
  # Stock (khoá ticker)
  stock_info:        { size: large, key: ticker }
  stock_snapshot:    { size: large, key: ticker }
  stock_recent:      { size: large, key: ticker }
  stock_finstats:    { size: large, key: ticker }
  stock_nntd:        { size: large, key: ticker }
  stock_itd:         { size: large, key: ticker, require_filter: [ticker], require_series_slice: true, allow_aggregate: false, max_slice: 30 }
  # Industry (khoá industry_name)
  industry_info:     { size: large, key: industry_name }
  industry_snapshot: { size: large, key: industry_name }
  industry_recent:   { size: large, key: industry_name }
  industry_finstats: { size: large, key: industry_name }
  # Group (6 doc)
  group_snapshot:    { size: small }
  group_recent:      { size: small }
  # Market (1 doc mỗi)
  market_snapshot:   { size: small }
  market_recent:     { size: small }
  market_nntd:       { size: small }
  market_itd:        { size: small }
  # History giá (mảng nghìn phiên — luật chặt)
  history_stock:     { size: large, key: ticker, require_filter: [ticker], require_series_slice: true, allow_aggregate: false, max_slice: 500 }
  history_industry:  { size: large, key: industry_name, require_filter: [industry_name], require_series_slice: true, allow_aggregate: false, max_slice: 500 }
  history_index:     { size: large, require_series_slice: true, allow_aggregate: false, max_slice: 500 }
  # History định giá (điểm TUẦN, ~340 điểm)
  history_finratios_stock:    { size: large, key: ticker, require_filter: [ticker], require_series_slice: true, allow_aggregate: false, max_slice: 260 }
  history_finratios_industry: { size: large, key: industry_name, require_filter: [industry_name], require_series_slice: true, allow_aggregate: false, max_slice: 260 }
  # Phase & danh mục
  market_phase:         { size: small }
  market_phase_history: { size: large, key: date, require_filter: [date] }
  phase_basket:         { size: small }
  phase_trading:        { size: large, key: ticker }
  phase_industry:       { size: small }
  phase_perf:           { size: large, require_filter: [product] }
  # Vĩ mô + briefing
  other_data:        { size: small }
  data_briefing:     { size: small }
  # News
  news_today_feed:      { size: large, sort_hint: created_at }
  news_today_content:   { size: large, key: article_slug }
  news_history_feed:    { size: large, sort_hint: created_at }
  news_history_content: { size: large, key: article_slug }
```

> Lưu ý: `CollectionRule` hiện KHÔNG có field `sort_hint`. Nếu YAML có `sort_hint`, `Policy._build_rule` sẽ `TypeError` (unexpected kwarg). **Chọn 1:** (a) bỏ `sort_hint` khỏi 2 dòng news (đơn giản — validator không dùng nó); hoặc (b) thêm `sort_hint: str | None = None` vào `CollectionRule` dataclass. Plan chọn (a) — bỏ `sort_hint`, giữ `CollectionRule` nguyên. Sửa 2 dòng news thành `{ size: large }`.

- [ ] **Step 4: Bỏ `sort_hint` khỏi 2 dòng news** (theo lưu ý trên): `news_today_feed: { size: large }` · `news_history_feed: { size: large }`.

- [ ] **Step 5: Chạy test — PASS + full suite**

Run: `cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest -v`
Expected: test_policy_full.py PASS; full suite PASS (gồm test Task 3 dùng `industry_snapshot` thật).

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/gateway/policy.agent_db.yaml finext-fastapi/tests/agent/gateway/test_policy_full.py
git commit -m "feat(agent): policy 33 collection (history luật chặt + phase + news + vĩ mô)"
```

---

### Task 5: Rewrite `agent_db_02.md` sang cú pháp 2 tool + đối chiếu validator

**Files:**
- Modify: `finext-fastapi/app/agent/kb/agent_db_02.md`
- Test: (verify bằng grep — nội dung markdown, không unit test)

**Interfaces:** không có code. Đây là biên tập nội dung KB (đã resident).

**Quy tắc chuyển đổi (áp cho toàn file):**
1. **Note công cụ đầu file:** thay đoạn *"dùng MongoDB tool với `database:"agent_db"`, `collection`, `filter`/`pipeline`"* bằng: *"Agent có 3 tool: `db_find({collection, filter, projection, sort?, limit?})` đọc document; `db_aggregate({collection, pipeline})` chạy pipeline thống kê; `read_kb({doc})` đọc tài liệu phương pháp. KHÔNG có tham số `database` (mọi query chạy trên `agent_db`)."*
2. **Khối `collection:/filter:/projection:/sort:/limit:`** → giữ nguyên nội dung nhưng ghi rõ đây là tham số cho `db_find`. Có thể để nguyên format bảng (nó đã là JSON params), chỉ đảm bảo đầu mỗi ví dụ nói "gọi `db_find`:" hoặc "gọi `db_aggregate`:".
3. **Cú pháp mongosh `db.collection.find(...)` (mục 1.6, 1.7)** → chuyển thành `db_find` params:
   - `db.history_finratios_stock.find({ticker:"HPG"}, {_id:0, series:{$slice:-104}})` → `db_find({collection:"history_finratios_stock", filter:{ticker:"HPG"}, projection:{ticker:1, type:1, series:{$slice:-104}}})`.
4. **Bỏ mọi `"_id": 0` trong projection** — gateway đã tự strip `_id` (Task 4 executor). Ghi chú 1 dòng đầu file: "không cần `_id:0`, hệ thống tự loại."
5. **Đối chiếu validator — sửa pipeline vi phạm:**
   - **Mục 3.6 (rank ngành):** aggregate `industry_snapshot` có `$match` theo `industry_name` ở stage đầu → hợp lệ sau Task 3 (anchor-no-limit). NHƯNG mục 3.6 hiện `$match` theo whitelist `$in` (không phải 1 ngành) — `$in` list scalar cũng là narrowing → OK, không cần `$limit`. Giữ, xác nhận `$match` là stage đầu.
   - **Mục 9.3 (intraday volume spike, `$unwind "$series"`):** `stock_itd` có `allow_aggregate:false` (Task 4) → aggregate bị cấm. **Viết lại** sang `db_find` + `$slice`: `db_find({collection:"stock_itd", filter:{ticker:"X"}, projection:{series:{$slice:30}}})` rồi ghi chú "agent tự lọc các phút VSI cao trong kết quả". Bỏ pipeline `$unwind`.
   - **Mục 4.5 / 5.2 / 6.x (aggregate `stock_finstats` với `$let`/`$filter`/`$map`/`$arrayToObject`):** các operator này KHÔNG bị cấm → hợp lệ. Xác nhận mỗi pipeline có `$limit` (4.5 có `$limit:30` ✓) hoặc anchor `$match` theo ticker (5.2/6.x có `$match ticker` ✓).
   - **Mục 3.1–3.4 (top N `stock_snapshot`):** có `$limit` ✓. Giữ.
   - **Mục 11.5 (aggregate `other_data`):** `other_data` size small → không đòi `$limit`/anchor. Giữ.
   - **History (1.6, 1.7, Workflow G):** mọi ví dụ phải có `$slice` trên `series` + filter khoá. Xác nhận/thêm `$slice`.
6. **`ISODate(...)` trong filter date/created_at** → thay bằng string `"YYYY-MM-DD"` (Mongo so sánh string date OK với schema; tránh cú pháp mongosh `ISODate`). Ví dụ Workflow L: `created_at: {$gte: "2026-06-15"}`.

- [ ] **Step 1: Rewrite file 02 theo 6 quy tắc trên** (biên tập toàn file `app/agent/kb/agent_db_02.md`). Giữ nguyên cấu trúc mục lục, workflow A–M, nội dung giải thích — chỉ đổi cú pháp query + sửa pipeline vi phạm.

- [ ] **Step 2: Verify bằng grep — không còn cú pháp cũ**

Run: `cd finext-fastapi && grep -nE 'database.*agent_db|db\.[a-z_]+\.find|db\.[a-z_]+\.aggregate|ISODate|"_id": 0' app/agent/kb/agent_db_02.md || echo "SẠCH"`
Expected: `SẠCH` (không còn `database:"agent_db"`, mongosh `db.x.find`, `ISODate`, `_id:0`).

- [ ] **Step 3: Verify `$unwind` trên collection allow_aggregate:false**

Run: `cd finext-fastapi && grep -n 'unwind' app/agent/kb/agent_db_02.md`
Expected: không còn `$unwind "$series"` trên `stock_itd` (mục 9.3 đã chuyển sang find+slice). `$unwind` khác (nếu có trên collection cho phép aggregate) thì OK.

- [ ] **Step 4: Commit**

```bash
git add finext-fastapi/app/agent/kb/agent_db_02.md
git commit -m "docs(agent): rewrite agent_db_02 sang cú pháp db_find/db_aggregate + khớp validator"
```

---

### Task 6: Sửa `system_prompt.md` cho runtime

**Files:**
- Modify: `finext-fastapi/app/agent/kb/system_prompt.md`
- Test: verify bằng grep.

**Chỉnh sửa:**
1. **Mục 1 + 3 (nguồn dữ liệu, luật query):** ghi rõ 3 tool thật (`db_find`, `db_aggregate`, `read_kb`). Bỏ mọi ám chỉ cú pháp mongosh. Giữ bản đồ 33 collection (gồm history — đã mở).
2. **Mục 3 luật query:** "luôn projection; `history_*`/`*_itd` bắt buộc filter khoá + `$slice`; không `$lookup/$out/$merge/$where/$unionWith/$$ROOT`; `history_finratios_*` + `*_itd` không aggregate (dùng `db_find` + `$slice`)."
3. **Mục 7 (web search):** ghi rõ **v1 KHÔNG có web search** — agent luôn ở chế độ "không web search": trả lời từ DB + với sự kiện đang diễn biến ghi *"chưa đối chiếu được tin mới ngoài hệ thống"*. Không hứa web search, không bịa từ training data.
4. **Mục 13 (manifest KB):** cập nhật — `agent_db_01` (schema) và `agent_db_02` (query) **"đã có sẵn trong ngữ cảnh, không cần đọc"**; `agent_db_03/04/05/06` **"gọi `read_kb({doc:"agent_db_04"})` khi cần chiều sâu"**. Thêm dòng hướng dẫn: thêm tài liệu KB mới về sau → xuất hiện ở đây + gọi read_kb theo tên.
5. **Watchlist:** KHÔNG nhắc tool `get_my_watchlist` (đã gỡ khỏi surface).

- [ ] **Step 1: Sửa system_prompt.md** theo 5 điểm trên.

- [ ] **Step 2: Verify grep**

Run: `cd finext-fastapi && grep -nE 'db_find|db_aggregate|read_kb' app/agent/kb/system_prompt.md | head && echo "---" && grep -niE 'web search|không có web' app/agent/kb/system_prompt.md | head`
Expected: có nhắc 3 tool; mục web search ghi rõ chế độ không-web-search v1.

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/agent/kb/system_prompt.md
git commit -m "docs(agent): system_prompt khớp runtime — 3 tool, chế độ không-web-search, manifest read_kb"
```

---

### Task 7: Verify end-to-end với DeepSeek thật (mốc — thủ công, owner)

**Files:** Create: `finext-fastapi/tests/agent/adapters/fixtures/deepseek_readkb_stream.txt` (nếu bắt được)

Không unit test tự động (cần DeepSeek + Mongo thật, tốn tiền — như mốc lát cắt Task 9 cũ).

- [ ] **Step 1: Kiểm resident nạp đúng**

```bash
cd finext-fastapi && PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run python -c "
from app.agent.context import _read_resident
t = _read_resident(); print('resident chars:', len(t), '~tok:', len(t)//4)
print('có system_prompt:', 'Finext' in t, '| 01:', 'stock_snapshot' in t, '| 02:', 'Workflow' in t)
"
```
Expected: ~30k–40k token; cả 3 nguồn có mặt.

- [ ] **Step 2: Chạy thật vài câu (script như slice_run.py cũ)** — hỏi lần lượt:
  - "FPT giá bao nhiêu?" → không gọi `read_kb`, trả giá đúng (regression lát cắt).
  - "thị trường đang pha nào, nên cầm bao nhiêu %?" → query `data_briefing`/`market_phase`, có thể `read_kb("agent_db_06")`.
  - "HPG đang đắt hay rẻ so với lịch sử?" → `db_find` `history_finratios_stock` với `$slice`, có thể `read_kb("agent_db_04")`.
  - "hôm nay có tin gì về ngân hàng?" → `db_find` news + có thể `read_kb("agent_db_05")`.
  Xác nhận: agent gọi `read_kb` đúng lúc, số khớp UI, không lộ ký hiệu nội bộ, không bịa.

- [ ] **Step 3: (nếu có tool-call read_kb thật) bắt bytes làm fixture regression** — tương tự Task 9 lát cắt.

- [ ] **Step 4: Commit fixture (nếu có)**

```bash
git add finext-fastapi/tests/agent/adapters/fixtures
git commit -m "test(agent): fixture DeepSeek gọi read_kb (verify pack thật end-to-end)"
```

---

## Nghiệm thu toàn plan
- [ ] `PYTHONIOENCODING=utf-8 PYTHONUTF8=1 uv run pytest` — toàn bộ PASS (155 cũ + test mới), 0 regression test exfil.
- [ ] `read_kb` đọc động file trong `kb/`; thêm `.md` mới đọc được không sửa code; path traversal chặn.
- [ ] Resident = system_prompt + 01 + 02 (~30k tok); 03–06 chỉ qua read_kb.
- [ ] Policy phủ đủ 33 collection; history query được với `$slice`, `find({})` trần bị chặn; `history_finratios_*`/`stock_itd` aggregate bị chặn.
- [ ] Validator nới đúng 2 chỗ (range require_filter, aggregate anchor-no-limit); mọi test exfil cũ PASS.
- [ ] `agent_db_02.md` + `system_prompt.md` không còn cú pháp mongosh/`database`/`ISODate`/`_id:0`; nhắc 3 tool thật; chế độ không-web-search.
- [ ] (Owner) verify DeepSeek thật: câu phase/lịch sử/tin gọi `read_kb` đúng lúc, số khớp UI.

**Ngoài phạm vi (task sau):** web search tool · nối lại `get_my_watchlist` · persistence/quota · FE · script sync pack tự động (v1 copy thủ công theo Task 1 Step 1).
