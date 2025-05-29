# finext-fastapi/app/utils/email_utils.py
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone  # THÊM timezone
from enum import Enum  # THÊM Enum

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi_mail.errors import ConnectionErrors
from pydantic import EmailStr, SecretStr

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
    OTP_EXPIRE_MINUTES,  # THÊM nếu muốn dùng expiry_minutes từ config
)

# THÊM IMPORT OtpTypeEnum
from app.schemas.otps import OtpTypeEnum


logger = logging.getLogger(__name__)

fm_instance: Optional[FastMail] = None
EMAIL_CONFIG_SUCCESSFUL: bool = False

if MAIL_USERNAME and MAIL_PASSWORD and MAIL_FROM and MAIL_SERVER:
    try:
        conf_obj = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,
            MAIL_PASSWORD=SecretStr(MAIL_PASSWORD),
            MAIL_FROM=MAIL_FROM,
            MAIL_PORT=MAIL_PORT,
            MAIL_SERVER=MAIL_SERVER,
            MAIL_FROM_NAME=MAIL_FROM_NAME,
            MAIL_STARTTLS=MAIL_STARTTLS,
            MAIL_SSL_TLS=MAIL_SSL_TLS,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
            TEMPLATE_FOLDER=Path(__file__).parent.parent / "templates",
        )
        fm_instance = FastMail(conf_obj)
        EMAIL_CONFIG_SUCCESSFUL = True
        logger.info("FastMail initialized successfully.")
    except ValueError as ve:
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
    recipients: List[EmailStr],
    template_name: str,
    template_body: Dict[str, Any],
    subtype: MessageType = MessageType.html,
) -> bool:
    if not EMAIL_CONFIG_SUCCESSFUL or fm_instance is None:
        logger.error("Không thể gửi email: Cấu hình email không hợp lệ hoặc FastMail chưa được khởi tạo.")
        return False

    message = MessageSchema(
        subject=subject,
        recipients=recipients,
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


# HÀM MỚI ĐỂ GỬI EMAIL OTP
async def send_otp_email(
    email_to: EmailStr,
    full_name: str,
    otp_code: str,
    otp_type: OtpTypeEnum,
    expiry_minutes: int = OTP_EXPIRE_MINUTES,  # Lấy từ config hoặc truyền vào
) -> bool:
    if not EMAIL_CONFIG_SUCCESSFUL:
        error_msg = f"Email service not configured. Cannot send OTP to {email_to}."
        logger.error(error_msg)
        raise ValueError(error_msg)

    subject = ""
    template_name = ""
    action_description = ""

    if otp_type == OtpTypeEnum.EMAIL_VERIFICATION:
        subject = "Mã OTP Xác Thực Email Finext"
        template_name = "email_verification.html"
        action_description = "xác thực địa chỉ email của bạn"
    elif otp_type == OtpTypeEnum.RESET_PASSWORD:
        subject = "Mã OTP Đặt Lại Mật Khẩu Finext"
        template_name = "reset_pasword.html"
        action_description = "đặt lại mật khẩu của bạn"
    elif otp_type == OtpTypeEnum.PWDLESS_LOGIN:
        subject = "Mã OTP Đăng Nhập Finext"
        template_name = "pwdless_login.html"
        action_description = "đăng nhập vào tài khoản của bạn"

    # Bỏ OtpTypeEnum.PASSWORDLESS_LOGIN nếu bạn quyết định dùng chung PWDLESS_LOGIN
    # elif otp_type == OtpTypeEnum.PASSWORDLESS_LOGIN:
    #     subject = "Mã OTP Đăng Nhập Finext (Không Mật Khẩu)"
    #     template_name = "otp_passwordless_login_template.html" # Cần tạo template này
    #     action_description = "đăng nhập vào tài khoản của bạn"
    else:
        error_msg = f"Unknown OTP type for email: {otp_type.value if isinstance(otp_type, Enum) else otp_type}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    if not template_name:
        error_msg = f"Template name not set for OTP type: {otp_type.value if isinstance(otp_type, Enum) else otp_type}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    template_body = {
        "full_name": full_name,
        "otp_code": otp_code,
        "expiry_minutes": expiry_minutes,
        "current_year": datetime.now(timezone.utc).year,
        "action_description": action_description,
    }

    logger.info(f"Attempting to send OTP email for {otp_type.value} to {email_to}")
    email_sent = await send_email_async(subject=subject, recipients=[email_to], template_name=template_name, template_body=template_body)

    if not email_sent:
        error_msg = f"Failed to send OTP email for {otp_type.value} to {email_to}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    logger.info(f"OTP email for {otp_type.value} sent successfully to {email_to}")
    return email_sent


async def send_verification_email(email_to: EmailStr, full_name: str, verification_token: str, token_expiry_hours: int = 24):
    # ... (giữ nguyên)
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


async def send_reset_password_email(email_to: EmailStr, full_name: str, reset_token: str, token_expiry_minutes: int = 30):
    # ... (giữ nguyên)
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

async def send_subscription_expiry_reminder_email(
    email_to: EmailStr,
    full_name: str,
    license_name: str,
    license_key: str,
    expiry_date: datetime,
    days_left: int
) -> bool:
    if not EMAIL_CONFIG_SUCCESSFUL or fm_instance is None:
        logger.error(f"Email service not configured. Cannot send subscription expiry reminder to {email_to}.")
        return False # Hoặc raise Exception nếu muốn job dừng khi không gửi được email

    subject = f"Nhắc nhở: Subscription {license_name} của bạn sắp hết hạn"
    # TODO: Cập nhật link gia hạn chính xác
    renewal_link = f"{FRONTEND_URL}/dashboard/billing" # Hoặc trang gia hạn cụ thể

    template_body = {
        "full_name": full_name,
        "license_name": license_name,
        "license_key": license_key,
        "expiry_date_str": expiry_date.strftime("%d/%m/%Y"),
        "days_left": days_left,
        "renewal_link": renewal_link,
        "current_year": datetime.now(timezone.utc).year,
    }

    logger.info(f"Attempting to send subscription expiry reminder email to {email_to} for license {license_key}.")
    email_sent = await send_email_async(
        subject=subject,
        recipients=[email_to],
        template_name="subscription_expiry_reminder.html", # Tên template mới
        template_body=template_body
    )

    if not email_sent:
        logger.error(f"Failed to send subscription expiry reminder email to {email_to} for license {license_key}.")
        return False # Hoặc raise

    logger.info(f"Subscription expiry reminder email sent successfully to {email_to} for license {license_key}.")
    return email_sent