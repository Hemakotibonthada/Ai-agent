"""
Container Management API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum

router = APIRouter(prefix="/api/v1/containers", tags=["containers"])


class ContainerStatusEnum(str, Enum):
    running = "running"
    stopped = "stopped"
    paused = "paused"


class RestartPolicyEnum(str, Enum):
    no = "no"
    always = "always"
    on_failure = "on-failure"
    unless_stopped = "unless-stopped"


class CreateContainerRequest(BaseModel):
    name: str
    image: str
    ports: list[dict] = []
    volumes: list[dict] = []
    environment: dict[str, str] = {}
    network: str = "bridge"
    cpu_limit: float = 0
    memory_limit_mb: int = 0
    command: str = ""
    restart_policy: RestartPolicyEnum = RestartPolicyEnum.unless_stopped


class ExecRequest(BaseModel):
    command: str


class PullImageRequest(BaseModel):
    repository: str
    tag: str = "latest"


class BuildImageRequest(BaseModel):
    name: str
    tag: str
    dockerfile_path: str = "."
    build_args: dict[str, str] = {}


class CreateNetworkRequest(BaseModel):
    name: str
    driver: str = "bridge"
    subnet: str = ""
    internal: bool = False


class CreateVolumeRequest(BaseModel):
    name: str
    driver: str = "local"
    labels: dict[str, str] = {}


# Dashboard
@router.get("/dashboard")
async def get_container_dashboard():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.get_dashboard()


# Containers
@router.get("/")
async def list_containers(status: Optional[ContainerStatusEnum] = None,
                          network: Optional[str] = None):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"containers": await svc.list_containers(status, network)}


@router.get("/{container_id}")
async def get_container(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    container = await svc.get_container(container_id)
    if not container:
        raise HTTPException(404, "Container not found")
    return container


@router.post("/")
async def create_container(req: CreateContainerRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.create_container(
        req.name, req.image, [p for p in req.ports],
        [v for v in req.volumes], req.environment,
        req.network, req.cpu_limit, req.memory_limit_mb, req.command,
    )


@router.post("/{container_id}/start")
async def start_container(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.start_container(container_id):
        raise HTTPException(400, "Cannot start container")
    return {"status": "started"}


@router.post("/{container_id}/stop")
async def stop_container(container_id: str, timeout: int = 10):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.stop_container(container_id, timeout):
        raise HTTPException(400, "Cannot stop container")
    return {"status": "stopped"}


@router.post("/{container_id}/restart")
async def restart_container(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.restart_container(container_id):
        raise HTTPException(400, "Cannot restart container")
    return {"status": "restarted"}


@router.delete("/{container_id}")
async def remove_container(container_id: str, force: bool = False):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.remove_container(container_id, force):
        raise HTTPException(400, "Cannot remove container")
    return {"status": "removed"}


@router.post("/{container_id}/pause")
async def pause_container(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.pause_container(container_id):
        raise HTTPException(400, "Cannot pause container")
    return {"status": "paused"}


@router.post("/{container_id}/unpause")
async def unpause_container(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.unpause_container(container_id):
        raise HTTPException(400, "Cannot unpause container")
    return {"status": "unpaused"}


@router.get("/{container_id}/logs")
async def get_container_logs(container_id: str, tail: int = 100):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"logs": await svc.get_container_logs(container_id, tail)}


@router.get("/{container_id}/stats")
async def get_container_stats(container_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    stats = await svc.get_container_stats(container_id)
    if not stats:
        raise HTTPException(404, "Stats not available")
    return stats


@router.post("/{container_id}/exec")
async def exec_in_container(container_id: str, req: ExecRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.exec_in_container(container_id, req.command)


# Images
@router.get("/images/list")
async def list_images():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"images": await svc.list_images()}


@router.post("/images/pull")
async def pull_image(req: PullImageRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.pull_image(req.repository, req.tag)


@router.post("/images/build")
async def build_image(req: BuildImageRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.build_image(req.name, req.tag, req.dockerfile_path, req.build_args)


@router.delete("/images/{image_id}")
async def remove_image(image_id: str, force: bool = False):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.remove_image(image_id, force):
        raise HTTPException(400, "Cannot remove image")
    return {"status": "removed"}


# Networks
@router.get("/networks/list")
async def list_networks():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"networks": await svc.list_networks()}


@router.post("/networks")
async def create_network(req: CreateNetworkRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.create_network(req.name, req.driver, req.subnet, req.internal)


@router.delete("/networks/{network_id}")
async def remove_network(network_id: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.remove_network(network_id):
        raise HTTPException(400, "Cannot remove network")
    return {"status": "removed"}


# Volumes
@router.get("/volumes/list")
async def list_volumes():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"volumes": await svc.list_volumes()}


@router.post("/volumes")
async def create_volume(req: CreateVolumeRequest):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.create_volume(req.name, req.driver, req.labels)


@router.delete("/volumes/{name}")
async def remove_volume(name: str, force: bool = False):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    if not await svc.remove_volume(name, force):
        raise HTTPException(400, "Cannot remove volume")
    return {"status": "removed"}


@router.post("/volumes/prune")
async def prune_volumes():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.prune_volumes()


# Compose
@router.get("/compose/projects")
async def list_compose_projects():
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return {"projects": await svc.list_compose_projects()}


@router.get("/compose/projects/{name}")
async def get_compose_project(name: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    project = await svc.get_compose_project(name)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.post("/compose/projects/{name}/up")
async def compose_up(name: str):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.compose_up(name)


@router.post("/compose/projects/{name}/down")
async def compose_down(name: str, remove_volumes: bool = False):
    from backend.services.container_service import ContainerService
    svc = ContainerService()
    await svc.initialize()
    return await svc.compose_down(name, remove_volumes)
