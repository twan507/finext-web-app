# finext-fastapi/app/schemas/users.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from app.utils.types import PyObjectId
from datetime import datetime, timezone


class UserBase(BaseModel):  # Thêm UserBase để dùng chung
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None  # Sửa thành Optional, vì Google có thể không cung cấp
    avatar_url: Optional[str] = Field(default=None, description="URL to the user's avatar image.")
    referral_code: Optional[str] = Field(default=None, description="Mã giới thiệu của Đối tác (nếu có).")
    google_id: Optional[str] = Field(default=None, description="Google User ID (sub). Duy nhất nếu có.")


class UserCreate(UserBase):
    """Schema for creating a new user (input)."""

    # Mật khẩu là bắt buộc khi tạo user truyền thống, tùy chọn khi tạo qua Google (sẽ tự sinh)
    password: Optional[str] = Field(default=None, min_length=8, description="Mật khẩu, tối thiểu 8 ký tự. Bỏ trống nếu tạo qua Google.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "full_name": "Nguyen Van Test",
                "email": "testuser@example.com",
                "phone_number": "0912345678",
                "password": "SecurePassword123!",
                "referral_code": "ABCD",
                "avatar_url": "https://r2.yourdomain.com/avatars/user_id/image.jpg",
            }
        }
    )


class UserSeed(UserBase):  # Kế thừa từ UserBase đã có google_id
    """Schema for creating a new user (input for seeding)."""

    role_ids: List[PyObjectId] = Field(default_factory=list)
    password: str = Field(..., min_length=8)  # Password bắt buộc cho seeding
    subscription_id: Optional[PyObjectId] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)


class UserUpdate(BaseModel):
    """Schema for updating user data."""

    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)  # Admin có thể không được đổi email của user protected
    phone_number: Optional[str] = Field(default=None)
    referral_code: Optional[str] = Field(
        default=None, description="Cập nhật mã giới thiệu cho người dùng. Gửi chuỗi rỗng hoặc null để xóa."
    )
    avatar_url: Optional[str] = Field(default=None, description="URL to the user's avatar image. Send null or empty string to remove.")
    is_active: Optional[bool] = Field(default=None)  # Thêm is_active để admin có thể cập nhật

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "updateduser@example.com",
                "full_name": "Tran Thi Updated",
                "phone_number": "0987654322",
                "referral_code": "XYZ1",
                "avatar_url": "https://r2.yourdomain.com/avatars/user_id/new_image.jpg",
                "is_active": True,
            }
        }
    )


class UserPublic(BaseModel):
    """Schema for returning user data to regular users (minimal info)."""

    id: PyObjectId = Field(alias="_id")  # Frontend cần để identify user
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    referral_code: Optional[str] = None
    role_ids: List[PyObjectId] = []  # Frontend cần để check admin/manager role
    role_names: List[str] = []  # Danh sách tên role để frontend hiển thị
    subscription_id: Optional[PyObjectId] = None  # Frontend cần để fetch subscription
    # KHÔNG bao gồm: google_id, is_active, created_at, updated_at

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserAdminResponse(UserBase):
    """Schema for returning full user data to admin."""

    id: PyObjectId = Field(alias="_id")
    role_ids: List[PyObjectId]
    subscription_id: Optional[PyObjectId] = None
    is_active: Optional[bool] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserInDB(UserBase):  # Kế thừa từ UserBase đã có google_id
    """Schema for storing user data in the database."""

    id: PyObjectId = Field(alias="_id")
    role_ids: List[PyObjectId] = Field(default_factory=list)
    hashed_password: Optional[str] = None  # Mật khẩu có thể là None nếu tạo qua Google và chưa set
    subscription_id: Optional[PyObjectId] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    # referral_code đã có từ UserBase
    # avatar_url đã có từ UserBase
    # google_id đã có từ UserBase

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class UserRoleModificationRequest(BaseModel):
    role_ids: List[PyObjectId] = Field(..., description="Danh sách ID của các vai trò cần gán/thu hồi.")

    model_config = ConfigDict(json_schema_extra={"example": {"role_ids": ["60d5ec49f7b4e6a0e7d5c2b3", "60d5ec49f7b4e6a0e7d5c2b4"]}})


# --- GOOGLE USER DATA SCHEMA (Giữ lại từ file auth.py để tiện tham chiếu) ---
class GoogleUserSchema(BaseModel):  # Đổi tên để tránh trùng với User trong session
    """Schema for user information obtained from Google."""

    id: str  # Google User ID (sub)
    email: EmailStr
    verified_email: bool
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None  # URL to profile picture
    locale: Optional[str] = None
