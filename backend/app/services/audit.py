"""Append-only audit log. Never UPDATE or DELETE from this module."""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import AuditLog


def record(
    db: Session,
    *,
    actor_user_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    payload: dict | None = None,
    ip: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload=payload,
        ip=ip,
    )
    db.add(entry)
    db.flush()
    return entry
