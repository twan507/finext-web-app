# finext-fastapi/app/schemas/auth.py
from pydantic import BaseModel
from typing import Optional

class JWTTokenResponse(BaseModel):
    """
    Schema cho response trả về khi đăng nhập/refresh thành công.
    Chỉ chứa access token. Refresh token được gửi qua cookie.
    """
    token_type: str = "bearer"
    access_token: str

class TokenData(BaseModel):
    """
    Schema cho dữ liệu được mã hóa bên trong JWT (payload).
    """
    email: Optional[str] = None
    user_id: Optional[str] = None
    jti: Optional[str] = None