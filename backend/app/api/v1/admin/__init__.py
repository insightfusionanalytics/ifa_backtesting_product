from fastapi import APIRouter

from app.api.v1.admin import audit, backtests, clients, notifications, stats, terms

admin_router = APIRouter(prefix="/admin", tags=["admin"])
admin_router.include_router(stats.router)
admin_router.include_router(clients.router)
admin_router.include_router(backtests.router)
admin_router.include_router(terms.router)
admin_router.include_router(notifications.router)
admin_router.include_router(audit.router)
