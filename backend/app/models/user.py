import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID, BYTEA

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    two_fa_enabled = Column(Boolean, default=False, nullable=False)
    two_fa_secret = Column(Text, nullable=True)

    # Client-derived salt for master key derivation (never a key itself).
    master_salt = Column(BYTEA, nullable=True)

    created_by = Column(UUID(as_uuid=True), nullable=True)



