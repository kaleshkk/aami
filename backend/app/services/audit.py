from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log_action(
    db: Session,
    *,
    user: Optional[User],
    action: str,
    request: Optional[Request] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    ip = None
    user_agent = None

    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        ip_address=ip,
        user_agent=user_agent,
        details=details or {},
    )
    db.add(entry)
    db.commit()


