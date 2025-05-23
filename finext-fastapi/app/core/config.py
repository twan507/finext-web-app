import os
from dotenv import load_dotenv

# Tải các biến môi trường từ tệp .env (nếu có)
# Điều này hữu ích cho việc phát triển cục bộ.
# Trong môi trường production, các biến môi trường thường được đặt trực tiếp.
load_dotenv()

MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
BROKER_EMAIL= os.getenv("BROKER_EMAIL")
USER_EMAIL= os.getenv("USER_EMAIL")
ADMIN_PWD = os.getenv("ADMIN_PWD")

# Cấu hình JWT
SECRET_KEY = os.getenv("SECRET_KEY")  # Rất quan trọng: Thay đổi key này và giữ bí mật trong production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)) # Mặc định token hết hạn sau 30 phút
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", 10080)) # Mặc định refresh token hết hạn sau 7 ngày (10080 phút)

if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")

