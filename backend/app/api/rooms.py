"""Room management endpoints."""
import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_profile
from app.models.user import Room, RoomMember, RoomInvitation, Profile, AuditLog
from app.schemas.schemas import (
    RoomCreate, RoomUpdate, RoomOut,
    InvitationCreate, InvitationOut, JoinRoomRequest,
    MemberOut, MemberRoleUpdate, ProfileOut,
)
from app.services.calculations import rupees_to_paise

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _assert_leader(room_id: str, user_id: str, db: Session):
    member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id,
        RoomMember.status == "active",
    ).first()
    if not member:
        raise HTTPException(403, "Not a member of this room")
    if member.role != "leader":
        raise HTTPException(403, "Leader permission required")
    return member


def _assert_member(room_id: str, user_id: str, db: Session):
    member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user_id,
        RoomMember.status == "active",
    ).first()
    if not member:
        raise HTTPException(403, "Not an active member of this room")
    return member


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("", response_model=RoomOut, status_code=201)
def create_room(
    body: RoomCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    room = Room(
        name=body.name,
        currency=body.currency,
        monthly_budget_paise=rupees_to_paise(body.monthly_budget),
        budget_start_day=body.budget_start_day,
        created_by=profile.id,
    )
    db.add(room)
    db.flush()

    membership = RoomMember(
        room_id=room.id,
        user_id=profile.id,
        role="leader",
        status="active",
    )
    db.add(membership)
    db.commit()
    db.refresh(room)
    return RoomOut.from_orm_obj(room)


@router.get("", response_model=list[RoomOut])
def list_my_rooms(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    memberships = db.query(RoomMember).filter(
        RoomMember.user_id == profile.id,
        RoomMember.status == "active",
    ).all()
    rooms = [db.query(Room).get(m.room_id) for m in memberships]
    return [RoomOut.from_orm_obj(r) for r in rooms if r]


@router.get("/{room_id}", response_model=RoomOut)
def get_room(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)
    room = db.query(Room).get(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    return RoomOut.from_orm_obj(room)


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: str,
    body: RoomUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    room = db.query(Room).get(room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    if body.name is not None:
        room.name = body.name
    if body.monthly_budget is not None:
        room.monthly_budget_paise = rupees_to_paise(body.monthly_budget)
    if body.budget_start_day is not None:
        room.budget_start_day = body.budget_start_day
    db.commit()
    db.refresh(room)
    return RoomOut.from_orm_obj(room)


# ─── Invitations ─────────────────────────────────────────────────────────────

@router.post("/{room_id}/invitations", response_model=InvitationOut, status_code=201)
def create_invitation(
    room_id: str,
    body: InvitationCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    raw_token = secrets.token_urlsafe(32)
    invite = RoomInvitation(
        room_id=room_id,
        token_hash=_token_hash(raw_token),
        created_by=profile.id,
        expires_at=datetime.utcnow() + timedelta(hours=body.expires_hours),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return InvitationOut(
        id=invite.id,
        room_id=invite.room_id,
        token=raw_token,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


@router.post("/join", status_code=200)
def join_room(
    body: JoinRoomRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    token_hash = _token_hash(body.token)
    invite = db.query(RoomInvitation).filter(
        RoomInvitation.token_hash == token_hash,
    ).first()

    if not invite:
        raise HTTPException(404, "Invalid invitation code")
    if invite.revoked_at:
        raise HTTPException(410, "Invitation has been revoked")
    if invite.used_at and invite.used_by:
        # single-use invitation
        raise HTTPException(410, "Invitation has already been used")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(410, "Invitation has expired")

    existing = db.query(RoomMember).filter(
        RoomMember.room_id == invite.room_id,
        RoomMember.user_id == profile.id,
    ).first()

    if existing:
        if existing.status == "active":
            raise HTTPException(409, "Already a member of this room")
        existing.status = "active"
        existing.role = "member"
    else:
        membership = RoomMember(
            room_id=invite.room_id,
            user_id=profile.id,
            role="member",
            status="active",
        )
        db.add(membership)

    invite.used_by = profile.id
    invite.used_at = datetime.utcnow()
    db.commit()
    return {"room_id": invite.room_id, "message": "Joined successfully"}


# ─── Members ─────────────────────────────────────────────────────────────────

@router.get("/{room_id}/members", response_model=list[MemberOut])
def list_members(
    room_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_member(room_id, profile.id, db)
    members = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.status == "active",
    ).all()
    return members


@router.patch("/{room_id}/members/{member_id}", response_model=MemberOut)
def update_member_role(
    room_id: str,
    member_id: str,
    body: MemberRoleUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    target = db.query(RoomMember).filter(
        RoomMember.id == member_id,
        RoomMember.room_id == room_id,
    ).first()
    if not target:
        raise HTTPException(404, "Member not found")
    target.role = body.role
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{room_id}/members/{member_id}", status_code=204)
def remove_member(
    room_id: str,
    member_id: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    target = db.query(RoomMember).filter(
        RoomMember.id == member_id,
        RoomMember.room_id == room_id,
        RoomMember.status == "active",
    ).first()
    if not target:
        raise HTTPException(404, "Member not found")
    if target.user_id == profile.id:
        raise HTTPException(400, "Cannot remove yourself")
    # Check there's still at least one leader
    leaders = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.role == "leader",
        RoomMember.status == "active",
        RoomMember.id != member_id,
    ).count()
    if target.role == "leader" and leaders == 0:
        raise HTTPException(400, "Cannot remove the only leader")
    target.status = "removed"
    db.commit()
    return None


@router.post("/{room_id}/transfer-leadership", status_code=200)
def transfer_leadership(
    room_id: str,
    body: dict,  # {new_leader_id: str}
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    _assert_leader(room_id, profile.id, db)
    new_leader_id = body.get("new_leader_id")
    if not new_leader_id:
        raise HTTPException(400, "new_leader_id required")

    new_leader_member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == new_leader_id,
        RoomMember.status == "active",
    ).first()
    if not new_leader_member:
        raise HTTPException(404, "Target user is not an active member")

    # Demote current user
    my_membership = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == profile.id,
    ).first()
    my_membership.role = "member"
    new_leader_member.role = "leader"
    db.commit()
    return {"message": "Leadership transferred"}
