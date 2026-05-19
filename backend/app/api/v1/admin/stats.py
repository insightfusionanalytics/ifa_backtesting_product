from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.models import Backtest, Client, Request, User
from app.db.session import get_db

router = APIRouter()


class PlatformStats(BaseModel):
    n_clients: int
    n_clients_active: int
    n_backtests: int
    n_backtests_completed: int
    n_requests_open: int
    tier_distribution: dict[str, int]


@router.get("/stats", response_model=PlatformStats)
def platform_stats(
    _admin=Depends(require_role("main_admin", "sub_admin")),
    db: Session = Depends(get_db),
):
    n_clients = db.query(Client).filter(Client.deleted_at.is_(None)).count()
    n_clients_active = (
        db.query(Client).filter(Client.deleted_at.is_(None), Client.status == "active").count()
    )
    n_backtests = db.query(Backtest).count()
    n_backtests_completed = db.query(Backtest).filter(Backtest.status == "completed").count()
    n_requests_open = db.query(Request).filter(Request.status == "open").count()
    tier_rows = (
        db.query(Client.tier, func.count(Client.id))
        .filter(Client.deleted_at.is_(None))
        .group_by(Client.tier)
        .all()
    )
    return PlatformStats(
        n_clients=n_clients,
        n_clients_active=n_clients_active,
        n_backtests=n_backtests,
        n_backtests_completed=n_backtests_completed,
        n_requests_open=n_requests_open,
        tier_distribution={t: c for t, c in tier_rows},
    )
