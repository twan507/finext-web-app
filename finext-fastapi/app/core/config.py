import os
from dotenv import load_dotenv

# Tải các biến môi trường từ tệp .env (nếu có)
# Điều này hữu ích cho việc phát triển cục bộ.
# Trong môi trường production, các biến môi trường thường được đặt trực tiếp.
load_dotenv()

MONGODB_CONNECTION_STRING = os.getenv("MONGODB_CONNECTION_STRING")

if not MONGODB_CONNECTION_STRING:
    print("CẢNH BÁO: Biến môi trường MONGODB_CONNECTION_STRING chưa được thiết lập.")
    # Bạn có thể muốn raise Exception ở đây hoặc cung cấp một giá trị mặc định nếu phù hợp
    # raise ValueError("MONGODB_CONNECTION_STRING must be set in the environment variables.")
