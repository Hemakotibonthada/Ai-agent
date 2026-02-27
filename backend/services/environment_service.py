"""
Environment Variable Management Service for Nexus AI
Manage environment configs across multiple deployment environments
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from services.demo_data_manager import is_demo_data_enabled


class EnvironmentType(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"
    CI_CD = "ci_cd"
    PREVIEW = "preview"


class VarSource(str, Enum):
    MANUAL = "manual"
    VAULT = "vault"
    CONFIG_MAP = "config_map"
    AWS_SSM = "aws_ssm"
    AZURE_KEY_VAULT = "azure_key_vault"
    GCP_SECRET_MANAGER = "gcp_secret_manager"
    DOTENV = "dotenv"


class VarType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    JSON = "json"
    URL = "url"
    SECRET = "secret"
    PATH = "path"


@dataclass
class EnvVariable:
    key: str
    value: str
    var_type: VarType = VarType.STRING
    source: VarSource = VarSource.MANUAL
    description: str = ""
    is_secret: bool = False
    is_required: bool = True
    default_value: str = ""
    validation_regex: str = ""
    tags: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: str = ""
    override_in: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.is_secret:
            d["value"] = "***REDACTED***"
        for k in ["created_at", "updated_at"]:
            if d[k] and isinstance(d[k], datetime):
                d[k] = d[k].isoformat()
        return d


@dataclass
class Environment:
    id: str
    name: str
    env_type: EnvironmentType
    description: str = ""
    variables: Dict[str, EnvVariable] = field(default_factory=dict)
    inherits_from: Optional[str] = None
    is_locked: bool = False
    is_active: bool = True
    deploy_url: str = ""
    region: str = ""
    version: str = ""
    last_deployed: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by: str = ""
    labels: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = {
            "id": self.id,
            "name": self.name,
            "env_type": self.env_type.value if isinstance(self.env_type, EnvironmentType) else self.env_type,
            "description": self.description,
            "variables_count": len(self.variables),
            "secrets_count": len([v for v in self.variables.values() if v.is_secret]),
            "inherits_from": self.inherits_from,
            "is_locked": self.is_locked,
            "is_active": self.is_active,
            "deploy_url": self.deploy_url,
            "region": self.region,
            "version": self.version,
            "labels": self.labels,
        }
        for k in ["last_deployed", "created_at"]:
            val = getattr(self, k)
            d[k] = val.isoformat() if val else None
        return d


@dataclass
class EnvDiff:
    key: str
    action: str  # added, removed, modified, unchanged
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    is_secret: bool = False

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.is_secret:
            d["old_value"] = "***" if self.old_value else None
            d["new_value"] = "***" if self.new_value else None
        return d


@dataclass
class EnvTemplate:
    id: str
    name: str
    description: str = ""
    variables: List[Dict[str, Any]] = field(default_factory=list)
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.created_at:
            d["created_at"] = self.created_at.isoformat()
        return d


class EnvironmentService:
    """Environment variable management across deployment targets"""

    def __init__(self):
        self.environments: Dict[str, Environment] = {}
        self.templates: Dict[str, EnvTemplate] = {}
        self.change_history: List[Dict] = []
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        if is_demo_data_enabled():
            await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        now = datetime.now()

        # Base variables shared across environments
        base_vars = {
            "APP_NAME": EnvVariable("APP_NAME", "nexus-ai", VarType.STRING, VarSource.MANUAL,
                                    "Application name", created_at=now - timedelta(days=180)),
            "LOG_LEVEL": EnvVariable("LOG_LEVEL", "info", VarType.STRING, VarSource.MANUAL,
                                     "Logging level", created_at=now - timedelta(days=180)),
            "API_VERSION": EnvVariable("API_VERSION", "v1", VarType.STRING, VarSource.MANUAL,
                                       "API version prefix", created_at=now - timedelta(days=180)),
            "MAX_WORKERS": EnvVariable("MAX_WORKERS", "4", VarType.NUMBER, VarSource.MANUAL,
                                       "Number of worker processes", created_at=now - timedelta(days=90)),
            "CORS_ORIGINS": EnvVariable("CORS_ORIGINS", '["http://localhost:5173"]', VarType.JSON,
                                        VarSource.MANUAL, "Allowed CORS origins",
                                        created_at=now - timedelta(days=180)),
            "ENABLE_DOCS": EnvVariable("ENABLE_DOCS", "true", VarType.BOOLEAN, VarSource.MANUAL,
                                       "Enable API documentation", created_at=now - timedelta(days=180)),
        }

        # Production variables
        prod_vars = {
            **{k: EnvVariable(v.key, v.value, v.var_type, v.source, v.description,
                              created_at=v.created_at) for k, v in base_vars.items()},
            "DATABASE_URL": EnvVariable("DATABASE_URL", "postgresql://nexus:xxx@db:5432/nexus_prod",
                                        VarType.URL, VarSource.VAULT, "Primary database URL",
                                        is_secret=True, created_at=now - timedelta(days=180)),
            "REDIS_URL": EnvVariable("REDIS_URL", "redis://:xxx@redis:6379/0",
                                     VarType.URL, VarSource.VAULT, "Redis cache URL",
                                     is_secret=True, created_at=now - timedelta(days=180)),
            "JWT_SECRET": EnvVariable("JWT_SECRET", "xxx-jwt-production-key", VarType.SECRET,
                                      VarSource.VAULT, "JWT signing key",
                                      is_secret=True, created_at=now - timedelta(days=180)),
            "OPENAI_API_KEY": EnvVariable("OPENAI_API_KEY", "sk-xxx", VarType.SECRET,
                                          VarSource.VAULT, "OpenAI API key",
                                          is_secret=True, created_at=now - timedelta(days=120)),
            "SMTP_HOST": EnvVariable("SMTP_HOST", "smtp.sendgrid.net", VarType.STRING,
                                     VarSource.MANUAL, "SMTP server host",
                                     created_at=now - timedelta(days=90)),
            "SMTP_PASSWORD": EnvVariable("SMTP_PASSWORD", "xxx", VarType.SECRET,
                                         VarSource.VAULT, "SMTP password",
                                         is_secret=True, created_at=now - timedelta(days=90)),
            "SENTRY_DSN": EnvVariable("SENTRY_DSN", "https://xxx@sentry.io/123", VarType.URL,
                                      VarSource.MANUAL, "Sentry error tracking DSN",
                                      is_secret=True, created_at=now - timedelta(days=60)),
            "ENABLE_DOCS": EnvVariable("ENABLE_DOCS", "false", VarType.BOOLEAN, VarSource.MANUAL,
                                       "Disable docs in production",
                                       created_at=now - timedelta(days=180)),
            "LOG_LEVEL": EnvVariable("LOG_LEVEL", "warning", VarType.STRING, VarSource.MANUAL,
                                     "Production log level", created_at=now - timedelta(days=180)),
            "MAX_WORKERS": EnvVariable("MAX_WORKERS", "8", VarType.NUMBER, VarSource.MANUAL,
                                       "Production workers", created_at=now - timedelta(days=90)),
        }

        # Staging variables
        staging_vars = {
            **{k: EnvVariable(v.key, v.value, v.var_type, v.source, v.description,
                              created_at=v.created_at) for k, v in base_vars.items()},
            "DATABASE_URL": EnvVariable("DATABASE_URL", "postgresql://nexus:xxx@staging-db:5432/nexus_staging",
                                        VarType.URL, VarSource.VAULT, "Staging database URL",
                                        is_secret=True, created_at=now - timedelta(days=90)),
            "REDIS_URL": EnvVariable("REDIS_URL", "redis://staging-redis:6379/0",
                                     VarType.URL, VarSource.MANUAL, "Staging Redis URL",
                                     created_at=now - timedelta(days=90)),
            "LOG_LEVEL": EnvVariable("LOG_LEVEL", "debug", VarType.STRING, VarSource.MANUAL,
                                     "Debug logging for staging", created_at=now - timedelta(days=90)),
        }

        # Dev variables
        dev_vars = {
            **{k: EnvVariable(v.key, v.value, v.var_type, v.source, v.description,
                              created_at=v.created_at) for k, v in base_vars.items()},
            "DATABASE_URL": EnvVariable("DATABASE_URL", "postgresql://nexus:dev@localhost:5432/nexus_dev",
                                        VarType.URL, VarSource.DOTENV, "Local dev database",
                                        created_at=now - timedelta(days=180)),
            "REDIS_URL": EnvVariable("REDIS_URL", "redis://localhost:6379/0",
                                     VarType.URL, VarSource.DOTENV, "Local Redis",
                                     created_at=now - timedelta(days=180)),
            "LOG_LEVEL": EnvVariable("LOG_LEVEL", "debug", VarType.STRING, VarSource.DOTENV,
                                     "Debug for dev", created_at=now - timedelta(days=180)),
            "DEBUG": EnvVariable("DEBUG", "true", VarType.BOOLEAN, VarSource.DOTENV,
                                 "Enable debug mode", created_at=now - timedelta(days=180)),
            "HOT_RELOAD": EnvVariable("HOT_RELOAD", "true", VarType.BOOLEAN, VarSource.DOTENV,
                                      "Enable hot reload", created_at=now - timedelta(days=180)),
            "MAX_WORKERS": EnvVariable("MAX_WORKERS", "1", VarType.NUMBER, VarSource.DOTENV,
                                       "Single worker for dev", created_at=now - timedelta(days=180)),
        }

        self.environments = {
            "env-prod": Environment(
                id="env-prod", name="Production", env_type=EnvironmentType.PRODUCTION,
                description="Production deployment environment",
                variables=prod_vars, is_locked=True, deploy_url="https://api.nexus-ai.com",
                region="us-east-1", version="2.5.0",
                last_deployed=now - timedelta(hours=12),
                created_at=now - timedelta(days=365), created_by="admin",
                labels={"tier": "production", "critical": "true"},
            ),
            "env-staging": Environment(
                id="env-staging", name="Staging", env_type=EnvironmentType.STAGING,
                description="Pre-production staging environment",
                variables=staging_vars, inherits_from="env-prod",
                deploy_url="https://staging.nexus-ai.com",
                region="us-east-1", version="2.6.0-beta",
                last_deployed=now - timedelta(hours=3),
                created_at=now - timedelta(days=180), created_by="admin",
                labels={"tier": "staging"},
            ),
            "env-dev": Environment(
                id="env-dev", name="Development", env_type=EnvironmentType.DEVELOPMENT,
                description="Local development environment",
                variables=dev_vars, inherits_from="env-staging",
                deploy_url="http://localhost:8000",
                region="local", version="dev",
                created_at=now - timedelta(days=365), created_by="admin",
                labels={"tier": "development"},
            ),
            "env-test": Environment(
                id="env-test", name="Testing", env_type=EnvironmentType.TESTING,
                description="CI/CD testing environment",
                variables={
                    **{k: EnvVariable(v.key, v.value, v.var_type, v.source, v.description,
                                      created_at=v.created_at) for k, v in base_vars.items()},
                    "DATABASE_URL": EnvVariable("DATABASE_URL", "sqlite:///test.db",
                                                VarType.URL, VarSource.MANUAL, "Test database",
                                                created_at=now - timedelta(days=90)),
                    "TESTING": EnvVariable("TESTING", "true", VarType.BOOLEAN, VarSource.MANUAL,
                                           "Enable testing mode", created_at=now - timedelta(days=90)),
                },
                region="ci", version="test",
                created_at=now - timedelta(days=180), created_by="admin",
                labels={"tier": "testing", "transient": "true"},
            ),
        }

        # Templates
        self.templates = {
            "tpl-fastapi": EnvTemplate(
                id="tpl-fastapi", name="FastAPI Service",
                description="Template for FastAPI microservices",
                variables=[
                    {"key": "APP_NAME", "type": "string", "required": True},
                    {"key": "PORT", "type": "number", "default": "8000"},
                    {"key": "LOG_LEVEL", "type": "string", "default": "info"},
                    {"key": "DATABASE_URL", "type": "url", "secret": True, "required": True},
                    {"key": "REDIS_URL", "type": "url"},
                    {"key": "MAX_WORKERS", "type": "number", "default": "4"},
                    {"key": "CORS_ORIGINS", "type": "json", "default": '["*"]'},
                ],
                created_at=now - timedelta(days=90),
            ),
            "tpl-ml": EnvTemplate(
                id="tpl-ml", name="ML Worker",
                description="Template for ML inference workers",
                variables=[
                    {"key": "MODEL_PATH", "type": "path", "required": True},
                    {"key": "CUDA_VISIBLE_DEVICES", "type": "string", "default": "0"},
                    {"key": "BATCH_SIZE", "type": "number", "default": "32"},
                    {"key": "MAX_SEQ_LENGTH", "type": "number", "default": "512"},
                    {"key": "MODEL_CACHE_DIR", "type": "path", "default": "/cache/models"},
                ],
                created_at=now - timedelta(days=60),
            ),
        }

    # Environment CRUD
    async def list_environments(self, env_type: Optional[EnvironmentType] = None) -> List[Dict]:
        envs = list(self.environments.values())
        if env_type:
            envs = [e for e in envs if e.env_type == env_type]
        return [e.to_dict() for e in envs]

    async def get_environment(self, env_id: str) -> Optional[Dict]:
        env = self.environments.get(env_id)
        if not env:
            return None
        d = env.to_dict()
        d["variables"] = [v.to_dict() for v in env.variables.values()]
        return d

    async def create_environment(self, name: str, env_type: EnvironmentType,
                                 description: str = "", inherits_from: str = "",
                                 template_id: str = "") -> Dict:
        env_id = f"env-{hashlib.md5(name.encode()).hexdigest()[:6]}"
        variables = {}

        if template_id and template_id in self.templates:
            tpl = self.templates[template_id]
            for v in tpl.variables:
                variables[v["key"]] = EnvVariable(
                    key=v["key"], value=v.get("default", ""),
                    var_type=VarType(v.get("type", "string")),
                    is_secret=v.get("secret", False),
                    is_required=v.get("required", False),
                    created_at=datetime.now(),
                )

        env = Environment(
            id=env_id, name=name, env_type=env_type,
            description=description, variables=variables,
            inherits_from=inherits_from or None,
            created_at=datetime.now(), created_by="current_user",
        )
        self.environments[env_id] = env
        return env.to_dict()

    async def delete_environment(self, env_id: str) -> bool:
        env = self.environments.get(env_id)
        if env and not env.is_locked:
            del self.environments[env_id]
            return True
        return False

    # Variable Operations
    async def set_variable(self, env_id: str, key: str, value: str,
                           var_type: VarType = VarType.STRING,
                           is_secret: bool = False, description: str = "") -> Optional[Dict]:
        env = self.environments.get(env_id)
        if not env or env.is_locked:
            return None

        old = env.variables.get(key)
        env.variables[key] = EnvVariable(
            key=key, value=value, var_type=var_type, is_secret=is_secret,
            description=description or (old.description if old else ""),
            created_at=old.created_at if old else datetime.now(),
            updated_at=datetime.now(), created_by="current_user",
        )

        self.change_history.append({
            "env_id": env_id, "key": key,
            "action": "updated" if old else "created",
            "timestamp": datetime.now().isoformat(),
            "user": "current_user",
        })

        return env.variables[key].to_dict()

    async def delete_variable(self, env_id: str, key: str) -> bool:
        env = self.environments.get(env_id)
        if env and key in env.variables and not env.is_locked:
            del env.variables[key]
            self.change_history.append({
                "env_id": env_id, "key": key, "action": "deleted",
                "timestamp": datetime.now().isoformat(), "user": "current_user",
            })
            return True
        return False

    # Comparison & Diff
    async def compare_environments(self, env_id_1: str, env_id_2: str) -> List[Dict]:
        env1 = self.environments.get(env_id_1)
        env2 = self.environments.get(env_id_2)
        if not env1 or not env2:
            return []

        diffs = []
        all_keys = set(list(env1.variables.keys()) + list(env2.variables.keys()))

        for key in sorted(all_keys):
            v1 = env1.variables.get(key)
            v2 = env2.variables.get(key)
            is_secret = (v1 and v1.is_secret) or (v2 and v2.is_secret)

            if v1 and not v2:
                diffs.append(EnvDiff(key, "removed", v1.value, None, is_secret).to_dict())
            elif v2 and not v1:
                diffs.append(EnvDiff(key, "added", None, v2.value, is_secret).to_dict())
            elif v1 and v2 and v1.value != v2.value:
                diffs.append(EnvDiff(key, "modified", v1.value, v2.value, is_secret).to_dict())
            else:
                diffs.append(EnvDiff(key, "unchanged", is_secret=is_secret).to_dict())

        return diffs

    # Export / Import
    async def export_env(self, env_id: str, format: str = "env",
                         include_secrets: bool = False) -> str:
        env = self.environments.get(env_id)
        if not env:
            return ""

        if format == "env":
            lines = [f"# {env.name} Environment Variables"]
            lines.append(f"# Generated: {datetime.now().isoformat()}")
            lines.append("")
            for key, var in sorted(env.variables.items()):
                val = var.value if (include_secrets or not var.is_secret) else "***REDACTED***"
                lines.append(f"# {var.description}" if var.description else "")
                lines.append(f"{key}={val}")
            return "\n".join(lines)
        elif format == "json":
            data = {key: (var.value if (include_secrets or not var.is_secret) else "***REDACTED***")
                    for key, var in sorted(env.variables.items())}
            return json.dumps(data, indent=2)
        return ""

    # Templates
    async def list_templates(self) -> List[Dict]:
        return [t.to_dict() for t in self.templates.values()]

    async def get_template(self, template_id: str) -> Optional[Dict]:
        t = self.templates.get(template_id)
        return t.to_dict() if t else None

    # History
    async def get_change_history(self, env_id: Optional[str] = None,
                                 limit: int = 50) -> List[Dict]:
        history = self.change_history
        if env_id:
            history = [h for h in history if h.get("env_id") == env_id]
        return history[-limit:]

    # Validation
    async def validate_environment(self, env_id: str) -> Dict:
        env = self.environments.get(env_id)
        if not env:
            return {"valid": False, "errors": ["Environment not found"]}

        errors = []
        warnings = []

        for key, var in env.variables.items():
            if var.is_required and not var.value:
                errors.append(f"Required variable '{key}' is empty")
            if var.var_type == VarType.NUMBER:
                try:
                    float(var.value)
                except ValueError:
                    errors.append(f"Variable '{key}' should be a number but got '{var.value}'")
            if var.var_type == VarType.BOOLEAN and var.value.lower() not in ["true", "false", "1", "0"]:
                errors.append(f"Variable '{key}' should be boolean but got '{var.value}'")
            if var.var_type == VarType.URL and not var.value.startswith(("http://", "https://", "redis://", "postgresql://", "sqlite://")):
                warnings.append(f"Variable '{key}' doesn't look like a valid URL")
            if var.is_secret and var.source == VarSource.DOTENV:
                warnings.append(f"Secret '{key}' is stored in .env file, consider using a vault")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "variables_count": len(env.variables),
            "secrets_count": len([v for v in env.variables.values() if v.is_secret]),
        }

    async def get_summary(self) -> Dict:
        return {
            "total_environments": len(self.environments),
            "total_variables": sum(len(e.variables) for e in self.environments.values()),
            "total_secrets": sum(len([v for v in e.variables.values() if v.is_secret])
                                 for e in self.environments.values()),
            "templates": len(self.templates),
            "changes": len(self.change_history),
        }
