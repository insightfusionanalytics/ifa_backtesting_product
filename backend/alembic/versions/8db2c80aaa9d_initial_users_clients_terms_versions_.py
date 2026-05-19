"""initial: users, clients, terms_versions, terms_acceptances

Revision ID: 8db2c80aaa9d
Revises:
Create Date: 2026-05-19 12:30:37.481669
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "8db2c80aaa9d"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tables without cross-table FKs to avoid the dependency cycle
    # (users ↔ clients ↔ terms_versions ↔ users).
    op.create_table(
        "clients",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("primary_contact", sa.String(length=200), nullable=True),
        sa.Column("tier", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_tnc_version_id", sa.UUID(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('active','suspended')", name=op.f("ck_clients_status_valid")),
        sa.CheckConstraint("tier IN ('tier1','tier2','tier3')", name=op.f("ck_clients_tier_valid")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clients")),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("firebase_uid", sa.String(length=128), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('client','sub_admin','main_admin')", name=op.f("ck_users_role_valid")),
        sa.CheckConstraint("status IN ('active','suspended')", name=op.f("ck_users_user_status_valid")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name="users_email_key"),
        sa.UniqueConstraint("firebase_uid", name="users_firebase_uid_key"),
    )

    op.create_table(
        "terms_versions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("clauses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_terms_versions")),
        sa.UniqueConstraint("version", name="terms_versions_version_key"),
    )

    op.create_table(
        "terms_acceptances",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("terms_version_id", sa.UUID(), nullable=False),
        sa.Column("clauses_accepted", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_terms_acceptances")),
        sa.UniqueConstraint("user_id", "terms_version_id", name="terms_acceptance_uniq"),
    )

    # Now add the cross-table FKs
    op.create_foreign_key(
        "fk_clients_current_tnc_version_id_terms_versions",
        "clients", "terms_versions",
        ["current_tnc_version_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_clients_deleted_by_users",
        "clients", "users",
        ["deleted_by"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_client_id_clients",
        "users", "clients",
        ["client_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_users_deleted_by_users",
        "users", "users",
        ["deleted_by"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_terms_versions_created_by_users",
        "terms_versions", "users",
        ["created_by"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_terms_acceptances_user_id_users",
        "terms_acceptances", "users",
        ["user_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_terms_acceptances_terms_version_id_terms_versions",
        "terms_acceptances", "terms_versions",
        ["terms_version_id"], ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_table("terms_acceptances")
    op.drop_table("terms_versions")
    op.drop_table("users")
    op.drop_table("clients")
