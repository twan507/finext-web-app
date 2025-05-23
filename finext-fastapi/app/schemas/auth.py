# app/schemas/token.py
from pydantic import BaseModel
from typing import Optional

class JWTTokenResponse(BaseModel):
    """
    Schema cho response trả về khi đăng nhập thành công, chứa access token.
    """
    token_type: str
    access_token: str
    refresh_token: str

class TokenData(BaseModel):
    """
    Schema cho dữ liệu được mã hóa bên trong JWT (payload).
    Chứa thông tin định danh người dùng.
    """
    email: Optional[str] = None # Hoặc username, tùy thuộc vào cách bạn định danh người dùng
    user_id: Optional[str] = None
    jti: Optional[str] = None # JWT ID, dùng để theo dõi session

class RefreshTokenRequest(BaseModel):
    refresh_token: str