from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId


class SessionCreate(BaseModel):
    user_id: PyObjectId  # Tham chiếu đến _id trong users collection
    access_jti: str = Field(..., description="Access token JWT ID")
    refresh_jti: str = Field(..., description="Refresh token JWT ID")
    device_info: str = Field(..., description="User-Agent của client")
    ip_address: Optional[str] = Field(None, description="IP address của client (real IP qua X-Forwarded-For/X-Real-IP)")
    location: Optional[str] = Field(None, description="Vị trí địa lý suy ra từ IP (format: 'Thành phố, Quốc gia')")


class SessionInDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId  # Tham chiếu đến _id trong users collection
    access_jti: str = Field(..., description="Access token JWT ID")
    refresh_jti: str = Field(..., description="Refresh token JWT ID")
    device_info: str = Field(..., description="User-Agent của client")
    ip_address: Optional[str] = Field(None, description="IP address của client")
    location: Optional[str] = Field(None, description="Vị trí địa lý suy ra từ IP")
    created_at: datetime = Field(default_factory=datetime.now)
    last_active_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(
        populate_by_name=True,  # Cho phép dùng alias "_id"
        from_attributes=True,  # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )


class SessionPublic(SessionInDB):
    # Được populate ở admin list endpoint (/all) để chống N+1 gọi /users/{id} theo từng dòng.
    user_email: Optional[str] = None
