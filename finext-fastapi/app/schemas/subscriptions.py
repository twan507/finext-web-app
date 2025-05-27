# finext-fastapi/app/schemas/subscriptions.py
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class SubscriptionBase(BaseModel):
    user_id: PyObjectId
    user_email: EmailStr
    license_id: PyObjectId
    license_key: str
    is_active: bool = Field(default=True)
    start_date: datetime
    expiry_date: datetime

class SubscriptionCreate(BaseModel):
    user_id: PyObjectId
    license_key: str = Field(..., description="Key của license cần gán (ví dụ: 'pro').")
    duration_override_days: Optional[int] = Field(None, gt=0, description="Ghi đè thời hạn mặc định (tùy chọn).")
    start_date_override: Optional[datetime] = Field(None, description="Ghi đè ngày bắt đầu (tùy chọn).")

class SubscriptionUpdate(BaseModel):
    # Chỉ cho phép cập nhật một số trường nhất định, ví dụ:
    expiry_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class SubscriptionInDB(SubscriptionBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "60d5ec49f7b4e6a0e7d5c2c3",
                "user_id": "60d5ec49f7b4e6a0e7d5c2a1",
                "user_email": "user@example.com",
                "license_id": "60d5ec49f7b4e6a0e7d5c2b2",
                "license_key": "pro",
                "is_active": True,
                "start_date": "2024-01-01T00:00:00Z",
                "expiry_date": "2025-01-01T00:00:00Z",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        },
    )

class SubscriptionPublic(SubscriptionBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )