"""
Pydantic schemas for request/response validation.

Monetary amounts are always in RUPEES (float/Decimal) at the API boundary
and converted to paise internally.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator, model_validator


# ─── Profiles ────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    avatar_url: Optional[str] = None


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    avatar_url: Optional[str] = None


class ProfileOut(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Rooms ────────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    currency: str = Field(default="INR", max_length=10)
    monthly_budget: float = Field(ge=0, description="Monthly budget in rupees")
    budget_start_day: int = Field(default=1, ge=1, le=28)

    @field_validator("monthly_budget")
    @classmethod
    def budget_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Budget must be non-negative")
        return v


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    monthly_budget: Optional[float] = Field(None, ge=0)
    budget_start_day: Optional[int] = Field(None, ge=1, le=28)


class RoomOut(BaseModel):
    id: str
    name: str
    currency: str
    monthly_budget: float
    budget_start_day: int
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, room) -> "RoomOut":
        return cls(
            id=room.id,
            name=room.name,
            currency=room.currency,
            monthly_budget=room.monthly_budget_paise / 100.0,
            budget_start_day=room.budget_start_day,
            created_by=room.created_by,
            created_at=room.created_at,
        )


# ─── Room Members ─────────────────────────────────────────────────────────────

class MemberOut(BaseModel):
    id: str
    room_id: str
    user_id: str
    role: str
    status: str
    joined_at: datetime
    profile: Optional[ProfileOut] = None

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(leader|member)$")


# ─── Invitations ──────────────────────────────────────────────────────────────

class InvitationCreate(BaseModel):
    expires_hours: int = Field(default=48, ge=1, le=720)


class InvitationOut(BaseModel):
    id: str
    room_id: str
    token: str  # raw token returned once; only hash stored in DB
    expires_at: datetime
    created_at: datetime


class JoinRoomRequest(BaseModel):
    token: str = Field(..., min_length=10)


# ─── Expenses ─────────────────────────────────────────────────────────────────

class ShareInput(BaseModel):
    member_id: str
    amount: float = Field(ge=0, description="Share in rupees")


class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(gt=0, description="Total in rupees")
    category: str = Field(..., min_length=1)
    paid_by: str
    expense_date: datetime
    sharing_method: str = Field(default="equal", pattern="^(equal|custom|percentage)$")
    description: Optional[str] = None
    merchant_name: Optional[str] = Field(None, max_length=200)
    member_ids: List[str] = Field(..., min_length=1, description="Members sharing the expense")
    custom_shares: Optional[List[ShareInput]] = None
    percentage_shares: Optional[Dict[str, float]] = None

    @model_validator(mode="after")
    def validate_sharing(self) -> "ExpenseCreate":
        if self.sharing_method == "custom":
            if not self.custom_shares:
                raise ValueError("custom_shares required for custom split")
        if self.sharing_method == "percentage":
            if not self.percentage_shares:
                raise ValueError("percentage_shares required for percentage split")
        return self


class ExpenseShareOut(BaseModel):
    id: str
    member_id: str
    share_amount: float
    member: Optional[ProfileOut] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, share) -> "ExpenseShareOut":
        return cls(
            id=share.id,
            member_id=share.member_id,
            share_amount=share.share_amount_paise / 100.0,
            member=ProfileOut.model_validate(share.member) if share.member else None,
        )


class ExpenseOut(BaseModel):
    id: str
    room_id: str
    title: str
    category: str
    amount: float
    currency: str
    paid_by: str
    created_by: str
    expense_date: datetime
    sharing_method: str
    description: Optional[str]
    merchant_name: Optional[str]
    status: str
    shares: List[ExpenseShareOut] = []
    payer: Optional[ProfileOut] = None
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, exp) -> "ExpenseOut":
        return cls(
            id=exp.id,
            room_id=exp.room_id,
            title=exp.title,
            category=exp.category,
            amount=exp.total_amount_paise / 100.0,
            currency=exp.currency,
            paid_by=exp.paid_by,
            created_by=exp.created_by,
            expense_date=exp.expense_date,
            sharing_method=exp.sharing_method,
            description=exp.description,
            merchant_name=exp.merchant_name,
            status=exp.status,
            shares=[ExpenseShareOut.from_orm_obj(s) for s in exp.shares],
            payer=ProfileOut.model_validate(exp.payer) if exp.payer else None,
            created_at=exp.created_at,
            updated_at=exp.updated_at,
        )


class ExpenseVoid(BaseModel):
    reason: str = Field(..., min_length=1)


class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    merchant_name: Optional[str] = None
    expense_date: Optional[datetime] = None


# ─── Balances ─────────────────────────────────────────────────────────────────

class MemberBalance(BaseModel):
    user_id: str
    display_name: str
    avatar_url: Optional[str]
    total_paid: float
    total_share: float
    net_balance: float  # positive=receive, negative=owe


class SettlementTransfer(BaseModel):
    from_user_id: str
    from_display_name: str
    to_user_id: str
    to_display_name: str
    amount: float


class BalanceSummary(BaseModel):
    members: List[MemberBalance]
    settlements: List[SettlementTransfer]
    total_room_spending: float
    selected_period: str


# ─── Repayments ───────────────────────────────────────────────────────────────

class RepaymentCreate(BaseModel):
    debtor_id: str
    creditor_id: str
    amount: float = Field(gt=0, description="Amount in rupees")
    payment_method: str = Field(default="cash", pattern="^(cash|upi|other)$")
    reference_note: Optional[str] = None
    paid_at: Optional[datetime] = None

    @model_validator(mode="after")
    def different_parties(self) -> "RepaymentCreate":
        if self.debtor_id == self.creditor_id:
            raise ValueError("Debtor and creditor must be different")
        return self


class RepaymentOut(BaseModel):
    id: str
    room_id: str
    debtor_id: str
    creditor_id: str
    amount: float
    payment_method: str
    reference_note: Optional[str]
    status: str
    recorded_by: str
    confirmed_by: Optional[str]
    paid_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    created_at: datetime
    debtor: Optional[ProfileOut] = None
    creditor: Optional[ProfileOut] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, r) -> "RepaymentOut":
        return cls(
            id=r.id,
            room_id=r.room_id,
            debtor_id=r.debtor_id,
            creditor_id=r.creditor_id,
            amount=r.amount_paise / 100.0,
            payment_method=r.payment_method,
            reference_note=r.reference_note,
            status=r.status,
            recorded_by=r.recorded_by,
            confirmed_by=r.confirmed_by,
            paid_at=r.paid_at,
            confirmed_at=r.confirmed_at,
            created_at=r.created_at,
            debtor=ProfileOut.model_validate(r.debtor) if r.debtor else None,
            creditor=ProfileOut.model_validate(r.creditor) if r.creditor else None,
        )


# ─── Reports ──────────────────────────────────────────────────────────────────

class CategoryStat(BaseModel):
    category: str
    total: float
    count: int
    percentage: float


class MonthlyReport(BaseModel):
    month: str
    total_spending: float
    budget: float
    remaining: float
    utilization_pct: float
    categories: List[CategoryStat]
    member_contributions: List[Dict]
    expense_count: int
