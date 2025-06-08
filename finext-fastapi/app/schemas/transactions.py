# finext-fastapi/app/schemas/transactions.py
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime, timezone

from app.utils.types import PyObjectId


class PaymentStatusEnum(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    CANCELED = "canceled"


class TransactionTypeEnum(str, Enum):
    NEW_PURCHASE = "new_purchase"
    RENEWAL = "renewal"


class TransactionBase(BaseModel):
    buyer_user_id: PyObjectId = Field(..., description="ID của người dùng mua hàng.")
    license_id: PyObjectId = Field(..., description="ID của gói license liên quan.")
    license_key: str = Field(..., description="Khóa của gói license.")
    original_license_price: float = Field(..., ge=0, description="Giá gốc của license tại thời điểm giao dịch.")
    purchased_duration_days: int = Field(..., gt=0, description="Số ngày thời hạn của gói được mua/gia hạn.")

    # Mã và số tiền giảm giá từ khuyến mãi
    promotion_code_applied: Optional[str] = Field(default=None, description="Mã khuyến mãi đã được áp dụng cho giao dịch này.")
    promotion_discount_amount: Optional[float] = Field(default=None, ge=0, description="Số tiền đã được giảm nhờ mã khuyến mãi.")

    # Mã và số tiền giảm giá từ broker
    broker_code_applied: Optional[str] = Field(default=None, description="Mã đối tác đã được áp dụng cho giao dịch này.")
    broker_discount_amount: Optional[float] = Field(
        default=None,
        ge=0,
        description="Số tiền đã được giảm nhờ mã giới thiệu của đối tác.",
    )

    # Tổng số tiền giảm giá (tính tổng từ promotion và broker nếu có)
    total_discount_amount: Optional[float] = Field(default=None, ge=0, description="Tổng số tiền giảm giá từ tất cả các nguồn.")

    transaction_amount: float = Field(
        ...,
        ge=0,
        description="Số tiền thực tế của giao dịch (SAU KHI đã áp dụng tất cả các loại giảm giá).",
    )

    payment_status: PaymentStatusEnum = Field(
        default=PaymentStatusEnum.PENDING,
        description="Trạng thái thanh toán của giao dịch.",
    )
    transaction_type: TransactionTypeEnum = Field(..., description="Loại giao dịch (mua mới hoặc gia hạn).")
    notes: Optional[str] = Field(default=None, description="Ghi chú của người dùng hoặc admin về giao dịch.")
    target_subscription_id: Optional[PyObjectId] = Field(default=None, description="ID của subscription được tạo/gia hạn (nếu có).")
    # broker_code_applied đã được chuyển lên trên

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        use_enum_values=True,
    )


class TransactionCreateForAdmin(BaseModel):
    buyer_user_id: PyObjectId
    transaction_type: TransactionTypeEnum
    purchased_duration_days: int = Field(..., gt=0)
    promotion_code: Optional[str] = Field(default=None, description="Mã khuyến mãi admin muốn áp dụng.")
    notes: Optional[str] = None
    broker_code: Optional[str] = Field(
        default=None, description="Mã broker admin muốn áp dụng. Nếu không nhập, sẽ tự lấy từ referral_code của user."
    )

    license_id_for_new_purchase: Optional[PyObjectId] = None
    subscription_id_to_renew: Optional[PyObjectId] = None

    @field_validator("license_id_for_new_purchase")
    def check_admin_new_purchase_fields(cls, v, values):
        transaction_type_val = values.data.get("transaction_type")
        if transaction_type_val == TransactionTypeEnum.NEW_PURCHASE and v is None:
            raise ValueError("license_id_for_new_purchase is required for new_purchase transactions by admin")
        if transaction_type_val == TransactionTypeEnum.RENEWAL and v is not None:
            raise ValueError("license_id_for_new_purchase must be null for renewal transactions by admin")
        return v

    @field_validator("subscription_id_to_renew")
    def check_admin_renewal_fields(cls, v, values):
        transaction_type_val = values.data.get("transaction_type")
        if transaction_type_val == TransactionTypeEnum.RENEWAL and v is None:
            raise ValueError("subscription_id_to_renew is required for renewal transactions by admin")
        if transaction_type_val == TransactionTypeEnum.NEW_PURCHASE and v is not None:
            raise ValueError("subscription_id_to_renew must be null for new_purchase transactions by admin")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "buyer_user_id": "60d5ec49f7b4e6a0e7d5c2a1",
                "transaction_type": "new_purchase",
                "license_id_for_new_purchase": "60d5ec49f7b4e6a0e7d5c2b2",
                "purchased_duration_days": 30,
                "promotion_code": "ADMINSPECIAL",
                "broker_code": "ABCD",
                "notes": "Admin tạo giao dịch, áp dụng KM đặc biệt.",
            }
        }
    )


class TransactionCreateByUser(BaseModel):
    transaction_type: TransactionTypeEnum = Field(..., description="Loại giao dịch: mua mới hoặc gia hạn.")
    license_id_for_new_purchase: Optional[PyObjectId] = Field(
        default=None,
        description="ID của license người dùng muốn mua (bắt buộc nếu mua mới).",
    )
    subscription_id_to_renew: Optional[PyObjectId] = Field(
        default=None,
        description="ID của subscription hiện tại người dùng muốn gia hạn (bắt buộc nếu gia hạn).",
    )
    promotion_code: Optional[str] = Field(default=None, max_length=50, description="Mã khuyến mãi (nếu có).")
    user_notes: Optional[str] = Field(default=None, max_length=500, description="Ghi chú từ người dùng (nếu có).")
    broker_code: Optional[str] = Field(
        default=None,
        description="Mã đối tác tùy chọn nhập tại thời điểm giao dịch (nếu user chưa có mã GT mặc định hoặc muốn ghi đè).",
    )

    @field_validator("license_id_for_new_purchase")
    def check_user_new_purchase_fields(cls, v, values):
        transaction_type_val = values.data.get("transaction_type")
        if transaction_type_val == TransactionTypeEnum.NEW_PURCHASE and v is None:
            raise ValueError("license_id_for_new_purchase is required for new_purchase transactions by user")
        if transaction_type_val == TransactionTypeEnum.RENEWAL and v is not None:
            raise ValueError("license_id_for_new_purchase must be null for renewal transactions by user")
        return v

    @field_validator("subscription_id_to_renew")
    def check_user_renewal_fields(cls, v, values):
        transaction_type_val = values.data.get("transaction_type")
        if transaction_type_val == TransactionTypeEnum.RENEWAL and v is None:
            raise ValueError("subscription_id_to_renew is required for renewal transactions by user")
        if transaction_type_val == TransactionTypeEnum.NEW_PURCHASE and v is not None:
            raise ValueError("subscription_id_to_renew must be null for new_purchase transactions by user")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transaction_type": "new_purchase",
                "license_id_for_new_purchase": "60d5ec49f7b4e6a0e7d5c2b2",
                "promotion_code": "WELCOME10",
                "user_notes": "Tôi muốn mua gói này.",
                "broker_code": "XYZ1",
            }
        }
    )


class TransactionUpdateByAdmin(BaseModel):
    purchased_duration_days: Optional[int] = Field(default=None, gt=0)
    promotion_code: Optional[str] = Field(
        default=None,
        description="Cập nhật mã khuyến mãi. Gửi chuỗi rỗng hoặc null để xóa.",
    )
    notes: Optional[str] = Field(default=None)
    # Admin có thể muốn ghi đè broker code trong một số trường hợp đặc biệt cho giao dịch PENDING
    broker_code_applied_override: Optional[str] = Field(default=None, description="Ghi đè mã đối tác. Gửi chuỗi rỗng hoặc null để xóa.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "purchased_duration_days": 35,
                "promotion_code": "LOYALTY5",
                "notes": "Cập nhật giá và thêm ghi chú.",
                "broker_code_applied_override": "NEWBROKER",
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


class TransactionPaymentConfirmationRequest(BaseModel):  # Schema mới cho body của endpoint confirm
    admin_notes: Optional[str] = Field(default=None, description="Ghi chú của admin khi xác nhận thanh toán.")
    final_transaction_amount_override: Optional[float] = Field(
        default=None,
        ge=0,
        description="Số tiền giao dịch cuối cùng do admin ghi đè (nếu cần thiết).",
    )
    duration_days_override: Optional[int] = Field(
        default=None,
        gt=0,
        description="Số ngày sử dụng ghi đè khi tạo/gia hạn subscription (nếu cần thiết).",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "admin_notes": "Khách hàng đã chuyển khoản đủ.",
                "final_transaction_amount_override": 150000.00,  # Ví dụ admin sửa lại giá cuối
                "duration_days_override": 45,  # Ví dụ admin ghi đè thời hạn thành 45 ngày
            }
        }
    )
