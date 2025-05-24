# app/auth/jwt_handler.py
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_MINUTES
from app.schemas.auth import TokenData

# OAuth2PasswordBearer là một class dependency giúp xử lý việc lấy token từ header Authorization
# tokenUrl trỏ đến endpoint mà client sẽ dùng để lấy token (endpoint đăng nhập của bạn)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login") # Đảm bảo URL này khớp với router của bạn

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Tạo JWT access token.

    Args:
        data: Dữ liệu cần mã hóa vào token (payload). Phải chứa 'sub' (subject/username/email) và 'user_id'.
        expires_delta: Thời gian sống của token. Nếu None, sử dụng giá trị mặc định.

    Returns:
        Chuỗi JWT đã được mã hóa.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()) # JWT ID duy nhất cho mỗi token
    })

    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY không được thiết lập. Vui lòng kiểm tra cấu hình.")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Tạo JWT refresh token.

    Args:
        data: Dữ liệu cần mã hóa vào token (payload). Phải chứa 'sub' (subject/username/email) và 'user_id'.
        expires_delta: Thời gian sống của token. Nếu None, sử dụng giá trị mặc định (ví dụ: 7 ngày).

    Returns:
        Chuỗi JWT refresh token đã được mã hóa.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES) 
    
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()), # JWT ID duy nhất cho mỗi token
        "token_type": "refresh" # Thêm loại token để phân biệt nếu cần
    })

    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY không được thiết lập. Vui lòng kiểm tra cấu hình.")
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def verify_token_and_get_payload(token: str = Depends(oauth2_scheme)) -> TokenData:
    """
    Giải mã token, xác thực và trả về payload.
    Đây là một dependency có thể được sử dụng trong các endpoint yêu cầu xác thực.
    Hàm này chỉ xác thực token và trả về payload, không kiểm tra user trong DB.

    Args:
        token: Chuỗi JWT lấy từ Authorization header.

    Raises:
        HTTPException: Nếu token không hợp lệ hoặc hết hạn.

    Returns:
        TokenData chứa payload của token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if SECRET_KEY is None:
            raise ValueError("SECRET_KEY không được thiết lập. Vui lòng kiểm tra cấu hình.")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        user_id: Optional[str] = payload.get("user_id") # user_id nên được lưu dưới dạng string trong token
        jti: Optional[str] = payload.get("jti")

        if email is None or user_id is None or jti is None:
            # Nếu bạn cho phép email là None (ví dụ đăng nhập bằng username) thì cần điều chỉnh logic này
            raise credentials_exception
        
        token_data = TokenData(email=email, user_id=user_id, jti=jti)
    except JWTError as e:
        print(f"JWTError: {e}") # Log lỗi để debug
        raise credentials_exception
    
    return token_data

def decode_refresh_token(token_str: str) -> Dict[str, Any]:
    """
    Decodes a refresh token string, verifies its type and required claims.

    Args:
        token_str: The refresh token string.

    Returns:
        The decoded payload dictionary.

    Raises:
        HTTPException: If the token is invalid, wrong type, or missing claims.
        ValueError: If SECRET_KEY is not configured.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
        headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
    )
    if SECRET_KEY is None:
        # This should ideally be caught at startup, but good to have a runtime check.
        # Log this error server-side.
        raise ValueError("SECRET_KEY is not configured. Cannot decode tokens.")

    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        
        token_type: str | None = payload.get("token_type")
        if token_type != "refresh":
            # Log this attempt
            raise credentials_exception

        email: str | None = payload.get("sub")
        user_id: str | None = payload.get("user_id")
        jti: str | None = payload.get("jti")

        if email is None or user_id is None or jti is None:
            # Log this attempt
            raise credentials_exception
        
        # Return the raw payload for flexibility, or you could return a TokenData object
        return payload
    except JWTError as e:
        # Log the JWTError e
        raise credentials_exception from e

