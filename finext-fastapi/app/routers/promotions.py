# finext-fastapi/app/routers/promotions.py
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.auth.access import require_permission
from app.schemas.promotions import (
    PromotionCreate,
    PromotionPublic,
    PromotionUpdate,
    PromotionValidationResponse,
    DiscountTypeEnum,
)
import app.crud.promotions as crud_promotions
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.utils.types import PyObjectId

logger = logging.getLogger(__name__)
router = APIRouter()  # Sẽ thêm prefix và tags ở main.py


@router.post(
    "/",
    response_model=StandardApiResponse[PromotionPublic],
    status_code=status.HTTP_201_CREATED,
    summary="[Admin] Tạo mã khuyến mãi mới",
    dependencies=[Depends(require_permission("promotion", "manage"))],
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
        if not created_promo:
            # CRUD đã raise ValueError nếu mã tồn tại hoặc ngày không hợp lệ
            # Trường hợp này có thể là lỗi không mong muốn khác
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Không thể tạo mã khuyến mãi do lỗi máy chủ.",
            )
        return PromotionPublic.model_validate(created_promo)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/",
    response_model=StandardApiResponse[List[PromotionPublic]],
    summary="[Admin] Lấy danh sách các mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
)
@api_response_wrapper(default_success_message="Lấy danh sách mã khuyến mãi thành công.")
async def read_all_promotions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    is_active: Optional[bool] = Query(
        None, description="Lọc theo trạng thái hoạt động"
    ),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    promos = await crud_promotions.get_promotions(
        db, skip=skip, limit=limit, is_active=is_active
    )
    return [PromotionPublic.model_validate(p) for p in promos]


@router.get(
    "/{promotion_id}",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Lấy chi tiết một mã khuyến mãi theo ID",
    dependencies=[Depends(require_permission("promotion", "manage"))],
)
@api_response_wrapper(default_success_message="Lấy thông tin mã khuyến mãi thành công.")
async def read_promotion_by_id_route(  # Đổi tên hàm để tránh trùng
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
)
@api_response_wrapper(default_success_message="Cập nhật mã khuyến mãi thành công.")
async def update_existing_promotion(  # Đổi tên hàm
    promotion_id: PyObjectId,
    promotion_data: PromotionUpdate,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        updated_promo = await crud_promotions.update_promotion(
            db, promotion_id, promotion_data
        )
        if updated_promo is None:
            # Có thể do promotion_id không tồn tại
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy mã khuyến mãi với ID {promotion_id} để cập nhật.",
            )
        return PromotionPublic.model_validate(updated_promo)
    except ValueError as ve:  # Bắt lỗi validation từ CRUD (vd: ngày tháng)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.put(
    "/{promotion_id}/deactivate",
    response_model=StandardApiResponse[PromotionPublic],
    summary="[Admin] Vô hiệu hóa một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "manage"))],
)
@api_response_wrapper(default_success_message="Vô hiệu hóa mã khuyến mãi thành công.")
async def deactivate_one_promotion(  # Đổi tên hàm
    promotion_id: PyObjectId,
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        deactivated_promo = await crud_promotions.deactivate_promotion(db, promotion_id)
        if (
            deactivated_promo is None
        ):  # Should be caught by ValueError in CRUD if not found
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mã khuyến mãi với ID {promotion_id} không tìm thấy để vô hiệu hóa.",
            )
        return PromotionPublic.model_validate(deactivated_promo)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get(
    "/validate/{promotion_code_str}",  # Đổi tên param
    response_model=StandardApiResponse[PromotionValidationResponse],
    summary="[User/Public] Kiểm tra tính hợp lệ của một mã khuyến mãi",
    dependencies=[Depends(require_permission("promotion", "validate"))],
)
@api_response_wrapper(default_success_message="Kiểm tra mã khuyến mãi hoàn tất.")
async def validate_one_promotion_code(  # Đổi tên hàm
    promotion_code_str: str,  # Tên param mới
    original_amount: Optional[float] = Query(
        None,
        description="Số tiền gốc của đơn hàng để tính toán giảm giá (nếu mã hợp lệ).",
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
        # transaction_amount không cần truyền vì min_purchase_amount đã bị loại bỏ
    )

    if promo:
        message = "Mã khuyến mãi hợp lệ."
        discount_applied_val: Optional[float] = None
        final_amount_val: Optional[float] = None

        if original_amount is not None:
            discount_applied_val, final_amount_val = (
                crud_promotions.calculate_discounted_amount(original_amount, promo)
            )
            message += f" Giảm {promo.discount_value}{'%' if promo.discount_type == DiscountTypeEnum.PERCENTAGE else 'VNĐ'}."

        return PromotionValidationResponse(
            is_valid=True,
            promotion_code=promo.promotion_code,  # Trả về mã đã chuẩn hóa
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
            promotion_code=promotion_code_str,
            message="Mã khuyến mãi không hợp lệ, đã hết hạn, hết lượt sử dụng hoặc không áp dụng cho sản phẩm này.",
        )
