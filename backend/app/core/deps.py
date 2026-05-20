from collections.abc import Generator
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import TokenError, verify_id_token
from app.db.models import User
from app.db.session import get_db


# Public-facing token-error map. Keep messages opaque — internals are logged
# server-side (see app.core.security.verify_id_token).
_TOKEN_PUBLIC_MESSAGES = {
    "token_missing": "Missing or empty token",
    "token_invalid": "Invalid token",
    "token_expired": "Token expired, please sign in again",
    "token_revoked": "Token revoked, please sign in again",
    "user_disabled": "Account is disabled",
    "auth_service_unavailable": "Authentication service temporarily unavailable",
}


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = verify_id_token(token)
    except TokenError as e:
        msg = _TOKEN_PUBLIC_MESSAGES.get(e.reason, "Invalid token")
        # Service-unavailable warrants 503; everything else is 401
        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if e.reason == "auth_service_unavailable"
            else status.HTTP_401_UNAUTHORIZED
        )
        raise HTTPException(status_code=status_code, detail=msg) from e

    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.firebase_uid == uid, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not provisioned")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User suspended")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return user


def require_role(*roles: str):
    def _check(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user

    return _check


def client_scope(user: User = Depends(current_user)):
    if user.role != "client" or user.client_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client-only endpoint")
    return user.client_id
