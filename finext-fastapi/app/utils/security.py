# app/utils/security.py
import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Xác thực mật khẩu thuần túy với mật khẩu đã được hash.

    Args:
        plain_password: Mật khẩu dạng thuần túy (chưa hash).
        hashed_password: Mật khẩu đã được hash lưu trong DB.

    Returns:
        True nếu mật khẩu khớp, False nếu không.
    """
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    """
    Hash mật khẩu thuần túy.

    Args:
        password: Mật khẩu dạng thuần túy.

    Returns:
        Mật khẩu đã được hash.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")
