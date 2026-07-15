# Agent v1 — Lát Cắt Dọc (Gateway → SSE → DeepSeek → Cắm Thật) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng đã đăng nhập hỏi *"FPT giá bao nhiêu?"* trên `POST /api/v1/chat/stream` → agent (DeepSeek) tự viết query → gateway kiểm luật → đọc `agent_db` thật trên Mongo → trả lời stream về, **số khớp UI Finext**.

**Architecture:** Gateway = thư viện Python in-process (Option A, doc 01 §3): policy YAML declarative + validator thuần logic + executor Motor. Agent loop nhận `GatewayProtocol` qua DI (thật/fixture đều được). Model adapter = 1 lớp OpenAI-compat tự viết trên `httpx` (không SDK, không vendor lock). Router `chat.py` mỏng: auth → StreamingResponse SSE theo contract đóng băng (doc 02 §3).

**Tech Stack:** Python 3.13 · FastAPI · Motor · httpx · PyYAML · pytest + pytest-asyncio · `uv` (chạy lệnh bằng `uv run`, cwd = `finext-fastapi/`).

**Nguồn:** [spec 2026-07-14](../specs/2026-07-14-agent-v1-slice-and-chat-render-design.md) · [doc 01 gateway](../../finext_agent/01-gateway-data-access.md) · [doc 02 runtime](../../finext_agent/02-backend-agent-runtime.md) · [agent_db_v2](../../finext_agent/agent_db_v2.md)

## Global Constraints

- **KHÔNG thêm dependency backend nào.** `httpx`, `PyYAML`, `motor`, `pytest`, `pytest-asyncio` đã có trong `pyproject.toml`. Cần thêm gì → DỪNG, hỏi owner (quy ước CLAUDE.md).
- **Contract SSE (doc 02 §3) là hợp đồng đóng băng:** đúng 6 event `meta|token|tool_start|tool_end|done|error`, wire `data: <json>\n\n`, heartbeat `: hb\n\n`. Không thêm/đổi/bớt field.
- **Không chạm `agent_db` ngoài gateway.** Không code nào ngoài `app/agent/gateway/` được gọi `get_database("agent_db")`.
- **Không chạm schema `agent_db`:** mọi hiểu biết về collection nằm trong `policy.agent_db.yaml`, không hard-code tên field trong code Python (ngoại lệ DUY NHẤT: `data_briefing {type:"core"}` — doc 02 §5.2).
- Python: type hints mọi signature · không `except:` trần · không `print()` (dùng `logging.getLogger(__name__)`) · hàm ≤ ~40 dòng.
- **Không log nội dung filter/message của user** (doc 05 §59: chỉ log `{request_id, collection, ms, bytes, plan, rejected}`).
- Secrets chỉ ở `.env.production` (root, đã gitignore) / `finext-fastapi/.env.development`. **Không** commit key, không `NEXT_PUBLIC_*`.
- Không sửa file ngoài danh sách "Files" của task. Không refactor code cũ.
- Log tiếng Việt theo convention repo hiện có.
- **Ngoài phạm vi plan này:** persistence/quota (session 4), FE (session 5-6), policy đủ 33 collection, widget render. `conversation_id` nhận vào nhưng chưa lưu DB.

---

### Task 1: Hạ tầng test + Gateway types + Policy file & loader

**Files:**
- Modify: `finext-fastapi/pyproject.toml` (thêm `[tool.pytest.ini_options]`)
- Modify: `finext-fastapi/app/core/config.py` (thêm block AGENT/LLM env)
- Modify: `finext-fastapi/app/core/database.py:~40` (thêm `"agent_db"` vào `db_names_to_connect`)
- Create: `finext-fastapi/app/agent/__init__.py`, `finext-fastapi/app/agent/gateway/__init__.py`
- Create: `finext-fastapi/app/agent/gateway/types.py`
- Create: `finext-fastapi/app/agent/gateway/policy.py`
- Create: `finext-fastapi/app/agent/gateway/policy.agent_db.yaml`
- Create: `finext-fastapi/tests/__init__.py`, `finext-fastapi/tests/agent/__init__.py`, `finext-fastapi/tests/agent/gateway/__init__.py`
- Test: `finext-fastapi/tests/agent/gateway/test_policy.py`

**Interfaces:**
- Produces: `GatewayContext(tier, request_id, user_id)` · `GatewayResult(ok, data, error, meta)` · `GatewayProtocol` (Protocol: `find`, `aggregate`) · `CollectionRule` · `Policy.load(path) -> Policy` · `Policy.rule_for(collection) -> CollectionRule | None` · `Policy.defaults` · `Policy.version`
- Consumes: —

- [ ] **Step 1: Cấu hình pytest (asyncio auto) trong `pyproject.toml`**

Thêm vào cuối file `finext-fastapi/pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 2: Viết policy file (bản rút gọn cho lát cắt)**

Tạo `finext-fastapi/app/agent/gateway/policy.agent_db.yaml`. **Chỉ các collection cần cho lát cắt** — policy đủ 33 collection là việc của session sau (doc 01 §8). Khoá lấy từ agent_db_v2 §4/§5.

```yaml
# policy.agent_db.yaml — luật truy cập agent_db. Đổi schema DB = sửa file này, KHÔNG sửa code.
# Bản rút gọn (lát cắt dọc). Danh sách đủ 33 collection: agent_db_v2 §4.
version: 1

defaults:
  max_response_kb: 50
  max_time_ms: 5000
  default_limit: 20
  max_limit: 50
  banned_operators:
    - $lookup
    - $graphLookup
    - $out
    - $merge
    - $where
    - $function
    - $accumulator

collections:
  stock_snapshot:  { size: large, key: ticker }
  stock_info:      { size: large, key: ticker }
  stock_recent:    { size: large, key: ticker }
  industry_snapshot: { size: large, key: industry_name }
  market_snapshot: { size: small }
  market_phase:    { size: small }
  data_briefing:   { size: small }
  history_stock:   { size: large, key: ticker, require_filter: [ticker], require_series_slice: true }
```

- [ ] **Step 3: Viết failing test cho policy loader**

Tạo `finext-fastapi/tests/agent/gateway/test_policy.py`:

```python
from pathlib import Path

from app.agent.gateway.policy import Policy

POLICY_PATH = Path(__file__).parents[3] / "app" / "agent" / "gateway" / "policy.agent_db.yaml"


def test_load_policy_exposes_version_and_defaults():
    policy = Policy.load(POLICY_PATH)
    assert policy.version == 1
    assert policy.defaults.max_response_kb == 50
    assert policy.defaults.default_limit == 20
    assert "$where" in policy.defaults.banned_operators


def test_rule_for_known_collection():
    policy = Policy.load(POLICY_PATH)
    rule = policy.rule_for("history_stock")
    assert rule is not None
    assert rule.size == "large"
    assert rule.require_filter == ["ticker"]
    assert rule.require_series_slice is True


def test_rule_for_small_collection_has_defaults():
    policy = Policy.load(POLICY_PATH)
    rule = policy.rule_for("market_phase")
    assert rule is not None
    assert rule.size == "small"
    assert rule.require_filter == []
    assert rule.require_series_slice is False


def test_rule_for_unknown_collection_returns_none():
    policy = Policy.load(POLICY_PATH)
    assert policy.rule_for("temp_stock_snapshot") is None
    assert policy.rule_for("users") is None
```

- [ ] **Step 4: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_policy.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent'`

- [ ] **Step 5: Viết `types.py`**

Tạo `finext-fastapi/app/agent/gateway/types.py`:

```python
"""Interface chung của gateway — web runtime CHỈ biết những type này (doc 01 §5)."""

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class GatewayContext:
    """Web tạo mỗi request. user_id CHỈ để log/audit — không bao giờ vào query agent_db."""

    request_id: str
    user_id: str
    tier: str = "internal"  # điểm cắm gating tương lai (v1 allow-all)


@dataclass
class GatewayResult:
    ok: bool
    data: list[dict[str, Any]] | None = None
    error: str | None = None  # lỗi bằng NGÔN NGỮ MODEL HIỂU, kèm gợi ý sửa
    meta: dict[str, Any] = field(default_factory=dict)  # {collection, ms, bytes, plan, truncated}


class GatewayProtocol(Protocol):
    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult: ...

    async def aggregate(
        self,
        ctx: GatewayContext,
        collection: str,
        pipeline: list[dict[str, Any]],
    ) -> GatewayResult: ...
```

- [ ] **Step 6: Viết `policy.py`**

Tạo `finext-fastapi/app/agent/gateway/policy.py`:

```python
"""Load + parse policy file. Toàn bộ hiểu biết về agent_db nằm ở YAML, không ở code."""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

DEFAULT_POLICY_PATH = Path(__file__).parent / "policy.agent_db.yaml"


@dataclass
class PolicyDefaults:
    max_response_kb: int
    max_time_ms: int
    default_limit: int
    max_limit: int
    banned_operators: list[str]


@dataclass
class CollectionRule:
    name: str
    size: str  # "large" | "small"
    key: str | None = None
    require_filter: list[str] = field(default_factory=list)
    require_series_slice: bool = False
    max_slice: int | None = None


@dataclass
class Policy:
    version: int
    defaults: PolicyDefaults
    collections: dict[str, CollectionRule]

    @classmethod
    def load(cls, path: Path | str = DEFAULT_POLICY_PATH) -> "Policy":
        raw: dict[str, Any] = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        defaults = PolicyDefaults(**raw["defaults"])
        collections = {
            name: CollectionRule(name=name, **(cfg or {}))
            for name, cfg in raw["collections"].items()
        }
        policy = cls(version=raw["version"], defaults=defaults, collections=collections)
        logger.info("Đã nạp policy agent_db version=%s (%d collection)", policy.version, len(collections))
        return policy

    def rule_for(self, collection: str) -> CollectionRule | None:
        return self.collections.get(collection)
```

- [ ] **Step 7: Tạo package init rỗng**

Tạo 5 file rỗng: `app/agent/__init__.py`, `app/agent/gateway/__init__.py`, `tests/__init__.py`, `tests/agent/__init__.py`, `tests/agent/gateway/__init__.py`

- [ ] **Step 8: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_policy.py -v`
Expected: 4 passed

- [ ] **Step 9: Thêm env vào `config.py`**

Nối vào cuối `finext-fastapi/app/core/config.py` (theo đúng style block `R2 Configuration` sẵn có):

```python
# --- Agent / LLM Configuration ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL")

AGENT_GATEWAY = os.getenv("AGENT_GATEWAY", "mongo")  # mongo | fixture
GATEWAY_EXPLAIN_MODE = os.getenv("GATEWAY_EXPLAIN_MODE", "off")  # on | off (heuristic — doc 01 §6 R1c)
AGENT_PACK_DIR = os.getenv("AGENT_PACK_DIR")  # None → dùng pack stub trong repo
```

- [ ] **Step 10: Thêm `agent_db` vào `database.py`**

Trong `finext-fastapi/app/core/database.py`, hàm `connect_to_mongo`:

```diff
-    db_names_to_connect = ["user_db", "stock_db"]
+    db_names_to_connect = ["user_db", "stock_db", "agent_db"]
```

(`get_database` vốn lazy nên đây chỉ là kết nối sẵn cho nhất quán — KHÔNG tạo index, `agent_db` là read-only với web.)

- [ ] **Step 11: Commit**

```bash
git add finext-fastapi/pyproject.toml finext-fastapi/app/core/config.py finext-fastapi/app/core/database.py finext-fastapi/app/agent finext-fastapi/tests
git commit -m "feat(agent): gateway types + policy loader + hạ tầng pytest"
```

---

### Task 2: Validator — luật gateway thuần logic (không I/O)

**Files:**
- Create: `finext-fastapi/app/agent/gateway/validator.py`
- Test: `finext-fastapi/tests/agent/gateway/test_validator.py`

**Interfaces:**
- Consumes: `Policy`, `CollectionRule` (Task 1)
- Produces: `ValidationError(message: str)` (Exception, `.message` là text dạy model) · `validate_find(policy, collection, filter, projection, sort, limit) -> int` (trả limit hiệu lực đã chuẩn hoá) · `validate_aggregate(policy, collection, pipeline) -> None`

**Luật (doc 01 §4/§1):** không whitelist → từ chối · banned operator ở bất kỳ độ sâu nào → từ chối · `size: large` → bắt buộc projection non-empty + limit ≤ `max_limit` · `require_filter` → filter phải có ≥1 khoá liệt kê · `require_series_slice` → projection phải có `series` kèm `$slice` · `max_slice` → |slice| ≤ max. Mọi error phải **kèm gợi ý sửa**.

- [ ] **Step 1: Viết failing test**

Tạo `finext-fastapi/tests/agent/gateway/test_validator.py`:

```python
import pytest

from app.agent.gateway.policy import Policy
from app.agent.gateway.validator import ValidationError, validate_aggregate, validate_find

POLICY = Policy.load()


def test_unknown_collection_rejected_without_leaking_whitelist():
    with pytest.raises(ValidationError) as exc:
        validate_find(POLICY, "users", filter={}, projection={"email": 1}, sort=None, limit=1)
    msg = exc.value.message
    assert "không nằm trong phạm vi dữ liệu" in msg
    assert "stock_snapshot" not in msg  # R6: không tiết lộ collection ngoài whitelist


def test_large_collection_requires_projection():
    with pytest.raises(ValidationError) as exc:
        validate_find(POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection=None, sort=None, limit=1)
    assert "projection" in exc.value.message


def test_large_collection_accepts_valid_query_and_returns_limit():
    limit = validate_find(
        POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, sort=None, limit=None
    )
    assert limit == POLICY.defaults.default_limit


def test_limit_over_max_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY, "stock_snapshot", filter={"ticker": "FPT"}, projection={"price": 1}, sort=None, limit=500
        )
    assert "50" in exc.value.message


def test_small_collection_allows_empty_filter_and_no_projection():
    limit = validate_find(POLICY, "market_phase", filter={}, projection=None, sort=None, limit=None)
    assert limit == POLICY.defaults.default_limit


def test_require_filter_enforced():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "history_stock",
            filter={},
            projection={"series": {"$slice": -20}},
            sort=None,
            limit=1,
        )
    assert "ticker" in exc.value.message


def test_require_series_slice_enforced():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY, "history_stock", filter={"ticker": "FPT"}, projection={"series": 1}, sort=None, limit=1
        )
    assert "$slice" in exc.value.message


def test_history_stock_valid_query_passes():
    limit = validate_find(
        POLICY,
        "history_stock",
        filter={"ticker": "FPT"},
        projection={"ticker": 1, "series": {"$slice": -20}},
        sort=None,
        limit=1,
    )
    assert limit == 1


def test_banned_operator_nested_in_filter_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_find(
            POLICY,
            "stock_snapshot",
            filter={"$and": [{"ticker": "FPT"}, {"$where": "this.price > 0"}]},
            projection={"price": 1},
            sort=None,
            limit=1,
        )
    assert "$where" in exc.value.message


def test_banned_stage_in_pipeline_rejected():
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(
            POLICY,
            "stock_snapshot",
            [{"$match": {"ticker": "FPT"}}, {"$lookup": {"from": "stock_info", "as": "x"}}],
        )
    assert "$lookup" in exc.value.message


def test_aggregate_on_large_collection_requires_match_with_key():
    with pytest.raises(ValidationError) as exc:
        validate_aggregate(POLICY, "history_stock", [{"$group": {"_id": "$ticker"}}])
    assert "$match" in exc.value.message


def test_aggregate_valid_pipeline_passes():
    validate_aggregate(
        POLICY,
        "history_stock",
        [{"$match": {"ticker": "FPT"}}, {"$project": {"series": {"$slice": ["$series", -20]}}}],
    )
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_validator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.gateway.validator'`

- [ ] **Step 3: Viết `validator.py`**

Tạo `finext-fastapi/app/agent/gateway/validator.py`:

```python
"""Kiểm tra query против policy. Thuần logic — unit test không cần Mongo (doc 01 §3-A)."""

from typing import Any

from .policy import CollectionRule, Policy


class ValidationError(Exception):
    """Lỗi từ chối query. `message` viết bằng ngôn ngữ model hiểu + gợi ý sửa (doc 01 §1)."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def _find_banned(node: Any, banned: list[str]) -> str | None:
    """Quét đệ quy mọi key trong filter/pipeline tìm operator cấm."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key in banned:
                return key
            found = _find_banned(value, banned)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_banned(item, banned)
            if found:
                return found
    return None


def _require_rule(policy: Policy, collection: str) -> CollectionRule:
    rule = policy.rule_for(collection)
    if rule is None:
        raise ValidationError(
            f"Collection '{collection}' không nằm trong phạm vi dữ liệu. "
            "Hãy dùng một collection đã được mô tả trong tài liệu dữ liệu."
        )
    return rule


def _check_series_slice(rule: CollectionRule, projection: dict[str, Any] | None) -> None:
    if not rule.require_series_slice:
        return
    series = (projection or {}).get("series")
    if not isinstance(series, dict) or "$slice" not in series:
        raise ValidationError(
            f"Collection '{rule.name}' có mảng series rất dài. "
            'Bắt buộc dùng projection dạng {"series": {"$slice": -20}} để lấy N phần tử mới nhất.'
        )
    if rule.max_slice is not None:
        raw = series["$slice"]
        count = abs(raw if isinstance(raw, int) else raw[-1])
        if count > rule.max_slice:
            raise ValidationError(
                f"$slice quá lớn cho '{rule.name}': tối đa {rule.max_slice} phần tử."
            )


def validate_find(
    policy: Policy,
    collection: str,
    filter: dict[str, Any] | None,
    projection: dict[str, Any] | None,
    sort: list[list[Any]] | None,
    limit: int | None,
) -> int:
    """Trả limit hiệu lực. Raise ValidationError nếu vi phạm."""
    rule = _require_rule(policy, collection)
    defaults = policy.defaults

    banned = _find_banned(filter, defaults.banned_operators)
    if banned:
        raise ValidationError(f"Toán tử '{banned}' không được phép. Hãy viết lại query không dùng toán tử này.")

    if rule.require_filter and not any(key in (filter or {}) for key in rule.require_filter):
        keys = " hoặc ".join(rule.require_filter)
        raise ValidationError(
            f"Collection '{collection}' bắt buộc lọc theo khoá: {keys}. "
            f'Ví dụ: filter={{"{rule.require_filter[0]}": "FPT"}}'
        )

    if rule.size == "large" and not projection:
        raise ValidationError(
            f"Collection '{collection}' lớn — bắt buộc có projection để chỉ lấy field cần thiết. "
            'Ví dụ: projection={"ticker": 1, "price": 1}'
        )

    _check_series_slice(rule, projection)

    effective = defaults.default_limit if limit is None else limit
    if effective > defaults.max_limit:
        raise ValidationError(
            f"limit={effective} vượt mức cho phép (tối đa {defaults.max_limit}). Hãy giảm limit hoặc thu hẹp filter."
        )
    return effective


def validate_aggregate(policy: Policy, collection: str, pipeline: list[dict[str, Any]]) -> None:
    rule = _require_rule(policy, collection)

    banned = _find_banned(pipeline, policy.defaults.banned_operators)
    if banned:
        raise ValidationError(f"Toán tử '{banned}' không được phép trong pipeline.")

    match_stages = [stage["$match"] for stage in pipeline if "$match" in stage]
    if rule.size == "large":
        keys = rule.require_filter or ([rule.key] if rule.key else [])
        has_key = any(any(k in stage for k in keys) for stage in match_stages)
        if keys and not has_key:
            hint = " hoặc ".join(str(k) for k in keys)
            raise ValidationError(
                f"Collection '{collection}' lớn — pipeline bắt buộc bắt đầu bằng $match theo khoá: {hint}."
            )
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_validator.py -v`
Expected: 12 passed

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/gateway/validator.py finext-fastapi/tests/agent/gateway/test_validator.py
git commit -m "feat(agent): gateway validator + 12 test luật (whitelist, projection, banned ops, require_filter, slice, limit)"
```

---

### Task 3: FixtureGateway — chạy được khi chưa có Mongo

**Files:**
- Create: `finext-fastapi/app/agent/gateway/fixture.py`
- Create: `finext-fastapi/app/agent/gateway/fixtures/agent_db.json`
- Test: `finext-fastapi/tests/agent/gateway/test_fixture_gateway.py`

**Interfaces:**
- Consumes: `GatewayContext`, `GatewayResult`, `GatewayProtocol` (Task 1) · `validate_find`, `validate_aggregate`, `ValidationError` (Task 2)
- Produces: `FixtureGateway(policy: Policy, fixtures_path: Path | None = None)` — implement `GatewayProtocol`, dùng cho test/CI/dev (doc 01 §7)

- [ ] **Step 1: Tạo fixture data**

Tạo `finext-fastapi/app/agent/gateway/fixtures/agent_db.json` (vài doc dạng thật, đủ để trả lời "FPT giá bao nhiêu"):

```json
{
  "stock_snapshot": [
    { "ticker": "FPT", "price": 118.5, "pct_change": 1.28, "volume": 3120400, "value": 368.2 },
    { "ticker": "HPG", "price": 22.25, "pct_change": -0.45, "volume": 18220100, "value": 405.6 }
  ],
  "stock_info": [
    { "ticker": "FPT", "ticker_name": "CTCP FPT", "industry": "Công nghệ thông tin", "type": "SXKD" },
    { "ticker": "HPG", "ticker_name": "CTCP Tập đoàn Hòa Phát", "industry": "Kim loại công nghiệp", "type": "SXKD" }
  ],
  "market_phase": [
    { "phase": "Tích lũy", "as_of": "2026-07-13", "exposure": 0.6 }
  ],
  "data_briefing": [
    { "type": "core", "as_of": "2026-07-14T15:02", "headline": "VNINDEX +0,42% — thanh khoản trung bình" }
  ]
}
```

- [ ] **Step 2: Viết failing test**

Tạo `finext-fastapi/tests/agent/gateway/test_fixture_gateway.py`:

```python
import pytest

from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext

CTX = GatewayContext(request_id="test-req", user_id="test-user")


@pytest.fixture
def gateway() -> FixtureGateway:
    return FixtureGateway(Policy.load())


async def test_find_returns_matching_docs(gateway: FixtureGateway):
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["ticker"] == "FPT"
    assert result.data[0]["price"] == 118.5
    assert "price" in result.data[0]
    assert "volume" not in result.data[0]  # projection được áp dụng
    assert result.meta["collection"] == "stock_snapshot"


async def test_find_applies_limit(gateway: FixtureGateway):
    result = await gateway.find(CTX, "stock_snapshot", filter={}, projection={"ticker": 1}, limit=1)
    assert result.data is not None
    assert len(result.data) == 1


async def test_find_rejects_invalid_query_with_hint(gateway: FixtureGateway):
    result = await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection=None)
    assert result.ok is False
    assert result.data is None
    assert result.error is not None
    assert "projection" in result.error


async def test_find_rejects_collection_outside_whitelist(gateway: FixtureGateway):
    result = await gateway.find(CTX, "users", filter={}, projection={"email": 1})
    assert result.ok is False
    assert result.error is not None
    assert "không nằm trong phạm vi dữ liệu" in result.error


async def test_find_on_small_collection_without_projection(gateway: FixtureGateway):
    result = await gateway.find(CTX, "data_briefing", filter={"type": "core"})
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["as_of"] == "2026-07-14T15:02"
```

- [ ] **Step 3: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_fixture_gateway.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.gateway.fixture'`

- [ ] **Step 4: Viết `fixture.py`**

Tạo `finext-fastapi/app/agent/gateway/fixture.py`:

```python
"""FixtureGateway — cùng interface, data từ JSON tĩnh. Dev/CI không cần Mongo (doc 01 §7)."""

import json
import logging
from pathlib import Path
from typing import Any

from .policy import Policy
from .types import GatewayContext, GatewayResult
from .validator import ValidationError, validate_aggregate, validate_find

logger = logging.getLogger(__name__)

DEFAULT_FIXTURES = Path(__file__).parent / "fixtures" / "agent_db.json"


def _matches(doc: dict[str, Any], filter: dict[str, Any]) -> bool:
    """So khớp filter phẳng (đủ cho fixture — không mô phỏng toàn bộ Mongo)."""
    return all(doc.get(key) == value for key, value in filter.items())


def _project(doc: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    if not projection:
        return dict(doc)
    keys = [k for k, v in projection.items() if v and k != "_id"]
    return {k: doc[k] for k in keys if k in doc}


class FixtureGateway:
    def __init__(self, policy: Policy, fixtures_path: Path = DEFAULT_FIXTURES) -> None:
        self._policy = policy
        self._data: dict[str, list[dict[str, Any]]] = json.loads(fixtures_path.read_text(encoding="utf-8"))

    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult:
        try:
            effective_limit = validate_find(self._policy, collection, filter, projection, sort, limit)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        docs = self._data.get(collection, [])
        matched = [_project(d, projection) for d in docs if _matches(d, filter or {})]
        data = matched[:effective_limit]
        return GatewayResult(ok=True, data=data, meta={"collection": collection, "ms": 0, "plan": "FIXTURE"})

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})
        return GatewayResult(
            ok=False,
            error="Chế độ fixture không hỗ trợ aggregate. Hãy dùng db_find.",
            meta={"collection": collection},
        )
```

- [ ] **Step 5: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/ -v`
Expected: 21 passed (4 policy + 12 validator + 5 fixture)

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/gateway/fixture.py finext-fastapi/app/agent/gateway/fixtures finext-fastapi/tests/agent/gateway/test_fixture_gateway.py
git commit -m "feat(agent): FixtureGateway + fixture agent_db (dev/CI không cần Mongo)"
```

---

### Task 4: MongoGateway — executor thật (Motor + cap bytes + log)

**Files:**
- Create: `finext-fastapi/app/agent/gateway/executor.py`
- Create: `finext-fastapi/app/agent/gateway/__init__.py` (MODIFY: export factory `build_gateway`)
- Test: `finext-fastapi/tests/agent/gateway/test_executor.py`

**Interfaces:**
- Consumes: `Policy`, `validate_find`, `validate_aggregate`, `GatewayResult`, `GatewayContext`
- Produces: `MongoGateway(db, policy, explain_mode: str = "off")` implement `GatewayProtocol` · `build_gateway() -> GatewayProtocol` (đọc env `AGENT_GATEWAY`, guard fixture-in-production)

**Chi tiết:** `maxTimeMS` từ policy · cap `max_response_kb` (cắt bớt doc + `meta["truncated"]=True`) · `explain_mode="on"` → chỉ explain collection `size:large`, plan chứa `COLLSCAN` → từ chối kèm gợi ý · `explain_mode="off"` → tin `require_filter` (doc 01 §6 R1c/R2) · log `{request_id, collection, ms, bytes, plan}` — **không log filter**.

- [ ] **Step 1: Viết failing test (fake Motor collection, không cần Mongo thật)**

Tạo `finext-fastapi/tests/agent/gateway/test_executor.py`:

```python
from typing import Any

import pytest

from app.agent.gateway.executor import MongoGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext

CTX = GatewayContext(request_id="test-req", user_id="test-user")


class FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = docs

    def limit(self, n: int) -> "FakeCursor":
        return FakeCursor(self._docs[:n])

    def sort(self, spec: Any) -> "FakeCursor":
        return self

    def max_time_ms(self, ms: int) -> "FakeCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return self._docs


class FakeCollection:
    def __init__(self, docs: list[dict[str, Any]], plan: str = "IXSCAN") -> None:
        self._docs = docs
        self._plan = plan
        self.last_projection: dict[str, Any] | None = None

    def find(self, filter: dict[str, Any], projection: dict[str, Any] | None = None) -> FakeCursor:
        self.last_projection = projection
        return FakeCursor(self._docs)


class FakeDB:
    def __init__(self, collection: FakeCollection) -> None:
        self._collection = collection

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collection

    async def command(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"queryPlanner": {"winningPlan": {"stage": self._collection._plan}}}


async def test_find_returns_docs_and_meta():
    collection = FakeCollection([{"ticker": "FPT", "price": 118.5}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "price": 1}, limit=1
    )
    assert result.ok is True
    assert result.data == [{"ticker": "FPT", "price": 118.5}]
    assert result.meta["collection"] == "stock_snapshot"
    assert result.meta["bytes"] > 0
    assert "ms" in result.meta


async def test_find_forces_id_exclusion_in_projection():
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1)
    assert collection.last_projection == {"ticker": 1, "_id": 0}


async def test_invalid_query_never_touches_mongo():
    collection = FakeCollection([{"ticker": "FPT"}])
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection=None)
    assert result.ok is False
    assert collection.last_projection is None  # chưa hề gọi find()
    assert result.error is not None and "projection" in result.error


async def test_response_over_cap_is_truncated():
    docs = [{"ticker": f"T{i:04d}", "blob": "x" * 2000} for i in range(50)]
    collection = FakeCollection(docs)
    gateway = MongoGateway(FakeDB(collection), Policy.load())
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1, "blob": 1}, limit=50
    )
    assert result.ok is True
    assert result.data is not None
    assert len(result.data) < 50
    assert result.meta["truncated"] is True
    assert result.meta["bytes"] <= 50 * 1024


async def test_explain_mode_on_rejects_collscan():
    collection = FakeCollection([{"ticker": "FPT"}], plan="COLLSCAN")
    gateway = MongoGateway(FakeDB(collection), Policy.load(), explain_mode="on")
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is False
    assert result.error is not None
    assert "quét toàn bộ" in result.error


async def test_explain_mode_off_skips_explain(monkeypatch: pytest.MonkeyPatch):
    collection = FakeCollection([{"ticker": "FPT"}], plan="COLLSCAN")
    gateway = MongoGateway(FakeDB(collection), Policy.load(), explain_mode="off")
    result = await gateway.find(
        CTX, "stock_snapshot", filter={"ticker": "FPT"}, projection={"ticker": 1}, limit=1
    )
    assert result.ok is True  # heuristic: tin require_filter, không explain
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_executor.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.gateway.executor'`

- [ ] **Step 3: Viết `executor.py`**

Tạo `finext-fastapi/app/agent/gateway/executor.py`:

```python
"""MongoGateway — chạy query đã hợp lệ qua Motor. Lớp DUY NHẤT chạm agent_db."""

import json
import logging
import time
from typing import Any

from .policy import Policy
from .types import GatewayContext, GatewayResult
from .validator import ValidationError, validate_aggregate, validate_find

logger = logging.getLogger(__name__)


def _cap_bytes(docs: list[dict[str, Any]], max_kb: int) -> tuple[list[dict[str, Any]], int, bool]:
    """Cắt danh sách doc cho vừa ngân sách bytes. Trả (docs, bytes, truncated)."""
    budget = max_kb * 1024
    kept: list[dict[str, Any]] = []
    total = 0
    for doc in docs:
        size = len(json.dumps(doc, ensure_ascii=False, default=str).encode("utf-8"))
        if total + size > budget:
            return kept, total, True
        kept.append(doc)
        total += size
    return kept, total, False


class MongoGateway:
    def __init__(self, db: Any, policy: Policy, explain_mode: str = "off") -> None:
        self._db = db
        self._policy = policy
        self._explain_mode = explain_mode

    async def _is_collscan(self, collection: str, filter: dict[str, Any], projection: dict[str, Any]) -> bool:
        explain = await self._db.command(
            {"explain": {"find": collection, "filter": filter, "projection": projection}, "verbosity": "queryPlanner"}
        )
        plan = json.dumps(explain.get("queryPlanner", {}))
        return "COLLSCAN" in plan

    async def find(
        self,
        ctx: GatewayContext,
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[list[Any]] | None = None,
        limit: int | None = None,
    ) -> GatewayResult:
        try:
            effective_limit = validate_find(self._policy, collection, filter, projection, sort, limit)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        rule = self._policy.rule_for(collection)
        query_filter = filter or {}
        query_projection = {**(projection or {}), "_id": 0}
        started = time.perf_counter()

        if self._explain_mode == "on" and rule is not None and rule.size == "large":
            if await self._is_collscan(collection, query_filter, query_projection):
                logger.warning("gateway collscan request_id=%s collection=%s", ctx.request_id, collection)
                return GatewayResult(
                    ok=False,
                    error=(
                        f"Query trên '{collection}' phải quét toàn bộ collection. "
                        "Hãy thêm filter theo khoá chính (ví dụ ticker) để dùng được index."
                    ),
                    meta={"collection": collection, "rejected": True, "plan": "COLLSCAN"},
                )

        cursor = self._db[collection].find(query_filter, query_projection)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.limit(effective_limit).max_time_ms(self._policy.defaults.max_time_ms)
        docs = await cursor.to_list(length=effective_limit)

        data, size, truncated = _cap_bytes(docs, self._policy.defaults.max_response_kb)
        ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gateway ok request_id=%s collection=%s ms=%d bytes=%d n=%d truncated=%s",
            ctx.request_id, collection, ms, size, len(data), truncated,
        )
        return GatewayResult(
            ok=True,
            data=data,
            meta={"collection": collection, "ms": ms, "bytes": size, "truncated": truncated},
        )

    async def aggregate(
        self, ctx: GatewayContext, collection: str, pipeline: list[dict[str, Any]]
    ) -> GatewayResult:
        try:
            validate_aggregate(self._policy, collection, pipeline)
        except ValidationError as exc:
            logger.info("gateway rejected request_id=%s collection=%s", ctx.request_id, collection)
            return GatewayResult(ok=False, error=exc.message, meta={"collection": collection, "rejected": True})

        started = time.perf_counter()
        cursor = self._db[collection].aggregate(pipeline, maxTimeMS=self._policy.defaults.max_time_ms)
        docs = await cursor.to_list(length=self._policy.defaults.max_limit)
        data, size, truncated = _cap_bytes(docs, self._policy.defaults.max_response_kb)
        ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "gateway ok request_id=%s collection=%s ms=%d bytes=%d n=%d (aggregate)",
            ctx.request_id, collection, ms, size, len(data),
        )
        return GatewayResult(
            ok=True, data=data, meta={"collection": collection, "ms": ms, "bytes": size, "truncated": truncated}
        )
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/gateway/test_executor.py -v`
Expected: 6 passed

- [ ] **Step 5: Viết factory trong `__init__.py`**

Ghi đè `finext-fastapi/app/agent/gateway/__init__.py`:

```python
"""Gateway — lớp duy nhất được chạm agent_db (doc 01)."""

import logging

from app.core.config import AGENT_GATEWAY, GATEWAY_EXPLAIN_MODE
from app.core.database import get_database

from .executor import MongoGateway
from .fixture import FixtureGateway
from .policy import Policy
from .types import GatewayContext, GatewayProtocol, GatewayResult

logger = logging.getLogger(__name__)

__all__ = ["GatewayContext", "GatewayProtocol", "GatewayResult", "build_gateway"]

_policy: Policy | None = None


def build_gateway() -> GatewayProtocol:
    """Chọn implementation theo env. Fixture KHÔNG BAO GIỜ chạy ở production (doc 01 §7)."""
    global _policy
    if _policy is None:
        _policy = Policy.load()

    if AGENT_GATEWAY == "fixture":
        logger.warning("Gateway đang chạy chế độ FIXTURE — chỉ dùng cho dev/test.")
        return FixtureGateway(_policy)

    return MongoGateway(get_database("agent_db"), _policy, explain_mode=GATEWAY_EXPLAIN_MODE)
```

- [ ] **Step 6: Chạy full test suite**

Run: `cd finext-fastapi && uv run pytest -v`
Expected: 27 passed

- [ ] **Step 7: Commit**

```bash
git add finext-fastapi/app/agent/gateway/executor.py finext-fastapi/app/agent/gateway/__init__.py finext-fastapi/tests/agent/gateway/test_executor.py
git commit -m "feat(agent): MongoGateway (cap bytes, explain mode, log) + factory build_gateway"
```

---

### Task 5: SSE skeleton — router + echo adapter (chưa cần LLM)

**Files:**
- Create: `finext-fastapi/app/agent/events.py`
- Create: `finext-fastapi/app/agent/adapters/__init__.py`, `finext-fastapi/app/agent/adapters/base.py`, `finext-fastapi/app/agent/adapters/echo.py`
- Create: `finext-fastapi/app/schemas/chat.py`
- Create: `finext-fastapi/app/routers/chat.py`
- Modify: `finext-fastapi/app/main.py` (import + `include_router`)
- Test: `finext-fastapi/tests/agent/test_sse_contract.py`

**Interfaces:**
- Consumes: —
- Produces: `TokenEvent(text)` · `ToolCallsEvent(calls: list[ToolCall])` · `DoneEvent(usage: dict)` · `ErrorEvent(message)` · `ToolCall(id, name, arguments: dict)` · `SystemBlock(text, cache_hint)` · `ModelAdapter` Protocol (`stream_chat(system, messages, tools, max_tokens) -> AsyncIterator[AgentEvent]`) · `EchoAdapter` · `sse_frame(type, payload) -> str` · router `POST /api/v1/chat/stream`

**Contract (doc 02 §3 — ĐÓNG BĂNG):** `meta{conversation_id,message_id,as_of}` → `token{text}` → `tool_start{name,label}` / `tool_end{name,ok,ms}` → `done{usage:{in,out},interrupted?}` · `error{message}` in-band · heartbeat `: hb\n\n` mỗi 10s im lặng.

- [ ] **Step 1: Viết failing test cho SSE frame + echo adapter**

Tạo `finext-fastapi/tests/agent/test_sse_contract.py` (`tests/agent/__init__.py` đã tạo ở Task 1):

```python
import json

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.echo import EchoAdapter
from app.agent.events import DoneEvent, TokenEvent
from app.routers.chat import sse_frame


def test_sse_frame_format():
    frame = sse_frame("token", {"text": "xin chào"})
    assert frame.endswith("\n\n")
    assert frame.startswith("data: ")
    payload = json.loads(frame[len("data: ") : -2])
    assert payload == {"type": "token", "text": "xin chào"}


def test_sse_frame_keeps_vietnamese_unescaped():
    frame = sse_frame("token", {"text": "giá cổ phiếu"})
    assert "giá cổ phiếu" in frame


async def test_echo_adapter_streams_tokens_then_done():
    adapter = EchoAdapter()
    events = [
        event
        async for event in adapter.stream_chat(
            system=[SystemBlock(text="stub", cache_hint=True)],
            messages=[{"role": "user", "content": "FPT giá bao nhiêu?"}],
            tools=[],
            max_tokens=100,
        )
    ]
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert len(tokens) >= 2
    assert "FPT giá bao nhiêu?" in "".join(t.text for t in tokens)
    assert isinstance(events[-1], DoneEvent)
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_sse_contract.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.events'`

- [ ] **Step 3: Viết `events.py`**

Tạo `finext-fastapi/app/agent/events.py`:

```python
"""Event nội bộ giữa adapter ↔ loop ↔ router. KHÔNG phải wire format (wire = doc 02 §3)."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class TokenEvent:
    text: str


@dataclass
class ToolCallsEvent:
    calls: list[ToolCall]


@dataclass
class DoneEvent:
    usage: dict[str, int] = field(default_factory=dict)  # {"in": N, "out": M}


@dataclass
class ErrorEvent:
    message: str


AgentEvent = TokenEvent | ToolCallsEvent | DoneEvent | ErrorEvent
```

- [ ] **Step 4: Viết `adapters/base.py` + `adapters/echo.py`**

Tạo `finext-fastapi/app/agent/adapters/base.py`:

```python
"""Seam duy nhất phụ thuộc provider (doc 02 §6)."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

from app.agent.events import AgentEvent


@dataclass
class SystemBlock:
    text: str
    cache_hint: bool = False  # provider nào hỗ trợ thì dùng; không thì bỏ qua (chỉ ảnh hưởng CHI PHÍ)


class ModelAdapter(Protocol):
    def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]: ...
```

Tạo `finext-fastapi/app/agent/adapters/echo.py`:

```python
"""EchoAdapter — giả lập LLM để test stream/nginx/FE trước khi có LLM key (doc 02 §8)."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from app.agent.events import AgentEvent, DoneEvent, TokenEvent

from .base import SystemBlock


class EchoAdapter:
    async def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]:
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply = f"[echo] Bạn vừa hỏi: {last_user}"
        for word in reply.split(" "):
            await asyncio.sleep(0.05)
            yield TokenEvent(text=word + " ")
        yield DoneEvent(usage={"in": 0, "out": len(reply.split())})
```

Tạo `finext-fastapi/app/agent/adapters/__init__.py` (rỗng).

- [ ] **Step 5: Viết `schemas/chat.py`**

Tạo `finext-fastapi/app/schemas/chat.py`:

```python
from pydantic import BaseModel, Field


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
```

- [ ] **Step 6: Viết `routers/chat.py`**

Tạo `finext-fastapi/app/routers/chat.py`. Pattern SSE copy từ `app/routers/sse.py` (queue + `asyncio.wait_for` heartbeat + header `X-Accel-Buffering: no`):

```python
import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.agent.adapters.echo import EchoAdapter
from app.agent.adapters.base import SystemBlock
from app.agent.events import DoneEvent, ErrorEvent, TokenEvent
from app.auth.dependencies import get_current_active_user
from app.schemas.chat import ChatStreamRequest
from app.schemas.users import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags thêm ở main.py

HEARTBEAT_SECONDS = 10.0
MAX_OUTPUT_TOKENS = 1200


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


async def _run_agent(queue: asyncio.Queue, body: ChatStreamRequest) -> None:
    """Producer: chạy agent, đẩy frame vào queue. None = kết thúc stream."""
    adapter = EchoAdapter()
    try:
        async for event in adapter.stream_chat(
            system=[SystemBlock(text="stub", cache_hint=True)],
            messages=[{"role": "user", "content": body.message}],
            tools=[],
            max_tokens=MAX_OUTPUT_TOKENS,
        ):
            if isinstance(event, TokenEvent):
                await queue.put(sse_frame("token", {"text": event.text}))
            elif isinstance(event, DoneEvent):
                await queue.put(sse_frame("done", {"usage": event.usage}))
            elif isinstance(event, ErrorEvent):
                await queue.put(sse_frame("error", {"message": event.message}))
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent")
        await queue.put(sse_frame("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."}))
    finally:
        await queue.put(None)


async def _event_stream(request: Request, body: ChatStreamRequest, user_id: str) -> AsyncIterator[str]:
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    conversation_id = body.conversation_id or str(uuid.uuid4())
    message_id = str(uuid.uuid4())

    yield sse_frame("meta", {"conversation_id": conversation_id, "message_id": message_id, "as_of": None})

    task = asyncio.create_task(_run_agent(queue, body))
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                frame = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if frame is None:
                break
            yield frame
    finally:
        if not task.done():
            task.cancel()  # user đóng tab → ngừng trả tiền token ngay
        logger.info("chat stream kết thúc user_id=%s conversation_id=%s", user_id, conversation_id)


@router.post("/stream", summary="[User] Chat với Finext AI (SSE)", tags=["chat"])
async def chat_stream(
    request: Request,
    body: ChatStreamRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> StreamingResponse:
    return StreamingResponse(
        _event_stream(request, body, str(current_user.id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

> Lưu ý: KHÔNG dùng `@api_response_wrapper` / `StandardApiResponse` cho endpoint này — response là stream, không phải JSON body.

- [ ] **Step 7: Đăng ký router trong `main.py`**

```diff
 from .routers import (
     auth,
     brokers,
+    chat,
     dashboard,
```
```diff
 app.include_router(sse.router, prefix="/api/v1/sse", tags=["sse"])
+app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
```

- [ ] **Step 8: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_sse_contract.py -v`
Expected: 3 passed

- [ ] **Step 9: Verify tay bằng `curl -N`**

Chạy server: `cd finext-fastapi && uv run uvicorn app.main:app --reload --port 8000`
Lấy token: đăng nhập qua `/api/v1/auth/login` (hoặc copy access token từ browser đang đăng nhập).

```bash
curl -N -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"message":"FPT giá bao nhiêu?"}'
```

Expected: `data: {"type":"meta",...}` → nhiều `data: {"type":"token","text":"..."}` nhả DẦN (không dồn cục) → `data: {"type":"done","usage":{...}}`. Không token nào bị escape unicode (phải thấy tiếng Việt có dấu).

- [ ] **Step 10: Commit**

```bash
git add finext-fastapi/app/agent/events.py finext-fastapi/app/agent/adapters finext-fastapi/app/schemas/chat.py finext-fastapi/app/routers/chat.py finext-fastapi/app/main.py finext-fastapi/tests/agent
git commit -m "feat(agent): SSE skeleton /api/v1/chat/stream + echo adapter (contract 02 §3)"
```

---

### Task 6: OpenAICompatAdapter — stream + tool-call parse (điểm bẩn nhất)

**Files:**
- Create: `finext-fastapi/app/agent/adapters/openai_compat.py`
- Test: `finext-fastapi/tests/agent/adapters/__init__.py`, `finext-fastapi/tests/agent/adapters/test_openai_compat.py`

**Interfaces:**
- Consumes: `SystemBlock`, `ModelAdapter` (Task 5) · `TokenEvent`, `ToolCallsEvent`, `ToolCall`, `DoneEvent`, `ErrorEvent`
- Produces: `OpenAICompatAdapter(base_url, api_key, model, client: httpx.AsyncClient | None = None)` · `parse_sse_chunk(line: str) -> dict | None`

**Điểm chết người (doc 02 §6):** `tool_calls` về theo **mảnh JSON string** — tích luỹ theo `index`, chỉ `json.loads` khi `finish_reason == "tool_calls"`. Cần `stream_options: {"include_usage": true}` để có `usage` ở chunk cuối. Retry 429/5xx **CHỈ khi chưa nhả token nào**.

- [ ] **Step 1: Viết failing test với SSE bytes giả lập (định dạng OpenAI-compat)**

Tạo `finext-fastapi/tests/agent/adapters/test_openai_compat.py`:

```python
from collections.abc import AsyncIterator

import httpx
import pytest

from app.agent.adapters.base import SystemBlock
from app.agent.adapters.openai_compat import OpenAICompatAdapter
from app.agent.events import DoneEvent, ToolCallsEvent, TokenEvent

TEXT_STREAM = (
    'data: {"choices":[{"delta":{"role":"assistant","content":""},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"content":"Giá FPT "},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"content":"là 118,5"},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}\n\n'
    'data: {"choices":[],"usage":{"prompt_tokens":1200,"completion_tokens":42}}\n\n'
    "data: [DONE]\n\n"
)

# tool-call arguments về theo MẢNH — đây là bẫy chính (doc 02 §6)
TOOL_STREAM = (
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function",'
    '"function":{"name":"db_find","arguments":""}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"collec"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"tion\\":\\"stock_"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"snapshot\\"}"}}]},"index":0}]}\n\n'
    'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
    "data: [DONE]\n\n"
)


def _adapter_with(body: str, status: int = 200) -> OpenAICompatAdapter:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=body, headers={"content-type": "text/event-stream"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return OpenAICompatAdapter(
        base_url="https://api.test/v1", api_key="sk-test", model="test-model", client=client
    )


async def _collect(adapter: OpenAICompatAdapter) -> list:
    return [
        e
        async for e in adapter.stream_chat(
            system=[SystemBlock(text="pack", cache_hint=True)],
            messages=[{"role": "user", "content": "FPT?"}],
            tools=[],
            max_tokens=100,
        )
    ]


async def test_text_stream_yields_tokens_then_done_with_usage():
    events = await _collect(_adapter_with(TEXT_STREAM))
    tokens = [e for e in events if isinstance(e, TokenEvent)]
    assert "".join(t.text for t in tokens) == "Giá FPT là 118,5"
    done = events[-1]
    assert isinstance(done, DoneEvent)
    assert done.usage == {"in": 1200, "out": 42}


async def test_tool_call_arguments_accumulated_across_chunks():
    events = await _collect(_adapter_with(TOOL_STREAM))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.id == "call_1"
    assert call.name == "db_find"
    assert call.arguments == {"collection": "stock_snapshot"}  # ghép từ 3 mảnh


async def test_malformed_tool_arguments_do_not_crash():
    broken = (
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function",'
        '"function":{"name":"db_find","arguments":"{not json"}}]},"index":0}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls","index":0}]}\n\n'
        "data: [DONE]\n\n"
    )
    events = await _collect(_adapter_with(broken))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    assert tool_events[0].calls[0].arguments == {}  # parse hỏng → dict rỗng, loop sẽ trả error cho model
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/adapters/ -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.adapters.openai_compat'`

- [ ] **Step 3: Viết `openai_compat.py`**

Tạo `finext-fastapi/app/agent/adapters/openai_compat.py`:

```python
"""Adapter chuẩn OpenAI-compat — phủ DeepSeek/OpenRouter/Groq/vLLM… Đổi nhà = đổi env (doc 02 §6)."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.agent.events import AgentEvent, DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent

from .base import SystemBlock

logger = logging.getLogger(__name__)

RETRY_STATUS = {429, 500, 502, 503, 529}
MAX_RETRIES = 2
REQUEST_TIMEOUT = httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0)


def parse_sse_chunk(line: str) -> dict[str, Any] | None:
    """Trả payload JSON của 1 dòng SSE, hoặc None nếu là comment/[DONE]/dòng rỗng."""
    if not line.startswith("data: "):
        return None
    payload = line[len("data: ") :].strip()
    if not payload or payload == "[DONE]":
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        logger.warning("Bỏ qua chunk SSE không parse được từ provider")
        return None


class _ToolCallBuffer:
    """Tích luỹ tool_call theo index — arguments về theo mảnh JSON string."""

    def __init__(self) -> None:
        self._calls: dict[int, dict[str, str]] = {}

    def add(self, delta_calls: list[dict[str, Any]]) -> None:
        for item in delta_calls:
            index = item.get("index", 0)
            slot = self._calls.setdefault(index, {"id": "", "name": "", "arguments": ""})
            if item.get("id"):
                slot["id"] = item["id"]
            function = item.get("function") or {}
            if function.get("name"):
                slot["name"] = function["name"]
            if function.get("arguments"):
                slot["arguments"] += function["arguments"]

    def flush(self) -> list[ToolCall]:
        calls: list[ToolCall] = []
        for index in sorted(self._calls):
            slot = self._calls[index]
            try:
                arguments = json.loads(slot["arguments"]) if slot["arguments"] else {}
            except json.JSONDecodeError:
                logger.warning("Tool call arguments không phải JSON hợp lệ — trả dict rỗng cho loop xử lý")
                arguments = {}
            calls.append(ToolCall(id=slot["id"], name=slot["name"], arguments=arguments))
        return calls


class OpenAICompatAdapter:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    def _payload(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> dict[str, Any]:
        system_messages = [{"role": "system", "content": block.text} for block in system]
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": system_messages + messages,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if tools:
            payload["tools"] = tools
        return payload

    async def stream_chat(
        self,
        system: list[SystemBlock],
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[AgentEvent]:
        payload = self._payload(system, messages, tools, max_tokens)
        headers = {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}
        emitted_token = False
        buffer = _ToolCallBuffer()
        usage: dict[str, int] = {}
        finish_reason: str | None = None

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with self._client.stream("POST", self._url, json=payload, headers=headers) as response:
                    if response.status_code in RETRY_STATUS and not emitted_token and attempt < MAX_RETRIES:
                        await asyncio.sleep(2**attempt)
                        continue
                    if response.status_code >= 400:
                        await response.aread()
                        logger.error("Provider trả lỗi status=%s", response.status_code)
                        yield ErrorEvent(message="Hệ thống AI đang quá tải, thử lại sau ít phút.")
                        return

                    async for line in response.aiter_lines():
                        chunk = parse_sse_chunk(line)
                        if chunk is None:
                            continue
                        if chunk.get("usage"):
                            usage = {
                                "in": chunk["usage"].get("prompt_tokens", 0),
                                "out": chunk["usage"].get("completion_tokens", 0),
                            }
                        for choice in chunk.get("choices", []):
                            delta = choice.get("delta") or {}
                            if delta.get("content"):
                                emitted_token = True
                                yield TokenEvent(text=delta["content"])
                            if delta.get("tool_calls"):
                                buffer.add(delta["tool_calls"])
                            if choice.get("finish_reason"):
                                finish_reason = choice["finish_reason"]
                break
            except (httpx.TimeoutException, httpx.TransportError):
                if emitted_token or attempt >= MAX_RETRIES:
                    logger.exception("Mất kết nối tới provider")
                    yield ErrorEvent(message="Mất kết nối tới hệ thống AI. Vui lòng thử lại.")
                    return
                await asyncio.sleep(2**attempt)

        if finish_reason == "tool_calls":
            yield ToolCallsEvent(calls=buffer.flush())
            return
        yield DoneEvent(usage=usage)
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/adapters/ -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/agent/adapters/openai_compat.py finext-fastapi/tests/agent/adapters
git commit -m "feat(agent): OpenAICompatAdapter — parse stream + tích luỹ tool-call arguments theo mảnh"
```

---

### Task 7: Tools — `db_find` / `db_aggregate` + label chip

**Files:**
- Create: `finext-fastapi/app/agent/tools/__init__.py`, `finext-fastapi/app/agent/tools/registry.py`, `finext-fastapi/app/agent/tools/db.py`
- Create: `finext-fastapi/app/agent/labels.py`
- Test: `finext-fastapi/tests/agent/test_tools.py`

**Interfaces:**
- Consumes: `GatewayProtocol`, `GatewayContext` (Task 1) · `FixtureGateway` (Task 3) · `ToolCall` (Task 5)
- Produces: `TOOL_SCHEMAS: list[dict]` (định dạng OpenAI tools) · `execute_tool(gateway, ctx, call: ToolCall) -> tuple[str, dict]` (trả `(content_json_str, meta)`, **không bao giờ raise** — doc 02 §4.2) · `label_for(call: ToolCall) -> str`

- [ ] **Step 1: Viết failing test**

Tạo `finext-fastapi/tests/agent/test_tools.py`:

```python
import json

from app.agent.events import ToolCall
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.labels import label_for
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool

CTX = GatewayContext(request_id="r1", user_id="u1")


def test_tool_schemas_shape():
    names = {schema["function"]["name"] for schema in TOOL_SCHEMAS}
    assert names == {"db_find", "db_aggregate"}
    for schema in TOOL_SCHEMAS:
        assert schema["type"] == "function"
        assert "collection" in schema["function"]["parameters"]["properties"]


async def test_execute_db_find_returns_json_content():
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(
        id="c1",
        name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    content, meta = await execute_tool(gateway, CTX, call)
    assert json.loads(content)[0]["price"] == 118.5
    assert meta["ok"] is True


async def test_execute_returns_error_text_instead_of_raising():
    gateway = FixtureGateway(Policy.load())
    call = ToolCall(id="c2", name="db_find", arguments={"collection": "stock_snapshot"})
    content, meta = await execute_tool(gateway, CTX, call)
    assert meta["ok"] is False
    assert "projection" in content


async def test_unknown_tool_returns_error_not_raise():
    gateway = FixtureGateway(Policy.load())
    content, meta = await execute_tool(gateway, CTX, ToolCall(id="c3", name="rm_rf", arguments={}))
    assert meta["ok"] is False
    assert "không tồn tại" in content


async def test_empty_arguments_returns_error():
    gateway = FixtureGateway(Policy.load())
    content, meta = await execute_tool(gateway, CTX, ToolCall(id="c4", name="db_find", arguments={}))
    assert meta["ok"] is False


def test_label_uses_vietnamese_map_and_ticker():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}})
    assert label_for(call) == "Đang đọc dữ liệu cổ phiếu FPT…"


def test_label_falls_back_for_unmapped_collection():
    call = ToolCall(id="c1", name="db_find", arguments={"collection": "collection_la"})
    assert label_for(call) == "Đang tra cứu dữ liệu…"
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_tools.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.tools'`

- [ ] **Step 3: Viết `labels.py`**

Tạo `finext-fastapi/app/agent/labels.py`:

```python
"""Sinh label tiếng Việt cho tool chip (doc 02 §4.3). Bảng map ĐƯỢC PHÉP lỗi thời vô hại."""

from app.agent.events import ToolCall

COLLECTION_LABELS: dict[str, str] = {
    "stock_snapshot": "dữ liệu cổ phiếu",
    "stock_info": "thông tin doanh nghiệp",
    "stock_recent": "diễn biến gần đây",
    "industry_snapshot": "dữ liệu ngành",
    "market_snapshot": "dữ liệu thị trường",
    "market_phase": "pha thị trường",
    "history_stock": "lịch sử giá",
    "data_briefing": "bản tin tổng hợp",
}

FALLBACK = "Đang tra cứu dữ liệu…"


def label_for(call: ToolCall) -> str:
    collection = call.arguments.get("collection")
    label = COLLECTION_LABELS.get(collection) if isinstance(collection, str) else None
    if label is None:
        return FALLBACK
    ticker = (call.arguments.get("filter") or {}).get("ticker")
    suffix = f" {ticker}" if isinstance(ticker, str) else ""
    return f"Đang đọc {label}{suffix}…"
```

- [ ] **Step 4: Viết `tools/db.py` + `tools/registry.py`**

Tạo `finext-fastapi/app/agent/tools/db.py`:

```python
"""2 tool generic — model tự viết query, luật do policy quyết (doc 02 §4.1)."""

from typing import Any

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

DB_FIND_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_find",
        "description": (
            "Đọc document từ agent_db. Luôn kèm projection để chỉ lấy field cần thiết. "
            "Với collection lớn phải lọc theo khoá chính (ví dụ ticker)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string", "description": "Tên collection trong agent_db"},
                "filter": {"type": "object", "description": "Điều kiện lọc kiểu MongoDB"},
                "projection": {"type": "object", "description": 'Field cần lấy, ví dụ {"ticker": 1, "price": 1}'},
                "sort": {"type": "array", "items": {"type": "array"}, "description": 'Ví dụ [["date", -1]]'},
                "limit": {"type": "integer", "description": "Số doc tối đa"},
            },
            "required": ["collection"],
        },
    },
}

DB_AGGREGATE_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "db_aggregate",
        "description": "Chạy aggregation pipeline trên agent_db để tính thống kê (trung bình, xếp hạng, tổng hợp).",
        "parameters": {
            "type": "object",
            "properties": {
                "collection": {"type": "string"},
                "pipeline": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["collection", "pipeline"],
        },
    },
}


async def run_db_find(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    return await gateway.find(
        ctx,
        collection=args["collection"],
        filter=args.get("filter"),
        projection=args.get("projection"),
        sort=args.get("sort"),
        limit=args.get("limit"),
    )


async def run_db_aggregate(gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]) -> GatewayResult:
    return await gateway.aggregate(ctx, collection=args["collection"], pipeline=args["pipeline"])
```

Tạo `finext-fastapi/app/agent/tools/registry.py`:

```python
"""Dispatch tool call. KHÔNG BAO GIỜ raise — lỗi trả về dạng text cho model tự sửa (doc 02 §4.2)."""

import json
import logging
from typing import Any

from app.agent.events import ToolCall
from app.agent.gateway.types import GatewayContext, GatewayProtocol

from .db import DB_AGGREGATE_SCHEMA, DB_FIND_SCHEMA, run_db_aggregate, run_db_find

logger = logging.getLogger(__name__)

TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA]

MAX_TOOL_RESULT_CHARS = 12_000

_HANDLERS = {"db_find": run_db_find, "db_aggregate": run_db_aggregate}


async def execute_tool(
    gateway: GatewayProtocol, ctx: GatewayContext, call: ToolCall
) -> tuple[str, dict[str, Any]]:
    """Trả (content cho model, meta cho event tool_end)."""
    handler = _HANDLERS.get(call.name)
    if handler is None:
        return f"Tool '{call.name}' không tồn tại.", {"ok": False, "ms": 0}

    if not call.arguments.get("collection"):
        return "Thiếu tham số bắt buộc 'collection'.", {"ok": False, "ms": 0}

    try:
        result = await handler(gateway, ctx, call.arguments)
    except KeyError as exc:
        return f"Thiếu tham số bắt buộc: {exc}.", {"ok": False, "ms": 0}
    except Exception:
        logger.exception("Tool %s lỗi không mong đợi", call.name)
        return "Lỗi khi truy vấn dữ liệu. Hãy thử query khác.", {"ok": False, "ms": 0}

    meta = {"ok": result.ok, "ms": result.meta.get("ms", 0)}
    if not result.ok:
        return result.error or "Query bị từ chối.", meta

    content = json.dumps(result.data, ensure_ascii=False, default=str)
    if len(content) > MAX_TOOL_RESULT_CHARS:
        content = content[:MAX_TOOL_RESULT_CHARS] + " …[đã cắt]"
    return content, meta
```

Tạo `finext-fastapi/app/agent/tools/__init__.py` (rỗng).

- [ ] **Step 5: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_tools.py -v`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/agent/tools finext-fastapi/app/agent/labels.py finext-fastapi/tests/agent/test_tools.py
git commit -m "feat(agent): tool db_find/db_aggregate + label chip tiếng Việt"
```

---

### Task 8: Agent loop + system prompt assembly, cắm vào router

**Files:**
- Create: `finext-fastapi/app/agent/context.py`
- Create: `finext-fastapi/app/agent/pack_stub/00_system_stub.md`
- Create: `finext-fastapi/app/agent/loop.py`
- Modify: `finext-fastapi/app/routers/chat.py` (thay EchoAdapter bằng loop thật + build_gateway)
- Test: `finext-fastapi/tests/agent/test_loop.py`

**Interfaces:**
- Consumes: `ModelAdapter`, `SystemBlock`, `GatewayProtocol`, `GatewayContext`, `TOOL_SCHEMAS`, `execute_tool`, `label_for`, tất cả event type
- Produces: `run_agent(adapter, gateway, ctx, system, messages, emit) -> None` — `emit: Callable[[str, dict], Awaitable[None]]` (router truyền hàm đẩy frame vào queue) · `build_system_blocks(gateway, ctx) -> tuple[list[SystemBlock], str | None]` (trả blocks + `as_of`) · `build_adapter() -> ModelAdapter`

**Luật loop (doc 02 §4.2):** `MAX_ITERS = 8` · tool result cắt 12.000 chars (đã làm ở registry) · tổng result/lượt cap 30.000 chars · nhiều tool call → `asyncio.gather` · chạm MAX_ITERS → `error` "Vượt giới hạn bước xử lý".

- [ ] **Step 1: Viết pack stub**

Tạo `finext-fastapi/app/agent/pack_stub/00_system_stub.md` (~1k tok — doc 02 §5.1; pack THẬT là việc của owner, ngoài repo):

```markdown
# Finext AI — pack stub (chỉ dùng cho dev/CI, KHÔNG phải pack thật)

Bạn là trợ lý dữ liệu chứng khoán Việt Nam của Finext. Trả lời ngắn gọn, tiếng Việt.

## Luật số liệu (bắt buộc)
- MỌI con số phải lấy từ kết quả tool. TUYỆT ĐỐI không tự bịa, không tự tính nhẩm.
- Không có dữ liệu → nói thẳng "chưa có dữ liệu", không đoán.
- Luôn kèm 1 dòng: thông tin tham khảo, không phải khuyến nghị đầu tư.

## Cách truy vấn
- Dùng `db_find` với `projection` chỉ lấy field cần. Collection lớn phải lọc theo khoá (`ticker`).
- Collection thường dùng:
  - `stock_snapshot` (khoá `ticker`): giá phiên hiện tại — field `price`, `pct_change`, `volume`, `value`.
  - `stock_info` (khoá `ticker`): `ticker_name`, `industry`.
  - `market_phase`: pha thị trường hiện tại.
  - `data_briefing` (`type: "core"`): bản tin tổng hợp.

## Đơn vị
- `*_pct` là ĐIỂM % — `pct_change: 1.28` nghĩa là +1,28%. KHÔNG nhân 100 lần nữa.
- Tiền: tỷ đồng.
```

- [ ] **Step 2: Viết `context.py`**

Tạo `finext-fastapi/app/agent/context.py`:

```python
"""Lắp system prompt: pack (data) + briefing. Server chỉ GHÉP, không hiểu nội dung (doc 02 §5)."""

import logging
import time
from pathlib import Path
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.core.config import AGENT_PACK_DIR

logger = logging.getLogger(__name__)

PACK_STUB_DIR = Path(__file__).parent / "pack_stub"
BRIEFING_TTL_SECONDS = 600
MAX_BRIEFING_BYTES = 6_000

_briefing_cache: dict[str, Any] = {"at": 0.0, "text": None, "as_of": None}

FRESHNESS_NOTE = (
    "Mốc dữ liệu: {as_of}. Trong giờ giao dịch, giá/khối lượng cập nhật gần realtime; "
    "riêng dữ liệu PHASE chốt cuối ngày (có thể trễ 1 phiên)."
)
NO_BRIEFING_NOTE = "Hiện chưa có bản tin tổng hợp — hãy chủ động query dữ liệu khi cần."


def _read_pack() -> str:
    pack_dir = Path(AGENT_PACK_DIR) if AGENT_PACK_DIR else PACK_STUB_DIR
    if not pack_dir.is_dir():
        logger.error("Không tìm thấy AGENT_PACK_DIR=%s — dùng pack stub", pack_dir)
        pack_dir = PACK_STUB_DIR
    files = sorted(pack_dir.glob("*.md"))
    logger.info("Nạp pack từ %s (%d file)", pack_dir, len(files))
    return "\n\n".join(f.read_text(encoding="utf-8") for f in files)


async def _read_briefing(gateway: GatewayProtocol, ctx: GatewayContext) -> tuple[str | None, str | None]:
    now = time.time()
    if _briefing_cache["text"] is not None and now - _briefing_cache["at"] < BRIEFING_TTL_SECONDS:
        return _briefing_cache["text"], _briefing_cache["as_of"]

    result = await gateway.find(ctx, "data_briefing", filter={"type": "core"}, limit=1)
    if not result.ok or not result.data:
        logger.warning("Không đọc được data_briefing — chạy không có briefing (doc 02 §5.2 case 2)")
        return None, None

    doc = result.data[0]
    as_of = doc.get("as_of")
    text = str(doc)[:MAX_BRIEFING_BYTES]
    _briefing_cache.update({"at": now, "text": text, "as_of": as_of})
    return text, as_of


async def build_system_blocks(
    gateway: GatewayProtocol, ctx: GatewayContext
) -> tuple[list[SystemBlock], str | None]:
    blocks = [SystemBlock(text=_read_pack(), cache_hint=True)]
    briefing, as_of = await _read_briefing(gateway, ctx)
    if briefing is None:
        blocks.append(SystemBlock(text=NO_BRIEFING_NOTE, cache_hint=True))
        return blocks, None
    blocks.append(
        SystemBlock(text=f"{briefing}\n\n{FRESHNESS_NOTE.format(as_of=as_of)}", cache_hint=True)
    )
    return blocks, as_of
```

- [ ] **Step 3: Viết failing test cho loop**

Tạo `finext-fastapi/tests/agent/test_loop.py`:

```python
from collections.abc import AsyncIterator
from typing import Any

from app.agent.adapters.base import SystemBlock
from app.agent.events import AgentEvent, DoneEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.loop import MAX_ITERS, run_agent

CTX = GatewayContext(request_id="r1", user_id="u1")
SYSTEM = [SystemBlock(text="stub", cache_hint=True)]


class ScriptedAdapter:
    """Trả về kịch bản event định sẵn cho từng vòng gọi."""

    def __init__(self, scripts: list[list[AgentEvent]]) -> None:
        self._scripts = scripts
        self.calls: list[list[dict[str, Any]]] = []

    async def stream_chat(
        self, system: list[SystemBlock], messages: list[dict[str, Any]], tools: list[dict[str, Any]], max_tokens: int
    ) -> AsyncIterator[AgentEvent]:
        self.calls.append(messages)
        script = self._scripts[min(len(self.calls) - 1, len(self._scripts) - 1)]
        for event in script:
            yield event


async def _collect(adapter: Any) -> list[tuple[str, dict[str, Any]]]:
    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        emitted.append((event_type, payload))

    await run_agent(
        adapter=adapter,
        gateway=FixtureGateway(Policy.load()),
        ctx=CTX,
        system=SYSTEM,
        messages=[{"role": "user", "content": "FPT giá bao nhiêu?"}],
        emit=emit,
    )
    return emitted


async def test_plain_answer_emits_tokens_and_done():
    adapter = ScriptedAdapter([[TokenEvent(text="Chào "), TokenEvent(text="bạn"), DoneEvent(usage={"in": 10, "out": 2})]])
    emitted = await _collect(adapter)
    assert [e[0] for e in emitted] == ["token", "token", "done"]
    assert emitted[-1][1]["usage"] == {"in": 10, "out": 2}


async def test_tool_call_round_trip_feeds_result_back_to_model():
    tool_call = ToolCall(
        id="c1",
        name="db_find",
        arguments={"collection": "stock_snapshot", "filter": {"ticker": "FPT"}, "projection": {"price": 1}},
    )
    adapter = ScriptedAdapter(
        [
            [ToolCallsEvent(calls=[tool_call])],
            [TokenEvent(text="Giá FPT là 118,5"), DoneEvent(usage={"in": 50, "out": 6})],
        ]
    )
    emitted = await _collect(adapter)
    types = [e[0] for e in emitted]
    assert types == ["tool_start", "tool_end", "token", "done"]
    assert emitted[0][1]["label"] == "Đang đọc dữ liệu cổ phiếu FPT…"
    assert emitted[1][1]["ok"] is True

    second_call_messages = adapter.calls[1]
    tool_message = second_call_messages[-1]
    assert tool_message["role"] == "tool"
    assert tool_message["tool_call_id"] == "c1"
    assert "118.5" in tool_message["content"]


async def test_failed_tool_still_emits_tool_end_and_feeds_error_text():
    bad_call = ToolCall(id="c9", name="db_find", arguments={"collection": "stock_snapshot"})
    adapter = ScriptedAdapter(
        [[ToolCallsEvent(calls=[bad_call])], [TokenEvent(text="Xin lỗi"), DoneEvent(usage={})]]
    )
    emitted = await _collect(adapter)
    tool_end = next(e for e in emitted if e[0] == "tool_end")
    assert tool_end[1]["ok"] is False
    assert "projection" in adapter.calls[1][-1]["content"]


async def test_max_iters_guard_emits_error():
    looping_call = ToolCall(
        id="c1", name="db_find", arguments={"collection": "market_phase", "filter": {}}
    )
    adapter = ScriptedAdapter([[ToolCallsEvent(calls=[looping_call])]])  # không bao giờ Done
    emitted = await _collect(adapter)
    assert emitted[-1][0] == "error"
    assert "giới hạn" in emitted[-1][1]["message"]
    assert len(adapter.calls) == MAX_ITERS
```

- [ ] **Step 4: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_loop.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.loop'`

- [ ] **Step 5: Viết `loop.py`**

Tạo `finext-fastapi/app/agent/loop.py`:

```python
"""Vòng lặp LLM ↔ tools. Không biết provider nào, không biết gateway nào (doc 02 §4.2)."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.agent.adapters.base import ModelAdapter, SystemBlock
from app.agent.adapters.openai_compat import OpenAICompatAdapter
from app.agent.events import DoneEvent, ErrorEvent, ToolCall, ToolCallsEvent, TokenEvent
from app.agent.gateway.types import GatewayContext, GatewayProtocol
from app.agent.labels import label_for
from app.agent.tools.registry import TOOL_SCHEMAS, execute_tool
from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

logger = logging.getLogger(__name__)

MAX_ITERS = 8
MAX_OUTPUT_TOKENS = 1200
MAX_TOTAL_TOOL_CHARS = 30_000

Emit = Callable[[str, dict[str, Any]], Awaitable[None]]


def build_adapter() -> ModelAdapter:
    if not (LLM_BASE_URL and LLM_API_KEY and LLM_MODEL):
        raise RuntimeError("Thiếu cấu hình LLM_BASE_URL / LLM_API_KEY / LLM_MODEL")
    return OpenAICompatAdapter(base_url=LLM_BASE_URL, api_key=LLM_API_KEY, model=LLM_MODEL)


async def _run_tools(
    gateway: GatewayProtocol, ctx: GatewayContext, calls: list[ToolCall], emit: Emit
) -> list[dict[str, Any]]:
    for call in calls:
        await emit("tool_start", {"name": call.name, "label": label_for(call)})

    results = await asyncio.gather(*(execute_tool(gateway, ctx, call) for call in calls))

    messages: list[dict[str, Any]] = []
    budget = MAX_TOTAL_TOOL_CHARS
    for call, (content, meta) in zip(calls, results, strict=True):
        await emit("tool_end", {"name": call.name, "ok": meta["ok"], "ms": meta["ms"]})
        if len(content) > budget:
            content = content[:budget] + " …[đã cắt do vượt ngân sách]" if budget > 0 else "[đã cắt do vượt ngân sách]"
        budget = max(0, budget - len(content))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": content})
    return messages


def _assistant_tool_message(calls: list[ToolCall]) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.name, "arguments": json.dumps(call.arguments, ensure_ascii=False)},
            }
            for call in calls
        ],
    }


async def run_agent(
    adapter: ModelAdapter,
    gateway: GatewayProtocol,
    ctx: GatewayContext,
    system: list[SystemBlock],
    messages: list[dict[str, Any]],
    emit: Emit,
) -> None:
    working: list[dict[str, Any]] = list(messages)

    for _ in range(MAX_ITERS):
        pending: list[ToolCall] = []
        async for event in adapter.stream_chat(
            system=system, messages=working, tools=TOOL_SCHEMAS, max_tokens=MAX_OUTPUT_TOKENS
        ):
            if isinstance(event, TokenEvent):
                await emit("token", {"text": event.text})
            elif isinstance(event, ToolCallsEvent):
                pending = event.calls
            elif isinstance(event, DoneEvent):
                await emit("done", {"usage": event.usage})
                return
            elif isinstance(event, ErrorEvent):
                await emit("error", {"message": event.message})
                return

        if not pending:
            await emit("done", {"usage": {}})
            return

        working.append(_assistant_tool_message(pending))
        working.extend(await _run_tools(gateway, ctx, pending, emit))

    logger.warning("Agent chạm MAX_ITERS request_id=%s", ctx.request_id)
    await emit("error", {"message": "Vượt giới hạn bước xử lý. Bạn thử hỏi ngắn gọn hơn nhé."})
```

- [ ] **Step 6: Chạy test — phải PASS**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_loop.py -v`
Expected: 4 passed

- [ ] **Step 7: Cắm loop vào router (thay EchoAdapter)**

Trong `finext-fastapi/app/routers/chat.py`, thay `_run_agent` và `_event_stream`:

```python
import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.agent.context import build_system_blocks
from app.agent.gateway import GatewayContext, build_gateway
from app.agent.loop import build_adapter, run_agent
from app.auth.dependencies import get_current_active_user
from app.schemas.chat import ChatStreamRequest
from app.schemas.users import UserInDB

logger = logging.getLogger(__name__)
router = APIRouter()

HEARTBEAT_SECONDS = 10.0

STREAM_END = None


def sse_frame(event_type: str, payload: dict[str, Any]) -> str:
    """Wire format doc 02 §3 — ĐÓNG BĂNG."""
    return f"data: {json.dumps({'type': event_type, **payload}, ensure_ascii=False)}\n\n"


async def _produce(queue: asyncio.Queue, body: ChatStreamRequest, ctx: GatewayContext) -> str | None:
    """Chạy agent, đẩy frame vào queue. Trả as_of cho event meta."""
    gateway = build_gateway()

    async def emit(event_type: str, payload: dict[str, Any]) -> None:
        await queue.put(sse_frame(event_type, payload))

    try:
        system, as_of = await build_system_blocks(gateway, ctx)
        await run_agent(
            adapter=build_adapter(),
            gateway=gateway,
            ctx=ctx,
            system=system,
            messages=[{"role": "user", "content": body.message}],
            emit=emit,
        )
        return as_of
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Lỗi khi chạy agent request_id=%s", ctx.request_id)
        await queue.put(sse_frame("error", {"message": "Hệ thống AI gặp sự cố, vui lòng thử lại."}))
        return None
    finally:
        await queue.put(STREAM_END)


async def _event_stream(request: Request, body: ChatStreamRequest, user_id: str) -> AsyncIterator[str]:
    request_id = str(uuid.uuid4())
    ctx = GatewayContext(request_id=request_id, user_id=user_id)
    conversation_id = body.conversation_id or str(uuid.uuid4())

    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    task = asyncio.create_task(_produce(queue, body, ctx))

    # meta.as_of = null ở v1 slice: briefing đọc trong task nền, không chặn frame đầu (doc 02 §5.2)
    yield sse_frame(
        "meta", {"conversation_id": conversation_id, "message_id": request_id, "as_of": None}
    )

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
    return StreamingResponse(
        _event_stream(request, body, str(current_user.id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 8: Chạy full suite**

Run: `cd finext-fastapi && uv run pytest -v`
Expected: 44 passed (27 gateway + 3 sse + 3 adapter + 7 tools + 4 loop). **Không được có FAIL.**

- [ ] **Step 9: Commit**

```bash
git add finext-fastapi/app/agent/loop.py finext-fastapi/app/agent/context.py finext-fastapi/app/agent/pack_stub finext-fastapi/app/routers/chat.py finext-fastapi/tests/agent/test_loop.py
git commit -m "feat(agent): loop LLM↔tools + system prompt assembly (pack stub + briefing), cắm vào /chat/stream"
```

---

### Task 9: MỐC LÁT CẮT — cắm DeepSeek thật + Mongo thật

**Files:**
- Modify: `finext-fastapi/.env.development` (owner tự điền key — KHÔNG commit)
- Modify: `.env.production` (root — owner tự điền key, đã gitignore)
- Create: `finext-fastapi/tests/agent/adapters/fixtures/deepseek_tool_stream.txt` (bytes THẬT bắt được)
- Modify: `finext-fastapi/tests/agent/adapters/test_openai_compat.py` (thêm test chạy trên bytes thật)

**Interfaces:**
- Consumes: toàn bộ Task 1-8.
- Produces: bằng chứng lát cắt chạy được (spec §3).

- [ ] **Step 1: Owner điền env**

Thêm vào `finext-fastapi/.env.development` (dev) và `.env.production` (deploy) — **owner tự dán key, không paste vào chat**:

```bash
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-...
AGENT_GATEWAY=mongo
GATEWAY_EXPLAIN_MODE=off
```

- [ ] **Step 2: Kiểm tra `agent_db` có thật + policy khớp DB**

```bash
cd finext-fastapi && uv run python -c "
import asyncio
from app.core.database import connect_to_mongo, get_database
async def main():
    await connect_to_mongo()
    db = get_database('agent_db')
    names = await db.list_collection_names()
    print('collections:', sorted(names)[:40])
    doc = await db.stock_snapshot.find_one({'ticker': 'FPT'}, {'_id': 0})
    print('FPT snapshot:', doc)
asyncio.run(main())
"
```

Expected: in ra danh sách collection (phải thấy `stock_snapshot`, `data_briefing`) + doc FPT có field giá.
⚠ Nếu tên field giá KHÁC `price` → sửa **pack stub** (`00_system_stub.md`, mục "Cách truy vấn") cho khớp DB thật. **KHÔNG sửa code Python.**

- [ ] **Step 3: Chạy server + hỏi thật**

```bash
cd finext-fastapi && uv run uvicorn app.main:app --port 8000
```

```bash
curl -N -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"message":"FPT giá bao nhiêu?"}'
```

Expected (mốc nghiệm thu spec §3):
1. `meta` → `tool_start` (label "Đang đọc dữ liệu cổ phiếu FPT…") → `tool_end` `ok=true` → `token`… → `done` có `usage`.
2. **Giá trong câu trả lời khớp doc `stock_snapshot` ở Step 2 và khớp UI Finext.**

Nếu model loay hoay nhiều vòng tool (`tool_end ok=false` liên tiếp) → sửa pack stub (thêm ví dụ query), KHÔNG sửa code (doc 02 §7 R1).

- [ ] **Step 4: Bắt bytes THẬT của DeepSeek làm fixture regression**

```bash
cd finext-fastapi && uv run python -c "
import asyncio, httpx, os
from app.core.config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from app.agent.tools.registry import TOOL_SCHEMAS
async def main():
    payload = {
        'model': LLM_MODEL, 'stream': True, 'stream_options': {'include_usage': True},
        'max_tokens': 200, 'tools': TOOL_SCHEMAS,
        'messages': [
            {'role': 'system', 'content': 'Dùng tool db_find để tra giá cổ phiếu.'},
            {'role': 'user', 'content': 'FPT giá bao nhiêu?'},
        ],
    }
    async with httpx.AsyncClient(timeout=60) as c:
        async with c.stream('POST', f'{LLM_BASE_URL}/chat/completions', json=payload,
                            headers={'Authorization': f'Bearer {LLM_API_KEY}'}) as r:
            with open('tests/agent/adapters/fixtures/deepseek_tool_stream.txt', 'w', encoding='utf-8') as f:
                async for line in r.aiter_lines():
                    if line:
                        f.write(line + '\n\n')
asyncio.run(main())
" && head -3 tests/agent/adapters/fixtures/deepseek_tool_stream.txt
```

Expected: file chứa các dòng `data: {...}` thật, có `tool_calls` với `arguments` chia mảnh.

- [ ] **Step 5: Thêm test regression trên bytes thật**

Nối vào `finext-fastapi/tests/agent/adapters/test_openai_compat.py`:

```python
from pathlib import Path

import pytest

REAL_FIXTURE = Path(__file__).parent / "fixtures" / "deepseek_tool_stream.txt"


@pytest.mark.skipif(not REAL_FIXTURE.exists(), reason="Chưa bắt được bytes thật của DeepSeek")
async def test_parses_real_deepseek_tool_call_stream():
    events = await _collect(_adapter_with(REAL_FIXTURE.read_text(encoding="utf-8")))
    tool_events = [e for e in events if isinstance(e, ToolCallsEvent)]
    assert len(tool_events) == 1
    call = tool_events[0].calls[0]
    assert call.name == "db_find"
    assert call.arguments.get("collection") == "stock_snapshot"  # ghép mảnh thành công trên byte THẬT
```

- [ ] **Step 6: Chạy full suite lần cuối**

Run: `cd finext-fastapi && uv run pytest -v`
Expected: tất cả PASS (bao gồm test bytes thật).

- [ ] **Step 7: Commit**

```bash
git add finext-fastapi/tests/agent/adapters
git commit -m "test(agent): fixture bytes THẬT của DeepSeek + regression parse tool-call"
```

> ⚠ Kiểm tra `git status` trước khi commit: **không được có** `.env.development` / `.env.production` trong danh sách staged.

---

### Task 10: Tool `get_my_watchlist` (tool user-scoped DUY NHẤT của v1)

**Files:**
- Create: `finext-fastapi/app/agent/tools/user.py`
- Modify: `finext-fastapi/app/agent/tools/registry.py` (đăng ký tool + truyền user_id)
- Modify: `finext-fastapi/app/agent/labels.py` (label cho tool này)
- Test: `finext-fastapi/tests/agent/test_tools_user.py`

**Interfaces:**
- Consumes: `GatewayProtocol`, `GatewayContext` (user_id lấy từ ctx — **không bao giờ** là tham số của model: chặn IDOR-qua-AI, doc 02 §4.1)
- Produces: `GET_WATCHLIST_SCHEMA` · `run_get_my_watchlist(user_db, gateway, ctx, args) -> GatewayResult`

- [ ] **Step 1: Viết failing test**

Tạo `finext-fastapi/tests/agent/test_tools_user.py`:

```python
from typing import Any

from app.agent.gateway.fixture import FixtureGateway
from app.agent.gateway.policy import Policy
from app.agent.gateway.types import GatewayContext
from app.agent.tools.user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

CTX = GatewayContext(request_id="r1", user_id="507f1f77bcf86cd799439011")


class FakeWatchlistDB:
    def __init__(self, tickers: list[str]) -> None:
        self._tickers = tickers
        self.queried_user_id: Any = None

    def __getitem__(self, name: str) -> "FakeWatchlistDB":
        return self

    async def find_one(self, filter: dict[str, Any], *args: Any, **kwargs: Any) -> dict[str, Any]:
        self.queried_user_id = filter.get("user_id")
        return {"tickers": self._tickers}


def test_schema_has_no_user_id_parameter():
    props = GET_WATCHLIST_SCHEMA["function"]["parameters"]["properties"]
    assert props == {}  # model KHÔNG được truyền user_id — chặn IDOR-qua-AI


async def test_returns_watchlist_joined_with_prices():
    user_db = FakeWatchlistDB(["FPT"])
    result = await run_get_my_watchlist(user_db, FixtureGateway(Policy.load()), CTX, {})
    assert result.ok is True
    assert result.data is not None
    assert result.data[0]["ticker"] == "FPT"
    assert result.data[0]["price"] == 118.5
    assert str(user_db.queried_user_id) == CTX.user_id  # user_id lấy từ ctx, không từ model


async def test_empty_watchlist_returns_empty_list():
    result = await run_get_my_watchlist(FakeWatchlistDB([]), FixtureGateway(Policy.load()), CTX, {})
    assert result.ok is True
    assert result.data == []
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `cd finext-fastapi && uv run pytest tests/agent/test_tools_user.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agent.tools.user'`

- [ ] **Step 3: Viết `tools/user.py`**

Tạo `finext-fastapi/app/agent/tools/user.py`:

```python
"""Tool user-scoped DUY NHẤT của v1. user_id LẤY TỪ ctx — không bao giờ là tham số model (doc 02 §4.1)."""

import logging
from typing import Any

from bson import ObjectId

from app.agent.gateway.types import GatewayContext, GatewayProtocol, GatewayResult

logger = logging.getLogger(__name__)

GET_WATCHLIST_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_my_watchlist",
        "description": "Lấy danh sách theo dõi của chính người dùng đang chat, kèm giá hiện tại.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}

MAX_WATCHLIST_TICKERS = 30


async def run_get_my_watchlist(
    user_db: Any, gateway: GatewayProtocol, ctx: GatewayContext, args: dict[str, Any]
) -> GatewayResult:
    doc = await user_db["watchlists"].find_one({"user_id": ObjectId(ctx.user_id)}, {"tickers": 1})
    tickers = (doc or {}).get("tickers", [])[:MAX_WATCHLIST_TICKERS]
    if not tickers:
        return GatewayResult(ok=True, data=[], meta={"collection": "watchlists", "n": 0})

    quotes = await gateway.find(
        ctx,
        collection="stock_snapshot",
        filter={"ticker": {"$in": tickers}},
        projection={"ticker": 1, "price": 1, "pct_change": 1},
        limit=MAX_WATCHLIST_TICKERS,
    )
    if not quotes.ok:
        return quotes
    return GatewayResult(ok=True, data=quotes.data, meta={"collection": "watchlists", "n": len(tickers)})
```

> ⚠ `FixtureGateway._matches` chỉ so khớp phẳng nên `{"$in": [...]}` không match — sửa `_matches` trong `fixture.py` để hỗ trợ `$in` (2 dòng), vì test Task 10 phụ thuộc:
> ```python
> def _matches(doc: dict[str, Any], filter: dict[str, Any]) -> bool:
>     for key, cond in filter.items():
>         if isinstance(cond, dict) and "$in" in cond:
>             if doc.get(key) not in cond["$in"]:
>                 return False
>         elif doc.get(key) != cond:
>             return False
>     return True
> ```

- [ ] **Step 4: Đăng ký tool vào registry**

Trong `finext-fastapi/app/agent/tools/registry.py`:

```diff
+from app.core.database import get_database
 from .db import DB_AGGREGATE_SCHEMA, DB_FIND_SCHEMA, run_db_aggregate, run_db_find
+from .user import GET_WATCHLIST_SCHEMA, run_get_my_watchlist

-TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA]
+TOOL_SCHEMAS: list[dict[str, Any]] = [DB_FIND_SCHEMA, DB_AGGREGATE_SCHEMA, GET_WATCHLIST_SCHEMA]
```

Sửa `execute_tool` — `get_my_watchlist` không có `collection` nên phải tách nhánh trước guard:

```diff
 async def execute_tool(
     gateway: GatewayProtocol, ctx: GatewayContext, call: ToolCall
 ) -> tuple[str, dict[str, Any]]:
     """Trả (content cho model, meta cho event tool_end)."""
+    if call.name == "get_my_watchlist":
+        try:
+            result = await run_get_my_watchlist(get_database("user_db"), gateway, ctx, call.arguments)
+        except Exception:
+            logger.exception("Tool get_my_watchlist lỗi")
+            return "Không đọc được danh sách theo dõi.", {"ok": False, "ms": 0}
+        content = json.dumps(result.data, ensure_ascii=False, default=str)
+        return content, {"ok": result.ok, "ms": result.meta.get("ms", 0)}
+
     handler = _HANDLERS.get(call.name)
```

- [ ] **Step 5: Thêm label**

Trong `finext-fastapi/app/agent/labels.py`:

```diff
 def label_for(call: ToolCall) -> str:
+    if call.name == "get_my_watchlist":
+        return "Đang đọc danh sách theo dõi của bạn…"
     collection = call.arguments.get("collection")
```

- [ ] **Step 6: Chạy full suite**

Run: `cd finext-fastapi && uv run pytest -v`
Expected: tất cả PASS.

- [ ] **Step 7: Commit**

```bash
git add finext-fastapi/app/agent finext-fastapi/tests/agent
git commit -m "feat(agent): tool get_my_watchlist (user_id từ JWT ctx — chặn IDOR-qua-AI)"
```

---

## Nghiệm thu toàn plan (spec §3 + doc 01 §8 + doc 02 §8)

- [ ] `cd finext-fastapi && uv run pytest -v` — toàn bộ PASS, 0 skip ngoài fixture-thật.
- [ ] `curl -N` với DeepSeek thật: `meta` → `tool_start`/`tool_end` → `token`… → `done{usage}`; heartbeat `: hb` khi im lặng >10s.
- [ ] "FPT giá bao nhiêu?" → số **khớp `stock_snapshot` trong Mongo và khớp UI Finext**.
- [ ] `find({})` trên `history_stock` bị từ chối, error message có gợi ý thêm `ticker` (test validator đã phủ).
- [ ] Bấm Ctrl-C giữa stream → log "chat stream kết thúc", task bị cancel (không còn gọi LLM).
- [ ] `AGENT_GATEWAY=fixture` chạy được toàn bộ luồng không cần Mongo.
- [ ] `git status` sạch: không có `.env*` bị staged.

**Việc CHƯA làm (đúng phạm vi, session sau):** persistence `chat_conversations`/`chat_messages` + quota (doc 03/08) · policy đủ 33 collection (doc 01 §8) · FE `/assistant` + widget render (doc 04, spec §D4) · pack THẬT thay pack stub (spec §D7) · nginx block cho SSE production (doc 05).
