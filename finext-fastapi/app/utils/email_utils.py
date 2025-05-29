# finext-fastapi/app/utils/email_utils.py
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi_mail.errors import ConnectionErrors
from pydantic import EmailStr, SecretStr  # Vẫn import để dùng cho type hint của recipients và kiểm tra MAIL_FROM

# Các biến này được import từ config.py và đảm bảo là kiểu str (có thể rỗng)
from app.core.config import (
    MAIL_USERNAME,
    MAIL_PASSWORD,
    MAIL_FROM,
    MAIL_PORT,
    MAIL_SERVER,
    MAIL_STARTTLS,
    MAIL_SSL_TLS,
    MAIL_FROM_NAME,
    FRONTEND_URL,
)

logger = logging.getLogger(__name__)

# Biến toàn cục để giữ đối tượng FastMail và trạng thái cấu hình
fm_instance: Optional[FastMail] = None
EMAIL_CONFIG_SUCCESSFUL: bool = False

# Kiểm tra cấu hình một lần khi module được load
if MAIL_USERNAME and MAIL_PASSWORD and MAIL_FROM and MAIL_SERVER:
    try:

        conf_obj = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,  # str
            MAIL_PASSWORD=SecretStr(MAIL_PASSWORD),  # str (fastapi-mail ConnectionConfig dùng str)
            MAIL_FROM=MAIL_FROM,  # str (sẽ được ConnectionConfig validate thành EmailStr)
            MAIL_PORT=MAIL_PORT,  # int
            MAIL_SERVER=MAIL_SERVER,  # str
            MAIL_FROM_NAME=MAIL_FROM_NAME,  # Optional[str]
            MAIL_STARTTLS=MAIL_STARTTLS,  # bool
            MAIL_SSL_TLS=MAIL_SSL_TLS,  # bool
            USE_CREDENTIALS=True,  # Luôn True vì chúng ta dùng Username/Password
            VALIDATE_CERTS=True,
            TEMPLATE_FOLDER=Path(__file__).parent.parent / "templates",
        )
        fm_instance = FastMail(conf_obj)
        EMAIL_CONFIG_SUCCESSFUL = True
        logger.info("FastMail initialized successfully.")
    except ValueError as ve:  # Bắt lỗi từ EmailStr(MAIL_FROM) nếu không hợp lệ
        logger.error(f"Lỗi cấu hình email: {ve}. Chức năng gửi email sẽ bị vô hiệu hóa.", exc_info=True)
    except Exception as e:
        logger.error(f"Không thể khởi tạo ConnectionConfig: {e}. Chức năng gửi email sẽ bị vô hiệu hóa.", exc_info=True)
else:
    missing_configs = []
    if not MAIL_USERNAME:
        missing_configs.append("MAIL_USERNAME")
    if not MAIL_PASSWORD:
        missing_configs.append("MAIL_PASSWORD")
    if not MAIL_FROM:
        missing_configs.append("MAIL_FROM")
    if not MAIL_SERVER:
        missing_configs.append("MAIL_SERVER")
    logger.error(
        f"Một hoặc nhiều biến môi trường Email thiết yếu chưa được thiết lập hoặc rỗng: {', '.join(missing_configs)}. "
        "Chức năng gửi email sẽ bị vô hiệu hóa."
    )


async def send_email_async(
    subject: str,
    recipients: List[EmailStr],  # Type hint này vẫn đúng cho danh sách người nhận
    template_name: str,
    template_body: Dict[str, Any],
    subtype: MessageType = MessageType.html,
) -> bool:
    if not EMAIL_CONFIG_SUCCESSFUL or fm_instance is None:
        logger.error("Không thể gửi email: Cấu hình email không hợp lệ hoặc FastMail chưa được khởi tạo.")
        return False

    message = MessageSchema(
        subject=subject,
        recipients=recipients,  # fastapi-mail MessageSchema chấp nhận List[EmailStr]
        template_body=template_body,
        subtype=subtype,
    )

    try:
        logger.info(f"Đang chuẩn bị gửi email '{subject}' đến {recipients} sử dụng template '{template_name}'.")
        await fm_instance.send_message(message, template_name=template_name)
        logger.info(f"Email '{subject}' đã được gửi thành công đến {recipients}.")
        return True
    except ConnectionErrors as e:
        logger.error(f"Lỗi kết nối khi gửi email '{subject}' đến {recipients}: {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Lỗi không xác định khi gửi email '{subject}' đến {recipients}: {e}", exc_info=True)
        return False


# Các hàm send_verification_email và send_password_reset_email giữ nguyên
# vì chúng sử dụng datetime đã được import và gọi send_email_async đã được sửa.
async def send_verification_email(email_to: EmailStr, full_name: str, verification_token: str, token_expiry_hours: int = 24):
    subject = "Xác thực địa chỉ Email của bạn tại Finext"
    verification_link = f"{FRONTEND_URL}/auth/verify-email?token={verification_token}"
    current_year = datetime.now().year

    template_body = {
        "full_name": full_name,
        "verification_link": verification_link,
        "token_expiry_hours": token_expiry_hours,
        "current_year": current_year,
    }
    return await send_email_async(subject=subject, recipients=[email_to], template_name="verify_email.html", template_body=template_body)


async def send_password_reset_email(email_to: EmailStr, full_name: str, reset_token: str, token_expiry_minutes: int = 30):
    subject = "Yêu cầu đặt lại mật khẩu tài khoản Finext"
    reset_link = f"{FRONTEND_URL}/auth/reset-password?token={reset_token}"
    current_year = datetime.now().year

    template_body = {
        "full_name": full_name,
        "reset_link": reset_link,
        "token_expiry_minutes": token_expiry_minutes,
        "current_year": current_year,
    }
    return await send_email_async(subject=subject, recipients=[email_to], template_name="reset_password.html", template_body=template_body)
