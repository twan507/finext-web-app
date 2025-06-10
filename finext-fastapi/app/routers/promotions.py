# finext-fastapi/app/routers/promotions.py
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.auth.access import require_permission
from app.schemas.promotions import (
    PromotionCreate,
    PromotionPublic,
    PromotionUpdate,
    PromotionValidationResponse,
    DiscountTypeEnum,  # Import DiscountTypeEnum nếu dùng trong filter
)

# <<<< PHẦN CẬP NHẬT IMPORT >>>>
from app.schemas.common import PaginatedResponse  # Import schema phân trang

# <<<< KẾT THÚC PHẦN CẬP NHẬT IMPORT >>>>
import app.crud.promotions as crud_promotions
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter()  # Prefix và tags sẽ được thêm ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[PromotionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo mã khuyến mãi mới",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],  # Thêm tags ở đây
)
@api_response_wrapper(
    default_success_message="Mã khuyến mãi được tạo thành công.",
    success_status_code=status.HTTP_201_CREATED,
)
async def create_new_promotion(
    promotion_data: PromotionCreate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        created_promo = await crud_promotions.create_promotion(db, promotion_data)
        # crud_promotions.create_promotion đã raise ValueError nếu có lỗi logic
        if not created_promo:
            raise HTTPException(  # Lỗi không mong muốn khác
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo mã khuyến mãi do lỗi máy chủ.",
            )
        return PromotionPublic.model_validate(created_promo)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# <<<< PHẦN CẬP NHẬT ENDPOINT LIST ALL PROMOTIONS >>>>
@router.get(
    "/",
    response_model=StandardApiResponse[PaginatedResponse[PromotionPublic]],  # SỬA RESPONSE MODEL
    summary="[Admin] Lấy danh sách các mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Lấy danh sách mã khuyến mãi thành công.")
async def read_all_promotions(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=10000, description="Số lượng bản ghi tối đa trả về"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái hoạt động (true/false)"),
    # Thêm các filter nếu bạn đã định nghĩa trong CRUD:
    # promotion_code_filter: Optional[str] = Query(None, alias="code_contains", description="Lọc theo mã KM chứa chuỗi"),
    # discount_type_filter: Optional[DiscountTypeEnum] = Query(None, alias="type", description="Lọc theo loại giảm giá"),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    promos_docs, total_count = await crud_promotions.get_promotions(
        db,
        skip=skip,
        limit=limit,
        is_active=is_active,
        # promotion_code_filter=promotion_code_filter, # Truyền filter nếu có
        # discount_type_filter=discount_type_filter,
    )

    items = [PromotionPublic.model_validate(p) for p in promos_docs]
    return PaginatedResponse[PromotionPublic](items=items, total=total_count)


# <<<< KẾT THÚC PHẦN CẬP NHẬT >>>>


@router.get(
    "/{promotion_id}",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Lấy chi tiết một mã khuyến mãi theo ID",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Lấy thông tin mã khuyến mãi thành công.")
async def read_promotion_by_id_route(
    promotion_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    promo = await crud_promotions.get_promotion_by_id(db, promotion_id)
    if promo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mã khuyến mãi với ID {promotion_id} không tìm thấy.",
        )
    return PromotionPublic.model_validate(promo)


@router.put(
    "/{promotion_id}",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Cập nhật thông tin một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Cập nhật mã khuyến mãi thành công.")
async def update_existing_promotion(
    promotion_id: PyObjectId,
    promotion_data: PromotionUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_promo = await crud_promotions.update_promotion(db, promotion_id, promotion_data)
        if updated_promo is None:  # Có thể do promotion_id không tồn tại
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy mã khuyến mãi với ID {promotion_id} để cập nhật.",
            )
        return PromotionPublic.model_validate(updated_promo)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/{promotion_id}/deactivate",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Vô hiệu hóa một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Vô hiệu hóa mã khuyến mãi thành công.")
async def deactivate_one_promotion(
    promotion_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deactivated_promo = await crud_promotions.deactivate_promotion(db, promotion_id)
        if deactivated_promo is None:  # CRUD đã raise ValueError nếu không tìm thấy
            raise HTTPException(  # Trường hợp này ít xảy ra nếu CRUD đã xử lý
                status_code=status.HTTP_404_NOT_FOUND,  # Hoặc 500
                detail=f"Mã khuyến mãi với ID {promotion_id} không tìm thấy hoặc đã được vô hiệu hóa.",
            )
        return PromotionPublic.model_validate(deactivated_promo)
    except ValueError as ve:  # Bắt lỗi từ CRUD (ví dụ: không tìm thấy)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.delete(
    "/{promotion_id}",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Xóa một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Xóa mã khuyến mãi thành công.")
async def delete_one_promotion(
    promotion_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deleted_promo = await crud_promotions.delete_promotion(db, promotion_id)
        if not deleted_promo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mã khuyến mãi với ID {promotion_id} không tìm thấy hoặc không thể xóa.",
            )
        return PromotionPublic.model_validate(deleted_promo)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/validate/{promotion_code_str}",
    response_model=StandardApiResponse[PromotionValidationResponse],
    summary="[User/Public] Kiểm tra tính hợp lệ của một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "validate"))],
    tags=["promotions"],
)
@api_response_wrapper(default_success_message="Kiểm tra mã khuyến mãi hoàn tất.")
async def validate_one_promotion_code(
    promotion_code_str: str,
    original_amount: Optional[float] = Query(
        None,
        description="Số tiền gốc của đơn hàng để tính toán giảm giá (nếu mã hợp lệ).",
        ge=0,  # Giá trị không âm
    ),
    license_key: Optional[str] = Query(
        None,
        description="License key của sản phẩm đang được mua (nếu mã KM chỉ áp dụng cho license cụ thể).",
    ),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    promo = await crud_promotions.is_promotion_code_valid_and_active(
        db,
        promotion_code=promotion_code_str,
        license_key_to_check=license_key,
    )

    if promo:
        message = "Mã khuyến mãi hợp lệ."
        discount_applied_val: Optional[float] = None
        final_amount_val: Optional[float] = None

        if original_amount is not None:  # Chỉ tính toán nếu có original_amount
            if original_amount < 0:  # Kiểm tra thêm
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Số tiền gốc không thể âm.")

            discount_applied_val, final_amount_val = crud_promotions.calculate_discounted_amount(original_amount, promo)
            message += f" Giảm {promo.discount_value}{'%' if promo.discount_type == DiscountTypeEnum.PERCENTAGE else 'VNĐ'}."

        return PromotionValidationResponse(
            is_valid=True,
            promotion_code=promo.promotion_code,
            message=message,
            discount_type=promo.discount_type,
            discount_value=promo.discount_value,
            original_amount=original_amount,
            discounted_amount=discount_applied_val,
            final_amount=final_amount_val,
        )
    else:
        return PromotionValidationResponse(
            is_valid=False,
            promotion_code=promotion_code_str.upper(),  # Trả về mã đã chuẩn hóa
            message="Mã khuyến mãi không hợp lệ, đã hết hạn, hết lượt sử dụng hoặc không áp dụng cho sản phẩm này.",
        )
