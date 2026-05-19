from pathlib import Path

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials
from loguru import logger

from app.core.config import get_settings

_initialised = False


def init_firebase() -> None:
    global _initialised
    if _initialised:
        return
    settings = get_settings()
    cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
    if not cred_path.is_absolute():
        cred_path = Path(__file__).resolve().parents[3] / cred_path
    if not cred_path.exists():
        raise RuntimeError(f"Firebase credentials not found at {cred_path}")
    cred = credentials.Certificate(str(cred_path))
    firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
    _initialised = True
    logger.info("Firebase Admin initialised for project {}", settings.FIREBASE_PROJECT_ID)


def verify_id_token(id_token: str) -> dict:
    """Verifies the Firebase ID token. Raises ValueError on failure."""
    if not _initialised:
        init_firebase()
    try:
        return fb_auth.verify_id_token(id_token)
    except Exception as e:
        raise ValueError(f"Invalid Firebase ID token: {e}") from e


def create_firebase_user(email: str, password: str, display_name: str | None = None) -> str:
    if not _initialised:
        init_firebase()
    record = fb_auth.create_user(email=email, password=password, display_name=display_name)
    return record.uid


def get_firebase_user_by_email(email: str):
    if not _initialised:
        init_firebase()
    try:
        return fb_auth.get_user_by_email(email)
    except fb_auth.UserNotFoundError:
        return None
