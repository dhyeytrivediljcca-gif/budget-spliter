"""Profile and auth endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user_id, get_current_profile
from app.models.user import Profile
from app.schemas.schemas import ProfileCreate, ProfileUpdate, ProfileOut

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: ProfileCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    existing = db.query(Profile).filter(Profile.id == user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists")
    profile = Profile(id=user_id, **body.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/me", response_model=ProfileOut)
def get_my_profile(profile: Profile = Depends(get_current_profile)):
    return profile


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    body: ProfileUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
