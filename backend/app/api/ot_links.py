from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import OTLink, User
from app.schemas.ot_link import OTLinkCreate, OTLinkRead
from app.services.audit import log_action

router = APIRouter()


@router.post("/", response_model=OTLinkRead, status_code=status.HTTP_201_CREATED)
def create_ot_link(
    payload: OTLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OTLinkRead:
    link = OTLink(
        owner_id=current_user.id,
        encrypted_payload=payload.encrypted_payload,
        salt=payload.salt,
        iv=payload.iv,
        expiry=payload.expiry,
        single_use=payload.single_use,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    log_action(
        db,
        user=current_user,
        action="ot_link_created",
        request=request,
        details={"ot_link_id": str(link.id), "single_use": link.single_use},
    )

    return link


@router.get("/{link_id}", response_model=OTLinkRead)
def get_ot_link(
    link_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> OTLinkRead:
    now = datetime.now(timezone.utc)

    link = db.query(OTLink).filter(OTLink.id == link_id).first()
    if not link or link.used or link.expiry < now:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OT link invalid or expired")

    log_action(
        db,
        user=None,
        action="ot_link_fetched",
        request=request,
        details={"ot_link_id": str(link.id)},
    )

    return link


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ot_link(
    link_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    link = db.query(OTLink).filter(OTLink.id == link_id, OTLink.owner_id == current_user.id).first()
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OT link not found")

    db.delete(link)
    db.commit()

    log_action(
        db,
        user=current_user,
        action="ot_link_deleted",
        request=request,
        details={"ot_link_id": str(link_id)},
    )

    return None
