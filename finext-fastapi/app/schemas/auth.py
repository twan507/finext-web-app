# finext-fastapi/app/schemas/auth.py
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from app.core.config import OTP_LENGTH


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

    @field_validator("otp_code")
    def validate_otp_code_digits(cls, v):
        if not v.isdigit():
            raise ValueError("Mã OTP chỉ được chứa chữ số.")
        return v

    model_config = {
        "json_schema_extra": {"example": {"email": "user@example.com", "otp_code": "123456", "new_password": "NewStrongPassword123!"}}
    }


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Mật khẩu hiện tại của người dùng.")
    new_password: str = Field(..., min_length=8, description="Mật khẩu mới, tối thiểu 8 ký tự.")

    model_config = {
        "json_schema_extra": {"example": {"current_password": "OldSecurePassword123!", "new_password": "BrandNewSecurePassword456!"}}
    }


class AdminChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, description="Mật khẩu mới, tối thiểu 8 ký tự.")

    model_config = {"json_schema_extra": {"example": {"new_password": "NewAdminSetPassword123!"}}}


# --- GOOGLE OAUTH SCHEMAS ---
class GoogleUser(BaseModel):
    """Schema for user information obtained from Google."""

    id: str  # Google User ID
    email: EmailStr
    verified_email: bool
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None  # URL to profile picture
    locale: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    """Schema for the request body from frontend to backend after Google login."""

    code: str = Field(..., description="The authorization code received from Google OAuth2 flow.")
    # Frontend redirect URI phải khớp với URI đã đăng ký với Google và URI mà Google trả code về
    # Backend sẽ sử dụng redirect_uri này khi trao đổi code lấy token.
    # Chúng ta có thể để frontend gửi nó, hoặc backend tự cấu hình một giá trị cố định.
    # Nếu backend tự cấu hình, GOOGLE_REDIRECT_URI trong config.py phải là URI mà Google sẽ gửi code đến *backend*.
    # Trong trường hợp này, frontend sẽ redirect người dùng đến Google, Google redirect về frontend (`http://localhost:3000/auth/google/callback`),
    # frontend lấy code và gửi code đó cho backend.
    # Backend sau đó sẽ dùng code này để lấy token từ Google.
    # redirect_uri mà backend dùng để trao đổi code phải là URI đã được đăng ký trong Google Cloud Console cho client ID này
    # và nó phải là URI mà Google *dự kiến* sẽ gửi code đến cho *bước đó* (thường là backend callback URL).
    # Vì frontend đang xử lý redirect ban đầu và gửi code, redirect_uri ở đây có thể không cần thiết
    # nếu backend dùng redirect_uri đã cấu hình sẵn (GOOGLE_REDIRECT_URI) khi trao đổi code.
    # Tuy nhiên, OAuth2 flow thường yêu cầu redirect_uri phải khớp khi trao đổi code.
    # Cho an toàn, ta sẽ để frontend gửi redirect_uri mà nó đã dùng để lấy code.
    redirect_uri: Optional[str] = Field(None, description="The redirect URI used by the frontend to obtain the authorization code.")

    model_config = {
        "json_schema_extra": {"example": {"code": "4/0AfgeXxt...", "redirect_uri": "http://localhost:3000/auth/google/callback"}}
    }


# --- END GOOGLE OAUTH SCHEMAS ---
