from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import AuditLog, User

router = APIRouter()


@router.get("/logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    # In a full implementation, restrict this to admins. For now, return current user's logs.
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.ts.desc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "ts": log.ts,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "details": log.details,
        }
        for log in logs
    ]

