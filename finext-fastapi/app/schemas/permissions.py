# finext-fastapi/app/schemas/permissions.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.utils.types import PyObjectId


class PermissionBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, description="Ví dụ: user:create, user:manage_roles")
    description: Optional[str] = Field(default=None, description="Mô tả chi tiết cho quyền này.")
    category: str = Field(..., description="Danh mục/nhóm của quyền (ví dụ: user_management)")


class PermissionCreate(PermissionBase):
    """Schema cho việc tạo permission mới - roles sẽ được cập nhật tự động từ roles API"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "user:create",
                "description": "Quyền tạo người dùng mới.",
                "category": "user_management",
            }
        }
    )


class PermissionUpdate(BaseModel):
    """Schema cho việc cập nhật permission - roles field không được phép chỉnh sửa"""

    name: Optional[str] = Field(None, min_length=3, max_length=100, description="Tên quyền")
    description: Optional[str] = Field(None, description="Mô tả quyền")
    category: Optional[str] = Field(None, description="Danh mục quyền")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "user:update",
                "description": "Quyền cập nhật người dùng.",
                "category": "user_management",
            }
        }
    )


class PermissionInDB(PermissionBase):
    """Schema cho permission trong database"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    roles: List[str] = Field(default=[], description="Danh sách vai trò đang sử dụng quyền này (read-only)")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PermissionPublic(PermissionBase):
    """Schema cho response API public"""

    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    roles: List[str] = Field(default=[], description="Danh sách vai trò đang sử dụng quyền này")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
