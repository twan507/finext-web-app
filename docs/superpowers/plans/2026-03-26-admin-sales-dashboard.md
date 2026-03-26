# Admin Sales Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time sales dashboard replacing the current dummy admin dashboard, with backend aggregation APIs and ApexCharts visualizations.

**Architecture:** Single backend endpoint aggregates all dashboard data from MongoDB (transactions, users, subscriptions, promotions, brokers). Frontend calls this endpoint with date range params, renders 6 KPI cards + 7 charts + recent transactions table. Time filter bar with presets (7D/30D/3M/6M/1Y) and custom date range.

**Tech Stack:** FastAPI + Motor (MongoDB aggregation pipelines), Next.js + ApexCharts + MUI

---

## File Structure

### Backend (new files)
- `finext-fastapi/app/schemas/dashboard.py` — Response schemas for dashboard stats
- `finext-fastapi/app/crud/dashboard.py` — MongoDB aggregation queries
- `finext-fastapi/app/routers/dashboard.py` — API endpoint

### Backend (modify)
- `finext-fastapi/app/main.py` — Register dashboard router

### Frontend (new files)
- `finext-nextjs/app/admin/dashboard/types.ts` — TypeScript interfaces matching API response
- `finext-nextjs/app/admin/dashboard/components/TimeFilterBar.tsx` — Time range selector
- `finext-nextjs/app/admin/dashboard/components/KpiCards.tsx` — 6 KPI metric cards
- `finext-nextjs/app/admin/dashboard/components/RevenueTrendChart.tsx` — Area chart
- `finext-nextjs/app/admin/dashboard/components/UserGrowthChart.tsx` — Line chart
- `finext-nextjs/app/admin/dashboard/components/RevenueByLicenseChart.tsx` — Stacked bar chart
- `finext-nextjs/app/admin/dashboard/components/SubscriptionDonut.tsx` — Donut chart
- `finext-nextjs/app/admin/dashboard/components/TransactionDonut.tsx` — Donut chart
- `finext-nextjs/app/admin/dashboard/components/TopPromotionsChart.tsx` — Horizontal bar chart
- `finext-nextjs/app/admin/dashboard/components/TopBrokersChart.tsx` — Horizontal bar chart
- `finext-nextjs/app/admin/dashboard/components/RecentTransactions.tsx` — MUI Table

### Frontend (rewrite)
- `finext-nextjs/app/admin/dashboard/PageContent.tsx` — Main dashboard layout (replace dummy data)

---

## Task 1: Backend — Dashboard Response Schema

**Files:**
- Create: `finext-fastapi/app/schemas/dashboard.py`

- [ ] **Step 1: Create dashboard schema file**

```python
# finext-fastapi/app/schemas/dashboard.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PeriodRange(BaseModel):
    start_date: datetime
    end_date: datetime


class KpiMetric(BaseModel):
    current: float = 0
    previous: float = 0


class KpiStats(BaseModel):
    total_revenue: KpiMetric = Field(default_factory=KpiMetric)
    successful_orders: KpiMetric = Field(default_factory=KpiMetric)
    new_users: KpiMetric = Field(default_factory=KpiMetric)
    active_subscriptions: KpiMetric = Field(default_factory=KpiMetric)
    churn_rate: KpiMetric = Field(default_factory=KpiMetric)
    pending_orders: KpiMetric = Field(default_factory=KpiMetric)


class RevenueTrendItem(BaseModel):
    date: str  # "2026-03-01" or "2026-W12" or "2026-03"
    revenue: float = 0


class UserGrowthItem(BaseModel):
    date: str
    total_users: int = 0
    new_users: int = 0


class RevenueByLicenseItem(BaseModel):
    license_key: str
    license_name: str = ""
    revenue: float = 0
    count: int = 0


class SubscriptionDistributionItem(BaseModel):
    license_key: str
    license_name: str = ""
    count: int = 0


class TransactionStatusStats(BaseModel):
    succeeded: int = 0
    pending: int = 0
    canceled: int = 0


class TopPromotionItem(BaseModel):
    code: str
    usage_count: int = 0
    total_discount: float = 0


class TopBrokerItem(BaseModel):
    broker_code: str
    broker_name: str = ""
    total_revenue: float = 0
    order_count: int = 0


class RecentTransactionItem(BaseModel):
    id: str
    buyer_email: str = ""
    license_key: str = ""
    transaction_amount: float = 0
    payment_status: str = ""
    transaction_type: str = ""
    created_at: datetime


class DashboardStatsResponse(BaseModel):
    period: PeriodRange
    previous_period: PeriodRange
    granularity: str  # "day", "week", "month"
    kpis: KpiStats = Field(default_factory=KpiStats)
    revenue_trend: List[RevenueTrendItem] = []
    user_growth: List[UserGrowthItem] = []
    revenue_by_license: List[RevenueByLicenseItem] = []
    subscription_distribution: List[SubscriptionDistributionItem] = []
    transaction_status: TransactionStatusStats = Field(default_factory=TransactionStatusStats)
    top_promotions: List[TopPromotionItem] = []
    top_brokers: List[TopBrokerItem] = []
    recent_transactions: List[RecentTransactionItem] = []
```

- [ ] **Step 2: Commit**

```bash
git add finext-fastapi/app/schemas/dashboard.py
git commit -m "feat(dashboard): add response schemas for admin dashboard stats"
```

---

## Task 2: Backend — MongoDB Aggregation CRUD

**Files:**
- Create: `finext-fastapi/app/crud/dashboard.py`

**Key design decisions:**
- Granularity auto-detected: ≤31 days → daily, ≤180 days → weekly, >180 → monthly
- Previous period = same duration, immediately before start_date
- All money values in VND
- Top promotions/brokers limited to 5
- Recent transactions limited to 10

- [ ] **Step 1: Create CRUD file with all aggregation functions**

```python
# finext-fastapi/app/crud/dashboard.py
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.dashboard import (
    DashboardStatsResponse, PeriodRange, KpiStats, KpiMetric,
    RevenueTrendItem, UserGrowthItem, RevenueByLicenseItem,
    SubscriptionDistributionItem, TransactionStatusStats,
    TopPromotionItem, TopBrokerItem, RecentTransactionItem,
)

logger = logging.getLogger(__name__)


def _get_granularity(start: datetime, end: datetime) -> str:
    """Tự động xác định granularity dựa trên khoảng thời gian."""
    delta_days = (end - start).days
    if delta_days <= 31:
        return "day"
    elif delta_days <= 180:
        return "week"
    return "month"


def _get_date_group_expr(granularity: str) -> Dict[str, Any]:
    """Tạo MongoDB $group expression cho date aggregation."""
    if granularity == "day":
        return {
            "year": {"$year": "$created_at"},
            "month": {"$month": "$created_at"},
            "day": {"$dayOfMonth": "$created_at"},
        }
    elif granularity == "week":
        return {
            "year": {"$isoWeekYear": "$created_at"},
            "week": {"$isoWeek": "$created_at"},
        }
    return {
        "year": {"$year": "$created_at"},
        "month": {"$month": "$created_at"},
    }


def _format_date_key(group_id: Dict, granularity: str) -> str:
    """Format date key từ MongoDB group _id."""
    if granularity == "day":
        return f"{group_id['year']}-{group_id['month']:02d}-{group_id['day']:02d}"
    elif granularity == "week":
        return f"{group_id['year']}-W{group_id['week']:02d}"
    return f"{group_id['year']}-{group_id['month']:02d}"


async def _get_revenue_kpi(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> float:
    """Tổng doanh thu (transactions succeeded) trong kỳ."""
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {"_id": None, "total": {"$sum": "$transaction_amount"}}},
    ]
    result = await db.transactions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def _get_order_count(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, status: str
) -> int:
    """Đếm số transactions theo status trong kỳ."""
    return await db.transactions.count_documents({
        "payment_status": status,
        "created_at": {"$gte": start, "$lt": end},
    })


async def _get_new_users_count(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> int:
    """Đếm user mới trong kỳ."""
    return await db.users.count_documents({
        "created_at": {"$gte": start, "$lt": end},
    })


async def _get_active_subscriptions_count(db: AsyncIOMotorDatabase) -> int:
    """Tổng subscriptions đang active (snapshot hiện tại)."""
    return await db.subscriptions.count_documents({"is_active": True})


async def _get_churn_rate(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> float:
    """Tỷ lệ churn: subscriptions hết hạn trong kỳ / tổng active đầu kỳ."""
    expired_count = await db.subscriptions.count_documents({
        "expiry_date": {"$gte": start, "$lt": end},
        "is_active": False,
    })
    active_at_start = await db.subscriptions.count_documents({
        "start_date": {"$lt": start},
        "$or": [
            {"expiry_date": {"$gte": start}},
            {"is_active": True},
        ],
    })
    if active_at_start == 0:
        return 0
    return round((expired_count / active_at_start) * 100, 1)


async def _get_revenue_trend(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, granularity: str
) -> List[RevenueTrendItem]:
    """Doanh thu theo thời gian (day/week/month)."""
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
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


async def _get_user_growth(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, granularity: str
) -> List[UserGrowthItem]:
    """User growth: tổng users + new users theo thời gian."""
    # Tổng users trước start_date (baseline)
    baseline = await db.users.count_documents({"created_at": {"$lt": start}})

    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": _get_date_group_expr(granularity),
            "new_users": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    results = await db.users.aggregate(pipeline).to_list(366)

    items = []
    running_total = baseline
    for r in results:
        running_total += r["new_users"]
        items.append(UserGrowthItem(
            date=_format_date_key(r["_id"], granularity),
            total_users=running_total,
            new_users=r["new_users"],
        ))
    return items


async def _get_revenue_by_license(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> List[RevenueByLicenseItem]:
    """Doanh thu chia theo gói license."""
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": "$license_key",
            "revenue": {"$sum": "$transaction_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"revenue": -1}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(20)

    # Lookup license names
    items = []
    for r in results:
        license_doc = await db.licenses.find_one({"key": r["_id"]})
        items.append(RevenueByLicenseItem(
            license_key=r["_id"] or "Unknown",
            license_name=license_doc["name"] if license_doc else r["_id"] or "Unknown",
            revenue=round(r["revenue"], 0),
            count=r["count"],
        ))
    return items


async def _get_subscription_distribution(
    db: AsyncIOMotorDatabase,
) -> List[SubscriptionDistributionItem]:
    """Phân bổ subscriptions active theo gói (snapshot hiện tại)."""
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$license_key", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await db.subscriptions.aggregate(pipeline).to_list(20)

    items = []
    for r in results:
        license_doc = await db.licenses.find_one({"key": r["_id"]})
        items.append(SubscriptionDistributionItem(
            license_key=r["_id"] or "Unknown",
            license_name=license_doc["name"] if license_doc else r["_id"] or "Unknown",
            count=r["count"],
        ))
    return items


async def _get_transaction_status(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime
) -> TransactionStatusStats:
    """Phân bổ trạng thái giao dịch trong kỳ."""
    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$payment_status", "count": {"$sum": 1}}},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(10)
    stats = TransactionStatusStats()
    for r in results:
        status = r["_id"]
        if status == "succeeded":
            stats.succeeded = r["count"]
        elif status == "pending":
            stats.pending = r["count"]
        elif status == "canceled":
            stats.canceled = r["count"]
    return stats


async def _get_top_promotions(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, limit: int = 5
) -> List[TopPromotionItem]:
    """Top promotion codes theo lượt sử dụng."""
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "promotion_code_applied": {"$ne": None, "$exists": True},
        }},
        {"$group": {
            "_id": "$promotion_code_applied",
            "usage_count": {"$sum": 1},
            "total_discount": {"$sum": {"$ifNull": ["$promotion_discount_amount", 0]}},
        }},
        {"$sort": {"usage_count": -1}},
        {"$limit": limit},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(limit)
    return [
        TopPromotionItem(
            code=r["_id"],
            usage_count=r["usage_count"],
            total_discount=round(r["total_discount"], 0),
        )
        for r in results
    ]


async def _get_top_brokers(
    db: AsyncIOMotorDatabase, start: datetime, end: datetime, limit: int = 5
) -> List[TopBrokerItem]:
    """Top brokers theo doanh thu mang về."""
    pipeline = [
        {"$match": {
            "payment_status": "succeeded",
            "created_at": {"$gte": start, "$lt": end},
            "broker_code_applied": {"$ne": None, "$exists": True},
        }},
        {"$group": {
            "_id": "$broker_code_applied",
            "total_revenue": {"$sum": "$transaction_amount"},
            "order_count": {"$sum": 1},
        }},
        {"$sort": {"total_revenue": -1}},
        {"$limit": limit},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(limit)

    items = []
    for r in results:
        # Lookup broker name from brokers → user
        broker_doc = await db.brokers.find_one({"broker_code": r["_id"]})
        broker_name = r["_id"]
        if broker_doc:
            user_doc = await db.users.find_one({"_id": broker_doc.get("user_id")})
            if user_doc:
                broker_name = user_doc.get("full_name", r["_id"])
        items.append(TopBrokerItem(
            broker_code=r["_id"],
            broker_name=broker_name,
            total_revenue=round(r["total_revenue"], 0),
            order_count=r["order_count"],
        ))
    return items


async def _get_recent_transactions(
    db: AsyncIOMotorDatabase, limit: int = 10
) -> List[RecentTransactionItem]:
    """10 giao dịch gần nhất."""
    cursor = db.transactions.find().sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        # Lookup buyer email
        buyer_email = ""
        if doc.get("buyer_user_id"):
            user_doc = await db.users.find_one({"_id": doc["buyer_user_id"]})
            if user_doc:
                buyer_email = user_doc.get("email", "")
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


async def get_dashboard_stats(
    db: AsyncIOMotorDatabase,
    start_date: datetime,
    end_date: datetime,
) -> DashboardStatsResponse:
    """Main function: aggregate tất cả data cho dashboard."""
    # Tính previous period (cùng độ dài, ngay trước start_date)
    period_delta = end_date - start_date
    prev_start = start_date - period_delta
    prev_end = start_date

    granularity = _get_granularity(start_date, end_date)

    # KPIs — current period
    current_revenue = await _get_revenue_kpi(db, start_date, end_date)
    current_orders = await _get_order_count(db, start_date, end_date, "succeeded")
    current_new_users = await _get_new_users_count(db, start_date, end_date)
    current_active_subs = await _get_active_subscriptions_count(db)
    current_churn = await _get_churn_rate(db, start_date, end_date)
    current_pending = await _get_order_count(db, start_date, end_date, "pending")

    # KPIs — previous period
    prev_revenue = await _get_revenue_kpi(db, prev_start, prev_end)
    prev_orders = await _get_order_count(db, prev_start, prev_end, "succeeded")
    prev_new_users = await _get_new_users_count(db, prev_start, prev_end)
    prev_churn = await _get_churn_rate(db, prev_start, prev_end)
    prev_pending = await _get_order_count(db, prev_start, prev_end, "pending")

    # Charts & tables
    revenue_trend = await _get_revenue_trend(db, start_date, end_date, granularity)
    user_growth = await _get_user_growth(db, start_date, end_date, granularity)
    revenue_by_license = await _get_revenue_by_license(db, start_date, end_date)
    subscription_distribution = await _get_subscription_distribution(db)
    transaction_status = await _get_transaction_status(db, start_date, end_date)
    top_promotions = await _get_top_promotions(db, start_date, end_date)
    top_brokers = await _get_top_brokers(db, start_date, end_date)
    recent_transactions = await _get_recent_transactions(db)

    return DashboardStatsResponse(
        period=PeriodRange(start_date=start_date, end_date=end_date),
        previous_period=PeriodRange(start_date=prev_start, end_date=prev_end),
        granularity=granularity,
        kpis=KpiStats(
            total_revenue=KpiMetric(current=current_revenue, previous=prev_revenue),
            successful_orders=KpiMetric(current=current_orders, previous=prev_orders),
            new_users=KpiMetric(current=current_new_users, previous=prev_new_users),
            active_subscriptions=KpiMetric(current=current_active_subs, previous=current_active_subs),
            churn_rate=KpiMetric(current=current_churn, previous=prev_churn),
            pending_orders=KpiMetric(current=current_pending, previous=prev_pending),
        ),
        revenue_trend=revenue_trend,
        user_growth=user_growth,
        revenue_by_license=revenue_by_license,
        subscription_distribution=subscription_distribution,
        transaction_status=transaction_status,
        top_promotions=top_promotions,
        top_brokers=top_brokers,
        recent_transactions=recent_transactions,
    )
```

- [ ] **Step 2: Commit**

```bash
git add finext-fastapi/app/crud/dashboard.py
git commit -m "feat(dashboard): add MongoDB aggregation queries for dashboard stats"
```

---

## Task 3: Backend — API Router + Register

**Files:**
- Create: `finext-fastapi/app/routers/dashboard.py`
- Modify: `finext-fastapi/app/main.py`

- [ ] **Step 1: Create dashboard router**

```python
# finext-fastapi/app/routers/dashboard.py
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.auth.access import require_permission
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.schemas.dashboard import DashboardStatsResponse
from app.crud import dashboard as crud_dashboard

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dashboard"])


@router.get(
    "/stats",
    response_model=StandardApiResponse[DashboardStatsResponse],
    summary="[Admin] Get dashboard statistics with date range",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
)
@api_response_wrapper(default_success_message="Dashboard stats retrieved successfully.")
async def get_dashboard_stats(
    start_date: datetime = Query(
        None,
        description="Start date (ISO format). Default: 30 days ago",
    ),
    end_date: datetime = Query(
        None,
        description="End date (ISO format). Default: now",
    ),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    now = datetime.now(timezone.utc)

    if end_date is None:
        end_date = now
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    # Ensure timezone-aware
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)

    if start_date >= end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before end_date",
        )

    return await crud_dashboard.get_dashboard_stats(db, start_date, end_date)
```

- [ ] **Step 2: Register router in main.py**

Add after existing router registrations in `finext-fastapi/app/main.py`:

```python
from app.routers import dashboard
app.include_router(dashboard.router, prefix="/api/v1/admin/dashboard", tags=["dashboard"])
```

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/routers/dashboard.py finext-fastapi/app/main.py
git commit -m "feat(dashboard): add admin dashboard stats API endpoint"
```

---

## Task 4: Frontend — TypeScript Types

**Files:**
- Create: `finext-nextjs/app/admin/dashboard/types.ts`

- [ ] **Step 1: Create types matching API response**

```typescript
// finext-nextjs/app/admin/dashboard/types.ts

export interface PeriodRange {
    start_date: string;
    end_date: string;
}

export interface KpiMetric {
    current: number;
    previous: number;
}

export interface KpiStats {
    total_revenue: KpiMetric;
    successful_orders: KpiMetric;
    new_users: KpiMetric;
    active_subscriptions: KpiMetric;
    churn_rate: KpiMetric;
    pending_orders: KpiMetric;
}

export interface RevenueTrendItem {
    date: string;
    revenue: number;
}

export interface UserGrowthItem {
    date: string;
    total_users: number;
    new_users: number;
}

export interface RevenueByLicenseItem {
    license_key: string;
    license_name: string;
    revenue: number;
    count: number;
}

export interface SubscriptionDistributionItem {
    license_key: string;
    license_name: string;
    count: number;
}

export interface TransactionStatusStats {
    succeeded: number;
    pending: number;
    canceled: number;
}

export interface TopPromotionItem {
    code: string;
    usage_count: number;
    total_discount: number;
}

export interface TopBrokerItem {
    broker_code: string;
    broker_name: string;
    total_revenue: number;
    order_count: number;
}

export interface RecentTransactionItem {
    id: string;
    buyer_email: string;
    license_key: string;
    transaction_amount: number;
    payment_status: string;
    transaction_type: string;
    created_at: string;
}

export interface DashboardStatsResponse {
    period: PeriodRange;
    previous_period: PeriodRange;
    granularity: string;
    kpis: KpiStats;
    revenue_trend: RevenueTrendItem[];
    user_growth: UserGrowthItem[];
    revenue_by_license: RevenueByLicenseItem[];
    subscription_distribution: SubscriptionDistributionItem[];
    transaction_status: TransactionStatusStats;
    top_promotions: TopPromotionItem[];
    top_brokers: TopBrokerItem[];
    recent_transactions: RecentTransactionItem[];
}

// Time filter presets
export type TimePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';

// Currency formatter: auto VND/triệu/tỷ
export function formatCurrency(value: number): string {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
    if (value >= 1_000) return `${Math.round(value / 1_000)}K₫`;
    return `${Math.round(value)}₫`;
}

// Percentage change calculator
export function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}
```

- [ ] **Step 2: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/types.ts
git commit -m "feat(dashboard): add TypeScript types and utility functions"
```

---

## Task 5: Frontend — TimeFilterBar Component

**Files:**
- Create: `finext-nextjs/app/admin/dashboard/components/TimeFilterBar.tsx`

- [ ] **Step 1: Create time filter bar with presets + custom date range**

Component should:
- Render toggle buttons: 7D, 30D, 3M, 6M, 1Y, Tùy chỉnh
- When "Tùy chỉnh" selected → show 2 native date inputs (TextField type="date")
- Call `onChange(startDate, endDate)` when selection changes
- Use MUI ToggleButtonGroup, TextField, Popover
- Include a refresh IconButton

- [ ] **Step 2: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/components/TimeFilterBar.tsx
git commit -m "feat(dashboard): add TimeFilterBar component"
```

---

## Task 6: Frontend — KpiCards Component

**Files:**
- Create: `finext-nextjs/app/admin/dashboard/components/KpiCards.tsx`

- [ ] **Step 1: Create KPI cards grid**

Component should:
- Accept `kpis: KpiStats` prop
- Render 6 cards in responsive Grid (xs:12, sm:6, md:4, lg:2)
- Each card shows: icon, label, formatted value (formatCurrency for money), % change badge
- Change badge: green ArrowUpward if positive, red ArrowDownward if negative
- Use MUI Paper, Typography, Avatar, Chip
- Match existing admin card hover style

- [ ] **Step 2: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/components/KpiCards.tsx
git commit -m "feat(dashboard): add KpiCards component"
```

---

## Task 7: Frontend — Chart Components (7 charts)

**Files:**
- Create: `finext-nextjs/app/admin/dashboard/components/RevenueTrendChart.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/UserGrowthChart.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/RevenueByLicenseChart.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/SubscriptionDonut.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/TransactionDonut.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/TopPromotionsChart.tsx`
- Create: `finext-nextjs/app/admin/dashboard/components/TopBrokersChart.tsx`

All charts must:
- Use `dynamic(() => import('react-apexcharts'), { ssr: false })`
- Accept typed data props + `isDark: boolean` for theme
- Use `ApexOptions` type for configuration
- Responsive height (350px for main charts, 300px for smaller)

**Chart type mapping:**
| Component | ApexChart type | Data prop |
|-----------|---------------|-----------|
| RevenueTrendChart | `area` | `RevenueTrendItem[]` |
| UserGrowthChart | `line` (2 series) | `UserGrowthItem[]` |
| RevenueByLicenseChart | `bar` (horizontal) | `RevenueByLicenseItem[]` |
| SubscriptionDonut | `donut` | `SubscriptionDistributionItem[]` |
| TransactionDonut | `donut` | `TransactionStatusStats` |
| TopPromotionsChart | `bar` (horizontal) | `TopPromotionItem[]` |
| TopBrokersChart | `bar` (horizontal) | `TopBrokerItem[]` |

- [ ] **Step 1: Create all 7 chart components**
- [ ] **Step 2: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/components/
git commit -m "feat(dashboard): add 7 ApexCharts chart components"
```

---

## Task 8: Frontend — RecentTransactions Table

**Files:**
- Create: `finext-nextjs/app/admin/dashboard/components/RecentTransactions.tsx`

- [ ] **Step 1: Create recent transactions table**

Component should:
- Accept `transactions: RecentTransactionItem[]` prop
- MUI Table with columns: Email, Gói, Số tiền, Trạng thái, Loại, Thời gian
- Payment status chips: green=succeeded, orange=pending, red=canceled
- Format amount with formatCurrency
- Format date to Vietnamese locale
- Max 10 rows, no pagination needed

- [ ] **Step 2: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/components/RecentTransactions.tsx
git commit -m "feat(dashboard): add RecentTransactions table component"
```

---

## Task 9: Frontend — Rewrite PageContent.tsx (Main Dashboard)

**Files:**
- Rewrite: `finext-nextjs/app/admin/dashboard/PageContent.tsx`

- [ ] **Step 1: Rewrite main dashboard**

Component should:
- State: `timePreset`, `startDate`, `endDate`, `data`, `loading`, `error`
- On mount + on date change → call `apiClient({ url: '/api/v1/admin/dashboard/stats', queryParams: { start_date, end_date } })`
- Layout (top to bottom):
  1. TimeFilterBar + refresh button
  2. KpiCards (6 cards)
  3. RevenueTrendChart + UserGrowthChart (Grid 6:6)
  4. RevenueByLicenseChart + SubscriptionDonut + TransactionDonut (Grid 4:4:4)
  5. TopPromotionsChart + TopBrokersChart (Grid 6:6)
  6. RecentTransactions (full width)
- Loading state: MUI Skeleton placeholders
- Error state: Alert with retry button
- Use existing MUI Paper wrapper for each section

- [ ] **Step 2: TypeScript check**

```bash
cd finext-nextjs && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add finext-nextjs/app/admin/dashboard/
git commit -m "feat(dashboard): rewrite admin dashboard with real data and charts"
```

---

## Task 10: Final Integration Test

- [ ] **Step 1: Start backend and verify API**

```bash
# Test API endpoint
curl "http://localhost:8000/api/v1/admin/dashboard/stats" -H "Authorization: Bearer <token>"
```

Expected: JSON response with all dashboard data sections

- [ ] **Step 2: Start frontend and verify dashboard**

Open `http://localhost:3000/admin/dashboard` — verify:
- 6 KPI cards load with real numbers
- 7 charts render with data
- Time filter switches work (7D → 30D → 3M etc.)
- Custom date range works
- Refresh button reloads data
- Dark/light theme charts adapt
- Empty state: charts show "Không có dữ liệu" when no data

- [ ] **Step 3: Final commit**

```bash
git commit -m "feat(dashboard): complete admin sales dashboard integration"
```
