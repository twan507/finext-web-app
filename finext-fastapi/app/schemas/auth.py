from pydantic import BaseModel, EmailStr
from typing import Optional


class Token(BaseModel):
    """
    Represents the token structure returned by FastAPI upon successful login.
    """
    token_type: str
    access_token: str
    refresh_token: str
