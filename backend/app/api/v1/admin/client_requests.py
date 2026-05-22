"""Admin: per-client request feed.

Lets admin see ALL requests for a given client (not just opens). Used by the
client drawer to show "what has this client asked for, in any state".
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.models import Client, Request as Req
from app.db.session import get_db

router = APIRouter()


class RequestAdminOut(BaseModel):
    id: str
    type: str
    status: str
    payload: dict
    strategy_id: str | None
    submitted_at: datetime


@router.get("/clients/{client_id}/requests", response_model=list[RequestAdminOut])
def list_client_requests(
    client_id: uuid.UUID,
    _admin=Depends(require_role("main_admin", "sub_admin")),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    rows = (
        db.query(Req)
        .filter(Req.client_id == client_id)
        .order_by(desc(Req.created_at))
        .all()
    )
    return [
        RequestAdminOut(
            id=str(r.id),
            type=r.type,
            status=r.status,
            payload=r.payload or {},
            strategy_id=str(r.strategy_id) if r.strategy_id else None,
            submitted_at=r.created_at,
        )
        for r in rows
    ]
