"""Balances, settlements, and repayments endpoints."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_profile
from app.models.user import (
    Expense, ExpenseShare, Repayment, RoomMember, Profile, AuditLog
)
from app.schemas.schemas import (
    BalanceSummary, MemberBalance, SettlementTransfer,
    RepaymentCreate, RepaymentOut,
)
from app.services.calculations import (
    compute_balances, suggest_settlements, paise_to_rupees, rupees_to_paise
)

balances_router = APIRouter(prefix="/api/rooms/{room_id}", tags=["balances"])
repayments_router = APIRouter(prefix="/api/rooms/{room_id}/repayments", tags=["repayments"])


def _assert_member(room_id: str, user_id: str, db: Session):
    m = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id,
        RoomMember.status == "active",
    ).first()
    if not m:
        raise HTTPException(403, "Not an active member of this room")
    return m


@balances_router.get("/balances", response_model=BalanceSummary)
def get_balances(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
):
    _assert_member(room_id, profile.id, db)

    # Determine period
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
        except Exception:
            raise HTTPException(400, "Invalid month format. Use YYYY-MM")
    else:
        now = datetime.utcnow()
        year, mon = now.year, now.month

    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # Get active members
    active_members = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.status == "active",
    ).all()
    member_profiles = {
        m.user_id: m.profile for m in active_members if m.profile
    }

    # Get active expenses for period
    expenses = db.query(Expense).filter(
        Expense.room_id == room_id,
        Expense.status == "active",
        Expense.expense_date >= start,
        Expense.expense_date < end,
    ).all()

    # Build input for balance engine
    expense_tuples = []
    for exp in expenses:
        shares = {s.member_id: s.share_amount_paise for s in exp.shares}
        expense_tuples.append((exp.paid_by, exp.total_amount_paise, shares))

    # Get confirmed repayments
    repayments = db.query(Repayment).filter(
        Repayment.room_id == room_id,
        Repayment.status == "confirmed",
    ).all()
    repayment_tuples = [
        (r.debtor_id, r.creditor_id, r.amount_paise, True) for r in repayments
    ]

    raw_balances = compute_balances(expense_tuples, repayment_tuples)

    # Compute per-member paid / share
    total_paid: dict[str, int] = {}
    total_share: dict[str, int] = {}
    for exp in expenses:
        total_paid[exp.paid_by] = total_paid.get(exp.paid_by, 0) + exp.total_amount_paise
        for share in exp.shares:
            total_share[share.member_id] = total_share.get(share.member_id, 0) + share.share_amount_paise

    member_balances = []
    for m in active_members:
        uid = m.user_id
        p = member_profiles.get(uid)
        member_balances.append(MemberBalance(
            user_id=uid,
            display_name=p.display_name if p else uid,
            avatar_url=p.avatar_url if p else None,
            total_paid=paise_to_rupees(total_paid.get(uid, 0)),
            total_share=paise_to_rupees(total_share.get(uid, 0)),
            net_balance=paise_to_rupees(raw_balances.get(uid, 0)),
        ))

    # Settlement suggestions
    name_map = {uid: (p.display_name if p else uid) for uid, p in member_profiles.items()}
    suggestions_raw = suggest_settlements(raw_balances)
    settlements = [
        SettlementTransfer(
            from_user_id=s["from_id"],
            from_display_name=name_map.get(s["from_id"], s["from_id"]),
            to_user_id=s["to_id"],
            to_display_name=name_map.get(s["to_id"], s["to_id"]),
            amount=paise_to_rupees(s["amount_paise"]),
        )
        for s in suggestions_raw
    ]

    total_spending = sum(e.total_amount_paise for e in expenses)

    return BalanceSummary(
        members=member_balances,
        settlements=settlements,
        total_room_spending=paise_to_rupees(total_spending),
        selected_period=f"{year}-{mon:02d}",
    )


# ─── Repayments ──────────────────────────────────────────────────────────────

@repayments_router.post("", response_model=RepaymentOut, status_code=201)
def record_repayment(
    room_id: str,
    body: RepaymentCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)

    # Verify debtor and creditor are room members
    for uid in [body.debtor_id, body.creditor_id]:
        member = db.query(RoomMember).filter(
            RoomMember.room_id == room_id,
            RoomMember.user_id == uid,
            RoomMember.status == "active",
        ).first()
        if not member:
            raise HTTPException(400, f"User {uid} is not an active room member")

    repayment = Repayment(
        room_id=room_id,
        debtor_id=body.debtor_id,
        creditor_id=body.creditor_id,
        amount_paise=rupees_to_paise(body.amount),
        payment_method=body.payment_method,
        reference_note=body.reference_note,
        status="pending",
        recorded_by=profile.id,
        paid_at=body.paid_at or datetime.utcnow(),
    )
    db.add(repayment)
    db.commit()
    db.refresh(repayment)
    return RepaymentOut.from_orm_obj(repayment)


@repayments_router.get("", response_model=list[RepaymentOut])
def list_repayments(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    _assert_member(room_id, profile.id, db)
    items = db.query(Repayment).filter(
        Repayment.room_id == room_id
    ).order_by(Repayment.created_at.desc()).offset(skip).limit(limit).all()
    return [RepaymentOut.from_orm_obj(r) for r in items]


@repayments_router.post("/{repayment_id}/confirm", status_code=200)
def confirm_repayment(
    room_id: str,
    repayment_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)
    repayment = db.query(Repayment).filter(
        Repayment.id == repayment_id,
        Repayment.room_id == room_id,
        Repayment.status == "pending",
    ).first()
    if not repayment:
        raise HTTPException(404, "Repayment not found or not pending")

    # Creditor must confirm
    if profile.id != repayment.creditor_id:
        raise HTTPException(403, "Only the creditor can confirm a repayment")

    repayment.status = "confirmed"
    repayment.confirmed_by = profile.id
    repayment.confirmed_at = datetime.utcnow()

    log = AuditLog(
        room_id=room_id,
        actor_id=profile.id,
        entity_type="repayment",
        entity_id=repayment_id,
        action="confirm",
    )
    db.add(log)
    db.commit()
    return {"message": "Repayment confirmed", "repayment_id": repayment_id}
