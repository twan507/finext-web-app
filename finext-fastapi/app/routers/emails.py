# finext-fastapi/app/routers/emails.py
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

# Import các thành phần cần thiết
from app.utils.email_utils import send_email_async
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
# THAY ĐỔI: Import schema từ file mới
from app.schemas.emails import TestEmailRequest, MessageResponse, ConsultationRequest, OpenAccountRequest, PlanInquiryRequest
from app.core.config import MAIL_FROM

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/send-test-email",
    response_model=StandardApiResponse[MessageResponse],
    summary="Gửi email kiểm tra",
    tags=["emails"]
)
@api_response_wrapper(default_success_message="Yêu cầu gửi email kiểm tra đã được xử lý.")
async def send_test_email_endpoint(
    request_data: TestEmailRequest,
):
    try:
        subject = "Email kiểm tra từ Finext FastAPI"
        template_body = {
            "title": f"Email kiểm tra cho {request_data.name}",
            "name": request_data.name,
            "message": request_data.custom_message,
            "current_year": datetime.now().year
        }

        # Gọi trực tiếp thay vì qua background_tasks
        success = await send_email_async(
            subject=subject,
            recipients=[request_data.recipient_email],
            template_name="test_email_template.html",
            template_body=template_body
        )

        if not success:
            logger.error(f"Gửi email kiểm tra đến {request_data.recipient_email} thất bại.")
            raise HTTPException(
                status_code=500, 
                detail=f"Gửi email kiểm tra đến {request_data.recipient_email} thất bại. Vui lòng kiểm tra cấu hình email server."
            )

        logger.info(f"Đã gửi email kiểm tra thành công đến {request_data.recipient_email}")
        return MessageResponse(message=f"Email kiểm tra đã được gửi thành công đến {request_data.recipient_email}.")
        
    except HTTPException:
        # Re-raise HTTPException để giữ nguyên status code và detail
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định khi gửi email đến {request_data.recipient_email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Đã xảy ra lỗi không xác định khi gửi email: {str(e)}"
        )


@router.post(
    "/consultation",
    response_model=StandardApiResponse[MessageResponse],
    summary="Gửi yêu cầu đặt lịch tư vấn cá nhân",
    tags=["emails"]
)
@api_response_wrapper(default_success_message="Yêu cầu tư vấn đã được gửi thành công.")
async def send_consultation_request(
    request_data: ConsultationRequest,
):
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

        # Gửi email đến chính Finext (MAIL_FROM)
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
    request_data: OpenAccountRequest,
):
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
    request_data: PlanInquiryRequest,
):
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