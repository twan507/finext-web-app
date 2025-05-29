# finext-fastapi/app/routers/otps.py
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.otps import OtpGenerationRequest, OtpVerificationRequest, OtpVerificationResponse, OtpTypeEnum, OtpCreateInternal
from app.schemas.emails import MessageResponse  # For simple message responses
import app.crud.users as crud_users
import app.crud.otps as crud_otps
from app.utils.otp_utils import generate_otp_code
from app.utils.email_utils import send_otp_email  # Assuming you'll adapt this
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.core.config import OTP_EXPIRE_MINUTES


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/request",
    response_model=StandardApiResponse[MessageResponse],
    status_code=status.HTTP_200_OK,
    summary="Yêu cầu gửi mã OTP",
    description="Tạo và gửi mã OTP đến email của người dùng cho một mục đích cụ thể.",
    tags=["otps"],
)
@api_response_wrapper(
    default_success_message=f"Mã OTP đã được gửi. Vui lòng kiểm tra email. Mã có hiệu lực trong {OTP_EXPIRE_MINUTES} phút."
)
async def request_otp(
    request_data: OtpGenerationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await crud_users.get_user_by_email_db(db, request_data.email)
    if not user:
        logger.warning(f"OTP request for non-existent user email: {request_data.email}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng với email này không tồn tại.")

    if not user.is_active and request_data.otp_type != OtpTypeEnum.EMAIL_VERIFICATION:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tài khoản người dùng này chưa được kích hoạt hoặc đã bị khóa.")

    raw_otp_code = generate_otp_code()
    now = datetime.now(timezone.utc)

    otp_create_payload = OtpCreateInternal(
        user_id=str(user.id),
        otp_type=request_data.otp_type,
        otp_code=raw_otp_code,
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES),
        created_at=now,
    )

    created_otp_record = await crud_otps.create_otp_record(db, otp_create_payload)
    if not created_otp_record:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể tạo mã OTP. Vui lòng thử lại.")

    # Send email synchronously to catch errors
    try:
        await send_otp_email(
            email_to=user.email,
            full_name=user.full_name,
            otp_code=raw_otp_code,
            otp_type=request_data.otp_type,
            expiry_minutes=OTP_EXPIRE_MINUTES,
        )
    except Exception as e:
        # Log the error without cleanup
        logger.error(f"Failed to send OTP email: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể gửi email OTP. Vui lòng thử lại.")

    return MessageResponse(message=f"Mã OTP cho mục đích '{request_data.otp_type.value}' đã được gửi đến email của bạn. Vui lòng kiểm tra.")


@router.post("/verify", response_model=StandardApiResponse[OtpVerificationResponse], summary="Xác thực mã OTP", tags=["otps"])
@api_response_wrapper()  # Default success message will be overridden by the return value
async def verify_otp(
    request_data: OtpVerificationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await crud_users.get_user_by_email_db(db, request_data.email)
    if not user:
        logger.warning(f"OTP verification attempt for non-existent user email: {request_data.email}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng hoặc OTP không hợp lệ.")

    # Note: MAX_OTP_ATTEMPTS logic would go here or in the CRUD if implemented

    is_valid = await crud_otps.verify_and_use_otp(
        db, user_id=str(user.id), otp_type=request_data.otp_type, plain_otp_code=request_data.otp_code
    )

    if is_valid:
        # Perform actions after successful OTP verification, e.g., activate user
        if request_data.otp_type == OtpTypeEnum.EMAIL_VERIFICATION:
            if not user.is_active:
                await db.users.update_one(
                    {"_id": user.id},  # user.id is already ObjectId if from UserInDB
                    {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}},
                )
                logger.info(f"User {user.email} activated successfully via OTP.")
                return OtpVerificationResponse(success=True, message="Xác thực email thành công và tài khoản đã được kích hoạt.")

        return OtpVerificationResponse(success=True, message="Mã OTP đã được xác thực thành công.")
    else:
        # Do not explicitly say "OTP expired" or "OTP not found" to prevent enumeration
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")
