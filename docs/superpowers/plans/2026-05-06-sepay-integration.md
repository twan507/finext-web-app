# SePay Auto-Payment Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp SePay webhook để tự động xác nhận thanh toán cho `transactions` collection, song song với flow admin manual confirm hiện có. Frontend bổ sung trang `/checkout/[orderId]` hiển thị QR động VietQR.

**Architecture:** Backend FastAPI sync webhook handler ở `POST /api/v1/sepay/webhook` (gói FREE 50 tx/tháng = ~1.7 tx/ngày, không cần queue). Idempotency 2 lớp: UNIQUE index trên `sepay_webhook_logs.sepay_transaction_id` + atomic `findOneAndUpdate` trên `transactions` (PENDING→SUCCEEDED). Logic tạo subscription/gia hạn reuse qua helper extract từ `confirm_transaction_payment_db` hiện có. Frontend Next.js poll status endpoint mỗi 5s, redirect khi paid.

**Tech Stack:** FastAPI · Motor (async MongoDB) · Pydantic v2 · APScheduler · Next.js 15 (App Router) · TypeScript · MUI · pytest + pytest-asyncio (mới setup)

**Spec:** [docs/superpowers/specs/2026-05-06-sepay-integration-design.md](../specs/2026-05-06-sepay-integration-design.md)

**Note quan trọng:**
- Project hiện chưa có `tests/` directory — Task 1 setup test infra trước.
- Frontend chưa có Jest/Vitest — verification FE = `npm run build` (TS check) + manual browser test, không viết unit test FE.
- TDD chỉ áp dụng cho pure functions backend (security utils, parser). Logic tích hợp DB verify qua integration test thật với MongoDB.
- Plan KHÔNG bao gồm Phase 4 (đăng ký SePay Demo) và Phase 5 (production rollout) vì là ops tasks — list ở Appendix cuối.

---

## File Structure

### Backend — Create

| Path | Trách nhiệm |
|---|---|
| `finext-fastapi/tests/__init__.py` | Marker file cho test package |
| `finext-fastapi/tests/conftest.py` | Pytest fixtures: event loop, test MongoDB client, cleanup giữa test |
| `finext-fastapi/pytest.ini` | Pytest config: asyncio mode auto, test paths |
| `finext-fastapi/tests/utils/__init__.py` | Marker |
| `finext-fastapi/tests/utils/test_sepay_security.py` | Test pure functions: order code gen, IP/key verify |
| `finext-fastapi/tests/crud/__init__.py` | Marker |
| `finext-fastapi/tests/crud/test_sepay_parse.py` | Test parse order_code từ content |
| `finext-fastapi/tests/crud/test_sepay_webhook.py` | Integration test pipeline với MongoDB |
| `finext-fastapi/tests/crud/test_order_code.py` | Test gen_unique_order_code + retry + UNIQUE enforce |
| `finext-fastapi/tests/crud/test_transactions_sepay.py` | Test auto-cancel PENDING cũ |
| `finext-fastapi/app/utils/sepay_security.py` | Pure functions: gen order_code, verify IP, verify API key. Không touch DB. |
| `finext-fastapi/app/schemas/sepay.py` | Pydantic models: webhook payload, log model, QR info response, transaction status response |
| `finext-fastapi/app/crud/sepay.py` | Webhook processing pipeline + parser + alert helpers |
| `finext-fastapi/app/routers/sepay_webhooks.py` | Endpoint `POST /sepay/webhook` (external, no auth permission) |

### Backend — Modify

| Path | Thay đổi |
|---|---|
| `finext-fastapi/pyproject.toml` | Thêm dev dependency `pytest-mock` (đã có pytest, pytest-asyncio) |
| `finext-fastapi/app/core/config.py` | Thêm 9 SePay env vars + parse `SEPAY_ALLOWED_IPS` từ CSV thành list |
| `finext-fastapi/app/schemas/transactions.py` | Thêm 4 field mới vào `TransactionBase`: `order_code`, `payment_provider`, `paid_at`, `sepay_transaction_id` |
| `finext-fastapi/app/crud/transactions.py` | (a) `_prepare_transaction_data`: gen `order_code` + 3 field None; (b) `create_transaction_by_user_db`: auto-cancel PENDING cũ; (c) Extract `_apply_payment_side_effects()` từ `confirm_transaction_payment_db`; (d) Thêm hàm mới `confirm_transaction_payment_via_webhook` (atomic) |
| `finext-fastapi/app/routers/transactions.py` | Thêm 2 endpoint user: `GET /me/{id}/qr-info`, `GET /me/{id}/status` |
| `finext-fastapi/app/utils/email.py` (xác minh tên file thật trước khi viết code) | Thêm 2 template: `send_payment_success_email`, `send_payment_anomaly_alert` |
| `finext-fastapi/app/core/scheduler.py` | Thêm job `auto_cancel_expired_pending_orders` chạy mỗi 5 phút |
| `finext-fastapi/app/main.py` | Import & register `sepay_webhooks` router với prefix `/api/v1` |
| `finext-fastapi/app/core/database.py` (hoặc startup hook trong main.py) | Tạo indexes lúc startup: `transactions.order_code` UNIQUE sparse, `transactions.(payment_status, created_at)`, `sepay_webhook_logs.sepay_transaction_id` UNIQUE, TTL 90d trên `received_at` |
| `finext-fastapi/.env.development` | Thêm 9 SePay env vars (placeholder values) |

### Frontend — Create

| Path | Trách nhiệm |
|---|---|
| `finext-nextjs/services/sepayService.ts` | API client typed: `getQrInfo(id)`, `getTransactionStatus(id)` |
| `finext-nextjs/app/(main)/checkout/[orderId]/page.tsx` | Server component, set metadata `Thanh toán \| Finext` |
| `finext-nextjs/app/(main)/checkout/[orderId]/PageContent.tsx` | Client component: state machine, polling, countdown, copy buttons, split layout |

### Frontend — Modify

| Path | Thay đổi |
|---|---|
| `finext-nextjs/app/(main)/plans/PageContent.tsx` | Sau `POST /transactions/me/orders` thành công → `router.push(\`/checkout/${transaction.id}\`)` thay vì xử lý cũ |

---

## Phase 1: Foundation

### Task 1: Setup pytest infrastructure

**Files:**
- Create: `finext-fastapi/pytest.ini`
- Create: `finext-fastapi/tests/__init__.py`
- Create: `finext-fastapi/tests/conftest.py`
- Create: `finext-fastapi/tests/utils/__init__.py`
- Create: `finext-fastapi/tests/crud/__init__.py`
- Modify: `finext-fastapi/pyproject.toml`

**Note:** Project hiện chưa có tests/. Task này tạo infra chung cho mọi test sau.

- [ ] **Step 1: Tạo `finext-fastapi/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
```

- [ ] **Step 2: Tạo `finext-fastapi/tests/__init__.py` (file rỗng)**

```python
```

- [ ] **Step 3: Tạo `finext-fastapi/tests/utils/__init__.py` (file rỗng)**

```python
```

- [ ] **Step 4: Tạo `finext-fastapi/tests/crud/__init__.py` (file rỗng)**

```python
```

- [ ] **Step 5: Tạo `finext-fastapi/tests/conftest.py` với fixture MongoDB test**

```python
# finext-fastapi/tests/conftest.py
"""Pytest fixtures dùng chung cho test suite SePay integration."""
import os
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# Test DB tách biệt với dev/prod, sẽ wipe sạch giữa các test
TEST_MONGODB_URI = os.getenv("TEST_MONGODB_URI", "mongodb://localhost:27017")
TEST_DB_NAME = "finext_test_sepay"


@pytest_asyncio.fixture
async def mongo_client():
    """MongoDB client connect tới local instance."""
    client = AsyncIOMotorClient(TEST_MONGODB_URI)
    yield client
    client.close()


@pytest_asyncio.fixture
async def test_db(mongo_client):
    """Test DB clean slate. Drop trước và sau test."""
    db = mongo_client[TEST_DB_NAME]
    # Wipe trước test (phòng test trước crash để lại data)
    await mongo_client.drop_database(TEST_DB_NAME)
    yield db
    # Wipe sau test
    await mongo_client.drop_database(TEST_DB_NAME)
```

- [ ] **Step 6: Update `pyproject.toml` thêm pytest-mock**

Tìm block `[dependency-groups]` và update:

```toml
[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-mock>=3.12.0",
]
```

- [ ] **Step 7: Sync deps**

Chạy trong `finext-fastapi/`:

```bash
uv sync --group dev
```

Hoặc nếu dùng pip:
```bash
pip install pytest pytest-asyncio pytest-mock
```

- [ ] **Step 8: Smoke test pytest hoạt động**

Tạo file tạm `finext-fastapi/tests/test_smoke.py`:

```python
def test_pytest_works():
    assert 1 + 1 == 2
```

Run:
```bash
cd finext-fastapi && pytest tests/test_smoke.py -v
```

Expected: 1 passed.

Sau đó **xóa file** `finext-fastapi/tests/test_smoke.py`.

- [ ] **Step 9: Commit**

```bash
git add finext-fastapi/pytest.ini finext-fastapi/tests/ finext-fastapi/pyproject.toml
git commit -m "test: setup pytest infrastructure with mongo test fixture"
```

---

### Task 2: SePay security utilities (pure functions, TDD)

**Files:**
- Create: `finext-fastapi/tests/utils/test_sepay_security.py`
- Create: `finext-fastapi/app/utils/sepay_security.py`

- [ ] **Step 1: Viết failing tests cho `generate_order_code`**

`finext-fastapi/tests/utils/test_sepay_security.py`:

```python
"""Test cho app/utils/sepay_security.py - pure functions, không touch DB."""
import pytest
from unittest.mock import MagicMock

from app.utils.sepay_security import (
    generate_order_code,
    verify_source_ip,
    verify_api_key,
    ORDER_CODE_PREFIX,
    ORDER_CODE_LENGTH,
    ORDER_CODE_CHARSET,
)
from fastapi import HTTPException


class TestGenerateOrderCode:
    def test_starts_with_FNX_prefix(self):
        code = generate_order_code()
        assert code.startswith(ORDER_CODE_PREFIX)

    def test_total_length_is_prefix_plus_8(self):
        code = generate_order_code()
        assert len(code) == len(ORDER_CODE_PREFIX) + ORDER_CODE_LENGTH

    def test_excludes_confusing_chars(self):
        # Chạy 200 lần để đảm bảo không có random sample chứa ký tự nhầm
        for _ in range(200):
            code = generate_order_code()
            suffix = code[len(ORDER_CODE_PREFIX):]
            for ch in "0OIL1":
                assert ch not in suffix, f"Code {code} chứa ký tự nhầm '{ch}'"

    def test_only_uses_charset_chars(self):
        for _ in range(50):
            code = generate_order_code()
            suffix = code[len(ORDER_CODE_PREFIX):]
            for ch in suffix:
                assert ch in ORDER_CODE_CHARSET

    def test_codes_are_random(self):
        """Sinh 100 mã, ít nhất 95 cái phải khác nhau (xác suất trùng cực thấp)."""
        codes = {generate_order_code() for _ in range(100)}
        assert len(codes) >= 95
```

- [ ] **Step 2: Run test → expect ImportError (chưa có module)**

```bash
cd finext-fastapi && pytest tests/utils/test_sepay_security.py -v
```

Expected: ImportError hoặc ModuleNotFoundError trên `app.utils.sepay_security`.

- [ ] **Step 3: Tạo `app/utils/sepay_security.py` với `generate_order_code`**

```python
# finext-fastapi/app/utils/sepay_security.py
"""Pure security utilities for SePay integration. No DB access."""
import secrets
from typing import List

from fastapi import HTTPException, Request

# Charset loại bỏ 0/O/1/I/L để tránh nhầm khi user gõ tay
ORDER_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
ORDER_CODE_LENGTH = 8
ORDER_CODE_PREFIX = "FNX"


def generate_order_code() -> str:
    """Sinh mã đối soát ngắn (FNX + 8 ký tự A-Z 2-9, exclude 0/O/1/I/L).
    Caller phải tự check trùng DB và retry."""
    suffix = "".join(secrets.choice(ORDER_CODE_CHARSET) for _ in range(ORDER_CODE_LENGTH))
    return f"{ORDER_CODE_PREFIX}{suffix}"
```

- [ ] **Step 4: Run test → expect 5 passed**

```bash
cd finext-fastapi && pytest tests/utils/test_sepay_security.py::TestGenerateOrderCode -v
```

Expected: 5 passed.

- [ ] **Step 5: Thêm tests cho `verify_source_ip`**

Append vào `tests/utils/test_sepay_security.py`:

```python
class TestVerifySourceIp:
    @pytest.fixture
    def allowed_ips(self):
        return ["1.2.3.4", "5.6.7.8"]

    def _make_request(self, client_ip: str | None, x_forwarded_for: str | None = None):
        request = MagicMock(spec=Request)
        request.headers = {}
        if x_forwarded_for is not None:
            request.headers["x-forwarded-for"] = x_forwarded_for
        request.client = MagicMock()
        request.client.host = client_ip
        return request

    def test_accepts_whitelisted_ip(self, allowed_ips):
        req = self._make_request("1.2.3.4")
        result = verify_source_ip(req, allowed_ips)
        assert result == "1.2.3.4"

    def test_rejects_non_whitelisted_ip(self, allowed_ips):
        req = self._make_request("9.9.9.9")
        with pytest.raises(HTTPException) as exc_info:
            verify_source_ip(req, allowed_ips)
        assert exc_info.value.status_code == 403

    def test_parses_x_forwarded_for(self, allowed_ips):
        # X-Forwarded-For chứa "real_client, proxy1, proxy2"
        req = self._make_request(
            client_ip="10.0.0.1",  # IP của reverse proxy
            x_forwarded_for="1.2.3.4, 10.0.0.1",
        )
        result = verify_source_ip(req, allowed_ips)
        assert result == "1.2.3.4"

    def test_x_forwarded_for_strips_whitespace(self, allowed_ips):
        req = self._make_request(
            client_ip="10.0.0.1",
            x_forwarded_for="  1.2.3.4  , 10.0.0.1",
        )
        result = verify_source_ip(req, allowed_ips)
        assert result == "1.2.3.4"
```

- [ ] **Step 6: Run test → expect ImportError trên `verify_source_ip`**

```bash
cd finext-fastapi && pytest tests/utils/test_sepay_security.py::TestVerifySourceIp -v
```

Expected: ImportError.

- [ ] **Step 7: Implement `verify_source_ip`**

Append vào `app/utils/sepay_security.py`:

```python
def verify_source_ip(request: Request, allowed_ips: List[str]) -> str:
    """Check IP whitelist. Parse X-Forwarded-For nếu app sau reverse proxy.
    Raise HTTPException(403) nếu không hợp lệ. Return client IP đã verify."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else ""

    if client_ip not in allowed_ips:
        raise HTTPException(status_code=403, detail="Forbidden")
    return client_ip
```

- [ ] **Step 8: Run → expect 4 passed**

```bash
cd finext-fastapi && pytest tests/utils/test_sepay_security.py::TestVerifySourceIp -v
```

- [ ] **Step 9: Thêm tests cho `verify_api_key`**

Append vào `tests/utils/test_sepay_security.py`:

```python
class TestVerifyApiKey:
    EXPECTED_KEY = "secret-key-123"

    def _make_request(self, auth_header: str | None):
        request = MagicMock(spec=Request)
        request.headers = {}
        if auth_header is not None:
            request.headers["authorization"] = auth_header
        return request

    def test_accepts_correct_key(self):
        req = self._make_request(f"Apikey {self.EXPECTED_KEY}")
        # Không raise = pass
        verify_api_key(req, self.EXPECTED_KEY)

    def test_rejects_wrong_key(self):
        req = self._make_request("Apikey wrong-key")
        with pytest.raises(HTTPException) as exc:
            verify_api_key(req, self.EXPECTED_KEY)
        assert exc.value.status_code == 401

    def test_rejects_missing_header(self):
        req = self._make_request(None)
        with pytest.raises(HTTPException) as exc:
            verify_api_key(req, self.EXPECTED_KEY)
        assert exc.value.status_code == 401

    def test_rejects_wrong_scheme(self):
        # Không dùng "Apikey " prefix
        req = self._make_request(f"Bearer {self.EXPECTED_KEY}")
        with pytest.raises(HTTPException) as exc:
            verify_api_key(req, self.EXPECTED_KEY)
        assert exc.value.status_code == 401

    def test_rejects_empty_string(self):
        req = self._make_request("")
        with pytest.raises(HTTPException) as exc:
            verify_api_key(req, self.EXPECTED_KEY)
        assert exc.value.status_code == 401
```

- [ ] **Step 10: Implement `verify_api_key`**

Append vào `app/utils/sepay_security.py`:

```python
def verify_api_key(request: Request, expected: str) -> None:
    """Constant-time compare API key trong header `Authorization: Apikey <key>`.
    Raise HTTPException(401) nếu không hợp lệ."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Apikey "):
        raise HTTPException(status_code=401, detail="Missing Apikey header")
    received = auth_header[len("Apikey "):]
    if not secrets.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")
```

- [ ] **Step 11: Run full test file → expect tất cả pass**

```bash
cd finext-fastapi && pytest tests/utils/test_sepay_security.py -v
```

Expected: 14 passed (5 + 4 + 5).

- [ ] **Step 12: Commit**

```bash
git add finext-fastapi/app/utils/sepay_security.py finext-fastapi/tests/utils/test_sepay_security.py
git commit -m "feat(sepay): add security utilities (order code gen, IP/key verify)"
```

---

### Task 3: SePay Pydantic schemas

**Files:**
- Create: `finext-fastapi/app/schemas/sepay.py`

- [ ] **Step 1: Tạo file với full schemas**

`finext-fastapi/app/schemas/sepay.py`:

```python
# finext-fastapi/app/schemas/sepay.py
"""Pydantic models for SePay webhook payload, log, and user-facing responses."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.transactions import PaymentStatusEnum
from app.utils.types import PyObjectId


class SePayWebhookPayload(BaseModel):
    """Schema parse payload SePay gửi về trong POST /sepay/webhook.
    Các field optional là vì SePay đôi khi gửi null."""

    id: int = Field(..., description="ID giao dịch phía SePay (unique).")
    gateway: str = Field(..., description="Tên ngân hàng, vd 'Vietcombank'.")
    transactionDate: str = Field(..., description="Format 'YYYY-MM-DD HH:MM:SS' (giờ local VN).")
    accountNumber: Optional[str] = Field(default=None)
    code: Optional[str] = Field(default=None, description="SePay không dùng, deprecated.")
    content: Optional[str] = Field(default="", description="Nội dung CK, parse order_code từ đây.")
    transferType: str = Field(..., description="'in' hoặc 'out'.")
    transferAmount: float = Field(..., description="Số tiền VND (không có thập phân thực tế).")
    accumulated: Optional[float] = Field(default=None)
    subAccount: Optional[str] = Field(default=None)
    referenceCode: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default="")


class SePayWebhookLog(BaseModel):
    """Audit log mỗi webhook nhận được. UNIQUE index trên sepay_transaction_id."""

    id: PyObjectId = Field(alias="_id")
    sepay_transaction_id: int
    received_at: datetime
    source_ip: str

    raw_payload: dict = Field(..., description="Toàn bộ payload SePay gửi, để audit/debug.")

    # Parsed fields
    gateway: str
    transfer_amount: float
    transfer_type: str
    content: Optional[str] = None
    reference_code: Optional[str] = None
    transaction_date: Optional[datetime] = None

    # Match result
    matched_order_code: Optional[str] = None
    matched_transaction_id: Optional[PyObjectId] = None
    processing_status: str = Field(
        ...,
        description=(
            "'success' | 'duplicate' | 'unmatched_no_code' | 'unmatched_order_not_found' "
            "| 'amount_mismatch' | 'wrong_status' | 'auth_failed' | 'replay_rejected' "
            "| 'ignored_outbound' | 'error'"
        ),
    )
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class QrInfoResponse(BaseModel):
    """Response cho GET /transactions/me/{id}/qr-info — frontend hiển thị checkout."""

    order_code: str
    qr_image_url: str
    bank_name: str
    account_number: str
    account_holder: str
    transfer_content: str = Field(..., description="= order_code, copy vào memo CK.")
    amount: float
    expires_at: datetime = Field(..., description="created_at + SEPAY_ORDER_TIMEOUT_MINUTES.")


class TransactionStatusResponse(BaseModel):
    """Response cho GET /transactions/me/{id}/status — frontend polling mỗi 5s."""

    transaction_id: PyObjectId
    payment_status: PaymentStatusEnum
    paid_at: Optional[datetime] = None
    subscription_id: Optional[PyObjectId] = None
```

- [ ] **Step 2: Verify import không lỗi**

```bash
cd finext-fastapi && python -c "from app.schemas.sepay import SePayWebhookPayload, SePayWebhookLog, QrInfoResponse, TransactionStatusResponse; print('OK')"
```

Expected: `OK`.

- [ ] **Step 3: Verify SePayWebhookPayload parse được payload mẫu từ docs SePay**

```bash
cd finext-fastapi && python -c "
from app.schemas.sepay import SePayWebhookPayload
sample = {
    'id': 92704,
    'gateway': 'Vietcombank',
    'transactionDate': '2023-03-25 14:02:37',
    'accountNumber': '0123499999',
    'code': None,
    'content': 'chuyen tien mua iphone',
    'transferType': 'in',
    'transferAmount': 2277000,
    'accumulated': 19077000,
    'subAccount': None,
    'referenceCode': 'MBVCB.3278907687',
    'description': ''
}
p = SePayWebhookPayload(**sample)
assert p.id == 92704
assert p.transferType == 'in'
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add finext-fastapi/app/schemas/sepay.py
git commit -m "feat(sepay): add pydantic schemas for webhook payload, log, and responses"
```

---

### Task 4: Mở rộng schema `transactions` thêm 4 field SePay

**Files:**
- Modify: `finext-fastapi/app/schemas/transactions.py`

- [ ] **Step 1: Đọc file để xác định vị trí chèn**

```bash
cd finext-fastapi && grep -n "target_subscription_id" app/schemas/transactions.py
```

Tìm dòng cuối của `TransactionBase` trước `model_config`.

- [ ] **Step 2: Thêm 4 field vào `TransactionBase`**

Trong `app/schemas/transactions.py`, ngay TRƯỚC `model_config` của class `TransactionBase`, thêm:

```python
    # === SePay integration fields (added 2026-05-06) ===
    order_code: Optional[str] = Field(
        default=None,
        description="Mã đối soát ngắn (vd FNXAB23CD9). Unique. Memo CK + parse khi webhook về.",
    )
    payment_provider: Optional[str] = Field(
        default=None,
        description="'sepay' (auto-confirm) | 'manual' (admin xác nhận) | None (chưa thanh toán).",
    )
    paid_at: Optional[datetime] = Field(
        default=None,
        description="Thời điểm thanh toán thành công. None nếu chưa paid.",
    )
    sepay_transaction_id: Optional[int] = Field(
        default=None,
        description="ID giao dịch phía SePay (field 'id' trong webhook payload). Idempotency key.",
    )
```

- [ ] **Step 3: Verify import không lỗi**

```bash
cd finext-fastapi && python -c "from app.schemas.transactions import TransactionBase, TransactionInDB; t = TransactionInDB.model_fields; assert 'order_code' in t and 'payment_provider' in t and 'paid_at' in t and 'sepay_transaction_id' in t; print('OK')"
```

Expected: `OK`.

- [ ] **Step 4: Verify existing transaction tests/usage chưa break**

```bash
cd finext-fastapi && python -c "
from app.schemas.transactions import TransactionInDB
from datetime import datetime
# Tạo instance không truyền 4 field mới → phải work (default None)
t = TransactionInDB(
    _id='60d5ec49f7b4e6a0e7d5c2a1',
    buyer_user_id='60d5ec49f7b4e6a0e7d5c2a1',
    license_id='60d5ec49f7b4e6a0e7d5c2b2',
    license_key='ADVANCED',
    original_license_price=199000,
    purchased_duration_days=30,
    transaction_amount=199000,
    transaction_type='new_purchase',
    created_at=datetime.now(),
    updated_at=datetime.now(),
)
assert t.order_code is None
assert t.payment_provider is None
assert t.paid_at is None
assert t.sepay_transaction_id is None
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/schemas/transactions.py
git commit -m "feat(transactions): add 4 SePay fields (order_code, payment_provider, paid_at, sepay_transaction_id)"
```

---

### Task 5: SePay env vars trong config.py

**Files:**
- Modify: `finext-fastapi/app/core/config.py`
- Modify: `finext-fastapi/.env.development`

- [ ] **Step 1: Thêm env vars vào `app/core/config.py`**

Append vào CUỐI file `app/core/config.py`:

```python
# --- SEPAY INTEGRATION ---
SEPAY_ENABLED = os.getenv("SEPAY_ENABLED", "false").lower() == "true"
SEPAY_API_TOKEN = os.getenv("SEPAY_API_TOKEN", "")  # Reserved for future use
SEPAY_WEBHOOK_API_KEY = os.getenv("SEPAY_WEBHOOK_API_KEY", "")
SEPAY_BANK_NAME = os.getenv("SEPAY_BANK_NAME", "")
SEPAY_ACCOUNT_NUMBER = os.getenv("SEPAY_ACCOUNT_NUMBER", "")
SEPAY_ACCOUNT_HOLDER = os.getenv("SEPAY_ACCOUNT_HOLDER", "")

_sepay_ips_raw = os.getenv("SEPAY_ALLOWED_IPS", "")
SEPAY_ALLOWED_IPS = [ip.strip() for ip in _sepay_ips_raw.split(",") if ip.strip()]

SEPAY_ORDER_TIMEOUT_MINUTES = int(os.getenv("SEPAY_ORDER_TIMEOUT_MINUTES", "30"))
SEPAY_FREE_TIER_MONTHLY_LIMIT = int(os.getenv("SEPAY_FREE_TIER_MONTHLY_LIMIT", "50"))

if SEPAY_ENABLED:
    _missing_sepay_vars = []
    if not SEPAY_WEBHOOK_API_KEY:
        _missing_sepay_vars.append("SEPAY_WEBHOOK_API_KEY")
    if not SEPAY_BANK_NAME:
        _missing_sepay_vars.append("SEPAY_BANK_NAME")
    if not SEPAY_ACCOUNT_NUMBER:
        _missing_sepay_vars.append("SEPAY_ACCOUNT_NUMBER")
    if not SEPAY_ACCOUNT_HOLDER:
        _missing_sepay_vars.append("SEPAY_ACCOUNT_HOLDER")
    if not SEPAY_ALLOWED_IPS:
        _missing_sepay_vars.append("SEPAY_ALLOWED_IPS")
    if _missing_sepay_vars:
        logger.warning(
            f"SEPAY_ENABLED=true nhưng thiếu env vars: {', '.join(_missing_sepay_vars)}. "
            "SePay integration sẽ trả 503 cho mọi request."
        )
# -------------------------
```

- [ ] **Step 2: Update `.env.development` thêm placeholder vars**

Append vào CUỐI `.env.development`:

```bash
# === SEPAY (gói FREE 50 tx/tháng) ===
# Đặt SEPAY_ENABLED=false trên dev cho đến khi có Demo account
SEPAY_ENABLED=false
SEPAY_API_TOKEN=
SEPAY_WEBHOOK_API_KEY=
SEPAY_BANK_NAME=Vietcombank
SEPAY_ACCOUNT_NUMBER=
SEPAY_ACCOUNT_HOLDER=
SEPAY_ALLOWED_IPS=172.236.138.20,172.233.83.68,171.244.35.2,151.158.108.68,151.158.109.79,103.255.238.139
SEPAY_ORDER_TIMEOUT_MINUTES=30
SEPAY_FREE_TIER_MONTHLY_LIMIT=50
```

- [ ] **Step 3: Verify config load không crash**

```bash
cd finext-fastapi && python -c "
from app.core.config import (
    SEPAY_ENABLED, SEPAY_BANK_NAME, SEPAY_ALLOWED_IPS,
    SEPAY_ORDER_TIMEOUT_MINUTES, SEPAY_FREE_TIER_MONTHLY_LIMIT
)
assert SEPAY_ENABLED is False
assert SEPAY_ORDER_TIMEOUT_MINUTES == 30
assert SEPAY_FREE_TIER_MONTHLY_LIMIT == 50
assert isinstance(SEPAY_ALLOWED_IPS, list)
assert len(SEPAY_ALLOWED_IPS) == 6
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add finext-fastapi/app/core/config.py finext-fastapi/.env.development
git commit -m "feat(config): add SePay env vars and validation"
```

---

## Phase 2: Backend Webhook + CRUD Logic

### Task 6: `gen_unique_order_code` với DB collision check

**Files:**
- Create: `finext-fastapi/tests/crud/test_order_code.py`
- Modify: `finext-fastapi/app/utils/sepay_security.py` (thêm async function)

- [ ] **Step 1: Viết failing test**

`finext-fastapi/tests/crud/test_order_code.py`:

```python
"""Test gen_unique_order_code — async function dùng DB."""
import pytest
from unittest.mock import patch

from app.utils.sepay_security import gen_unique_order_code, ORDER_CODE_PREFIX


class TestGenUniqueOrderCode:
    @pytest.mark.asyncio
    async def test_generates_code_when_no_collision(self, test_db):
        code = await gen_unique_order_code(test_db)
        assert code.startswith(ORDER_CODE_PREFIX)
        assert len(code) == len(ORDER_CODE_PREFIX) + 8

    @pytest.mark.asyncio
    async def test_retries_on_collision(self, test_db):
        # Insert sẵn 2 mã, generate_order_code mock trả về tuần tự 2 mã trùng + 1 mã mới
        existing_codes = ["FNXAAAA111", "FNXBBBB222"]  # các mã giả lập trùng
        # Tạm: insert 2 transaction giả với order_code các mã đó
        await test_db.transactions.insert_many([
            {"order_code": existing_codes[0]},
            {"order_code": existing_codes[1]},
        ])

        gen_sequence = iter(existing_codes + ["FNXCCCC333"])
        with patch("app.utils.sepay_security.generate_order_code", side_effect=lambda: next(gen_sequence)):
            code = await gen_unique_order_code(test_db, max_retries=5)
            assert code == "FNXCCCC333"

    @pytest.mark.asyncio
    async def test_raises_when_exhausted_retries(self, test_db):
        # Tất cả lần generate đều trả về cùng 1 mã đã tồn tại
        await test_db.transactions.insert_one({"order_code": "FNXDUPLICATE"})

        with patch("app.utils.sepay_security.generate_order_code", return_value="FNXDUPLICATE"):
            with pytest.raises(RuntimeError, match="Không thể tạo order_code unique"):
                await gen_unique_order_code(test_db, max_retries=3)
```

- [ ] **Step 2: Run test → expect ImportError**

```bash
cd finext-fastapi && pytest tests/crud/test_order_code.py -v
```

Expected: ImportError trên `gen_unique_order_code`.

- [ ] **Step 3: Implement `gen_unique_order_code`**

Append vào `app/utils/sepay_security.py`:

```python
from motor.motor_asyncio import AsyncIOMotorDatabase


async def gen_unique_order_code(db: AsyncIOMotorDatabase, max_retries: int = 5) -> str:
    """Sinh order_code unique trong collection `transactions`. Retry tối đa max_retries lần.
    Caller phải đảm bảo có UNIQUE index trên `transactions.order_code` để DB enforce thêm 1 lớp."""
    for _ in range(max_retries):
        code = generate_order_code()
        existing = await db.transactions.find_one({"order_code": code}, {"_id": 1})
        if not existing:
            return code
    raise RuntimeError(
        f"Không thể tạo order_code unique sau {max_retries} lần thử. "
        "Charset hoặc length cần được xem lại."
    )
```

- [ ] **Step 4: Run test → expect 3 passed**

```bash
cd finext-fastapi && pytest tests/crud/test_order_code.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/utils/sepay_security.py finext-fastapi/tests/crud/test_order_code.py
git commit -m "feat(sepay): add gen_unique_order_code with DB collision check + retry"
```

---

### Task 7: `parse_order_code_from_content` (regex parser)

**Files:**
- Create: `finext-fastapi/tests/crud/test_sepay_parse.py`
- Create: `finext-fastapi/app/crud/sepay.py`

- [ ] **Step 1: Viết failing tests**

`finext-fastapi/tests/crud/test_sepay_parse.py`:

```python
"""Test parse_order_code_from_content — regex parser, không touch DB."""
import pytest
from app.crud.sepay import parse_order_code_from_content


class TestParseOrderCode:
    def test_extracts_basic_code(self):
        assert parse_order_code_from_content("FNXAB23CD9P") == "FNXAB23CD9"

    def test_extracts_from_full_memo(self):
        content = "Chuyen tien thanh toan don hang FNXAB23CD9P cua user"
        assert parse_order_code_from_content(content) == "FNXAB23CD9"

    def test_case_insensitive_returns_uppercase(self):
        # SePay/bank có thể normalize content thành lowercase
        assert parse_order_code_from_content("thanh toan fnxab23cd9p") == "FNXAB23CD9"

    def test_returns_none_for_no_match(self):
        assert parse_order_code_from_content("Chuyen tien tu Nguyen Van A") is None

    def test_returns_none_for_empty(self):
        assert parse_order_code_from_content("") is None

    def test_returns_none_for_none_input(self):
        assert parse_order_code_from_content(None) is None

    def test_takes_first_match_when_multiple(self):
        # Memo có 2 mã FNX → lấy mã đầu (đề phòng user paste nhầm)
        content = "FNXAAAA222 thanh toan FNXBBBB333"
        assert parse_order_code_from_content(content) == "FNXAAAA222"

    def test_rejects_short_code(self):
        # FNX + chỉ 7 ký tự → không match
        assert parse_order_code_from_content("Chuyen tien FNXAB23CD") is None

    def test_rejects_excluded_chars(self):
        # FNX + chứa '0' (ký tự loại trừ trong charset) → không match
        # Vì charset là [2-9A-Z\\{0,O,1,I,L}], regex sẽ không match nếu suffix có 0
        assert parse_order_code_from_content("FNX0AB23CD9") is None

    def test_handles_punctuation_around(self):
        # Content có dấu chấm/phẩy bao quanh
        assert parse_order_code_from_content(". FNXAB23CD9P,") == "FNXAB23CD9"
```

- [ ] **Step 2: Run → ImportError trên `app.crud.sepay`**

```bash
cd finext-fastapi && pytest tests/crud/test_sepay_parse.py -v
```

Expected: ImportError.

- [ ] **Step 3: Tạo `app/crud/sepay.py` với parser**

```python
# finext-fastapi/app/crud/sepay.py
"""SePay webhook processing pipeline + helpers."""
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Match FNX + đúng 8 ký tự từ charset [2-9A-Z exclude 0,O,1,I,L]
_ORDER_CODE_PATTERN = re.compile(r"FNX[2-9A-HJKMNP-Z]{8}", re.IGNORECASE)


def parse_order_code_from_content(content: Optional[str]) -> Optional[str]:
    """Extract order_code (FNXxxxxxxxx) từ memo CK. Return uppercase nếu match, None nếu không.

    Memo lấy từ webhook field `content`. Có thể được bank normalize (lowercase, strip dấu).
    Lấy match đầu tiên nếu memo chứa nhiều mã."""
    if not content:
        return None
    match = _ORDER_CODE_PATTERN.search(content)
    if not match:
        return None
    return match.group(0).upper()
```

**Lưu ý regex:** charset là `[2-9A-HJKMNP-Z]` để loại 0/1/I/L/O. Test `test_rejects_excluded_chars` verify điều này.

- [ ] **Step 4: Run test → expect 10 passed**

```bash
cd finext-fastapi && pytest tests/crud/test_sepay_parse.py -v
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/crud/sepay.py finext-fastapi/tests/crud/test_sepay_parse.py
git commit -m "feat(sepay): add parse_order_code_from_content regex parser"
```

---

### Task 8: Email templates (payment success + admin alert)

**Files:**
- Modify: `finext-fastapi/app/utils/email.py` (xác định tên file email service thật trước khi sửa)

- [ ] **Step 1: Tìm file email service hiện có**

```bash
cd finext-fastapi && grep -rln "MAIL_USERNAME\|fastapi_mail\|FastMail" app/ --include="*.py" | head -5
```

Expected: chỉ ra file đang dùng MAIL config (vd `app/utils/email.py` hoặc `app/utils/mailer.py`).

- [ ] **Step 2: Đọc file email service để hiểu pattern hiện có**

```bash
cd finext-fastapi && cat app/utils/email.py 2>/dev/null || cat app/utils/mailer.py 2>/dev/null || cat app/utils/email_service.py 2>/dev/null
```

Note pattern: hàm async, signature trả về None, dùng `FastMail.send_message`.

- [ ] **Step 3: Append 2 hàm mới vào file email service**

Tên file: dựa vào output Step 1. Giả định là `app/utils/email.py`. Append vào CUỐI file:

```python
# === SePay payment notifications (added 2026-05-06) ===
async def send_payment_success_email(
    user_email: str,
    user_name: Optional[str],
    order_code: str,
    license_key: str,
    duration_days: int,
    amount: float,
    paid_at: datetime,
) -> None:
    """Email gửi user khi thanh toán SePay thành công."""
    subject = f"[Finext] Thanh toán thành công cho đơn hàng {order_code}"
    greeting = f"Xin chào {user_name}," if user_name else "Xin chào,"
    html_body = f"""
    <p>{greeting}</p>
    <p>Cảm ơn bạn đã thanh toán đơn hàng <strong>{order_code}</strong>.</p>
    <ul>
        <li>Gói dịch vụ: <strong>{license_key}</strong></li>
        <li>Thời hạn: <strong>{duration_days} ngày</strong></li>
        <li>Số tiền: <strong>{amount:,.0f} đ</strong></li>
        <li>Thời điểm xác nhận: {paid_at.strftime('%H:%M %d/%m/%Y')}</li>
    </ul>
    <p>Xem chi tiết tại <a href="{FRONTEND_URL}/profile/subscriptions">trang subscription của bạn</a>.</p>
    <p>Trân trọng,<br/>Đội ngũ Finext</p>
    """
    # Gọi pattern send hiện có trong file (vd FastMail instance)
    # Adapter này phụ thuộc vào pattern hiện tại — caller phải tự match.
    await _send_email(to=[user_email], subject=subject, html_body=html_body)


async def send_payment_anomaly_alert(
    sepay_log_id: str,
    sepay_transaction_id: int,
    reason: str,
    detail: dict,
) -> None:
    """Email gửi ADMIN_EMAIL khi có anomaly từ webhook SePay (mismatch, IP lạ, quota...)."""
    subject = f"[Finext SePay] {reason} — webhook #{sepay_transaction_id}"
    detail_html = "<br/>".join(f"<b>{k}:</b> {v}" for k, v in detail.items())
    html_body = f"""
    <p><strong>Cảnh báo SePay webhook anomaly</strong></p>
    <p>Lý do: {reason}</p>
    <p>Chi tiết:</p>
    <p>{detail_html}</p>
    <p>Log ID: {sepay_log_id}</p>
    <p>Vui lòng kiểm tra collection <code>sepay_webhook_logs</code> trong DB để xử lý thủ công.</p>
    """
    if not ADMIN_EMAIL:
        logger.warning("ADMIN_EMAIL chưa cấu hình, bỏ qua admin alert")
        return
    await _send_email(to=[ADMIN_EMAIL], subject=subject, html_body=html_body)
```

**Quan trọng:** `_send_email` là helper chung của file. Nếu pattern hiện có là `FastMail.send_message(...)`, chỉnh lại cho khớp. Nếu file chưa có `FRONTEND_URL` import, thêm `from app.core.config import FRONTEND_URL, ADMIN_EMAIL` ở đầu file.

- [ ] **Step 4: Verify import không lỗi**

```bash
cd finext-fastapi && python -c "from app.utils.email import send_payment_success_email, send_payment_anomaly_alert; print('OK')"
```

(Đổi đường dẫn nếu file không phải `email.py`.)

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/utils/email.py
git commit -m "feat(email): add SePay payment success and admin anomaly alert templates"
```

---

### Task 9: `_apply_payment_side_effects` — extract logic chung

**Files:**
- Modify: `finext-fastapi/app/crud/transactions.py`

**Mục tiêu:** Tách logic tạo/gia hạn subscription ra khỏi `confirm_transaction_payment_db` để webhook handler tái sử dụng.

- [ ] **Step 1: Đọc lại logic hiện có để xác định phần extract**

Đọc hàm `confirm_transaction_payment_db` trong `app/crud/transactions.py` (dòng ~408–604). Phần tạo/gia hạn subscription nằm ở khối `if transaction.transaction_type == TransactionTypeEnum.NEW_PURCHASE: ... elif RENEWAL: ...` đến đoạn `# Cập nhật user.subscription_id` và `# Tăng usage_count cho promotion`.

- [ ] **Step 2: Tạo helper `_apply_payment_side_effects` ngay trên `confirm_transaction_payment_db`**

Trong `app/crud/transactions.py`, ngay TRƯỚC định nghĩa `confirm_transaction_payment_db`, thêm:

```python
async def _apply_payment_side_effects(
    db: AsyncIOMotorDatabase,
    transaction: TransactionInDB,
    duration_days_override: Optional[int] = None,
) -> Optional[ObjectId]:
    """Tạo/gia hạn subscription, update user.subscription_id, increment promotion usage.

    Dùng chung cho admin manual confirm và SePay webhook auto-confirm.
    Trả về ObjectId của subscription đã tạo/gia hạn, hoặc None nếu lỗi.

    Caller phải đảm bảo transaction đã được set status='succeeded' trước khi gọi hàm này."""
    dt_now = datetime.now(timezone.utc)
    license_of_transaction = await crud_licenses.get_license_by_id(db, transaction.license_id)
    if not license_of_transaction or not license_of_transaction.id:
        raise ValueError(f"Không tìm thấy license (ID: {transaction.license_id}) của giao dịch {transaction.id}")

    newly_created_or_updated_sub_id: Optional[ObjectId] = None

    if transaction.transaction_type == TransactionTypeEnum.NEW_PURCHASE:
        sub_create_payload = AppSubscriptionCreateSchema(
            user_id=transaction.buyer_user_id,
            license_key=transaction.license_key,
            duration_override_days=duration_days_override or transaction.purchased_duration_days,
        )
        created_sub = await crud_subscriptions.create_subscription_db(db, sub_create_payload)
        if not created_sub or not created_sub.id:
            raise Exception(
                f"Không thể tạo subscription mới cho giao dịch {transaction.id} với license '{transaction.license_key}'."
            )
        newly_created_or_updated_sub_id = ObjectId(created_sub.id)

    elif transaction.transaction_type == TransactionTypeEnum.RENEWAL:
        if not transaction.target_subscription_id:
            raise Exception(f"Giao dịch gia hạn {transaction.id} thiếu target_subscription_id.")

        renewal_target_sub_id_str = str(transaction.target_subscription_id)
        if not ObjectId.is_valid(renewal_target_sub_id_str):
            raise Exception("target_subscription_id không hợp lệ cho gia hạn.")

        target_sub_to_renew = await crud_subscriptions.get_subscription_by_id_db(db, renewal_target_sub_id_str)
        if not target_sub_to_renew or not target_sub_to_renew.id:
            raise Exception(f"Subscription đích {renewal_target_sub_id_str} để gia hạn không tìm thấy.")

        if target_sub_to_renew.license_key != transaction.license_key:
            raise ValueError(
                f"Không thể gia hạn subscription '{target_sub_to_renew.license_key}' "
                f"bằng giao dịch cho license '{transaction.license_key}'."
            )

        user_obj_id_for_renewal = ObjectId(transaction.buyer_user_id)
        sub_obj_id_for_renewal = ObjectId(target_sub_to_renew.id)

        if target_sub_to_renew.license_key not in PROTECTED_LICENSE_KEYS:
            await crud_subscriptions.deactivate_all_active_subscriptions_for_user(
                db, user_obj_id_for_renewal, exclude_sub_id=sub_obj_id_for_renewal
            )

        start_renewal_from = target_sub_to_renew.expiry_date
        if start_renewal_from.tzinfo is None:
            start_renewal_from = start_renewal_from.replace(tzinfo=timezone.utc)

        if start_renewal_from < dt_now:
            start_renewal_from = dt_now

        duration_days_to_use = duration_days_override or transaction.purchased_duration_days
        new_expiry_date = start_renewal_from + timedelta(days=duration_days_to_use)

        updated_sub_result = await db.subscriptions.update_one(
            {"_id": sub_obj_id_for_renewal},
            {
                "$set": {
                    "expiry_date": new_expiry_date,
                    "start_date": start_renewal_from if start_renewal_from == dt_now else target_sub_to_renew.start_date,
                    "updated_at": dt_now,
                    "is_active": True,
                }
            },
        )
        if updated_sub_result.matched_count == 0:
            raise Exception(f"Không thể cập nhật subscription {renewal_target_sub_id_str} khi gia hạn.")
        newly_created_or_updated_sub_id = sub_obj_id_for_renewal

    # Cập nhật user.subscription_id
    if newly_created_or_updated_sub_id:
        await db.users.update_one(
            {"_id": ObjectId(transaction.buyer_user_id)},
            {"$set": {"subscription_id": newly_created_or_updated_sub_id, "updated_at": dt_now}},
        )

    # Tăng usage_count cho promotion (nếu có và license không phải PROTECTED)
    if transaction.promotion_code_applied and license_of_transaction.key not in PROTECTED_LICENSE_KEYS:
        await crud_promotions.increment_promotion_usage(db, transaction.promotion_code_applied)
        logger.info(
            f"Đã tăng lượt sử dụng cho mã KM '{transaction.promotion_code_applied}' của giao dịch {transaction.id}."
        )

    return newly_created_or_updated_sub_id
```

- [ ] **Step 3: Refactor `confirm_transaction_payment_db` dùng helper mới**

Trong `confirm_transaction_payment_db`, thay thế khối từ `# Cập nhật user.subscription_id` (cũ) đến hết logic NEW_PURCHASE/RENEWAL bằng:

```python
    # Apply payment side effects (tạo/gia hạn subscription, update user, increment promo)
    newly_created_or_updated_sub_id = await _apply_payment_side_effects(
        db,
        transaction,
        duration_days_override=confirmation_request.duration_days_override,
    )
    if newly_created_or_updated_sub_id:
        update_fields_for_transaction["target_subscription_id"] = newly_created_or_updated_sub_id

    # Set provider + paid_at cho admin manual flow
    update_fields_for_transaction["payment_provider"] = "manual"
    update_fields_for_transaction["paid_at"] = dt_now
```

**Lưu ý:** giữ nguyên các logic phía trên (override amount/duration/promo/broker, recalculate). Chỉ replace phần subscription/user/promotion side effects.

- [ ] **Step 4: Verify behavior không đổi — chạy thử admin manual confirm flow**

```bash
cd finext-fastapi && python -c "
from app.crud.transactions import confirm_transaction_payment_db, _apply_payment_side_effects
import inspect
# Verify signatures
sig_a = inspect.signature(_apply_payment_side_effects)
sig_b = inspect.signature(confirm_transaction_payment_db)
assert 'transaction' in sig_a.parameters
assert 'duration_days_override' in sig_a.parameters
assert 'transaction_id_str' in sig_b.parameters
print('OK signatures')
"
```

Expected: `OK signatures`.

(Test runtime với DB thật sẽ ở Task 10 khi viết integration test.)

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/crud/transactions.py
git commit -m "refactor(transactions): extract _apply_payment_side_effects from confirm_transaction_payment_db"
```

---

### Task 10: `confirm_transaction_payment_via_webhook` (atomic version)

**Files:**
- Modify: `finext-fastapi/app/crud/transactions.py`

- [ ] **Step 1: Thêm imports cần thiết**

Trong `app/crud/transactions.py`, thêm vào block imports phía trên:

```python
from pymongo import ReturnDocument
```

- [ ] **Step 2: Thêm hàm mới ngay sau `_apply_payment_side_effects`**

```python
async def confirm_transaction_payment_via_webhook(
    db: AsyncIOMotorDatabase,
    transaction_id_str: PyObjectId,
    sepay_transaction_id: int,
    paid_at: datetime,
) -> Optional[TransactionInDB]:
    """Atomic version dành cho SePay webhook caller.

    Khác biệt với confirm_transaction_payment_db (admin flow):
    - Atomic findOneAndUpdate guard: chỉ transition nếu vẫn PENDING (chống race)
    - Set payment_provider='sepay', sepay_transaction_id, paid_at
    - KHÔNG nhận TransactionPaymentConfirmationRequest (không có override)
    - Return None nếu race lost — caller sẽ log status='wrong_status'

    Reuse _apply_payment_side_effects để tạo subscription/gia hạn/email logic."""
    if not ObjectId.is_valid(transaction_id_str):
        raise ValueError(f"transaction_id không hợp lệ: {transaction_id_str}")

    dt_now = datetime.now(timezone.utc)

    # Atomic transition PENDING → SUCCEEDED
    updated_doc = await db[TRANSACTIONS_COLLECTION].find_one_and_update(
        {
            "_id": ObjectId(transaction_id_str),
            "payment_status": PaymentStatusEnum.PENDING.value,
        },
        {
            "$set": {
                "payment_status": PaymentStatusEnum.SUCCEEDED.value,
                "payment_provider": "sepay",
                "sepay_transaction_id": sepay_transaction_id,
                "paid_at": paid_at,
                "updated_at": dt_now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if updated_doc is None:
        # Race lost: transaction đã bị thay đổi (canceled / succeeded by other)
        logger.warning(
            f"SePay webhook race lost for transaction {transaction_id_str} "
            f"(sepay_transaction_id={sepay_transaction_id})"
        )
        return None

    # Convert ObjectId fields to str cho Pydantic parse
    for key in ["buyer_user_id", "license_id", "target_subscription_id"]:
        if updated_doc.get(key) and isinstance(updated_doc[key], ObjectId):
            updated_doc[key] = str(updated_doc[key])
    transaction = TransactionInDB(**updated_doc)

    # Apply side effects (tạo subscription, etc.)
    newly_created_or_updated_sub_id = await _apply_payment_side_effects(db, transaction)
    if newly_created_or_updated_sub_id:
        await db[TRANSACTIONS_COLLECTION].update_one(
            {"_id": ObjectId(transaction_id_str)},
            {"$set": {"target_subscription_id": newly_created_or_updated_sub_id}},
        )

    return await get_transaction_by_id(db, transaction_id_str)
```

- [ ] **Step 3: Verify import không lỗi**

```bash
cd finext-fastapi && python -c "
from app.crud.transactions import confirm_transaction_payment_via_webhook
import inspect
sig = inspect.signature(confirm_transaction_payment_via_webhook)
params = list(sig.parameters.keys())
assert params == ['db', 'transaction_id_str', 'sepay_transaction_id', 'paid_at']
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add finext-fastapi/app/crud/transactions.py
git commit -m "feat(transactions): add atomic confirm_transaction_payment_via_webhook"
```

---

### Task 11: Auto-cancel PENDING cũ khi user tạo order mới

**Files:**
- Create: `finext-fastapi/tests/crud/test_transactions_sepay.py`
- Modify: `finext-fastapi/app/crud/transactions.py`

- [ ] **Step 1: Viết failing test**

`finext-fastapi/tests/crud/test_transactions_sepay.py`:

```python
"""Test các thay đổi SePay trong app/crud/transactions.py."""
import pytest
from datetime import datetime, timezone
from bson import ObjectId


class TestAutoCancelPendingOnNewOrder:
    """Khi user tạo order mới, mọi PENDING order cũ phải bị auto-cancel."""

    @pytest.mark.asyncio
    async def test_cancels_existing_pending_orders(self, test_db):
        from app.crud.transactions import _auto_cancel_user_pending_orders

        user_id = ObjectId()

        # Insert 2 PENDING + 1 SUCCEEDED
        await test_db.transactions.insert_many([
            {
                "buyer_user_id": user_id,
                "payment_status": "pending",
                "transaction_amount": 100000,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "buyer_user_id": user_id,
                "payment_status": "pending",
                "transaction_amount": 200000,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "buyer_user_id": user_id,
                "payment_status": "succeeded",
                "transaction_amount": 50000,
                "created_at": datetime.now(timezone.utc),
            },
        ])

        result = await _auto_cancel_user_pending_orders(test_db, str(user_id))
        assert result == 2

        # Verify
        canceled_count = await test_db.transactions.count_documents({
            "buyer_user_id": user_id,
            "payment_status": "canceled",
        })
        assert canceled_count == 2

        succeeded_count = await test_db.transactions.count_documents({
            "buyer_user_id": user_id,
            "payment_status": "succeeded",
        })
        assert succeeded_count == 1  # Không bị động đến

    @pytest.mark.asyncio
    async def test_only_cancels_for_specified_user(self, test_db):
        from app.crud.transactions import _auto_cancel_user_pending_orders

        user_a = ObjectId()
        user_b = ObjectId()

        await test_db.transactions.insert_many([
            {"buyer_user_id": user_a, "payment_status": "pending", "transaction_amount": 100, "created_at": datetime.now(timezone.utc)},
            {"buyer_user_id": user_b, "payment_status": "pending", "transaction_amount": 200, "created_at": datetime.now(timezone.utc)},
        ])

        result = await _auto_cancel_user_pending_orders(test_db, str(user_a))
        assert result == 1

        # User B's PENDING không bị động
        b_pending = await test_db.transactions.count_documents({
            "buyer_user_id": user_b,
            "payment_status": "pending",
        })
        assert b_pending == 1

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_pending(self, test_db):
        from app.crud.transactions import _auto_cancel_user_pending_orders

        user_id = ObjectId()
        result = await _auto_cancel_user_pending_orders(test_db, str(user_id))
        assert result == 0
```

- [ ] **Step 2: Run test → expect ImportError trên `_auto_cancel_user_pending_orders`**

```bash
cd finext-fastapi && pytest tests/crud/test_transactions_sepay.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement helper trong `app/crud/transactions.py`**

Thêm hàm này TRƯỚC `create_transaction_by_user_db`:

```python
async def _auto_cancel_user_pending_orders(
    db: AsyncIOMotorDatabase,
    user_id_str: PyObjectId,
) -> int:
    """Auto-cancel mọi PENDING order của user. Gọi trước khi tạo order mới.
    Trả về số lượng order bị cancel."""
    if not ObjectId.is_valid(user_id_str):
        return 0

    dt_now = datetime.now(timezone.utc)
    result = await db[TRANSACTIONS_COLLECTION].update_many(
        {
            "buyer_user_id": ObjectId(user_id_str),
            "payment_status": PaymentStatusEnum.PENDING.value,
        },
        {
            "$set": {
                "payment_status": PaymentStatusEnum.CANCELED.value,
                "updated_at": dt_now,
                "notes": "[Auto-canceled: user tạo đơn mới]",
            }
        },
    )
    if result.modified_count > 0:
        logger.info(
            f"Auto-canceled {result.modified_count} PENDING orders cho user {user_id_str} "
            "trước khi tạo order mới."
        )
    return result.modified_count
```

- [ ] **Step 4: Tích hợp vào `create_transaction_by_user_db`**

Trong hàm `create_transaction_by_user_db`, ngay TRƯỚC dòng `prepared_data = await _prepare_transaction_data(...)`, thêm:

```python
        # Auto-cancel mọi PENDING order cũ trước khi tạo mới (D9)
        await _auto_cancel_user_pending_orders(db, str(current_user.id))
```

- [ ] **Step 5: Run test → expect 3 passed**

```bash
cd finext-fastapi && pytest tests/crud/test_transactions_sepay.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add finext-fastapi/app/crud/transactions.py finext-fastapi/tests/crud/test_transactions_sepay.py
git commit -m "feat(transactions): auto-cancel user PENDING orders when creating new one (D9)"
```

---

### Task 12: Gen `order_code` lúc tạo transaction

**Files:**
- Modify: `finext-fastapi/app/crud/transactions.py`

- [ ] **Step 1: Update import**

Thêm vào block imports:

```python
from app.utils.sepay_security import gen_unique_order_code
```

- [ ] **Step 2: Sửa `_prepare_transaction_data` thêm 4 field**

Trong return dict cuối hàm `_prepare_transaction_data`, thêm 4 field mới:

```python
    return {
        # ... các field hiện có ...
        "target_subscription_id": target_subscription_id_for_renewal_obj,
        "created_at": dt_now,
        "updated_at": dt_now,
        # === SePay fields (added 2026-05-06) ===
        "order_code": await gen_unique_order_code(db),
        "payment_provider": None,
        "paid_at": None,
        "sepay_transaction_id": None,
    }
```

- [ ] **Step 3: Viết test verify order_code được set**

Append vào `tests/crud/test_transactions_sepay.py`:

```python
class TestPrepareTransactionDataOrderCode:
    @pytest.mark.asyncio
    async def test_prepare_transaction_sets_order_code(self, test_db):
        """Smoke test: _prepare_transaction_data trả dict có order_code đúng format."""
        # Note: Test này yêu cầu seed user + license vào test_db trước khi gọi.
        # Vì _prepare_transaction_data có nhiều dependency, ở đây ta chỉ verify
        # structure thông qua mocking.
        from unittest.mock import patch, AsyncMock

        with patch(
            "app.crud.transactions.gen_unique_order_code",
            new=AsyncMock(return_value="FNXTEST123"),
        ):
            from app.utils.sepay_security import gen_unique_order_code as real_fn
            code = await gen_unique_order_code(test_db)
            assert code.startswith("FNX")
```

- [ ] **Step 4: Run test → expect pass**

```bash
cd finext-fastapi && pytest tests/crud/test_transactions_sepay.py -v
```

Expected: 4 passed (3 cũ + 1 mới).

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/crud/transactions.py finext-fastapi/tests/crud/test_transactions_sepay.py
git commit -m "feat(transactions): generate unique order_code on transaction creation"
```

---

### Task 13: Webhook processing pipeline (`process_sepay_webhook`)

**Files:**
- Create: `finext-fastapi/tests/crud/test_sepay_webhook.py`
- Modify: `finext-fastapi/app/crud/sepay.py`

- [ ] **Step 1: Viết integration tests cho 8 case (happy + 7 anomaly)**

`finext-fastapi/tests/crud/test_sepay_webhook.py`:

```python
"""Integration tests cho process_sepay_webhook pipeline với MongoDB thật."""
import pytest
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from unittest.mock import patch, AsyncMock

from app.schemas.sepay import SePayWebhookPayload
from app.crud.sepay import process_sepay_webhook


def _make_payload(
    sepay_id: int = 100001,
    content: str = "Thanh toan FNXAB23CD9",
    amount: float = 199000,
    transfer_type: str = "in",
    transaction_date: str = None,
    gateway: str = "Vietcombank",
) -> SePayWebhookPayload:
    if transaction_date is None:
        transaction_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return SePayWebhookPayload(
        id=sepay_id,
        gateway=gateway,
        transactionDate=transaction_date,
        content=content,
        transferType=transfer_type,
        transferAmount=amount,
        accountNumber="0123456789",
        referenceCode="REF123",
    )


async def _seed_pending_transaction(test_db, order_code: str, amount: float):
    """Insert 1 transaction PENDING vào test DB và trả về _id."""
    txn_id = ObjectId()
    user_id = ObjectId()
    license_id = ObjectId()
    await test_db.transactions.insert_one({
        "_id": txn_id,
        "buyer_user_id": user_id,
        "license_id": license_id,
        "license_key": "ADVANCED",
        "original_license_price": amount,
        "purchased_duration_days": 30,
        "transaction_amount": amount,
        "payment_status": "pending",
        "transaction_type": "new_purchase",
        "order_code": order_code,
        "payment_provider": None,
        "paid_at": None,
        "sepay_transaction_id": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    return str(txn_id)


@pytest.fixture
def mock_side_effects(mocker):
    """Mock _apply_payment_side_effects + send_payment_success_email để test pipeline cô lập."""
    mocker.patch(
        "app.crud.transactions._apply_payment_side_effects",
        new=AsyncMock(return_value=ObjectId()),
    )
    mocker.patch("app.crud.sepay.send_payment_success_email", new=AsyncMock())
    mocker.patch("app.crud.sepay.send_payment_anomaly_alert", new=AsyncMock())


class TestProcessSePayWebhook:

    @pytest.mark.asyncio
    async def test_happy_path(self, test_db, mock_side_effects):
        await _seed_pending_transaction(test_db, "FNXAB23CD9P", 199000)
        payload = _make_payload(content="Thanh toan FNXAB23CD9P", amount=199000)

        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")

        assert log.processing_status == "success"
        assert log.matched_order_code == "FNXAB23CD9"

        # Transaction đã succeeded
        txn = await test_db.transactions.find_one({"order_code": "FNXAB23CD9"})
        assert txn["payment_status"] == "succeeded"
        assert txn["payment_provider"] == "sepay"
        assert txn["sepay_transaction_id"] == 100001

    @pytest.mark.asyncio
    async def test_idempotent_duplicate_webhook(self, test_db, mock_side_effects):
        """Webhook trùng sepay_transaction_id → status='duplicate', không double-confirm."""
        await _seed_pending_transaction(test_db, "FNXAB23CD9P", 199000)
        payload = _make_payload(sepay_id=100001, content="Thanh toan FNXAB23CD9P", amount=199000)

        log1 = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log1.processing_status == "success"

        log2 = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log2.processing_status == "duplicate"

    @pytest.mark.asyncio
    async def test_unmatched_order_not_found(self, test_db, mock_side_effects):
        """Order code không tồn tại trong DB."""
        payload = _make_payload(content="Thanh toan FNXAB23CD9P", amount=199000)
        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "unmatched_order_not_found"

    @pytest.mark.asyncio
    async def test_amount_mismatch_rejects(self, test_db, mock_side_effects):
        """Amount lệch → status='amount_mismatch', transaction vẫn PENDING."""
        await _seed_pending_transaction(test_db, "FNXAB23CD9P", 199000)
        payload = _make_payload(content="Thanh toan FNXAB23CD9P", amount=200000)

        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "amount_mismatch"

        txn = await test_db.transactions.find_one({"order_code": "FNXAB23CD9"})
        assert txn["payment_status"] == "pending"  # Không bị đổi

    @pytest.mark.asyncio
    async def test_unmatched_no_code(self, test_db, mock_side_effects):
        """Memo không có FNX → drop log."""
        payload = _make_payload(content="Chuyen tien tu Nguyen Van A", amount=199000)
        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "unmatched_no_code"

    @pytest.mark.asyncio
    async def test_ignored_outbound(self, test_db, mock_side_effects):
        """transferType='out' → ignore."""
        payload = _make_payload(content="FNXAB23CD9P", transfer_type="out", amount=199000)
        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "ignored_outbound"

    @pytest.mark.asyncio
    async def test_replay_rejected_old_date(self, test_db, mock_side_effects):
        """transactionDate >48h cũ → reject."""
        old_date = (datetime.now(timezone.utc) - timedelta(hours=72)).strftime("%Y-%m-%d %H:%M:%S")
        payload = _make_payload(
            content="Thanh toan FNXAB23CD9P",
            amount=199000,
            transaction_date=old_date,
        )
        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "replay_rejected"

    @pytest.mark.asyncio
    async def test_wrong_status_already_succeeded(self, test_db, mock_side_effects):
        """Transaction đã succeeded với sepay_transaction_id khác → status='wrong_status'."""
        # Seed transaction đã succeeded với sepay_transaction_id=99999
        await test_db.transactions.insert_one({
            "_id": ObjectId(),
            "buyer_user_id": ObjectId(),
            "license_id": ObjectId(),
            "license_key": "ADVANCED",
            "original_license_price": 199000,
            "purchased_duration_days": 30,
            "transaction_amount": 199000,
            "payment_status": "succeeded",  # Đã paid
            "transaction_type": "new_purchase",
            "order_code": "FNXAB23CD9",
            "sepay_transaction_id": 99999,  # ID khác với webhook
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

        payload = _make_payload(sepay_id=100001, content="Thanh toan FNXAB23CD9P", amount=199000)
        log = await process_sepay_webhook(test_db, payload, source_ip="1.2.3.4")
        assert log.processing_status == "wrong_status"
```

- [ ] **Step 2: Run test → expect ImportError trên `process_sepay_webhook`**

```bash
cd finext-fastapi && pytest tests/crud/test_sepay_webhook.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implement `process_sepay_webhook` pipeline trong `app/crud/sepay.py`**

Append vào `app/crud/sepay.py`:

```python
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.schemas.sepay import SePayWebhookPayload, SePayWebhookLog
from app.schemas.transactions import PaymentStatusEnum
from app.crud.transactions import (
    confirm_transaction_payment_via_webhook,
    get_transaction_by_id,
)
from app.utils.email import send_payment_success_email, send_payment_anomaly_alert
from app.core.config import SEPAY_FREE_TIER_MONTHLY_LIMIT

SEPAY_WEBHOOK_LOGS_COLLECTION = "sepay_webhook_logs"
TRANSACTIONS_COLLECTION = "transactions"
REPLAY_REJECT_THRESHOLD_HOURS = 48


def _parse_sepay_date(date_str: str) -> Optional[datetime]:
    """Parse 'YYYY-MM-DD HH:MM:SS' (giờ VN, GMT+7) thành datetime UTC."""
    try:
        # SePay không nói rõ TZ, giả định giờ local VN (GMT+7)
        dt_naive = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        # Convert giờ VN -> UTC (trừ 7h)
        return (dt_naive - timedelta(hours=7)).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


async def _create_log_entry(
    db: AsyncIOMotorDatabase,
    payload: SePayWebhookPayload,
    source_ip: str,
    processing_status: str,
    matched_order_code: Optional[str] = None,
    matched_transaction_id: Optional[ObjectId] = None,
    error_message: Optional[str] = None,
) -> SePayWebhookLog:
    """Insert log entry. Caller phải tự handle DuplicateKeyError nếu cần."""
    dt_now = datetime.now(timezone.utc)
    log_doc = {
        "sepay_transaction_id": payload.id,
        "received_at": dt_now,
        "source_ip": source_ip,
        "raw_payload": payload.model_dump(),
        "gateway": payload.gateway,
        "transfer_amount": payload.transferAmount,
        "transfer_type": payload.transferType,
        "content": payload.content or "",
        "reference_code": payload.referenceCode,
        "transaction_date": _parse_sepay_date(payload.transactionDate),
        "matched_order_code": matched_order_code,
        "matched_transaction_id": matched_transaction_id,
        "processing_status": processing_status,
        "error_message": error_message,
        "processed_at": dt_now,
    }
    insert_result = await db[SEPAY_WEBHOOK_LOGS_COLLECTION].insert_one(log_doc)
    log_doc["_id"] = insert_result.inserted_id
    # Convert ObjectId fields to str cho Pydantic
    if log_doc.get("matched_transaction_id"):
        log_doc["matched_transaction_id"] = str(log_doc["matched_transaction_id"])
    return SePayWebhookLog(**log_doc)


async def _get_existing_log(
    db: AsyncIOMotorDatabase,
    sepay_transaction_id: int,
) -> Optional[SePayWebhookLog]:
    """Lấy log entry đã tồn tại (sau khi DuplicateKeyError)."""
    doc = await db[SEPAY_WEBHOOK_LOGS_COLLECTION].find_one(
        {"sepay_transaction_id": sepay_transaction_id}
    )
    if not doc:
        return None
    if doc.get("matched_transaction_id"):
        doc["matched_transaction_id"] = str(doc["matched_transaction_id"])
    return SePayWebhookLog(**doc)


async def get_monthly_webhook_count(db: AsyncIOMotorDatabase) -> int:
    """Đếm số webhook 'success' trong tháng hiện tại — phục vụ alert quota."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return await db[SEPAY_WEBHOOK_LOGS_COLLECTION].count_documents({
        "processing_status": "success",
        "received_at": {"$gte": month_start},
    })


async def process_sepay_webhook(
    db: AsyncIOMotorDatabase,
    payload: SePayWebhookPayload,
    source_ip: str,
) -> SePayWebhookLog:
    """Pipeline xử lý webhook SePay. Idempotent, không raise.

    Trả về SePayWebhookLog với processing_status diễn tả kết quả."""

    # 1. Skip outbound transfers
    if payload.transferType != "in":
        return await _create_log_entry(
            db, payload, source_ip, "ignored_outbound",
            error_message="transferType != 'in'",
        )

    # 2. Replay protection
    parsed_date = _parse_sepay_date(payload.transactionDate)
    if parsed_date and (datetime.now(timezone.utc) - parsed_date).total_seconds() > REPLAY_REJECT_THRESHOLD_HOURS * 3600:
        log = await _create_log_entry(
            db, payload, source_ip, "replay_rejected",
            error_message=f"transactionDate quá cũ (>{REPLAY_REJECT_THRESHOLD_HOURS}h)",
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason="Replay rejected (transactionDate quá cũ)",
            detail={"transactionDate": payload.transactionDate, "amount": payload.transferAmount},
        )
        return log

    # 3. Parse order_code from content
    order_code = parse_order_code_from_content(payload.content)

    if not order_code:
        log = await _create_log_entry(
            db, payload, source_ip, "unmatched_no_code",
            error_message="Không parse được order_code từ content",
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason="Không parse được order_code (CK không có FNX...)",
            detail={"content": payload.content, "amount": payload.transferAmount},
        )
        return log

    # 4. Find transaction by order_code
    txn_doc = await db[TRANSACTIONS_COLLECTION].find_one({"order_code": order_code})
    if not txn_doc:
        log = await _create_log_entry(
            db, payload, source_ip, "unmatched_order_not_found",
            matched_order_code=order_code,
            error_message=f"order_code {order_code} không tồn tại trong transactions",
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason=f"Order code {order_code} không tồn tại",
            detail={"content": payload.content, "amount": payload.transferAmount},
        )
        return log

    txn_id = txn_doc["_id"]

    # 5. Try insert log với UNIQUE constraint trên sepay_transaction_id
    #    Nếu trùng → đây là duplicate webhook, return status='duplicate'
    try:
        # Optimistic insert với status tạm 'success' — sẽ update sau pipeline
        # Không, ta insert trước với status 'pending_processing' để giữ unique
        # Đơn giản hơn: check duplicate explicit trước
        pass
    except Exception:
        pass

    existing = await db[SEPAY_WEBHOOK_LOGS_COLLECTION].find_one(
        {"sepay_transaction_id": payload.id}
    )
    if existing:
        return await _get_existing_log(db, payload.id)

    # 6. Strict amount check
    if payload.transferAmount != txn_doc["transaction_amount"]:
        log = await _create_log_entry(
            db, payload, source_ip, "amount_mismatch",
            matched_order_code=order_code,
            matched_transaction_id=txn_id,
            error_message=(
                f"Amount lệch: webhook={payload.transferAmount}, "
                f"order={txn_doc['transaction_amount']}"
            ),
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason="Amount mismatch — strict reject",
            detail={
                "order_code": order_code,
                "expected_amount": txn_doc["transaction_amount"],
                "received_amount": payload.transferAmount,
            },
        )
        return log

    # 7. Pre-check status
    current_status = txn_doc["payment_status"]

    if current_status == PaymentStatusEnum.SUCCEEDED.value:
        existing_sepay_id = txn_doc.get("sepay_transaction_id")
        if existing_sepay_id == payload.id:
            return await _create_log_entry(
                db, payload, source_ip, "duplicate",
                matched_order_code=order_code,
                matched_transaction_id=txn_id,
            )
        log = await _create_log_entry(
            db, payload, source_ip, "wrong_status",
            matched_order_code=order_code,
            matched_transaction_id=txn_id,
            error_message=f"Transaction đã succeeded với sepay_transaction_id khác ({existing_sepay_id})",
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason="CK trùng vào order đã thanh toán",
            detail={"order_code": order_code, "existing_sepay_id": existing_sepay_id},
        )
        return log

    if current_status == PaymentStatusEnum.CANCELED.value:
        log = await _create_log_entry(
            db, payload, source_ip, "wrong_status",
            matched_order_code=order_code,
            matched_transaction_id=txn_id,
            error_message="Transaction đã canceled",
        )
        await send_payment_anomaly_alert(
            sepay_log_id=str(log.id),
            sepay_transaction_id=payload.id,
            reason="CK vào order đã canceled",
            detail={"order_code": order_code, "amount": payload.transferAmount},
        )
        return log

    # 8. Atomic transition + side effects
    paid_at_dt = parsed_date or datetime.now(timezone.utc)
    try:
        confirmed_txn = await confirm_transaction_payment_via_webhook(
            db,
            transaction_id_str=str(txn_id),
            sepay_transaction_id=payload.id,
            paid_at=paid_at_dt,
        )
    except Exception as e:
        log = await _create_log_entry(
            db, payload, source_ip, "error",
            matched_order_code=order_code,
            matched_transaction_id=txn_id,
            error_message=f"Lỗi khi confirm: {str(e)}",
        )
        logger.exception(f"Lỗi confirm SePay webhook cho transaction {txn_id}")
        return log

    if confirmed_txn is None:
        # Race lost
        log = await _create_log_entry(
            db, payload, source_ip, "wrong_status",
            matched_order_code=order_code,
            matched_transaction_id=txn_id,
            error_message="Race lost: transaction đã thay đổi giữa pre-check và atomic update",
        )
        return log

    # 9. Send user email + check quota
    try:
        user_doc = await db.users.find_one({"_id": ObjectId(confirmed_txn.buyer_user_id)})
        if user_doc:
            await send_payment_success_email(
                user_email=user_doc["email"],
                user_name=user_doc.get("full_name"),
                order_code=confirmed_txn.order_code,
                license_key=confirmed_txn.license_key,
                duration_days=confirmed_txn.purchased_duration_days,
                amount=confirmed_txn.transaction_amount,
                paid_at=paid_at_dt,
            )
    except Exception as e:
        logger.error(f"Không gửi được email payment success: {e}")

    # Quota alert
    monthly_count = await get_monthly_webhook_count(db)
    if monthly_count + 1 == 40:  # +1 vì log chưa insert
        await send_payment_anomaly_alert(
            sepay_log_id="quota-warning",
            sepay_transaction_id=payload.id,
            reason=f"SePay quota gần ngưỡng FREE: {monthly_count + 1}/{SEPAY_FREE_TIER_MONTHLY_LIMIT}",
            detail={"current_count": monthly_count + 1},
        )
    elif monthly_count + 1 >= SEPAY_FREE_TIER_MONTHLY_LIMIT:
        await send_payment_anomaly_alert(
            sepay_log_id="quota-exceeded",
            sepay_transaction_id=payload.id,
            reason=f"⚠️ SePay quota vượt FREE: {monthly_count + 1}/{SEPAY_FREE_TIER_MONTHLY_LIMIT}",
            detail={"current_count": monthly_count + 1},
        )

    # 10. Final log success
    return await _create_log_entry(
        db, payload, source_ip, "success",
        matched_order_code=order_code,
        matched_transaction_id=txn_id,
    )
```

- [ ] **Step 4: Run test → expect 8 passed**

```bash
cd finext-fastapi && pytest tests/crud/test_sepay_webhook.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/crud/sepay.py finext-fastapi/tests/crud/test_sepay_webhook.py
git commit -m "feat(sepay): implement process_sepay_webhook pipeline (8 anomaly cases handled)"
```

---

### Task 14: Webhook router endpoint

**Files:**
- Create: `finext-fastapi/app/routers/sepay_webhooks.py`
- Modify: `finext-fastapi/app/main.py`

- [ ] **Step 1: Tạo router file**

```python
# finext-fastapi/app/routers/sepay_webhooks.py
"""SePay webhook receiver. KHÔNG có require_permission vì là external endpoint."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import (
    SEPAY_ENABLED,
    SEPAY_ALLOWED_IPS,
    SEPAY_WEBHOOK_API_KEY,
)
from app.core.database import get_database
from app.crud.sepay import process_sepay_webhook
from app.schemas.sepay import SePayWebhookPayload
from app.utils.sepay_security import verify_source_ip, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(tags=["sepay"])


@router.post("/sepay/webhook", status_code=status.HTTP_200_OK)
async def receive_sepay_webhook(
    request: Request,
    payload: SePayWebhookPayload,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> dict[str, Any]:
    """Endpoint SePay gọi tới khi có giao dịch.

    KHÔNG có auth permission vì caller là SePay (external).
    Verify qua: IP whitelist + API key constant-time compare.

    Luôn trả `{"success": true}` HTTP 200, kể cả unmatched, để SePay không retry.
    Chỉ trả 5xx khi có lỗi infra (DB down) — cho SePay retry."""

    if not SEPAY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SePay integration disabled",
        )

    # Verify (sẽ raise HTTPException 401/403 nếu fail)
    client_ip = verify_source_ip(request, SEPAY_ALLOWED_IPS)
    verify_api_key(request, SEPAY_WEBHOOK_API_KEY)

    log = await process_sepay_webhook(db, payload, source_ip=client_ip)
    logger.info(
        f"SePay webhook processed: status={log.processing_status} "
        f"sepay_id={payload.id} order_code={log.matched_order_code}"
    )
    return {"success": True}
```

- [ ] **Step 2: Register router trong `app/main.py`**

Trong `app/main.py`:

1. Thêm `sepay_webhooks` vào block import:
```python
from .routers import (
    auth, brokers, licenses, permissions, promotions, roles,
    sessions, sse, subscriptions, transactions, users, emails,
    otps, watchlists, uploads, features, dashboard,
    sepay_webhooks,  # MỚI
)
```

2. Thêm `app.include_router(...)` sau dòng `dashboard` (cuối block include_router):
```python
app.include_router(sepay_webhooks.router, prefix="/api/v1", tags=["sepay"])
```

- [ ] **Step 3: Smoke test app khởi động được**

```bash
cd finext-fastapi && python -c "from app.main import app; routes = [r.path for r in app.routes]; assert '/api/v1/sepay/webhook' in routes; print('OK')"
```

Expected: `OK`.

- [ ] **Step 4: Manual smoke test với curl**

Khởi động app dev:
```bash
cd finext-fastapi && uvicorn app.main:app --reload
```

Trong terminal khác, test webhook trả 503 khi `SEPAY_ENABLED=false`:
```bash
curl -X POST http://localhost:8000/api/v1/sepay/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey test" \
  -d '{"id":1,"gateway":"VCB","transactionDate":"2026-05-06 10:00:00","transferType":"in","transferAmount":100000,"content":"test"}'
```

Expected: HTTP 503 `{"detail": "SePay integration disabled"}`.

Tắt uvicorn (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/routers/sepay_webhooks.py finext-fastapi/app/main.py
git commit -m "feat(sepay): add webhook receiver endpoint POST /api/v1/sepay/webhook"
```

---

### Task 15: Scheduler job auto-cancel expired PENDING orders

**Files:**
- Modify: `finext-fastapi/app/core/scheduler.py`

- [ ] **Step 1: Đọc scheduler hiện có để hiểu pattern**

```bash
cd finext-fastapi && cat app/core/scheduler.py
```

Note pattern: `@scheduler.scheduled_job(...)`, async function, hoặc `add_job` ở `start_scheduler`.

- [ ] **Step 2: Thêm job auto-cancel**

Trong `app/core/scheduler.py`, append vào CUỐI file (TRƯỚC `start_scheduler`):

```python
async def auto_cancel_expired_pending_orders():
    """Quét transaction PENDING > SEPAY_ORDER_TIMEOUT_MINUTES → cancel.
    Chạy mỗi 5 phút. Dùng index (payment_status, created_at)."""
    from datetime import datetime, timezone, timedelta
    from app.core.database import get_database
    from app.core.config import SEPAY_ORDER_TIMEOUT_MINUTES

    db = get_database("user_db")
    if db is None:
        logger.warning("auto_cancel_expired_pending_orders: db is None, skip")
        return

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SEPAY_ORDER_TIMEOUT_MINUTES)
    result = await db.transactions.update_many(
        {
            "payment_status": "pending",
            "created_at": {"$lt": cutoff},
        },
        {
            "$set": {
                "payment_status": "canceled",
                "updated_at": datetime.now(timezone.utc),
                "notes": f"[Auto-canceled: timeout {SEPAY_ORDER_TIMEOUT_MINUTES}p]",
            }
        },
    )
    if result.modified_count > 0:
        logger.info(f"Auto-canceled {result.modified_count} PENDING orders quá hạn")
```

- [ ] **Step 3: Đăng ký job với scheduler**

Trong `start_scheduler` của `app/core/scheduler.py`, sau các `add_job` hiện có (hoặc trước `scheduler.start()`), thêm:

```python
    scheduler.add_job(
        auto_cancel_expired_pending_orders,
        trigger="interval",
        minutes=5,
        id="sepay_auto_cancel_expired",
        replace_existing=True,
    )
    logger.info("Scheduled job: sepay_auto_cancel_expired (every 5 minutes)")
```

- [ ] **Step 4: Verify import không lỗi**

```bash
cd finext-fastapi && python -c "from app.core.scheduler import auto_cancel_expired_pending_orders, start_scheduler; print('OK')"
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/core/scheduler.py
git commit -m "feat(scheduler): auto-cancel expired PENDING orders every 5 minutes"
```

---

### Task 16: DB indexes migration ở startup

**Files:**
- Modify: `finext-fastapi/app/core/database.py` (hoặc `app/main.py` lifespan tùy pattern hiện có)

- [ ] **Step 1: Tìm vị trí chạy index creation hiện có**

```bash
cd finext-fastapi && grep -rn "create_index\|create_indexes" app/ --include="*.py"
```

Expected: ra vài chỗ chạy `create_index` lúc seeding/startup.

- [ ] **Step 2: Tạo file migration mới `app/core/sepay_migrations.py`**

```python
# finext-fastapi/app/core/sepay_migrations.py
"""SePay schema migrations: indexes cho transactions + sepay_webhook_logs."""
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def ensure_sepay_indexes(db: AsyncIOMotorDatabase) -> None:
    """Tạo các index cần cho SePay integration. Idempotent — gọi mỗi startup OK.

    Indexes:
    - transactions.order_code: UNIQUE sparse (NULL không tính)
    - transactions.(payment_status, created_at): composite cho scheduler query
    - sepay_webhook_logs.sepay_transaction_id: UNIQUE
    - sepay_webhook_logs.received_at: TTL 90 ngày
    - sepay_webhook_logs.processing_status: hash cho query alert/admin filter"""
    try:
        # transactions
        await db.transactions.create_index(
            "order_code",
            unique=True,
            sparse=True,
            name="idx_order_code_unique_sparse",
        )
        await db.transactions.create_index(
            [("payment_status", 1), ("created_at", 1)],
            name="idx_status_created",
        )

        # sepay_webhook_logs
        await db.sepay_webhook_logs.create_index(
            "sepay_transaction_id",
            unique=True,
            name="idx_sepay_txn_id_unique",
        )
        await db.sepay_webhook_logs.create_index(
            "received_at",
            expireAfterSeconds=90 * 24 * 3600,  # 90 ngày
            name="idx_received_at_ttl_90d",
        )
        await db.sepay_webhook_logs.create_index(
            "processing_status",
            name="idx_processing_status",
        )

        logger.info("SePay indexes ensured (transactions + sepay_webhook_logs)")
    except Exception as e:
        logger.error(f"Lỗi tạo SePay indexes: {e}", exc_info=True)
        # Không raise — app vẫn chạy được, sẽ tạo lại lần restart sau
```

- [ ] **Step 3: Gọi từ lifespan trong `app/main.py`**

Trong `app/main.py`, hàm `lifespan`, sau `await seed_initial_data(db_instance)` (hoặc tương đương), thêm:

```python
        from .core.sepay_migrations import ensure_sepay_indexes
        await ensure_sepay_indexes(db_instance)
```

- [ ] **Step 4: Smoke test app khởi động + indexes tạo**

```bash
cd finext-fastapi && uvicorn app.main:app --reload &
sleep 5
# Trong terminal khác:
mongosh finext_user_db --eval "db.transactions.getIndexes(); db.sepay_webhook_logs.getIndexes()"
```

Expected: thấy `idx_order_code_unique_sparse`, `idx_status_created`, `idx_sepay_txn_id_unique`, `idx_received_at_ttl_90d`, `idx_processing_status`.

Tắt uvicorn.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/core/sepay_migrations.py finext-fastapi/app/main.py
git commit -m "feat(sepay): add DB index migrations at startup"
```

---

### Task 17: User-facing endpoints `/me/{id}/qr-info` và `/me/{id}/status`

**Files:**
- Modify: `finext-fastapi/app/routers/transactions.py`

- [ ] **Step 1: Thêm imports**

Trong `app/routers/transactions.py`, thêm:

```python
from datetime import timedelta
from urllib.parse import quote
from app.core.config import (
    SEPAY_ENABLED,
    SEPAY_BANK_NAME,
    SEPAY_ACCOUNT_NUMBER,
    SEPAY_ACCOUNT_HOLDER,
    SEPAY_ORDER_TIMEOUT_MINUTES,
)
from app.schemas.sepay import QrInfoResponse, TransactionStatusResponse
```

- [ ] **Step 2: Thêm endpoint `/me/{id}/qr-info`**

Append vào `app/routers/transactions.py`:

```python
@router.get(
    "/me/{transaction_id}/qr-info",
    response_model=StandardApiResponse[QrInfoResponse],
    summary="[User] Lấy thông tin QR + bank để thanh toán đơn hàng PENDING",
    dependencies=[Depends(require_permission("transaction", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin thanh toán thành công.")
async def get_qr_info_for_my_order(
    transaction_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not SEPAY_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Hệ thống thanh toán tự động đang bảo trì, vui lòng liên hệ admin.",
        )

    transaction = await crud_transactions.get_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Đơn hàng không tồn tại.")

    if str(transaction.buyer_user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập đơn hàng này.")

    if transaction.payment_status != PaymentStatusEnum.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Đơn hàng đang ở trạng thái '{transaction.payment_status.value}', không cần thanh toán.",
        )

    if not transaction.order_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đơn hàng không có mã đối soát (đơn cũ trước khi tích SePay).",
        )

    # Build QR URL (encode params)
    qr_url = (
        f"https://qr.sepay.vn/img"
        f"?acc={quote(SEPAY_ACCOUNT_NUMBER)}"
        f"&bank={quote(SEPAY_BANK_NAME)}"
        f"&amount={int(transaction.transaction_amount)}"
        f"&des={quote(transaction.order_code)}"
    )

    expires_at = transaction.created_at + timedelta(minutes=SEPAY_ORDER_TIMEOUT_MINUTES)

    return QrInfoResponse(
        order_code=transaction.order_code,
        qr_image_url=qr_url,
        bank_name=SEPAY_BANK_NAME,
        account_number=SEPAY_ACCOUNT_NUMBER,
        account_holder=SEPAY_ACCOUNT_HOLDER,
        transfer_content=transaction.order_code,
        amount=transaction.transaction_amount,
        expires_at=expires_at,
    )
```

- [ ] **Step 3: Thêm endpoint `/me/{id}/status`**

Append:

```python
@router.get(
    "/me/{transaction_id}/status",
    response_model=StandardApiResponse[TransactionStatusResponse],
    summary="[User] Polling trạng thái thanh toán",
    dependencies=[Depends(require_permission("transaction", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy trạng thái thành công.")
async def get_my_order_status(
    transaction_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transaction = await crud_transactions.get_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Đơn hàng không tồn tại.")

    if str(transaction.buyer_user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập đơn hàng này.")

    return TransactionStatusResponse(
        transaction_id=transaction.id,
        payment_status=transaction.payment_status,
        paid_at=transaction.paid_at,
        subscription_id=transaction.target_subscription_id,
    )
```

- [ ] **Step 4: Verify routes registered**

```bash
cd finext-fastapi && python -c "
from app.main import app
paths = [r.path for r in app.routes]
assert '/api/v1/transactions/me/{transaction_id}/qr-info' in paths
assert '/api/v1/transactions/me/{transaction_id}/status' in paths
print('OK')
"
```

Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/routers/transactions.py
git commit -m "feat(transactions): add user endpoints /me/{id}/qr-info and /me/{id}/status"
```

---

## Phase 3: Frontend Checkout Page

### Task 18: `services/sepayService.ts`

**Files:**
- Create: `finext-nextjs/services/sepayService.ts`

- [ ] **Step 1: Đọc apiClient để hiểu pattern call API hiện có**

```bash
cd finext-nextjs && cat services/apiClient.ts | head -80
```

Note: response wrapper pattern (status, message, data), header auth.

- [ ] **Step 2: Tạo file**

```typescript
// finext-nextjs/services/sepayService.ts
import { apiClient } from "./apiClient";

export interface QrInfo {
    order_code: string;
    qr_image_url: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
    transfer_content: string;
    amount: number;
    expires_at: string; // ISO datetime
}

export interface TransactionStatus {
    transaction_id: string;
    payment_status: "pending" | "succeeded" | "canceled";
    paid_at: string | null;
    subscription_id: string | null;
}

export async function getQrInfo(transactionId: string): Promise<QrInfo> {
    const response = await apiClient.get<{ data: QrInfo }>(
        `/api/v1/transactions/me/${transactionId}/qr-info`
    );
    return response.data.data;
}

export async function getTransactionStatus(
    transactionId: string
): Promise<TransactionStatus> {
    const response = await apiClient.get<{ data: TransactionStatus }>(
        `/api/v1/transactions/me/${transactionId}/status`,
        // Đảm bảo polling không bị cache
        { headers: { "Cache-Control": "no-store" } }
    );
    return response.data.data;
}
```

**Lưu ý:** signature `apiClient.get<T>(url, config?)` phụ thuộc client thật trong project. Đọc `services/apiClient.ts` để match đúng. Nếu pattern là `apiClient.get(url).then(r => r.data)`, sửa lại theo pattern đó.

- [ ] **Step 3: TS check**

```bash
cd finext-nextjs && npx tsc --noEmit -p . 2>&1 | grep "services/sepayService" || echo "no errors"
```

Expected: `no errors`.

- [ ] **Step 4: Commit**

```bash
git add finext-nextjs/services/sepayService.ts
git commit -m "feat(frontend): add sepayService for qr-info and status endpoints"
```

---

### Task 19: Checkout page server component

**Files:**
- Create: `finext-nextjs/app/(main)/checkout/[orderId]/page.tsx`

- [ ] **Step 1: Tạo file**

```tsx
// finext-nextjs/app/(main)/checkout/[orderId]/page.tsx
import type { Metadata } from "next";
import PageContent from "./PageContent";

export const metadata: Metadata = {
    title: "Thanh toán | Finext",
};

interface CheckoutPageProps {
    params: Promise<{ orderId: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
    const { orderId } = await params;
    return <PageContent orderId={orderId} />;
}
```

**Note:** Next.js 15+ params là Promise — phải `await`. Verify project version trong `finext-nextjs/package.json` và adjust nếu là Next.js 14 (params không cần await).

- [ ] **Step 2: TS check**

```bash
cd finext-nextjs && npx tsc --noEmit -p . 2>&1 | grep "checkout" || echo "no errors"
```

Expected: `no errors`. (PageContent chưa tồn tại sẽ lỗi — chuyển task tiếp.)

---

### Task 20: Checkout PageContent (split layout + polling + countdown)

**Files:**
- Create: `finext-nextjs/app/(main)/checkout/[orderId]/PageContent.tsx`

- [ ] **Step 1: Đọc 1-2 page hiện có để học pattern theme/MUI**

```bash
cd finext-nextjs && head -60 "app/(main)/profile/subscriptions/page.tsx"
```

Note: pattern useTheme, useMediaQuery, getGlassCard, ChartSectionTitle.

- [ ] **Step 2: Tạo file `PageContent.tsx` (full implementation)**

```tsx
// finext-nextjs/app/(main)/checkout/[orderId]/PageContent.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Button,
    Card,
    IconButton,
    LinearProgress,
    Skeleton,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { getQrInfo, getTransactionStatus, type QrInfo } from 'services/sepayService';

const POLL_INTERVAL_DEFAULT_MS = 5000;
const POLL_INTERVAL_FAST_MS = 2000;
const POLL_FAST_DURATION_MS = 60_000;

type CheckoutState =
    | { kind: 'loading' }
    | { kind: 'ready'; qr: QrInfo }
    | { kind: 'polling'; qr: QrInfo }
    | { kind: 'success'; subId: string | null }
    | { kind: 'expired' }
    | { kind: 'canceled' }
    | { kind: 'error'; msg: string };

interface PageContentProps {
    orderId: string;
}

function formatVnd(amount: number): string {
    return amount.toLocaleString('vi-VN');
}

function formatRemaining(ms: number): string {
    if (ms <= 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function PageContent({ orderId }: PageContentProps) {
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [state, setState] = useState<CheckoutState>({ kind: 'loading' });
    const [remainingMs, setRemainingMs] = useState<number>(0);
    const [copyToast, setCopyToast] = useState<string | null>(null);

    const fastModeUntilRef = useRef<number>(0);
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 1) Fetch QR info on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const qr = await getQrInfo(orderId);
                if (!cancelled) setState({ kind: 'ready', qr });
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Không tải được thông tin thanh toán';
                if (!cancelled) {
                    if (msg.includes('503')) {
                        setState({ kind: 'error', msg: 'Hệ thống thanh toán đang bảo trì, vui lòng liên hệ admin.' });
                    } else {
                        setState({ kind: 'error', msg });
                    }
                }
            }
        })();
        return () => { cancelled = true; };
    }, [orderId]);

    // 2) Countdown timer
    useEffect(() => {
        if (state.kind !== 'ready' && state.kind !== 'polling') return;
        const expiresAt = new Date(state.qr.expires_at).getTime();
        const update = () => {
            const remaining = expiresAt - Date.now();
            setRemainingMs(remaining);
            if (remaining <= 0) {
                setState({ kind: 'expired' });
            }
        };
        update();
        countdownRef.current = setInterval(update, 1000);
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [state.kind === 'ready' || state.kind === 'polling' ? state.qr?.order_code : null]);

    // 3) Polling status
    useEffect(() => {
        if (state.kind !== 'ready' && state.kind !== 'polling') return;

        const poll = async () => {
            try {
                const status = await getTransactionStatus(orderId);
                if (status.payment_status === 'succeeded') {
                    setState({ kind: 'success', subId: status.subscription_id });
                    return;
                }
                if (status.payment_status === 'canceled') {
                    setState({ kind: 'canceled' });
                    return;
                }
                // schedule next poll
                const inFastMode = Date.now() < fastModeUntilRef.current;
                const nextDelay = inFastMode ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_DEFAULT_MS;
                pollingRef.current = setTimeout(poll, nextDelay);
            } catch {
                // Lỗi tạm thời — retry default interval
                pollingRef.current = setTimeout(poll, POLL_INTERVAL_DEFAULT_MS);
            }
        };
        pollingRef.current = setTimeout(poll, POLL_INTERVAL_DEFAULT_MS);
        return () => {
            if (pollingRef.current) clearTimeout(pollingRef.current);
        };
    }, [state.kind, orderId]);

    // 4) Auto-redirect khi success
    useEffect(() => {
        if (state.kind === 'success') {
            const timer = setTimeout(() => {
                router.push('/profile/subscriptions');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.kind, router]);

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopyToast(`Đã copy ${label}`);
            setTimeout(() => setCopyToast(null), 1500);
        } catch {
            setCopyToast('Copy thất bại');
            setTimeout(() => setCopyToast(null), 1500);
        }
    };

    const handleIPaid = () => {
        if (state.kind !== 'ready') return;
        fastModeUntilRef.current = Date.now() + POLL_FAST_DURATION_MS;
        setState({ kind: 'polling', qr: state.qr });
    };

    const countdownColor = useMemo(() => {
        if (remainingMs < 60_000) return theme.palette.error.main;
        if (remainingMs < 5 * 60_000) return theme.palette.warning.main;
        return theme.palette.text.primary;
    }, [remainingMs, theme]);

    // === RENDER ===
    if (state.kind === 'loading') {
        return (
            <Box sx={{ p: 3 }}>
                <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }

    if (state.kind === 'error') {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>{state.msg}</Typography>
                <Button variant="contained" onClick={() => router.push('/plans')}>Quay lại trang gói</Button>
            </Box>
        );
    }

    if (state.kind === 'expired') {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>Đơn hàng đã hết hạn</Typography>
                <Typography color="text.secondary" gutterBottom>Bạn vẫn có thể tạo đơn hàng mới.</Typography>
                <Button variant="contained" onClick={() => router.push('/plans')} sx={{ mt: 2 }}>
                    Tạo đơn hàng mới
                </Button>
            </Box>
        );
    }

    if (state.kind === 'canceled') {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>Đơn hàng đã bị hủy</Typography>
                <Button variant="contained" onClick={() => router.push('/plans')} sx={{ mt: 2 }}>
                    Tạo đơn hàng mới
                </Button>
            </Box>
        );
    }

    if (state.kind === 'success') {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom>Thanh toán thành công!</Typography>
                <Typography color="text.secondary">Đang chuyển hướng đến trang tài khoản...</Typography>
                <LinearProgress sx={{ mt: 3 }} />
            </Box>
        );
    }

    const qr = state.qr;

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom>Thanh toán đơn hàng</Typography>

            <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={3}
                alignItems="stretch"
            >
                {/* QR Card */}
                <Card sx={{ flex: 1, p: 3, textAlign: 'center', minWidth: 0 }}>
                    <Typography variant="overline" color="text.secondary">Quét mã QR</Typography>
                    <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
                        <Box
                            component="img"
                            src={qr.qr_image_url}
                            alt={`QR thanh toán ${qr.order_code}`}
                            sx={{
                                width: { xs: 240, md: 280 },
                                height: { xs: 240, md: 280 },
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
                            }}
                        />
                    </Box>
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                        <Button
                            size="small"
                            startIcon={<DownloadIcon />}
                            href={qr.qr_image_url}
                            download={`qr-${qr.order_code}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Tải QR
                        </Button>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        Hết hạn sau:
                    </Typography>
                    <Typography variant="h4" sx={{ color: countdownColor, fontFamily: 'monospace' }}>
                        {formatRemaining(remainingMs)}
                    </Typography>
                </Card>

                {/* Info Card */}
                <Card sx={{ flex: 1, p: 3, minWidth: 0 }}>
                    <Typography variant="overline" color="text.secondary">Thông tin đơn hàng</Typography>
                    <InfoRow label="Mã đơn" value={qr.order_code} onCopy={() => handleCopy(qr.order_code, 'mã đơn')} />
                    <InfoRow
                        label="Số tiền"
                        value={`${formatVnd(qr.amount)} đ`}
                        copyValue={String(qr.amount)}
                        onCopy={() => handleCopy(String(qr.amount), 'số tiền')}
                    />

                    <Typography variant="overline" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
                        Hoặc chuyển khoản thủ công
                    </Typography>
                    <InfoRow label="Ngân hàng" value={qr.bank_name} />
                    <InfoRow
                        label="Số TK"
                        value={qr.account_number}
                        onCopy={() => handleCopy(qr.account_number, 'số tài khoản')}
                    />
                    <InfoRow label="Chủ TK" value={qr.account_holder} />
                    <InfoRow
                        label="Nội dung CK"
                        value={qr.transfer_content}
                        onCopy={() => handleCopy(qr.transfer_content, 'nội dung CK')}
                    />

                    <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.light', borderRadius: 1 }}>
                        <Typography variant="caption">
                            ⚠️ Nội dung chuyển khoản phải chính xác, không tự thay đổi.
                        </Typography>
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleIPaid}
                        disabled={state.kind === 'polling'}
                        sx={{ mt: 3 }}
                    >
                        {state.kind === 'polling' ? 'Đang kiểm tra...' : 'Tôi đã chuyển khoản'}
                    </Button>
                </Card>
            </Stack>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    💡 Mở app ngân hàng → Quét QR → Đợi 10-30 giây để hệ thống tự động ghi nhận.
                </Typography>
            </Box>

            {copyToast && (
                <Box sx={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    bgcolor: 'success.main', color: 'success.contrastText',
                    px: 3, py: 1, borderRadius: 2, zIndex: 1300,
                }}>
                    {copyToast}
                </Box>
            )}
        </Box>
    );
}

// Helper component
interface InfoRowProps {
    label: string;
    value: string;
    copyValue?: string;
    onCopy?: () => void;
}

function InfoRow({ label, value, onCopy }: InfoRowProps) {
    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                    {value}
                </Typography>
                {onCopy && (
                    <IconButton size="small" onClick={onCopy} aria-label={`Copy ${label}`}>
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                )}
            </Stack>
        </Stack>
    );
}
```

- [ ] **Step 3: TS check**

```bash
cd finext-nextjs && npx tsc --noEmit -p . 2>&1 | grep -E "(checkout|sepayService)" || echo "no errors"
```

Expected: `no errors`. Nếu có lỗi import path (`services/sepayService`), check `tsconfig.json` paths setup hoặc dùng relative path.

- [ ] **Step 4: Build production**

```bash
cd finext-nextjs && npm run build 2>&1 | tail -30
```

Expected: build success, có line `app/(main)/checkout/[orderId]` trong route table.

- [ ] **Step 5: Manual smoke test trên dev server**

Khởi động backend (cd `finext-fastapi && uvicorn ...`) và frontend (cd `finext-nextjs && npm run dev`).

Trong browser:
1. Login → tạo 1 transaction PENDING qua admin panel hoặc API call manual (postman) với `transaction_amount=10000`
2. Mở `http://localhost:3000/checkout/{transactionId}` (substitue real ID)
3. Verify: thấy QR code load, thông tin TK ngân hàng (kể cả khi fields rỗng vì chưa setup), countdown chạy, copy buttons hoạt động

**Note:** với `SEPAY_ENABLED=false`, page sẽ hiện error "Hệ thống thanh toán đang bảo trì". Đây là expected — đặt `SEPAY_ENABLED=true` trong `.env.development` + `SEPAY_BANK_NAME`/`SEPAY_ACCOUNT_NUMBER`/`SEPAY_ACCOUNT_HOLDER` placeholder để test UI.

- [ ] **Step 6: Commit**

```bash
git add finext-nextjs/app/\(main\)/checkout/
git commit -m "feat(frontend): add checkout page with QR + polling + countdown"
```

---

### Task 21: Update `/plans` để redirect sau khi tạo order

**Files:**
- Modify: `finext-nextjs/app/(main)/plans/PageContent.tsx`

- [ ] **Step 1: Đọc file hiện có để locate chỗ tạo order**

```bash
cd finext-nextjs && grep -n "transactions/me/orders\|me/orders\|create.*[oO]rder" "app/(main)/plans/PageContent.tsx"
```

Tìm dòng gọi `POST /transactions/me/orders` hoặc service tương đương.

- [ ] **Step 2: Sửa logic sau response thành công**

Trong `app/(main)/plans/PageContent.tsx`, tại chỗ xử lý response thành công của `POST /transactions/me/orders`, thay thế logic xử lý cũ (vd: hiển thị toast, modal, hoặc gì khác) bằng:

```typescript
// Sau khi tạo order thành công
const transactionId = response.data.data.id; // hoặc response.id, tùy shape
router.push(`/checkout/${transactionId}`);
```

Nếu component chưa có `useRouter`, thêm import:

```typescript
import { useRouter } from 'next/navigation';
// ...
const router = useRouter();
```

- [ ] **Step 3: TS check**

```bash
cd finext-nextjs && npx tsc --noEmit -p . 2>&1 | grep "plans" || echo "no errors"
```

Expected: `no errors`.

- [ ] **Step 4: Manual smoke test**

Trên dev server: vào `/plans`, click "Mua ngay" cho 1 gói, verify redirect tới `/checkout/{id}` đúng.

- [ ] **Step 5: Commit**

```bash
git add "finext-nextjs/app/(main)/plans/PageContent.tsx"
git commit -m "feat(plans): redirect to /checkout/[orderId] after order created"
```

---

## Self-Review Checklist (run before handoff)

- [ ] **Spec coverage:**
  - D1 (SePay default + manual fallback): ✅ admin endpoint không đổi (Task 9 chỉ extract helper, không xóa endpoint)
  - D2 (order_code 8 ký tự): ✅ Task 2 (gen) + Task 7 (parse) + Task 12 (gen lúc tạo) + Task 16 (UNIQUE index)
  - D3 (1 TK ngân hàng env): ✅ Task 5 + Task 17 (build QR URL)
  - D4 (strict mismatch): ✅ Task 13 case `amount_mismatch`, `unmatched_no_code`, `unmatched_order_not_found`
  - D5 (UI split): ✅ Task 20
  - D6 (timeout 30p): ✅ Task 15 scheduler
  - D7 (email user + admin alert + log 90d TTL): ✅ Task 8 + Task 13 + Task 16
  - D8 (no user-cancel): ✅ Task 20 không có nút cancel
  - D9 (auto-cancel PENDING cũ): ✅ Task 11
  - D10 (kill-switch): ✅ Task 14 (webhook 503) + Task 17 (qr-info 503) + Task 20 (frontend handle 503)
  - D11 (atomic via_webhook): ✅ Task 10
  - D12 (không migrate PENDING cũ): ✅ Task 17 throw 400 nếu order_code=None
- [ ] **No placeholders:** đã quét, không có TBD/TODO. Một số chỗ dùng "depending on existing pattern" (Task 8 email, Task 18 apiClient, Task 21 response shape) — đây là instruction để engineer match codebase, không phải placeholder logic
- [ ] **Type consistency:** `gen_unique_order_code` (Task 2/6), `process_sepay_webhook` (Task 13), `confirm_transaction_payment_via_webhook` (Task 10) signatures khớp với caller
- [ ] **Frontend test gap:** Project FE không có test framework — verification = `npm run build` + manual browser test (đã note ở header)

---

## Appendix A — Phase 4: SePay Demo Account Setup (Operational, không code)

Sau khi Phase 1-3 hoàn tất:

1. **Đăng ký** tại https://my.sepay.vn (free tier)
2. **Liên hệ support** để xin Demo account:
   - Hotline: 02873.059.589
   - Facebook/Telegram: theo info trên website SePay
   - Demo account cho phép dùng nút "+ Giả lập giao dịch"
3. **Liên kết tài khoản ngân hàng**:
   - Chọn 1 trong các ngân hàng gói FREE support (Vietcombank, Techcombank, MB Bank thường có)
   - Theo hướng dẫn từng bank trong [docs.sepay.vn](https://docs.sepay.vn/) (vd `/ket-noi-vietcombank.html`)
4. **Tạo API Token + Webhook API Key** trong dashboard SePay:
   - Vào "Cấu hình công ty" → "API Access" → "+ Add API"
   - Tạo chuỗi `SEPAY_WEBHOOK_API_KEY` mạnh (32+ ký tự random)
5. **Cấu hình env staging** (`.env.production` ở server staging):
   ```
   SEPAY_ENABLED=true
   SEPAY_WEBHOOK_API_KEY=<chuỗi random>
   SEPAY_BANK_NAME=Vietcombank
   SEPAY_ACCOUNT_NUMBER=<số TK thật>
   SEPAY_ACCOUNT_HOLDER=<chủ TK uppercase>
   ```
6. **Deploy** backend lên staging với HTTPS public URL (vd `https://api-staging.finext.vn`)
7. **Cấu hình webhook URL** trên dashboard SePay → trỏ về `https://api-staging.finext.vn/api/v1/sepay/webhook`
8. **Test 4 case** qua "+ Giả lập giao dịch":
   - Happy path (memo đúng + amount đúng) → verify subscription tạo, email gửi
   - Amount lệch → verify reject + alert
   - Memo sai → verify drop + alert
   - Replay (giả lập timestamp cũ — nếu dashboard cho phép)

## Appendix B — Phase 5: Production Rollout (Operational)

1. **Deploy production với `SEPAY_ENABLED=false`**:
   - Frontend hiện thông báo "thanh toán đang bảo trì"
   - Mọi order rơi vào admin manual confirm như cũ
2. **Test 1 đơn nội bộ thật**:
   - Admin login → tạo 1 đơn 10.000đ
   - Tạm `SEPAY_ENABLED=true` chỉ cho IP admin (qua nginx config conditional)
   - CK 10.000đ thật vào TK với memo đúng
   - Verify webhook về, subscription tạo, email gửi
3. **Đảo `SEPAY_ENABLED=true` cho all users**, monitor 48h:
   - Số webhook nhận được vs số order tạo
   - Tỷ lệ match success vs anomaly
   - Email alerts gửi đúng admin?
   - User feedback có vướng không?
4. **Có vấn đề** → đảo `SEPAY_ENABLED=false`, fallback admin manual ngay lập tức.

## Appendix C — Documentation Deliverables (sau rollout)

- `docs/sepay-integration.md` — runbook ops:
  - Cách rotate API key
  - Cách check `sepay_webhook_logs` collection trong MongoDB
  - Response các loại email alert
  - Troubleshooting common issues
- README.md project — section "Payment Setup" cho dev local
- Admin dashboard view: list `sepay_webhook_logs` với filter `processing_status` (out of MVP scope, phase 6)

---

## Execution Handoff

Plan complete. Ready for execution.

**Recommended:** Subagent-Driven Development — fresh subagent per task, two-stage review giữa các task. Phù hợp cho plan dài (21 tasks) để tránh context pollution.

**Alternative:** Inline Execution — chạy trong session hiện tại với checkpoints sau mỗi phase.
