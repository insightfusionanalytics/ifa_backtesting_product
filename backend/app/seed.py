"""Seed script — provisions the main admin and a demo client.

Run:
    cd backend
    python -m app.seed
"""
from datetime import datetime, timezone

from loguru import logger
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_firebase_user, get_firebase_user_by_email, init_firebase
from app.db.models import Client, TermsVersion, User
from app.db.session import SessionLocal

DEMO_CLIENT_NAME = "Sterling Capital Advisors"
DEMO_CLIENT_EMAIL = "demo.client@sterlingcap.test"
DEMO_CLIENT_PASSWORD = "DemoClient!2026"

TNC_V1_CLAUSES = [
    {"id": "c1", "title": "Engagement", "body": "The IFA team performs backtests and research deliverables based on strategy documents submitted via this portal.", "required": True},
    {"id": "c2", "title": "Confidentiality", "body": "All strategy documents, parameters, and results are confidential and not redistributed.", "required": True},
    {"id": "c3", "title": "Data", "body": "Market data is sourced from licensed vendors. No guarantee of completeness or accuracy beyond commercially reasonable diligence.", "required": True},
    {"id": "c4", "title": "Results", "body": "Backtest results are hypothetical. Past performance is not indicative of future results.", "required": True},
    {"id": "c5", "title": "Liability", "body": "Liability is limited as set out in the Master Services Agreement.", "required": True},
    {"id": "c6", "title": "Term and Termination", "body": "Either party may terminate with 30 days written notice.", "required": True},
    {"id": "c7", "title": "Change requests", "body": "Three change requests are included per engagement. Additional changes are chargeable.", "required": True},
    {"id": "c8", "title": "Governing law", "body": "This agreement is governed by the laws of the Republic of India. Disputes are subject to the courts of Mumbai.", "required": True},
]


def ensure_firebase_user(email: str, password: str) -> str:
    init_firebase()
    existing = get_firebase_user_by_email(email)
    if existing:
        logger.info("Firebase user exists: {} ({})", email, existing.uid)
        return existing.uid
    uid = create_firebase_user(email=email, password=password)
    logger.info("Created Firebase user: {} ({})", email, uid)
    return uid


def seed(db: Session) -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    # 1. Terms v1.0
    tnc = db.query(TermsVersion).filter(TermsVersion.version == "v1.0").first()
    if not tnc:
        tnc = TermsVersion(
            version="v1.0",
            body="IFA Backtest Engine — Engagement Terms v1.0",
            clauses=TNC_V1_CLAUSES,
            effective_from=now,
        )
        db.add(tnc)
        db.flush()
        logger.info("Inserted T&C v1.0 ({})", tnc.id)
    else:
        logger.info("T&C v1.0 already exists ({})", tnc.id)

    # 2. Main admin
    admin_uid = ensure_firebase_user(settings.MAIN_ADMIN_EMAIL, settings.MAIN_ADMIN_INITIAL_PASSWORD)
    admin = db.query(User).filter(User.firebase_uid == admin_uid).first()
    if not admin:
        admin = User(
            firebase_uid=admin_uid,
            email=settings.MAIN_ADMIN_EMAIL,
            role="main_admin",
            status="active",
            client_id=None,
        )
        db.add(admin)
        db.flush()
        logger.info("Inserted main_admin user ({})", admin.id)
    else:
        logger.info("main_admin already exists ({})", admin.id)

    # 3. Demo client
    client = db.query(Client).filter(Client.name == DEMO_CLIENT_NAME).first()
    if not client:
        client = Client(
            name=DEMO_CLIENT_NAME,
            primary_contact="Aanya Mehra",
            tier="tier1",
            status="active",
            current_tnc_version_id=tnc.id,
        )
        db.add(client)
        db.flush()
        logger.info("Inserted demo client ({})", client.id)
    else:
        logger.info("Demo client already exists ({})", client.id)

    # 4. Demo client user
    client_uid = ensure_firebase_user(DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD)
    client_user = db.query(User).filter(User.firebase_uid == client_uid).first()
    if not client_user:
        client_user = User(
            firebase_uid=client_uid,
            email=DEMO_CLIENT_EMAIL,
            role="client",
            status="active",
            client_id=client.id,
        )
        db.add(client_user)
        db.flush()
        logger.info("Inserted demo client user ({})", client_user.id)
    else:
        logger.info("Demo client user already exists ({})", client_user.id)

    db.commit()
    logger.success("Seed complete")
    logger.info("Main admin login: {} / {}", settings.MAIN_ADMIN_EMAIL, settings.MAIN_ADMIN_INITIAL_PASSWORD)
    logger.info("Demo client login: {} / {}", DEMO_CLIENT_EMAIL, DEMO_CLIENT_PASSWORD)


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
