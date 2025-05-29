# finext-fastapi/app/schemas/users.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from app.utils.types import PyObjectId
from datetime import datetime

# Bỏ class LicenseInfo và AwareUtcDatetime nếu không dùng ở đâu khác

class UserCreate(BaseModel):
    """Schema for creating a new user (input)."""
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(..., min_length=8)
    referral_code: Optional[str] = Field(default=None, description="Mã giới thiệu của Đối tác (nếu có).")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "full_name": "Nguyen Van Test",
                "email": "testuser@example.com",
                "phone_number": "0912345678",
                "password": "SecurePassword123!",
                "referral_code": "ABCD"
            }
        }
    )

class UserUpdate(BaseModel):
    """Schema for updateting user data."""
    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    referral_code: Optional[str] = Field(default=None, description="Cập nhật mã giới thiệu cho người dùng.") # MỚI

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "updateduser@example.com",
                "full_name": "Tran Thi Updated",
                "phone_number": "0987654322",
                "referral_code": "XYZ1" # MỚI
            }
        }
    )

class UserPublic(BaseModel):
    """Schema for returning user data to the client (output)."""
    id: PyObjectId = Field(alias="_id")
    role_ids: List[PyObjectId]
    full_name: str
    email: EmailStr
    phone_number: str
    subscription_id: Optional[PyObjectId] = None
    is_active: Optional[bool] = None 
    referral_code: Optional[str] = None # MỚI

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class UserInDB(BaseModel):
    """Schema for storing user data in the database."""
    id: PyObjectId = Field(alias="_id")
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    hashed_password: str
    subscription_id: Optional[PyObjectId] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    referral_code: Optional[str] = None # MỚI

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class UserRoleModificationRequest(BaseModel):
    role_ids: List[PyObjectId] = Field(..., description="Danh sách ID của các vai trò cần gán/thu hồi.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "role_ids": ["60d5ec49f7b4e6a0e7d5c2b3", "60d5ec49f7b4e6a0e7d5c2b4"]
            }
        }
    )

# Bỏ UserLicenseAssignRequest