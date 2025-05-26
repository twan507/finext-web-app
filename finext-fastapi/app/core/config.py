import os
from dotenv import load_dotenv
load_dotenv()

MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")
SECRET_KEY = os.getenv("SECRET_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
BROKER_EMAIL= os.getenv("BROKER_EMAIL")
USER_EMAIL= os.getenv("USER_EMAIL")
ADMIN_PWD = os.getenv("ADMIN_PWD")

ALGORITHM = "HS256"
MAX_SESSIONS_PER_USER = 3
ACCESS_TOKEN_EXPIRE_MINUTES = 5 # Mặc định token hết hạn sau 30 phút
REFRESH_TOKEN_EXPIRE_MINUTES = 10000 # Mặc định refresh token hết hạn sau 7 ngày (10080 phút)

if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")

