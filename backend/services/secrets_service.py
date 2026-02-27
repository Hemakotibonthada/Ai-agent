"""
Secrets & Credentials Vault Service for Nexus AI
Secure secrets management with encryption, rotation, and access control
"""

import asyncio
import hashlib
import json
import os
import secrets as secrets_module
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from base64 import b64encode, b64decode


class SecretType(str, Enum):
    API_KEY = "api_key"
    PASSWORD = "password"
    TOKEN = "token"
    CERTIFICATE = "certificate"
    SSH_KEY = "ssh_key"
    DATABASE_URL = "database_url"
    OAUTH_SECRET = "oauth_secret"
    ENCRYPTION_KEY = "encryption_key"
    WEBHOOK_SECRET = "webhook_secret"
    GENERIC = "generic"


class SecretScope(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"
    SERVICE = "service"
    USER = "user"
    ENVIRONMENT = "environment"


class RotationPolicy(str, Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"
    CUSTOM = "custom"


class AccessLevel(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    ROTATE = "rotate"


class EncryptionAlgorithm(str, Enum):
    AES_256_GCM = "aes-256-gcm"
    AES_256_CBC = "aes-256-cbc"
    CHACHA20_POLY1305 = "chacha20-poly1305"
    RSA_4096 = "rsa-4096"


@dataclass
class SecretVersion:
    version: int
    created_at: datetime
    created_by: str
    is_current: bool = True
    expires_at: Optional[datetime] = None
    checksum: str = ""

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        if self.expires_at:
            d["expires_at"] = self.expires_at.isoformat()
        return d


@dataclass
class SecretAccessPolicy:
    allowed_users: List[str] = field(default_factory=list)
    allowed_services: List[str] = field(default_factory=list)
    allowed_ips: List[str] = field(default_factory=list)
    max_reads_per_hour: int = 100
    require_mfa: bool = False
    time_restricted: bool = False
    allowed_hours_start: int = 0
    allowed_hours_end: int = 24

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class SecretAuditEntry:
    timestamp: datetime
    action: str
    user: str
    ip_address: str
    success: bool
    details: str = ""

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d


@dataclass
class Secret:
    id: str
    name: str
    secret_type: SecretType
    scope: SecretScope
    description: str = ""
    encrypted_value: str = ""
    encryption_algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM
    rotation_policy: RotationPolicy = RotationPolicy.NONE
    rotation_days: int = 0
    last_rotated: Optional[datetime] = None
    next_rotation: Optional[datetime] = None
    versions: List[SecretVersion] = field(default_factory=list)
    access_policy: Optional[SecretAccessPolicy] = None
    audit_log: List[SecretAuditEntry] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    project: str = ""
    service: str = ""
    environment: str = "production"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: str = ""
    is_active: bool = True
    expires_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        for k in ["last_rotated", "next_rotation", "created_at", "updated_at", "expires_at"]:
            if d[k] and isinstance(d[k], datetime):
                d[k] = d[k].isoformat()
        # Never expose the actual encrypted value in listings
        d["encrypted_value"] = "***REDACTED***"
        d["versions"] = [v if isinstance(v, dict) else v for v in d["versions"]]
        return d


@dataclass
class SecretFolder:
    name: str
    path: str
    secrets_count: int = 0
    subfolders: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.created_at:
            d["created_at"] = self.created_at.isoformat()
        return d


class SecretsVaultService:
    """Enterprise-grade secrets management with encryption and rotation"""

    def __init__(self):
        self.secrets: Dict[str, Secret] = {}
        self.folders: Dict[str, SecretFolder] = {}
        self._master_key: str = ""
        self._event_handlers: Dict[str, List] = {}
        self._initialized = False
        self._access_count: Dict[str, int] = {}

    async def initialize(self):
        """Initialize the secrets vault"""
        if self._initialized:
            return
        self._master_key = secrets_module.token_hex(32)
        await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        """Create sample secrets"""
        now = datetime.now()
        sample_secrets = [
            Secret(
                id="sec-001", name="OPENAI_API_KEY", secret_type=SecretType.API_KEY,
                scope=SecretScope.SERVICE, description="OpenAI API key for GPT-4 access",
                encrypted_value=self._encrypt("sk-proj-xxxx...redacted"),
                rotation_policy=RotationPolicy.QUARTERLY, rotation_days=90,
                last_rotated=now - timedelta(days=45), next_rotation=now + timedelta(days=45),
                tags=["ai", "openai", "production"], service="ai-service",
                environment="production", created_at=now - timedelta(days=180),
                updated_at=now - timedelta(days=45), created_by="admin",
                versions=[SecretVersion(version=3, created_at=now - timedelta(days=45),
                                        created_by="rotation-bot")],
                access_policy=SecretAccessPolicy(
                    allowed_services=["ai-service", "ml-worker"],
                    max_reads_per_hour=500,
                ),
            ),
            Secret(
                id="sec-002", name="DATABASE_URL", secret_type=SecretType.DATABASE_URL,
                scope=SecretScope.PROJECT, description="Primary PostgreSQL connection string",
                encrypted_value=self._encrypt("postgresql://nexus:xxx@db:5432/nexus"),
                rotation_policy=RotationPolicy.MONTHLY, rotation_days=30,
                last_rotated=now - timedelta(days=20), next_rotation=now + timedelta(days=10),
                tags=["database", "postgresql", "production"], project="nexus-core",
                environment="production", created_at=now - timedelta(days=365),
                updated_at=now - timedelta(days=20), created_by="admin",
                versions=[SecretVersion(version=12, created_at=now - timedelta(days=20),
                                        created_by="rotation-bot")],
            ),
            Secret(
                id="sec-003", name="JWT_SECRET", secret_type=SecretType.ENCRYPTION_KEY,
                scope=SecretScope.GLOBAL, description="JWT signing secret for auth tokens",
                encrypted_value=self._encrypt(secrets_module.token_hex(32)),
                rotation_policy=RotationPolicy.ANNUALLY, rotation_days=365,
                last_rotated=now - timedelta(days=100), next_rotation=now + timedelta(days=265),
                tags=["auth", "jwt", "security"], environment="production",
                created_at=now - timedelta(days=500), updated_at=now - timedelta(days=100),
                created_by="admin",
                versions=[SecretVersion(version=2, created_at=now - timedelta(days=100),
                                        created_by="admin")],
                access_policy=SecretAccessPolicy(require_mfa=True, allowed_services=["auth-service"]),
            ),
            Secret(
                id="sec-004", name="GITHUB_TOKEN", secret_type=SecretType.TOKEN,
                scope=SecretScope.SERVICE, description="GitHub personal access token",
                encrypted_value=self._encrypt("ghp_xxxx...redacted"),
                rotation_policy=RotationPolicy.QUARTERLY, rotation_days=90,
                last_rotated=now - timedelta(days=80), next_rotation=now + timedelta(days=10),
                tags=["github", "ci-cd", "scm"], service="git-service",
                environment="production", created_at=now - timedelta(days=200),
                updated_at=now - timedelta(days=80), created_by="admin",
            ),
            Secret(
                id="sec-005", name="SMTP_PASSWORD", secret_type=SecretType.PASSWORD,
                scope=SecretScope.SERVICE, description="SMTP server password for email service",
                encrypted_value=self._encrypt("smtp-pass-xxx"),
                rotation_policy=RotationPolicy.MONTHLY, rotation_days=30,
                last_rotated=now - timedelta(days=25), next_rotation=now + timedelta(days=5),
                tags=["email", "smtp"], service="email-service",
                environment="production", created_at=now - timedelta(days=120),
                updated_at=now - timedelta(days=25), created_by="admin",
            ),
            Secret(
                id="sec-006", name="REDIS_PASSWORD", secret_type=SecretType.PASSWORD,
                scope=SecretScope.SERVICE, description="Redis cache authentication password",
                encrypted_value=self._encrypt("redis-secure-pass"),
                rotation_policy=RotationPolicy.MONTHLY, rotation_days=30,
                last_rotated=now - timedelta(days=15), next_rotation=now + timedelta(days=15),
                tags=["redis", "cache"], service="cache-service",
                environment="production", created_at=now - timedelta(days=90),
                updated_at=now - timedelta(days=15), created_by="admin",
            ),
            Secret(
                id="sec-007", name="WEBHOOK_SIGNING_SECRET", secret_type=SecretType.WEBHOOK_SECRET,
                scope=SecretScope.SERVICE, description="Webhook payload signing secret",
                encrypted_value=self._encrypt("whsec_xxx"),
                tags=["webhook", "signing"], service="webhook-service",
                environment="production", created_at=now - timedelta(days=60),
                updated_at=now - timedelta(days=60), created_by="admin",
            ),
            Secret(
                id="sec-008", name="TLS_PRIVATE_KEY", secret_type=SecretType.CERTIFICATE,
                scope=SecretScope.GLOBAL, description="TLS private key for HTTPS",
                encrypted_value=self._encrypt("-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----"),
                encryption_algorithm=EncryptionAlgorithm.RSA_4096,
                rotation_policy=RotationPolicy.ANNUALLY, rotation_days=365,
                last_rotated=now - timedelta(days=200), next_rotation=now + timedelta(days=165),
                tags=["tls", "ssl", "certificate"], environment="production",
                created_at=now - timedelta(days=400), updated_at=now - timedelta(days=200),
                created_by="security-admin",
                access_policy=SecretAccessPolicy(
                    require_mfa=True,
                    allowed_services=["nginx", "api-gateway"],
                    max_reads_per_hour=10,
                ),
            ),
            Secret(
                id="sec-009", name="SSH_DEPLOY_KEY", secret_type=SecretType.SSH_KEY,
                scope=SecretScope.PROJECT, description="SSH key for deployment automation",
                encrypted_value=self._encrypt("-----BEGIN OPENSSH PRIVATE KEY-----\nxxx\n-----END OPENSSH PRIVATE KEY-----"),
                tags=["ssh", "deploy", "automation"], project="nexus-infra",
                environment="production", created_at=now - timedelta(days=150),
                updated_at=now - timedelta(days=150), created_by="devops-admin",
            ),
            Secret(
                id="sec-010", name="STRIPE_SECRET_KEY", secret_type=SecretType.API_KEY,
                scope=SecretScope.SERVICE, description="Stripe payment processing secret key",
                encrypted_value=self._encrypt("sk_live_xxx"),
                rotation_policy=RotationPolicy.QUARTERLY, rotation_days=90,
                last_rotated=now - timedelta(days=60), next_rotation=now + timedelta(days=30),
                tags=["stripe", "payments", "billing"], service="billing-service",
                environment="production", created_at=now - timedelta(days=300),
                updated_at=now - timedelta(days=60), created_by="admin",
                access_policy=SecretAccessPolicy(
                    require_mfa=True,
                    allowed_services=["billing-service"],
                    max_reads_per_hour=50,
                ),
            ),
        ]

        for secret in sample_secrets:
            self.secrets[secret.id] = secret

        # Create folders
        folders = [
            SecretFolder("Production", "/production", 6, ["api-keys", "database", "auth"]),
            SecretFolder("API Keys", "/production/api-keys", 3),
            SecretFolder("Database", "/production/database", 2),
            SecretFolder("Auth", "/production/auth", 1),
            SecretFolder("Staging", "/staging", 4),
            SecretFolder("Development", "/development", 2),
        ]
        for folder in folders:
            folder.created_at = now - timedelta(days=365)
            self.folders[folder.path] = folder

    def _encrypt(self, value: str) -> str:
        """Simple encryption simulation (in production, use proper encryption)"""
        encoded = b64encode(value.encode()).decode()
        return f"enc:v1:{encoded}"

    def _decrypt(self, encrypted_value: str) -> str:
        """Simple decryption simulation"""
        if encrypted_value.startswith("enc:v1:"):
            encoded = encrypted_value[7:]
            return b64decode(encoded).decode()
        return encrypted_value

    # Secret CRUD
    async def list_secrets(self, scope: Optional[SecretScope] = None,
                           secret_type: Optional[SecretType] = None,
                           environment: Optional[str] = None,
                           service: Optional[str] = None,
                           tag: Optional[str] = None) -> List[Dict]:
        """List all secrets with optional filters (values redacted)"""
        result = list(self.secrets.values())
        if scope:
            result = [s for s in result if s.scope == scope]
        if secret_type:
            result = [s for s in result if s.secret_type == secret_type]
        if environment:
            result = [s for s in result if s.environment == environment]
        if service:
            result = [s for s in result if s.service == service]
        if tag:
            result = [s for s in result if tag in s.tags]
        return [s.to_dict() for s in result]

    async def get_secret(self, secret_id: str, reveal: bool = False) -> Optional[Dict]:
        """Get secret details (optionally reveal value)"""
        secret = self.secrets.get(secret_id)
        if not secret:
            return None

        d = secret.to_dict()
        if reveal:
            d["encrypted_value"] = self._decrypt(secret.encrypted_value)
            # Log the access
            secret.audit_log.append(SecretAuditEntry(
                timestamp=datetime.now(), action="reveal",
                user="current_user", ip_address="127.0.0.1", success=True,
            ))
        return d

    async def create_secret(self, name: str, value: str, secret_type: SecretType,
                            scope: SecretScope = SecretScope.SERVICE,
                            description: str = "", tags: List[str] = None,
                            service: str = "", environment: str = "production",
                            rotation_policy: RotationPolicy = RotationPolicy.NONE,
                            rotation_days: int = 0) -> Dict:
        """Create a new secret"""
        secret_id = f"sec-{hashlib.md5(name.encode()).hexdigest()[:6]}"
        now = datetime.now()

        secret = Secret(
            id=secret_id, name=name, secret_type=secret_type,
            scope=scope, description=description,
            encrypted_value=self._encrypt(value),
            rotation_policy=rotation_policy, rotation_days=rotation_days,
            tags=tags or [], service=service, environment=environment,
            created_at=now, updated_at=now, created_by="current_user",
            versions=[SecretVersion(version=1, created_at=now, created_by="current_user")],
        )

        if rotation_days > 0:
            secret.last_rotated = now
            secret.next_rotation = now + timedelta(days=rotation_days)

        self.secrets[secret_id] = secret
        await self._emit_event("secret_created", {"id": secret_id, "name": name})
        return secret.to_dict()

    async def update_secret(self, secret_id: str, new_value: str) -> Optional[Dict]:
        """Update a secret's value (creates new version)"""
        secret = self.secrets.get(secret_id)
        if not secret:
            return None

        now = datetime.now()
        # Mark all existing versions as non-current
        for v in secret.versions:
            if isinstance(v, SecretVersion):
                v.is_current = False

        new_version = max((v.version if isinstance(v, SecretVersion) else v.get("version", 0))
                          for v in secret.versions) + 1 if secret.versions else 1

        secret.versions.append(SecretVersion(
            version=new_version, created_at=now,
            created_by="current_user", is_current=True,
        ))
        secret.encrypted_value = self._encrypt(new_value)
        secret.updated_at = now

        secret.audit_log.append(SecretAuditEntry(
            timestamp=now, action="update", user="current_user",
            ip_address="127.0.0.1", success=True,
            details=f"Updated to version {new_version}",
        ))

        await self._emit_event("secret_updated", {"id": secret_id, "version": new_version})
        return secret.to_dict()

    async def delete_secret(self, secret_id: str) -> bool:
        """Delete a secret"""
        if secret_id in self.secrets:
            secret = self.secrets[secret_id]
            secret.audit_log.append(SecretAuditEntry(
                timestamp=datetime.now(), action="delete",
                user="current_user", ip_address="127.0.0.1", success=True,
            ))
            del self.secrets[secret_id]
            await self._emit_event("secret_deleted", {"id": secret_id})
            return True
        return False

    async def rotate_secret(self, secret_id: str) -> Optional[Dict]:
        """Rotate a secret (generate new value)"""
        secret = self.secrets.get(secret_id)
        if not secret:
            return None

        now = datetime.now()
        new_value = secrets_module.token_urlsafe(32)
        await self.update_secret(secret_id, new_value)

        secret.last_rotated = now
        if secret.rotation_days > 0:
            secret.next_rotation = now + timedelta(days=secret.rotation_days)

        secret.audit_log.append(SecretAuditEntry(
            timestamp=now, action="rotate", user="rotation-bot",
            ip_address="127.0.0.1", success=True,
            details="Automatic rotation",
        ))

        await self._emit_event("secret_rotated", {"id": secret_id, "name": secret.name})
        return secret.to_dict()

    # Bulk Operations
    async def bulk_rotate(self, secret_ids: List[str] = None) -> Dict:
        """Rotate multiple secrets"""
        if secret_ids is None:
            # Find all secrets due for rotation
            now = datetime.now()
            secret_ids = [
                s.id for s in self.secrets.values()
                if s.next_rotation and s.next_rotation <= now
            ]

        results = {"rotated": [], "failed": [], "skipped": []}
        for sid in secret_ids:
            try:
                result = await self.rotate_secret(sid)
                if result:
                    results["rotated"].append(sid)
                else:
                    results["skipped"].append(sid)
            except Exception as e:
                results["failed"].append({"id": sid, "error": str(e)})

        return results

    async def export_secrets(self, format: str = "env", environment: str = "production") -> str:
        """Export secrets in various formats (values masked)"""
        env_secrets = [s for s in self.secrets.values() if s.environment == environment]

        if format == "env":
            lines = [f"# Nexus AI Secrets - {environment}"]
            lines.append(f"# Exported at: {datetime.now().isoformat()}")
            lines.append(f"# Total secrets: {len(env_secrets)}")
            lines.append("")
            for s in env_secrets:
                lines.append(f"# {s.description}")
                lines.append(f"{s.name}=***REDACTED***")
                lines.append("")
            return "\n".join(lines)
        elif format == "json":
            data = {
                "environment": environment,
                "exported_at": datetime.now().isoformat(),
                "secrets": {s.name: "***REDACTED***" for s in env_secrets},
            }
            return json.dumps(data, indent=2)
        elif format == "yaml":
            lines = [f"# Nexus AI Secrets - {environment}"]
            lines.append(f"environment: {environment}")
            lines.append("secrets:")
            for s in env_secrets:
                lines.append(f"  {s.name}: '***REDACTED***'  # {s.description}")
            return "\n".join(lines)
        return ""

    # Audit
    async def get_audit_log(self, secret_id: Optional[str] = None,
                            action: Optional[str] = None,
                            limit: int = 50) -> List[Dict]:
        """Get audit log entries"""
        entries = []
        if secret_id:
            secret = self.secrets.get(secret_id)
            if secret:
                entries = [e.to_dict() if isinstance(e, SecretAuditEntry) else e
                           for e in secret.audit_log]
        else:
            for secret in self.secrets.values():
                for e in secret.audit_log:
                    entry = e.to_dict() if isinstance(e, SecretAuditEntry) else e
                    entry["secret_id"] = secret.id
                    entry["secret_name"] = secret.name
                    entries.append(entry)

        if action:
            entries = [e for e in entries if e.get("action") == action]

        entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return entries[:limit]

    # Folders
    async def list_folders(self) -> List[Dict]:
        """List all secret folders"""
        return [f.to_dict() for f in self.folders.values()]

    async def create_folder(self, name: str, parent_path: str = "/") -> Dict:
        """Create a new folder"""
        path = f"{parent_path.rstrip('/')}/{name}"
        folder = SecretFolder(name=name, path=path, created_at=datetime.now())
        self.folders[path] = folder
        return folder.to_dict()

    # Policies & Compliance
    async def check_compliance(self) -> Dict:
        """Check secrets compliance status"""
        now = datetime.now()
        total = len(self.secrets)
        expired = len([s for s in self.secrets.values()
                       if s.expires_at and s.expires_at < now])
        rotation_due = len([s for s in self.secrets.values()
                            if s.next_rotation and s.next_rotation <= now])
        no_rotation = len([s for s in self.secrets.values()
                           if s.rotation_policy == RotationPolicy.NONE])
        no_policy = len([s for s in self.secrets.values()
                         if s.access_policy is None])
        mfa_enforced = len([s for s in self.secrets.values()
                            if s.access_policy and s.access_policy.require_mfa])

        score = 100
        if expired > 0:
            score -= expired * 15
        if rotation_due > 0:
            score -= rotation_due * 10
        if no_rotation > 0:
            score -= min(20, no_rotation * 3)
        if no_policy > 0:
            score -= min(15, no_policy * 2)
        score = max(0, score)

        return {
            "compliance_score": score,
            "total_secrets": total,
            "expired_secrets": expired,
            "rotation_due": rotation_due,
            "no_rotation_policy": no_rotation,
            "no_access_policy": no_policy,
            "mfa_enforced": mfa_enforced,
            "recommendations": [
                "Enable rotation for all secrets" if no_rotation > 0 else None,
                "Set access policies for unprotected secrets" if no_policy > 0 else None,
                "Rotate secrets that are due" if rotation_due > 0 else None,
                "Remove or renew expired secrets" if expired > 0 else None,
                "Enable MFA for critical secrets" if mfa_enforced < total * 0.5 else None,
            ],
            "checked_at": datetime.now().isoformat(),
        }

    async def get_summary(self) -> Dict:
        """Get vault summary"""
        now = datetime.now()
        return {
            "total_secrets": len(self.secrets),
            "active_secrets": len([s for s in self.secrets.values() if s.is_active]),
            "by_type": {t.value: len([s for s in self.secrets.values() if s.secret_type == t])
                        for t in SecretType},
            "by_scope": {sc.value: len([s for s in self.secrets.values() if s.scope == sc])
                         for sc in SecretScope},
            "rotation_due_soon": len([s for s in self.secrets.values()
                                      if s.next_rotation and s.next_rotation <= now + timedelta(days=7)]),
            "total_versions": sum(len(s.versions) for s in self.secrets.values()),
            "folders": len(self.folders),
        }

    async def _emit_event(self, event_type: str, data: Any):
        handlers = self._event_handlers.get(event_type, [])
        for handler in handlers:
            try:
                await handler(data)
            except Exception:
                pass

    def on_event(self, event_type: str, handler):
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)
