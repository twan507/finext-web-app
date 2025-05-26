# finext-fastapi/app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB
MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")

# Secrets and Tokens
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Tăng lên 15 phút
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 ngày

# User Seeding
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
BROKER_EMAIL = os.getenv("BROKER_EMAIL")
USER_EMAIL = os.getenv("USER_EMAIL")
ADMIN_PWD = os.getenv("ADMIN_PWD")

# Session Management
MAX_SESSIONS_PER_USER = 3

# --- THÊM CẤU HÌNH COOKIE ---
REFRESH_TOKEN_COOKIE_NAME = "finext_refresh_token"
# Sử dụng 'lax' cho phép cookie được gửi khi điều hướng từ trang khác
# Sử dụng 'strict' nếu bạn muốn bảo mật cao nhất (chỉ gửi khi từ cùng site)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
# Chỉ đặt True khi dùng HTTPS trong production
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "False").lower() == "true"
# Đặt domain của bạn ở đây cho production, None cho localhost
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")
# -----------------------------

if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")

if not SECRET_KEY:
    print("CẢNH BÁO: Biến môi trường SECRET_KEY chưa được thiết lập.")