# finext-fastapi/app/auth/jwt_handler.py
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple

from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends, Cookie
from fastapi.security import OAuth2PasswordBearer

from app.core.config import (
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS, REFRESH_TOKEN_COOKIE_NAME
)
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def create_access_token(data: Dict[str, Any]) -> str:
    """Tạo JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": "access" # Thêm loại token
    })

    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY không được thiết lập.")
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: Dict[str, Any]) -> Tuple[str, timedelta]:
    """Tạo JWT refresh token và trả về token cùng thời gian sống."""
    to_encode = data.copy()
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    expire = datetime.now(timezone.utc) + expires_delta
    
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": "refresh"
    })

    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY không được thiết lập.")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expires_delta

async def verify_token_and_get_payload(token: str = Depends(oauth2_scheme)) -> TokenData:
    """Giải mã access token, xác thực và trả về payload."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if SECRET_KEY is None:
            raise ValueError("SECRET_KEY không được thiết lập.")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Đảm bảo đây là access token
        if payload.get("token_type") != "access":
            raise credentials_exception

        email: Optional[str] = payload.get("sub")
        user_id: Optional[str] = payload.get("user_id")
        jti: Optional[str] = payload.get("jti")

        if email is None or user_id is None or jti is None:
            raise credentials_exception
        
        return TokenData(email=email, user_id=user_id, jti=jti)
    except JWTError:
        raise credentials_exception

async def get_refresh_token_from_cookie(
    refresh_token: Optional[str] = Cookie(None, alias=REFRESH_TOKEN_COOKIE_NAME)
) -> str:
    """Dependency để lấy refresh token từ cookie."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookie.",
        )
    return refresh_token

def decode_refresh_token(token_str: str) -> Dict[str, Any]:
    """Giải mã refresh token, xác thực loại và các claim cần thiết."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
    )
    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY is not configured.")

    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("token_type") != "refresh":
            raise credentials_exception

        email: str | None = payload.get("sub")
        user_id: str | None = payload.get("user_id")
        jti: str | None = payload.get("jti") # JTI của refresh token (nếu cần theo dõi)

        if email is None or user_id is None or jti is None:
            raise credentials_exception
        
        return payload
    except JWTError as e:
        raise credentials_exception from e