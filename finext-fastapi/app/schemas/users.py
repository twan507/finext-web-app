# finext-fastapi/app/schemas/users.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from app.utils.types import PyObjectId
from datetime import datetime, timezone

# Bỏ class LicenseInfo và AwareUtcDatetime nếu không dùng ở đâu khác

class UserCreate(BaseModel):
    """Schema for creating a new user (input)."""
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(..., min_length=8)
    # THAY ĐỔI: Bỏ license_info, thêm subscription_id (optional, default=None)
    subscription_id: Optional[PyObjectId] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)

class UserUpdate(BaseModel):
    """Schema for updateting user data."""
    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    # THAY ĐỔI: Bỏ license_info, thêm subscription_id (optional, default=None)
    subscription_id: Optional[PyObjectId] = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserPublic(BaseModel):
    """Schema for returning user data to the client (output)."""
    id: PyObjectId = Field(alias="_id") # Nên để là bắt buộc
    role_ids: List[PyObjectId]
    full_name: str
    email: EmailStr
    phone_number: str
    # THAY ĐỔI: Bỏ license_info, thêm subscription_id
    subscription_id: Optional[PyObjectId] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class UserInDB(BaseModel):
    """Schema for storing user data in the database."""
    id: PyObjectId = Field(alias="_id") # Nên để là bắt buộc
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    hashed_password: str
    # THAY ĐỔI: Bỏ license_info, thêm subscription_id
    subscription_id: Optional[PyObjectId] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class UserRoleModificationRequest(BaseModel):
    role_ids: List[PyObjectId] = Field(..., description="Danh sách ID của các vai trò cần gán/thu hồi.")

# Bỏ UserLicenseAssignRequest