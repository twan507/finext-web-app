from datetime import datetime, timezone
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from app.utils.types import PyObjectId


class UploadKey(str, Enum):
    AVATARS = "avatars"
    OTHERS = "others"


class UploadBase(BaseModel):
    upload_key: UploadKey = Field(..., description="Purpose or key identifying the upload type")
    file_url: str = Field(..., description="Public URL of the uploaded file")
    size: Optional[int] = Field(None, description="File size in bytes")
    object_name: str = Field(..., description="Unique object name in storage")


class UploadCreate(UploadBase):
    user_id: PyObjectId = Field(..., description="ID of the user who uploaded the file")


class UploadUpdate(BaseModel):
    upload_key: Optional[UploadKey] = None
    filename: Optional[str] = None
    file_url: Optional[str] = None
    content_type: Optional[str] = None
    size: Optional[int] = None


class UploadInDB(UploadBase):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    object_name: str = Field(..., description="Unique object name in storage")

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, json_encoders={ObjectId: str})


class UploadPublic(UploadBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, json_encoders={ObjectId: str})
