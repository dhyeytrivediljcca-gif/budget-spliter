"""Monthly reports and category breakdowns."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from collections import defaultdict

from app.core.database import get_db
from app.core.auth import get_current_profile
from app.models.user import Expense, ExpenseShare, Room, RoomMember, Profile
from app.schemas.schemas import MonthlyReport, CategoryStat
from app.services.calculations import paise_to_rupees

router = APIRouter(prefix="/api/rooms/{room_id}/reports", tags=["reports"])


def _assert_member(room_id: str, user_id: str, db: Session):
    m = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id,
        RoomMember.status == "active",
    ).first()
    if not m:
        raise HTTPException(403, "Not an active member of this room")
    return m


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
    month: Optional[str] = Query(None, description="YYYY-MM"),
):
    _assert_member(room_id, profile.id, db)

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

    room = db.query(Room).get(room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    expenses = db.query(Expense).filter(
        Expense.room_id == room_id,
        Expense.status == "active",
        Expense.expense_date >= start,
        Expense.expense_date < end,
    ).all()

    total_paise = sum(e.total_amount_paise for e in expenses)
    budget_paise = room.monthly_budget_paise

    # Category breakdown
    cat_data: dict[str, dict] = defaultdict(lambda: {"total": 0, "count": 0})
    for exp in expenses:
        cat_data[exp.category]["total"] += exp.total_amount_paise
        cat_data[exp.category]["count"] += 1

    categories = []
    for cat, data in cat_data.items():
        categories.append(CategoryStat(
            category=cat,
            total=paise_to_rupees(data["total"]),
            count=data["count"],
            percentage=round(data["total"] / total_paise * 100, 2) if total_paise > 0 else 0,
        ))
    categories.sort(key=lambda c: c.total, reverse=True)

    # Member contribution
    contribution: dict[str, int] = defaultdict(int)
    for exp in expenses:
        contribution[exp.paid_by] += exp.total_amount_paise

    active_members = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.status == "active",
    ).all()
    member_contributions = []
    for m in active_members:
        p = m.profile
        member_contributions.append({
            "user_id": m.user_id,
            "display_name": p.display_name if p else m.user_id,
            "amount_paid": paise_to_rupees(contribution.get(m.user_id, 0)),
            "percentage": round(contribution.get(m.user_id, 0) / total_paise * 100, 2) if total_paise > 0 else 0,
        })

    remaining_paise = budget_paise - total_paise
    utilization = round(total_paise / budget_paise * 100, 2) if budget_paise > 0 else 0.0

    return MonthlyReport(
        month=f"{year}-{mon:02d}",
        total_spending=paise_to_rupees(total_paise),
        budget=paise_to_rupees(budget_paise),
        remaining=paise_to_rupees(remaining_paise),
        utilization_pct=utilization,
        categories=categories,
        member_contributions=member_contributions,
        expense_count=len(expenses),
    )


@router.get("/categories", response_model=list[CategoryStat])
def category_report(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
    month: Optional[str] = Query(None),
):
    """Shortcut for category breakdown only."""
    report = monthly_report(room_id, profile, db, month)
    return report.categories
