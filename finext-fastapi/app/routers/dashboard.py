# finext-fastapi/app/routers/dashboard.py
import logging
from datetime import datetime, timezone, timedelta
from typing import Tuple, Set

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
) -> Tuple[UserInDB, Set[str]]:
    """Cho phép user có transaction:read_any HOẶC transaction:read_referred."""
    user_perms = await get_user_permissions(db, str(current_user.id))
    if "transaction:read_any" not in user_perms and "transaction:read_referred" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem dashboard statistics.",
        )
    return current_user, user_perms


@router.get(
    "/stats",
    response_model=StandardApiResponse[DashboardStatsResponse],
    summary="Get dashboard statistics with date range",
)
@api_response_wrapper(default_success_message="Dashboard stats retrieved successfully.")
async def get_dashboard_stats(
    start_date: datetime = Query(None, description="Start date (ISO format). Default: 30 days ago"),
    end_date: datetime = Query(None, description="End date (ISO format). Default: now"),
    access: Tuple[UserInDB, Set[str]] = Depends(_require_dashboard_access),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    current_user, user_perms = access
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
    if "transaction:read_any" not in user_perms:
        broker_code = current_user.referral_code
        if not broker_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không tìm thấy mã broker của bạn.",
            )
        return await crud_dashboard.get_broker_dashboard_stats(db, start_date, end_date, broker_code)

    return await crud_dashboard.get_dashboard_stats(db, start_date, end_date)
