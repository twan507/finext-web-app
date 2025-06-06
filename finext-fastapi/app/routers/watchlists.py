# app/routers/watchlists.py
import logging
from typing import List, Optional  # Thêm Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.watchlists import WatchlistCreate, WatchlistPublic, WatchlistUpdate  # Giữ nguyên
from app.schemas.users import UserInDB  # Giữ nguyên UserInDB cho current_user
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission
import app.crud.watchlists as crud_watchlists

# <<<< PHẦN BỔ SUNG MỚI >>>>
from app.schemas.common import PaginatedResponse  # Import schema phân trang
# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được thêm ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[WatchlistPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[User] Tạo một danh sách theo dõi mới",
    dependencies=[Depends(require_permission("watchlist", "create_own"))],
    tags=["watchlists"],  # Thêm tags ở đây để Swagger UI nhóm lại
)
@api_response_wrapper(
    default_success_message="Danh sách theo dõi được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_watchlist(  # Đổi tên hàm cho rõ ràng
    watchlist_data: WatchlistCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_watchlist = await crud_watchlists.create_watchlist(db, user_id=current_user.id, watchlist_data=watchlist_data)  # type: ignore
        if not created_watchlist:
            # Lỗi này thường do ValueError từ CRUD (ví dụ tên trùng) hoặc lỗi DB không mong muốn
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,  # Hoặc 400 nếu lỗi từ ValueError
                detail="Không thể tạo danh sách theo dõi.",
            )
        return WatchlistPublic.model_validate(created_watchlist)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/me",
    response_model=StandardApiResponse[List[WatchlistPublic]],
    summary="[User] Lấy tất cả danh sách theo dõi của người dùng hiện tại",
    dependencies=[Depends(require_permission("watchlist", "read_own"))],
    tags=["watchlists"],
)
@api_response_wrapper(default_success_message="Lấy danh sách theo dõi thành công.")
async def read_my_watchlists(
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    watchlists_in_db = await crud_watchlists.get_watchlists_by_user_id(db, user_id=current_user.id, skip=skip, limit=limit)  # type: ignore
    return [WatchlistPublic.model_validate(wl) for wl in watchlists_in_db]


@router.get(
    "/{watchlist_id}",
    response_model=StandardApiResponse[WatchlistPublic],
    summary="[User] Lấy chi tiết một danh sách theo dõi theo ID",
    dependencies=[Depends(require_permission("watchlist", "read_own"))],
    tags=["watchlists"],
)
@api_response_wrapper(default_success_message="Lấy thông tin danh sách theo dõi thành công.")
async def read_my_watchlist_by_id(  # Đổi tên hàm
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
    tags=["watchlists"],
)
@api_response_wrapper(default_success_message="Cập nhật danh sách theo dõi thành công.")
async def update_my_watchlist(  # Đổi tên hàm
    watchlist_id: PyObjectId,
    watchlist_data: WatchlistUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_watchlist = await crud_watchlists.update_watchlist(
            db,
            watchlist_id=watchlist_id,
            user_id=current_user.id,
            watchlist_update_data=watchlist_data,  # type: ignore
        )
    except ValueError as ve:
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
    tags=["watchlists"],
)
@api_response_wrapper(default_success_message="Danh sách theo dõi đã được xóa thành công.", success_status_code=status.HTTP_200_OK)
async def delete_my_watchlist(  # Đổi tên hàm
    watchlist_id: PyObjectId,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    deleted = await crud_watchlists.delete_watchlist(db, watchlist_id=watchlist_id, user_id=current_user.id)  # type: ignore
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Danh sách theo dõi với ID {watchlist_id} không được tìm thấy hoặc bạn không có quyền xóa.",
        )
    return None


# <<<< PHẦN BỔ SUNG MỚI >>>>
@router.get(
    "/admin/all",
    response_model=StandardApiResponse[PaginatedResponse[WatchlistPublic]],
    summary="[Admin] Lấy danh sách tất cả watchlists của mọi user",
    dependencies=[Depends(require_permission("watchlist", "read_any"))],  # Cần permission mới
    tags=["watchlists_admin"],  # Có thể dùng tag riêng cho admin
)
@api_response_wrapper(default_success_message="Lấy danh sách tất cả watchlists thành công.")
async def admin_read_all_watchlists(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số lượng bản ghi tối đa mỗi trang (99999 cho 'All')"),
    user_id: Optional[PyObjectId] = Query(None, description="Lọc theo User ID (là chuỗi ObjectId)"),
    name_contains: Optional[str] = Query(None, description="Lọc theo tên watchlist chứa chuỗi này"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not hasattr(crud_watchlists, "get_all_watchlists_admin"):
        logger.error("CRUD function 'get_all_watchlists_admin' is not implemented in crud_watchlists.py")
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Admin list watchlists feature not fully implemented in CRUD."
        )

    watchlists_docs, total = await crud_watchlists.get_all_watchlists_admin(
        db, skip=skip, limit=limit, user_id_filter=user_id, name_filter=name_contains
    )
    # Nếu WatchlistPublicAdmin được định nghĩa và bạn muốn trả về user_email, cần logic join/populate ở CRUD
    items = [WatchlistPublic.model_validate(w) for w in watchlists_docs]
    return PaginatedResponse[WatchlistPublic](items=items, total=total)


@router.delete(
    "/admin/{watchlist_id}",
    response_model=StandardApiResponse[None],
    status_code=status.HTTP_200_OK,
    summary="[Admin] Xóa một watchlist bất kỳ theo ID",
    dependencies=[Depends(require_permission("watchlist", "delete_any"))],  # Cần permission mới
    tags=["watchlists_admin"],
)
@api_response_wrapper(default_success_message="Watchlist đã được xóa thành công bởi Admin.", success_status_code=status.HTTP_200_OK)
async def admin_delete_watchlist(
    watchlist_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user),  # Để log ai đã xóa (tùy chọn)
):
    if not hasattr(crud_watchlists, "delete_watchlist_by_admin"):
        logger.error("CRUD function 'delete_watchlist_by_admin' is not implemented in crud_watchlists.py")
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Admin delete watchlist feature not fully implemented in CRUD."
        )

    deleted = await crud_watchlists.delete_watchlist_by_admin(db, watchlist_id=watchlist_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist với ID {watchlist_id} không tìm thấy hoặc không thể xóa.",
        )
    logger.info(f"Admin {current_admin.email} deleted watchlist {watchlist_id}")
    return None


# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>
