import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class TermsVersion(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "terms_versions"

    version: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    clauses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (UniqueConstraint("version", name="terms_versions_version_key"),)


class TermsAcceptance(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "terms_acceptances"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    terms_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("terms_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    clauses_accepted: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        UniqueConstraint("user_id", "terms_version_id", name="terms_acceptance_uniq"),
    )
