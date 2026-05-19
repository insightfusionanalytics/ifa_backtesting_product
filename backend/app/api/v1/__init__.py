from fastapi import APIRouter

from app.api.v1 import auth, me, terms

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, tags=["me"])
api_router.include_router(terms.router, tags=["terms"])
