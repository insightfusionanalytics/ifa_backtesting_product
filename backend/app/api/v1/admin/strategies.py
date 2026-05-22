from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.models import StrategyDocument
from app.db.session import get_db
from app.services import storage

router = APIRouter()


class StrategyAdminOut(BaseModel):
    id: str
    client_id: str
    name: str
    version: int
    storage_key: str
    size_bytes: int | None
    mime_type: str | None
    checksum: str | None
    is_source_of_truth: bool
    status: str
    uploaded_by: str | None
    uploaded_at: datetime


class DownloadUrlOut(BaseModel):
    signed_url: str
    expires_in: int


@router.get("/clients/{client_id}/strategies", response_model=list[StrategyAdminOut])
def list_client_strategies(
    client_id: uuid.UUID,
    _admin=Depends(require_role("main_admin", "sub_admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(StrategyDocument)
        .filter(StrategyDocument.client_id == client_id)
        .order_by(desc(StrategyDocument.created_at))
        .all()
    )
    return [
        StrategyAdminOut(
            id=str(r.id),
            client_id=str(r.client_id),
            name=r.name,
            version=r.version,
            storage_key=r.storage_key,
            size_bytes=r.size_bytes,
            mime_type=r.mime_type,
            checksum=r.checksum,
            is_source_of_truth=r.is_source_of_truth,
            status=r.status,
            uploaded_by=str(r.uploaded_by) if r.uploaded_by else None,
            uploaded_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/strategies/{strategy_id}/download-url", response_model=DownloadUrlOut)
def get_strategy_download_url(
    strategy_id: uuid.UUID,
    _admin=Depends(require_role("main_admin", "sub_admin")),
    db: Session = Depends(get_db),
):
    """Returns a short-lived signed URL the admin can hit to download/view the PDF.
    URL expires in 5 minutes."""
    row = db.query(StrategyDocument).filter(StrategyDocument.id == strategy_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Strategy not found")
    expires_in = 300  # 5 minutes
    return DownloadUrlOut(
        signed_url=storage.signed_download_url(row.storage_key, expires_in=expires_in),
        expires_in=expires_in,
    )
