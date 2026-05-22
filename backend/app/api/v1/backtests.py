from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import client_scope
from app.db.models import Backtest, BacktestFile
from app.db.session import get_db
from app.services import storage

router = APIRouter()


class BacktestListItem(BaseModel):
    id: str
    code: str
    name: str
    status: str
    engine: str  # 'manual' (v1.0 schema) or 'vam' (VAM-native) — drives renderer choice
    completed_at: datetime | None
    created_at: datetime


class BacktestDetail(BaseModel):
    id: str
    code: str
    name: str
    status: str
    engine: str  # see BacktestListItem.engine
    assumptions: dict | None
    metrics: dict | None
    result: dict | None  # Full envelope from storage — v1.0 or vam-1.0 shape per `engine`
    completed_at: datetime | None
    created_at: datetime


@router.get("/backtests", response_model=list[BacktestListItem])
def list_backtests(
    client_id: uuid.UUID = Depends(client_scope),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
):
    q = db.query(Backtest).filter(Backtest.client_id == client_id)
    if status_filter:
        q = q.filter(Backtest.status == status_filter)
    rows = q.order_by(desc(Backtest.created_at)).all()
    return [
        BacktestListItem(
            id=str(r.id),
            code=r.code,
            name=r.name,
            status=r.status,
            engine=r.engine,
            completed_at=r.completed_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/backtests/{backtest_id}", response_model=BacktestDetail)
def get_backtest(
    backtest_id: uuid.UUID,
    client_id: uuid.UUID = Depends(client_scope),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Backtest)
        .filter(Backtest.id == backtest_id, Backtest.client_id == client_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Backtest not found")

    result_payload: dict | None = None
    result_file = (
        db.query(BacktestFile)
        .filter(BacktestFile.backtest_id == row.id, BacktestFile.file_type == "result_json")
        .first()
    )
    if result_file:
        try:
            raw = storage.download_bytes(result_file.storage_key)
            result_payload = json.loads(raw)
        except Exception:
            result_payload = None  # graceful: storage hiccup shouldn't 500 the detail page

    return BacktestDetail(
        id=str(row.id),
        code=row.code,
        name=row.name,
        status=row.status,
        engine=row.engine,
        assumptions=row.assumptions,
        metrics=row.metrics,
        result=result_payload,
        completed_at=row.completed_at,
        created_at=row.created_at,
    )
