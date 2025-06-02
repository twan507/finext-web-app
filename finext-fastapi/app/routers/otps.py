# finext-fastapi/app/routers/otps.py
import logging
from typing import Optional # Thêm Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query # Thêm Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.otps import (
    OtpPublic, # Sử dụng OtpPublic cho response
    OtpTypeEnum, # Import OtpTypeEnum
    # OtpRequestResponse, # Giữ lại nếu có endpoint request OTP
)
from app.schemas.users import UserInDB # Cho get_current_active_user
from app.schemas.common import PaginatedResponse # Import schema phân trang
from app.utils.types import PyObjectId
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.auth.dependencies import get_current_active_user
from app.auth.access import require_permission # Thêm require_permission
import app.crud.otps as crud_otps
# Các import khác nếu cần cho các endpoint hiện có (ví dụ: request_new_otp, verify_otp_code_endpoint)

logger = logging.getLogger(__name__)
router = APIRouter() # Prefix và tags sẽ được thêm ở main.py

# Ví dụ: các endpoint hiện có của bạn (nếu có) cho user
# @router.post("/request", ...)
# async def request_new_otp_endpoint(...): ...

# @router.post("/verify", ...)
# async def verify_otp_code_endpoint(...): ...


# <<<< PHẦN BỔ SUNG MỚI >>>>
@router.get(
    "/admin/all",
    response_model=StandardApiResponse[PaginatedResponse[OtpPublic]], # Trả về OtpPublic cho admin
    summary="[Admin] Lấy danh sách tất cả các bản ghi OTP",
    dependencies=[Depends(require_permission("otp", "read_any"))], # Cần permission mới
    tags=["otps_admin"], # Có thể dùng tag riêng cho admin
)
@api_response_wrapper(default_success_message="Lấy danh sách OTP records thành công.")
async def admin_read_all_otps(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=200, description="Số bản ghi tối đa mỗi trang"),
    user_id: Optional[PyObjectId] = Query(None, description="Lọc theo User ID (chuỗi ObjectId)"),
    otp_type: Optional[OtpTypeEnum] = Query(None, description="Lọc theo loại OTP"),
    status: Optional[str] = Query(None, description="Lọc theo trạng thái: 'pending', 'verified', 'expired', 'max_attempts'"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    if not hasattr(crud_otps, 'get_all_otps_admin'):
        logger.error("CRUD function 'get_all_otps_admin' is not implemented in crud_otps.py")
        raise HTTPException(status_code=501, detail="Admin list OTPs feature not fully implemented in CRUD.")

    otps_docs, total = await crud_otps.get_all_otps_admin(
        db, 
        skip=skip, 
        limit=limit, 
        user_id_filter=user_id, 
        otp_type_filter=otp_type, 
        status_filter=status
    )
    # OtpPublic không có hashed_otp_code, attempts. Nếu muốn admin xem,
    # cần tạo OtpAdminPublic từ OtpInDB hoặc trả về OtpInDB trực tiếp (cần sửa response_model).
    # Hiện tại, chúng ta trả về OtpPublic.
    items = [OtpPublic.model_validate(o) for o in otps_docs]
    return PaginatedResponse[OtpPublic](items=items, total=total)

@router.put(
    "/admin/{otp_id}/invalidate",
    response_model=StandardApiResponse[OtpPublic], # Trả về OtpPublic sau khi invalidate
    summary="[Admin] Vô hiệu hóa một OTP cụ thể",
    dependencies=[Depends(require_permission("otp", "invalidate_any"))], # Cần permission mới
    tags=["otps_admin"],
)
@api_response_wrapper(default_success_message="OTP đã được vô hiệu hóa thành công.")
async def admin_invalidate_otp(
    otp_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
    current_admin: UserInDB = Depends(get_current_active_user) # Để log (tùy chọn)
):
    if not hasattr(crud_otps, 'invalidate_otp_by_admin'):
        logger.error("CRUD function 'invalidate_otp_by_admin' is not implemented in crud_otps.py")
        raise HTTPException(status_code=501, detail="Admin invalidate OTP feature not fully implemented in CRUD.")

    invalidated_otp_db = await crud_otps.invalidate_otp_by_admin(db, otp_id)
    
    if not invalidated_otp_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"OTP với ID {otp_id} không tìm thấy hoặc không thể vô hiệu hóa.",
        )
    logger.info(f"Admin {current_admin.email} invalidated OTP {otp_id}")
    return OtpPublic.model_validate(invalidated_otp_db)
# <<<< KẾT THÚC PHẦN BỔ SUNG MỚI >>>>