from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class OTLinkCreate(BaseModel):
    encrypted_payload: bytes
    salt: bytes
    iv: bytes
    expiry: datetime
    single_use: bool = True


class OTLinkRead(BaseModel):
    id: UUID
    encrypted_payload: bytes
    salt: bytes
    iv: bytes
    expiry: datetime
    single_use: bool
    used: bool
    created_at: datetime

    class Config:
        from_attributes = True


