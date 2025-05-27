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
    # Kế thừa từ FeatureBase, các trường đã có mô tả
    # Thêm ví dụ ở cấp độ model để Swagger UI tự điền
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "key": "new_feature_key",
                "name": "Tính năng Mới ABC",
                "description": "Mô tả chi tiết cho tính năng mới ABC."
            }
        }
    )

class FeatureUpdate(BaseModel):
    # Các trường này là optional khi cập nhật
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Tên Feature Đã Cập Nhật",
                "description": "Mô tả mới sau khi cập nhật."
            }
        }
    )

class FeatureInDB(FeatureBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        # Ví dụ này đã có sẵn và dùng cho response, giữ nguyên nếu bạn thấy hữu ích cho việc đọc hiểu API
        # hoặc xóa đi nếu chỉ muốn example cho request. Hiện tại tôi sẽ giữ lại.
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
    # Không cần json_schema_extra example cho response theo yêu cầu mới
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True
    )