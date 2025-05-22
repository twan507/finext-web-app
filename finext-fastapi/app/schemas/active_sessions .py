from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from app.utils.types import PyObjectId

class ActiveSessionBase(BaseModel):
    user_id: PyObjectId # Tham chiếu đến _id trong users collection
    jti: str = Field(..., description="JWT ID, định danh session") 
    device_info: Optional[str] = Field(default=None, description="User-Agent, IP") 

class ActiveSessionCreate(ActiveSessionBase):
    pass

class ActiveSessionInDB(ActiveSessionBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.now) 
    last_active_at: datetime = Field(default_factory=datetime.now) 

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class ActiveSessionPublic(ActiveSessionInDB):
    pass