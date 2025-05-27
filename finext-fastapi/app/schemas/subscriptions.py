# finext-fastapi/app/schemas/subscriptions.py
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional # Thêm List nếu bạn dùng cho feature_keys trong ví dụ
from datetime import datetime, timezone, timedelta # Thêm timezone và timedelta
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
    user_id: PyObjectId # Sẽ không thêm example riêng lẻ ở Field
    license_key: str = Field(..., description="Key của license cần gán (ví dụ: 'pro').")
    duration_override_days: Optional[int] = Field(None, gt=0, description="Ghi đè thời hạn mặc định (tùy chọn).")
    start_date_override: Optional[datetime] = Field(None, description="Ghi đè ngày bắt đầu (tùy chọn).")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "60d5ec49f7b4e6a0e7d5c2a1", # Ví dụ một ObjectId string hợp lệ
                "license_key": "premium",
                "duration_override_days": 90,
                "start_date_override": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat() # Ví dụ ngày mai
            }
        }
    )

class SubscriptionUpdate(BaseModel):
    # Chỉ cho phép cập nhật một số trường nhất định, ví dụ:
    expiry_date: Optional[datetime] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "expiry_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                "is_active": False
            }
        }
    )

class SubscriptionInDB(SubscriptionBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        # Ví dụ hiện có này cho response/DB model, bạn có thể giữ hoặc xóa.
        # Theo yêu cầu "chỉ viết json_schema_extra ko thêm các example nữa" cho request,
        # thì phần này của response có thể không cần. Tuy nhiên, vì nó đã có, tôi giữ lại.
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
        # Không thêm json_schema_extra cho response model này
    )