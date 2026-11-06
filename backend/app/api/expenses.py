"""Expense CRUD and financial calculation endpoints."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_profile
from app.models.user import Expense, ExpenseShare, RoomMember, Profile, AuditLog
from app.schemas.schemas import (
    ExpenseCreate, ExpenseOut, ExpenseUpdate, ExpenseVoid
)
from app.services.calculations import (
    rupees_to_paise,
    calculate_equal_split,
    calculate_percentage_split,
    validate_custom_split,
)

router = APIRouter(prefix="/api/rooms/{room_id}/expenses", tags=["expenses"])


def _assert_member(room_id: str, user_id: str, db: Session):
    m = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id,
        RoomMember.status == "active",
    ).first()
    if not m:
        raise HTTPException(403, "Not an active member of this room")
    return m


def _assert_leader(room_id: str, user_id: str, db: Session):
    m = _assert_member(room_id, user_id, db)
    if m.role != "leader":
        raise HTTPException(403, "Leader permission required")
    return m


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    room_id: str,
    body: ExpenseCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)

    # Verify payer is an active room member
    payer_member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == body.paid_by,
        RoomMember.status == "active",
    ).first()
    if not payer_member:
        raise HTTPException(400, "Payer must be an active room member")

    # Verify all beneficiary members are active room members
    active_members = {
        m.user_id for m in db.query(RoomMember).filter(
            RoomMember.room_id == room_id,
            RoomMember.status == "active",
        ).all()
    }
    for mid in body.member_ids:
        if mid not in active_members:
            raise HTTPException(400, f"Member {mid} is not an active room member")

    total_paise = rupees_to_paise(body.amount)

    # Calculate shares
    if body.sharing_method == "equal":
        shares = calculate_equal_split(total_paise, body.member_ids)
    elif body.sharing_method == "custom":
        shares = {s.member_id: rupees_to_paise(s.amount) for s in (body.custom_shares or [])}
        validate_custom_split(total_paise, shares)
    elif body.sharing_method == "percentage":
        shares = calculate_percentage_split(total_paise, body.percentage_shares or {})
    else:
        raise HTTPException(400, f"Unknown sharing method: {body.sharing_method}")

    expense = Expense(
        room_id=room_id,
        title=body.title,
        category=body.category,
        total_amount_paise=total_paise,
        paid_by=body.paid_by,
        created_by=profile.id,
        expense_date=body.expense_date,
        sharing_method=body.sharing_method,
        description=body.description,
        merchant_name=body.merchant_name,
        status="active",
    )
    db.add(expense)
    db.flush()

    for member_id, share_paise in shares.items():
        db.add(ExpenseShare(
            expense_id=expense.id,
            member_id=member_id,
            share_amount_paise=share_paise,
        ))

    db.commit()
    db.refresh(expense)
    return ExpenseOut.from_orm_obj(expense)


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None),
    paid_by: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    _assert_member(room_id, profile.id, db)
    q = db.query(Expense).filter(Expense.room_id == room_id)

    if category:
        q = q.filter(Expense.category == category)
    if paid_by:
        q = q.filter(Expense.paid_by == paid_by)
    if status_filter:
        q = q.filter(Expense.status == status_filter)
    else:
        q = q.filter(Expense.status == "active")

    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
            start = datetime(year, mon, 1)
            if mon == 12:
                end = datetime(year + 1, 1, 1)
            else:
                end = datetime(year, mon + 1, 1)
            q = q.filter(Expense.expense_date >= start, Expense.expense_date < end)
        except Exception:
            raise HTTPException(400, "Invalid month format. Use YYYY-MM")

    q = q.order_by(Expense.expense_date.desc()).offset(skip).limit(limit)
    return [ExpenseOut.from_orm_obj(e) for e in q.all()]


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(
    room_id: str,
    expense_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)
    exp = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.room_id == room_id,
    ).first()
    if not exp:
        raise HTTPException(404, "Expense not found")
    return ExpenseOut.from_orm_obj(exp)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    room_id: str,
    expense_id: str,
    body: ExpenseUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    exp = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.room_id == room_id,
        Expense.status == "active",
    ).first()
    if not exp:
        raise HTTPException(404, "Expense not found or already voided")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(exp, field, value)
    db.commit()
    db.refresh(exp)
    return ExpenseOut.from_orm_obj(exp)


@router.post("/{expense_id}/void", status_code=200)
def void_expense(
    room_id: str,
    expense_id: str,
    body: ExpenseVoid,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    exp = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.room_id == room_id,
        Expense.status == "active",
    ).first()
    if not exp:
        raise HTTPException(404, "Expense not found or already voided")

    exp.status = "voided"
    exp.void_reason = body.reason
    exp.voided_by = profile.id
    exp.voided_at = datetime.utcnow()

    # Audit log
    log = AuditLog(
        room_id=room_id,
        actor_id=profile.id,
        entity_type="expense",
        entity_id=expense_id,
        action="void",
        reason=body.reason,
    )
    db.add(log)
    db.commit()
    return {"message": "Expense voided", "expense_id": expense_id}
