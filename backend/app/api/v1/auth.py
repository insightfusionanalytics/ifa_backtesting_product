from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import verify_id_token
from app.db.models import User
from app.db.session import get_db

router = APIRouter()


class LoginIn(BaseModel):
    id_token: str


class LoginOut(BaseModel):
    ok: bool
    user_id: str
    role: str


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """Frontend signs in via Firebase, then POSTs the ID token here.
    Backend verifies it and confirms the user is provisioned in our DB."""
    try:
        decoded = verify_id_token(payload.id_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e

    uid = decoded["uid"]
    user = db.query(User).filter(User.firebase_uid == uid, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not provisioned")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginOut(ok=True, user_id=str(user.id), role=user.role)


@router.post("/logout")
def logout():
    """Stateless on the server. Frontend clears local Firebase session."""
    return {"ok": True}
