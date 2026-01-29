# app/schemas/watchlists.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import EmailStr  # Thêm EmailStr

from app.utils.types import PyObjectId


class WatchlistBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên của danh sách theo dõi.")
    stock_symbols: List[str] = Field(default_factory=list, description="Danh sách các mã cổ phiếu trong danh sách theo dõi.")


class WatchlistCreate(WatchlistBase):
    # user_id will be taken from the current authenticated user
    model_config = ConfigDict(json_schema_extra={"example": {"name": "Cổ phiếu Ngân Hàng", "stock_symbols": ["VCB", "TCB", "MBB"]}})


class WatchlistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    stock_symbols: Optional[List[str]] = None  # Allows replacing the entire list or adding/removing (handled in CRUD)

    model_config = ConfigDict(
        json_schema_extra={"example": {"name": "Cổ phiếu Ngân Hàng Ưu Tiên", "stock_symbols": ["VCB", "TCB", "ACB", "BID"]}}
    )


class WatchlistInDB(WatchlistBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "60d5ec49f7b4e6a0e7d5c2f1",
                "user_id": "60d5ec49f7b4e6a0e7d5c2a1",
                "name": "Cổ phiếu Ngân Hàng",
                "stock_symbols": ["VCB", "TCB", "MBB"],
                "created_at": "2024-05-28T10:00:00Z",
                "updated_at": "2024-05-28T10:00:00Z",
            }
        },
    )


class WatchlistPublic(WatchlistBase):
    """Schema for returning watchlist data to regular users (minimal info)."""

    id: PyObjectId = Field(alias="_id")  # Giữ ID để user có thể edit/delete
    # KHÔNG bao gồm: user_id, created_at, updated_at

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class WatchlistPublicAdmin(WatchlistBase):
    """Schema for returning full watchlist data to admin."""

    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    user_email: Optional[EmailStr] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
