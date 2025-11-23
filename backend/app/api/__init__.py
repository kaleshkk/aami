from fastapi import APIRouter

from . import auth, items, ot_links, audit, user, search

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(user.router, prefix="/user", tags=["user"])
router.include_router(items.router, prefix="/items", tags=["items"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(ot_links.router, prefix="/ot-links", tags=["ot-links"])
router.include_router(audit.router, prefix="/audit", tags=["audit"])



