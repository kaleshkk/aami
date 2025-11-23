from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class ItemBase(BaseModel):
    title_hmac: Optional[str] = None
    tags: Optional[List[str]] = None


class ItemCreate(ItemBase):
    encrypted_blob: bytes
    iv: bytes
    salt: bytes
    version: int = 1


class ItemUpdate(BaseModel):
    encrypted_blob: Optional[bytes] = None
    iv: Optional[bytes] = None
    salt: Optional[bytes] = None
    title_hmac: Optional[str] = None
    tags: Optional[List[str]] = None
    version: Optional[int] = None


class ItemMeta(BaseModel):
    id: UUID
    title_hmac: Optional[str]
    tags: Optional[List[str]]
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ItemDetail(ItemMeta):
    encrypted_blob: bytes
    iv: bytes
    salt: bytes


