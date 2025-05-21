from pydantic import BaseModel, EmailStr, Field, BeforeValidator
from typing import Optional, Annotated
from datetime import datetime
PyObjectId = Annotated[str, BeforeValidator(str)]

class UserCreate(BaseModel):
    """Schema for creating a new user (input)."""
    role_id: int
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: str
    latest_subscription_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())

class UserUpdate(BaseModel):
    """Schema for updateting user data."""
    full_name: Optional[str] = Field(default=None)
    email: Optional[EmailStr] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now())

class UserPublic(BaseModel):
    """Schema for returning user data to the client (output)."""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    role_id: int
    full_name: str
    email: EmailStr
    phone_number: str
    latest_subscription_id: Optional[str] = Field(default=None)
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True