# finext-fastapi/app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB
MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")

# Secrets and Tokens
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10  # Đơn vị phút
REFRESH_TOKEN_EXPIRE_DAYS = 7  # Đơn vị ngày

# User Seeding
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
BROKER_EMAIL_1 = os.getenv("BROKER_EMAIL_1")
BROKER_EMAIL_2 = os.getenv("BROKER_EMAIL_2")
USER_EMAIL_1 = os.getenv("USER_EMAIL_1")
USER_EMAIL_2 = os.getenv("USER_EMAIL_2")
USER_EMAIL_3 = os.getenv("USER_EMAIL_3")
ADMIN_PWD = os.getenv("ADMIN_PWD")

# Danh sách các email được bảo vệ 
PROTECTED_USER_EMAILS = [
    email for email in [ADMIN_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2, USER_EMAIL_1, USER_EMAIL_2, USER_EMAIL_3] if email
]
PROTECTED_ROLE_NAMES = ["admin", "user", "broker"]
PROTECTED_LICENSE_KEYS = ["ADMIN", "PARTNER"]


# Session Management
MAX_SESSIONS_PER_USER = 3

# --- THÊM CẤU HÌNH COOKIE ---
REFRESH_TOKEN_COOKIE_NAME = "finext_refresh_token"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "False").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
# -----------------------------

if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")

if not SECRET_KEY:
    print("CẢNH BÁO: Biến môi trường SECRET_KEY chưa được thiết lập.")