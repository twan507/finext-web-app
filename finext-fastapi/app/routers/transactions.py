# finext-fastapi/app/routers/transactions.py
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.transactions as crud_transactions
import app.crud.brokers as crud_brokers  # Giữ lại nếu cần
from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database
from app.schemas.transactions import (
    PaymentStatusEnum,
    TransactionCreateByUser,
    TransactionCreateForAdmin,
    TransactionPublic,
    TransactionAdminResponse,
    TransactionTypeEnum,
    TransactionPaymentConfirmationRequest,
    TransactionPriceCalculationRequest,
    TransactionPriceCalculationResponse,
)
from app.schemas.users import UserInDB

# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse  # Import schema phân trang

# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter(tags=["transactions"])  # Prefix sẽ được đặt ở main.py


@router.post(
    "/admin/create",
    response_model=StandardApiResponse[TransactionAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một giao dịch mới cho một người dùng",
    dependencies=[Depends(require_permission("transaction", "create_any"))],
)
@api_response_wrapper(
    default_success_message="Giao dịch được tạo thành công bởi Admin, đang chờ xử lý.",
    success_status_code=status.HTTP_201_CREATED,
)
async def admin_create_new_transaction(
    transaction_data: TransactionCreateForAdmin,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_transaction = await crud_transactions.create_transaction_for_admin_db(db, transaction_data)
        return TransactionAdminResponse.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/me/orders",
    response_model=StandardApiResponse[TransactionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[User] Tự tạo một đơn hàng/giao dịch mới (chờ thanh toán)",
    dependencies=[Depends(require_permission("transaction", "create_own"))],
)
@api_response_wrapper(
    default_success_message="Đơn hàng của bạn đã được tạo, đang chờ xử lý thanh toán.",
    success_status_code=status.HTTP_201_CREATED,
)
async def user_create_new_order(
    transaction_data: TransactionCreateByUser,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_transaction = await crud_transactions.create_transaction_by_user_db(db, transaction_data, current_user)
        return TransactionPublic.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# <<<< PHẦN CẬP NHẬT ENDPOINT /admin/all >>>>
@router.get(
    "/admin/all",
    response_model=StandardApiResponse[PaginatedResponse[TransactionAdminResponse]],  # SỬA RESPONSE MODEL
    summary="[Admin] Lấy danh sách tất cả giao dịch (hỗ trợ filter và phân trang)",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách giao dịch thành công.")
async def admin_read_all_transactions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số bản ghi tối đa mỗi trang"),
    payment_status: Optional[PaymentStatusEnum] = Query(None, description="Lọc theo trạng thái thanh toán"),
    transaction_type: Optional[TransactionTypeEnum] = Query(None, description="Lọc theo loại giao dịch"),
    buyer_user_id: Optional[PyObjectId] = Query(None, description="Lọc theo ID người mua (chuỗi ObjectId)"),
    broker_code_applied: Optional[str] = Query(None, description="Lọc theo mã Đối tác đã áp dụng."),
    promotion_code_filter: Optional[str] = Query(None, alias="promotion_code", description="Lọc theo mã khuyến mãi đã áp dụng."),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transactions_docs, total_count = await crud_transactions.get_all_transactions(
        db,
        payment_status=payment_status,
        transaction_type=transaction_type,
        buyer_user_id_str=buyer_user_id,
        broker_code_applied_filter=broker_code_applied,
        promotion_code_filter=promotion_code_filter,
        skip=skip,
        limit=limit,
    )

    items = [TransactionAdminResponse.model_validate(t) for t in transactions_docs]
    return PaginatedResponse[TransactionAdminResponse](items=items, total=total_count)


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


@router.get(
    "/admin/{transaction_id}",
    response_model=StandardApiResponse[TransactionAdminResponse],
    summary="[Admin] Lấy chi tiết một giao dịch theo ID",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin giao dịch thành công.")
async def admin_read_transaction_by_id(  # Đổi tên hàm
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transaction = await crud_transactions.get_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Giao dịch không tìm thấy.")
    return TransactionAdminResponse.model_validate(transaction)


@router.delete(
    "/admin/{transaction_id}",
    response_model=StandardApiResponse[dict],
    summary="[Admin] Xóa một giao dịch (chỉ được phép nếu không có subscription liên kết)",
    dependencies=[Depends(require_permission("transaction", "delete_any"))],
)
@api_response_wrapper(default_success_message="Xóa giao dịch thành công.")
async def admin_delete_transaction(
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        success = await crud_transactions.delete_transaction_db(db, transaction_id)
        if success:
            return {"message": f"Giao dịch {transaction_id} đã được xóa thành công", "deleted_transaction_id": transaction_id}
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Giao dịch không tìm thấy.")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error deleting transaction {transaction_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ khi xóa giao dịch.")


@router.put(
    "/admin/{transaction_id}/confirm-payment",
    response_model=StandardApiResponse[TransactionAdminResponse],
    summary="[Admin] Xác nhận thanh toán thành công cho một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "confirm_payment_any"))],
)
@api_response_wrapper(default_success_message="Xác nhận thanh toán và xử lý subscription thành công.")
async def admin_confirm_transaction_payment(  # Đổi tên hàm
    transaction_id: PyObjectId,
    confirmation_request: TransactionPaymentConfirmationRequest = Body(...),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        confirmed_transaction = await crud_transactions.confirm_transaction_payment_db(db, transaction_id, confirmation_request)
        return TransactionAdminResponse.model_validate(confirmed_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(
            f"Lỗi khi admin xác nhận thanh toán cho transaction {transaction_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi máy chủ khi xử lý subscription sau khi xác nhận thanh toán: {str(e)}",
        )


@router.put(
    "/admin/{transaction_id}/cancel",
    response_model=StandardApiResponse[TransactionAdminResponse],
    summary="[Admin] Hủy một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "cancel_any"))],
)
@api_response_wrapper(default_success_message="Giao dịch đã được hủy thành công.")
async def admin_cancel_pending_transaction(  # Đổi tên hàm
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        canceled_transaction = await crud_transactions.cancel_transaction_db(db, transaction_id)
        return TransactionAdminResponse.model_validate(canceled_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/me/history",
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[User] Lấy lịch sử giao dịch của người dùng hiện tại",
    dependencies=[Depends(require_permission("transaction", "read_own"))],
)
@api_response_wrapper(default_success_message="Lấy lịch sử giao dịch thành công.")
async def read_my_transaction_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=99999),
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transactions = await crud_transactions.get_transactions_by_user_id(db, str(current_user.id), skip, limit)
    return [TransactionPublic.model_validate(t) for t in transactions]


@router.get(
    "/me/referred",
    response_model=StandardApiResponse[PaginatedResponse[TransactionPublic]],  # Sửa để trả về PaginatedResponse
    summary="[Broker] Lấy danh sách các giao dịch đã sử dụng mã giới thiệu của mình",
    dependencies=[Depends(require_permission("transaction", "read_referred"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách giao dịch giới thiệu thành công.")
async def read_my_referred_transactions(
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=99999, description="Số bản ghi tối đa mỗi trang"),
    payment_status: Optional[PaymentStatusEnum] = Query(None, description="Lọc theo trạng thái thanh toán (ví dụ: succeeded)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker_info = await crud_brokers.get_broker_by_user_id(db, current_user.id)
    if not broker_info or not broker_info.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không phải là Đối tác hoặc tài khoản Đối tác của bạn không hoạt động.",
        )

    transactions_docs, total_count = await crud_transactions.get_all_transactions(
        db=db,
        broker_code_applied_filter=broker_info.broker_code,  # Lọc theo broker_code của user hiện tại
        payment_status=payment_status,
        skip=skip,
        limit=limit,
        # Các filter khác có thể thêm vào đây nếu cần (transaction_type, buyer_user_id)
    )
    items = [TransactionPublic.model_validate(t) for t in transactions_docs]
    return PaginatedResponse[TransactionPublic](items=items, total=total_count)


@router.post(
    "/admin/{transaction_id}/calculate-price",
    response_model=StandardApiResponse[TransactionPriceCalculationResponse],
    summary="[Admin] Tính toán giá tạm thời khi thay đổi mã khuyến mãi/đối tác",
    dependencies=[Depends(require_permission("transaction", "update_any"))],
)
@api_response_wrapper(default_success_message="Tính toán giá thành công.")
async def calculate_transaction_price(
    transaction_id: PyObjectId,
    calculation_request: TransactionPriceCalculationRequest,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        calculated_data = await crud_transactions.calculate_transaction_price_with_overrides(
            db=db,
            transaction_id_str=transaction_id,
            promotion_code_override=calculation_request.promotion_code_override,
            broker_code_override=calculation_request.broker_code_override,
        )
        return TransactionPriceCalculationResponse(**calculated_data)
    except ValueError as ve:
        logger.error(f"Error calculating transaction price for {transaction_id}: {ve}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Unexpected error calculating transaction price for {transaction_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Lỗi máy chủ khi tính toán giá.")
