# finext-fastapi/app/schemas/permissions.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class PermissionBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, description="Ví dụ: listing:create, user:manage_roles")
    description: Optional[str] = Field(default=None, description="Mô tả chi tiết cho quyền này.") # Thêm example ở Field cho description

class PermissionCreate(PermissionBase):
    # Kế thừa từ PermissionBase
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "resource:action",
                "description": "Mô tả cụ thể về quyền resource:action."
            }
        }
    )

class PermissionInDB(PermissionBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None) # Sửa: id trong DB thường là bắt buộc sau khi tạo
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
        # Không thêm example cho DB model theo yêu cầu.
    )

class PermissionPublic(PermissionBase):
    # Đây là response model, không thêm example.
    # Nếu endpoint trả về ID, bạn có thể thêm id vào đây.
    # Hiện tại, endpoint GET /permissions/ của bạn trả về PermissionPublic
    # không bao gồm id, created_at, updated_at.
    # Nếu muốn hiển thị ID, bạn cần thay đổi response_model của endpoint đó
    # và cập nhật schema này (ví dụ, thêm id: PyObjectId).
    pass