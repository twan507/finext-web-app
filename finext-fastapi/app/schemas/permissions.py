from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.utils.types import PyObjectId

class PermissionBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=100, description="Ví dụ: listing:create, user:manage_roles")
    description: Optional[str] = None

class PermissionCreate(PermissionBase):
    pass

class PermissionInDB(PermissionBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True

class PermissionPublic(PermissionBase):
    pass
        