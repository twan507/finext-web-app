# finext-fastapi/app/schemas/users.py
from pydantic import BaseModel, EmailStr, Field, ConfigDict, BeforeValidator 
from typing import Optional, List, Annotated, Any
from app.utils.types import PyObjectId
from datetime import datetime, timezone

# Hàm validator để đảm bảo datetime là aware UTC
def ensure_utc_aware(value: Any) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc) # Giả định naive là UTC
        return value.astimezone(timezone.utc) # Chuyển sang UTC nếu đã aware nhưng khác múi giờ
    # Nếu là string, Pydantic sẽ cố parse, sau đó validator này có thể được gọi lại
    # hoặc bạn cần xử lý parse string ở đây nếu Pydantic không xử lý tốt
    raise ValueError("Invalid datetime format")


AwareUtcDatetime = Annotated[datetime, BeforeValidator(ensure_utc_aware)]

class LicenseInfo(BaseModel):
    active_license_id: Optional[PyObjectId] = Field(default=None)
    license_start_date: Optional[AwareUtcDatetime] = Field(default=None) # Sử dụng kiểu mới
    license_expiry_date: Optional[AwareUtcDatetime] = Field(default=None) # Sử dụng kiểu mới

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class UserCreate(BaseModel):
    """Schema for creating a new user (input)."""
    role_ids: List[PyObjectId] = Field(default_factory=list)
    full_name: str
    email: EmailStr
    phone_number: str
    password: str = Field(..., min_length=8)
    # BỎ latest_subscription_id
    license_info: Optional[LicenseInfo] = Field(default=None) # THÊM license_info
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)

class UserUpdate(BaseModel):
    """Schema for updateting user data."""
    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    license_info: Optional[LicenseInfo] = Field(default=None) # THÊM license_info
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserPublic(BaseModel):
    """Schema for returning user data to the client (output)."""
    id: Optional[PyObjectId] = Field(alias="_id")
    role_ids: List[PyObjectId]
    full_name: str
    email: EmailStr
    phone_number: str
    license_info: Optional[LicenseInfo] = None # THÊM license_info (tùy chọn)

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
    # BỎ latest_subscription_id
    license_info: Optional[LicenseInfo] = None # THÊM license_info
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )

class UserRoleModificationRequest(BaseModel):
    role_ids: List[PyObjectId] = Field(..., description="Danh sách ID của các vai trò cần gán/thu hồi.")

# THÊM SCHEMA MỚI ĐỂ GÁN LICENSE
class UserLicenseAssignRequest(BaseModel):
    license_key: str = Field(..., description="Key của license cần gán (ví dụ: 'pro').")
    duration_override_days: Optional[int] = Field(None, gt=0, description="Ghi đè thời hạn mặc định của license (tùy chọn).")