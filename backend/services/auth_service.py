"""
Authentication & Authorization Service
Features: JWT tokens, password hashing, role-based access, OAuth2 flow, 2FA support
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field

# ── Constants ────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", secrets.token_urlsafe(64))
REFRESH_SECRET = os.getenv("AUTH_REFRESH_SECRET", secrets.token_urlsafe(64))
ACCESS_TOKEN_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
ALGORITHM = "HS256"
BCRYPT_ROUNDS = 12
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)


# ── Enums ────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"
    DEMO = "demo"
    API = "api"


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    API_KEY = "api_key"
    RESET = "password_reset"
    EMAIL_VERIFY = "email_verify"
    TWO_FACTOR = "two_factor"


# ── Models ───────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8)
    display_name: Optional[str] = None
    role: UserRole = UserRole.USER


class UserLogin(BaseModel):
    username: str
    password: str
    two_factor_code: Optional[str] = None


class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    role: UserRole
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_verified: bool = False
    two_factor_enabled: bool = False
    created_at: str
    last_login: Optional[str] = None
    preferences: Dict[str, Any] = {}
    permissions: List[str] = []


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfile


class TokenPayload(BaseModel):
    sub: str  # user id
    username: str
    role: UserRole
    type: TokenType
    permissions: List[str] = []
    exp: int
    iat: int
    jti: str  # unique token id


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class TwoFactorSetup(BaseModel):
    secret: str
    qr_code_url: str
    backup_codes: List[str]


class APIKey(BaseModel):
    id: str
    name: str
    key_prefix: str
    permissions: List[str]
    created_at: str
    expires_at: Optional[str] = None
    last_used: Optional[str] = None
    is_active: bool = True


# ── Password Hashing ────────────────────────────────────────────────
class PasswordHasher:
    """Argon2-like password hashing using PBKDF2 (no external deps)."""

    ITERATIONS = 600_000  # OWASP recommendation for PBKDF2-SHA256

    @staticmethod
    def hash_password(password: str) -> str:
        salt = secrets.token_hex(32)
        key = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), PasswordHasher.ITERATIONS
        )
        return f"pbkdf2:sha256:{PasswordHasher.ITERATIONS}${salt}${key.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        try:
            parts = password_hash.split("$")
            if len(parts) != 3:
                return False
            header, salt, stored_key = parts
            iterations = int(header.split(":")[-1])
            key = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations
            )
            return hmac.compare_digest(key.hex(), stored_key)
        except Exception:
            return False

    @staticmethod
    def check_strength(password: str) -> Dict[str, Any]:
        issues: List[str] = []
        score = 0
        if len(password) >= 8:
            score += 1
        else:
            issues.append("At least 8 characters required")
        if len(password) >= 12:
            score += 1
        if any(c.isupper() for c in password):
            score += 1
        else:
            issues.append("Add uppercase letter")
        if any(c.islower() for c in password):
            score += 1
        else:
            issues.append("Add lowercase letter")
        if any(c.isdigit() for c in password):
            score += 1
        else:
            issues.append("Add a number")
        if any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
            score += 1
        else:
            issues.append("Add a special character")

        strength = "weak" if score < 3 else "fair" if score < 4 else "good" if score < 5 else "strong"
        return {"score": score, "max_score": 6, "strength": strength, "issues": issues}


# ── Token Management ─────────────────────────────────────────────────
class TokenManager:
    """JWT token creation and validation using built-in hmac."""

    @staticmethod
    def _base64url_encode(data: bytes) -> str:
        import base64
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    @staticmethod
    def _base64url_decode(data: str) -> bytes:
        import base64
        padding = 4 - len(data) % 4
        if padding != 4:
            data += "=" * padding
        return base64.urlsafe_b64decode(data)

    @staticmethod
    def _create_jwt(payload: Dict[str, Any], secret: str) -> str:
        import json
        header = {"alg": "HS256", "typ": "JWT"}
        header_b64 = TokenManager._base64url_encode(json.dumps(header, separators=(",", ":")).encode())
        payload_b64 = TokenManager._base64url_encode(json.dumps(payload, separators=(",", ":")).encode())
        message = f"{header_b64}.{payload_b64}"
        signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
        sig_b64 = TokenManager._base64url_encode(signature)
        return f"{message}.{sig_b64}"

    @staticmethod
    def _verify_jwt(token: str, secret: str) -> Optional[Dict[str, Any]]:
        import json
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            header_b64, payload_b64, sig_b64 = parts
            message = f"{header_b64}.{payload_b64}"
            expected_sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
            actual_sig = TokenManager._base64url_decode(sig_b64)
            if not hmac.compare_digest(expected_sig, actual_sig):
                return None
            payload = json.loads(TokenManager._base64url_decode(payload_b64))
            if payload.get("exp", 0) < time.time():
                return None
            return payload
        except Exception:
            return None

    @staticmethod
    def create_access_token(user: UserProfile) -> str:
        now = int(time.time())
        payload = {
            "sub": user.id,
            "username": user.username,
            "role": user.role.value,
            "type": TokenType.ACCESS.value,
            "permissions": user.permissions,
            "exp": now + ACCESS_TOKEN_EXPIRE * 60,
            "iat": now,
            "jti": secrets.token_urlsafe(16),
        }
        return TokenManager._create_jwt(payload, SECRET_KEY)

    @staticmethod
    def create_refresh_token(user: UserProfile) -> str:
        now = int(time.time())
        payload = {
            "sub": user.id,
            "username": user.username,
            "role": user.role.value,
            "type": TokenType.REFRESH.value,
            "exp": now + REFRESH_TOKEN_EXPIRE * 86400,
            "iat": now,
            "jti": secrets.token_urlsafe(16),
        }
        return TokenManager._create_jwt(payload, REFRESH_SECRET)

    @staticmethod
    def verify_access_token(token: str) -> Optional[TokenPayload]:
        payload = TokenManager._verify_jwt(token, SECRET_KEY)
        if not payload or payload.get("type") != TokenType.ACCESS.value:
            return None
        return TokenPayload(**payload)

    @staticmethod
    def verify_refresh_token(token: str) -> Optional[TokenPayload]:
        payload = TokenManager._verify_jwt(token, REFRESH_SECRET)
        if not payload or payload.get("type") != TokenType.REFRESH.value:
            return None
        return TokenPayload(**payload)

    @staticmethod
    def create_reset_token(user_id: str) -> str:
        now = int(time.time())
        payload = {
            "sub": user_id,
            "username": "",
            "role": "user",
            "type": TokenType.RESET.value,
            "exp": now + 3600,  # 1 hour
            "iat": now,
            "jti": secrets.token_urlsafe(16),
        }
        return TokenManager._create_jwt(payload, SECRET_KEY)

    @staticmethod
    def create_api_key() -> tuple[str, str]:
        key = secrets.token_urlsafe(48)
        prefix = key[:8]
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        return key, prefix, key_hash  # type: ignore


# ── Two-Factor Authentication ────────────────────────────────────────
class TwoFactorAuth:
    """TOTP-based two-factor authentication."""

    @staticmethod
    def generate_secret() -> str:
        return secrets.token_hex(20)

    @staticmethod
    def generate_totp(secret: str, timestamp: Optional[int] = None) -> str:
        if timestamp is None:
            timestamp = int(time.time())
        counter = timestamp // 30
        msg = counter.to_bytes(8, "big")
        h = hmac.new(bytes.fromhex(secret), msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        code = ((h[offset] & 0x7F) << 24 | h[offset + 1] << 16 | h[offset + 2] << 8 | h[offset + 3]) % 1_000_000
        return str(code).zfill(6)

    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        now = int(time.time())
        for offset in [-1, 0, 1]:
            if TwoFactorAuth.generate_totp(secret, now + offset * 30) == code:
                return True
        return False

    @staticmethod
    def generate_backup_codes(count: int = 10) -> List[str]:
        return [secrets.token_hex(4).upper() for _ in range(count)]


# ── Rate Limiter ─────────────────────────────────────────────────────
class RateLimiter:
    """In-memory rate limiter with sliding window."""

    def __init__(self):
        self._windows: Dict[str, List[float]] = {}
        self._locked: Dict[str, float] = {}

    def check_rate_limit(self, key: str, max_requests: int = 60, window_seconds: int = 60) -> tuple[bool, int]:
        now = time.time()

        # Check lockout
        if key in self._locked:
            if now < self._locked[key]:
                return False, 0
            del self._locked[key]

        # Clean old entries
        if key not in self._windows:
            self._windows[key] = []
        self._windows[key] = [t for t in self._windows[key] if now - t < window_seconds]

        remaining = max_requests - len(self._windows[key])
        if remaining <= 0:
            return False, 0

        self._windows[key].append(now)
        return True, remaining - 1

    def lock_account(self, key: str, duration: timedelta = LOCKOUT_DURATION):
        self._locked[key] = time.time() + duration.total_seconds()

    def is_locked(self, key: str) -> bool:
        if key in self._locked:
            if time.time() < self._locked[key]:
                return True
            del self._locked[key]
        return False

    def reset(self, key: str):
        self._windows.pop(key, None)
        self._locked.pop(key, None)


# ── Permission System ────────────────────────────────────────────────
class Permissions:
    """Role-based permission definitions."""

    ROLE_PERMISSIONS: Dict[UserRole, List[str]] = {
        UserRole.ADMIN: [
            "admin:all",
            "users:read", "users:write", "users:delete",
            "agents:read", "agents:write", "agents:admin",
            "tasks:read", "tasks:write", "tasks:delete",
            "reports:read", "reports:write", "reports:export",
            "settings:read", "settings:write",
            "system:read", "system:write", "system:admin",
            "home:read", "home:write", "home:admin",
            "health:read", "health:write",
            "finance:read", "finance:write",
            "chat:read", "chat:write",
            "vision:read", "vision:write",
            "voice:read", "voice:write",
            "network:read", "network:write",
            "models:read", "models:write", "models:train",
            "api_keys:read", "api_keys:write",
            "audit:read",
        ],
        UserRole.USER: [
            "agents:read", "agents:write",
            "tasks:read", "tasks:write",
            "reports:read", "reports:write",
            "settings:read", "settings:write",
            "home:read", "home:write",
            "health:read", "health:write",
            "finance:read", "finance:write",
            "chat:read", "chat:write",
            "vision:read",
            "voice:read", "voice:write",
            "network:read",
            "models:read",
        ],
        UserRole.VIEWER: [
            "agents:read",
            "tasks:read",
            "reports:read",
            "settings:read",
            "home:read",
            "health:read",
            "finance:read",
            "chat:read",
            "vision:read",
            "network:read",
            "models:read",
        ],
        UserRole.DEMO: [
            "agents:read",
            "tasks:read",
            "reports:read",
            "home:read",
            "health:read",
            "finance:read",
            "chat:read",
            "models:read",
        ],
        UserRole.API: [
            "agents:read", "agents:write",
            "tasks:read", "tasks:write",
            "system:read",
        ],
    }

    @staticmethod
    def get_permissions(role: UserRole) -> List[str]:
        return Permissions.ROLE_PERMISSIONS.get(role, [])

    @staticmethod
    def has_permission(user_permissions: List[str], required: str) -> bool:
        if "admin:all" in user_permissions:
            return True
        return required in user_permissions

    @staticmethod
    def has_any_permission(user_permissions: List[str], required: List[str]) -> bool:
        return any(Permissions.has_permission(user_permissions, p) for p in required)


# ── Auth Service ─────────────────────────────────────────────────────
class AuthService:
    """Main authentication service orchestrating all auth operations."""

    def __init__(self):
        self.hasher = PasswordHasher()
        self.tokens = TokenManager()
        self.rate_limiter = RateLimiter()
        self.two_factor = TwoFactorAuth()
        self._users: Dict[str, Dict[str, Any]] = {}
        self._login_attempts: Dict[str, int] = {}
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._api_keys: Dict[str, APIKey] = {}
        self._audit_log: List[Dict[str, Any]] = []

        # Create default admin
        self._create_default_admin()

    def _create_default_admin(self):
        admin_id = "admin-001"
        if admin_id not in self._users:
            self._users[admin_id] = {
                "id": admin_id,
                "username": "admin",
                "email": "admin@nexus.ai",
                "password_hash": self.hasher.hash_password("Admin@2024!"),
                "display_name": "System Admin",
                "role": UserRole.ADMIN,
                "is_active": True,
                "is_verified": True,
                "two_factor_enabled": False,
                "two_factor_secret": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": None,
                "preferences": {"theme": "dark", "language": "en", "notifications": True},
                "avatar_url": None,
            }

        # Create demo user
        demo_id = "demo-001"
        if demo_id not in self._users:
            self._users[demo_id] = {
                "id": demo_id,
                "username": "demo",
                "email": "demo@nexus.ai",
                "password_hash": self.hasher.hash_password("demo1234"),
                "display_name": "Demo User",
                "role": UserRole.DEMO,
                "is_active": True,
                "is_verified": True,
                "two_factor_enabled": False,
                "two_factor_secret": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_login": None,
                "preferences": {"theme": "dark", "language": "en"},
                "avatar_url": None,
            }

    def _get_user_profile(self, user_data: Dict[str, Any]) -> UserProfile:
        role = user_data["role"]
        return UserProfile(
            id=user_data["id"],
            username=user_data["username"],
            email=user_data["email"],
            display_name=user_data.get("display_name", user_data["username"]),
            role=role,
            avatar_url=user_data.get("avatar_url"),
            is_active=user_data.get("is_active", True),
            is_verified=user_data.get("is_verified", False),
            two_factor_enabled=user_data.get("two_factor_enabled", False),
            created_at=user_data["created_at"],
            last_login=user_data.get("last_login"),
            preferences=user_data.get("preferences", {}),
            permissions=Permissions.get_permissions(role),
        )

    def _log_audit(self, event: str, user_id: str, details: Dict[str, Any] | None = None):
        self._audit_log.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "user_id": user_id,
            "details": details or {},
        })
        # Keep last 10000 entries
        if len(self._audit_log) > 10000:
            self._audit_log = self._audit_log[-10000:]

    async def register(self, data: UserCreate) -> UserProfile:
        # Check if username or email exists
        for u in self._users.values():
            if u["username"] == data.username:
                raise ValueError("Username already exists")
            if u["email"] == data.email:
                raise ValueError("Email already registered")

        # Check password strength
        strength = self.hasher.check_strength(data.password)
        if strength["score"] < 3:
            raise ValueError(f"Password too weak: {', '.join(strength['issues'])}")

        user_id = f"user-{secrets.token_hex(8)}"
        user_data = {
            "id": user_id,
            "username": data.username,
            "email": data.email,
            "password_hash": self.hasher.hash_password(data.password),
            "display_name": data.display_name or data.username,
            "role": data.role,
            "is_active": True,
            "is_verified": False,
            "two_factor_enabled": False,
            "two_factor_secret": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None,
            "preferences": {"theme": "dark", "language": "en", "notifications": True},
            "avatar_url": None,
        }
        self._users[user_id] = user_data
        self._log_audit("user.registered", user_id)
        return self._get_user_profile(user_data)

    async def login(self, data: UserLogin) -> TokenResponse:
        # Rate limit check
        allowed, remaining = self.rate_limiter.check_rate_limit(f"login:{data.username}", max_requests=MAX_LOGIN_ATTEMPTS, window_seconds=900)
        if not allowed:
            self._log_audit("login.rate_limited", data.username)
            raise ValueError("Too many login attempts. Please try again later.")

        # Find user
        user_data = None
        for u in self._users.values():
            if u["username"] == data.username:
                user_data = u
                break

        if not user_data:
            raise ValueError("Invalid credentials")

        if not user_data["is_active"]:
            raise ValueError("Account is disabled")

        # Verify password
        if not self.hasher.verify_password(data.password, user_data["password_hash"]):
            attempts = self._login_attempts.get(data.username, 0) + 1
            self._login_attempts[data.username] = attempts
            if attempts >= MAX_LOGIN_ATTEMPTS:
                self.rate_limiter.lock_account(f"login:{data.username}")
                self._log_audit("login.locked", user_data["id"])
            self._log_audit("login.failed", user_data["id"])
            raise ValueError("Invalid credentials")

        # Check 2FA if enabled
        if user_data.get("two_factor_enabled") and user_data.get("two_factor_secret"):
            if not data.two_factor_code:
                raise ValueError("Two-factor code required")
            if not self.two_factor.verify_totp(user_data["two_factor_secret"], data.two_factor_code):
                raise ValueError("Invalid two-factor code")

        # Success
        self._login_attempts.pop(data.username, None)
        user_data["last_login"] = datetime.now(timezone.utc).isoformat()

        profile = self._get_user_profile(user_data)
        access_token = self.tokens.create_access_token(profile)
        refresh_token = self.tokens.create_refresh_token(profile)

        # Track session
        self._sessions[profile.id] = {
            "user_id": profile.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
            "ip": "127.0.0.1",
        }

        self._log_audit("login.success", user_data["id"])

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=ACCESS_TOKEN_EXPIRE * 60,
            user=profile,
        )

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        payload = self.tokens.verify_refresh_token(refresh_token)
        if not payload:
            raise ValueError("Invalid refresh token")

        user_data = self._users.get(payload.sub)
        if not user_data:
            raise ValueError("User not found")
        if not user_data["is_active"]:
            raise ValueError("Account is disabled")

        profile = self._get_user_profile(user_data)
        new_access = self.tokens.create_access_token(profile)
        new_refresh = self.tokens.create_refresh_token(profile)

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            expires_in=ACCESS_TOKEN_EXPIRE * 60,
            user=profile,
        )

    async def get_current_user(self, token: str) -> UserProfile:
        payload = self.tokens.verify_access_token(token)
        if not payload:
            raise ValueError("Invalid or expired token")

        user_data = self._users.get(payload.sub)
        if not user_data:
            raise ValueError("User not found")
        if not user_data["is_active"]:
            raise ValueError("Account is disabled")

        return self._get_user_profile(user_data)

    async def update_profile(self, user_id: str, updates: Dict[str, Any]) -> UserProfile:
        if user_id not in self._users:
            raise ValueError("User not found")

        allowed_fields = {"display_name", "avatar_url", "preferences"}
        for key, val in updates.items():
            if key in allowed_fields:
                self._users[user_id][key] = val

        self._log_audit("profile.updated", user_id, updates)
        return self._get_user_profile(self._users[user_id])

    async def change_password(self, user_id: str, current_password: str, new_password: str):
        user_data = self._users.get(user_id)
        if not user_data:
            raise ValueError("User not found")
        if not self.hasher.verify_password(current_password, user_data["password_hash"]):
            raise ValueError("Current password is incorrect")

        strength = self.hasher.check_strength(new_password)
        if strength["score"] < 3:
            raise ValueError(f"Password too weak: {', '.join(strength['issues'])}")

        user_data["password_hash"] = self.hasher.hash_password(new_password)
        self._log_audit("password.changed", user_id)

    async def enable_2fa(self, user_id: str) -> TwoFactorSetup:
        user_data = self._users.get(user_id)
        if not user_data:
            raise ValueError("User not found")

        secret = self.two_factor.generate_secret()
        backup_codes = self.two_factor.generate_backup_codes()
        user_data["two_factor_secret"] = secret
        user_data["_backup_codes"] = backup_codes

        self._log_audit("2fa.enabled", user_id)
        return TwoFactorSetup(
            secret=secret,
            qr_code_url=f"otpauth://totp/NexusAI:{user_data['username']}?secret={secret}&issuer=NexusAI",
            backup_codes=backup_codes,
        )

    async def confirm_2fa(self, user_id: str, code: str) -> bool:
        user_data = self._users.get(user_id)
        if not user_data or not user_data.get("two_factor_secret"):
            raise ValueError("2FA not set up")

        if self.two_factor.verify_totp(user_data["two_factor_secret"], code):
            user_data["two_factor_enabled"] = True
            self._log_audit("2fa.confirmed", user_id)
            return True
        return False

    async def list_users(self, role: Optional[UserRole] = None) -> List[UserProfile]:
        users = list(self._users.values())
        if role:
            users = [u for u in users if u["role"] == role]
        return [self._get_user_profile(u) for u in users]

    async def get_audit_log(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        logs = self._audit_log
        if user_id:
            logs = [l for l in logs if l["user_id"] == user_id]
        return logs[-limit:]

    async def create_api_key(self, user_id: str, name: str, permissions: List[str]) -> Dict[str, str]:
        key, prefix, key_hash = self.tokens.create_api_key()
        api_key = APIKey(
            id=f"ak-{secrets.token_hex(8)}",
            name=name,
            key_prefix=prefix,
            permissions=permissions,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._api_keys[key_hash] = api_key
        self._log_audit("api_key.created", user_id, {"name": name})
        return {"key": key, "id": api_key.id, "prefix": prefix}

    async def list_api_keys(self, user_id: str) -> List[APIKey]:
        return list(self._api_keys.values())

    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        return list(self._sessions.values())


# ── Singleton ────────────────────────────────────────────────────────
_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
