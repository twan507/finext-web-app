# finext-fastapi/app/schemas/emails.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class EmailBase(BaseModel):
    """Schema cơ sở cho email."""
    recipient_email: EmailStr

class TestEmailRequest(EmailBase):
    """Schema cho yêu cầu gửi email kiểm tra."""
    name: Optional[str] = "Người dùng Test"
    custom_message: Optional[str] = "Đây là nội dung email kiểm tra mặc định."

class EmailVerificationRequest(BaseModel):
    """Schema (ví dụ) cho yêu cầu xác thực email (chỉ cần token)."""
    token: str

class PasswordResetRequest(BaseModel):
    """Schema (ví dụ) cho yêu cầu đặt lại mật khẩu."""
    token: str
    new_password: str

class MessageResponse(BaseModel):
    """Schema chuẩn cho các phản hồi chỉ chứa thông báo."""
    message: str

# Bạn có thể thêm các schema khác liên quan đến email ở đây trong tương lai.
# Ví dụ: Schema cho email thông báo, email marketing, v.v.