from fastapi import APIRouter

from app.api.v1 import auth, backtests, me, requests, strategies, terms, vam
from app.api.v1.admin import admin_router

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(me.router, tags=["me"])
api_router.include_router(terms.router, tags=["terms"])
api_router.include_router(strategies.router, tags=["strategies"])
api_router.include_router(requests.router, tags=["requests"])
api_router.include_router(backtests.router, tags=["backtests"])
api_router.include_router(vam.router)
api_router.include_router(admin_router)
