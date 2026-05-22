from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import current_user
from app.db.models import Client, TermsAcceptance, TermsVersion, User
from app.db.session import get_db

router = APIRouter()


class ClientOut(BaseModel):
    id: str
    name: str
    tier: str
    status: str
    vam_enabled: bool = False  # drives client-side gating of the engine UI


class MeOut(BaseModel):
    id: str
    email: str
    role: str
    status: str
    client: ClientOut | None
    needs_tnc_acceptance: bool
    latest_tnc_version_id: str | None
    # Convenience copy at the top level so the frontend can `if (me.vam_enabled)` without
    # null-checking through me.client. Mirrors me.client.vam_enabled when client is set.
    vam_enabled: bool = False


@router.get("/me", response_model=MeOut)
def get_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    client_out: ClientOut | None = None
    vam_enabled = False
    if user.client_id:
        client = db.query(Client).filter(Client.id == user.client_id).first()
        if client:
            vam_enabled = bool(client.vam_enabled)
            client_out = ClientOut(
                id=str(client.id),
                name=client.name,
                tier=client.tier,
                status=client.status,
                vam_enabled=vam_enabled,
            )

    latest = (
        db.query(TermsVersion).order_by(TermsVersion.effective_from.desc()).first()
    )
    needs_tnc = False
    latest_id = None
    if latest and user.role == "client":
        latest_id = str(latest.id)
        accepted = (
            db.query(TermsAcceptance)
            .filter(
                TermsAcceptance.user_id == user.id,
                TermsAcceptance.terms_version_id == latest.id,
            )
            .first()
        )
        needs_tnc = accepted is None

    return MeOut(
        id=str(user.id),
        email=user.email,
        role=user.role,
        status=user.status,
        client=client_out,
        needs_tnc_acceptance=needs_tnc,
        latest_tnc_version_id=latest_id,
        vam_enabled=vam_enabled,
    )
