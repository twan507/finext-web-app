# finext-fastapi/app/routers/transactions.py
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.transactions as crud_transactions
from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database  # Giữ nguyên import này
from app.schemas.transactions import (
    PaymentStatusEnum,
    TransactionCreateByUser,
    TransactionCreateForAdmin,
    TransactionPublic,
    TransactionTypeEnum,
    TransactionUpdateByAdmin,
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter()


# --- API cho Admin ---
@router.post(
    "/admin/create",
    response_model=StandardApiResponse[TransactionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một giao dịch mới cho một người dùng",
    dependencies=[Depends(require_permission("transaction", "create_any"))],
    tags=["transactions"],
)
@api_response_wrapper(
    default_success_message="Giao dịch được tạo thành công bởi Admin, đang chờ xử lý.",
    success_status_code=status.HTTP_201_CREATED,
)
async def admin_create_new_transaction(
    transaction_data: TransactionCreateForAdmin,
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_transaction = await crud_transactions.create_transaction_for_admin_db(
            db, transaction_data
        )
        if not created_transaction:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo giao dịch (admin) do lỗi máy chủ.",
            )
        return TransactionPublic.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# --- API mới cho User tự tạo Transaction ---
@router.post(
    "/me/orders",
    response_model=StandardApiResponse[TransactionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[User] Tự tạo một đơn hàng/giao dịch mới (chờ thanh toán)",
    dependencies=[Depends(require_permission("transaction", "create_own"))],
    tags=["transactions"],
)
@api_response_wrapper(
    default_success_message="Đơn hàng của bạn đã được tạo, đang chờ xử lý thanh toán.",
    success_status_code=status.HTTP_201_CREATED,
)
async def user_create_new_order(
    transaction_data: TransactionCreateByUser,
    current_user: UserInDB = Depends(get_current_active_user),
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_transaction = await crud_transactions.create_transaction_by_user_db(
            db, transaction_data, current_user
        )
        if not created_transaction:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo đơn hàng của bạn do lỗi máy chủ.",
            )
        return TransactionPublic.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# ... (Sửa tương tự cho các endpoint khác trong file này) ...


@router.get(
    "/admin/all",
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[Admin] Lấy danh sách tất cả giao dịch (hỗ trợ filter và phân trang)",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
    tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách giao dịch thành công.")
async def admin_read_all_transactions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(10, ge=1, le=100, description="Số bản ghi tối đa mỗi trang"),
    payment_status: Optional[PaymentStatusEnum] = Query(
        None, description="Lọc theo trạng thái thanh toán"
    ),
    transaction_type: Optional[TransactionTypeEnum] = Query(
        None, description="Lọc theo loại giao dịch"
    ),
    buyer_user_id: Optional[PyObjectId] = Query(
        None, description="Lọc theo ID người mua"
    ),
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transactions, total_count = await crud_transactions.get_all_transactions(
        db, payment_status, transaction_type, buyer_user_id, skip, limit
    )
    return [TransactionPublic.model_validate(t) for t in transactions]


@router.get(
    "/admin/{transaction_id}",
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Lấy chi tiết một giao dịch theo ID",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
    tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin giao dịch thành công.")
async def admin_read_transaction_by_id(
    transaction_id: PyObjectId,
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transaction = await crud_transactions.get_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Giao dịch không tìm thấy."
        )
    return TransactionPublic.model_validate(transaction)


@router.put(
    "/admin/{transaction_id}/details",
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Cập nhật chi tiết của một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "update_details_any"))],
    tags=["transactions"],
)
@api_response_wrapper(default_success_message="Cập nhật chi tiết giao dịch thành công.")
async def admin_update_transaction_pending_details(
    transaction_id: PyObjectId,
    update_data: TransactionUpdateByAdmin,
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_transaction = await crud_transactions.update_transaction_details_db(
            db, transaction_id, update_data
        )
        if not updated_transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Giao dịch không tìm thấy để cập nhật.",
            )
        return TransactionPublic.model_validate(updated_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/admin/{transaction_id}/confirm-payment",
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Xác nhận thanh toán thành công cho một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "confirm_payment_any"))],
    tags=["transactions"],
)
@api_response_wrapper(
    default_success_message="Xác nhận thanh toán và xử lý subscription thành công."
)
async def admin_confirm_transaction_payment(
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        confirmed_transaction = await crud_transactions.confirm_transaction_payment_db(
            db, transaction_id
        )
        if not confirmed_transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Giao dịch không tìm thấy hoặc không thể xác nhận.",
            )
        return TransactionPublic.model_validate(confirmed_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(
            f"Lỗi khi admin xác nhận thanh toán cho transaction {transaction_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi máy chủ khi xử lý subscription: {str(e)}",
        )


@router.put(
    "/admin/{transaction_id}/cancel",
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Hủy một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "cancel_any"))],
    tags=["transactions"],
)
@api_response_wrapper(default_success_message="Giao dịch đã được hủy thành công.")
async def admin_cancel_pending_transaction(
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        canceled_transaction = await crud_transactions.cancel_transaction_db(
            db, transaction_id
        )
        if not canceled_transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Giao dịch không tìm thấy hoặc không thể hủy.",
            )
        return TransactionPublic.model_validate(canceled_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/me/history",
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[User] Lấy lịch sử giao dịch của người dùng hiện tại",
    dependencies=[Depends(require_permission("transaction", "read_own"))],
    tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy lịch sử giao dịch thành công.")
async def read_my_transaction_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    current_user: UserInDB = Depends(get_current_active_user),
    # SỬA Ở ĐÂY: Chỉ định db_name
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    # Hàm get_transactions_by_user_id trả về list, không phải tuple
    transactions = await crud_transactions.get_transactions_by_user_id(
        db, str(current_user.id), skip, limit
    )
    return transactions
