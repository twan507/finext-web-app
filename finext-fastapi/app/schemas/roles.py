from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.utils.types import PyObjectId

class RoleBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Ví dụ: admin, user, broker")
    description: Optional[str] = None

class RoleCreate(RoleBase):
    permission_ids: List[PyObjectId] = Field(default_factory=list)

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=50)
    description: Optional[str] = None
    permission_ids: List[PyObjectId] = Field(default_factory=list)

class RoleInDB(RoleBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    permission_ids: List[PyObjectId] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True

class RolePublic(RoleInDB):
    pass