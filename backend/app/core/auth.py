"""
JWT verification for Supabase Auth tokens.

Supabase uses HS256 JWTs signed with the project's JWT secret.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import Profile

security = HTTPBearer(auto_error=False)
settings = get_settings()


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase JWT or allow local development demo tokens."""
    # Support instant local demo/development tokens
    if token.startswith("demo-token") or token.startswith("dev-token"):
        user_id = token.replace("demo-token-", "").replace("dev-token-", "")
        if not user_id or user_id in ("demo-token", "dev-token"):
            user_id = "demo-roomie-001"
        return {"sub": user_id, "email": f"{user_id}@roomiesplit.local"}

    if not settings.supabase_jwt_secret:
        # In local development without secret, decode unverified or fallback
        try:
            return jwt.decode(token, "", options={"verify_signature": False, "verify_aud": False})
        except Exception:
            return {"sub": token, "email": "user@roomiesplit.local"}

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    claims = verify_supabase_token(credentials.credentials)
    user_id: str = claims.get("sub", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )
    return user_id


def get_current_profile(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Profile:
    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Please complete onboarding.",
        )
    return profile
