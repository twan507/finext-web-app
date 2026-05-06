# SePay Auto-Payment Integration — Design Spec

**Date:** 2026-05-06
**Status:** Approved for implementation planning
**Scope:** Tích hợp SePay (gói FREE 50 giao dịch/tháng) để tự động xác nhận thanh toán cho `transactions` collection, song song với flow admin manual confirm hiện có.

---

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu

Cho phép user thanh toán đơn hàng (mua mới / gia hạn license) bằng cách **chuyển khoản qua QR động VietQR**, hệ thống **tự động xác nhận** trong vòng ~10-30 giây sau khi tiền vào tài khoản, KHÔNG cần admin can thiệp thủ công.

### 1.2. Bối cảnh hiện tại

Backend `finext-fastapi` đã có module `transactions` hoàn chỉnh:
- User tạo order qua `POST /transactions/me/orders` → trạng thái `pending`
- Admin confirm thủ công qua `PUT /transactions/admin/{id}/confirm-payment` → hàm [`confirm_transaction_payment_db`](finext-fastapi/app/crud/transactions.py#L408) làm full job: tạo subscription, gia hạn, update `user.subscription_id`, increment promotion usage

Frontend `finext-nextjs` **chưa có** trang checkout — user sau khi tạo order không có UI để thanh toán.

### 1.3. SePay là gì (tóm tắt)

SePay là dịch vụ **Open Banking + Webhook**, **KHÔNG** phải cổng thanh toán kiểu VNPay/Momo:
- Liên kết TK ngân hàng cá nhân/doanh nghiệp với SePay
- User CK trực tiếp vào TK của mình qua QR VietQR
- Ngân hàng báo có → SePay đẩy webhook về backend của app

**Tradeoff lớn:** SePay không có HMAC signature → bảo mật chỉ dựa vào IP whitelist (6 IPs) + API Key plain text qua HTTPS + strict amount/memo verification phía app.

---

## 2. Decisions Log (đã chốt với stakeholder)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **Migration path: SePay default + admin manual confirm fallback** | An toàn nhất; SePay không HMAC, cần safety net khi webhook chết |
| D2 | **Order code format: 8 ký tự `[A-Z2-9]` excluding `0/O/1/I/L`**, retry generate khi trùng, UNIQUE index DB enforce | Ngắn vừa đủ để gõ tay nếu cần; ~2.8 tỷ tổ hợp đủ unique; tránh ký tự dễ nhầm |
| D3 | **1 TK ngân hàng duy nhất** (env vars `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_HOLDER`) | Đơn giản nhất cho MVP; mở rộng sau khi cần |
| D4 | **Mismatch handling strict:** amount lệch → reject + alert admin; memo không có FNX → drop log + alert | Tránh tự động cấp subscription sai; admin xử thủ công các edge case |
| D5 | **UI checkout: split 2 cột (desktop) / stacked (mobile)** — QR + thông tin TK copy thủ công | Phục vụ cả mobile (quét) và desktop (copy info CK) |
| D6 | **Order timeout: 30 phút auto-cancel** qua scheduler | Đủ thời gian user mở app bank; không quá dài để treo DB |
| D7 | **Notification: U1 (email user khi paid) + A1 (email admin khi anomaly) + L2 (TTL log 90 ngày)** | Reuse email service có sẵn; 90 ngày đủ audit/dispute |
| D8 | **Không có nút user-cancel** — chỉ dùng auto-timeout 30p cho nhất quán | User feedback: "user không để ý việc cancel" |
| D9 | **Khi user tạo order mới, auto-cancel mọi PENDING order cũ của user đó** | Tránh ambiguity 2 PENDING song song; user luôn chỉ có tối đa 1 PENDING |
| D10 | **`SEPAY_ENABLED=false` kill-switch** — frontend hiện thông báo "đang bảo trì", disable nút Mua, fallback về admin manual | Soft-launch + emergency rollback |
| D11 | **Tạo hàm mới `confirm_transaction_payment_via_webhook()` (atomic)** thay vì sửa hàm cũ | Giảm regression cho admin flow đang chạy ổn |
| D12 | **Không migrate transaction PENDING cũ** — admin manual xử như cũ | Đơn giản; PENDING cũ ít, không đáng để bridge |

---

## 3. Architecture Overview

### 3.1. End-to-end flow

```
┌─────────┐    1. tạo order            ┌─────────────┐
│  User   │───────────────────────────▶│  FastAPI    │
│ (web)   │   POST /transactions/      │  Backend    │
│         │     me/orders              │             │
└─────────┘                            └──────┬──────┘
     │                                        │ 2. gen order_code (FNXxxxxx)
     │                                        │    auto-cancel PENDING cũ
     │  3. redirect /checkout/{id}            │    insert PENDING
     │                                        ▼
     │                                  ┌─────────────┐
     │                                  │  MongoDB    │
     │  4. GET /transactions/me/{id}    │ transactions│
     │     /qr-info                     └─────────────┘
     ▼                                        ▲
┌─────────┐    5. show QR + bank info         │
│Checkout │◀─────── (response)─────────────────┘
│  Page   │
│         │    6. polling status mỗi 5s
└─────────┘    GET /transactions/me/{id}/status
     │
     │ 7. user quét QR → CK
     ▼
┌─────────┐    8. ngân hàng báo có    ┌─────────────┐
│  Bank   │──────────────────────────▶│   SePay     │
│         │                            │             │
└─────────┘                            └──────┬──────┘
                                              │ 9. POST /sepay/webhook
                                              │    Authorization: Apikey ...
                                              ▼
                                        ┌─────────────┐
                                        │  FastAPI    │
                                        │/sepay/webhook│ 10. verify IP+key
                                        └──────┬──────┘     parse content (FNX...)
                                               │            check amount strict
                                               ▼
                                        ┌─────────────┐
                                        │ confirm_    │ 11. atomic update PENDING→SUCCEEDED
                                        │ transaction_│     tạo subscription
                                        │ payment_via_│     update user.subscription_id
                                        │ webhook()   │     send email user
                                        └─────────────┘     log → sepay_webhook_logs
```

### 3.2. Components map

| Layer | Component | Loại | Ghi chú |
|---|---|---|---|
| Backend | `app/utils/sepay_security.py` | Mới | Pure functions: gen order_code, verify IP, verify API key |
| Backend | `app/schemas/sepay.py` | Mới | Webhook payload, log model, QR info response |
| Backend | `app/crud/sepay.py` | Mới | `process_sepay_webhook` pipeline, parse memo, alert |
| Backend | `app/routers/sepay_webhooks.py` | Mới | `POST /sepay/webhook` |
| Backend | `app/schemas/transactions.py` | Sửa | Thêm 4 field: `order_code`, `payment_provider`, `paid_at`, `sepay_transaction_id` |
| Backend | `app/crud/transactions.py` | Sửa | Gen order_code, auto-cancel PENDING cũ, hàm atomic mới |
| Backend | `app/routers/transactions.py` | Sửa | Thêm 2 endpoint: `/me/{id}/qr-info`, `/me/{id}/status` |
| Backend | `app/core/config.py` | Sửa | Thêm 9 env vars SePay |
| Backend | `app/core/scheduler.py` | Sửa | Thêm job auto-cancel PENDING quá 30p |
| Backend | `app/utils/email.py` | Sửa | 2 template: payment success, admin anomaly alert |
| Backend | `app/main.py` | Sửa | Register sepay_webhooks router |
| Frontend | `app/(main)/checkout/[orderId]/page.tsx` | Mới | Server component, set metadata |
| Frontend | `app/(main)/checkout/[orderId]/PageContent.tsx` | Mới | UI checkout split layout + polling |
| Frontend | `services/sepayService.ts` | Mới | API client cho qr-info, status |
| Frontend | `app/(main)/plans/PageContent.tsx` | Sửa | Sau khi tạo order → redirect `/checkout/{id}` |
| DB | Index `transactions.order_code` UNIQUE sparse | Migration | Tạo lúc startup |
| DB | Index `transactions.(payment_status, created_at)` | Migration | Phục vụ scheduler |
| DB | Collection `sepay_webhook_logs` + indexes (UNIQUE `sepay_transaction_id`, TTL 90d trên `received_at`) | Migration | Tạo lúc startup |

### 3.3. Quyết định kiến trúc

- **Synchronous webhook handler:** gói FREE 50 tx/tháng = ~1.7 tx/ngày, không cần queue/worker. Webhook về → xử lý sync → return 200.
- **Idempotency 2 lớp:** UNIQUE index `sepay_webhook_logs.sepay_transaction_id` + atomic `findOneAndUpdate` trên `transactions` (PENDING → SUCCEEDED).
- **Reuse logic confirm hiện có:** webhook chỉ wrap thêm match order_code + atomic guard; logic tạo subscription/gia hạn/email reuse 100%.
- **Admin manual confirm giữ nguyên** làm fallback — webhook và admin là 2 caller độc lập của cùng business logic core.

---

## 4. Database Schema

### 4.1. Sửa collection `transactions` — thêm 4 field

```python
# app/schemas/transactions.py — thêm vào TransactionBase

order_code: Optional[str] = Field(
    default=None,
    description="Mã đối soát ngắn (vd FNXAB23CD9). Unique. Dùng làm memo CK + parse khi webhook về."
)
payment_provider: Optional[str] = Field(
    default=None,
    description="'sepay' (auto) | 'manual' (admin xác nhận) | None (chưa xác định)"
)
paid_at: Optional[datetime] = Field(
    default=None,
    description="Thời điểm thanh toán thành công. None nếu chưa paid."
)
sepay_transaction_id: Optional[int] = Field(
    default=None,
    description="ID giao dịch phía SePay (field 'id' trong webhook payload)."
)
```

### 4.2. Index mới

```python
# Tại startup, migration script:
await db.transactions.create_index(
    "order_code",
    unique=True,
    sparse=True,  # NULL không bị check unique
)
await db.transactions.create_index([
    ("payment_status", 1),
    ("created_at", 1),
])  # Phục vụ scheduler quét PENDING quá hạn
```

### 4.3. Migration data cũ

- Transaction `succeeded` cũ: để nguyên (4 field mới = None/null)
- Transaction `pending` cũ: **không** gen ngược order_code; admin manual xử như cũ (decision D12)

### 4.4. Tạo collection mới `sepay_webhook_logs`

```python
class SePayWebhookLog(BaseModel):
    id: PyObjectId = Field(alias="_id")
    sepay_transaction_id: int        # 'id' từ webhook payload
    received_at: datetime
    source_ip: str

    raw_payload: dict                # Lưu toàn bộ để audit/debug

    # Parsed fields
    gateway: str
    transfer_amount: float
    transfer_type: str               # "in" | "out"
    content: Optional[str] = None
    reference_code: Optional[str] = None
    transaction_date: Optional[datetime] = None

    # Match result
    matched_order_code: Optional[str] = None
    matched_transaction_id: Optional[PyObjectId] = None
    processing_status: str
    # 'success' | 'duplicate' | 'unmatched_no_code'
    # | 'unmatched_order_not_found' | 'amount_mismatch'
    # | 'wrong_status' | 'auth_failed' | 'replay_rejected'
    # | 'ignored_outbound' | 'error'
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None
```

**Indexes:**
- `sepay_transaction_id` UNIQUE — chống xử lý trùng webhook
- `received_at` với `expireAfterSeconds: 7776000` (90 ngày TTL — D7)
- `processing_status` — phục vụ query alert/dashboard

### 4.5. Env vars mới

Thêm vào `.env.development` và `.env.production`:

```bash
SEPAY_ENABLED=true                    # Kill-switch (D10)
SEPAY_API_TOKEN=                      # Chưa dùng MVP, để sẵn
SEPAY_WEBHOOK_API_KEY=                # Chuỗi tự đặt, SePay gửi trong header
SEPAY_BANK_NAME=Vietcombank           # Theo qr.sepay.vn/banks.json
SEPAY_ACCOUNT_NUMBER=0123456789
SEPAY_ACCOUNT_HOLDER=NGUYEN VAN A
SEPAY_ALLOWED_IPS=172.236.138.20,172.233.83.68,171.244.35.2,151.158.108.68,151.158.109.79,103.255.238.139
SEPAY_ORDER_TIMEOUT_MINUTES=30        # D6
SEPAY_FREE_TIER_MONTHLY_LIMIT=50
```

---

## 5. Backend Components Detail

### 5.1. `app/utils/sepay_security.py` (mới)

```python
import secrets
import string
from fastapi import HTTPException, Request

ORDER_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # exclude 0,O,1,I,L
ORDER_CODE_LENGTH = 8
ORDER_CODE_PREFIX = "FNX"

def generate_order_code() -> str:
    """Random short code, format FNX + 8 ký tự [A-Z2-9]\\{0OILI}."""
    suffix = "".join(secrets.choice(ORDER_CODE_CHARSET) for _ in range(ORDER_CODE_LENGTH))
    return f"{ORDER_CODE_PREFIX}{suffix}"

async def gen_unique_order_code(db, max_retries: int = 5) -> str:
    """Generate + check trùng DB + retry. Raise nếu hết retry."""
    for _ in range(max_retries):
        code = generate_order_code()
        existing = await db.transactions.find_one({"order_code": code}, {"_id": 1})
        if not existing:
            return code
    raise RuntimeError(f"Không thể tạo order_code unique sau {max_retries} lần thử")

def verify_source_ip(request: Request, allowed_ips: list[str]) -> str:
    """Check IP whitelist. Parse X-Forwarded-For nếu có. Raise 403 nếu không hợp lệ."""
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    if client_ip not in allowed_ips:
        raise HTTPException(status_code=403, detail="Forbidden")
    return client_ip

def verify_api_key(request: Request, expected: str) -> None:
    """Constant-time compare API key trong header Authorization: Apikey ..."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Apikey "):
        raise HTTPException(status_code=401, detail="Missing Apikey header")
    received = auth_header[len("Apikey "):]
    if not secrets.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")
```

### 5.2. `app/schemas/sepay.py` (mới)

```python
class SePayWebhookPayload(BaseModel):
    """Schema parse payload SePay gửi về."""
    id: int
    gateway: str
    transactionDate: str         # "YYYY-MM-DD HH:MM:SS"
    accountNumber: Optional[str] = None
    code: Optional[str] = None   # SePay không dùng, deprecated
    content: Optional[str] = ""
    transferType: str            # "in" | "out"
    transferAmount: float
    accumulated: Optional[float] = None
    subAccount: Optional[str] = None
    referenceCode: Optional[str] = None
    description: Optional[str] = ""

class SePayWebhookLog(BaseModel):
    # ... đã định nghĩa ở section 4.4

class QrInfoResponse(BaseModel):
    """Response cho GET /transactions/me/{id}/qr-info"""
    order_code: str
    qr_image_url: str            # https://qr.sepay.vn/img?...
    bank_name: str
    account_number: str
    account_holder: str
    transfer_content: str        # = order_code, copy vào memo CK
    amount: float
    expires_at: datetime         # created_at + 30 phút

class TransactionStatusResponse(BaseModel):
    """Response cho GET /transactions/me/{id}/status — polling"""
    transaction_id: PyObjectId
    payment_status: PaymentStatusEnum
    paid_at: Optional[datetime]
    subscription_id: Optional[PyObjectId]
```

### 5.3. `app/crud/sepay.py` (mới) — webhook processing pipeline

```python
async def process_sepay_webhook(
    db: AsyncIOMotorDatabase,
    payload: SePayWebhookPayload,
    source_ip: str,
) -> SePayWebhookLog:
    """
    Pipeline xử lý webhook (sync, idempotent):

    1. Insert log entry với processing_status='pending' vào sepay_webhook_logs
       UNIQUE index trên sepay_transaction_id sẽ throw nếu duplicate
       → catch DuplicateKeyError, return log cũ với status='duplicate'

    2. Skip nếu transferType != 'in' → status='ignored_outbound'

    3. Replay protection: transactionDate quá cũ (>48h) → status='replay_rejected', alert

    4. Parse order_code từ content (regex r'(FNX[A-Z2-9]{8})', case-insensitive)
       Không tìm thấy → status='unmatched_no_code', alert admin, return

    5. Tìm transaction by order_code
       Không tồn tại → status='unmatched_order_not_found', alert admin, return

    6. Strict amount check (TRƯỚC khi atomic update):
       Nếu transferAmount != txn.transaction_amount
       → status='amount_mismatch', alert admin, return (transaction vẫn PENDING)

    7. Pre-check status (read-only, để phân biệt duplicate vs wrong_status):
       - txn.payment_status == 'succeeded' và txn.sepay_transaction_id == payload.id
         → status='duplicate', return (idempotent — webhook đã được xử lý)
         (Trường hợp này hiếm vì lớp 1 UNIQUE index ở step 1 đã catch, nhưng giữ để defense-in-depth)
       - txn.payment_status == 'succeeded' và sepay_transaction_id khác
         → status='wrong_status', alert (CK trùng vào đơn đã paid bằng nguồn khác)
       - txn.payment_status == 'canceled' → status='wrong_status', alert
       - txn.payment_status == 'pending' → tiếp tục step 8

    8. Atomic transition PENDING → SUCCEEDED + apply side effects qua
       confirm_transaction_payment_via_webhook(db, txn.id, payload.id, parsed_date):
       - findOneAndUpdate({_id, status: 'pending'}, {$set: status='succeeded',
         sepay_transaction_id, payment_provider='sepay', paid_at, updated_at})
       - Nếu result is None (race lost — webhook khác đã update giữa step 7 và 8)
         → status='wrong_status', alert, return
       - Else: tạo subscription mới (NEW_PURCHASE) hoặc update expiry (RENEWAL),
         update user.subscription_id, increment promotion usage nếu có
         (reuse helper _apply_payment_side_effects extract từ logic confirm hiện có)

    9. Send email user "thanh toán thành công"
       Send email admin nếu count tháng này >= 40 (cảnh báo gần ngưỡng FREE)
       Send email admin nếu count >= 50 (vượt ngưỡng)

    10. Log status='success', processed_at=now, return
    """

async def parse_order_code_from_content(content: str) -> Optional[str]:
    """Regex extract FNX + 8 ký tự [A-Z2-9]. Return None nếu không match."""

async def alert_admin_for_anomaly(db, log_entry, reason: str) -> None:
    """Gửi email tới ADMIN_EMAIL với link đến webhook log entry."""

async def get_monthly_webhook_count(db) -> int:
    """Đếm số webhook 'success' trong tháng hiện tại."""
```

### 5.4. `app/routers/sepay_webhooks.py` (mới)

```python
router = APIRouter(tags=["sepay"])

@router.post("/sepay/webhook", status_code=200)
async def receive_sepay_webhook(
    request: Request,
    payload: SePayWebhookPayload,
    db: AsyncIOMotorDatabase = Depends(...),
):
    """
    Endpoint SePay gọi tới. KHÔNG có require_permission vì external.

    1. Check SEPAY_ENABLED=false → return 503 (D10)
    2. verify_source_ip() — fail → 403 + log status='auth_failed'
    3. verify_api_key() — fail → 401 + log status='auth_failed'
    4. process_sepay_webhook(db, payload, source_ip)
    5. Luôn return {"success": true} với HTTP 200, kể cả khi unmatched
       → SePay không retry, không spam queue.
       Exception thật sự (DB down) → 500, để SePay retry (Fibonacci 7 lần).
    """
```

### 5.5. Sửa `app/crud/transactions.py`

**Thay đổi tối thiểu:**

```python
# 1. Thêm gen order_code lúc tạo transaction
async def _prepare_transaction_data(...) -> dict:
    # ... logic hiện có giữ nguyên ...
    return {
        ...,
        "order_code": await gen_unique_order_code(db),  # MỚI
        "payment_provider": None,
        "paid_at": None,
        "sepay_transaction_id": None,
    }

# 2. Auto-cancel PENDING cũ khi user tạo order mới (D9)
async def create_transaction_by_user_db(db, transaction_data, current_user):
    # MỚI: auto-cancel mọi PENDING của user này trước khi insert
    await db.transactions.update_many(
        {
            "buyer_user_id": ObjectId(str(current_user.id)),
            "payment_status": "pending",
        },
        {
            "$set": {
                "payment_status": "canceled",
                "updated_at": datetime.now(timezone.utc),
                "notes": "[Auto-canceled: user tạo đơn mới]",
            }
        },
    )
    # ... logic hiện có ...

# 3. Hàm mới atomic cho webhook caller
async def confirm_transaction_payment_via_webhook(
    db: AsyncIOMotorDatabase,
    transaction_id: PyObjectId,
    sepay_transaction_id: int,
    paid_at: datetime,
) -> Optional[TransactionInDB]:
    """
    Phiên bản atomic của confirm_transaction_payment_db dành cho webhook.
    Khác biệt:
    - Atomic findOneAndUpdate guard (chỉ update nếu vẫn PENDING)
    - Set payment_provider='sepay', sepay_transaction_id, paid_at
    - KHÔNG nhận TransactionPaymentConfirmationRequest (không có override)
    - Return None nếu race lost (caller log status='wrong_status')

    Reuse 100% logic tạo subscription/gia hạn của hàm cũ — extract thành
    helper _apply_payment_side_effects(db, transaction) dùng chung cho cả
    admin manual confirm và webhook confirm.
    """

# 4. Sửa confirm_transaction_payment_db (admin flow):
#    - Set payment_provider='manual', paid_at=dt_now
#    - Extract logic tạo sub/gia hạn ra _apply_payment_side_effects()
#    - Logic chính KHÔNG đổi
```

### 5.6. Sửa `app/routers/transactions.py` — thêm 2 endpoint user

```python
@router.get("/me/{transaction_id}/qr-info", response_model=...QrInfoResponse,
            dependencies=[Depends(require_permission("transaction", "read_own"))])
async def get_qr_info_for_my_order(transaction_id, current_user, db):
    """
    User gọi sau khi tạo order để lấy QR + thông tin TK.
    - Verify ownership (buyer_user_id == current_user.id) → 403 nếu không phải
    - Verify status == 'pending' → 400 nếu khác
    - Verify SEPAY_ENABLED → 503 nếu false
    - Build QR URL: https://qr.sepay.vn/img?acc={ACCOUNT_NUMBER}&bank={BANK_NAME}
                    &amount={amount}&des={order_code}
    - Return QrInfoResponse với expires_at = created_at + 30 phút
    """

@router.get("/me/{transaction_id}/status", response_model=...TransactionStatusResponse,
            dependencies=[Depends(require_permission("transaction", "read_own"))])
async def get_my_order_status(transaction_id, current_user, db):
    """
    Endpoint polling — frontend gọi mỗi 5s.
    Verify ownership, return payment_status + paid_at + subscription_id.
    Cache-Control: no-store.
    """
```

### 5.7. Sửa `app/core/scheduler.py` — auto-cancel job

```python
@scheduler.scheduled_job('interval', minutes=5)
async def auto_cancel_expired_pending_orders():
    """
    Mỗi 5 phút quét transaction PENDING > SEPAY_ORDER_TIMEOUT_MINUTES
    → đặt status='canceled', notes += '[Auto-canceled: timeout 30p]'.
    Dùng index (payment_status, created_at) cho hiệu suất.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=SEPAY_ORDER_TIMEOUT_MINUTES)
    await db.transactions.update_many(
        {"payment_status": "pending", "created_at": {"$lt": cutoff}},
        {"$set": {"payment_status": "canceled", "updated_at": datetime.now(timezone.utc),
                  "notes": "[Auto-canceled: timeout 30p]"}},
    )
```

### 5.8. Sửa `app/utils/email.py` — 2 template mới

```python
async def send_payment_success_email(user_email: str, transaction: TransactionInDB) -> None:
    """Email user khi paid thành công.
    Subject: '[Finext] Thanh toán thành công cho đơn hàng {order_code}'
    Body: gói license, duration, paid_at, link đến /profile/subscriptions"""

async def send_payment_anomaly_alert(log: SePayWebhookLog, reason: str) -> None:
    """Email admin khi có anomaly (C1/C3/C4/IP lạ/quota gần đầy).
    To: ADMIN_EMAIL
    Subject: '[Finext SePay] {reason} — webhook #{sepay_transaction_id}'
    Body: full payload, parsed fields, link đến admin transactions UI"""
```

---

## 6. Frontend Components Detail

### 6.1. Cấu trúc mới

```
finext-nextjs/
├── app/(main)/checkout/
│   └── [orderId]/
│       ├── page.tsx              # Server: set metadata "Thanh toán | Finext"
│       └── PageContent.tsx       # Client: UI + polling, ~250 dòng
├── services/
│   └── sepayService.ts           # Typed API client
└── app/(main)/plans/
    └── PageContent.tsx           # Sửa: redirect /checkout/{id} sau create order
```

### 6.2. `services/sepayService.ts`

```typescript
import { apiClient } from "./apiClient";

export interface QrInfo {
  order_code: string;
  qr_image_url: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  transfer_content: string;
  amount: number;
  expires_at: string;       // ISO
}

export interface TransactionStatus {
  transaction_id: string;
  payment_status: "pending" | "succeeded" | "canceled";
  paid_at: string | null;
  subscription_id: string | null;
}

export async function getQrInfo(transactionId: string): Promise<QrInfo>;
export async function getTransactionStatus(transactionId: string): Promise<TransactionStatus>;
```

### 6.3. Layout checkout page (D5: split desktop / stacked mobile)

```
┌────────────────────────────────────────────────────────────────┐
│  [Breadcrumb]  Trang chủ / Thanh toán đơn hàng                 │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────────────┐ │
│  │                      │    │ THÔNG TIN ĐƠN HÀNG           │ │
│  │   QR CODE            │    │ Mã đơn: FNXAB23CD9 [copy]    │ │
│  │   (~280x280px)       │    │ Gói: ADVANCED 30 ngày        │ │
│  │                      │    │ Số tiền: 199.000 đ [copy]    │ │
│  │  [Tải QR]            │    │                              │ │
│  │  ⏱ Hết hạn: 29:42    │    │ HOẶC CHUYỂN KHOẢN THỦ CÔNG   │ │
│  │                      │    │ Ngân hàng: Vietcombank       │ │
│  │                      │    │ Số TK: 0123456789  [copy]    │ │
│  │                      │    │ Chủ TK: NGUYEN VAN A         │ │
│  │                      │    │ Nội dung: FNXAB23CD9 [copy]  │ │
│  │                      │    │                              │ │
│  │                      │    │ ⚠️ Nội dung CK phải chính xác │ │
│  │                      │    │                              │ │
│  │                      │    │ [Tôi đã chuyển khoản]        │ │
│  └──────────────────────┘    └──────────────────────────────┘ │
│                                                                │
│  💡 Mở app ngân hàng → Quét QR → Đợi 10-30 giây ghi nhận      │
└────────────────────────────────────────────────────────────────┘
```

### 6.4. State machine (PageContent.tsx)

```typescript
type CheckoutState =
  | { kind: "loading" }
  | { kind: "ready"; qr: QrInfo }
  | { kind: "polling"; qr: QrInfo }      // user bấm "Tôi đã CK" — poll nhanh hơn
  | { kind: "success"; subId: string }
  | { kind: "expired" }
  | { kind: "canceled" }
  | { kind: "error"; msg: string };
```

### 6.5. Polling (dùng `services/pollingClient.ts` có sẵn)

- Default: poll `/me/{id}/status` mỗi **5 giây**
- Sau "Tôi đã chuyển khoản": tăng tốc lên **2 giây** trong 60 giây, sau đó về 5s
- Stop khi: `payment_status != "pending"` / page unmount / hết hạn 30p
- `paid_at != null` → `kind: "success"` → toast "Thanh toán thành công, đang chuyển hướng..." → 3s sau `router.push("/profile/subscriptions")`

### 6.6. Countdown

- Compute từ `qr.expires_at`, update mỗi giây bằng `setInterval`
- Còn <5 phút → màu cam (`warning.main`), <1 phút → đỏ (`error.main`)
- Hết hạn → `kind: "expired"` → button "Tạo đơn hàng mới" redirect `/plans`

### 6.7. Copy buttons

4 nút copy: `order_code`, `amount`, `account_number`, `transfer_content`. Dùng `navigator.clipboard.writeText` + toast "Đã copy".

### 6.8. KHÔNG có

- **Nút user-cancel** (D8)
- Multi-step wizard
- Multi-bank selector

### 6.9. Tích hợp MUI/theme

- Components: `Card`, `Button`, `IconButton`, `Stack`, `Typography`, `Skeleton` (loading), `LinearProgress` (countdown)
- Memory `feedback_mui_sx_units.md`: chú ý `sx={{ width: 1 }}` = 100%, không phải 1px
- Memory `feedback_tabs_vs_breadcrumb.md`: dùng Breadcrumb cho navigation (NewsBreadcrumb pattern)
- Memory `feedback_guide_content_tone.md`: ngôn ngữ thân thiện, không jargon kỹ thuật
- Memory `feedback_membership_tier_wording.md`: nếu mention tier, dùng "yêu cầu gói hội viên phù hợp"

### 6.10. Responsive

- Desktop ≥900px: split 2 cột (QR trái, info phải)
- Mobile <900px: stacked, QR trên, info dưới
- Breakpoint dùng MUI `useMediaQuery(theme.breakpoints.down('md'))`

### 6.11. SePay disabled state (D10)

Khi backend trả 503 (`SEPAY_ENABLED=false`):
- `/checkout/{id}` page hiện thông báo "Hệ thống thanh toán tự động đang bảo trì, vui lòng liên hệ admin để được hỗ trợ"
- `/plans` page disable nút "Mua ngay", hiện tooltip giải thích

---

## 7. Security

### 7.1. Threat model

| # | Threat | Mitigation |
|---|---|---|
| T1 | Attacker giả webhook → tạo confirm giả | IP whitelist + API key |
| T2 | API key bị rò rỉ qua log/git | HTTPS only, không log header, rotatable |
| T3 | Replay webhook cũ hợp lệ | UNIQUE index `sepay_transaction_id` + check `payment_status` |
| T4 | Race condition: 2 webhook concurrent cho cùng transaction | Atomic `findOneAndUpdate` PENDING→SUCCEEDED |
| T5 | Attacker quét order_code → trace volume | order_code random ~2.8 tỷ tổ hợp, không sequential |
| T6 | Đoán order_code → gọi `/me/{id}/qr-info` lấy info người khác | Auth + ownership check `buyer_user_id == current_user.id` |
| T7 | Timing attack vào API key | `secrets.compare_digest` constant-time |
| T8 | DoS endpoint webhook | IP whitelist + rate limit ở reverse proxy (phase 2 ops) |
| T9 | SePay bị compromise → gửi webhook giả | Strict amount check là defense-in-depth cuối |

### 7.2. IP Whitelist

**Application-level** (bắt buộc, ở `verify_source_ip` middleware):

```python
forwarded = request.headers.get("x-forwarded-for", "")
client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
if client_ip not in SEPAY_ALLOWED_IPS: raise HTTPException(403)
```

**6 IPs SePay** (cấu hình trong env `SEPAY_ALLOWED_IPS`):
```
172.236.138.20, 172.233.83.68, 171.244.35.2,
151.158.108.68, 151.158.109.79, 103.255.238.139
```

**Reverse proxy level** (khuyến nghị ops, không phải code change): nginx/cloudflare firewall rule chỉ allow 6 IPs vào `/sepay/webhook`.

**Lưu ý:** Nếu deploy sau load balancer (Vercel/Cloudflare), config `forwarded_allow_ips` ở Uvicorn để parse `X-Forwarded-For` đúng.

### 7.3. API Key Verification

- `verify_api_key` dùng `secrets.compare_digest` (constant-time)
- API key **không** log plaintext bất cứ đâu
- Lưu trong `.env`, `.gitignore` đã có
- Rotation SOP: update env → restart app → cập nhật trên dashboard SePay

### 7.4. Idempotency

**Lớp 1 — UNIQUE index DB:**
```python
await db.sepay_webhook_logs.create_index("sepay_transaction_id", unique=True)
```
Insert webhook trùng → `DuplicateKeyError` → return success (idempotent).

**Lớp 2 — Atomic state transition:**
```python
result = await db.transactions.find_one_and_update(
    {"_id": ObjectId(txn.id), "payment_status": "pending"},
    {"$set": {...}},
    return_document=ReturnDocument.AFTER,
)
if result is None:
    # race lost → status='wrong_status'
```

→ Hai webhook concurrent: chỉ 1 thắng, cái kia bỏ qua, không double-create subscription.

### 7.5. Replay protection

```python
if (now - parse_dt(payload.transactionDate)).total_seconds() > 48 * 3600:
    log.processing_status = "replay_rejected"
    return
```

### 7.6. Authorization endpoints user-facing

`/transactions/me/{id}/qr-info` và `/status`:
- `require_permission("transaction", "read_own")` dependency
- Plus: ownership check `buyer_user_id == current_user.id`, raise 403 nếu khác

### 7.7. Logging hygiene

**Log:**
- Raw payload (trừ Authorization header)
- Source IP, response status
- Processing status code

**KHÔNG log:**
- API key
- SEPAY_API_TOKEN

### 7.8. Rate limiting

**Defer phase 2 ops** — IP whitelist đã đủ chặn 99% abuse cho MVP. Note vào tech debt:
- `/sepay/webhook`: 60 req/phút
- `/me/{id}/status`: 30 req/phút/user
- `/me/orders`: 10 req/phút/user

### 7.9. Quota monitoring

```python
# Trong process_sepay_webhook sau khi success
count = await get_monthly_webhook_count(db)
if count == 40:
    await send_admin_alert(f"SePay quota đã dùng {count}/50 tháng này")
elif count >= 50:
    await send_admin_alert(f"⚠️ SePay quota vượt FREE: {count}/50 — sẽ tính phí")
```

---

## 8. Testing Strategy

### 8.1. Unit tests (pure functions)

| File | Tests |
|---|---|
| `tests/utils/test_sepay_security.py` | `generate_order_code()` không chứa `0/O/1/I/L`, đúng độ dài 8, đúng prefix `FNX`, đúng charset |
| | `verify_api_key()` reject sai key, accept đúng, không crash khi header thiếu |
| | `verify_source_ip()` reject IP ngoài whitelist, accept hợp lệ, parse `X-Forwarded-For` đúng |
| `tests/crud/test_sepay_parse.py` | `parse_order_code_from_content("Chuyen tien FNXAB23CD9")` → `"FNXAB23CD9"` |
| | Match case-insensitive |
| | Memo có 2 mã FNX → lấy mã đầu tiên (regex `findall`[0]) |
| | Content chứa `FNX` không đúng format → return None |

### 8.2. Integration tests (MongoDB test instance)

| File | Tests |
|---|---|
| `tests/crud/test_sepay_webhook.py` | **Happy path:** webhook hợp lệ → transaction succeeded, subscription tạo, log success |
| | **Idempotent:** 2 webhook trùng `sepay_transaction_id` → lần 2 status duplicate, không double-create |
| | **Race condition:** 2 concurrent → atomic guard chỉ 1 thắng |
| | **C1 unmatched_order_not_found:** order_code không tồn tại → log + alert |
| | **C2 wrong_status:** transaction đã succeeded (sepay_transaction_id khác) → log + alert |
| | **C3 amount_mismatch:** lệch 1 đồng → reject, transaction vẫn pending, alert |
| | **C4 unmatched_no_code:** memo không có FNX → log + alert |
| | **Replay:** transactionDate >48h → replay_rejected |
| | **Wrong IP/key:** 401/403, log auth_failed |
| `tests/crud/test_order_code.py` | `gen_unique_order_code` retry khi trùng |
| | Raise sau N retry |
| | UNIQUE index DB enforce duplicate |
| `tests/crud/test_transactions_sepay.py` | `create_transaction_by_user_db` auto-cancel PENDING cũ trước khi tạo mới (D9) |
| | Order PENDING > 30p → scheduler cancel |

### 8.3. End-to-end manual với SePay Demo account

1. Tạo order qua frontend → `/checkout/{id}`
2. Dashboard SePay → "+ Giả lập giao dịch" → CK đúng amount + memo
3. Verify webhook đến, log success, subscription tạo, email gửi user, frontend redirect
4. Lặp với amount lệch → verify reject + alert, không cấp subscription
5. Lặp với memo sai → verify drop + alert

### 8.4. Production smoke test

- CK thật 10.000đ với memo đúng → auto-confirm <30s
- CK 11.000đ (lệch) → reject + alert
- Test với 2-3 ngân hàng phổ biến (VCB, Techcombank, MB) — biết bank nào webhook về nhanh/chậm

---

## 9. Rollout Plan — 5 Phase

### Phase 1: Foundation (2-3 ngày)

**Files mới/sửa:**
- `app/utils/sepay_security.py` (mới)
- `app/schemas/sepay.py` (mới — chỉ webhook payload + response, chưa log)
- `app/schemas/transactions.py` (sửa — thêm 4 field)
- `app/core/config.py` (sửa — thêm env vars)
- `tests/utils/test_sepay_security.py`

**Verify:** unit tests pass, env vars load đúng, schema không break existing.

### Phase 2: Webhook + CRUD logic (3-4 ngày)

**Files mới/sửa:**
- `app/schemas/sepay.py` (sửa — thêm `SePayWebhookLog`)
- `app/crud/sepay.py` (mới)
- `app/routers/sepay_webhooks.py` (mới)
- `app/crud/transactions.py` (sửa — gen order_code, auto-cancel PENDING cũ, hàm atomic)
- `app/utils/email.py` (sửa — 2 template)
- `app/core/scheduler.py` (sửa — auto-cancel job)
- `app/main.py` (sửa — register router)
- DB migration script
- `tests/crud/test_sepay_webhook.py`, `tests/crud/test_order_code.py`, `tests/crud/test_transactions_sepay.py`

**Verify:** integration tests pass, manual test với mock payload qua curl/Postman.

### Phase 3: Frontend checkout page (2-3 ngày)

**Files mới/sửa:**
- `services/sepayService.ts` (mới)
- `app/(main)/checkout/[orderId]/page.tsx` (mới)
- `app/(main)/checkout/[orderId]/PageContent.tsx` (mới)
- `app/(main)/plans/PageContent.tsx` (sửa — redirect)
- Backend: thêm endpoint `/me/{id}/qr-info`, `/me/{id}/status`

**Verify:**
- Tạo order → redirect đúng
- QR hiển thị đúng (quét bằng app bank thật → app điền đúng amount + memo)
- Polling hoạt động (giả lập confirm bằng admin manual → frontend auto-redirect)
- Countdown đúng, expired UI hoạt động
- Responsive desktop + mobile
- Test trên browser thật theo CLAUDE.md

### Phase 4: SePay Demo integration (1-2 ngày)

**Steps:**
1. Đăng ký `my.sepay.vn` (free)
2. Liên hệ support xin Demo account (hotline 02873.059.589 / Facebook / Telegram)
3. Liên kết TK ngân hàng (chọn bank gói FREE support)
4. Tạo API key webhook trên dashboard
5. Cấu hình env staging: `SEPAY_*` vars
6. Deploy backend lên staging, expose `/sepay/webhook` qua HTTPS
7. Cấu hình webhook URL trên dashboard SePay → trỏ về staging
8. Test "+ Giả lập giao dịch" cho 4 case (happy + C3 + C4 + replay)
9. Kiểm tra log: bank nào CK về nhanh/chậm

**Verify:** 4 case all expected, alert email gửi đúng admin.

### Phase 5: Production rollout với feature flag (1-2 ngày)

**Strategy:** soft-launch dùng `SEPAY_ENABLED`.

1. Deploy production với `SEPAY_ENABLED=false`
2. Test 1 đơn nội bộ (admin CK 10.000đ vào TK thật) với `SEPAY_ENABLED=true` chỉ cho IP admin (qua nginx config tạm)
3. Đảo `SEPAY_ENABLED=true` cho tất cả user
4. Monitor 48h: số webhook, tỷ lệ match success, email alert, user feedback
5. Có vấn đề → đảo `SEPAY_ENABLED=false`, fallback admin manual

### Tổng effort

≈ **2 tuần làm part-time**, hoặc 7-10 ngày full-time.

---

## 10. Rollback & Operations

### 10.1. Rollback matrix

| Vấn đề | Action | Thời gian |
|---|---|---|
| Webhook handler crash | Rollback git → redeploy | <5 phút |
| Match logic sai (false positive amount mismatch) | `SEPAY_ENABLED=false`, hotfix, redeploy | <30 phút |
| API key bị lộ | Rotate key trên dashboard SePay + .env, restart app | <15 phút |
| Volume spike >50/tháng không expected | Upgrade gói SePay (online qua dashboard) | Realtime |
| Bug frontend checkout | Hide /plans CTA tạm, fix, deploy | <30 phút |

### 10.2. Documentation deliverables

- `docs/sepay-integration.md` — runbook ops: rotate key, check log, alert response, troubleshooting
- README.md — section "Payment Setup" cho dev local
- Admin dashboard view list `sepay_webhook_logs` với filter (out of MVP scope, phase 6)

---

## 11. Open Questions / Future Work (out of MVP scope)

- **Multi-bank support:** mở rộng từ 1 TK lên nhiều TK khi cần (UI tabs, mapping `gateway` field)
- **SMS notification:** thay/bổ sung email khi paid (cần SMS provider)
- **Admin dashboard cho `sepay_webhook_logs`:** UI list filter để admin xử anomaly thay vì check email
- **Rate limiting middleware:** dùng slowapi hoặc reverse proxy
- **Webhook signature/HMAC:** nếu SePay support trong tương lai
- **Sandbox `my.dev.sepay.vn`:** doc không nêu rõ, cần xác nhận với SePay support
- **Phí vượt 50 tx/tháng:** đơn giá doc không công khai, cần liên hệ support trước khi launch

---

## 12. References

- [SePay docs](https://docs.sepay.vn/)
- [Tích hợp Webhooks](https://docs.sepay.vn/tich-hop-webhooks.html)
- [Lập trình Webhooks (PHP)](https://docs.sepay.vn/lap-trinh-webhooks.html)
- [QR VietQR động](https://docs.sepay.vn/tao-qr-code-vietqr-dong.html)
- [Tạo API Token](https://docs.sepay.vn/tao-api-token.html)
- [Bảng giá](https://sepay.vn/bang-gia.html)
- Project file: [`finext-fastapi/app/crud/transactions.py`](finext-fastapi/app/crud/transactions.py) — logic confirm hiện có
- Project file: [`finext-fastapi/app/routers/transactions.py`](finext-fastapi/app/routers/transactions.py) — endpoints hiện có
- Project memory: `feedback_mui_sx_units.md`, `feedback_tabs_vs_breadcrumb.md`, `feedback_guide_content_tone.md`, `feedback_membership_tier_wording.md`
