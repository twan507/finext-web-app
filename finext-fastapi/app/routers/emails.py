# finext-fastapi/app/routers/emails.py
import logging
import time
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, HTTPException, Request

from app.utils.email_utils import send_email_async
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
from app.schemas.emails import MessageResponse, ConsultationRequest, OpenAccountRequest, PlanInquiryRequest
from app.core.config import MAIL_FROM

logger = logging.getLogger(__name__)
router = APIRouter()

# ========== Rate Limiter (in-memory, per IP) ==========
# Max 1 request per 60 seconds per IP for email endpoints
RATE_LIMIT_SECONDS = 60
_rate_limit_store: Dict[str, float] = {}


def _check_rate_limit(request: Request) -> None:
    """Kiểm tra rate limit theo IP. Raise HTTPException 429 nếu quá giới hạn."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Dọn entries cũ hơn 5 phút để tránh memory leak
    expired_keys = [k for k, v in _rate_limit_store.items() if now - v > 300]
    for k in expired_keys:
        del _rate_limit_store[k]

    last_request_time = _rate_limit_store.get(client_ip)
    if last_request_time and (now - last_request_time) < RATE_LIMIT_SECONDS:
        remaining = int(RATE_LIMIT_SECONDS - (now - last_request_time))
        raise HTTPException(
            status_code=429,
            detail=f"Bạn đã gửi yêu cầu quá nhanh. Vui lòng thử lại sau {remaining} giây."
        )

    _rate_limit_store[client_ip] = now


@router.post(
    "/consultation",
    response_model=StandardApiResponse[MessageResponse],
    summary="Gửi yêu cầu đặt lịch tư vấn cá nhân",
    tags=["emails"]
)
@api_response_wrapper(default_success_message="Yêu cầu tư vấn đã được gửi thành công.")
async def send_consultation_request(
    request: Request,
    request_data: ConsultationRequest,
):
    _check_rate_limit(request)

    try:
        subject = f"[Finext] Yêu cầu tư vấn từ {request_data.customer_name}"
        submitted_at = datetime.now().strftime("%H:%M %d/%m/%Y")

        template_body = {
            "customer_name": request_data.customer_name,
            "phone_number": request_data.phone_number,
            "customer_email": request_data.customer_email or "Không cung cấp",
            "subject_topic": request_data.subject_topic or "Tư vấn chung",
            "message_content": request_data.message or "Khách hàng muốn được tư vấn.",
            "submitted_at": submitted_at,
            "current_year": datetime.now().year,
        }

        recipient = MAIL_FROM if MAIL_FROM else "finext.vn@gmail.com"
        success = await send_email_async(
            subject=subject,
            recipients=[recipient],
            template_name="consultation_request.html",
            template_body=template_body
        )

        if not success:
            logger.error(f"Gửi email yêu cầu tư vấn từ {request_data.customer_name} thất bại.")
            raise HTTPException(
                status_code=500,
                detail="Gửi yêu cầu tư vấn thất bại. Vui lòng thử lại sau."
            )

        logger.info(f"Yêu cầu tư vấn từ {request_data.customer_name} ({request_data.phone_number}) đã được gửi.")
        return MessageResponse(message="Yêu cầu tư vấn của bạn đã được gửi thành công. Finext sẽ liên hệ với bạn sớm nhất!")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi khi xử lý yêu cầu tư vấn: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Đã xảy ra lỗi: {str(e)}"
        )


@router.post(
    "/open-account",
    response_model=StandardApiResponse[MessageResponse],
    summary="Gửi yêu cầu mở tài khoản chứng khoán",
    tags=["emails"]
)
@api_response_wrapper(default_success_message="Yêu cầu mở tài khoản đã được gửi thành công.")
async def send_open_account_request(
    request: Request,
    request_data: OpenAccountRequest,
):
    _check_rate_limit(request)

    try:
        subject = f"[Finext] Mở tài khoản chứng khoán — {request_data.customer_name}"
        submitted_at = datetime.now().strftime("%H:%M %d/%m/%Y")

        template_body = {
            "customer_name": request_data.customer_name,
            "phone_number": request_data.phone_number,
            "customer_email": request_data.customer_email or "Không cung cấp",
            "note_content": request_data.note or "",
            "submitted_at": submitted_at,
            "current_year": datetime.now().year,
        }

        recipient = MAIL_FROM if MAIL_FROM else "finext.vn@gmail.com"
        success = await send_email_async(
            subject=subject,
            recipients=[recipient],
            template_name="open_account_request.html",
            template_body=template_body
        )

        if not success:
            logger.error(f"Gửi email mở tài khoản từ {request_data.customer_name} thất bại.")
            raise HTTPException(
                status_code=500,
                detail="Gửi yêu cầu thất bại. Vui lòng thử lại sau."
            )

        logger.info(f"Yêu cầu mở tài khoản từ {request_data.customer_name} ({request_data.phone_number}) đã được gửi.")
        return MessageResponse(message="Đăng ký thành công! Finext sẽ liên hệ hướng dẫn bạn trong thời gian sớm nhất.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi khi xử lý yêu cầu mở tài khoản: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Đã xảy ra lỗi: {str(e)}"
        )


@router.post(
    "/plan-inquiry",
    response_model=StandardApiResponse[MessageResponse],
    summary="Gửi yêu cầu tư vấn gói thành viên",
    tags=["emails"]
)
@api_response_wrapper(default_success_message="Yêu cầu tư vấn gói thành viên đã được gửi thành công.")
async def send_plan_inquiry_request(
    request: Request,
    request_data: PlanInquiryRequest,
):
    _check_rate_limit(request)

    try:
        subject = f"[Finext] Tư vấn gói thành viên — {request_data.customer_name}"
        submitted_at = datetime.now().strftime("%H:%M %d/%m/%Y")

        template_body = {
            "customer_name": request_data.customer_name,
            "phone_number": request_data.phone_number,
            "customer_email": request_data.customer_email or "Không cung cấp",
            "plan_interest": request_data.plan_interest or "Chưa xác định",
            "note_content": request_data.note or "",
            "submitted_at": submitted_at,
            "current_year": datetime.now().year,
        }

        recipient = MAIL_FROM if MAIL_FROM else "finext.vn@gmail.com"
        success = await send_email_async(
            subject=subject,
            recipients=[recipient],
            template_name="plan_inquiry_request.html",
            template_body=template_body
        )

        if not success:
            logger.error(f"Gửi email tư vấn gói từ {request_data.customer_name} thất bại.")
            raise HTTPException(
                status_code=500,
                detail="Gửi yêu cầu thất bại. Vui lòng thử lại sau."
            )

        logger.info(f"Yêu cầu tư vấn gói từ {request_data.customer_name} ({request_data.phone_number}) đã được gửi.")
        return MessageResponse(message="Đăng ký thành công! Finext sẽ liên hệ tư vấn gói thành viên phù hợp nhất cho bạn sớm nhất.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi khi xử lý yêu cầu tư vấn gói: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Đã xảy ra lỗi: {str(e)}"
        )
