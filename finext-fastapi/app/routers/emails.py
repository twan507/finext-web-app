# finext-fastapi/app/routers/emails.py
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

# Import các thành phần cần thiết
from app.utils.email_utils import send_email_async
from app.utils.response_wrapper import StandardApiResponse, api_response_wrapper
# THAY ĐỔI: Import schema từ file mới
from app.schemas.emails import TestEmailRequest, MessageResponse

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