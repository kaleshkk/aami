import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID, BYTEA, ARRAY

from app.db.session import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title_hmac = Column(Text, nullable=True, index=True)
    encrypted_blob = Column(BYTEA, nullable=False)
    iv = Column(BYTEA, nullable=False)
    salt = Column(BYTEA, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    tags = Column(ARRAY(String), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_items_owner_id", "owner_id"),
        Index("ix_items_title_hmac", "title_hmac"),
    )


