from pydantic import BaseModel, EmailStr
from typing import Optional

class NextAuthUser(BaseModel):
    """
    Represents the user data sent by NextAuth after successful
    authentication via its CredentialsProvider.
    """
    userId: str  # Unique identifier for the user from NextAuth's perspective
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    # You can add other fields that NextAuth might send

class Token(BaseModel):
    """
    Represents the token structure returned by FastAPI upon successful login.
    """
    access_token: str
    token_type: str
    user_info: NextAuthUser
