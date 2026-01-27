# finext-fastapi/app/utils/otp_utils.py
import random
import string
import bcrypt
from app.core.config import OTP_LENGTH


def generate_otp_code() -> str:
    """Generates a random OTP code of configured length."""
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def hash_otp_code(otp_code: str) -> str:
    """Hashes the OTP code."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(otp_code.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_otp_code(plain_otp: str, hashed_otp: str) -> bool:
    """Verifies a plain OTP against a hashed OTP."""
    return bcrypt.checkpw(plain_otp.encode("utf-8"), hashed_otp.encode("utf-8"))
