"""
SQLAlchemy ORM models for RoomieSplit.

All monetary amounts are stored as INTEGER (paise) to avoid floating-point issues.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime,
    ForeignKey, Text, Enum as SAEnum, UniqueConstraint, CheckConstraint, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True)  # Supabase auth UUID
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship("RoomMember", back_populates="profile", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    # monthly_budget stored as paise (integer)
    monthly_budget_paise = Column(BigInteger, default=0, nullable=False)
    budget_start_day = Column(Integer, default=1, nullable=False)  # day of month 1-28
    created_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True, nullable=False)

    members = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="room")
    invitations = relationship("RoomInvitation", back_populates="room")
    repayments = relationship("Repayment", back_populates="room")


class RoomMember(Base):
    __tablename__ = "room_members"

    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role = Column(SAEnum("leader", "member", name="member_role"), default="member", nullable=False)
    status = Column(SAEnum("active", "removed", name="member_status"), default="active", nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="members")
    profile = relationship("Profile", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_member"),
    )


class RoomInvitation(Base):
    __tablename__ = "room_invitations"

    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    # Store only the hash of the token for security
    token_hash = Column(String(64), unique=True, nullable=False)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    used_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="invitations")

    __table_args__ = (
        Index("ix_invitation_token_hash", "token_hash"),
    )


EXPENSE_CATEGORIES = [
    "vegetables", "groceries", "milk_dairy", "drinking_water",
    "household_supplies", "utilities", "other"
]

SHARING_METHODS = ["equal", "custom", "percentage"]
EXPENSE_STATUSES = ["active", "voided"]


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    # total_amount stored as paise
    total_amount_paise = Column(BigInteger, nullable=False)
    currency = Column(String(10), default="INR", nullable=False)
    paid_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    created_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    expense_date = Column(DateTime, nullable=False)
    sharing_method = Column(String(20), default="equal", nullable=False)
    description = Column(Text, nullable=True)
    merchant_name = Column(String(200), nullable=True)
    status = Column(String(20), default="active", nullable=False)
    void_reason = Column(Text, nullable=True)
    voided_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    voided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    room = relationship("Room", back_populates="expenses")
    payer = relationship("Profile", foreign_keys=[paid_by])
    creator = relationship("Profile", foreign_keys=[created_by])
    shares = relationship("ExpenseShare", back_populates="expense", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("total_amount_paise > 0", name="ck_expense_positive_amount"),
        Index("ix_expense_room_date", "room_id", "expense_date"),
        Index("ix_expense_room_status", "room_id", "status"),
    )


class ExpenseShare(Base):
    __tablename__ = "expense_shares"

    id = Column(String, primary_key=True, default=gen_uuid)
    expense_id = Column(String, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    # share_amount stored as paise
    share_amount_paise = Column(BigInteger, nullable=False)

    expense = relationship("Expense", back_populates="shares")
    member = relationship("Profile")

    __table_args__ = (
        UniqueConstraint("expense_id", "member_id", name="uq_expense_share"),
        CheckConstraint("share_amount_paise >= 0", name="ck_share_non_negative"),
    )


REPAYMENT_STATUSES = ["pending", "confirmed", "rejected"]
PAYMENT_METHODS = ["cash", "upi", "other"]


class Repayment(Base):
    __tablename__ = "repayments"

    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False)
    debtor_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    creditor_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    # amount stored as paise
    amount_paise = Column(BigInteger, nullable=False)
    payment_method = Column(String(20), default="cash", nullable=False)
    reference_note = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    recorded_by = Column(String, ForeignKey("profiles.id"), nullable=False)
    confirmed_by = Column(String, ForeignKey("profiles.id"), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="repayments")
    debtor = relationship("Profile", foreign_keys=[debtor_id])
    creditor = relationship("Profile", foreign_keys=[creditor_id])
    recorder = relationship("Profile", foreign_keys=[recorded_by])
    confirmer = relationship("Profile", foreign_keys=[confirmed_by])

    __table_args__ = (
        CheckConstraint("debtor_id != creditor_id", name="ck_repayment_different_parties"),
        CheckConstraint("amount_paise > 0", name="ck_repayment_positive_amount"),
        Index("ix_repayment_room", "room_id"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    actor_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String, nullable=False)
    action = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    previous_values = Column(Text, nullable=True)  # JSON string
    new_values = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_audit_room", "room_id"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )
