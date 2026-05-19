from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jsonschema import Draft202012Validator
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.models import Backtest, BacktestFile, Client
from app.db.session import get_db
from app.services import audit, storage

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[5]
SCHEMA_PATH = REPO_ROOT / "schemas" / "backtest.schema.json"


def _load_schema() -> dict:
    if not SCHEMA_PATH.exists():
        raise RuntimeError(f"Backtest schema not found at {SCHEMA_PATH}")
    return json.loads(SCHEMA_PATH.read_text())


class UploadResultIn(BaseModel):
    client_id: str
    result: dict  # full v1.0 JSON


class UploadResultOut(BaseModel):
    backtest_id: str
    code: str
    name: str
    storage_key: str


@router.post("/backtests/upload-result", response_model=UploadResultOut, status_code=201)
def upload_backtest_result(
    payload: UploadResultIn,
    request: Request,
    admin=Depends(require_role("main_admin", "sub_admin")),
    db: Session = Depends(get_db),
):
    """Validate the uploaded JSON against the locked v1.0 schema, persist to bucket,
    and create a backtests row + backtest_files row."""
    # 1. Schema validation
    schema = _load_schema()
    errors = list(Draft202012Validator(schema).iter_errors(payload.result))
    if errors:
        violations = [
            {"path": "/".join(str(p) for p in e.absolute_path), "message": e.message}
            for e in errors[:25]
        ]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "Schema validation failed", "violations": violations},
        )

    # 2. Resolve target client
    client_uuid = uuid.UUID(payload.client_id)
    client = db.query(Client).filter(Client.id == client_uuid, Client.deleted_at.is_(None)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # 3. Stamp client into payload, serialise, upload to bucket
    payload.result["client"] = {"client_id": str(client.id), "client_name": client.name}
    raw = json.dumps(payload.result, ensure_ascii=False).encode("utf-8")
    checksum = hashlib.sha256(raw).hexdigest()

    bt_id = uuid.uuid4()
    storage_key = f"clients/{client.id}/backtests/{bt_id}/result.json"
    storage.upload_bytes(storage_key, raw, "application/json")

    # 4. Insert DB rows
    backtest = Backtest(
        id=bt_id,
        client_id=client.id,
        name=payload.result["strategy"]["name"],
        code=payload.result["backtest_id"],
        status="completed",
        assumptions=payload.result["assumptions"],
        metrics=payload.result["metrics"],
        completed_at=datetime.now(timezone.utc),
    )
    db.add(backtest)
    db.flush()
    bf = BacktestFile(
        backtest_id=backtest.id,
        file_type="result_json",
        storage_key=storage_key,
        size_bytes=len(raw),
        checksum=checksum,
    )
    db.add(bf)

    audit.record(
        db,
        actor_user_id=admin.id,
        action="backtest.result.upload",
        target_type="backtest",
        target_id=backtest.id,
        payload={
            "client_id": str(client.id),
            "code": backtest.code,
            "name": backtest.name,
            "size_bytes": len(raw),
        },
        ip=request.client.host if request.client else None,
    )
    db.commit()
    logger.info("Admin uploaded backtest {} for client {}", backtest.code, client.name)

    return UploadResultOut(
        backtest_id=str(backtest.id),
        code=backtest.code,
        name=backtest.name,
        storage_key=storage_key,
    )
