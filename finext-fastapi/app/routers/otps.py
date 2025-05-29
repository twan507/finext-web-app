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
from app.utils.email_utils import send_otp_email
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

    # Prepare OTP creation payload (but don't save to DB yet)
    otp_create_payload = OtpCreateInternal(
        user_id=str(user.id),
        otp_type=request_data.otp_type,
        otp_code=raw_otp_code, # Store raw code temporarily for sending
        expires_at=now + timedelta(minutes=OTP_EXPIRE_MINUTES), # This will be recalculated by crud_create_otp_record
        created_at=now,
    )

    # Attempt to send the email first
    try:
        logger.info(f"Attempting to send OTP email for {request_data.otp_type.value} to {user.email}. OTP: {raw_otp_code[:2]}****") # Log partially
        await send_otp_email(
            email_to=user.email,
            full_name=user.full_name,
            otp_code=raw_otp_code, # Send the raw OTP code
            otp_type=request_data.otp_type,
            expiry_minutes=OTP_EXPIRE_MINUTES,
        )
        logger.info(f"OTP email for {request_data.otp_type.value} sent successfully to {user.email}.")
    except Exception as e:
        logger.error(f"Failed to send OTP email for {request_data.otp_type.value} to {user.email}: {str(e)}", exc_info=True)
        # Do NOT create OTP record if email sending fails
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Or 502 if it's specifically an email gateway issue
            detail="Không thể gửi email OTP. Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
        )

    # If email sending was successful, now create the OTP record in the database
    # crud_otps.create_otp_record will hash the otp_code from otp_create_payload
    created_otp_record = await crud_otps.create_otp_record(db, otp_create_payload)
    if not created_otp_record:
        # This is a critical failure: email sent, but OTP record failed to save.
        logger.critical(
            f"CRITICAL: OTP email sent to {user.email} for {request_data.otp_type.value}, "
            f"but failed to save OTP record to DB. OTP_CODE (raw, for recovery): {raw_otp_code}"
        )
        # Inform the user that a severe error occurred, as they received an OTP that won't work.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Đã xảy ra lỗi nghiêm trọng khi lưu mã OTP sau khi gửi email. Mã OTP bạn nhận được có thể không hoạt động. Vui lòng liên hệ hỗ trợ."
        )

    # The default_success_message from the decorator will be used.
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Người dùng hoặc OTP không hợp lệ.") # Changed from 404 to 400 as per previous logic

    is_valid = await crud_otps.verify_and_use_otp(
        db, user_id=str(user.id), otp_type=request_data.otp_type, plain_otp_code=request_data.otp_code
    )

    if is_valid:
        if request_data.otp_type == OtpTypeEnum.EMAIL_VERIFICATION:
            if not user.is_active:
                user_object_id = getattr(user, 'id', None) # Get the ObjectId version if available
                if not user_object_id: # Fallback if 'id' is not ObjectId (e.g. it's a string already)
                    try:
                        from bson import ObjectId
                        user_object_id = ObjectId(user.id)
                    except Exception:
                        logger.error(f"Could not convert user.id {user.id} to ObjectId for activation.")
                        # Handle error or proceed with string if DB adapter allows
                        # For now, let's assume this conversion is not needed if UserInDB.id is already an ObjectId
                        # or if the CRUD operation handles string IDs correctly.
                        # However, typically, _id in MongoDB is an ObjectId.

                # Ensure we use the correct _id (ObjectId) for database operations
                user_id_for_update = user.id # Assuming user.id from UserInDB is PyObjectId which is str, it needs conversion for direct mongo op
                from bson import ObjectId
                if not isinstance(user.id, ObjectId) and ObjectId.is_valid(str(user.id)): # type: ignore
                    user_id_for_update = ObjectId(str(user.id)) # type: ignore
                elif not isinstance(user.id, ObjectId):
                     logger.error(f"User ID {user.id} is not a valid ObjectId string for activation.")
                     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi dữ liệu người dùng khi kích hoạt.")


                await db.users.update_one(
                    {"_id": user_id_for_update}, 
                    {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}},
                )
                logger.info(f"User {user.email} activated successfully via OTP.")
                return OtpVerificationResponse(success=True, message="Xác thực email thành công và tài khoản đã được kích hoạt.")

        return OtpVerificationResponse(success=True, message="Mã OTP đã được xác thực thành công.")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mã OTP không hợp lệ hoặc đã hết hạn.")