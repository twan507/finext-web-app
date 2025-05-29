# finext-fastapi/app/routers/transactions.py
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Body # THÊM Body
from motor.motor_asyncio import AsyncIOMotorDatabase

import app.crud.transactions as crud_transactions
import app.crud.brokers as crud_brokers
from app.auth.access import require_permission
from app.auth.dependencies import get_current_active_user
from app.core.database import get_database
from app.schemas.transactions import (
    PaymentStatusEnum,
    TransactionCreateByUser,
    TransactionCreateForAdmin,
    TransactionPublic,
    TransactionTypeEnum,
    TransactionUpdateByAdmin,
    TransactionPaymentConfirmationRequest, # Đảm bảo import schema này
)
from app.schemas.users import UserInDB
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
# router = APIRouter() # Giữ nguyên nếu đã khai báo ở cuối file hoặc ở main.py
# Nếu khai báo ở đây:
router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"]) # Sửa lại prefix và tags


# --- API cho Admin ---
@router.post(
    "/admin/create", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[TransactionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo một giao dịch mới cho một người dùng",
    dependencies=[Depends(require_permission("transaction", "create_any"))],
    # tags=["transactions"], # Bỏ nếu đã khai báo ở router
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
        created_transaction = await crud_transactions.create_transaction_for_admin_db(
            db, transaction_data
        )
        # if not created_transaction: # CRUD sẽ raise ValueError nếu có lỗi logic
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Không thể tạo giao dịch (admin). Vui lòng kiểm tra thông tin đầu vào hoặc lỗi máy chủ.",
        #     )
        return TransactionPublic.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post(
    "/me/orders", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[TransactionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[User] Tự tạo một đơn hàng/giao dịch mới (chờ thanh toán)",
    dependencies=[Depends(require_permission("transaction", "create_own"))],
    # tags=["transactions"],
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
        created_transaction = await crud_transactions.create_transaction_by_user_db(
            db, transaction_data, current_user
        )
        # if not created_transaction: # CRUD sẽ raise ValueError
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Không thể tạo đơn hàng của bạn. Vui lòng kiểm tra thông tin license/subscription hoặc lỗi máy chủ.",
        #     )
        return TransactionPublic.model_validate(created_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/admin/all", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[Admin] Lấy danh sách tất cả giao dịch (hỗ trợ filter và phân trang)",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
    # tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách giao dịch thành công.")
async def admin_read_all_transactions(
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=200, description="Số bản ghi tối đa mỗi trang"),
    payment_status: Optional[PaymentStatusEnum] = Query(None, description="Lọc theo trạng thái thanh toán"),
    transaction_type: Optional[TransactionTypeEnum] = Query(None, description="Lọc theo loại giao dịch"),
    buyer_user_id: Optional[PyObjectId] = Query(None, description="Lọc theo ID người mua"),
    broker_code_applied: Optional[str] = Query(None, description="Lọc theo mã Đối tác đã áp dụng."),
    promotion_code_filter: Optional[str] = Query(None, alias="promotion_code", description="Lọc theo mã khuyến mãi đã áp dụng."), # Thêm filter
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transactions, total_count = await crud_transactions.get_all_transactions(
        db, payment_status, transaction_type, buyer_user_id, broker_code_applied, promotion_code_filter, skip, limit
    )
    return [TransactionPublic.model_validate(t) for t in transactions]


@router.get(
    "/admin/{transaction_id}", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Lấy chi tiết một giao dịch theo ID",
    dependencies=[Depends(require_permission("transaction", "read_any"))],
    # tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin giao dịch thành công.")
async def admin_read_transaction_by_id(
    transaction_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transaction = await crud_transactions.get_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Giao dịch không tìm thấy."
        )
    return TransactionPublic.model_validate(transaction)


@router.put(
    "/admin/{transaction_id}/details", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Cập nhật chi tiết của một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "update_details_any"))],
    # tags=["transactions"],
)
@api_response_wrapper(default_success_message="Cập nhật chi tiết giao dịch thành công.")
async def admin_update_transaction_pending_details(
    transaction_id: PyObjectId,
    update_data: TransactionUpdateByAdmin,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_transaction = await crud_transactions.update_transaction_details_db(
            db, transaction_id, update_data
        )
        # if not updated_transaction: # CRUD sẽ raise ValueError
        #     raise HTTPException(
        #         status_code=status.HTTP_404_NOT_FOUND,
        #         detail="Giao dịch không tìm thấy hoặc không thể cập nhật chi tiết.",
        #     )
        return TransactionPublic.model_validate(updated_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/admin/{transaction_id}/confirm-payment", # Đã có trong file gốc
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Xác nhận thanh toán thành công cho một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "confirm_payment_any"))],
    # tags=["transactions"],
)
@api_response_wrapper(
    default_success_message="Xác nhận thanh toán và xử lý subscription thành công."
)
async def admin_confirm_transaction_payment(
    transaction_id: PyObjectId,
    confirmation_request: TransactionPaymentConfirmationRequest = Body(...), # <<< THAY ĐỔI: Nhận request body
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        confirmed_transaction = await crud_transactions.confirm_transaction_payment_db(
            db, transaction_id, confirmation_request # <<< THAY ĐỔI: Truyền request body
        )
        # if not confirmed_transaction: # CRUD sẽ raise ValueError
        #     raise HTTPException(
        #         status_code=status.HTTP_404_NOT_FOUND,
        #         detail="Giao dịch không tìm thấy hoặc không thể xác nhận thanh toán.",
        #     )
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
            detail=f"Lỗi máy chủ khi xử lý subscription sau khi xác nhận thanh toán: {str(e)}",
        )


@router.put(
    "/admin/{transaction_id}/cancel", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[TransactionPublic],
    summary="[Admin] Hủy một giao dịch 'pending'",
    dependencies=[Depends(require_permission("transaction", "cancel_any"))],
    # tags=["transactions"],
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
        # if not canceled_transaction: # CRUD sẽ raise ValueError
        #     raise HTTPException(
        #         status_code=status.HTTP_404_NOT_FOUND,
        #         detail="Giao dịch không tìm thấy hoặc không thể hủy.",
        #     )
        return TransactionPublic.model_validate(canceled_transaction)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/me/history", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[User] Lấy lịch sử giao dịch của người dùng hiện tại",
    dependencies=[Depends(require_permission("transaction", "read_own"))],
    # tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy lịch sử giao dịch thành công.")
async def read_my_transaction_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    transactions = await crud_transactions.get_transactions_by_user_id(
        db, str(current_user.id), skip, limit
    )
    return [TransactionPublic.model_validate(t) for t in transactions]


@router.get(
    "/me/referred", # Đã có trong file gốc, giữ nguyên
    response_model=StandardApiResponse[List[TransactionPublic]],
    summary="[Broker] Lấy danh sách các giao dịch đã sử dụng mã giới thiệu của mình",
    dependencies=[Depends(require_permission("transaction", "read_referred"))],
    # tags=["transactions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách giao dịch giới thiệu thành công.")
async def read_my_referred_transactions(
    current_user: UserInDB = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Số bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=200, description="Số bản ghi tối đa mỗi trang"),
    payment_status: Optional[PaymentStatusEnum] = Query(None, description="Lọc theo trạng thái thanh toán (ví dụ: succeeded)"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    broker_info = await crud_brokers.get_broker_by_user_id(db, current_user.id) # type: ignore
    if not broker_info or not broker_info.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không phải là Đối tác hoặc tài khoản Đối tác của bạn không hoạt động.",
        )
    
    transactions, total_count = await crud_transactions.get_all_transactions(
        db=db,
        broker_code_applied_filter=broker_info.broker_code,
        payment_status=payment_status,
        skip=skip,
        limit=limit
    )
    return [TransactionPublic.model_validate(t) for t in transactions]