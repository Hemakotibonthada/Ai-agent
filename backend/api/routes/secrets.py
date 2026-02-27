"""
Secrets Vault API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/secrets", tags=["secrets"])


class SecretTypeEnum(str, Enum):
    api_key = "api_key"
    password = "password"
    token = "token"
    certificate = "certificate"
    ssh_key = "ssh_key"
    database_url = "database_url"
    encryption_key = "encryption_key"
    generic = "generic"


class SecretScopeEnum(str, Enum):
    global_ = "global"
    project = "project"
    service = "service"
    user = "user"


class RotationPolicyEnum(str, Enum):
    none = "none"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    annually = "annually"


class CreateSecretRequest(BaseModel):
    name: str
    value: str
    secret_type: SecretTypeEnum = SecretTypeEnum.generic
    scope: SecretScopeEnum = SecretScopeEnum.service
    description: str = ""
    tags: list[str] = []
    service: str = ""
    environment: str = "production"
    rotation_policy: RotationPolicyEnum = RotationPolicyEnum.none
    rotation_days: int = 0


class UpdateSecretRequest(BaseModel):
    new_value: str


class CreateFolderRequest(BaseModel):
    name: str
    parent_path: str = "/"


@router.get("/")
async def list_secrets(scope: Optional[SecretScopeEnum] = None,
                       secret_type: Optional[SecretTypeEnum] = None,
                       environment: Optional[str] = None,
                       service: Optional[str] = None,
                       tag: Optional[str] = None):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return {"secrets": await svc.list_secrets(scope, secret_type, environment, service, tag)}


@router.get("/summary")
async def get_vault_summary():
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return await svc.get_summary()


@router.get("/compliance")
async def check_compliance():
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return await svc.check_compliance()


@router.get("/audit")
async def get_audit_log(secret_id: Optional[str] = None,
                        action: Optional[str] = None,
                        limit: int = 50):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return {"entries": await svc.get_audit_log(secret_id, action, limit)}


@router.get("/folders")
async def list_folders():
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return {"folders": await svc.list_folders()}


@router.post("/folders")
async def create_folder(req: CreateFolderRequest):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return await svc.create_folder(req.name, req.parent_path)


@router.get("/{secret_id}")
async def get_secret(secret_id: str, reveal: bool = False):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    secret = await svc.get_secret(secret_id, reveal)
    if not secret:
        raise HTTPException(404, "Secret not found")
    return secret


@router.post("/")
async def create_secret(req: CreateSecretRequest):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return await svc.create_secret(
        req.name, req.value, req.secret_type, req.scope,
        req.description, req.tags, req.service, req.environment,
        req.rotation_policy, req.rotation_days,
    )


@router.put("/{secret_id}")
async def update_secret(secret_id: str, req: UpdateSecretRequest):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    result = await svc.update_secret(secret_id, req.new_value)
    if not result:
        raise HTTPException(404, "Secret not found")
    return result


@router.delete("/{secret_id}")
async def delete_secret(secret_id: str):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    if not await svc.delete_secret(secret_id):
        raise HTTPException(404, "Secret not found")
    return {"status": "deleted"}


@router.post("/{secret_id}/rotate")
async def rotate_secret(secret_id: str):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    result = await svc.rotate_secret(secret_id)
    if not result:
        raise HTTPException(404, "Secret not found")
    return result


@router.post("/bulk-rotate")
async def bulk_rotate(secret_ids: list[str] = None):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    return await svc.bulk_rotate(secret_ids)


@router.get("/export/{format}")
async def export_secrets(format: str, environment: str = "production"):
    from backend.services.secrets_service import SecretsVaultService
    svc = SecretsVaultService()
    await svc.initialize()
    content = await svc.export_secrets(format, environment)
    return {"content": content, "format": format}
