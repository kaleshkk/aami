import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, BYTEA

from app.db.session import Base


class OTLink(Base):
    __tablename__ = "ot_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    encrypted_payload = Column(BYTEA, nullable=False)
    salt = Column(BYTEA, nullable=False)
    iv = Column(BYTEA, nullable=False)
    expiry = Column(DateTime(timezone=True), nullable=False)
    single_use = Column(Boolean, nullable=False, default=True)
    used = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_ot_links_expiry", "expiry"),
    )


