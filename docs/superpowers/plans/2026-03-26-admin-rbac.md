# Admin RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa admin layout và các page theo role (Admin/Manager/Broker) bằng cách thêm permissions array vào session, filter navigation, disable buttons không có quyền, và tùy biến broker dashboard.

**Architecture:** Backend thêm endpoint `/api/v1/auth/me/permissions` và filter dashboard stats theo role. Frontend lưu permissions vào session, dùng `hasPermission()` trong mọi component để ẩn nav items, redirect route không hợp lệ, và disable buttons.

**Tech Stack:** FastAPI (Python), Next.js 14 (TypeScript), MUI v5, MongoDB via Motor

---

## File Map

### Backend — Modify
- `finext-fastapi/app/auth/access.py` — expose `get_user_permissions()` (bỏ underscore prefix)
- `finext-fastapi/app/routers/auth.py` — thêm `GET /me/permissions` endpoint
- `finext-fastapi/app/routers/dashboard.py` — thêm custom dependency, pass `current_user`, route tới broker CRUD
- `finext-fastapi/app/crud/dashboard.py` — thêm `get_broker_dashboard_stats()`

### Frontend — Modify
- `finext-nextjs/services/core/session.ts` — thêm `permissions: string[]` vào `SessionData`
- `finext-nextjs/components/auth/AuthProvider.tsx` — fetch permissions, thêm `hasPermission()`, expose trong context
- `finext-nextjs/app/admin/LayoutContent.tsx` — filter nav theo permissions, route guard redirect
- `finext-nextjs/app/admin/dashboard/PageContent.tsx` — broker info header + conditional charts
- `finext-nextjs/app/admin/users/PageContent.tsx` — disable Delete/Assign Role buttons
- `finext-nextjs/app/admin/transactions/PageContent.tsx` — disable Add/Confirm/Delete buttons
- `finext-nextjs/app/admin/subscriptions/PageContent.tsx` — disable Delete button

---

## Task 1: Backend — Expose `get_user_permissions()` publicly

**Files:**
- Modify: `finext-fastapi/app/auth/access.py`

- [ ] **Step 1: Rename private function to public**

Trong `finext-fastapi/app/auth/access.py`, đổi tên function dòng 19 từ `_get_user_permissions` → `get_user_permissions` và cập nhật tất cả chỗ gọi nội bộ:

```python
# Dòng 19: đổi tên
async def get_user_permissions(db: AsyncIOMotorDatabase, user_id_str: str) -> Set[str]:
    """Lấy tất cả các tên permission mà user sở hữu thông qua các vai trò."""
    # ... (giữ nguyên nội dung)
```

Dòng 63 trong `require_permission`:
```python
user_permissions = await get_user_permissions(db, str(current_user.id))
```

- [ ] **Step 2: Verify server starts without error**

```bash
cd finext-fastapi && python -m uvicorn app.main:app --reload --port 8000
```
Expected: Server starts, no ImportError.

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/auth/access.py
git commit -m "refactor(auth): expose get_user_permissions as public function"
```

---

## Task 2: Backend — Add `GET /api/v1/auth/me/permissions` endpoint

**Files:**
- Modify: `finext-fastapi/app/routers/auth.py`

- [ ] **Step 1: Add import for `get_user_permissions`**

Thêm import ở đầu file `finext-fastapi/app/routers/auth.py` (sau các import hiện tại):

```python
from app.auth.access import get_user_permissions
```

- [ ] **Step 2: Add endpoint after `/me/features` endpoint (sau dòng 212)**

```python
@router.get(
    "/me/permissions",
    response_model=StandardApiResponse[List[str]],
    summary="Lấy danh sách permission names của người dùng hiện tại",
    description="Trả về danh sách các permission name dựa trên roles của user.",
)
@api_response_wrapper(default_success_message="Lấy danh sách permissions thành công.")
async def read_my_permissions(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    permissions = await get_user_permissions(db, str(current_user.id))
    return sorted(list(permissions))
```

- [ ] **Step 3: Verify endpoint works**

```bash
# Lấy access token bằng login, rồi:
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/auth/me/permissions
```
Expected: `{"status": 200, "data": ["broker:list", "feature:manage", ...], "message": "..."}`

- [ ] **Step 4: Commit**

```bash
git add finext-fastapi/app/routers/auth.py
git commit -m "feat(auth): add GET /me/permissions endpoint"
```

---

## Task 3: Backend — Broker-filtered dashboard stats

**Files:**
- Modify: `finext-fastapi/app/routers/dashboard.py`
- Modify: `finext-fastapi/app/crud/dashboard.py`

- [ ] **Step 1: Add broker CRUD functions in `crud/dashboard.py`**

Thêm sau function `_get_recent_transactions` (dòng 354), trước `get_dashboard_stats`:

```python
async def _get_broker_revenue_kpi(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, broker_code: str
) -> float:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "broker_code_applied": broker_code,
        }},
        {"$group": {"_id": None, "total": {"$sum": "$transaction_amount"}}},
    ]
    result = await db.transactions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def _get_broker_order_count(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, broker_code: str, status: str
) -> int:
    return await db.transactions.count_documents({
        "payment_status": status,
        "created_at": {"$gte": start, "$lt": end},
        "broker_code_applied": broker_code,
    })


async def _get_broker_revenue_trend(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, granularity: str, broker_code: str
) -> List[RevenueTrendItem]:
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "broker_code_applied": broker_code,
        }},
        {"$group": {
            "_id": _get_date_group_expr(granularity),
            "revenue": {"$sum": "$transaction_amount"},
        }},
        {"$sort": {"_id": 1}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(366)
    return [
        RevenueTrendItem(
            date=_format_date_key(r["_id"], granularity),
            revenue=round(r["revenue"], 0),
        )
        for r in results
    ]


async def _get_broker_recent_transactions(
    db: AsyncIOMotorDatabase, broker_code: str, limit: int = 10
) -> List[RecentTransactionItem]:
    cursor = db.transactions.find(
        {"broker_code_applied": broker_code}
    ).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)

    buyer_ids = list({doc["buyer_user_id"] for doc in docs if doc.get("buyer_user_id")})
    user_docs = await db.users.find({"_id": {"$in": buyer_ids}}).to_list(limit)
    email_map = {doc["_id"]: doc.get("email", "") for doc in user_docs}

    items = []
    for doc in docs:
        buyer_email = email_map.get(doc.get("buyer_user_id"), "")
        items.append(RecentTransactionItem(
            id=str(doc["_id"]),
            buyer_email=buyer_email,
            license_key=doc.get("license_key", ""),
            transaction_amount=doc.get("transaction_amount", 0),
            payment_status=doc.get("payment_status", ""),
            transaction_type=doc.get("transaction_type", ""),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
        ))
    return items


async def get_broker_dashboard_stats(
    db: AsyncIOMotorDatabase,
    start_date: datetime,
    end_date: datetime,
    broker_code: str,
) -> DashboardStatsResponse:
    """Dashboard stats filtered to a specific broker's referrals only."""
    period_delta = end_date - start_date
    prev_start = start_date - period_delta
    prev_end = start_date
    granularity = _get_granularity(start_date, end_date)

    (
        current_revenue,
        current_orders,
        current_pending,
        prev_revenue,
        prev_orders,
        prev_pending,
    ) = await asyncio.gather(
        _get_broker_revenue_kpi(db, start_date, end_date, broker_code),
        _get_broker_order_count(db, start_date, end_date, broker_code, "succeeded"),
        _get_broker_order_count(db, start_date, end_date, broker_code, "pending"),
        _get_broker_revenue_kpi(db, prev_start, prev_end, broker_code),
        _get_broker_order_count(db, prev_start, prev_end, broker_code, "succeeded"),
        _get_broker_order_count(db, prev_start, prev_end, broker_code, "pending"),
    )

    (revenue_trend, recent_transactions) = await asyncio.gather(
        _get_broker_revenue_trend(db, start_date, end_date, granularity, broker_code),
        _get_broker_recent_transactions(db, broker_code),
    )

    return DashboardStatsResponse(
        period=PeriodRange(start_date=start_date, end_date=end_date),
        previous_period=PeriodRange(start_date=prev_start, end_date=prev_end),
        granularity=granularity,
        total_users=0,
        kpis=KpiStats(
            total_revenue=KpiMetric(current=current_revenue, previous=prev_revenue),
            successful_orders=KpiMetric(current=current_orders, previous=prev_orders),
            pending_orders=KpiMetric(current=current_pending, previous=prev_pending),
        ),
        revenue_trend=revenue_trend,
        recent_transactions=recent_transactions,
    )
```

- [ ] **Step 2: Update `routers/dashboard.py` — add imports and custom dependency**

Thay toàn bộ nội dung `finext-fastapi/app/routers/dashboard.py`:

```python
# finext-fastapi/app/routers/dashboard.py
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.auth.dependencies import get_current_active_user
from app.auth.access import get_user_permissions
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.schemas.dashboard import DashboardStatsResponse
from app.crud import dashboard as crud_dashboard

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dashboard"])


async def _require_dashboard_access(
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
) -> UserInDB:
    """Cho phép user có transaction:read_any HOẶC transaction:read_referred."""
    user_perms = await get_user_permissions(db, str(current_user.id))
    if "transaction:read_any" not in user_perms and "transaction:read_referred" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem dashboard statistics.",
        )
    return current_user


@router.get(
    "/stats",
    response_model=StandardApiResponse[DashboardStatsResponse],
    summary="Get dashboard statistics with date range",
)
@api_response_wrapper(default_success_message="Dashboard stats retrieved successfully.")
async def get_dashboard_stats(
    start_date: datetime = Query(None, description="Start date (ISO format). Default: 30 days ago"),
    end_date: datetime = Query(None, description="End date (ISO format). Default: now"),
    current_user: UserInDB = Depends(_require_dashboard_access),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    now = datetime.now(timezone.utc)

    if end_date is None:
        end_date = now
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0 and end_date.microsecond == 0:
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    if end_date > now:
        end_date = now

    if start_date >= end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before end_date",
        )

    # Broker: chỉ trả data của referral họ
    user_perms = await get_user_permissions(db, str(current_user.id))
    if "transaction:read_any" not in user_perms:
        # Broker role — lấy broker_code từ referral_code của user
        broker_code = current_user.referral_code
        if not broker_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không tìm thấy mã broker của bạn.",
            )
        return await crud_dashboard.get_broker_dashboard_stats(db, start_date, end_date, broker_code)

    return await crud_dashboard.get_dashboard_stats(db, start_date, end_date)
```

- [ ] **Step 3: Verify dashboard still works for admin**

```bash
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8000/api/v1/dashboard/stats"
```
Expected: Full stats response với đủ KPI, charts, tables.

- [ ] **Step 4: Verify broker gets filtered dashboard**

```bash
curl -H "Authorization: Bearer <broker_token>" \
  "http://localhost:8000/api/v1/dashboard/stats"
```
Expected: Response chỉ có `total_revenue`, `successful_orders`, `pending_orders` trong kpis (các field khác = 0/empty), `recent_transactions` chỉ gồm transactions có `broker_code_applied` = broker's referral_code.

- [ ] **Step 5: Commit**

```bash
git add finext-fastapi/app/routers/dashboard.py finext-fastapi/app/crud/dashboard.py
git commit -m "feat(dashboard): add broker-filtered dashboard stats"
```

---

## Task 4: Frontend — Add `permissions` to SessionData

**Files:**
- Modify: `finext-nextjs/services/core/session.ts`

- [ ] **Step 1: Update `SessionData` interface**

Trong `finext-nextjs/services/core/session.ts`, thay `SessionData`:

```typescript
export interface SessionData {
  accessToken: string;
  user: User;
  features: string[];
  permissions: string[];  // ADD: danh sách permission names
}
```

- [ ] **Step 2: Update `getSession()` to normalize permissions**

Trong hàm `getSession()`, sau dòng `parsed.features = Array.isArray(parsed.features) ? parsed.features : [];`, thêm:

```typescript
parsed.permissions = Array.isArray(parsed.permissions) ? parsed.permissions : [];
```

- [ ] **Step 3: Add `getPermissions()` helper**

Sau hàm `getFeatures()`:

```typescript
export function getPermissions(): string[] {
  const session = getSession();
  return session?.permissions || [];
}
```

- [ ] **Step 4: Add `updatePermissions()` helper**

Sau hàm `updateFeatures()`:

```typescript
export function updatePermissions(permissions: string[]): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, permissions };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add finext-nextjs/services/core/session.ts
git commit -m "feat(session): add permissions array to SessionData"
```

---

## Task 5: Frontend — Update AuthProvider with `hasPermission()`

**Files:**
- Modify: `finext-nextjs/components/auth/AuthProvider.tsx`

- [ ] **Step 1: Update `AuthContextType` interface**

Thêm `permissions` và `hasPermission` vào interface `AuthContextType` (dòng 17-26):

```typescript
interface AuthContextType {
  session: SessionData | null;
  features: string[];
  permissions: string[];          // ADD
  login: (sessionData: SessionData) => void;
  logout: () => void;
  loading: boolean;
  hasFeature: (featureKey: string) => boolean;
  hasPermission: (permKey: string) => boolean;  // ADD
  refreshSessionData: () => Promise<void>;
}
```

- [ ] **Step 2: Add `permissions` state**

Sau dòng `const [features, setFeatures] = useState<string[]>([]);` (dòng 32):

```typescript
const [permissions, setPermissions] = useState<string[]>([]);
```

- [ ] **Step 3: Fetch permissions in `fetchAndSetSessionData`**

Trong `fetchAndSetSessionData`, thêm fetch permissions song song với user và features.

Thay dòng 47-62 (từ `const userResponse` đến kết thúc `if` block):

```typescript
const [userResponse, featuresResponse, permissionsResponse] = await Promise.all([
  apiClient<UserSchema>({ url: '/api/v1/auth/me', method: 'GET' }),
  apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET' }),
  apiClient<string[]>({ url: '/api/v1/auth/me/permissions', method: 'GET' }),
]);

if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
  const newSessionData: SessionData = {
    user: userResponse.data,
    accessToken: tokenToUse,
    features: featuresResponse.data || [],
    permissions: permissionsResponse.data || [],
  };
  saveSessionToStorage(newSessionData);
  setSession(newSessionData);
  setFeatures(newSessionData.features);
  setPermissions(newSessionData.permissions);
} else {
  throw new Error(userResponse.message || featuresResponse.message || "Failed to fetch user/features data.");
}
```

- [ ] **Step 4: Update `logout` to clear permissions**

Trong hàm `logout`, sau `setFeatures([]);`:

```typescript
setPermissions([]);
```

- [ ] **Step 5: Update `login` to set permissions**

Trong hàm `login`, sau `setFeatures(sessionData.features || []);`:

```typescript
setPermissions(sessionData.permissions || []);
```

- [ ] **Step 6: Add `hasPermission` callback**

Sau hàm `hasFeature` (dòng 166-168):

```typescript
const hasPermission = useCallback((permKey: string): boolean => {
  return permissions.includes(permKey);
}, [permissions]);
```

- [ ] **Step 7: Update `AuthContext.Provider` value**

Thay dòng 171:

```typescript
<AuthContext.Provider value={{ session, features, permissions, login, logout, loading, hasFeature, hasPermission, refreshSessionData }}>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add finext-nextjs/components/auth/AuthProvider.tsx
git commit -m "feat(auth): add permissions state and hasPermission() to AuthProvider"
```

---

## Task 6: Frontend — Navigation filtering + route guard in LayoutContent

**Files:**
- Modify: `finext-nextjs/app/admin/LayoutContent.tsx`

- [ ] **Step 1: Update `NavItem` interface to include permission**

Thay interface `NavItem` (dòng 48-52):

```typescript
interface NavItem {
  text: string;
  href: string;
  icon: React.ReactElement<SvgIconProps>;
  requiredPermission?: string | string[];  // ADD: undefined = luôn hiện
}
```

- [ ] **Step 2: Update `navigationStructure` với permissions**

Thay toàn bộ `navigationStructure` (dòng 60-104):

```typescript
const navigationStructure: (NavItem | NavGroup)[] = [
  { text: 'Dashboard', href: '/admin/dashboard', icon: <DashboardIcon /> },
  {
    groupText: 'Account Management',
    groupIcon: <ManageAccounts />,
    subItems: [
      { text: 'Users', href: '/admin/users', icon: <PeopleIcon />, requiredPermission: 'user:list' },
      { text: 'Brokers', href: '/admin/brokers', icon: <BusinessCenter />, requiredPermission: 'broker:list' },
    ],
  },
  {
    groupText: 'Payment Management',
    groupIcon: <ShoppingCart />,
    subItems: [
      { text: 'Transactions', href: '/admin/transactions', icon: <ReceiptLong />, requiredPermission: ['transaction:read_any', 'transaction:read_referred'] },
      { text: 'Subscriptions', href: '/admin/subscriptions', icon: <Receipt />, requiredPermission: 'subscription:read_any' },
      { text: 'Promotions', href: '/admin/promotions', icon: <Campaign />, requiredPermission: 'promotion:manage' },
    ],
  },
  {
    groupText: 'Licenses & Features',
    groupIcon: <Policy />,
    subItems: [
      { text: 'Licenses', href: '/admin/licenses', icon: <VerifiedUser />, requiredPermission: 'license:manage' },
      { text: 'Features', href: '/admin/features', icon: <Category />, requiredPermission: 'feature:manage' },
    ],
  },
  {
    groupText: 'Roles & Permissions',
    groupIcon: <AdminPanelSettings />,
    subItems: [
      { text: 'Roles', href: '/admin/roles', icon: <Security />, requiredPermission: 'role:manage' },
      { text: 'Permissions', href: '/admin/permissions', icon: <Gavel />, requiredPermission: 'permission:manage' },
    ],
  },
  {
    groupText: 'User Data',
    groupIcon: <ContactPage />,
    subItems: [
      { text: 'Watchlists', href: '/admin/watchlists', icon: <ListAlt />, requiredPermission: 'watchlist:manage_any' },
      { text: 'Sessions', href: '/admin/sessions', icon: <Devices />, requiredPermission: 'session:manage_any' },
      { text: 'Otps', href: '/admin/otps', icon: <VpnKey />, requiredPermission: 'otp:manage' },
    ],
  },
];
```

- [ ] **Step 3: Add `hasPermission` to the hook destructure**

Thay dòng 107:

```typescript
const { session, loading: authLoading, logout, hasPermission } = useAuth();
```

- [ ] **Step 4: Add permission check helper function**

Thêm sau dòng `const showHamburgerMenu = !isDesktop;` (sau dòng 126):

```typescript
/** Kiểm tra item có được phép hiển thị không */
const canViewItem = (item: NavItem): boolean => {
  if (!item.requiredPermission) return true;
  if (Array.isArray(item.requiredPermission)) {
    return item.requiredPermission.some(p => hasPermission(p));
  }
  return hasPermission(item.requiredPermission);
};
```

- [ ] **Step 5: Add route guard useEffect**

Thêm `useEffect` sau dòng `const [mobileOpen, setMobileOpen] = useState(false);` (dòng 117):

```typescript
// Route guard: redirect nếu user không có quyền truy cập route hiện tại
useEffect(() => {
  if (authLoading || !session) return;

  // Map route → required permission (dùng same logic như navigationStructure)
  const routePermissions: Record<string, string | string[]> = {
    '/admin/users': 'user:list',
    '/admin/brokers': 'broker:list',
    '/admin/transactions': ['transaction:read_any', 'transaction:read_referred'],
    '/admin/subscriptions': 'subscription:read_any',
    '/admin/promotions': 'promotion:manage',
    '/admin/licenses': 'license:manage',
    '/admin/features': 'feature:manage',
    '/admin/roles': 'role:manage',
    '/admin/permissions': 'permission:manage',
    '/admin/watchlists': 'watchlist:manage_any',
    '/admin/sessions': 'session:manage_any',
    '/admin/otps': 'otp:manage',
  };

  // Tìm route match
  const matchedRoute = Object.keys(routePermissions).find(route =>
    currentPathname.startsWith(route)
  );

  if (!matchedRoute) return; // Dashboard hoặc route không trong map → OK

  const required = routePermissions[matchedRoute];
  const allowed = Array.isArray(required)
    ? required.some(p => hasPermission(p))
    : hasPermission(required);

  if (!allowed) {
    router.replace('/admin/dashboard');
  }
}, [currentPathname, authLoading, session, hasPermission, router]);
```

- [ ] **Step 6: Filter nav items in `renderExpandedGroup`**

Trong hàm `renderExpandedGroup` (dòng 192), tìm chỗ render `group.subItems.map(subItem => ...` và thêm filter:

Thay `{group.subItems.map(subItem => {` thành:

```typescript
{group.subItems.filter(canViewItem).map(subItem => {
```

- [ ] **Step 7: Hide entire group if all sub-items hidden**

Trong hàm `renderExpandedGroup`, bọc return bằng check:

Ngay đầu hàm `renderExpandedGroup`, sau dòng `const isGroupActive = ...`:

```typescript
const visibleSubItems = group.subItems.filter(canViewItem);
if (visibleSubItems.length === 0) return null;
```

Và thay `group.subItems.some(sub => currentPathname.startsWith(sub.href))` thành dùng `visibleSubItems`:

```typescript
const isGroupActive = visibleSubItems.some(sub => currentPathname.startsWith(sub.href));
```

- [ ] **Step 8: Find where navigationStructure is rendered and add group filter**

Tìm chỗ `navigationStructure.map(...)` trong JSX render, thêm filter cho top-level NavItem:

Bao mỗi render của `navigationStructure` items với check:
- NavItem (top-level không phải group): `if (!canViewItem(item)) return null;`
- NavGroup: đã xử lý trong `renderExpandedGroup`

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 10: Manual verify — Login as Manager**
- Menu Roles, Permissions, Sessions, OTPs, Brokers phải biến mất
- Menu Users, Transactions, Subscriptions, Licenses, Features, Promotions, Watchlists vẫn còn

- [ ] **Step 11: Manual verify — Login as Broker**
- Chỉ thấy Dashboard và Transactions
- Truy cập `/admin/users` trực tiếp → redirect về `/admin/dashboard`

- [ ] **Step 12: Commit**

```bash
git add finext-nextjs/app/admin/LayoutContent.tsx
git commit -m "feat(layout): filter navigation and add route guard by permissions"
```

---

## Task 7: Frontend — Broker dashboard view

**Files:**
- Modify: `finext-nextjs/app/admin/dashboard/PageContent.tsx`

- [ ] **Step 1: Add `useAuth` import và destructure**

Thêm import:

```typescript
import { useAuth } from '@/components/auth/AuthProvider';
```

Trong component function (sau các state declarations), thêm:

```typescript
const { session, hasPermission } = useAuth();
const isBroker = !hasPermission('transaction:read_any') && hasPermission('transaction:read_referred');
```

- [ ] **Step 2: Add BrokerInfoHeader component**

Thêm component mới ngay sau `SectionHeader` component definition:

```typescript
const BrokerInfoHeader: React.FC<{ name: string; referralCode: string }> = ({ name, referralCode }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2.5,
        mb: 3,
        borderRadius: `${borderRadius.lg}px`,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.main, 0.04)})`,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: fontWeight.bold,
          fontSize: '1.25rem',
          flexShrink: 0,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Box>
      <Box>
        <Typography variant="h6" fontWeight={fontWeight.semibold} color="text.primary">
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Mã broker: <strong style={{ color: theme.palette.primary.main }}>{referralCode}</strong>
        </Typography>
      </Box>
    </Box>
  );
};
```

- [ ] **Step 3: Render broker header and conditional charts**

Trong phần JSX return của PageContent, tìm chỗ render các section (sau `<TimeFilterBar ...>`).

Thêm broker info header và bọc các charts admin-only bằng điều kiện:

```tsx
{/* Broker Info Header — chỉ hiện cho broker */}
{isBroker && session?.user?.referral_code && (
  <BrokerInfoHeader
    name={session.user.full_name}
    referralCode={session.user.referral_code}
  />
)}

{/* KPI Cards — luôn hiện (backend đã filter data) */}
<KpiCards data={stats} isBroker={isBroker} />

{/* Charts chỉ admin/manager thấy */}
{!isBroker && (
  <>
    <SectionHeader icon={<TrendingUpIcon />} title="Xu hướng doanh thu" />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} lg={8}><RevenueTrendChart data={stats.revenue_trend} /></Grid>
      <Grid item xs={12} lg={4}><SubscriptionDonut data={stats.subscription_distribution} /></Grid>
    </Grid>

    <SectionHeader icon={<PieChartIcon />} title="Phân tích chi tiết" />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} lg={8}><UserGrowthChart data={stats.user_growth} /></Grid>
      <Grid item xs={12} lg={4}><TransactionDonut data={stats.transaction_status} /></Grid>
    </Grid>

    <SectionHeader icon={<PieChartIcon />} title="Doanh thu theo license" />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12}><RevenueByLicenseChart data={stats.revenue_by_license} /></Grid>
    </Grid>

    <SectionHeader icon={<EmojiEventsIcon />} title="Top performers" />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} md={6}><TopPromotionsChart data={stats.top_promotions} /></Grid>
      <Grid item xs={12} md={6}><TopBrokersChart data={stats.top_brokers} /></Grid>
    </Grid>
  </>
)}

{/* Revenue trend cho broker */}
{isBroker && stats.revenue_trend.length > 0 && (
  <>
    <SectionHeader icon={<TrendingUpIcon />} title="Xu hướng doanh thu của bạn" />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12}><RevenueTrendChart data={stats.revenue_trend} /></Grid>
    </Grid>
  </>
)}

{/* Recent Transactions — luôn hiện */}
<SectionHeader icon={<ReceiptLongIcon />} title={isBroker ? "Giao dịch qua mã của bạn" : "Giao dịch gần đây"} />
<RecentTransactions data={stats.recent_transactions} />
```

**Lưu ý:** Cần xem cấu trúc JSX hiện tại của `PageContent.tsx` để biết chính xác chỗ replace. Mục tiêu: bọc toàn bộ chart sections hiện tại trong `{!isBroker && (...)}`, giữ KpiCards và RecentTransactions ra ngoài, thêm BrokerInfoHeader ở đầu.

- [ ] **Step 4: Update KpiCards để nhận `isBroker` prop (nếu cần ẩn một số KPI)**

Mở `finext-nextjs/app/admin/dashboard/components/KpiCards.tsx` và xem props interface. Nếu cần ẩn KPI "New Users", "Churn Rate", "Active Subscriptions" cho broker, thêm `isBroker?: boolean` prop và conditional render.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```

- [ ] **Step 6: Manual verify — Login as broker, check dashboard**
- Thấy BrokerInfoHeader với tên và mã broker
- Chỉ thấy KPI cards liên quan (revenue, orders)
- Không thấy User Growth, Subscription Distribution, Top Promotions, Top Brokers
- Recent Transactions chỉ có giao dịch qua mã broker

- [ ] **Step 7: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/
git commit -m "feat(dashboard): add broker-specific view with info header and filtered charts"
```

---

## Task 8: Frontend — Disable buttons in Users page

**Files:**
- Modify: `finext-nextjs/app/admin/users/PageContent.tsx`

- [ ] **Step 1: Add `useAuth` import và destructure**

Thêm import:

```typescript
import { useAuth } from '@/components/auth/AuthProvider';
```

Trong `UsersPage` component, thêm sau các state declarations:

```typescript
const { hasPermission } = useAuth();
const canDeleteUser = hasPermission('user:delete_any');
const canManageRoles = hasPermission('user:manage_roles');
```

- [ ] **Step 2: Disable Delete button trong table row**

Tìm chỗ render Delete `IconButton` trong table row (vùng dòng ~920-925). Hiện tại nó được bọc trong `<span>`. Thêm `disabled` và tooltip:

```tsx
<Tooltip title={canDeleteUser ? "Xóa người dùng" : "Bạn không có quyền thực hiện thao tác này"}>
  <span>
    <IconButton
      size="small"
      onClick={() => { /* existing handler */ }}
      color="error"
      disabled={!canDeleteUser || isSystemUser(user.email)}
      sx={{ opacity: !canDeleteUser ? 0.4 : 1 }}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  </span>
</Tooltip>
```

- [ ] **Step 3: Disable "Gán Role" action nếu có**

Tìm button/action liên quan đến assign role (EditUserModal thường có phần assign role). Truyền prop `canManageRoles` vào `EditUserModal` để disable phần đó:

Tìm `<EditUserModal` và thêm prop:

```tsx
<EditUserModal
  // ... existing props
  canManageRoles={canManageRoles}
/>
```

Trong `EditUserModal.tsx`, nhận prop `canManageRoles?: boolean` và disable role selection khi `!canManageRoles`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```

- [ ] **Step 5: Manual verify — Login as Manager**
- Nút Delete bị greyed out, không click được
- Tooltip hiển thị "Bạn không có quyền thực hiện thao tác này"

- [ ] **Step 6: Commit**

```bash
git add finext-nextjs/app/admin/users/
git commit -m "feat(users): disable delete/manage-roles buttons for non-admin"
```

---

## Task 9: Frontend — Disable buttons in Transactions page

**Files:**
- Modify: `finext-nextjs/app/admin/transactions/PageContent.tsx`

- [ ] **Step 1: Add `useAuth` import và destructure**

Thêm import:

```typescript
import { useAuth } from '@/components/auth/AuthProvider';
```

Trong `TransactionsPage` component, thêm:

```typescript
const { hasPermission } = useAuth();
const canCreateTransaction = hasPermission('transaction:create_any');
const canConfirmTransaction = hasPermission('transaction:confirm_payment_any');
const canDeleteTransaction = hasPermission('transaction:delete_any');
```

- [ ] **Step 2: Disable "Tạo Transaction" button**

Tìm `<Button ... onClick={handleAddTransaction}` (vùng dòng ~547). Thêm `disabled` và wrap với `Tooltip`:

```tsx
<Tooltip title={canCreateTransaction ? "" : "Bạn không có quyền thực hiện thao tác này"}>
  <span>
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={handleAddTransaction}
      disabled={!canCreateTransaction}
      sx={{
        // ... existing sx
        opacity: !canCreateTransaction ? 0.5 : 1,
      }}
    >
      {/* ... existing content */}
    </Button>
  </span>
</Tooltip>
```

- [ ] **Step 3: Disable "Confirm Payment" IconButton**

Tìm `<IconButton ... onClick={() => handleConfirmPayment(transaction.id)}` (vùng dòng ~855). Thêm `disabled`:

```tsx
<Tooltip title={canConfirmTransaction ? "Confirm Payment Status" : "Bạn không có quyền thực hiện thao tác này"}>
  <span>
    <IconButton
      size="small"
      onClick={() => handleConfirmPayment(transaction.id)}
      color="success"
      disabled={!canConfirmTransaction}
      sx={{ opacity: !canConfirmTransaction ? 0.4 : 1 }}
    >
      <ConfirmIcon fontSize="small" />
    </IconButton>
  </span>
</Tooltip>
```

- [ ] **Step 4: Disable "Delete Transaction" IconButton**

Tìm `<IconButton ... onClick={() => handleOpenDeleteDialog(transaction)}` (vùng dòng ~816):

```tsx
<Tooltip title={canDeleteTransaction ? "Delete Transaction" : "Bạn không có quyền thực hiện thao tác này"}>
  <span>
    <IconButton
      size="small"
      onClick={() => handleOpenDeleteDialog(transaction)}
      color="error"
      disabled={!canDeleteTransaction}
      sx={{ opacity: !canDeleteTransaction ? 0.4 : 1 }}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  </span>
</Tooltip>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```

- [ ] **Step 6: Manual verify — Login as Broker**
- Nút "Tạo Transaction", Delete, Confirm đều greyed out
- Tooltip đúng

- [ ] **Step 7: Commit**

```bash
git add finext-nextjs/app/admin/transactions/PageContent.tsx
git commit -m "feat(transactions): disable create/confirm/delete buttons by permission"
```

---

## Task 10: Frontend — Disable Delete button in Subscriptions page

**Files:**
- Modify: `finext-nextjs/app/admin/subscriptions/PageContent.tsx`

- [ ] **Step 1: Add `useAuth` import và destructure**

Thêm import:

```typescript
import { useAuth } from '@/components/auth/AuthProvider';
```

Trong component, thêm:

```typescript
const { hasPermission } = useAuth();
const canDeleteSubscription = hasPermission('subscription:delete_any');
```

- [ ] **Step 2: Disable Delete IconButton**

Tìm `<IconButton` render `<DeleteIcon` (vùng dòng ~715-719). Thêm `disabled` và Tooltip:

```tsx
<Tooltip title={canDeleteSubscription ? "Xóa subscription" : "Bạn không có quyền thực hiện thao tác này"}>
  <span>
    <IconButton
      size="small"
      onClick={() => { /* existing handler */ }}
      color="error"
      disabled={!canDeleteSubscription}
      sx={{ opacity: !canDeleteSubscription ? 0.4 : 1 }}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  </span>
</Tooltip>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd finext-nextjs && npx tsc --noEmit
```

- [ ] **Step 4: Manual verify — Login as Manager**
- Nút Delete subscription greyed out
- Admin thấy nút Delete bình thường

- [ ] **Step 5: Commit**

```bash
git add finext-nextjs/app/admin/subscriptions/PageContent.tsx
git commit -m "feat(subscriptions): disable delete button for non-admin"
```

---

## Task 11: Final integration test

- [ ] **Step 1: Test Admin role**
- Login với admin account
- Thấy đủ 13 menu items trong sidebar
- Tất cả buttons enabled
- Dashboard hiện full charts

- [ ] **Step 2: Test Manager role**
- Login với manager account
- Sidebar: không thấy Roles, Permissions, Sessions, OTPs, Brokers
- Trang Users: nút Delete và Gán Role greyed out với tooltip
- Trang Subscriptions: nút Delete greyed out
- Dashboard: hiện full như admin
- Truy cập `/admin/roles` trực tiếp → redirect `/admin/dashboard`

- [ ] **Step 3: Test Broker role**
- Login với broker account
- Sidebar: chỉ thấy Dashboard và Transactions
- Dashboard: thấy BrokerInfoHeader với tên + mã broker
- Dashboard: chỉ thấy KPI cards và Recent Transactions (filtered)
- Transactions: nút Tạo, Confirm, Delete đều greyed out
- Truy cập `/admin/users` trực tiếp → redirect `/admin/dashboard`

- [ ] **Step 4: Final commit nếu có fixup**

```bash
git add -p
git commit -m "fix(rbac): final adjustments after integration testing"
```
