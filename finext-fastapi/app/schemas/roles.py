from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.utils.types import PyObjectId

class RoleCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Ví dụ: admin, user, broker")
    description: Optional[str] = None
    permission_ids: List[PyObjectId] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "editor",
                "description": "Người dùng có quyền chỉnh sửa nội dung.",
                "permission_ids": ["60d5ec49f7b4e6a0e7d5c2a3", "60d5ec49f7b4e6a0e7d5c2a4"]
            }
        }
    )

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=50)
    description: Optional[str] = None
    permission_ids: List[PyObjectId] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "content_moderator",
                "description": "Người dùng có quyền kiểm duyệt và chỉnh sửa nội dung.",
                "permission_ids": ["60d5ec49f7b4e6a0e7d5c2a3", "60d5ec49f7b4e6a0e7d5c2a6", "60d5ec49f7b4e6a0e7d5c2a7"]
            }
        }
    )

class RoleInDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(..., min_length=3, max_length=50, description="Ví dụ: admin, user, broker")
    description: Optional[str] = None
    permission_ids: List[PyObjectId] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )

class RolePublic(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(..., min_length=3, max_length=50, description="Ví dụ: admin, user, broker")
    description: Optional[str] = None
    permission_ids: List[PyObjectId] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )