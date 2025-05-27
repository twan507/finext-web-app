# finext-fastapi/app/schemas/features.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class FeatureBase(BaseModel):
    key: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-z_]+$",
                     description="Khóa định danh duy nhất (chỉ chữ thường và _). Ví dụ: 'view_advanced_chart'")
    name: str = Field(..., min_length=3, max_length=100, description="Tên dễ hiểu. Ví dụ: 'Xem biểu đồ nâng cao'")
    description: Optional[str] = Field(None, max_length=500, description="Mô tả chi tiết về tính năng.")

class FeatureCreate(FeatureBase):
    pass

class FeatureUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class FeatureInDB(FeatureBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "60d5ec49f7b4e6a0e7d5c2a1",
                "key": "view_advanced_chart",
                "name": "Xem biểu đồ nâng cao",
                "description": "Cho phép người dùng xem các loại biểu đồ và chỉ báo kỹ thuật phức tạp.",
                "created_at": "2023-10-27T10:00:00Z",
                "updated_at": "2023-10-27T10:00:00Z",
            }
        },
    )

class FeaturePublic(FeatureBase):
    id: PyObjectId = Field(alias="_id")

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )