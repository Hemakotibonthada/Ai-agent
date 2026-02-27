"""
Authentication API Routes
Features: Login, register, token refresh, profile management, 2FA, API keys
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Header, Request, Depends
from pydantic import BaseModel

from services.auth_service import (
    AuthService, get_auth_service, UserCreate, UserLogin,
    UserProfile, TokenResponse, UserRole, TwoFactorSetup,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Helper ────────────────────────────────────────────────────────────
async def get_current_user(
    authorization: str = Header(None),
    auth: AuthService = Depends(get_auth_service),
) -> UserProfile:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        return await auth.get_current_user(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Registration ─────────────────────────────────────────────────────
@router.post("/register", response_model=UserProfile)
async def register(data: UserCreate, auth: AuthService = Depends(get_auth_service)):
    """Register a new user account."""
    try:
        return await auth.register(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Login ────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, auth: AuthService = Depends(get_auth_service)):
    """Authenticate and receive access/refresh tokens."""
    try:
        return await auth.login(data)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Token Refresh ────────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshRequest, auth: AuthService = Depends(get_auth_service)):
    """Refresh access token using refresh token."""
    try:
        return await auth.refresh_token(data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Current User ─────────────────────────────────────────────────────
@router.get("/me", response_model=UserProfile)
async def get_me(user: UserProfile = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return user


# ── Update Profile ───────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

@router.patch("/me", response_model=UserProfile)
async def update_profile(
    updates: ProfileUpdate,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Update current user profile."""
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}
    try:
        return await auth.update_profile(user.id, update_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Change Password ──────────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Change user password."""
    try:
        await auth.change_password(user.id, data.current_password, data.new_password)
        return {"message": "Password changed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Two-Factor Authentication ────────────────────────────────────────
@router.post("/2fa/setup", response_model=TwoFactorSetup)
async def setup_2fa(
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Set up two-factor authentication."""
    try:
        return await auth.enable_2fa(user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class Verify2FARequest(BaseModel):
    code: str

@router.post("/2fa/verify")
async def verify_2fa(
    data: Verify2FARequest,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Verify and enable 2FA."""
    result = await auth.confirm_2fa(user.id, data.code)
    if result:
        return {"message": "Two-factor authentication enabled"}
    raise HTTPException(status_code=400, detail="Invalid code")


# ── API Keys ─────────────────────────────────────────────────────────
class CreateAPIKeyRequest(BaseModel):
    name: str
    permissions: List[str] = []

@router.post("/api-keys")
async def create_api_key(
    data: CreateAPIKeyRequest,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Create a new API key."""
    return await auth.create_api_key(user.id, data.name, data.permissions)


@router.get("/api-keys")
async def list_api_keys(
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """List user's API keys."""
    return await auth.list_api_keys(user.id)


# ── Admin Routes ─────────────────────────────────────────────────────
@router.get("/users", response_model=List[UserProfile])
async def list_users(
    role: Optional[UserRole] = None,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """List all users (admin only)."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return await auth.list_users(role)


@router.get("/audit-log")
async def get_audit_log(
    user_id: Optional[str] = None,
    limit: int = 100,
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Get audit log entries (admin only)."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return await auth.get_audit_log(user_id, limit)


@router.get("/sessions")
async def get_sessions(
    user: UserProfile = Depends(get_current_user),
    auth: AuthService = Depends(get_auth_service),
):
    """Get active sessions."""
    return await auth.get_active_sessions()


# ── Password Strength Check ──────────────────────────────────────────
class PasswordCheckRequest(BaseModel):
    password: str

@router.post("/check-password")
async def check_password_strength(data: PasswordCheckRequest):
    """Check password strength without registering."""
    from services.auth_service import PasswordHasher
    return PasswordHasher.check_strength(data.password)
