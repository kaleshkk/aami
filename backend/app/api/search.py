from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import Item, User
from app.schemas.item import ItemMeta


router = APIRouter()


@router.get("", response_model=list[ItemMeta])
def search_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ItemMeta]:
    # For now, treat q as a precomputed title_hmac provided by the client.
    items = (
        db.query(Item)
        .filter(Item.owner_id == current_user.id, Item.title_hmac == q)
        .order_by(Item.created_at.desc())
        .all()
    )
    return items


