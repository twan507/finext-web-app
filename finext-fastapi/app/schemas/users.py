from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from app.utils.types import PyObjectId
from datetime import datetime, timezone

class UserCreate(BaseModel):
    """Schema for creating a new user (input)."""
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(..., min_length=8)
    latest_subscription_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)

class UserUpdate(BaseModel):
    """Schema for updateting user data."""
    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserPublic(BaseModel):
    """Schema for returning user data to the client (output)."""
    id: Optional[PyObjectId] = Field(alias="_id")
    role_ids: List[PyObjectId]
    full_name: str
    email: EmailStr
    phone_number: str

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )

class UserInDB(BaseModel):
    """Schema for storing user data in the database."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    hashed_password: str
    latest_subscription_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )

class UserRoleModificationRequest(BaseModel):
    role_ids: List[PyObjectId] = Field(..., description="Danh sách ID của các vai trò cần gán/thu hồi.")