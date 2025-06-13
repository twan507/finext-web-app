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

# --- GOOGLE OAUTH ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
# --- END GOOGLE OAUTH ---

# User Seeding
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
MANAGER_EMAIL = os.getenv("MANAGER_EMAIL")
BROKER_EMAIL_1 = os.getenv("BROKER_EMAIL_1")
BROKER_EMAIL_2 = os.getenv("BROKER_EMAIL_2")
USER_EMAIL_1 = os.getenv("USER_EMAIL_1")
USER_EMAIL_2 = os.getenv("USER_EMAIL_2")
USER_EMAIL_3 = os.getenv("USER_EMAIL_3")
ADMIN_PWD = os.getenv("ADMIN_PWD")

# Danh sách các email được bảo vệ
PROTECTED_USER_EMAILS = list(
    filter(None, [ADMIN_EMAIL, MANAGER_EMAIL, BROKER_EMAIL_1, BROKER_EMAIL_2, USER_EMAIL_1, USER_EMAIL_2, USER_EMAIL_3])
)
# Protected Roles (cannot be deleted)
PROTECTED_ROLE_NAMES = ["admin", "manager", "broker", "user"]
BASIC_LICENSE_KEY = "BASIC"
PROTECTED_LICENSE_KEYS = ["ADMIN", "MANAGER", "PARTNER", "BASIC"]
PROTECTED_FEATURES = ["basic_feature", "broker_feature", "admin_feature", "manager_feature"]

# Phần trăm giảm giá cho broker
BROKER_DISCOUNT_PERCENTAGE = 10

# Session Management
MAX_SESSIONS_PER_USER = 3

# --- CẤU HÌNH COOKIE ---
REFRESH_TOKEN_COOKIE_NAME = "finext_refresh_token"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "False").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
# -----------------------------

# --- THÊM CẤU HÌNH EMAIL ---
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "")  # Sẽ được validate thành EmailStr sau
MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
MAIL_SERVER = os.getenv("MAIL_SERVER", "")
MAIL_STARTTLS = os.getenv("MAIL_STARTTLS", "True").lower() == "true"
MAIL_SSL_TLS = os.getenv("MAIL_SSL_TLS", "False").lower() == "true"
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME")  # Optional, có thể là None
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
# -----------------------------

# --- OTP Configuration ---
OTP_LENGTH = 6  # Length of the OTP code
OTP_EXPIRE_MINUTES = 5  # OTP validity period in minutes
MAX_OTP_ATTEMPTS = 10  # Maximum verification attempts for an OTP (handle this in logic if needed)
# -------------------------

# --- Cloudflare R2 Configuration ---
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_URL_BASE = os.getenv("R2_PUBLIC_URL_BASE")
# ---------------------------------


if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")

if not SECRET_KEY:
    print("CẢNH BÁO: Biến môi trường SECRET_KEY chưa được thiết lập.")

# Kiểm tra các biến email quan trọng
if not MAIL_USERNAME:
    print("CẢNH BÁO: Biến môi trường MAIL_USERNAME chưa được thiết lập cho việc gửi email.")
if not MAIL_PASSWORD:
    print("CẢNH BÁO: Biến môi trường MAIL_PASSWORD chưa được thiết lập cho việc gửi email.")
if not MAIL_FROM:
    print("CẢNH BÁO: Biến môi trường MAIL_FROM chưa được thiết lập cho việc gửi email.")
if not MAIL_SERVER:
    print("CẢNH BÁO: Biến môi trường MAIL_SERVER chưa được thiết lập cho việc gửi email.")

# Kiểm tra các biến R2 quan trọng
if not R2_ENDPOINT_URL:
    print("CẢNH BÁO: Biến môi trường R2_ENDPOINT_URL chưa được thiết lập.")
if not R2_ACCESS_KEY_ID:
    print("CẢNH BÁO: Biến môi trường R2_ACCESS_KEY_ID chưa được thiết lập.")
if not R2_SECRET_ACCESS_KEY:
    print("CẢNH BÁO: Biến môi trường R2_SECRET_ACCESS_KEY chưa được thiết lập.")
if not R2_BUCKET_NAME:
    print("CẢNH BÁO: Biến môi trường R2_BUCKET_NAME chưa được thiết lập.")
if not R2_PUBLIC_URL_BASE:
    print("CẢNH BÁO: Biến môi trường R2_PUBLIC_URL_BASE chưa được thiết lập.")

# THÊM: Kiểm tra biến Google OAuth
if not GOOGLE_CLIENT_ID:
    print("CẢNH BÁO: Biến môi trường GOOGLE_CLIENT_ID chưa được thiết lập cho Google OAuth.")
if not GOOGLE_CLIENT_SECRET:
    print("CẢNH BÁO: Biến môi trường GOOGLE_CLIENT_SECRET chưa được thiết lập cho Google OAuth.")
if not GOOGLE_REDIRECT_URI:
    print("CẢNH BÁO: Biến môi trường GOOGLE_REDIRECT_URI chưa được thiết lập cho Google OAuth.")
