"""Supabase Storage helpers — signed PUT/GET URLs, server-side reads."""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_client() -> Client:
    s = get_settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)


def signed_upload_url(path: str) -> dict:
    """Returns dict with 'signed_url' and 'token' the frontend uses to PUT directly."""
    s = get_settings()
    res = get_client().storage.from_(s.SUPABASE_BUCKET).create_signed_upload_url(path)
    return {"signed_url": res.get("signed_url") or res.get("signedURL"), "token": res.get("token"), "path": path}


def signed_download_url(path: str, expires_in: int = 900) -> str:
    s = get_settings()
    res = get_client().storage.from_(s.SUPABASE_BUCKET).create_signed_url(path, expires_in)
    return res.get("signed_url") or res.get("signedURL")


def upload_bytes(path: str, content: bytes, content_type: str = "application/octet-stream") -> None:
    s = get_settings()
    get_client().storage.from_(s.SUPABASE_BUCKET).upload(
        path, content, {"upsert": "true", "content-type": content_type}
    )


def download_bytes(path: str) -> bytes:
    s = get_settings()
    return get_client().storage.from_(s.SUPABASE_BUCKET).download(path)


def delete_object(path: str) -> None:
    s = get_settings()
    get_client().storage.from_(s.SUPABASE_BUCKET).remove([path])
