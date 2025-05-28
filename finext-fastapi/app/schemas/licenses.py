# finext-fastapi/app/schemas/licenses.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.utils.types import PyObjectId


class LicenseBase(BaseModel):
    key: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r'^[a-zA-Z_]+$',
        description="Khóa định danh duy nhất (chỉ chữ thường và _). Ví dụ: 'FREE', 'pro'",
    )
    name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Tên gói. Ví dụ: 'Gói Chuyên Nghiệp'",
    )
    price: float = Field(..., ge=0, description="Giá của gói license.")
    duration_days: int = Field(..., gt=0, description="Thời hạn của gói (số ngày).")
    feature_keys: List[str] = Field(
        default_factory=list,
        description="Danh sách các 'key' của features có trong gói.",
    )


class LicenseCreate(LicenseBase):
    # Kế thừa từ LicenseBase
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "key": "new_license_key",
                "name": "Gói License Mới",
                "price": 49.99,
                "duration_days": 30,
                "feature_keys": ["view_advanced_chart", "api_access"],
            }
        }
    )


class LicenseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    price: Optional[float] = Field(None, ge=0)
    duration_days: Optional[int] = Field(None, gt=0)
    feature_keys: Optional[List[str]] = Field(None)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Gói Siêu Cấp",
                "price": 199.00,
                "duration_days": 365,
                "feature_keys": [
                    "view_advanced_chart",
                    "export_data",
                    "enable_pro_indicator",
                    "api_access",
                    "sse_access",
                ],
            }
        }
    )


class LicenseInDB(LicenseBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        # Ví dụ này cho response/DB model, giữ lại để tham khảo cấu trúc hoặc xóa nếu bạn muốn.
        json_schema_extra={
            "example": {
                "id": "60d5ec49f7b4e6a0e7d5c2b2",
                "key": "pro",
                "name": "Gói Chuyên Nghiệp",
                "price": 99.99,
                "duration_days": 365,
                "feature_keys": [
                    "view_advanced_chart",
                    "export_data",
                    "enable_pro_indicator",
                ],
                "created_at": "2023-10-27T10:00:00Z",
                "updated_at": "2023-10-27T10:00:00Z",
            }
        },
    )


class LicensePublic(LicenseBase):
    id: PyObjectId = Field(alias="_id")

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        # Không thêm example cho response theo yêu cầu.
    )
