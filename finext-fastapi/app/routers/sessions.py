# finext-fastapi/app/routers/sessions.py
import logging
from typing import List, Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query # Bỏ Request vì không dùng trực tiếp trong file này nữa
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.database import get_database
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission 
# Giả sử bạn đã đổi tên schema hoặc file:
# Nếu file là active_sessions.py và class là ActiveSessionPublic, hãy dùng import đó
from app.schemas.sessions import SessionPublic # Sử dụng SessionPublic như trong snippet của bạn
from app.schemas.users import UserInDB
from app.crud.sessions import (
    get_sessions_by_user_id,
    delete_session_by_id, 
    get_all_sessions 
)
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

# Endpoint 1: Người dùng xem các session của chính mình
@router.get(
    "/me",
    response_model=StandardApiResponse[List[SessionPublic]],
    summary="Lấy danh sách các session đang hoạt động của người dùng hiện tại",
    dependencies=[Depends(require_permission("session", "list_self"))], 
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách session của bạn thành công.")
async def read_my_sessions(
    current_user: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    sessions = await get_sessions_by_user_id(db, str(current_user.id))
    # Cần đảm bảo rằng đối tượng trả về từ get_sessions_by_user_id
    # có thể được validate bởi SessionPublic.
    # Nếu get_sessions_by_user_id trả về List[ActiveSessionInDB], 
    # và SessionPublic tương thích, nó sẽ hoạt động.
    return [SessionPublic.model_validate(s) for s in sessions]

# Endpoint 2: Admin xem tất cả các session đang hoạt động
@router.get(
    "/all",
    response_model=StandardApiResponse[List[SessionPublic]],
    summary="[Admin] Lấy danh sách tất cả các session đang hoạt động trong hệ thống",
    dependencies=[Depends(require_permission("session", "list_any"))], 
    tags=["sessions", "admin"],
)
@api_response_wrapper(default_success_message="Lấy danh sách tất cả session thành công.")
async def read_all_system_sessions(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua (phân trang)"),
    limit: int = Query(100, ge=1, le=200, description="Số lượng bản ghi tối đa trả về (phân trang)"), 
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    # current_user được inject bởi require_permission, không cần khai báo lại ở đây trừ khi muốn dùng trực tiếp
):
    all_sessions_in_db = await get_all_sessions(db, skip=skip, limit=limit)
    return [SessionPublic.model_validate(s) for s in all_sessions_in_db]


# Endpoint 3: Người dùng tự xóa một session của họ
@router.delete(
    "/me/{session_id}",
    response_model=StandardApiResponse[None],
    summary="Người dùng tự xóa một session cụ thể của mình",
    dependencies=[Depends(require_permission("session", "delete_self"))], 
    tags=["sessions"],
)
@api_response_wrapper(default_success_message="Đăng xuất session thành công.")
async def delete_my_specific_session(
    session_id: PyObjectId,
    current_user: Annotated[UserInDB, Depends(get_current_active_user)], 
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # require_permission("session", "delete_self") đã kiểm tra quyền 
    # và đảm bảo session_id này thuộc về current_user (nếu logic trong access.py đúng)
    
    session_info = await db.sessions.find_one({"_id": ObjectId(session_id)})
    jti_to_log = session_info.get("jti", "N/A") if session_info else "N/A"

    # Kiểm tra lại lần nữa session có thực sự thuộc user không, để an toàn.
    # Điều này đã được thực hiện trong require_permission("session", "delete_self")
    # nếu bạn đã triển khai logic đó. Nếu chưa, bạn cần thêm ở đây:
    if not session_info or str(session_info.get("user_id")) != str(current_user.id):
        logger.warning(f"User {current_user.email} attempted to delete session ID {session_id} not belonging to them or not found (JTI: {jti_to_log}).")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không thể xóa session này.")

    deleted = await delete_session_by_id(db, session_id) 

    if not deleted:
        logger.warning(f"User {current_user.email} tried to delete session ID {session_id} (JTI: {jti_to_log}) but it was not found or failed to delete (possibly already deleted).")
        # Có thể trả về 404 nếu session không tìm thấy để xóa
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session không tìm thấy hoặc không thể xóa.")

    logger.info(f"User {current_user.email} self-deleted session ID {session_id} (JTI: {jti_to_log}).")
    return None


# Endpoint 4: Admin xóa bất kỳ session nào
@router.delete(
    "/{session_id}", 
    response_model=StandardApiResponse[None],
    summary="[Admin] Xóa bất kỳ session nào trong hệ thống",
    dependencies=[Depends(require_permission("session", "delete_any"))], 
    tags=["sessions", "admin"],
)
@api_response_wrapper(default_success_message="Session đã được xóa thành công bởi Admin.")
async def admin_delete_any_session(
    session_id: PyObjectId,
    # Sửa thứ tự tham số ở đây: current_admin đứng trước db
    current_admin: Annotated[UserInDB, Depends(get_current_active_user)],
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")) 
):
    session_to_delete = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session không tồn tại để xóa.")

    user_id_of_session = str(session_to_delete.get("user_id"))
    jti_of_session = session_to_delete.get("jti")

    deleted = await delete_session_by_id(db, session_id)

    if not deleted:
        logger.error(f"Admin {current_admin.email} failed to delete session ID {session_id} (JTI: {jti_of_session}, UserID: {user_id_of_session}).")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể xóa session.")

    logger.info(f"Admin {current_admin.email} deleted session ID {session_id} (JTI: {jti_of_session}, UserID: {user_id_of_session}).")
    return None
