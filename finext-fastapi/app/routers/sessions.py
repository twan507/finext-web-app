# finext-fastapi/app/routers/sessions.py
import logging
from typing import List, Annotated  # Thêm Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_database
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission

from app.schemas.sessions import SessionPublic  # Sử dụng SessionInDB nếu CRUD trả về

# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse  # Import schema phân trang

# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.users import UserInDB
from app.crud.sessions import get_sessions_by_user_id, delete_session_by_id, get_all_sessions  # get_all_sessions đã được cập nhật
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được đặt ở main.py


@router.get(
    "/me",
    response_model=StandardApiResponse[List[SessionPublic]],
    summary="Lấy danh sách các session đang hoạt động của người dùng hiện tại",
    dependencies=[Depends(require_permission("session", "manage_own"))],
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách session của bạn thành công.")
async def read_my_sessions(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    sessions_in_db = await get_sessions_by_user_id(db, str(current_user.id))
    # get_sessions_by_user_id trả về List[SessionInDB], SessionPublic tương thích
    return [SessionPublic.model_validate(s) for s in sessions_in_db]


# <<<< PHẦN CẬP NHẬT ENDPOINT /all >>>>
@router.get(
    "/all",
    response_model=StandardApiResponse[PaginatedResponse[SessionPublic]],  # SỬA RESPONSE MODEL
    summary="[Admin] Lấy danh sách tất cả các session đang hoạt động trong hệ thống",
    dependencies=[Depends(require_permission("session", "manage_any"))],
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách tất cả session thành công.")
async def read_all_system_sessions(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua (phân trang)"),
    limit: int = Query(100, ge=1, le=99999, description="Số lượng bản ghi tối đa trả về (99999 cho 'All')"),
    # Thêm các filter nếu bạn đã định nghĩa trong CRUD get_all_sessions, ví dụ:
    # user_id_filter: Optional[PyObjectId] = Query(None, description="Lọc theo User ID"),
    # device_info_filter: Optional[str] = Query(None, description="Lọc theo thông tin thiết bị (chứa)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    all_sessions_docs, total_count = await get_all_sessions(
        db,
        skip=skip,
        limit=limit,
        # user_id_filter=user_id_filter, # Truyền filter nếu có
        # device_info_filter=device_info_filter,
    )

    items = [SessionPublic.model_validate(s) for s in all_sessions_docs]
    return PaginatedResponse[SessionPublic](items=items, total=total_count)


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


@router.delete(
    "/me/{session_id}",
    response_model=StandardApiResponse[None],
    summary="Người dùng tự xóa một session cụ thể của mình",
    dependencies=[Depends(require_permission("session", "manage_own"))],
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Đăng xuất session thành công.")  # Giữ nguyên message
async def delete_my_specific_session(
    session_id: PyObjectId,
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    session_info = await db.sessions.find_one({"_id": ObjectId(session_id)})
    jti_to_log = session_info.get("jti", "N/A") if session_info else "N/A"

    # Kiểm tra lại session có thuộc user không (dù require_permission đã làm)
    if not session_info or str(session_info.get("user_id")) != str(current_user.id):
        logger.warning(
            f"User {current_user.email} attempted to delete session ID {session_id} not belonging to them or not found (JTI: {jti_to_log})."
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể xóa session này.")

    deleted = await delete_session_by_id(db, session_id)  # delete_session_by_id dùng _id

    if not deleted:
        logger.warning(
            f"User {current_user.email} tried to delete session ID {session_id} (JTI: {jti_to_log}) but it was not found or failed to delete."
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session không tìm thấy hoặc không thể xóa.")

    logger.info(f"User {current_user.email} self-deleted session ID {session_id} (JTI: {jti_to_log}).")
    return None


@router.delete(
    "/{session_id}",  # Endpoint này cho admin xóa session bất kỳ
    response_model=StandardApiResponse[None],
    summary="[Admin] Xóa bất kỳ session nào trong hệ thống bằng ID của session",
    dependencies=[Depends(require_permission("session", "manage_any"))],
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Session đã được xóa thành công bởi Admin.")
async def admin_delete_any_session(  # Đổi tên hàm
    session_id: PyObjectId,  # ID của session cần xóa
    current_admin: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    session_to_delete = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session không tồn tại để xóa.")

    user_id_of_session = str(session_to_delete.get("user_id"))
    jti_of_session = session_to_delete.get("jti", "N/A")

    # Admin không nên tự xóa session đang dùng của chính mình qua endpoint này
    # (Họ nên dùng /logout hoặc /me/{session_id} của chính họ)
    if str(current_admin.id) == user_id_of_session:
        logger.warning(f"Admin {current_admin.email} attempted to delete their own session {session_id} via admin endpoint. Denied.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin không thể tự xóa session của chính mình qua endpoint này. Sử dụng chức năng logout.",
        )

    deleted = await delete_session_by_id(db, session_id)  # delete_session_by_id dùng _id

    if not deleted:
        logger.error(
            f"Admin {current_admin.email} failed to delete session ID {session_id} (JTI: {jti_of_session}, UserID: {user_id_of_session})."
        )
        # Lỗi này không nên xảy ra nếu session_to_delete được tìm thấy trước đó
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể xóa session.")

    logger.info(f"Admin {current_admin.email} deleted session ID {session_id} (JTI: {jti_of_session}, UserID: {user_id_of_session}).")
    return None
