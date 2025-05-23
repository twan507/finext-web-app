from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class SessionCreate(BaseModel):
    user_id: PyObjectId # Tham chiếu đến _id trong users collection
    jti: str = Field(..., description="JWT ID, định danh session") 
    device_info: Optional[str] = Field(default=None, description="User-Agent, IP") 

class SessionInDB(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId # Tham chiếu đến _id trong users collection
    jti: str = Field(..., description="JWT ID, định danh session") 
    device_info: Optional[str] = Field(default=None, description="User-Agent, IP") 
    created_at: datetime = Field(default_factory=datetime.now) 
    last_active_at: datetime = Field(default_factory=datetime.now) 

    model_config = ConfigDict(
        populate_by_name=True,      # Cho phép dùng alias "_id"
        from_attributes=True          # CHO PHÉP TẠO MODEL TỪ THUỘC TÍNH CỦA OBJECT KHÁC
    )

class SessionPublic(SessionInDB):
    pass