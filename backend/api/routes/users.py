"""
User Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserRoleEnum(str, Enum):
    super_admin = "super_admin"
    admin = "admin"
    manager = "manager"
    editor = "editor"
    viewer = "viewer"
    api_user = "api_user"
    guest = "guest"


class UserStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"
    pending = "pending"
    locked = "locked"


class CreateUserRequest(BaseModel):
    username: str
    email: str
    display_name: str
    role: UserRoleEnum = UserRoleEnum.viewer
    password: Optional[str] = None
    department: str = ""
    title: str = ""


class UpdateUserRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class InviteRequest(BaseModel):
    email: str
    role: UserRoleEnum = UserRoleEnum.viewer
    expires_in_hours: int = 72


class AcceptInviteRequest(BaseModel):
    token: str
    username: str
    display_name: str
    password: str


class PermissionRequest(BaseModel):
    permission: str


class MFARequest(BaseModel):
    method: str = "totp"


class MFAVerifyRequest(BaseModel):
    code: str


def _get_service():
    from backend.services.user_management_service import get_user_management_service
    return get_user_management_service()


@router.get("/")
async def list_users(
    role: Optional[UserRoleEnum] = None,
    status: Optional[UserStatusEnum] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all users"""
    service = _get_service()
    from backend.services.user_management_service import UserRole, UserStatus
    return service.list_users(
        role=UserRole(role.value) if role else None,
        status=UserStatus(status.value) if status else None,
        department=department,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/stats")
async def get_user_stats():
    """Get user statistics"""
    service = _get_service()
    return service.get_stats()


@router.get("/audit-log")
async def get_audit_log(
    user_id: Optional[str] = None,
    limit: int = Query(50, le=200),
):
    """Get audit log entries"""
    service = _get_service()
    return service.get_audit_log(user_id=user_id, limit=limit)


@router.get("/{user_id}")
async def get_user(user_id: str):
    """Get a specific user"""
    service = _get_service()
    result = service.get_user(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.get("/{user_id}/permissions")
async def get_user_permissions(user_id: str):
    """Get a user's permissions"""
    service = _get_service()
    result = service.get_permissions(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.get("/{user_id}/sessions")
async def get_user_sessions(user_id: str):
    """Get a user's active sessions"""
    service = _get_service()
    return service.list_sessions(user_id)


@router.post("/")
async def create_user(request: CreateUserRequest):
    """Create a new user"""
    service = _get_service()
    from backend.services.user_management_service import UserRole
    result, error = service.create_user(
        username=request.username,
        email=request.email,
        display_name=request.display_name,
        role=UserRole(request.role.value),
        password=request.password,
        department=request.department,
        title=request.title,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.put("/{user_id}")
async def update_user(user_id: str, request: UpdateUserRequest):
    """Update a user"""
    service = _get_service()
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    result, error = service.update_user(user_id, updates)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.delete("/{user_id}")
async def delete_user(user_id: str):
    """Delete a user"""
    service = _get_service()
    if not service.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted"}


@router.post("/login")
async def login(request: LoginRequest):
    """Authenticate a user"""
    service = _get_service()
    result, error = service.authenticate(request.username_or_email, request.password)
    if error:
        raise HTTPException(status_code=401, detail=error)
    return result


@router.post("/{user_id}/change-password")
async def change_password(user_id: str, request: ChangePasswordRequest):
    """Change a user's password"""
    service = _get_service()
    success, error = service.change_password(user_id, request.old_password, request.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=error)
    return {"status": "password_changed"}


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str):
    """Reset a user's password (admin)"""
    service = _get_service()
    password, error = service.reset_password(user_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {"temporary_password": password}


@router.post("/{user_id}/permissions/grant")
async def grant_permission(user_id: str, request: PermissionRequest):
    """Grant a permission to a user"""
    service = _get_service()
    if not service.grant_permission(user_id, request.permission):
        raise HTTPException(status_code=400, detail="Failed to grant permission")
    return {"status": "granted"}


@router.post("/{user_id}/permissions/revoke")
async def revoke_permission(user_id: str, request: PermissionRequest):
    """Revoke a permission from a user"""
    service = _get_service()
    if not service.revoke_permission(user_id, request.permission):
        raise HTTPException(status_code=400, detail="Failed to revoke permission")
    return {"status": "revoked"}


@router.post("/{user_id}/mfa/enable")
async def enable_mfa(user_id: str, request: MFARequest):
    """Enable MFA for a user"""
    service = _get_service()
    result = service.enable_mfa(user_id, method=request.method)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@router.post("/{user_id}/mfa/verify")
async def verify_mfa(user_id: str, request: MFAVerifyRequest):
    """Verify MFA code"""
    service = _get_service()
    if not service.verify_mfa(user_id, request.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    return {"status": "verified"}


@router.post("/{user_id}/mfa/disable")
async def disable_mfa(user_id: str):
    """Disable MFA for a user"""
    service = _get_service()
    if not service.disable_mfa(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "disabled"}


@router.delete("/{user_id}/sessions/{session_id}")
async def terminate_session(user_id: str, session_id: str):
    """Terminate a specific session"""
    service = _get_service()
    if not service.terminate_session(user_id, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "terminated"}


@router.delete("/{user_id}/sessions")
async def terminate_all_sessions(user_id: str):
    """Terminate all sessions for a user"""
    service = _get_service()
    count = service.terminate_all_sessions(user_id)
    return {"terminated": count}


@router.post("/invites")
async def create_invite(request: InviteRequest):
    """Create a user invite"""
    service = _get_service()
    from backend.services.user_management_service import UserRole
    return service.create_invite(
        email=request.email,
        role=UserRole(request.role.value),
        created_by="admin",
        expires_in_hours=request.expires_in_hours,
    )


@router.post("/invites/accept")
async def accept_invite(request: AcceptInviteRequest):
    """Accept an invite and create account"""
    service = _get_service()
    result, error = service.accept_invite(
        token=request.token,
        username=request.username,
        display_name=request.display_name,
        password=request.password,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result
