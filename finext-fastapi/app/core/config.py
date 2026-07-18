# finext-fastapi/app/core/config.py
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Setup logger
logger = logging.getLogger(__name__)

# Xác định đường dẫn tới file .env.development
current_dir = Path(__file__).parent.parent.parent  # Lên 3 cấp từ app/core/config.py
env_development_path = current_dir / ".env.development"
env_production_path = current_dir.parent / ".env.production"  # File production ở thư mục gốc

# Ưu tiên load .env.development trước, sau đó mới đến .env.production
env_loaded = False

if env_development_path.exists():
    load_dotenv(env_development_path)
    logger.info(f"Đã load file môi trường development: {env_development_path}")
    env_loaded = True
elif env_production_path.exists():
    load_dotenv(env_production_path)
    logger.info(f"Đã load file môi trường production: {env_production_path}")
    env_loaded = True
else:
    # Fallback: thử load .env mặc định
    load_dotenv()
    logger.info("Đang sử dụng biến môi trường hệ thống (không tìm thấy file .env)")

if not env_loaded:
    logger.warning("Không thể load được file môi trường cụ thể, sử dụng biến hệ thống")


# Function để validate các biến môi trường quan trọng
def validate_critical_env_vars():
    """Kiểm tra các biến môi trường quan trọng và log kết quả"""
    critical_vars = ["MONGODB_CONNECTION_STRING", "SECRET_KEY", "ADMIN_EMAIL"]

    missing_vars = []
    for var in critical_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)

    if missing_vars:
        logger.error(f"Thiếu các biến môi trường quan trọng: {', '.join(missing_vars)}")
        return False
    else:
        logger.info("Tất cả biến môi trường quan trọng đã được cấu hình")
        return True


# Thực hiện validation
ENV_VALIDATION_SUCCESS = validate_critical_env_vars()

# MongoDB
MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")

# Secrets and Tokens
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Đơn vị phút
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


# Validation đã được thực hiện ở trên thông qua validate_critical_env_vars()
# Chỉ log thông tin khởi động
logger.info("Cấu hình môi trường đã được tải hoàn tất")

# --- Agent / LLM Configuration ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL")
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL")
LLM_TEMPERATURE = os.getenv("LLM_TEMPERATURE")  # str|None; None = không gửi (dùng default provider)
LLM_MAX_OUTPUT_TOKENS = os.getenv("LLM_MAX_OUTPUT_TOKENS")  # str|None; None = dùng default trong loop
LLM_THINKING = os.getenv("LLM_THINKING") or "disabled"  # enabled | disabled — default disabled (đo A/B: non-thinking sạch hygiene hơn)
LLM_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT") or "high"  # high | max — chỉ gửi khi thinking enabled
LLM_API_STYLE = os.getenv("LLM_API_STYLE") or "openai"  # openai | anthropic — chọn wire adapter (doc 2026-07-16)

AGENT_GATEWAY = os.getenv("AGENT_GATEWAY", "mongo")  # mongo | fixture
GATEWAY_EXPLAIN_MODE = os.getenv("GATEWAY_EXPLAIN_MODE", "off")  # on | off (heuristic — doc 01 §6 R1c)
AGENT_PACK_DIR = os.getenv("AGENT_PACK_DIR")  # None → dùng pack stub trong repo
# ---------------------------------

# --- Chat persistence / quota / kill-switch (Bước 3) ---
# Số lấy default trong code; owner chỉnh qua env sau 2 tuần chạy nhóm nhỏ (doc 03 §4-5).
AGENT_DAILY_TOKEN_BUDGET = int(os.getenv("AGENT_DAILY_TOKEN_BUDGET") or 4_000_000)  # kill-switch global/ngày (token)
CHAT_MAX_CONVERSATIONS = int(os.getenv("CHAT_MAX_CONVERSATIONS") or 50)  # giữ N hội thoại mới nhất/user (prune)
# --- Quota token per-license: cửa sổ 5h (anchored) + weekly ---
AGENT_TOKENS_5H = int(os.getenv("AGENT_TOKENS_5H") or 500_000)  # trần token/5h (standard)
AGENT_TOKENS_WEEK = int(os.getenv("AGENT_TOKENS_WEEK") or 5_000_000)  # trần token/tuần (standard)
AGENT_ADVANCED_MULT = int(os.getenv("AGENT_ADVANCED_MULT") or 5)  # advanced = ×5 standard
AGENT_SESSION_HOURS = int(os.getenv("AGENT_SESSION_HOURS") or 5)  # độ dài cửa sổ session
AGENT_WEEK_DAYS = int(os.getenv("AGENT_WEEK_DAYS") or 7)
AGENT_ADVANCED_LICENSES = set((os.getenv("AGENT_ADVANCED_LICENSES") or "PATRON,PARTNER").upper().replace(" ", "").split(","))
AGENT_UNLIMITED_LICENSES = set((os.getenv("AGENT_UNLIMITED_LICENSES") or "MANAGER,ADMIN").upper().replace(" ", "").split(","))
# ---------------------------------
