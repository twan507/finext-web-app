# app/routers/watchlists.py
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.watchlists import WatchlistCreate, WatchlistPublic, WatchlistUpdate
from app.schemas.users import UserInDB
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission
import app.crud.watchlists as crud_watchlists

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/",
    response_model=StandardApiResponse[WatchlistPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[User] Tạo một danh sách theo dõi mới",
    dependencies=[Depends(require_permission("watchlist", "create_own"))],
)
@api_response_wrapper(
    default_success_message="Danh sách theo dõi được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_watchlist(
    watchlist_data: WatchlistCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_watchlist = await crud_watchlists.create_watchlist(db, user_id=current_user.id, watchlist_data=watchlist_data)
        if not created_watchlist:
            # CRUD create_watchlist raises ValueError if name exists, which is caught by wrapper
            # This would be an unexpected error if it returns None without raising
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo danh sách theo dõi do lỗi máy chủ.",
            )
        return WatchlistPublic.model_validate(created_watchlist)
    except ValueError as ve: # Catch duplicate name error
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/me",
    response_model=StandardApiResponse[List[WatchlistPublic]],
    summary="[User] Lấy tất cả danh sách theo dõi của người dùng hiện tại",
    dependencies=[Depends(require_permission("watchlist", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách theo dõi thành công.")
async def read_my_watchlists(
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100), # Max 100 watchlists per user seems reasonable
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    watchlists_in_db = await crud_watchlists.get_watchlists_by_user_id(db, user_id=current_user.id, skip=skip, limit=limit)
    return [WatchlistPublic.model_validate(wl) for wl in watchlists_in_db]


@router.get(
    "/{watchlist_id}",
    response_model=StandardApiResponse[WatchlistPublic],
    summary="[User] Lấy chi tiết một danh sách theo dõi theo ID",
    dependencies=[Depends(require_permission("watchlist", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin danh sách theo dõi thành công.")
async def read_my_watchlist_by_id(
    watchlist_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    watchlist = await crud_watchlists.get_watchlist_by_id(db, watchlist_id=watchlist_id)
    if watchlist is None or str(watchlist.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Danh sách theo dõi với ID {watchlist_id} không được tìm thấy hoặc bạn không có quyền truy cập.",
        )
    return WatchlistPublic.model_validate(watchlist)

@router.put(
    "/{watchlist_id}",
    response_model=StandardApiResponse[WatchlistPublic],
    summary="[User] Cập nhật một danh sách theo dõi",
    dependencies=[Depends(require_permission("watchlist", "update_own"))],
)
@api_response_wrapper(default_success_message="Cập nhật danh sách theo dõi thành công.")
async def update_my_watchlist(
    watchlist_id: PyObjectId,
    watchlist_data: WatchlistUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_watchlist = await crud_watchlists.update_watchlist(
            db, watchlist_id=watchlist_id, user_id=current_user.id, watchlist_update_data=watchlist_data
        )
    except ValueError as ve: # Catch duplicate name error from CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    if updated_watchlist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Danh sách theo dõi với ID {watchlist_id} không tìm thấy hoặc bạn không có quyền cập nhật.",
        )
    return WatchlistPublic.model_validate(updated_watchlist)


@router.delete(
    "/{watchlist_id}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="[User] Xóa một danh sách theo dõi",
    dependencies=[Depends(require_permission("watchlist", "delete_own"))],
)
@api_response_wrapper(
    default_success_message="Danh sách theo dõi đã được xóa thành công.",
    success_status_code=status.HTTP_200_OK
)
async def delete_my_watchlist(
    watchlist_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    deleted = await crud_watchlists.delete_watchlist(db, watchlist_id=watchlist_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Danh sách theo dõi với ID {watchlist_id} không được tìm thấy hoặc bạn không có quyền xóa.",
        )
    return None # Wrapper handles the success message