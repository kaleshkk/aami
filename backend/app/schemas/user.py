from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    master_salt: Optional[bytes] = None


class UserRead(UserBase):
    id: UUID
    created_at: datetime
    last_login: Optional[datetime] = None
    two_fa_enabled: bool
    master_salt: Optional[bytes] = None

    class Config:
        from_attributes = True


