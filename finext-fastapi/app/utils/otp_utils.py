# finext-fastapi/app/utils/otp_utils.py
import random
import string
from app.utils.security import pwd_context # Reusing password hashing
from app.core.config import OTP_LENGTH

def generate_otp_code() -> str:
    """Generates a random OTP code of configured length."""
    return "".join(random.choices(string.digits, k=OTP_LENGTH))

def hash_otp_code(otp_code: str) -> str:
    """Hashes the OTP code."""
    return pwd_context.hash(otp_code)

def verify_otp_code(plain_otp: str, hashed_otp: str) -> bool:
    """Verifies a plain OTP against a hashed OTP."""
    return pwd_context.verify(plain_otp, hashed_otp)