"""
Container & Docker Management Service for Nexus AI
Full container lifecycle management, image registry, and orchestration
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional


class ContainerStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    PAUSED = "paused"
    RESTARTING = "restarting"
    CREATING = "creating"
    REMOVING = "removing"
    EXITED = "exited"
    DEAD = "dead"


class ContainerRuntime(str, Enum):
    DOCKER = "docker"
    PODMAN = "podman"
    CONTAINERD = "containerd"
    CRIO = "cri-o"


class NetworkMode(str, Enum):
    BRIDGE = "bridge"
    HOST = "host"
    NONE = "none"
    OVERLAY = "overlay"
    MACVLAN = "macvlan"


class RestartPolicy(str, Enum):
    NO = "no"
    ALWAYS = "always"
    ON_FAILURE = "on-failure"
    UNLESS_STOPPED = "unless-stopped"


class VolumeType(str, Enum):
    BIND = "bind"
    VOLUME = "volume"
    TMPFS = "tmpfs"
    NFS = "nfs"


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    STARTING = "starting"
    NONE = "none"


@dataclass
class ContainerPort:
    container_port: int
    host_port: int
    protocol: str = "tcp"
    host_ip: str = "0.0.0.0"

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ContainerVolume:
    source: str
    target: str
    volume_type: VolumeType = VolumeType.VOLUME
    read_only: bool = False

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ContainerStats:
    cpu_percent: float = 0.0
    memory_usage_mb: float = 0.0
    memory_limit_mb: float = 0.0
    memory_percent: float = 0.0
    network_rx_bytes: int = 0
    network_tx_bytes: int = 0
    block_read_bytes: int = 0
    block_write_bytes: int = 0
    pids: int = 0

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class Container:
    id: str
    name: str
    image: str
    status: ContainerStatus
    created_at: datetime
    runtime: ContainerRuntime = ContainerRuntime.DOCKER
    command: str = ""
    ports: List[ContainerPort] = field(default_factory=list)
    volumes: List[ContainerVolume] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    labels: Dict[str, str] = field(default_factory=dict)
    network_mode: NetworkMode = NetworkMode.BRIDGE
    networks: List[str] = field(default_factory=list)
    restart_policy: RestartPolicy = RestartPolicy.UNLESS_STOPPED
    health_status: HealthStatus = HealthStatus.HEALTHY
    health_check_cmd: str = ""
    cpu_limit: float = 0.0
    memory_limit_mb: int = 0
    hostname: str = ""
    ip_address: str = ""
    mac_address: str = ""
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    exit_code: Optional[int] = None
    stats: Optional[ContainerStats] = None
    log_driver: str = "json-file"
    platform: str = "linux/amd64"

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        if self.started_at:
            d["started_at"] = self.started_at.isoformat()
        if self.finished_at:
            d["finished_at"] = self.finished_at.isoformat()
        return d


@dataclass
class ContainerImage:
    id: str
    repository: str
    tag: str
    digest: str
    size_mb: float
    created_at: datetime
    architecture: str = "amd64"
    os: str = "linux"
    layers: int = 0
    labels: Dict[str, str] = field(default_factory=dict)
    vulnerabilities: int = 0
    scan_status: str = "scanned"

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        return d


@dataclass
class ContainerNetwork:
    id: str
    name: str
    driver: str = "bridge"
    subnet: str = ""
    gateway: str = ""
    scope: str = "local"
    internal: bool = False
    attachable: bool = True
    containers: List[str] = field(default_factory=list)
    labels: Dict[str, str] = field(default_factory=dict)
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.created_at:
            d["created_at"] = self.created_at.isoformat()
        return d


@dataclass
class DockerVolume:
    name: str
    driver: str = "local"
    mountpoint: str = ""
    scope: str = "local"
    size_mb: float = 0.0
    labels: Dict[str, str] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    in_use: bool = False
    containers: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.created_at:
            d["created_at"] = self.created_at.isoformat()
        return d


@dataclass
class ComposeProject:
    name: str
    status: str = "running"
    services: List[Dict[str, Any]] = field(default_factory=list)
    networks: List[str] = field(default_factory=list)
    volumes: List[str] = field(default_factory=list)
    config_file: str = "docker-compose.yml"
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        if self.created_at:
            d["created_at"] = self.created_at.isoformat()
        return d


class ContainerService:
    """Comprehensive container management service"""

    def __init__(self):
        self.containers: Dict[str, Container] = {}
        self.images: Dict[str, ContainerImage] = {}
        self.networks: Dict[str, ContainerNetwork] = {}
        self.volumes: Dict[str, DockerVolume] = {}
        self.compose_projects: Dict[str, ComposeProject] = {}
        self._event_handlers: Dict[str, List] = {}
        self._initialized = False

    async def initialize(self):
        """Initialize with sample container infrastructure"""
        if self._initialized:
            return
        await self._create_sample_data()
        self._initialized = True

    async def _create_sample_data(self):
        """Create realistic sample container data"""
        # Images
        images = [
            ContainerImage(id="sha256:a1b2c3", repository="nexus-ai/core", tag="2.5.0",
                           digest="sha256:a1b2c3d4e5f6", size_mb=892.4,
                           created_at=datetime.now() - timedelta(days=3), layers=12,
                           labels={"maintainer": "nexus-team", "version": "2.5.0"}),
            ContainerImage(id="sha256:d4e5f6", repository="nexus-ai/frontend", tag="latest",
                           digest="sha256:d4e5f6a7b8c9", size_mb=345.8,
                           created_at=datetime.now() - timedelta(days=1), layers=8,
                           labels={"maintainer": "nexus-team"}),
            ContainerImage(id="sha256:g7h8i9", repository="postgres", tag="16-alpine",
                           digest="sha256:g7h8i9j0k1l2", size_mb=245.2,
                           created_at=datetime.now() - timedelta(days=14), layers=6),
            ContainerImage(id="sha256:m3n4o5", repository="redis", tag="7-alpine",
                           digest="sha256:m3n4o5p6q7r8", size_mb=42.8,
                           created_at=datetime.now() - timedelta(days=7), layers=5),
            ContainerImage(id="sha256:s9t0u1", repository="nginx", tag="1.25-alpine",
                           digest="sha256:s9t0u1v2w3x4", size_mb=58.3,
                           created_at=datetime.now() - timedelta(days=10), layers=4),
            ContainerImage(id="sha256:y5z6a7", repository="nexus-ai/ml-worker", tag="2.5.0",
                           digest="sha256:y5z6a7b8c9d0", size_mb=2340.5,
                           created_at=datetime.now() - timedelta(days=3), layers=18,
                           vulnerabilities=2, scan_status="warnings"),
            ContainerImage(id="sha256:e1f2g3", repository="rabbitmq", tag="3-management-alpine",
                           digest="sha256:e1f2g3h4i5j6", size_mb=178.9,
                           created_at=datetime.now() - timedelta(days=21), layers=7),
            ContainerImage(id="sha256:k7l8m9", repository="grafana/grafana", tag="10.2",
                           digest="sha256:k7l8m9n0o1p2", size_mb=398.6,
                           created_at=datetime.now() - timedelta(days=5), layers=9),
        ]
        for img in images:
            self.images[img.id] = img

        # Networks
        networks = [
            ContainerNetwork(id="net-001", name="nexus-network", driver="bridge",
                             subnet="172.20.0.0/16", gateway="172.20.0.1",
                             containers=["nexus-core", "nexus-frontend", "nexus-db"],
                             created_at=datetime.now() - timedelta(days=30)),
            ContainerNetwork(id="net-002", name="monitoring", driver="bridge",
                             subnet="172.21.0.0/16", gateway="172.21.0.1",
                             containers=["grafana", "prometheus"],
                             created_at=datetime.now() - timedelta(days=30)),
            ContainerNetwork(id="net-003", name="ml-network", driver="overlay",
                             subnet="172.22.0.0/16", gateway="172.22.0.1",
                             containers=["ml-worker-1", "ml-worker-2"],
                             created_at=datetime.now() - timedelta(days=14)),
        ]
        for net in networks:
            self.networks[net.id] = net

        # Volumes
        volumes = [
            DockerVolume(name="nexus-db-data", driver="local", size_mb=4520.0,
                         in_use=True, containers=["nexus-db"],
                         created_at=datetime.now() - timedelta(days=90)),
            DockerVolume(name="nexus-redis-data", driver="local", size_mb=128.0,
                         in_use=True, containers=["nexus-redis"],
                         created_at=datetime.now() - timedelta(days=90)),
            DockerVolume(name="ml-models", driver="local", size_mb=15800.0,
                         in_use=True, containers=["ml-worker-1", "ml-worker-2"],
                         created_at=datetime.now() - timedelta(days=60)),
            DockerVolume(name="nexus-logs", driver="local", size_mb=2340.0,
                         in_use=True, containers=["nexus-core"],
                         created_at=datetime.now() - timedelta(days=90)),
            DockerVolume(name="grafana-data", driver="local", size_mb=256.0,
                         in_use=True, containers=["grafana"],
                         created_at=datetime.now() - timedelta(days=30)),
            DockerVolume(name="backup-staging", driver="local", size_mb=8900.0,
                         in_use=False, created_at=datetime.now() - timedelta(days=7)),
        ]
        for vol in volumes:
            self.volumes[vol.name] = vol

        # Containers
        containers = [
            Container(
                id="c-001", name="nexus-core", image="nexus-ai/core:2.5.0",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=5),
                started_at=datetime.now() - timedelta(days=5), command="python -m uvicorn main:app --host 0.0.0.0 --port 8000",
                ports=[ContainerPort(8000, 8000), ContainerPort(8443, 8443, "tcp")],
                volumes=[ContainerVolume("/app/data", "/data"), ContainerVolume("nexus-logs", "/logs")],
                environment={"ENV": "production", "LOG_LEVEL": "info", "WORKERS": "4"},
                labels={"com.nexus.service": "core", "com.nexus.version": "2.5.0"},
                networks=["nexus-network"], cpu_limit=4.0, memory_limit_mb=8192,
                hostname="nexus-core", ip_address="172.20.0.2",
                health_status=HealthStatus.HEALTHY, health_check_cmd="curl -f http://localhost:8000/health",
                stats=ContainerStats(cpu_percent=23.5, memory_usage_mb=2840, memory_limit_mb=8192,
                                     memory_percent=34.7, network_rx_bytes=1024000000, network_tx_bytes=512000000,
                                     pids=12),
            ),
            Container(
                id="c-002", name="nexus-frontend", image="nexus-ai/frontend:latest",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=5),
                started_at=datetime.now() - timedelta(days=5), command="nginx -g 'daemon off;'",
                ports=[ContainerPort(80, 3000), ContainerPort(443, 3443)],
                environment={"API_URL": "http://nexus-core:8000"},
                labels={"com.nexus.service": "frontend"},
                networks=["nexus-network"], cpu_limit=2.0, memory_limit_mb=2048,
                hostname="nexus-frontend", ip_address="172.20.0.3",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=5.2, memory_usage_mb=245, memory_limit_mb=2048,
                                     memory_percent=12.0, pids=4),
            ),
            Container(
                id="c-003", name="nexus-db", image="postgres:16-alpine",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=30),
                started_at=datetime.now() - timedelta(days=15), command="postgres",
                ports=[ContainerPort(5432, 5432)],
                volumes=[ContainerVolume("nexus-db-data", "/var/lib/postgresql/data")],
                environment={"POSTGRES_DB": "nexus", "POSTGRES_USER": "nexus"},
                labels={"com.nexus.service": "database"},
                networks=["nexus-network"], cpu_limit=4.0, memory_limit_mb=4096,
                hostname="nexus-db", ip_address="172.20.0.4",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=12.8, memory_usage_mb=1520, memory_limit_mb=4096,
                                     memory_percent=37.1, pids=8),
            ),
            Container(
                id="c-004", name="nexus-redis", image="redis:7-alpine",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=30),
                started_at=datetime.now() - timedelta(days=15), command="redis-server --appendonly yes",
                ports=[ContainerPort(6379, 6379)],
                volumes=[ContainerVolume("nexus-redis-data", "/data")],
                labels={"com.nexus.service": "cache"},
                networks=["nexus-network"], cpu_limit=1.0, memory_limit_mb=1024,
                hostname="nexus-redis", ip_address="172.20.0.5",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=2.1, memory_usage_mb=89, memory_limit_mb=1024,
                                     memory_percent=8.7, pids=3),
            ),
            Container(
                id="c-005", name="ml-worker-1", image="nexus-ai/ml-worker:2.5.0",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=3),
                started_at=datetime.now() - timedelta(days=3),
                command="python worker.py --gpu 0",
                ports=[ContainerPort(8501, 8501)],
                volumes=[ContainerVolume("ml-models", "/models")],
                environment={"CUDA_VISIBLE_DEVICES": "0", "MODEL_CACHE": "/models"},
                labels={"com.nexus.service": "ml-worker", "com.nexus.gpu": "0"},
                networks=["nexus-network", "ml-network"], cpu_limit=8.0, memory_limit_mb=16384,
                hostname="ml-worker-1", ip_address="172.20.0.10",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=67.3, memory_usage_mb=12450, memory_limit_mb=16384,
                                     memory_percent=76.0, pids=6),
            ),
            Container(
                id="c-006", name="ml-worker-2", image="nexus-ai/ml-worker:2.5.0",
                status=ContainerStatus.STOPPED, created_at=datetime.now() - timedelta(days=3),
                finished_at=datetime.now() - timedelta(hours=2), exit_code=0,
                command="python worker.py --gpu 1",
                ports=[ContainerPort(8502, 8502)],
                volumes=[ContainerVolume("ml-models", "/models")],
                environment={"CUDA_VISIBLE_DEVICES": "1", "MODEL_CACHE": "/models"},
                labels={"com.nexus.service": "ml-worker", "com.nexus.gpu": "1"},
                networks=["ml-network"], cpu_limit=8.0, memory_limit_mb=16384,
                hostname="ml-worker-2", ip_address="172.22.0.3",
                health_status=HealthStatus.NONE,
                stats=ContainerStats(),
            ),
            Container(
                id="c-007", name="rabbitmq", image="rabbitmq:3-management-alpine",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=14),
                started_at=datetime.now() - timedelta(days=14),
                command="rabbitmq-server",
                ports=[ContainerPort(5672, 5672), ContainerPort(15672, 15672)],
                labels={"com.nexus.service": "message-queue"},
                networks=["nexus-network"], cpu_limit=2.0, memory_limit_mb=2048,
                hostname="rabbitmq", ip_address="172.20.0.6",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=8.4, memory_usage_mb=340, memory_limit_mb=2048,
                                     memory_percent=16.6, pids=5),
            ),
            Container(
                id="c-008", name="grafana", image="grafana/grafana:10.2",
                status=ContainerStatus.RUNNING, created_at=datetime.now() - timedelta(days=7),
                started_at=datetime.now() - timedelta(days=7),
                command="/run.sh",
                ports=[ContainerPort(3000, 3001)],
                volumes=[ContainerVolume("grafana-data", "/var/lib/grafana")],
                labels={"com.nexus.service": "monitoring"},
                networks=["monitoring"], cpu_limit=1.0, memory_limit_mb=1024,
                hostname="grafana", ip_address="172.21.0.2",
                health_status=HealthStatus.HEALTHY,
                stats=ContainerStats(cpu_percent=3.2, memory_usage_mb=178, memory_limit_mb=1024,
                                     memory_percent=17.4, pids=3),
            ),
        ]
        for c in containers:
            self.containers[c.id] = c

        # Compose Projects
        self.compose_projects["nexus-stack"] = ComposeProject(
            name="nexus-stack", status="running",
            services=[
                {"name": "core", "container": "nexus-core", "status": "running", "replicas": 1},
                {"name": "frontend", "container": "nexus-frontend", "status": "running", "replicas": 1},
                {"name": "db", "container": "nexus-db", "status": "running", "replicas": 1},
                {"name": "redis", "container": "nexus-redis", "status": "running", "replicas": 1},
                {"name": "rabbitmq", "container": "rabbitmq", "status": "running", "replicas": 1},
            ],
            networks=["nexus-network"],
            volumes=["nexus-db-data", "nexus-redis-data", "nexus-logs"],
            created_at=datetime.now() - timedelta(days=30),
        )

    # Container CRUD
    async def list_containers(self, status: Optional[ContainerStatus] = None,
                              network: Optional[str] = None) -> List[Dict]:
        """List all containers with optional filters"""
        containers = list(self.containers.values())
        if status:
            containers = [c for c in containers if c.status == status]
        if network:
            containers = [c for c in containers if network in c.networks]
        return [c.to_dict() for c in containers]

    async def get_container(self, container_id: str) -> Optional[Dict]:
        """Get container details"""
        c = self.containers.get(container_id)
        return c.to_dict() if c else None

    async def create_container(self, name: str, image: str, ports: List[Dict] = None,
                               volumes: List[Dict] = None, environment: Dict[str, str] = None,
                               network: str = "bridge", cpu_limit: float = 0,
                               memory_limit_mb: int = 0, command: str = "",
                               restart_policy: RestartPolicy = RestartPolicy.UNLESS_STOPPED) -> Dict:
        """Create a new container"""
        container_id = f"c-{hashlib.md5(name.encode()).hexdigest()[:6]}"
        container_ports = [ContainerPort(**p) for p in (ports or [])]
        container_volumes = [ContainerVolume(**v) for v in (volumes or [])]

        container = Container(
            id=container_id, name=name, image=image,
            status=ContainerStatus.CREATING,
            created_at=datetime.now(), command=command,
            ports=container_ports, volumes=container_volumes,
            environment=environment or {},
            network_mode=NetworkMode.BRIDGE,
            networks=[network], restart_policy=restart_policy,
            cpu_limit=cpu_limit, memory_limit_mb=memory_limit_mb,
            hostname=name,
        )
        self.containers[container_id] = container

        # Simulate creation delay then start
        container.status = ContainerStatus.RUNNING
        container.started_at = datetime.now()
        container.health_status = HealthStatus.STARTING
        container.ip_address = f"172.20.0.{len(self.containers) + 10}"

        await self._emit_event("container_created", container.to_dict())
        return container.to_dict()

    async def start_container(self, container_id: str) -> bool:
        """Start a stopped container"""
        c = self.containers.get(container_id)
        if c and c.status in [ContainerStatus.STOPPED, ContainerStatus.EXITED]:
            c.status = ContainerStatus.RUNNING
            c.started_at = datetime.now()
            c.finished_at = None
            c.exit_code = None
            c.health_status = HealthStatus.STARTING
            await self._emit_event("container_started", {"id": container_id, "name": c.name})
            return True
        return False

    async def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        """Stop a running container"""
        c = self.containers.get(container_id)
        if c and c.status == ContainerStatus.RUNNING:
            c.status = ContainerStatus.STOPPED
            c.finished_at = datetime.now()
            c.exit_code = 0
            c.health_status = HealthStatus.NONE
            c.stats = ContainerStats()
            await self._emit_event("container_stopped", {"id": container_id, "name": c.name})
            return True
        return False

    async def restart_container(self, container_id: str) -> bool:
        """Restart a container"""
        c = self.containers.get(container_id)
        if c:
            c.status = ContainerStatus.RESTARTING
            await asyncio.sleep(0.1)
            c.status = ContainerStatus.RUNNING
            c.started_at = datetime.now()
            c.health_status = HealthStatus.STARTING
            await self._emit_event("container_restarted", {"id": container_id, "name": c.name})
            return True
        return False

    async def remove_container(self, container_id: str, force: bool = False) -> bool:
        """Remove a container"""
        c = self.containers.get(container_id)
        if not c:
            return False
        if c.status == ContainerStatus.RUNNING and not force:
            return False
        del self.containers[container_id]
        await self._emit_event("container_removed", {"id": container_id})
        return True

    async def pause_container(self, container_id: str) -> bool:
        """Pause a running container"""
        c = self.containers.get(container_id)
        if c and c.status == ContainerStatus.RUNNING:
            c.status = ContainerStatus.PAUSED
            return True
        return False

    async def unpause_container(self, container_id: str) -> bool:
        """Unpause a paused container"""
        c = self.containers.get(container_id)
        if c and c.status == ContainerStatus.PAUSED:
            c.status = ContainerStatus.RUNNING
            return True
        return False

    async def get_container_logs(self, container_id: str, tail: int = 100,
                                 since: Optional[str] = None) -> List[str]:
        """Get container logs"""
        c = self.containers.get(container_id)
        if not c:
            return []
        # Generate sample logs
        log_templates = [
            f"[INFO] {c.name} service started successfully",
            f"[INFO] Listening on port {c.ports[0].container_port if c.ports else 8000}",
            "[INFO] Health check: OK (response time: 12ms)",
            "[DEBUG] Processing request: GET /api/v1/status",
            "[INFO] Request completed in 45ms (status: 200)",
            "[DEBUG] Cache hit ratio: 87.3%",
            "[INFO] Active connections: 24",
            "[WARN] Memory usage at 75% of limit",
            "[INFO] Background task completed: cleanup_expired_sessions",
            "[DEBUG] Database pool: 8/20 connections in use",
        ]
        return [f"2025-01-15T{10+i%14}:{i*7%60:02d}:00Z {log_templates[i % len(log_templates)]}"
                for i in range(min(tail, 50))]

    async def get_container_stats(self, container_id: str) -> Optional[Dict]:
        """Get container resource stats"""
        c = self.containers.get(container_id)
        if c and c.stats:
            return c.stats.to_dict()
        return None

    async def exec_in_container(self, container_id: str, command: str) -> Dict:
        """Execute a command in a container"""
        c = self.containers.get(container_id)
        if not c or c.status != ContainerStatus.RUNNING:
            return {"error": "Container not running", "exit_code": 1}
        return {
            "container": c.name,
            "command": command,
            "exit_code": 0,
            "output": f"Command '{command}' executed successfully in {c.name}",
            "timestamp": datetime.now().isoformat(),
        }

    # Image Operations
    async def list_images(self) -> List[Dict]:
        """List all images"""
        return [img.to_dict() for img in self.images.values()]

    async def pull_image(self, repository: str, tag: str = "latest") -> Dict:
        """Pull an image from registry"""
        img_id = f"sha256:{hashlib.md5(f'{repository}:{tag}'.encode()).hexdigest()[:6]}"
        image = ContainerImage(
            id=img_id, repository=repository, tag=tag,
            digest=f"sha256:{hashlib.sha256(f'{repository}:{tag}'.encode()).hexdigest()[:12]}",
            size_mb=round(100 + hash(repository) % 500, 1),
            created_at=datetime.now(),
        )
        self.images[img_id] = image
        await self._emit_event("image_pulled", image.to_dict())
        return image.to_dict()

    async def remove_image(self, image_id: str, force: bool = False) -> bool:
        """Remove an image"""
        if image_id in self.images:
            # Check if any container uses this image
            img = self.images[image_id]
            in_use = any(f"{img.repository}:{img.tag}" == c.image
                         for c in self.containers.values())
            if in_use and not force:
                return False
            del self.images[image_id]
            return True
        return False

    async def build_image(self, name: str, tag: str, dockerfile_path: str = ".",
                          build_args: Dict[str, str] = None) -> Dict:
        """Build an image from Dockerfile"""
        img_id = f"sha256:{hashlib.md5(f'{name}:{tag}'.encode()).hexdigest()[:6]}"
        image = ContainerImage(
            id=img_id, repository=name, tag=tag,
            digest=f"sha256:{hashlib.sha256(f'{name}:{tag}'.encode()).hexdigest()[:12]}",
            size_mb=round(200 + hash(name) % 800, 1),
            created_at=datetime.now(), layers=10,
        )
        self.images[img_id] = image
        return {
            "image": image.to_dict(),
            "build_time_seconds": 45,
            "layers_cached": 6,
            "layers_built": 4,
        }

    # Network Operations
    async def list_networks(self) -> List[Dict]:
        """List all networks"""
        return [n.to_dict() for n in self.networks.values()]

    async def create_network(self, name: str, driver: str = "bridge",
                             subnet: str = "", internal: bool = False) -> Dict:
        """Create a network"""
        net_id = f"net-{hashlib.md5(name.encode()).hexdigest()[:6]}"
        network = ContainerNetwork(
            id=net_id, name=name, driver=driver,
            subnet=subnet or f"172.{20 + len(self.networks)}.0.0/16",
            gateway=subnet.rsplit(".", 1)[0] + ".1" if subnet else f"172.{20 + len(self.networks)}.0.1",
            internal=internal, created_at=datetime.now(),
        )
        self.networks[net_id] = network
        return network.to_dict()

    async def remove_network(self, network_id: str) -> bool:
        """Remove a network"""
        net = self.networks.get(network_id)
        if net and not net.containers:
            del self.networks[network_id]
            return True
        return False

    # Volume Operations
    async def list_volumes(self) -> List[Dict]:
        """List all volumes"""
        return [v.to_dict() for v in self.volumes.values()]

    async def create_volume(self, name: str, driver: str = "local",
                            labels: Dict[str, str] = None) -> Dict:
        """Create a volume"""
        volume = DockerVolume(
            name=name, driver=driver, labels=labels or {},
            created_at=datetime.now(),
            mountpoint=f"/var/lib/docker/volumes/{name}/_data",
        )
        self.volumes[name] = volume
        return volume.to_dict()

    async def remove_volume(self, name: str, force: bool = False) -> bool:
        """Remove a volume"""
        vol = self.volumes.get(name)
        if vol and (not vol.in_use or force):
            del self.volumes[name]
            return True
        return False

    async def prune_volumes(self) -> Dict:
        """Remove unused volumes"""
        unused = [name for name, vol in self.volumes.items() if not vol.in_use]
        total_freed = sum(self.volumes[name].size_mb for name in unused)
        for name in unused:
            del self.volumes[name]
        return {"removed": unused, "space_freed_mb": total_freed}

    # Compose Operations
    async def list_compose_projects(self) -> List[Dict]:
        """List all compose projects"""
        return [p.to_dict() for p in self.compose_projects.values()]

    async def get_compose_project(self, name: str) -> Optional[Dict]:
        """Get compose project details"""
        project = self.compose_projects.get(name)
        return project.to_dict() if project else None

    async def compose_up(self, project_name: str, services: List[str] = None) -> Dict:
        """Start compose services"""
        project = self.compose_projects.get(project_name)
        if project:
            project.status = "running"
            for svc in project.services:
                if services is None or svc["name"] in services:
                    svc["status"] = "running"
            return project.to_dict()
        return {"error": "Project not found"}

    async def compose_down(self, project_name: str, remove_volumes: bool = False) -> Dict:
        """Stop compose services"""
        project = self.compose_projects.get(project_name)
        if project:
            project.status = "stopped"
            for svc in project.services:
                svc["status"] = "stopped"
            return {"status": "stopped", "services": len(project.services)}
        return {"error": "Project not found"}

    # Dashboard / Summary
    async def get_dashboard(self) -> Dict:
        """Get container dashboard summary"""
        running = len([c for c in self.containers.values() if c.status == ContainerStatus.RUNNING])
        stopped = len([c for c in self.containers.values() if c.status in [ContainerStatus.STOPPED, ContainerStatus.EXITED]])
        total_cpu = sum(c.stats.cpu_percent for c in self.containers.values() if c.stats)
        total_mem = sum(c.stats.memory_usage_mb for c in self.containers.values() if c.stats)
        total_mem_limit = sum(c.memory_limit_mb for c in self.containers.values() if c.memory_limit_mb > 0)

        return {
            "containers": {
                "total": len(self.containers),
                "running": running,
                "stopped": stopped,
                "paused": len([c for c in self.containers.values() if c.status == ContainerStatus.PAUSED]),
            },
            "images": {
                "total": len(self.images),
                "total_size_mb": sum(img.size_mb for img in self.images.values()),
                "with_vulnerabilities": len([img for img in self.images.values() if img.vulnerabilities > 0]),
            },
            "networks": {"total": len(self.networks)},
            "volumes": {
                "total": len(self.volumes),
                "total_size_mb": sum(v.size_mb for v in self.volumes.values()),
                "in_use": len([v for v in self.volumes.values() if v.in_use]),
            },
            "resources": {
                "total_cpu_percent": round(total_cpu, 1),
                "total_memory_mb": round(total_mem, 1),
                "total_memory_limit_mb": total_mem_limit,
                "memory_utilization_percent": round(total_mem / max(1, total_mem_limit) * 100, 1),
            },
            "compose_projects": len(self.compose_projects),
        }

    # Event System
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
