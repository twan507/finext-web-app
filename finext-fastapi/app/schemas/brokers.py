# finext-fastapi/app/schemas/brokers.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class BrokerBase(BaseModel):
    user_id: PyObjectId = Field(..., description="ID của người dùng được chỉ định làm Đối tác.")
    broker_code: str = Field(..., description="Mã giới thiệu duy nhất của Đối tác (4 ký tự HOA/số).")
    is_active: bool = Field(default=True, description="Trạng thái hoạt động của mã Đối tác.")

class BrokerCreate(BaseModel):
    user_id: PyObjectId = Field(..., description="ID của người dùng sẽ được chỉ định làm Đối tác.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "60d5ec49f7b4e6a0e7d5c2a1"
            }
        }
    )

class BrokerUpdate(BaseModel):
    is_active: Optional[bool] = Field(None, description="Cập nhật trạng thái hoạt động của Đối tác.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "is_active": False
            }
        }
    )

class BrokerInDB(BrokerBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "60f7ec49f7b4e6a0e7d5d123",
                "user_id": "60d5ec49f7b4e6a0e7d5c2a1",
                "broker_code": "ABCD",
                "is_active": True,
                "created_at": "2024-05-28T10:00:00Z",
                "updated_at": "2024-05-28T10:00:00Z"
            }
        }
    )

class BrokerPublic(BrokerBase):
    id: PyObjectId = Field(alias="_id")
    # user_email: Optional[EmailStr] = Field(None, description="Email của người dùng Đối tác, nếu được populate.") # Cân nhắc thêm nếu cần
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )

class BrokerValidationResponse(BaseModel):
    is_valid: bool
    broker_name: Optional[str] = None # Tên của Broker nếu mã hợp lệ, để hiển thị cho người dùng
    broker_code: Optional[str] = None # Mã code đã validate

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "is_valid": True,
                "broker_name": "Đối tác A",
                "broker_code": "ABCD"
            }
        }
    )