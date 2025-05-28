# finext-fastapi/app/schemas/transactions.py
from enum import Enum
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime, timezone

from app.utils.types import PyObjectId

class PaymentStatusEnum(str, Enum):
    pending = "pending"
    succeeded = "succeeded"
    canceled = "canceled"

class TransactionTypeEnum(str, Enum):
    new_purchase = "new_purchase"
    renewal = "renewal"

class TransactionBase(BaseModel):
    buyer_user_id: PyObjectId = Field(..., description="ID của người dùng mua hàng.")
    license_id: PyObjectId = Field(..., description="ID của gói license liên quan.")
    license_key: str = Field(..., description="Khóa của gói license.")
    original_license_price: float = Field(..., ge=0, description="Giá gốc của license tại thời điểm giao dịch.")
    purchased_duration_days: int = Field(..., gt=0, description="Số ngày thời hạn của gói được mua/gia hạn.")
    transaction_amount: float = Field(..., ge=0, description="Số tiền thực tế của giao dịch.") # Sẽ được set tự động cho user
    promotion_code: Optional[str] = Field(default=None, description="Mã khuyến mãi được áp dụng.")
    payment_status: PaymentStatusEnum = Field(default=PaymentStatusEnum.pending, description="Trạng thái thanh toán của giao dịch.")
    transaction_type: TransactionTypeEnum = Field(..., description="Loại giao dịch (mua mới hoặc gia hạn).")
    notes: Optional[str] = Field(default=None, description="Ghi chú của người dùng hoặc admin về giao dịch.")
    target_subscription_id: Optional[PyObjectId] = Field(default=None, description="ID của subscription được tạo/gia hạn (nếu có).")

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        use_enum_values=True,
    )

# Schema cho Admin tạo transaction (đã có)
class TransactionCreateForAdmin(BaseModel): # Đổi tên để phân biệt
    buyer_user_id: PyObjectId
    transaction_type: TransactionTypeEnum
    purchased_duration_days: int = Field(..., gt=0)
    transaction_amount: float = Field(..., ge=0) # Admin có thể nhập giá tùy chỉnh
    promotion_code: Optional[str] = None
    notes: Optional[str] = None

    license_id_for_new_purchase: Optional[PyObjectId] = None
    subscription_id_to_renew: Optional[PyObjectId] = None

    @field_validator('license_id_for_new_purchase')
    def check_admin_new_purchase_fields(cls, v, values):
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.new_purchase and v is None:
            raise ValueError('license_id_for_new_purchase is required for new_purchase transactions by admin')
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.renewal and v is not None:
            raise ValueError('license_id_for_new_purchase must be null for renewal transactions by admin')
        return v

    @field_validator('subscription_id_to_renew')
    def check_admin_renewal_fields(cls, v, values):
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.renewal and v is None:
            raise ValueError('subscription_id_to_renew is required for renewal transactions by admin')
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.new_purchase and v is not None:
            raise ValueError('subscription_id_to_renew must be null for new_purchase transactions by admin')
        return v
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": { # for new purchase
                "buyer_user_id": "60d5ec49f7b4e6a0e7d5c2a1",
                "transaction_type": "new_purchase",
                "license_id_for_new_purchase": "60d5ec49f7b4e6a0e7d5c2b2",
                "purchased_duration_days": 30,
                "transaction_amount": 99.99,
                "promotion_code": "NEWUSER20",
                "notes": "Khách hàng mới, áp dụng KM."
            },
            # "example": { # for renewal
            #     "buyer_user_id": "60d5ec49f7b4e6a0e7d5c2a1",
            #     "transaction_type": "renewal",
            #     "subscription_id_to_renew": "60d5ec49f7b4e6a0e7d5c2c3",
            #     "purchased_duration_days": 365,
            #     "transaction_amount": 899.00,
            #     "notes": "Gia hạn gói Pro."
            # }
        }
    )

class TransactionCreateByUser(BaseModel):
    transaction_type: TransactionTypeEnum = Field(..., description="Loại giao dịch: mua mới hoặc gia hạn.")
    license_id_for_new_purchase: Optional[PyObjectId] = Field(default=None, description="ID của license người dùng muốn mua (bắt buộc nếu mua mới).")
    subscription_id_to_renew: Optional[PyObjectId] = Field(default=None, description="ID của subscription hiện tại người dùng muốn gia hạn (bắt buộc nếu gia hạn).")
    promotion_code: Optional[str] = Field(default=None, max_length=50, description="Mã khuyến mãi (nếu có).")
    user_notes: Optional[str] = Field(default=None, max_length=500, description="Ghi chú từ người dùng (nếu có).")


    @field_validator('license_id_for_new_purchase')
    def check_user_new_purchase_fields(cls, v, values):
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.new_purchase and v is None:
            raise ValueError('license_id_for_new_purchase is required for new_purchase transactions by user')
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.renewal and v is not None:
            raise ValueError('license_id_for_new_purchase must be null for renewal transactions by user')
        return v

    @field_validator('subscription_id_to_renew')
    def check_user_renewal_fields(cls, v, values):
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.renewal and v is None:
            raise ValueError('subscription_id_to_renew is required for renewal transactions by user')
        if 'transaction_type' in values.data and values.data['transaction_type'] == TransactionTypeEnum.new_purchase and v is not None:
            raise ValueError('subscription_id_to_renew must be null for new_purchase transactions by user')
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": { # for new purchase
                "transaction_type": "new_purchase",
                "license_id_for_new_purchase": "60d5ec49f7b4e6a0e7d5c2b2", # User chọn license
                "promotion_code": "WELCOME10",
                "user_notes": "Tôi muốn mua gói này."
            },
            # "example": { # for renewal
            #     "transaction_type": "renewal",
            #     "subscription_id_to_renew": "60d5ec49f7b4e6a0e7d5c2c3", # User chọn sub để gia hạn
            #     "user_notes": "Xin vui lòng gia hạn giúp tôi."
            # }
        }
    )

class TransactionUpdateByAdmin(BaseModel):
    transaction_amount: Optional[float] = Field(default=None, ge=0)
    purchased_duration_days: Optional[int] = Field(default=None, gt=0)
    promotion_code: Optional[str] = Field(default=None) 
    notes: Optional[str] = Field(default=None)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transaction_amount": 95.00,
                "purchased_duration_days": 35,
                "promotion_code": "LOYALTY5",
                "notes": "Cập nhật giá và thêm ghi chú."
            }
        }
    )

class TransactionInDB(TransactionBase):
    id: PyObjectId = Field(alias="_id") 
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionPublic(TransactionBase):
    id: PyObjectId = Field(alias="_id") 
    created_at: datetime
    updated_at: datetime

class TransactionStatusUpdate(BaseModel):
    status: Literal[PaymentStatusEnum.succeeded, PaymentStatusEnum.canceled]
    admin_notes: Optional[str] = Field(default=None, description="Ghi chú thêm của admin khi xác nhận hoặc hủy.")