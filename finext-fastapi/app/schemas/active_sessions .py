from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, Annotated
from datetime import datetime
from bson import ObjectId

PyObjectId = Annotated[str, BeforeValidator(str)]

class ActiveSessionBase(BaseModel):
    user_id: PyObjectId # Tham chiếu đến _id trong users collection [cite: 13]
    jti: str = Field(..., description="JWT ID, định danh session") # [cite: 13]
    device_info: Optional[str] = Field(default=None, description="User-Agent, IP") # [cite: 14]

class ActiveSessionCreate(ActiveSessionBase):
    pass

class ActiveSessionInDB(ActiveSessionBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.now) # [cite: 14]
    last_active_at: datetime = Field(default_factory=datetime.now) # [cite: 14]

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class ActiveSessionPublic(ActiveSessionInDB):
    pass