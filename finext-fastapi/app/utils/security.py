# app/utils/security.py
from passlib.context import CryptContext

# Khởi tạo context cho việc hash mật khẩu
# schemes=["bcrypt"] chỉ định thuật toán hash là bcrypt
# deprecated="auto" tự động xử lý các hash cũ nếu bạn thay đổi thuật toán trong tương lai
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Xác thực mật khẩu thuần túy với mật khẩu đã được hash.

    Args:
        plain_password: Mật khẩu dạng thuần túy (chưa hash).
        hashed_password: Mật khẩu đã được hash lưu trong DB.

    Returns:
        True nếu mật khẩu khớp, False nếu không.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash mật khẩu thuần túy.

    Args:
        password: Mật khẩu dạng thuần túy.

    Returns:
        Mật khẩu đã được hash.
    """
    return pwd_context.hash(password)

