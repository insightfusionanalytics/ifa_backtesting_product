from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import client_scope, current_user
from app.db.models import Request as RequestRow
from app.db.models import User
from app.db.session import get_db
from app.services import audit

router = APIRouter()

RequestType = Literal["new_strategy", "change", "quote", "clarification"]


class RequestIn(BaseModel):
    type: RequestType
    payload: dict
    strategy_id: str | None = None


class RequestOut(BaseModel):
    id: str
    type: str
    status: str
    payload: dict
    strategy_id: str | None
    submitted_at: datetime


@router.get("/requests", response_model=list[RequestOut])
def list_requests(
    client_id: uuid.UUID = Depends(client_scope), db: Session = Depends(get_db)
):
    rows = (
        db.query(RequestRow)
        .filter(RequestRow.client_id == client_id)
        .order_by(desc(RequestRow.created_at))
        .all()
    )
    return [
        RequestOut(
            id=str(r.id),
            type=r.type,
            status=r.status,
            payload=r.payload or {},
            strategy_id=str(r.strategy_id) if r.strategy_id else None,
            submitted_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/requests", response_model=RequestOut)
def submit_request(
    payload: RequestIn,
    request: Request,
    user: User = Depends(current_user),
    client_id: uuid.UUID = Depends(client_scope),
    db: Session = Depends(get_db),
):
    row = RequestRow(
        client_id=client_id,
        type=payload.type,
        payload=payload.payload,
        strategy_id=uuid.UUID(payload.strategy_id) if payload.strategy_id else None,
        status="open",
        submitted_by=user.id,
    )
    db.add(row)
    db.flush()

    audit.record(
        db,
        actor_user_id=user.id,
        action=f"request.submit.{payload.type}",
        target_type="request",
        target_id=row.id,
        payload={"type": payload.type, "summary": payload.payload.get("summary", "")[:200]},
        ip=request.client.host if request.client else None,
    )
    db.commit()

    return RequestOut(
        id=str(row.id),
        type=row.type,
        status=row.status,
        payload=row.payload,
        strategy_id=str(row.strategy_id) if row.strategy_id else None,
        submitted_at=row.created_at,
    )
