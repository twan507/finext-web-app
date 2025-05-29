# finext-fastapi/app/schemas/otps.py
from enum import Enum
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict, field_validator, EmailStr

from app.utils.types import PyObjectId
from app.core.config import OTP_LENGTH


class OtpTypeEnum(str, Enum):
    EMAIL_VERIFICATION = "email_verification"
    RESET_PASSWORD = "reset_password"
    PWDLESS_LOGIN = "pwdless_login"  # Sẽ dùng cho Passwordless Login


class OtpBase(BaseModel):
    user_id: PyObjectId
    otp_type: OtpTypeEnum
    expires_at: datetime  # Thời gian hết hạn sẽ được tính toán lại trong CRUD


class OtpCreateInternal(OtpBase):  # Used internally for creating OTP, includes the raw code
    otp_code: str  # This will be the raw OTP to be sent, then hashed before DB storage
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OtpInDBBase(OtpBase):
    id: PyObjectId = Field(alias="_id")
    hashed_otp_code: str  # OTP is stored hashed in DB
    verified_at: Optional[datetime] = None
    created_at: datetime
    attempts: int = Field(default=0)  # MỚI: Số lần thử sai

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, use_enum_values=True)


class OtpInDB(OtpInDBBase):
    pass


class OtpPublic(BaseModel):  # What might be returned (e.g., just expiry and type, no code)
    id: PyObjectId  # Giữ lại ID để client có thể tham chiếu nếu cần
    user_id: PyObjectId
    otp_type: OtpTypeEnum
    expires_at: datetime
    created_at: datetime
    # Không trả về attempts hay hashed_otp_code

    model_config = ConfigDict(from_attributes=True, use_enum_values=True, populate_by_name=True)


class OtpGenerationRequest(BaseModel):
    email: EmailStr = Field(..., description="Email của người dùng cần gửi OTP.")
    otp_type: OtpTypeEnum = Field(..., description="Mục đích của OTP.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "otp_type": OtpTypeEnum.EMAIL_VERIFICATION.value,  # Sử dụng .value
            }
        }
    )


class OtpVerificationRequest(BaseModel):
    email: EmailStr = Field(..., description="Email của người dùng để xác thực OTP.")
    otp_type: OtpTypeEnum = Field(..., description="Mục đích của OTP đã gửi.")
    otp_code: str = Field(..., min_length=OTP_LENGTH, max_length=OTP_LENGTH, description=f"Mã OTP gồm {OTP_LENGTH} chữ số.")

    @field_validator("otp_code")
    def validate_otp_code_digits(cls, v):
        if not v.isdigit():
            raise ValueError("Mã OTP chỉ được chứa chữ số.")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "otp_type": OtpTypeEnum.EMAIL_VERIFICATION.value,  # Sử dụng .value
                "otp_code": "123456",
            }
        }
    )


class OtpVerificationResponse(BaseModel):
    success: bool
    message: str
    # action_token: Optional[str] = None # Bỏ action_token nếu không dùng ngay
