# finext-fastapi/app/schemas/promotions.py
from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from app.utils.types import PyObjectId #

class DiscountTypeEnum(str, Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"

class PromotionBase(BaseModel):
    promotion_code: str = Field(..., min_length=3, max_length=50, description="Mã khuyến mãi duy nhất (ví dụ: SALE20).")
    description: Optional[str] = Field(None, max_length=500, description="Mô tả chi tiết về chương trình khuyến mãi.")
    discount_type: DiscountTypeEnum = Field(..., description="Loại giảm giá: 'percentage' hoặc 'fixed_amount'.")
    discount_value: float = Field(..., ge=0, description="Giá trị giảm giá (ví dụ: 20 cho 20% hoặc 50000 cho 50.000 VNĐ).")
    is_active: bool = Field(default=True, description="Trạng thái hoạt động của mã khuyến mãi.")
    start_date: Optional[datetime] = Field(None, description="Ngày bắt đầu hiệu lực của khuyến mãi.")
    end_date: Optional[datetime] = Field(None, description="Ngày kết thúc hiệu lực của khuyến mãi.")
    usage_limit: Optional[int] = Field(None, gt=0, description="Tổng số lần mã có thể được sử dụng.")
    usage_count: int = Field(default=0, ge=0, description="Số lần mã đã được sử dụng.")
    applicable_license_keys: Optional[List[str]] = Field(default=None, description="Danh sách các 'key' của license mà mã này áp dụng. Rỗng/None nếu áp dụng cho tất cả.")

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True, # Cho phép tạo model từ thuộc tính của object khác
        use_enum_values=True, # Đảm bảo giá trị enum được sử dụng trong schema
        json_schema_extra={
            "example": {
                "promotion_code": "SUMMER25",
                "description": "Giảm giá 25% cho tất cả các gói trong hè.",
                "discount_type": "percentage",
                "discount_value": 25,
                "is_active": True,
                "start_date": "2025-06-01T00:00:00Z",
                "end_date": "2025-08-31T23:59:59Z",
                "usage_limit": 1000,
                "applicable_license_keys": ["EXAMPLE_PRO", "EXAMPLE_BASIC"]
            }
        }
    )

class PromotionCreate(PromotionBase):
    # Các trường sẽ được kế thừa, không cần id, usage_count (sẽ tự động là 0), created_at, updated_at
    # Bỏ các trường không cần thiết khi tạo mới nếu chúng có giá trị mặc định trong PromotionBase
    # Hoặc có thể định nghĩa lại ở đây nếu muốn schema tạo mới khác biệt rõ ràng
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "promotion_code": "NEWYEAR2026",
                "description": "Khuyến mãi chào năm mới 2026.",
                "discount_type": DiscountTypeEnum.FIXED_AMOUNT,
                "discount_value": 100000, # Giảm 100.000 VNĐ
                "is_active": True,
                "start_date": "2026-01-01T00:00:00Z",
                "end_date": "2026-01-31T23:59:59Z",
                "usage_limit": 500,
                "applicable_license_keys": None # Áp dụng cho tất cả
            }
        }
    )

class PromotionUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=500)
    discount_type: Optional[DiscountTypeEnum] = None
    discount_value: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    usage_limit: Optional[int] = Field(None, gt=0)
    # Không cho phép cập nhật usage_count trực tiếp qua API này
    applicable_license_keys: Optional[List[str]] = None
    # promotion_code không được phép cập nhật

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "description": "Cập nhật: Giảm giá 30% cho gói PRO tháng 7.",
                "discount_type": DiscountTypeEnum.PERCENTAGE,
                "discount_value": 30,
                "is_active": False, # Ví dụ vô hiệu hóa
                "end_date": "2025-07-31T23:59:59Z",
                "usage_limit": 150
            }
        }
    )

class PromotionInDB(PromotionBase):
    id: PyObjectId = Field(alias="_id") # Quan trọng: alias _id sang id
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={ # Ví dụ cho PromotionInDB (thường không cần cho response, nhưng hữu ích khi debug)
            "example": {
                "id": "60d5ec49f7b4e6a0e7d5c2f0",
                "promotion_code": "VIPONLY",
                "description": "Giảm 10% cho khách VIP.",
                "discount_type": "percentage",
                "discount_value": 10,
                "is_active": True,
                "start_date": None,
                "end_date": None,
                "usage_limit": None,
                "usage_count": 5,
                "applicable_license_keys": ["VIP_LICENSE"],
                "created_at": "2025-01-15T10:00:00Z",
                "updated_at": "2025-01-20T11:30:00Z"
            }
        }
    )

class PromotionPublic(PromotionBase): # Schema trả về cho client
    id: PyObjectId = Field(alias="_id")
    created_at: datetime # Có thể muốn hiển thị cho admin
    updated_at: datetime # Có thể muốn hiển thị cho admin

    model_config = ConfigDict(
        populate_by_name=True, # Cho phép alias _id
        from_attributes=True, # Cho phép tạo model từ thuộc tính object khác
        # Không cần example ở đây vì PromotionBase đã có rồi
    )

class PromotionValidationResponse(BaseModel):
    is_valid: bool
    promotion_code: str
    message: str
    discount_type: Optional[DiscountTypeEnum] = None
    discount_value: Optional[float] = None
    original_amount: Optional[float] = None # Số tiền gốc trước khi giảm
    discounted_amount: Optional[float] = None # Số tiền được giảm
    final_amount: Optional[float] = None # Số tiền cuối cùng sau khi giảm

    model_config = ConfigDict(
        json_schema_extra={
            "example_valid": {
                "is_valid": True,
                "promotion_code": "SALE20",
                "message": "Mã khuyến mãi hợp lệ.",
                "discount_type": "percentage",
                "discount_value": 20,
                "original_amount": 100000,
                "discounted_amount": 20000,
                "final_amount": 80000
            },
            "example_invalid": {
                "is_valid": False,
                "promotion_code": "EXPIREDCODE",
                "message": "Mã khuyến mãi đã hết hạn hoặc không tồn tại."
            }
        }
    )