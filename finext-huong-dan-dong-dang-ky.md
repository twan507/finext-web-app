# Hướng dẫn chỉnh sửa Finext sang mô hình đóng đăng ký

**Mục tiêu:** chuyển Finext từ trạng thái pre-launch (có chức năng đăng ký, gói trả phí, news feed full content...) sang **closed/invite-only platform** không thu tiền, để vận hành hợp pháp với rủi ro tối thiểu trong giai đoạn personal demo.

**Phạm vi:** 7 phase code changes + 1 phase optional. Mỗi phase có path file, code snippet, và verify steps.

## Phase 1: Đóng registration

### 1.1 Disable backend endpoint `POST /auth/register`

File: `finext-fastapi/app/routers/auth.py`

Tìm function handler cho `POST /register`. Có hai cách:

**Cách A — return 403 (khuyến nghị):** giữ endpoint, trả lỗi rõ ràng. User cũ đã đăng ký vẫn login được, user mới gặp message hướng dẫn.

```python
@router.post("/register", status_code=status.HTTP_403_FORBIDDEN)
async def register_disabled():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Đăng ký công khai đã đóng. Vui lòng liên hệ quản trị viên qua email finext.vn@gmail.com để được cấp tài khoản."
    )
```

**Cách B — xóa endpoint:** comment out hoặc xóa hẳn route. Frontend phải đảm bảo không gọi tới.

Áp dụng tương tự cho endpoint xác thực email khi register (nếu có riêng).

### 1.2 Disable Google OAuth signup (giữ Google login)

Logic OAuth hiện tại: callback từ Google → tìm user theo `google_id` → nếu chưa có thì tạo mới. Cần sửa: nếu chưa có user → return 403, không tạo.

File: `finext-fastapi/app/routers/auth.py` (handler Google callback) hoặc `app/utils/google_auth.py`.

```python
async def handle_google_callback(google_token: str, db):
    google_user_info = await verify_google_token(google_token)
    google_id = google_user_info["sub"]
    email = google_user_info["email"]

    user = await db.users.find_one({
        "$or": [{"google_id": google_id}, {"email": email}]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản chưa được tạo. Vui lòng liên hệ quản trị viên để được cấp truy cập."
        )

    # Link google_id nếu user có email nhưng chưa link
    if not user.get("google_id"):
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"google_id": google_id}}
        )

    return create_login_response(user)
```

### 1.3 Frontend — bỏ trang `/register`

File: `finext-nextjs/app/(auth)/register/page.tsx`

Hai lựa chọn:

**Cách A — redirect:**

```tsx
import { redirect } from 'next/navigation';

export default function RegisterPage() {
  redirect('/login');
}
```

**Cách B — placeholder thông báo:**

```tsx
export default function RegisterPage() {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h1>Đăng ký đã đóng</h1>
      <p>Finext hiện đang ở chế độ truy cập theo lời mời. Vui lòng liên hệ quản trị viên qua email <a href="mailto:finext.vn@gmail.com">finext.vn@gmail.com</a> để được cấp tài khoản.</p>
      <a href="/login">Quay lại trang đăng nhập</a>
    </div>
  );
}
```

### 1.4 Frontend — bỏ link "Đăng ký" trong header và trang login

Tìm component header chứa link Register. Khả năng cao ở:
- `finext-nextjs/components/layout/Header.tsx`
- `finext-nextjs/app/(auth)/login/page.tsx` (link "Chưa có tài khoản? Đăng ký")

Xóa hoặc comment link tới `/register`. Trên trang login giữ link `/forgot-password` — user cũ vẫn cần reset password.

### 1.5 (Optional) Trang `/request-access` cho organic growth có kiểm soát

Nếu muốn cho phép truyền miệng, không pure invite-only:

**Backend:**

Tạo collection mới `access_requests`:
```javascript
{
  _id: ObjectId,
  email: string,
  full_name: string,
  reason: string,
  referrer: string,
  status: "pending" | "approved" | "rejected",
  created_at: datetime,
  reviewed_at: datetime | null,
  reviewed_by: ObjectId | null,
  notes: string | null
}
```

Endpoint mới `POST /api/v1/auth/request-access`:

```python
# finext-fastapi/app/routers/auth.py
from app.schemas.access_requests import AccessRequestCreate

@router.post("/request-access", status_code=201)
async def request_access(payload: AccessRequestCreate, db = Depends(get_database)):
    existing = await db.access_requests.find_one({
        "email": payload.email,
        "status": "pending"
    })
    if existing:
        return {"status": 200, "message": "Yêu cầu đã được ghi nhận, đang chờ xét duyệt"}

    await db.access_requests.insert_one({
        "email": payload.email,
        "full_name": payload.full_name,
        "reason": payload.reason,
        "referrer": payload.referrer or "",
        "status": "pending",
        "created_at": datetime.utcnow()
    })

    await send_admin_notification(
        subject=f"[Finext] Yêu cầu truy cập mới: {payload.email}",
        body=f"Email: {payload.email}\nTên: {payload.full_name}\nLý do: {payload.reason}\nGiới thiệu: {payload.referrer or 'không có'}"
    )

    return {"status": 200, "message": "Yêu cầu đã được gửi. Quản trị viên sẽ liên hệ qua email trong 1-3 ngày làm việc."}
```

Admin page `/admin/access-requests`: list pending → approve sẽ tự động:
1. Tạo user mới qua flow admin create user (đã có)
2. Gửi email cho user kèm OTP link để set password lần đầu
3. Mark request là approved

**Frontend:**

Tạo page `finext-nextjs/app/(auth)/request-access/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { TextField, Button, Box, Typography, Alert } from '@mui/material';

export default function RequestAccessPage() {
  const [form, setForm] = useState({ email: '', full_name: '', reason: '', referrer: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit() {
    setStatus('submitting');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) setStatus('success');
      else setStatus('error');
    } catch { setStatus('error'); }
  }

  if (status === 'success') {
    return <Alert severity="success">Yêu cầu đã được gửi. Vui lòng kiểm tra email trong 1-3 ngày làm việc.</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 4 }}>
      <Typography variant="h5" gutterBottom>Yêu cầu truy cập Finext</Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        Finext hiện ở chế độ truy cập theo lời mời. Vui lòng điền thông tin bên dưới, quản trị viên sẽ phản hồi qua email.
      </Typography>
      <TextField fullWidth label="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} margin="normal" required />
      <TextField fullWidth label="Họ và tên" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} margin="normal" required />
      <TextField fullWidth label="Lý do muốn sử dụng" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} margin="normal" multiline rows={3} required />
      <TextField fullWidth label="Người giới thiệu (nếu có)" value={form.referrer} onChange={e => setForm({...form, referrer: e.target.value})} margin="normal" />
      <Button fullWidth variant="contained" onClick={handleSubmit} disabled={status === 'submitting'} sx={{ mt: 2 }}>
        {status === 'submitting' ? 'Đang gửi...' : 'Gửi yêu cầu'}
      </Button>
      {status === 'error' && <Alert severity="error" sx={{ mt: 2 }}>Có lỗi xảy ra. Vui lòng thử lại sau.</Alert>}
    </Box>
  );
}
```

Trên trang login thêm link nhỏ: "Chưa có tài khoản? [Yêu cầu truy cập](/request-access)".

## Phase 2: Content cleanup theo Hướng A

### 2.1 News feed: chuyển sang link external

**Schema:** kiểm tra schema bài news, đảm bảo có field `external_url` (URL gốc của bài) và `source_name` (tên báo). Nếu chưa có, thêm:

```python
# finext-fastapi/app/schemas/news.py
class NewsArticle(BaseModel):
    id: PyObjectId
    title: str
    lead: str  # 1 câu, max 30 từ
    external_url: HttpUrl
    source_name: str
    published_at: datetime
    category: str | None
    # Bỏ: full_content, body, html_content (nếu có)
```

**Backend:** rà router news. Endpoint trả về list/detail bài:
- List: trả về `title`, `lead`, `external_url`, `source_name`. Bỏ trả về full content.
- Detail (`GET /news/{id}`): trả về thông tin metadata + `external_url`. Frontend dùng `external_url` redirect.

**Frontend:**

`finext-nextjs/app/(main)/news/page.tsx` — list news. Mỗi card click → mở `external_url` ở tab mới:

```tsx
<a href={article.external_url} target="_blank" rel="noopener noreferrer nofollow">
  <Card>
    <Typography variant="h6">{article.title}</Typography>
    <Typography variant="body2" color="text.secondary">
      {article.lead}
    </Typography>
    <Typography variant="caption">Nguồn: {article.source_name}</Typography>
  </Card>
</a>
```

`finext-nextjs/app/(main)/news/[articleId]/page.tsx` — đổi thành redirect:

```tsx
import { redirect } from 'next/navigation';

export default async function NewsDetailPage({ params }: { params: { articleId: string } }) {
  const article = await fetchArticle(params.articleId);
  if (!article || !article.external_url) {
    return <div>Bài viết không tồn tại</div>;
  }
  redirect(article.external_url);
}
```

Tab `/news/category/`, `/news/type/[type]/` áp dụng cùng logic — chỉ hiển thị card với link external.

**Footer toàn site:**

```tsx
<Typography variant="caption" sx={{ color: 'text.secondary' }}>
  Tin tức được tổng hợp tự động từ các nguồn báo chí. Vui lòng truy cập trang gốc để đọc đầy đủ.
</Typography>
```

### 2.2 Reports: bỏ category "stock analysis"

**Backend:** rà code seed/CRUD reports tìm enum/list category.

```python
# finext-fastapi/app/schemas/reports.py
class ReportType(str, Enum):
    DAILY_MARKET = "daily_market"
    WEEKLY_MARKET = "weekly_market"
    SECTOR_DEEP_DIVE = "sector_deep_dive"
    # STOCK_ANALYSIS = "stock_analysis"  # REMOVED
```

Migration: tìm các report có type `stock_analysis` đang lưu, soft delete:

```python
# finext-fastapi/scripts/archive_stock_analysis_reports.py
async def archive():
    db = await get_database()
    result = await db.reports.update_many(
        {"type": "stock_analysis"},
        {"$set": {"archived": True, "archived_at": datetime.utcnow(), "archived_reason": "compliance_phase_lockdown"}}
    )
    print(f"Archived {result.modified_count} stock_analysis reports")
```

**Frontend:**

`finext-nextjs/app/(main)/reports/serverFetch.ts` — filter ra type stock_analysis:

```typescript
const allowedTypes = ['daily_market', 'weekly_market', 'sector_deep_dive'];
const reports = allReports.filter(r => allowedTypes.includes(r.type) && !r.archived);
```

`finext-nextjs/app/(main)/reports/type/[type]/page.tsx` — handle invalid type:

```tsx
const ALLOWED_TYPES = ['daily-market', 'weekly-market', 'sector-deep-dive'];

export default async function ReportTypePage({ params }: { params: { type: string } }) {
  if (!ALLOWED_TYPES.includes(params.type)) {
    notFound();
  }
  // ...
}
```

**Audit nội dung 2 type còn lại:**

- `daily_market`, `weekly_market`: rà nội dung, đảm bảo là tổng hợp dữ liệu (đóng cửa, biến động, thanh khoản theo ngành), không có cụm "khuyến nghị", "nên mua/bán", "đáng chú ý".
- `sector_deep_dive`: rà có cá biệt hóa cổ phiếu trong ngành không. Nếu có "Mã X tiềm năng nhất ngành Y" → bỏ.

### 2.3 Home: đổi tên "Featured Stocks"

File: `finext-nextjs/app/(main)/home/PageContent.tsx`, các component dưới.

Tìm string "Featured Stocks" và đổi:

```tsx
// Trước
<Typography variant="h5">Featured Stocks</Typography>

// Sau
<Typography variant="h5">Mã có dòng tiền cao nhất phiên</Typography>
<Typography variant="body2" color="text.secondary">
  Sắp xếp theo tổng giá trị dòng tiền vào/ra trong phiên gần nhất
</Typography>
```

Xóa cụm từ chứa "Featured", "Hot", "Top picks", "Đáng chú ý", "Tiềm năng" trong toàn bộ component này. Component name có thể đổi từ `FeaturedStocks` → `MoneyFlowHighlights`.

### 2.4 Sectors: đổi label "strength"

File: `finext-nextjs/app/(main)/sectors/`, components con.

Tìm "strength" trong:
- Bảng xếp hạng strength
- Heatmap rotation labels
- Sort options

Đổi label sang metric đo được:

```tsx
// Trước
const columns = [
  { field: 'strength', label: 'Strength' },
];

// Sau
const columns = [
  { field: 'weekly_change_pct', label: '% biến động tuần' },
  { field: 'monthly_change_pct', label: '% biến động tháng' },
  { field: 'pe_avg', label: 'P/E trung bình ngành' },
  { field: 'money_flow_net_weekly', label: 'Dòng tiền ròng tuần (tỷ)' },
];
```

Backend API: nếu API hiện tại trả về field `strength` (composite score do Finext tự tính), giữ trong DB nhưng không expose trong response API public. Thay bằng các metric raw để FE hiển thị.

**Heatmap rotation:** giữ visualization, đổi color scale theo metric khách quan (ví dụ % thay đổi giá theo tuần). Bỏ chú thích định hướng kiểu "Ngành đang vào chu kỳ tăng/giảm".

### 2.5 Disable form `/open-account`

File: `finext-nextjs/app/(main)/open-account/page.tsx`

Replace toàn bộ nội dung:

```tsx
import { Box, Typography } from '@mui/material';

export default function OpenAccountPage() {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 4, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>Tính năng đang nâng cấp</Typography>
      <Typography variant="body1">
        Nếu bạn quan tâm đến mở tài khoản chứng khoán, vui lòng liên hệ trực tiếp một công ty chứng khoán có giấy phép theo lựa chọn của bạn.
      </Typography>
    </Box>
  );
}
```

**Backend:** disable endpoint `POST /api/v1/emails/open-account`:

```python
# finext-fastapi/app/routers/emails.py
@router.post("/open-account", status_code=410)
async def submit_open_account_disabled():
    raise HTTPException(
        status_code=410,
        detail="Tính năng này đang được tạm dừng"
    )
```

### 2.6 Rename email templates

Đổi tên các file template:
- `finext-fastapi/app/templates/consultation_request.html` → `support_request.html`
- `finext-fastapi/app/templates/plan_inquiry_request.html` → `pricing_inquiry.html`
- `finext-fastapi/app/templates/open_account_request.html` → `account_inquiry.html` (tùy chọn, vì đã disable form)

Cập nhật references trong code:

```bash
grep -rn "consultation_request" finext-fastapi/app/
grep -rn "plan_inquiry_request" finext-fastapi/app/
grep -rn "open_account_request" finext-fastapi/app/
```

Đổi từng nơi.

**Endpoint:** rename `/api/v1/emails/consultation` → `/api/v1/emails/support` trong `app/routers/emails.py`. Frontend cập nhật `support/email/page.tsx`, `support/consultation/page.tsx`.

**Route:** đổi `/support/consultation` → `/support/contact` hoặc `/support/onboarding`. Cập nhật sidebar, internal links.

### 2.7 Rà copy site khỏi cụm dễ hiểu nhầm

```bash
cd finext-nextjs
grep -rn "khuyến nghị\|tín hiệu mua\|tín hiệu bán\|nên mua\|nên bán\|mã hot\|mã tiềm năng\|stock pick\|đảm bảo lợi nhuận" app/ components/
```

Xóa hoặc thay thế từng nơi. Đặc biệt rà:
- Landing page, hero copy
- Meta description (`app/layout.tsx` metadata)
- Trang `/plans` (nếu giữ)
- Các email template content

## Phase 3: Data minimization và self-delete

### 3.1 Reduce user schema fields

File: `finext-fastapi/app/schemas/users.py`

Rà các field hiện có. Giữ:
- `_id`, `email`, `full_name`, `password_hash`, `google_id`, `avatar_url`, `roles`, `created_at`, `updated_at`

Bỏ nếu có:
- `phone_number`, `date_of_birth`, `gender`, `address`, `national_id`/`cccd`, các field không thực sự cần cho phân quyền hoặc UX

Migration script xóa field cũ:

```python
# finext-fastapi/scripts/cleanup_user_fields.py
async def cleanup():
    db = await get_database()
    fields_to_drop = ["phone_number", "date_of_birth", "gender", "address", "national_id"]
    update = {"$unset": {f: "" for f in fields_to_drop}}
    result = await db.users.update_many({}, update)
    print(f"Cleaned {result.modified_count} user records")
```

### 3.2 Self-delete endpoint

File: `finext-fastapi/app/routers/users.py`

```python
@router.delete("/me", status_code=204)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db = Depends(get_database)
):
    user_id = current_user.id

    await db.subscriptions.delete_many({"user_id": user_id})
    await db.sessions.delete_many({"user_id": user_id})
    await db.watchlists.delete_many({"user_id": user_id})
    await db.transactions.update_many(
        {"user_id": user_id},
        {"$set": {"user_id": None, "user_email_anonymized": "deleted"}}
    )  # giữ transaction record (audit), anonymize user
    await db.otps.delete_many({"email": current_user.email})

    await db.users.delete_one({"_id": user_id})

    return None
```

Frontend: trang `/profile/information` thêm section "Xóa tài khoản":

```tsx
<Box sx={{ mt: 4, p: 3, border: '1px solid', borderColor: 'error.main', borderRadius: 1 }}>
  <Typography variant="h6" color="error">Xóa tài khoản</Typography>
  <Typography variant="body2" sx={{ mb: 2 }}>
    Tất cả dữ liệu cá nhân, watchlist, lịch sử của bạn sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
  </Typography>
  <Button
    variant="outlined"
    color="error"
    onClick={() => setConfirmOpen(true)}
  >
    Xóa tài khoản
  </Button>
  <ConfirmDialog
    open={confirmOpen}
    title="Xác nhận xóa tài khoản"
    message="Bạn chắc chắn muốn xóa? Hành động này không thể hoàn tác."
    onConfirm={async () => {
      await apiClient.delete('/api/v1/users/me');
      logout();
      router.push('/');
    }}
    onCancel={() => setConfirmOpen(false)}
  />
</Box>
```

### 3.3 TTL cho session log

File: `finext-fastapi/app/main.py` hoặc nơi tạo index

```python
async def create_indexes(db):
    # Sessions: TTL 30 ngày sau last_active
    await db.sessions.create_index("last_active", expireAfterSeconds=30*24*3600)

    # OTPs: TTL 10 phút sau created_at
    await db.otps.create_index("created_at", expireAfterSeconds=600)

    # Access requests: TTL 90 ngày sau created_at (nếu dùng Phase 1.5)
    await db.access_requests.create_index("created_at", expireAfterSeconds=90*24*3600)
```

## Phase 4: Pages chính sách (Privacy / Disclaimer / ToS)

### 4.1 `/policies/privacy`

File: `finext-nextjs/app/(main)/policies/privacy/page.tsx`

Template nội dung — copy vào component, format MUI Typography:

```
# Chính sách Bảo mật

Chính sách này mô tả cách Finext thu thập, sử dụng và bảo vệ dữ liệu cá nhân của người dùng. Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.

## 1. Dữ liệu chúng tôi thu thập

- Email (bắt buộc) — để định danh tài khoản và liên lạc.
- Họ và tên (bắt buộc) — để hiển thị trên giao diện.
- Mật khẩu (đã được mã hóa bằng bcrypt) — để xác thực đăng nhập.
- Google ID (nếu bạn đăng nhập qua Google) — để liên kết tài khoản.
- Ảnh đại diện (tùy chọn) — do bạn tự upload.
- Watchlist cổ phiếu cá nhân — danh sách mã chứng khoán bạn theo dõi.
- Lịch sử phiên đăng nhập — thiết bị, thời gian truy cập.

## 2. Mục đích sử dụng

- Cấp quyền truy cập công cụ phân tích.
- Lưu trữ tùy chỉnh cá nhân (watchlist, sắp xếp).
- Gửi thông báo về tài khoản, cập nhật sản phẩm.

## 3. Lưu trữ và bảo mật

- Dữ liệu được lưu trữ tại máy chủ MongoDB tại Việt Nam.
- Mật khẩu được mã hóa bằng bcrypt, không lưu dạng văn bản.
- Truyền dữ liệu qua HTTPS với TLS.
- Phiên đăng nhập tự động xóa sau 30 ngày không hoạt động.

## 4. Chia sẻ với bên thứ ba

Không chia sẻ dữ liệu cá nhân với bên thứ ba ngoài các trường hợp sau:
- Bắt buộc theo yêu cầu của cơ quan nhà nước có thẩm quyền.
- Nhà cung cấp hạ tầng kỹ thuật (Cloudflare R2 lưu trữ ảnh, dịch vụ email gửi thông báo) — chỉ trong phạm vi cần thiết.

## 5. Quyền của bạn

- Truy cập, xem dữ liệu cá nhân của bạn qua trang `/profile/information`.
- Sửa thông tin (họ tên, ảnh, mật khẩu) bất cứ lúc nào.
- Xóa toàn bộ tài khoản và dữ liệu liên quan tại trang `/profile/information` — hành động không thể hoàn tác.
- Yêu cầu sao chép dữ liệu cá nhân hoặc các quyền khác theo Nghị định 13/2023/NĐ-CP — liên hệ qua email.

## 6. Cookie và theo dõi

- Sử dụng cookie kỹ thuật để duy trì phiên đăng nhập (JWT).
- Không sử dụng cookie quảng cáo hoặc theo dõi từ bên thứ ba.

## 7. Liên hệ

Mọi thắc mắc về dữ liệu cá nhân, vui lòng liên hệ: finext.vn@gmail.com

## 8. Cập nhật

Chính sách có thể được cập nhật. Phiên bản hiện hành cập nhật ngày: [DD/MM/YYYY].
```

### 4.2 `/policies/disclaimer`

File: `finext-nextjs/app/(main)/policies/disclaimer/page.tsx`

```
# Miễn trừ trách nhiệm

## 1. Phạm vi dịch vụ

Finext là nền tảng cung cấp dữ liệu thị trường và công cụ phân tích kỹ thuật dành cho người dùng được mời.

**Finext cung cấp:**
- Dữ liệu giá, khối lượng, chỉ số tài chính của các mã chứng khoán niêm yết.
- Công cụ vẽ biểu đồ kỹ thuật và áp dụng chỉ báo do người dùng tự cấu hình.
- Bộ lọc cổ phiếu (screener) đa tiêu chí.
- Watchlist cá nhân.
- Tin tức tài chính qua đường dẫn đến nguồn gốc.

**Finext không cung cấp:**
- Tư vấn đầu tư chứng khoán theo định nghĩa Khoản 32 Điều 4 Luật Chứng khoán 2019.
- Khuyến nghị mua, bán, hoặc nắm giữ chứng khoán cụ thể.
- Quản lý danh mục đầu tư.
- Môi giới chứng khoán.
- Phân phối chứng chỉ quỹ.

## 2. Vai trò pháp lý

Finext không phải công ty chứng khoán, không phải công ty quản lý quỹ đầu tư chứng khoán, không được Ủy ban Chứng khoán Nhà nước cấp phép thực hiện nghiệp vụ tư vấn đầu tư chứng khoán. Không hoạt động trong phạm vi ủy quyền của bất kỳ công ty chứng khoán nào.

## 3. Trách nhiệm của người dùng

Mọi nội dung trên Finext chỉ mang tính chất tham khảo. Người dùng:
- Chịu trách nhiệm hoàn toàn về các quyết định đầu tư của mình.
- Nên liên hệ công ty chứng khoán đã được cấp phép để được tư vấn đầu tư chính thức.
- Không được suy luận khuyến nghị mua/bán từ dữ liệu hoặc công cụ trên Finext.

## 4. Không bảo đảm lợi nhuận

Đầu tư chứng khoán có rủi ro mất vốn. Finext không bảo đảm hoặc cam kết bất kỳ mức lợi nhuận nào từ việc sử dụng dữ liệu hoặc công cụ trên website.

## 5. Liên hệ

Mọi thắc mắc, vui lòng liên hệ: finext.vn@gmail.com
```

### 4.3 `/policies/content` (Điều khoản sử dụng)

File: `finext-nextjs/app/(main)/policies/content/page.tsx`

```
# Điều khoản sử dụng

## 1. Chấp nhận điều khoản

Bằng việc đăng nhập và sử dụng Finext, bạn đồng ý với các Điều khoản dưới đây cùng Chính sách Bảo mật và Miễn trừ trách nhiệm.

## 2. Truy cập

- Finext hoạt động ở chế độ truy cập theo lời mời. Bạn chỉ được sử dụng nếu được quản trị viên cấp tài khoản.
- Bạn không được chia sẻ tài khoản, mật khẩu, hoặc cấp quyền truy cập cho người khác.
- Một tài khoản chỉ dành cho một người dùng.

## 3. Hành vi không cho phép

Bạn cam kết không:
- Sử dụng Finext cho mục đích vi phạm pháp luật Việt Nam.
- Crawl, scrape, hoặc tự động hóa truy cập với tần suất gây quá tải hệ thống.
- Reverse engineer, sao chép, phân phối lại dữ liệu hoặc công cụ.
- Đăng tải nội dung vi phạm bản quyền, gây hại, hoặc xâm phạm quyền của bên thứ ba.
- Mạo danh người khác hoặc cung cấp thông tin sai lệch.

## 4. Quyền sở hữu trí tuệ

- Code, giao diện, tài sản thiết kế của Finext thuộc sở hữu của chủ vận hành.
- Dữ liệu thị trường có nguồn từ các sàn giao dịch và nhà cung cấp dữ liệu thứ ba — bạn không được phân phối lại dưới bất kỳ hình thức nào.
- Tin tức được aggregate qua đường link đến nguồn gốc — bản quyền thuộc về cơ quan báo chí phát hành.

## 5. Tạm dừng và chấm dứt

- Quản trị viên có quyền tạm dừng hoặc chấm dứt tài khoản của bạn nếu vi phạm Điều khoản này.
- Bạn có thể tự xóa tài khoản bất cứ lúc nào tại trang `/profile/information`.

## 6. Thay đổi điều khoản

Điều khoản có thể được cập nhật. Phiên bản hiện hành cập nhật ngày: [DD/MM/YYYY]. Việc tiếp tục sử dụng sau cập nhật được coi là chấp nhận điều khoản mới.

## 7. Liên hệ

Mọi thắc mắc, vui lòng liên hệ: finext.vn@gmail.com

## 8. Luật áp dụng

Điều khoản này được điều chỉnh bởi pháp luật Việt Nam.
```

### 4.4 Footer disclaimer toàn site

File: `finext-nextjs/components/layout/Footer.tsx`

Thêm đoạn cố định:

```tsx
<Box sx={{ borderTop: 1, borderColor: 'divider', p: 2, mt: 4, fontSize: '0.85rem', color: 'text.secondary' }}>
  <Typography variant="caption" component="p">
    Finext là nền tảng cung cấp dữ liệu và công cụ phân tích kỹ thuật, không phải công ty chứng khoán.
    Mọi nội dung chỉ mang tính tham khảo, không phải khuyến nghị mua/bán. Người dùng chịu trách nhiệm hoàn toàn cho quyết định đầu tư của mình.
  </Typography>
  <Box sx={{ mt: 1 }}>
    <Link href="/policies/privacy">Bảo mật</Link> ·{' '}
    <Link href="/policies/disclaimer">Miễn trừ trách nhiệm</Link> ·{' '}
    <Link href="/policies/content">Điều khoản</Link>
  </Box>
</Box>
```

### 4.5 Banner disclaimer trên trang chi tiết mã

File: `finext-nextjs/app/(main)/stocks/[symbol]/page.tsx` và `finext-nextjs/app/(main)/charts/[id]/page.tsx`

Thêm component banner ở đầu page:

```tsx
<Alert severity="info" sx={{ mb: 2 }}>
  Dữ liệu hiển thị nhằm mục đích tham khảo. Không phải khuyến nghị đầu tư.
</Alert>
```

### 4.6 Consent checkbox khi user lần đầu login

File: `finext-nextjs/components/auth/AuthProvider.tsx` (hoặc tương tự)

Khi user lần đầu login (không có flag `consent_accepted_at` trong user record), hiển thị modal:

```tsx
<Dialog open={showConsent} disableEscapeKeyDown>
  <DialogTitle>Đồng ý điều khoản sử dụng</DialogTitle>
  <DialogContent>
    <Typography variant="body2" gutterBottom>
      Để tiếp tục sử dụng Finext, vui lòng đọc và đồng ý:
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
      <Link href="/policies/content" target="_blank">Điều khoản sử dụng</Link>
      <Link href="/policies/privacy" target="_blank">Chính sách bảo mật</Link>
      <Link href="/policies/disclaimer" target="_blank">Miễn trừ trách nhiệm</Link>
    </Box>
    <FormControlLabel
      control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
      label="Tôi đã đọc và đồng ý với các điều khoản trên"
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={logout}>Đăng xuất</Button>
    <Button
      variant="contained"
      disabled={!agreed}
      onClick={async () => {
        await apiClient.put('/api/v1/users/me/consent', { accepted: true });
        setShowConsent(false);
      }}
    >
      Đồng ý và tiếp tục
    </Button>
  </DialogActions>
</Dialog>
```

Backend: thêm field `consent_accepted_at: datetime | None` vào user schema, endpoint `PUT /users/me/consent`.

## Phase 5: Bỏ payment infrastructure

> **Lưu ý:** Phase này có data migration. Backup MongoDB trước khi chạy script ở 5.3.

### 5.1 Disable transaction creation

File: `finext-fastapi/app/routers/transactions.py`

```python
@router.post("/me/orders", status_code=410)
async def create_order_disabled():
    raise HTTPException(
        status_code=410,
        detail="Tính năng mua gói đang tạm dừng"
    )
```

Giữ các endpoint admin (`/admin/create`, `/admin/{id}/confirm-payment`, ...) để xử lý transaction cũ nếu có.

### 5.2 Bỏ gói PATRON khỏi seed

File: `finext-fastapi/app/core/seeding/_seed_licenses.py`

Tìm entry `PATRON` và xóa hoặc set `is_active=False`:

```python
DEFAULT_LICENSES = [
    {"key": "ADMIN", "name": "License Quản Trị Viên", "price": 0, "duration_days": 36500, "feature_keys": [...], "is_active": True},
    {"key": "MANAGER", ...},
    {"key": "PARTNER", ...},
    {"key": "BASIC", ...},
    # PATRON removed
]
```

### 5.3 Migration: deactivate active PATRON subscriptions

Script chạy 1 lần:

```python
# finext-fastapi/scripts/deactivate_patron_subscriptions.py
async def migrate():
    db = await get_database()

    patron_license = await db.licenses.find_one({"key": "PATRON"})
    if not patron_license:
        print("No PATRON license found")
        return

    affected = await db.subscriptions.find({
        "license_id": patron_license["_id"],
        "status": "active"
    }).to_list(None)

    print(f"Found {len(affected)} active PATRON subscriptions")

    for sub in affected:
        await db.subscriptions.update_one(
            {"_id": sub["_id"]},
            {"$set": {
                "status": "deactivated",
                "deactivated_at": datetime.utcnow(),
                "deactivation_reason": "service_restructure"
            }}
        )

        user = await db.users.find_one({"_id": sub["user_id"]})
        print(f"Notify: {user['email']}")
        # await send_email(user['email'], 'Cập nhật về tài khoản Finext', '...')

    await db.licenses.update_one(
        {"_id": patron_license["_id"]},
        {"$set": {"is_active": False, "deactivated_at": datetime.utcnow()}}
    )
```

Chạy ở development environment trước, kiểm tra số lượng affected subscriptions hợp lý mới deploy production.

### 5.4 Convert `/plans` page

File: `finext-nextjs/app/(main)/plans/page.tsx`

Thay vì hiển thị bảng so sánh + nút "Mua ngay", chuyển thành trang giới thiệu sản phẩm:

```tsx
import { Box, Typography } from '@mui/material';

export default function AboutPage() {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 4 }}>
      <Typography variant="h4" gutterBottom>Về Finext</Typography>
      <Typography variant="body1" paragraph>
        Finext là nền tảng cung cấp dữ liệu thị trường chứng khoán và công cụ phân tích kỹ thuật dành cho nhà đầu tư cá nhân được mời.
      </Typography>
      <Typography variant="body1" paragraph>
        Finext hiện ở chế độ truy cập theo lời mời. Nếu bạn quan tâm, vui lòng <a href="/request-access">gửi yêu cầu truy cập</a> hoặc liên hệ qua email finext.vn@gmail.com.
      </Typography>
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Tính năng chính</Typography>
      <ul>
        <li>Dữ liệu giá thời gian thực cho VN-Index, VN30, HNX, UPCOM</li>
        <li>Biểu đồ kỹ thuật với các chỉ báo phổ biến</li>
        <li>Bộ lọc cổ phiếu đa tiêu chí</li>
        <li>Watchlist cá nhân</li>
        <li>Tổng hợp tin tức từ các nguồn báo chí</li>
      </ul>
    </Box>
  );
}
```

Hoặc đơn giản hơn: redirect `/plans` → `/` (home).

### 5.5 Tạm dừng SePay roadmap

File: `docs/superpowers/plans/2026-05-06-sepay-integration-implementation.md` (hoặc tương tự)

Thêm note ở đầu file:

```markdown
> **STATUS: ON HOLD (06/05/2026)** — Project chuyển sang mô hình closed/invite-only không thu tiền.
> Plan này được giữ nguyên để tham khảo, có thể được kích hoạt lại khi sản phẩm pivot sang commercial.
```

Tương tự cho file spec. Không cần xóa file — code chưa implement nên không lãng phí.

### 5.6 Bỏ trang `/profile/subscriptions` khỏi sidebar

User không có gói trả phí nữa. Trang này có thể:
- Bỏ hẳn khỏi sidebar profile.
- Hoặc giữ với label "Lịch sử dịch vụ" — chỉ hiển thị admin gán license loại nào.

Cập nhật sidebar profile để không hiển thị link.

## Phase 6: SEO closure

### 6.1 robots.txt

File: `finext-nextjs/app/robots.ts`

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      disallow: '/'
    }]
  };
}
```

### 6.2 Meta robots noindex

File: `finext-nextjs/app/layout.tsx`

```tsx
export const metadata: Metadata = {
  title: 'Finext',
  description: 'Nền tảng phân tích thị trường (truy cập theo lời mời)',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    }
  }
};
```

### 6.3 Bỏ sitemap

File: `finext-nextjs/app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
```

Hoặc xóa file luôn.

### 6.4 Giảm JSON-LD

File: `finext-nextjs/app/layout.tsx`

Bỏ các JSON-LD `WebSite`, `Organization`, `SiteNavigationElement` đang inject. Hoặc chỉ giữ minimum: chỉ cần meta tag, không cần JSON-LD nếu không index.

### 6.5 Disable PWA installable nếu không cần public

File: `finext-nextjs/app/manifest.ts`

Có thể giữ PWA cho user đã đăng nhập, nhưng đảm bảo không có "install prompt" tự động trên trang public.

## Phase 7: Verification và smoke test

### 7.1 Curl smoke test (backend)

```bash
# Phải fail
curl -i -X POST https://finext.vn/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"...","full_name":"Test"}'
# Expected: 403 hoặc 410

# Phải fail
curl -i -X POST https://finext.vn/api/v1/transactions/me/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{...}'
# Expected: 410

# Phải fail
curl -i -X POST https://finext.vn/api/v1/emails/open-account \
  -H "Content-Type: application/json" \
  -d '{...}'
# Expected: 410

# Phải success (user existing)
curl -X POST https://finext.vn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"existing@user.com","password":"..."}'
# Expected: 200 + tokens

# Self-delete OK
curl -i -X DELETE https://finext.vn/api/v1/users/me \
  -H "Authorization: Bearer <token>"
# Expected: 204
```

### 7.2 Browser smoke test (frontend)

Theo thứ tự:

1. Mở https://finext.vn ở incognito → home hiển thị, không có lỗi console.
2. Click "Đăng ký" trong header → không thấy link, hoặc nếu vào `/register` → redirect/placeholder.
3. Click Google login → đăng nhập với account chưa tồn tại → báo lỗi rõ ràng.
4. Login với account existing → vào được home.
5. Vào `/news/` → click một article → mở tab mới sang trang báo gốc.
6. Vào `/news/[id]` trực tiếp qua URL → redirect external.
7. Vào `/reports/` → không thấy category "stock analysis".
8. Vào `/reports/type/stock-analysis` → 404.
9. Vào home → không thấy "Featured Stocks", thay bằng "Mã có dòng tiền cao nhất phiên".
10. Vào `/sectors/` → label là "% biến động tuần", không phải "Strength".
11. Vào `/open-account` → placeholder "Tính năng đang nâng cấp".
12. Vào `/plans` → không có nút "Mua ngay", hoặc redirect home.
13. Footer toàn site có disclaimer.
14. Vào `/policies/privacy`, `/policies/disclaimer`, `/policies/content` → đầy đủ nội dung.
15. Vào `/profile/information` → có nút "Xóa tài khoản".
16. Login lần đầu (account chưa accept consent) → modal disclaimer hiện ra.

### 7.3 Audit checklist

- [ ] `/register` đã đóng (BE + FE)
- [ ] Google OAuth signup đã chặn
- [ ] (Optional) `/request-access` hoạt động
- [ ] News chỉ link external, không reproduce content
- [ ] Reports không có category "stock analysis"
- [ ] Home không có "Featured Stocks" label
- [ ] Sectors không có label "strength"
- [ ] `/open-account` đã disable
- [ ] Email templates "consultation" đã rename
- [ ] User schema đã loại các field không cần
- [ ] `DELETE /users/me` hoạt động
- [ ] 3 trang `/policies/*` đã viết đầy đủ
- [ ] Footer + Banner disclaimer hiển thị
- [ ] Consent modal lần đầu login
- [ ] `POST /transactions/me/orders` đã disable
- [ ] License PATRON đã bỏ khỏi seed
- [ ] Subscriptions PATRON active đã deactivate
- [ ] `/plans` đã convert
- [ ] SePay plan/spec đã đánh dấu ON HOLD
- [ ] robots.txt + meta noindex
- [ ] sitemap empty
- [ ] Smoke test pass tất cả các bước

## Phase 8: Optional — DPIA filing với A05

Ở scale hiện tại (< 50 user invite-only), enforcement của Cục An ninh mạng A05 với cá nhân thu thập DLCN nhỏ rất thấp. Tuy nhiên nộp DPIA tăng evidence ý thức tuân thủ và miễn phí.

### 8.1 Truy cập

Cổng dịch vụ công của Bộ Công an: https://dichvucong.bocongan.gov.vn — tìm thủ tục "Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân".

### 8.2 Nội dung kê khai

- **Bên Kiểm soát Dữ liệu:** thông tin cá nhân của bạn (họ tên, CCCD, địa chỉ).
- **Mục đích xử lý:** "Cung cấp công cụ phân tích thị trường chứng khoán cho người dùng được mời cá nhân, không thương mại".
- **Loại dữ liệu:** email, họ tên, ảnh đại diện (tự upload), watchlist, lịch sử phiên đăng nhập.
- **Phạm vi xử lý:** lưu trữ tại MongoDB tại Việt Nam, mã hóa password bằng bcrypt.
- **Thời gian lưu trữ:** đến khi user yêu cầu xóa.
- **Biện pháp bảo vệ:** HTTPS, session TTL 30 ngày, hash password, không chia sẻ bên thứ ba.
- **Quyền của chủ thể dữ liệu:** liệt kê quyền theo Nghị định 13.

Nộp xong nhận xác nhận. Lưu xác nhận làm evidence.

## Vấn đề cần xác minh trước khi bắt đầu

Một số điểm chưa rõ trong overview, cần dev tự xác minh khi làm:

1. **Schema News collection** — có field `external_url` chưa, hay đang lưu full content trong DB? Quyết định: thêm field external_url, không hiển thị full content nữa.

2. **Schema Reports collection** — `type` field là enum hay string tự do? `stock_analysis` có data thật không?

3. **Featured Stocks logic** — backend tính ra danh sách như thế nào? Logic có cá biệt hóa đặc biệt mã nào, hay chỉ sort theo dòng tiền? Nếu chỉ sort, đổi label là đủ. Nếu có logic riêng, cần audit thêm.

4. **`feature_keys` của license PATRON** — `advanced_feature` cụ thể unlock gì trong code BE/FE? Cần liệt kê đầy đủ trước khi bỏ PATRON, để biết feature nào cần move sang `basic_feature` (giữ cho user current).

5. **Transactions tồn tại** — đã có giao dịch nào completed chưa? Nếu có, không xóa, chỉ stop tạo mới.
