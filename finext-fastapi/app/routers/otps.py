# finext-fastapi/app/routers/otps.py
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.schemas.otps import (
    OtpGenerationRequest, OtpVerificationRequest,
    OtpVerificationResponse, OtpTypeEnum, OtpCreateInternal
)
from app.schemas.emails import MessageResponse # For simple message responses
import app.crud.users as crud_users
import app.crud.otps as crud_otps
from app.utils.otp_utils import generate_otp_code
from app.utils.email_utils import send_email_async # Assuming you'll adapt this
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.core.config import OTP_EXPIRE_MINUTES


logger = logging.getLogger(__name__)
router = APIRouter()

async def _send_otp_email_task(
    email_to: str,
    full_name: str,
    otp_code: str,
    otp_type: OtpTypeEnum,
    expiry_minutes: int
):
    """
    Background task to send OTP email.
    Adapt template_name and template_body as needed.
    """
    subject = ""
    template_name = "" # e.g., "otp_email_template.html"
    template_body = {
        "full_name": full_name,
        "otp_code": otp_code,
        "expiry_minutes": expiry_minutes,
        "current_year": datetime.now(timezone.utc).year
    }

    if otp_type == OtpTypeEnum.EMAIL_VERIFICATION:
        subject = "Mã OTP Xác Thực Email Finext"
        template_name = "otp_email_verification_template.html" # Create this template
        template_body["action_description"] = "xác thực địa chỉ email của bạn"
    elif otp_type == OtpTypeEnum.PASSWORD_RESET:
        subject = "Mã OTP Đặt Lại Mật Khẩu Finext"
        template_name = "otp_password_reset_template.html" # Create this template
        template_body["action_description"] = "đặt lại mật khẩu của bạn"
        # You might want to include a direct link for password reset if using OTP as part of that flow
        # template_body["reset_link"] = f"{FRONTEND_URL}/auth/reset-password-confirm" # Example
    elif otp_type == OtpTypeEnum.TWO_FACTOR_LOGIN:
        subject = "Mã OTP Đăng Nhập Finext"
        template_name = "otp_2fa_template.html" # Create this template
        template_body["action_description"] = "đăng nhập vào tài khoản của bạn"
    else:
        logger.error(f"Unknown OTP type for email: {otp_type}")
        return # Do not send email for unknown types

    logger.info(f"Attempting to send OTP email for {otp_type.value} to {email_to}")
    success = await send_email_async(
        subject=subject,
        recipients=[email_to],
        template_name=template_name,
        template_body=template_body
    )
    if success:
        logger.info(f"OTP email for {otp_type.value} sent successfully to {email_to}")
    else:
        logger.error(f"Failed to send OTP email for {otp_type.value} to {email_to}")


@router.post(
    "/request",
    response_model=StandardApiResponse[MessageResponse],
    status_code=status.HTTP_200_OK,
    summary="Yêu cầu gửi mã OTP",
    description="Tạo và gửi mã OTP đến email của người dùng cho một mục đích cụ thể.",
    tags=["otps"]
)
@api_response_wrapper(default_success_message=f"Mã OTP đã được gửi. Vui lòng kiểm tra email. Mã có hiệu lực trong {OTP_EXPIRE_MINUTES} phút.")
async def request_otp(
    request_data: OtpGenerationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    user = await crud_users.get_user_by_email_db(db, request_data.email)
    if not user:
        # To prevent user enumeration, you might return a generic success message
        # but log that the user was not found.
        logger.warning(f"OTP request for non-existent user email: {request_data.email}")
        # For now, let's be explicit for easier debugging during development:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng với email này không tồn tại.")

    if not user.is_active and request_data.otp_type != OtpTypeEnum.EMAIL_VERIFICATION:
        # Allow email verification for inactive users so they can activate.
        # For other OTP types, user must be active.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tài khoản người dùng này chưa được kích hoạt hoặc đã bị khóa.")

    raw_otp_code = generate_otp_code()
    now = datetime.now(timezone.utc)

    otp_create_payload = OtpCreateInternal(
        user_id=str(user.id),
        otp_type=request_data.otp_type,
        otp_code=raw_otp_code, # Raw code
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES), # This will be recalculated in crud
        created_at=now
    )

    created_otp_record = await crud_otps.create_otp_record(db, otp_create_payload)
    if not created_otp_record:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Không thể tạo mã OTP. Vui lòng thử lại.")

    # Send email in the background
    background_tasks.add_task(
        _send_otp_email_task,
        email_to=user.email,
        full_name=user.full_name,
        otp_code=raw_otp_code, # Send the raw OTP
        otp_type=request_data.otp_type,
        expiry_minutes=OTP_EXPIRE_MINUTES
    )

    # The api_response_wrapper will provide the default success message
    return MessageResponse(message=f"Mã OTP cho mục đích '{request_data.otp_type.value}' đã được gửi đến email của bạn. Vui lòng kiểm tra.")


@router.post(
    "/verify",
    response_model=StandardApiResponse[OtpVerificationResponse],
    summary="Xác thực mã OTP",
    tags=["otps"]
)
@api_response_wrapper() # Default success message will be overridden by the return value
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
        db,
        user_id=str(user.id),
        otp_type=request_data.otp_type,
        plain_otp_code=request_data.otp_code
    )

    if is_valid:
        # Perform actions after successful OTP verification, e.g., activate user
        if request_data.otp_type == OtpTypeEnum.EMAIL_VERIFICATION:
            if not user.is_active:
                await db.users.update_one(
                    {"_id": user.id}, # user.id is already ObjectId if from UserInDB
                    {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}}
                )
                logger.info(f"User {user.email} activated successfully via OTP.")
                return OtpVerificationResponse(success=True, message="Xác thực email thành công và tài khoản đã được kích hoạt.")

        return OtpVerificationResponse(success=True, message="Mã OTP đã được xác thực thành công.")
    else:
        # Do not explicitly say "OTP expired" or "OTP not found" to prevent enumeration
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")