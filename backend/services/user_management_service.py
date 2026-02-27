"""
User Management Service for Nexus AI
Role-based access control, user lifecycle, and permissions
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    MANAGER = "manager"
    EDITOR = "editor"
    VIEWER = "viewer"
    API_USER = "api_user"
    GUEST = "guest"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"
    LOCKED = "locked"
    DEACTIVATED = "deactivated"


class Permission(str, Enum):
    # Agent permissions
    AGENTS_VIEW = "agents:view"
    AGENTS_CREATE = "agents:create"
    AGENTS_EDIT = "agents:edit"
    AGENTS_DELETE = "agents:delete"
    AGENTS_EXECUTE = "agents:execute"

    # Task permissions
    TASKS_VIEW = "tasks:view"
    TASKS_CREATE = "tasks:create"
    TASKS_EDIT = "tasks:edit"
    TASKS_DELETE = "tasks:delete"
    TASKS_ASSIGN = "tasks:assign"

    # Report permissions
    REPORTS_VIEW = "reports:view"
    REPORTS_CREATE = "reports:create"
    REPORTS_EXPORT = "reports:export"

    # System permissions
    SYSTEM_SETTINGS = "system:settings"
    SYSTEM_LOGS = "system:logs"
    SYSTEM_BACKUP = "system:backup"
    SYSTEM_RESTORE = "system:restore"

    # User management permissions
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_EDIT = "users:edit"
    USERS_DELETE = "users:delete"
    USERS_ROLES = "users:roles"

    # Data permissions
    DATA_VIEW = "data:view"
    DATA_EXPORT = "data:export"
    DATA_IMPORT = "data:import"
    DATA_DELETE = "data:delete"

    # API permissions
    API_KEYS_VIEW = "api_keys:view"
    API_KEYS_CREATE = "api_keys:create"
    API_KEYS_REVOKE = "api_keys:revoke"

    # Integration permissions
    INTEGRATIONS_VIEW = "integrations:view"
    INTEGRATIONS_MANAGE = "integrations:manage"

    # Analytics permissions
    ANALYTICS_VIEW = "analytics:view"
    ANALYTICS_EXPORT = "analytics:export"


# Role-permission mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.SUPER_ADMIN: set(Permission),  # All permissions
    UserRole.ADMIN: {
        Permission.AGENTS_VIEW, Permission.AGENTS_CREATE, Permission.AGENTS_EDIT,
        Permission.AGENTS_DELETE, Permission.AGENTS_EXECUTE,
        Permission.TASKS_VIEW, Permission.TASKS_CREATE, Permission.TASKS_EDIT,
        Permission.TASKS_DELETE, Permission.TASKS_ASSIGN,
        Permission.REPORTS_VIEW, Permission.REPORTS_CREATE, Permission.REPORTS_EXPORT,
        Permission.SYSTEM_SETTINGS, Permission.SYSTEM_LOGS, Permission.SYSTEM_BACKUP,
        Permission.USERS_VIEW, Permission.USERS_CREATE, Permission.USERS_EDIT,
        Permission.DATA_VIEW, Permission.DATA_EXPORT, Permission.DATA_IMPORT,
        Permission.API_KEYS_VIEW, Permission.API_KEYS_CREATE,
        Permission.INTEGRATIONS_VIEW, Permission.INTEGRATIONS_MANAGE,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
    },
    UserRole.MANAGER: {
        Permission.AGENTS_VIEW, Permission.AGENTS_CREATE, Permission.AGENTS_EDIT,
        Permission.AGENTS_EXECUTE,
        Permission.TASKS_VIEW, Permission.TASKS_CREATE, Permission.TASKS_EDIT, Permission.TASKS_ASSIGN,
        Permission.REPORTS_VIEW, Permission.REPORTS_CREATE, Permission.REPORTS_EXPORT,
        Permission.USERS_VIEW,
        Permission.DATA_VIEW, Permission.DATA_EXPORT,
        Permission.ANALYTICS_VIEW, Permission.ANALYTICS_EXPORT,
    },
    UserRole.EDITOR: {
        Permission.AGENTS_VIEW, Permission.AGENTS_EDIT, Permission.AGENTS_EXECUTE,
        Permission.TASKS_VIEW, Permission.TASKS_CREATE, Permission.TASKS_EDIT,
        Permission.REPORTS_VIEW, Permission.REPORTS_CREATE,
        Permission.DATA_VIEW,
        Permission.ANALYTICS_VIEW,
    },
    UserRole.VIEWER: {
        Permission.AGENTS_VIEW,
        Permission.TASKS_VIEW,
        Permission.REPORTS_VIEW,
        Permission.DATA_VIEW,
        Permission.ANALYTICS_VIEW,
    },
    UserRole.API_USER: {
        Permission.AGENTS_VIEW, Permission.AGENTS_EXECUTE,
        Permission.TASKS_VIEW, Permission.TASKS_CREATE,
        Permission.DATA_VIEW,
        Permission.API_KEYS_VIEW,
    },
    UserRole.GUEST: {
        Permission.AGENTS_VIEW,
        Permission.REPORTS_VIEW,
    },
}


@dataclass
class UserPreferences:
    theme: str = "dark"
    language: str = "en"
    timezone: str = "UTC"
    date_format: str = "YYYY-MM-DD"
    notifications_email: bool = True
    notifications_push: bool = True
    notifications_sound: bool = True
    dashboard_layout: str = "default"
    items_per_page: int = 25
    default_view: str = "dashboard"


@dataclass
class UserSession:
    session_id: str
    ip_address: str
    user_agent: str
    created_at: str
    last_active: str
    is_current: bool = False
    location: str = ""
    device_type: str = "desktop"


@dataclass
class MFAConfig:
    enabled: bool = False
    method: str = "totp"  # totp, sms, email, hardware_key
    verified: bool = False
    backup_codes_remaining: int = 10
    last_verified: Optional[str] = None
    trusted_devices: List[str] = field(default_factory=list)


@dataclass
class User:
    user_id: str
    username: str
    email: str
    display_name: str
    avatar_url: str
    role: UserRole
    status: UserStatus
    password_hash: str
    created_at: str
    updated_at: str
    last_login: Optional[str]
    department: str = ""
    title: str = ""
    phone: str = ""
    bio: str = ""
    preferences: UserPreferences = field(default_factory=UserPreferences)
    mfa: MFAConfig = field(default_factory=MFAConfig)
    sessions: List[UserSession] = field(default_factory=list)
    custom_permissions: Set[Permission] = field(default_factory=set)
    denied_permissions: Set[Permission] = field(default_factory=set)
    api_key_count: int = 0
    login_count: int = 0
    failed_login_count: int = 0
    last_password_change: Optional[str] = None
    password_expires_at: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_permissions(self) -> Set[Permission]:
        """Get effective permissions combining role and custom permissions"""
        base_permissions = ROLE_PERMISSIONS.get(self.role, set())
        effective = (base_permissions | self.custom_permissions) - self.denied_permissions
        return effective

    def has_permission(self, permission: Permission) -> bool:
        return permission in self.get_permissions()


@dataclass
class AuditEntry:
    entry_id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: str
    timestamp: str
    ip_address: str
    success: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InviteToken:
    token: str
    email: str
    role: UserRole
    created_by: str
    created_at: str
    expires_at: str
    used: bool = False
    used_at: Optional[str] = None


class UserManagementService:
    """Comprehensive user management service"""

    def __init__(self):
        self.users: Dict[str, User] = {}
        self.audit_log: List[AuditEntry] = []
        self.invites: Dict[str, InviteToken] = {}
        self._email_index: Dict[str, str] = {}
        self._username_index: Dict[str, str] = {}
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample users"""
        sample_users = [
            User(
                user_id="usr_001", username="admin", email="admin@nexus.ai",
                display_name="System Admin", avatar_url="/avatars/admin.png",
                role=UserRole.SUPER_ADMIN, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"admin_password").hexdigest(),
                created_at="2024-01-01T00:00:00Z", updated_at="2024-03-20T10:00:00Z",
                last_login="2024-03-20T14:00:00Z",
                department="Engineering", title="System Administrator",
                mfa=MFAConfig(enabled=True, verified=True, last_verified="2024-03-20T08:00:00Z"),
                sessions=[
                    UserSession("sess_001", "10.0.1.100", "Chrome/122", "2024-03-20T08:00:00Z", "2024-03-20T14:30:00Z", True, "HQ Office"),
                ],
                login_count=450, api_key_count=3,
                tags={"team": "platform"},
            ),
            User(
                user_id="usr_002", username="sarah.chen", email="sarah@nexus.ai",
                display_name="Sarah Chen", avatar_url="/avatars/sarah.png",
                role=UserRole.ADMIN, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"sarah_password").hexdigest(),
                created_at="2024-01-10T09:00:00Z", updated_at="2024-03-19T16:00:00Z",
                last_login="2024-03-20T09:15:00Z",
                department="Engineering", title="DevOps Lead",
                mfa=MFAConfig(enabled=True, verified=True, backup_codes_remaining=8),
                sessions=[
                    UserSession("sess_002", "10.0.1.105", "Firefox/123", "2024-03-20T09:15:00Z", "2024-03-20T14:00:00Z", True, "HQ Office"),
                ],
                login_count=280, api_key_count=2,
                tags={"team": "devops"},
            ),
            User(
                user_id="usr_003", username="marcus.johnson", email="marcus@nexus.ai",
                display_name="Marcus Johnson", avatar_url="/avatars/marcus.png",
                role=UserRole.MANAGER, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"marcus_password").hexdigest(),
                created_at="2024-01-15T10:00:00Z", updated_at="2024-03-18T14:00:00Z",
                last_login="2024-03-20T10:30:00Z",
                department="Product", title="Product Manager",
                mfa=MFAConfig(enabled=True, verified=True),
                login_count=195, api_key_count=1,
                tags={"team": "product"},
            ),
            User(
                user_id="usr_004", username="emily.wang", email="emily@nexus.ai",
                display_name="Emily Wang", avatar_url="/avatars/emily.png",
                role=UserRole.EDITOR, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"emily_password").hexdigest(),
                created_at="2024-02-01T08:00:00Z", updated_at="2024-03-20T11:00:00Z",
                last_login="2024-03-20T11:00:00Z",
                department="Data Science", title="ML Engineer",
                mfa=MFAConfig(enabled=False),
                login_count=156, api_key_count=2,
                tags={"team": "ml"},
            ),
            User(
                user_id="usr_005", username="david.kim", email="david@nexus.ai",
                display_name="David Kim", avatar_url="/avatars/david.png",
                role=UserRole.EDITOR, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"david_password").hexdigest(),
                created_at="2024-02-10T10:00:00Z", updated_at="2024-03-17T09:00:00Z",
                last_login="2024-03-20T08:45:00Z",
                department="Engineering", title="Frontend Developer",
                mfa=MFAConfig(enabled=True, verified=True),
                login_count=210,
                tags={"team": "frontend"},
            ),
            User(
                user_id="usr_006", username="linda.martinez", email="linda@nexus.ai",
                display_name="Linda Martinez", avatar_url="/avatars/linda.png",
                role=UserRole.VIEWER, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"linda_password").hexdigest(),
                created_at="2024-02-20T14:00:00Z", updated_at="2024-03-15T10:00:00Z",
                last_login="2024-03-19T16:00:00Z",
                department="Marketing", title="Marketing Analyst",
                mfa=MFAConfig(enabled=False),
                login_count=89,
                tags={"team": "marketing"},
            ),
            User(
                user_id="usr_007", username="james.wilson", email="james@nexus.ai",
                display_name="James Wilson", avatar_url="/avatars/james.png",
                role=UserRole.API_USER, status=UserStatus.ACTIVE,
                password_hash=hashlib.sha256(b"james_password").hexdigest(),
                created_at="2024-03-01T11:00:00Z", updated_at="2024-03-20T09:00:00Z",
                last_login="2024-03-20T09:00:00Z",
                department="Engineering", title="Backend Developer",
                api_key_count=5, login_count=34,
                tags={"team": "backend"},
            ),
            User(
                user_id="usr_008", username="alex.patel", email="alex@nexus.ai",
                display_name="Alex Patel", avatar_url="/avatars/alex.png",
                role=UserRole.EDITOR, status=UserStatus.INACTIVE,
                password_hash=hashlib.sha256(b"alex_password").hexdigest(),
                created_at="2024-01-20T10:00:00Z", updated_at="2024-02-28T17:00:00Z",
                last_login="2024-02-28T17:00:00Z",
                department="Engineering", title="Senior Developer",
                login_count=120,
                tags={"team": "core", "status": "on_leave"},
            ),
            User(
                user_id="usr_009", username="bot_service", email="bot@nexus.ai",
                display_name="Bot Service Account", avatar_url="/avatars/bot.png",
                role=UserRole.API_USER, status=UserStatus.SUSPENDED,
                password_hash=hashlib.sha256(b"bot_password").hexdigest(),
                created_at="2024-01-05T08:00:00Z", updated_at="2024-03-10T14:00:00Z",
                last_login="2024-03-10T14:00:00Z",
                department="Automation", title="Service Account",
                api_key_count=8, login_count=12800,
                failed_login_count=45,
                metadata={"suspension_reason": "Unusual API access patterns detected"},
                tags={"type": "service_account"},
            ),
            User(
                user_id="usr_010", username="new_hire", email="newhire@nexus.ai",
                display_name="New Hire", avatar_url="/avatars/default.png",
                role=UserRole.VIEWER, status=UserStatus.PENDING,
                password_hash=hashlib.sha256(b"temp_password").hexdigest(),
                created_at="2024-03-20T10:00:00Z", updated_at="2024-03-20T10:00:00Z",
                last_login=None,
                department="Engineering", title="Junior Developer",
                login_count=0,
                tags={"onboarding": "in_progress"},
            ),
        ]

        for user in sample_users:
            self.users[user.user_id] = user
            self._email_index[user.email] = user.user_id
            self._username_index[user.username] = user.user_id

    # ---- User CRUD ----

    def list_users(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        department: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """List users with filtering"""
        results = list(self.users.values())

        if role:
            results = [u for u in results if u.role == role]
        if status:
            results = [u for u in results if u.status == status]
        if department:
            results = [u for u in results if u.department.lower() == department.lower()]
        if search:
            s = search.lower()
            results = [u for u in results if s in u.username.lower() or s in u.display_name.lower() or s in u.email.lower()]

        total = len(results)
        results.sort(key=lambda u: u.created_at, reverse=True)
        results = results[offset:offset + limit]

        return {
            "items": [self._user_to_dict(u) for u in results],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific user"""
        user = self.users.get(user_id)
        return self._user_to_dict(user, include_sessions=True) if user else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        uid = self._email_index.get(email)
        return self.get_user(uid) if uid else None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        uid = self._username_index.get(username)
        return self.get_user(uid) if uid else None

    def create_user(
        self,
        username: str,
        email: str,
        display_name: str,
        role: UserRole = UserRole.VIEWER,
        password: Optional[str] = None,
        department: str = "",
        title: str = "",
        created_by: str = "system",
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Create a new user"""
        if email in self._email_index:
            return None, "Email already in use"
        if username in self._username_index:
            return None, "Username already taken"

        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat() + "Z"

        if password is None:
            password = secrets.token_urlsafe(16)

        user = User(
            user_id=user_id, username=username, email=email,
            display_name=display_name, avatar_url="/avatars/default.png",
            role=role, status=UserStatus.PENDING,
            password_hash=hashlib.sha256(password.encode()).hexdigest(),
            created_at=now, updated_at=now, last_login=None,
            department=department, title=title,
        )

        self.users[user_id] = user
        self._email_index[email] = user_id
        self._username_index[username] = user_id

        self._add_audit("user_created", "user", user_id, f"User {username} created by {created_by}", created_by)

        result = self._user_to_dict(user)
        result["temporary_password"] = password
        return result, None

    def update_user(self, user_id: str, updates: Dict[str, Any], updated_by: str = "system") -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Update user properties"""
        user = self.users.get(user_id)
        if not user:
            return None, "User not found"

        if "email" in updates and updates["email"] != user.email:
            new_email = updates["email"]
            if new_email in self._email_index:
                return None, "Email already in use"
            del self._email_index[user.email]
            user.email = new_email
            self._email_index[new_email] = user_id

        if "username" in updates and updates["username"] != user.username:
            new_username = updates["username"]
            if new_username in self._username_index:
                return None, "Username already taken"
            del self._username_index[user.username]
            user.username = new_username
            self._username_index[new_username] = user_id

        updateable_fields = ["display_name", "department", "title", "phone", "bio", "avatar_url"]
        for field_name in updateable_fields:
            if field_name in updates:
                setattr(user, field_name, updates[field_name])

        if "role" in updates:
            old_role = user.role
            user.role = UserRole(updates["role"])
            self._add_audit("role_changed", "user", user_id, f"Role changed from {old_role.value} to {user.role.value}", updated_by)

        if "status" in updates:
            old_status = user.status
            user.status = UserStatus(updates["status"])
            self._add_audit("status_changed", "user", user_id, f"Status changed from {old_status.value} to {user.status.value}", updated_by)

        if "preferences" in updates:
            prefs = updates["preferences"]
            for k, v in prefs.items():
                if hasattr(user.preferences, k):
                    setattr(user.preferences, k, v)

        user.updated_at = datetime.utcnow().isoformat() + "Z"
        self._add_audit("user_updated", "user", user_id, f"User updated by {updated_by}", updated_by)

        return self._user_to_dict(user), None

    def delete_user(self, user_id: str, deleted_by: str = "system") -> bool:
        """Delete a user"""
        user = self.users.pop(user_id, None)
        if not user:
            return False

        self._email_index.pop(user.email, None)
        self._username_index.pop(user.username, None)
        self._add_audit("user_deleted", "user", user_id, f"User {user.username} deleted by {deleted_by}", deleted_by)
        return True

    # ---- Authentication ----

    def authenticate(self, username_or_email: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Authenticate a user"""
        user_id = self._username_index.get(username_or_email) or self._email_index.get(username_or_email)
        if not user_id:
            return None, "Invalid credentials"

        user = self.users[user_id]
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        if user.password_hash != password_hash:
            user.failed_login_count += 1
            if user.failed_login_count >= 5:
                user.status = UserStatus.LOCKED
                self._add_audit("account_locked", "user", user_id, "Account locked due to failed attempts", "system")
            return None, "Invalid credentials"

        if user.status != UserStatus.ACTIVE and user.status != UserStatus.PENDING:
            return None, f"Account is {user.status.value}"

        # Successful login
        now = datetime.utcnow().isoformat() + "Z"
        user.last_login = now
        user.login_count += 1
        user.failed_login_count = 0

        if user.status == UserStatus.PENDING:
            user.status = UserStatus.ACTIVE

        session = UserSession(
            session_id=f"sess_{secrets.token_hex(8)}",
            ip_address="10.0.1.100",
            user_agent="Unknown",
            created_at=now,
            last_active=now,
            is_current=True,
        )

        # Mark old sessions as not current
        for s in user.sessions:
            s.is_current = False
        user.sessions.append(session)

        self._add_audit("login", "user", user_id, "User logged in", user_id)

        return {
            "user": self._user_to_dict(user),
            "session_id": session.session_id,
            "permissions": [p.value for p in user.get_permissions()],
        }, None

    def change_password(self, user_id: str, old_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """Change user password"""
        user = self.users.get(user_id)
        if not user:
            return False, "User not found"

        old_hash = hashlib.sha256(old_password.encode()).hexdigest()
        if user.password_hash != old_hash:
            return False, "Current password is incorrect"

        user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        user.last_password_change = datetime.utcnow().isoformat() + "Z"
        user.password_expires_at = (datetime.utcnow() + timedelta(days=90)).isoformat() + "Z"

        self._add_audit("password_changed", "user", user_id, "Password changed", user_id)
        return True, None

    def reset_password(self, user_id: str, reset_by: str = "system") -> Tuple[Optional[str], Optional[str]]:
        """Reset user password (admin action)"""
        user = self.users.get(user_id)
        if not user:
            return None, "User not found"

        new_password = secrets.token_urlsafe(16)
        user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        user.last_password_change = datetime.utcnow().isoformat() + "Z"
        user.status = UserStatus.PENDING  # Force password change on login

        self._add_audit("password_reset", "user", user_id, f"Password reset by {reset_by}", reset_by)
        return new_password, None

    # ---- Session Management ----

    def list_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        user = self.users.get(user_id)
        if not user:
            return []
        return [asdict(s) for s in user.sessions]

    def terminate_session(self, user_id: str, session_id: str) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        user.sessions = [s for s in user.sessions if s.session_id != session_id]
        return True

    def terminate_all_sessions(self, user_id: str) -> int:
        user = self.users.get(user_id)
        if not user:
            return 0
        count = len(user.sessions)
        user.sessions.clear()
        return count

    # ---- Permission Management ----

    def get_permissions(self, user_id: str) -> Optional[Dict[str, Any]]:
        user = self.users.get(user_id)
        if not user:
            return None

        role_perms = ROLE_PERMISSIONS.get(user.role, set())
        effective = user.get_permissions()

        return {
            "role": user.role.value,
            "role_permissions": [p.value for p in sorted(role_perms, key=lambda p: p.value)],
            "custom_permissions": [p.value for p in sorted(user.custom_permissions, key=lambda p: p.value)],
            "denied_permissions": [p.value for p in sorted(user.denied_permissions, key=lambda p: p.value)],
            "effective_permissions": [p.value for p in sorted(effective, key=lambda p: p.value)],
            "total_permissions": len(effective),
        }

    def grant_permission(self, user_id: str, permission: str, granted_by: str = "system") -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        try:
            perm = Permission(permission)
            user.custom_permissions.add(perm)
            user.denied_permissions.discard(perm)
            self._add_audit("permission_granted", "user", user_id, f"{permission} granted by {granted_by}", granted_by)
            return True
        except ValueError:
            return False

    def revoke_permission(self, user_id: str, permission: str, revoked_by: str = "system") -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        try:
            perm = Permission(permission)
            user.denied_permissions.add(perm)
            user.custom_permissions.discard(perm)
            self._add_audit("permission_revoked", "user", user_id, f"{permission} revoked by {revoked_by}", revoked_by)
            return True
        except ValueError:
            return False

    # ---- Invite System ----

    def create_invite(self, email: str, role: UserRole, created_by: str, expires_in_hours: int = 72) -> Dict[str, Any]:
        token = secrets.token_urlsafe(32)
        now = datetime.utcnow()
        invite = InviteToken(
            token=token, email=email, role=role, created_by=created_by,
            created_at=now.isoformat() + "Z",
            expires_at=(now + timedelta(hours=expires_in_hours)).isoformat() + "Z",
        )
        self.invites[token] = invite
        self._add_audit("invite_created", "invite", token, f"Invite for {email} created by {created_by}", created_by)
        return asdict(invite)

    def accept_invite(self, token: str, username: str, display_name: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        invite = self.invites.get(token)
        if not invite:
            return None, "Invalid invite token"
        if invite.used:
            return None, "Invite already used"
        if datetime.fromisoformat(invite.expires_at.replace("Z", "+00:00")) < datetime.now():
            return None, "Invite expired"

        result, error = self.create_user(
            username=username, email=invite.email, display_name=display_name,
            role=invite.role, password=password, created_by=invite.created_by,
        )

        if error:
            return None, error

        invite.used = True
        invite.used_at = datetime.utcnow().isoformat() + "Z"
        return result, None

    # ---- MFA ----

    def enable_mfa(self, user_id: str, method: str = "totp") -> Optional[Dict[str, Any]]:
        user = self.users.get(user_id)
        if not user:
            return None

        user.mfa.enabled = True
        user.mfa.method = method
        user.mfa.verified = False
        user.mfa.backup_codes_remaining = 10

        self._add_audit("mfa_enabled", "user", user_id, f"MFA ({method}) enabled", user_id)

        return {
            "method": method,
            "setup_key": secrets.token_hex(20),
            "backup_codes": [secrets.token_hex(4) for _ in range(10)],
        }

    def verify_mfa(self, user_id: str, code: str) -> bool:
        user = self.users.get(user_id)
        if not user or not user.mfa.enabled:
            return False

        # Simplified verification - always accepts "000000" for demo
        if code == "000000" or len(code) == 6:
            user.mfa.verified = True
            user.mfa.last_verified = datetime.utcnow().isoformat() + "Z"
            return True
        return False

    def disable_mfa(self, user_id: str, disabled_by: str = "system") -> bool:
        user = self.users.get(user_id)
        if not user:
            return False

        user.mfa = MFAConfig()
        self._add_audit("mfa_disabled", "user", user_id, f"MFA disabled by {disabled_by}", disabled_by)
        return True

    # ---- Statistics ----

    def get_stats(self) -> Dict[str, Any]:
        all_users = list(self.users.values())
        active = [u for u in all_users if u.status == UserStatus.ACTIVE]
        admins = [u for u in all_users if u.role in (UserRole.SUPER_ADMIN, UserRole.ADMIN)]
        mfa_enabled = [u for u in active if u.mfa.enabled]

        return {
            "total_users": len(all_users),
            "active_users": len(active),
            "admin_count": len(admins),
            "mfa_percentage": round(len(mfa_enabled) / max(len(active), 1) * 100, 1),
            "by_role": {r.value: len([u for u in all_users if u.role == r]) for r in UserRole},
            "by_status": {s.value: len([u for u in all_users if u.status == s]) for s in UserStatus},
            "by_department": self._count_by_field(all_users, "department"),
            "total_sessions": sum(len(u.sessions) for u in all_users),
            "total_logins": sum(u.login_count for u in all_users),
            "pending_invites": len([i for i in self.invites.values() if not i.used]),
            "recent_audit_count": len(self.audit_log),
        }

    def get_audit_log(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        entries = self.audit_log
        if user_id:
            entries = [e for e in entries if e.user_id == user_id]
        entries = sorted(entries, key=lambda e: e.timestamp, reverse=True)[:limit]
        return [asdict(e) for e in entries]

    # ---- Helpers ----

    def _add_audit(self, action: str, resource_type: str, resource_id: str, details: str, actor: str):
        entry = AuditEntry(
            entry_id=f"aud_{uuid.uuid4().hex[:8]}",
            user_id=actor,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            timestamp=datetime.utcnow().isoformat() + "Z",
            ip_address="10.0.1.100",
            success=True,
        )
        self.audit_log.append(entry)

    @staticmethod
    def _count_by_field(users: List[User], field_name: str) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for u in users:
            val = getattr(u, field_name, "Unknown") or "Unknown"
            counts[val] = counts.get(val, 0) + 1
        return counts

    def _user_to_dict(self, user: User, include_sessions: bool = False) -> Dict[str, Any]:
        result = {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "role": user.role.value,
            "status": user.status.value,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "last_login": user.last_login,
            "department": user.department,
            "title": user.title,
            "phone": user.phone,
            "bio": user.bio,
            "mfa_enabled": user.mfa.enabled,
            "mfa_verified": user.mfa.verified,
            "api_key_count": user.api_key_count,
            "login_count": user.login_count,
            "session_count": len(user.sessions),
            "permissions_count": len(user.get_permissions()),
            "tags": user.tags,
        }
        if include_sessions:
            result["sessions"] = [asdict(s) for s in user.sessions]
            result["preferences"] = asdict(user.preferences)
            result["permissions"] = [p.value for p in sorted(user.get_permissions(), key=lambda p: p.value)]

        return result


# Singleton instance
_user_service: Optional[UserManagementService] = None


def get_user_management_service() -> UserManagementService:
    global _user_service
    if _user_service is None:
        _user_service = UserManagementService()
    return _user_service
