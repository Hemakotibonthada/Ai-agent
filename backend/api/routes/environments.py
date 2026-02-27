"""
Environment Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/environments", tags=["environments"])


class CreateEnvironmentRequest(BaseModel):
    name: str
    env_type: str = "development"
    description: str = ""
    base_url: str = ""
    region: str = ""


class SetVariableRequest(BaseModel):
    key: str
    value: str
    var_type: str = "string"
    is_secret: bool = False
    description: str = ""


class CreateTemplateRequest(BaseModel):
    name: str
    description: str = ""
    variables: list = []


@router.get("")
async def list_environments(env_type: Optional[str] = None):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return {"environments": await svc.list_environments(env_type)}


@router.get("/{env_id}")
async def get_environment(env_id: str):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    env = await svc.get_environment(env_id)
    if not env:
        raise HTTPException(404, "Environment not found")
    return env


@router.post("")
async def create_environment(req: CreateEnvironmentRequest):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return await svc.create_environment(req.name, req.env_type,
                                         req.description, req.base_url, req.region)


@router.delete("/{env_id}")
async def delete_environment(env_id: str):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    if not await svc.delete_environment(env_id):
        raise HTTPException(404, "Environment not found")
    return {"status": "deleted"}


@router.get("/{env_id}/variables")
async def list_variables(env_id: str, show_secrets: bool = False):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    variables = await svc.list_variables(env_id, show_secrets)
    if variables is None:
        raise HTTPException(404, "Environment not found")
    return {"variables": variables}


@router.post("/{env_id}/variables")
async def set_variable(env_id: str, req: SetVariableRequest):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    result = await svc.set_variable(env_id, req.key, req.value,
                                     req.var_type, req.is_secret, req.description)
    if not result:
        raise HTTPException(404, "Environment not found")
    return result


@router.delete("/{env_id}/variables/{key}")
async def delete_variable(env_id: str, key: str):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    if not await svc.delete_variable(env_id, key):
        raise HTTPException(404, "Variable not found")
    return {"status": "deleted"}


@router.get("/compare/{env1_id}/{env2_id}")
async def compare_environments(env1_id: str, env2_id: str):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    result = await svc.compare_environments(env1_id, env2_id)
    if not result:
        raise HTTPException(404, "Environment not found")
    return result


@router.get("/{env_id}/export")
async def export_environment(env_id: str, fmt: str = "env"):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    result = await svc.export_environment(env_id, fmt)
    if not result:
        raise HTTPException(404, "Environment not found")
    return result


@router.get("/templates/list")
async def list_templates():
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return {"templates": await svc.list_templates()}


@router.post("/templates")
async def create_template(req: CreateTemplateRequest):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return await svc.create_template(req.name, req.description, req.variables)


@router.get("/{env_id}/history")
async def get_history(env_id: str, limit: int = 50):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return {"history": await svc.get_history(env_id, limit)}


@router.get("/{env_id}/validate")
async def validate_environment(env_id: str):
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    result = await svc.validate_environment(env_id)
    if not result:
        raise HTTPException(404, "Environment not found")
    return result


@router.get("/summary/all")
async def get_summary():
    from backend.services.environment_service import EnvironmentManagerService
    svc = EnvironmentManagerService()
    await svc.initialize()
    return await svc.get_summary()
