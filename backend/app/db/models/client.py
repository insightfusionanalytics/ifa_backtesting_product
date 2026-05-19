import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Client(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "clients"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    primary_contact: Mapped[str | None] = mapped_column(String(200))
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="tier1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    current_tnc_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("terms_versions.id", ondelete="SET NULL")
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        CheckConstraint("tier IN ('tier1','tier2','tier3')", name="tier_valid"),
        CheckConstraint("status IN ('active','suspended')", name="status_valid"),
    )
