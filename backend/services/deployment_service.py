"""
Deployment Service - Application deployment and infrastructure management
Supports multi-environment deployments, rollbacks, and health monitoring
"""
import asyncio
import uuid
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from enum import Enum
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import logging
from services.demo_data_manager import is_demo_data_enabled

logger = logging.getLogger(__name__)


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    BUILDING = "building"
    DEPLOYING = "deploying"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    CANARY = "canary"


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ServiceConfig:
    name: str
    image: str = ""
    port: int = 8000
    replicas: int = 1
    cpu_limit: str = "1000m"
    memory_limit: str = "512Mi"
    env_vars: Dict[str, str] = field(default_factory=dict)
    health_check_path: str = "/health"
    health_check_interval: int = 30
    auto_scale: bool = False
    min_replicas: int = 1
    max_replicas: int = 10
    scale_cpu_threshold: int = 80


@dataclass
class Deployment:
    id: str
    service_name: str
    environment: Environment
    version: str
    status: DeploymentStatus
    branch: str = "main"
    commit_hash: str = ""
    config: ServiceConfig = field(default_factory=lambda: ServiceConfig(name="default"))
    health: HealthStatus = HealthStatus.UNKNOWN
    instances: int = 1
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    request_count: int = 0
    error_rate: float = 0.0
    avg_latency: float = 0.0
    deployed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    deployed_by: str = "system"
    uptime_seconds: int = 0
    rollback_to: Optional[str] = None
    health_checks: List[Dict[str, Any]] = field(default_factory=list)
    deployment_log: List[Dict[str, str]] = field(default_factory=list)
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class DeploymentPipeline:
    id: str
    name: str
    service_name: str
    stages: List[Dict[str, Any]]
    trigger: str = "manual"  # manual, push, schedule
    branch_pattern: str = "*"
    auto_deploy: bool = False
    approval_required: bool = True
    notification_channels: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class RollbackRecord:
    id: str
    deployment_id: str
    from_version: str
    to_version: str
    reason: str
    performed_by: str
    performed_at: str
    status: str = "completed"


class HealthChecker:
    """Performs health checks on deployments."""
    
    def __init__(self):
        self.check_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    
    async def check(self, deployment: Deployment) -> Dict[str, Any]:
        """Perform health check on a deployment."""
        checks = []
        
        # HTTP health check
        http_check = {
            "name": f"HTTP {deployment.config.health_check_path}",
            "status": "pass" if deployment.status == DeploymentStatus.RUNNING else "fail",
            "latency_ms": round(10 + deployment.avg_latency * 0.3, 1),
            "timestamp": datetime.utcnow().isoformat(),
        }
        checks.append(http_check)
        
        # CPU check
        cpu_check = {
            "name": "CPU Usage",
            "status": "pass" if deployment.cpu_usage < 80 else ("warn" if deployment.cpu_usage < 95 else "fail"),
            "value": f"{deployment.cpu_usage:.1f}%",
            "threshold": "80%",
            "timestamp": datetime.utcnow().isoformat(),
        }
        checks.append(cpu_check)
        
        # Memory check
        mem_check = {
            "name": "Memory Usage",
            "status": "pass" if deployment.memory_usage < 85 else ("warn" if deployment.memory_usage < 95 else "fail"),
            "value": f"{deployment.memory_usage:.1f}%",
            "threshold": "85%",
            "timestamp": datetime.utcnow().isoformat(),
        }
        checks.append(mem_check)
        
        # Error rate check
        error_check = {
            "name": "Error Rate",
            "status": "pass" if deployment.error_rate < 1 else ("warn" if deployment.error_rate < 5 else "fail"),
            "value": f"{deployment.error_rate:.2f}%",
            "threshold": "1%",
            "timestamp": datetime.utcnow().isoformat(),
        }
        checks.append(error_check)
        
        # Determine overall health
        statuses = [c["status"] for c in checks]
        if "fail" in statuses:
            overall = HealthStatus.UNHEALTHY
        elif "warn" in statuses:
            overall = HealthStatus.DEGRADED
        else:
            overall = HealthStatus.HEALTHY
        
        result = {
            "deployment_id": deployment.id,
            "overall": overall.value,
            "checks": checks,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        self.check_history[deployment.id].append(result)
        # Keep last 100 checks
        if len(self.check_history[deployment.id]) > 100:
            self.check_history[deployment.id] = self.check_history[deployment.id][-100:]
        
        return result


class AutoScaler:
    """Auto-scales deployments based on metrics."""
    
    def __init__(self):
        self.scaling_events: List[Dict[str, Any]] = []
    
    async def evaluate(self, deployment: Deployment) -> Optional[Dict[str, Any]]:
        """Evaluate if scaling is needed."""
        if not deployment.config.auto_scale:
            return None
        
        current = deployment.instances
        desired = current
        reason = ""
        
        # Scale up
        if deployment.cpu_usage > deployment.config.scale_cpu_threshold:
            desired = min(current + 1, deployment.config.max_replicas)
            reason = f"CPU usage {deployment.cpu_usage:.1f}% > {deployment.config.scale_cpu_threshold}%"
        
        # Scale down
        elif deployment.cpu_usage < deployment.config.scale_cpu_threshold * 0.5 and current > deployment.config.min_replicas:
            desired = max(current - 1, deployment.config.min_replicas)
            reason = f"CPU usage {deployment.cpu_usage:.1f}% < {deployment.config.scale_cpu_threshold * 0.5:.0f}%"
        
        if desired != current:
            event = {
                "deployment_id": deployment.id,
                "from_instances": current,
                "to_instances": desired,
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat(),
            }
            self.scaling_events.append(event)
            return event
        
        return None


class DeploymentService:
    """Complete deployment management service."""
    
    def __init__(self):
        self.deployments: Dict[str, Deployment] = {}
        self.pipelines: Dict[str, DeploymentPipeline] = {}
        self.rollback_history: List[RollbackRecord] = []
        self.health_checker = HealthChecker()
        self.auto_scaler = AutoScaler()
        self.audit_log: List[Dict[str, Any]] = []
        if is_demo_data_enabled():
            self._init_sample_data()
    
    def _init_sample_data(self):
        """Initialize with sample deployments."""
        services = [
            ("nexus-api", "v2.4.1", Environment.PRODUCTION, DeploymentStatus.RUNNING, 3, 34.0, 62.0),
            ("nexus-frontend", "v2.4.1", Environment.PRODUCTION, DeploymentStatus.RUNNING, 2, 12.0, 38.0),
            ("nexus-workers", "v2.4.0", Environment.PRODUCTION, DeploymentStatus.RUNNING, 4, 78.0, 71.0),
            ("nexus-api", "v2.5.0-rc1", Environment.STAGING, DeploymentStatus.DEPLOYING, 1, 67.0, 45.0),
            ("nexus-ml", "v0.3.0-dev", Environment.DEVELOPMENT, DeploymentStatus.STOPPED, 0, 0.0, 0.0),
        ]
        
        for name, version, env, status, instances, cpu, memory in services:
            dep_id = str(uuid.uuid4())
            config = ServiceConfig(
                name=name,
                port=8000 if "api" in name else (5173 if "frontend" in name else 8001),
                replicas=instances,
                auto_scale=env == Environment.PRODUCTION,
            )
            
            deployment = Deployment(
                id=dep_id,
                service_name=name,
                environment=env,
                version=version,
                status=status,
                branch="main" if env == Environment.PRODUCTION else f"feature/{name}",
                commit_hash=hashlib.sha1(f"{name}{version}".encode()).hexdigest()[:7],
                config=config,
                health=HealthStatus.HEALTHY if status == DeploymentStatus.RUNNING else HealthStatus.UNKNOWN,
                instances=instances,
                cpu_usage=cpu,
                memory_usage=memory,
                deployed_by="CI/CD Pipeline" if env == Environment.PRODUCTION else "admin",
            )
            self.deployments[dep_id] = deployment
        
        # Sample pipelines
        self.pipelines["pipe-1"] = DeploymentPipeline(
            id="pipe-1",
            name="API Production Pipeline",
            service_name="nexus-api",
            stages=[
                {"name": "Build", "type": "build", "timeout": 300},
                {"name": "Unit Tests", "type": "test", "timeout": 600},
                {"name": "Integration Tests", "type": "test", "timeout": 900},
                {"name": "Deploy Staging", "type": "deploy", "environment": "staging"},
                {"name": "Smoke Tests", "type": "test", "timeout": 120},
                {"name": "Deploy Production", "type": "deploy", "environment": "production", "approval_required": True},
            ],
            trigger="push",
            branch_pattern="main",
        )
        
        self.pipelines["pipe-2"] = DeploymentPipeline(
            id="pipe-2",
            name="Frontend CI/CD",
            service_name="nexus-frontend",
            stages=[
                {"name": "Install Dependencies", "type": "build", "timeout": 180},
                {"name": "Lint & Type Check", "type": "test", "timeout": 120},
                {"name": "Build", "type": "build", "timeout": 300},
                {"name": "Deploy", "type": "deploy", "environment": "production"},
            ],
            trigger="push",
            branch_pattern="main",
        )
    
    async def create_deployment(
        self,
        service_name: str,
        version: str,
        environment: Environment,
        config: Optional[Dict[str, Any]] = None,
        deployed_by: str = "system",
    ) -> Dict[str, Any]:
        """Create a new deployment."""
        dep_id = str(uuid.uuid4())
        
        svc_config = ServiceConfig(name=service_name)
        if config:
            for k, v in config.items():
                if hasattr(svc_config, k):
                    setattr(svc_config, k, v)
        
        deployment = Deployment(
            id=dep_id,
            service_name=service_name,
            environment=environment,
            version=version,
            status=DeploymentStatus.PENDING,
            config=svc_config,
            deployed_by=deployed_by,
        )
        
        self.deployments[dep_id] = deployment
        self._log_audit("create", dep_id, deployed_by, f"Created deployment {service_name} {version} to {environment.value}")
        
        # Simulate deployment process
        await self._execute_deployment(dep_id)
        
        return asdict(self.deployments[dep_id])
    
    async def _execute_deployment(self, deployment_id: str):
        """Execute deployment steps."""
        dep = self.deployments.get(deployment_id)
        if not dep:
            return
        
        try:
            # Building
            dep.status = DeploymentStatus.BUILDING
            dep.deployment_log.append({"step": "build", "status": "started", "time": datetime.utcnow().isoformat()})
            await asyncio.sleep(0.1)
            dep.deployment_log.append({"step": "build", "status": "completed", "time": datetime.utcnow().isoformat()})
            
            # Deploying
            dep.status = DeploymentStatus.DEPLOYING
            dep.deployment_log.append({"step": "deploy", "status": "started", "time": datetime.utcnow().isoformat()})
            await asyncio.sleep(0.1)
            
            # Running
            dep.status = DeploymentStatus.RUNNING
            dep.health = HealthStatus.HEALTHY
            dep.instances = dep.config.replicas
            dep.deployment_log.append({"step": "deploy", "status": "completed", "time": datetime.utcnow().isoformat()})
            
        except Exception as e:
            dep.status = DeploymentStatus.FAILED
            dep.health = HealthStatus.UNHEALTHY
            dep.deployment_log.append({"step": "error", "status": str(e), "time": datetime.utcnow().isoformat()})
    
    async def rollback(
        self,
        deployment_id: str,
        target_version: str,
        reason: str = "Manual rollback",
        performed_by: str = "admin",
    ) -> Dict[str, Any]:
        """Rollback a deployment to a previous version."""
        dep = self.deployments.get(deployment_id)
        if not dep:
            return {"success": False, "error": "Deployment not found"}
        
        from_version = dep.version
        
        # Record rollback
        record = RollbackRecord(
            id=str(uuid.uuid4()),
            deployment_id=deployment_id,
            from_version=from_version,
            to_version=target_version,
            reason=reason,
            performed_by=performed_by,
            performed_at=datetime.utcnow().isoformat(),
        )
        self.rollback_history.append(record)
        
        # Execute rollback
        dep.status = DeploymentStatus.ROLLING_BACK
        dep.rollback_to = target_version
        await asyncio.sleep(0.1)
        
        dep.version = target_version
        dep.status = DeploymentStatus.RUNNING
        dep.health = HealthStatus.HEALTHY
        dep.rollback_to = None
        
        self._log_audit("rollback", deployment_id, performed_by, f"Rolled back from {from_version} to {target_version}: {reason}")
        
        return {"success": True, "rollback": asdict(record)}
    
    async def stop_deployment(self, deployment_id: str, stopped_by: str = "admin") -> Dict[str, Any]:
        dep = self.deployments.get(deployment_id)
        if not dep:
            return {"success": False, "error": "Deployment not found"}
        
        dep.status = DeploymentStatus.STOPPING
        await asyncio.sleep(0.05)
        dep.status = DeploymentStatus.STOPPED
        dep.instances = 0
        dep.cpu_usage = 0
        dep.memory_usage = 0
        dep.health = HealthStatus.UNKNOWN
        
        self._log_audit("stop", deployment_id, stopped_by, f"Stopped {dep.service_name} {dep.version}")
        return {"success": True, "deployment": asdict(dep)}
    
    async def restart_deployment(self, deployment_id: str, restarted_by: str = "admin") -> Dict[str, Any]:
        dep = self.deployments.get(deployment_id)
        if not dep:
            return {"success": False, "error": "Deployment not found"}
        
        dep.status = DeploymentStatus.DEPLOYING
        await asyncio.sleep(0.1)
        dep.status = DeploymentStatus.RUNNING
        dep.instances = dep.config.replicas
        dep.health = HealthStatus.HEALTHY
        
        self._log_audit("restart", deployment_id, restarted_by, f"Restarted {dep.service_name}")
        return {"success": True, "deployment": asdict(dep)}
    
    async def scale(self, deployment_id: str, instances: int, scaled_by: str = "admin") -> Dict[str, Any]:
        dep = self.deployments.get(deployment_id)
        if not dep:
            return {"success": False, "error": "Deployment not found"}
        
        old_instances = dep.instances
        dep.instances = max(0, min(instances, dep.config.max_replicas))
        dep.config.replicas = dep.instances
        
        if dep.instances == 0:
            dep.status = DeploymentStatus.STOPPED
        elif dep.status == DeploymentStatus.STOPPED:
            dep.status = DeploymentStatus.RUNNING
        
        self._log_audit("scale", deployment_id, scaled_by, f"Scaled {old_instances} -> {dep.instances}")
        return {"success": True, "from": old_instances, "to": dep.instances}
    
    async def health_check(self, deployment_id: str) -> Dict[str, Any]:
        dep = self.deployments.get(deployment_id)
        if not dep:
            return {"error": "Deployment not found"}
        
        result = await self.health_checker.check(dep)
        dep.health = HealthStatus(result["overall"])
        dep.health_checks = result["checks"]
        return result
    
    def list_deployments(
        self,
        environment: Optional[Environment] = None,
        service_name: Optional[str] = None,
        status: Optional[DeploymentStatus] = None,
    ) -> List[Dict[str, Any]]:
        deployments = list(self.deployments.values())
        
        if environment:
            deployments = [d for d in deployments if d.environment == environment]
        if service_name:
            deployments = [d for d in deployments if d.service_name == service_name]
        if status:
            deployments = [d for d in deployments if d.status == status]
        
        return [asdict(d) for d in deployments]
    
    def get_deployment(self, deployment_id: str) -> Optional[Dict[str, Any]]:
        dep = self.deployments.get(deployment_id)
        return asdict(dep) if dep else None
    
    def list_pipelines(self) -> List[Dict[str, Any]]:
        return [asdict(p) for p in self.pipelines.values()]
    
    def get_rollback_history(self, deployment_id: Optional[str] = None) -> List[Dict[str, Any]]:
        records = self.rollback_history
        if deployment_id:
            records = [r for r in records if r.deployment_id == deployment_id]
        return [asdict(r) for r in records]
    
    def get_stats(self) -> Dict[str, Any]:
        by_env: Dict[str, int] = defaultdict(int)
        by_status: Dict[str, int] = defaultdict(int)
        by_health: Dict[str, int] = defaultdict(int)
        total_instances = 0
        
        for d in self.deployments.values():
            by_env[d.environment.value] += 1
            by_status[d.status.value] += 1
            by_health[d.health.value] += 1
            total_instances += d.instances
        
        return {
            "total_deployments": len(self.deployments),
            "total_instances": total_instances,
            "by_environment": dict(by_env),
            "by_status": dict(by_status),
            "by_health": dict(by_health),
            "pipeline_count": len(self.pipelines),
            "rollback_count": len(self.rollback_history),
            "scaling_events": len(self.auto_scaler.scaling_events),
        }
    
    def _log_audit(self, action: str, deployment_id: str, user: str, message: str):
        self.audit_log.append({
            "action": action,
            "deployment_id": deployment_id,
            "user": user,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def get_audit_log(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.audit_log[-limit:]


# Singleton
_deployment_service: Optional[DeploymentService] = None

def get_deployment_service() -> DeploymentService:
    global _deployment_service
    if _deployment_service is None:
        _deployment_service = DeploymentService()
    return _deployment_service
