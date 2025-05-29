# finext-fastapi/app/schemas/auth.py
from pydantic import BaseModel, Field, EmailStr, field_validator # Thêm EmailStr, field_validator
from typing import Optional
from app.core.config import OTP_LENGTH # Import OTP_LENGTH

class JWTTokenResponse(BaseModel):
    """
    Schema cho response trả về khi đăng nhập/refresh thành công.
    Chỉ chứa access token. Refresh token được gửi qua cookie.
    """
    token_type: str = "bearer"
    access_token: str

class TokenData(BaseModel):
    """
    Schema cho dữ liệu được mã hóa bên trong JWT (payload).
    """
    email: Optional[str] = None
    user_id: Optional[str] = None
    jti: Optional[str] = None

class ResetPasswordWithOtpRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=OTP_LENGTH, max_length=OTP_LENGTH, description=f"Mã OTP gồm {OTP_LENGTH} chữ số.")
    new_password: str = Field(..., min_length=8, description="Mật khẩu mới, tối thiểu 8 ký tự.")
    # confirm_new_password: str # Frontend nên xử lý việc này

    @field_validator("otp_code")
    def validate_otp_code_digits(cls, v):
        if not v.isdigit():
            raise ValueError("Mã OTP chỉ được chứa chữ số.")
        return v

    model_config = { # Sử dụng dict thay vì ConfigDict nếu Pydantic v1
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "otp_code": "123456",
                "new_password": "NewStrongPassword123!"
            }
        }
    }

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Mật khẩu hiện tại của người dùng.")
    new_password: str = Field(..., min_length=8, description="Mật khẩu mới, tối thiểu 8 ký tự.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "current_password": "OldSecurePassword123!",
                "new_password": "BrandNewSecurePassword456!"
            }
        }
    }