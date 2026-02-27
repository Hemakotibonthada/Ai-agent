# NEXUS AI - System Monitoring & Management Service
"""
System resource monitoring, process management, auto-optimisation,
and resource allocation for the NEXUS AI OS.
"""

import asyncio
import os
import platform
import signal
import socket
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import psutil
from loguru import logger

try:
    import GPUtil  # type: ignore
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class ResourceType(str, Enum):
    """Types of system resources."""
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    GPU = "gpu"
    NETWORK = "network"
    BATTERY = "battery"


class AlertSeverity(str, Enum):
    """Severity levels for resource alerts."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class OptimisationAction(str, Enum):
    """Types of automatic optimisation actions."""
    MEMORY_CLEANUP = "memory_cleanup"
    CACHE_CLEAR = "cache_clear"
    PROCESS_THROTTLE = "process_throttle"
    SERVICE_RESTART = "service_restart"
    GC_COLLECT = "gc_collect"


@dataclass
class ResourceSnapshot:
    """Point-in-time snapshot of a system resource."""
    resource_type: ResourceType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    value: float = 0.0
    unit: str = "%"
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.resource_type.value,
            "timestamp": self.timestamp.isoformat(),
            "value": round(self.value, 2),
            "unit": self.unit,
            "details": self.details,
        }


@dataclass
class ProcessInfo:
    """Information about a running system process."""
    pid: int
    name: str
    status: str
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    threads: int = 0
    create_time: Optional[datetime] = None
    username: Optional[str] = None
    cmdline: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pid": self.pid,
            "name": self.name,
            "status": self.status,
            "cpu_percent": round(self.cpu_percent, 2),
            "memory_mb": round(self.memory_mb, 2),
            "threads": self.threads,
            "create_time": self.create_time.isoformat() if self.create_time else None,
            "username": self.username,
            "cmdline": self.cmdline,
        }


@dataclass
class ResourceThreshold:
    """Threshold for triggering alerts on a resource."""
    resource_type: ResourceType
    warning: float = 75.0
    critical: float = 90.0
    emergency: float = 95.0
    enabled: bool = True


class SystemService:
    """
    System monitoring and management service for NEXUS AI.

    Provides:
    - Real-time CPU, RAM, GPU, disk, and network monitoring
    - Historical resource usage tracking
    - Process listing, filtering, and management
    - Configurable resource alerts with thresholds
    - Automatic optimisation actions on high resource usage
    - Resource allocation tracking for NEXUS sub-services
    - System information aggregation
    - Periodic health checks
    - Background monitoring loop with configurable interval
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._initialized: bool = False

        # Monitoring state
        self._monitoring: bool = False
        self._monitor_task: Optional[asyncio.Task] = None
        self._monitor_interval: float = 30.0  # seconds
        self._history: Dict[ResourceType, List[ResourceSnapshot]] = {
            rt: [] for rt in ResourceType
        }
        self._history_max_len: int = 2880  # ~24 h at 30 s intervals

        # Thresholds
        self._thresholds: Dict[ResourceType, ResourceThreshold] = {
            ResourceType.CPU: ResourceThreshold(ResourceType.CPU, 80.0, 92.0, 98.0),
            ResourceType.MEMORY: ResourceThreshold(ResourceType.MEMORY, 75.0, 90.0, 95.0),
            ResourceType.DISK: ResourceThreshold(ResourceType.DISK, 80.0, 90.0, 95.0),
            ResourceType.GPU: ResourceThreshold(ResourceType.GPU, 85.0, 95.0, 99.0),
        }

        # Alert tracking (prevent spamming)
        self._last_alerts: Dict[str, datetime] = {}
        self._alert_cooldown: float = 300.0  # seconds

        # Optimisation
        self._auto_optimise: bool = True
        self._optimisation_log: List[Dict[str, Any]] = []

        # Counters
        self._snapshots_taken: int = 0
        self._alerts_emitted: int = 0
        self._optimisations_run: int = 0

        # Resource allocation tracking
        self._allocations: Dict[str, Dict[str, float]] = {}

        # Start time
        self._start_time: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize system monitoring."""
        try:
            logger.info("Initializing SystemService...")
            self._start_time = datetime.utcnow()

            # Pre-warm CPU percent counter (psutil needs two calls)
            psutil.cpu_percent(interval=None)

            await self.take_snapshot()

            self._initialized = True
            await self._event_bus.emit(
                "system.initialized",
                {"platform": platform.system(), "hostname": socket.gethostname()},
                source="system_service",
                category=EventCategory.SYSTEM,
            )
            logger.info("SystemService initialized")
        except Exception as exc:
            logger.error(f"SystemService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Stop monitoring and clean up."""
        try:
            logger.info("Shutting down SystemService...")
            await self.stop_monitoring()
            self._initialized = False
            logger.info("SystemService shut down complete")
        except Exception as exc:
            logger.error(f"Error during SystemService shutdown: {exc}")

    # ------------------------------------------------------------------
    # Monitoring Loop
    # ------------------------------------------------------------------

    async def start_monitoring(self, interval: float = 30.0) -> None:
        """
        Start the background monitoring loop.

        Args:
            interval: Seconds between snapshots.
        """
        if self._monitoring:
            logger.warning("Monitoring is already active")
            return

        self._monitor_interval = interval
        self._monitoring = True
        self._monitor_task = asyncio.create_task(self._monitoring_loop())
        logger.info(f"System monitoring started — interval {interval}s")

    async def stop_monitoring(self) -> None:
        """Stop the background monitoring loop."""
        self._monitoring = False
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        self._monitor_task = None
        logger.info("System monitoring stopped")

    async def _monitoring_loop(self) -> None:
        """Core monitoring loop."""
        while self._monitoring:
            try:
                await self.take_snapshot()
                await self._check_thresholds()

                if self._auto_optimise:
                    await self._auto_optimise_resources()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Monitoring loop error: {exc}")

            await asyncio.sleep(self._monitor_interval)

    # ------------------------------------------------------------------
    # Snapshots
    # ------------------------------------------------------------------

    async def take_snapshot(self) -> Dict[str, Any]:
        """
        Take a full system resource snapshot.

        Returns:
            Dict with all resource snapshots.
        """
        loop = asyncio.get_running_loop()
        snapshot_data = await loop.run_in_executor(None, self._collect_all_metrics)

        for snap in snapshot_data:
            history = self._history[snap.resource_type]
            history.append(snap)
            if len(history) > self._history_max_len:
                history.pop(0)

        self._snapshots_taken += 1
        return {snap.resource_type.value: snap.to_dict() for snap in snapshot_data}

    def _collect_all_metrics(self) -> List[ResourceSnapshot]:
        """Collect all system metrics (runs in executor)."""
        snapshots: List[ResourceSnapshot] = []

        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_freq = psutil.cpu_freq()
        cpu_count_logical = psutil.cpu_count(logical=True)
        cpu_count_physical = psutil.cpu_count(logical=False)
        per_cpu = psutil.cpu_percent(interval=None, percpu=True)
        load_avg = None
        try:
            load_avg = [round(x, 2) for x in psutil.getloadavg()]
        except (AttributeError, OSError):
            pass

        snapshots.append(ResourceSnapshot(
            resource_type=ResourceType.CPU,
            value=cpu_percent,
            unit="%",
            details={
                "per_cpu": per_cpu,
                "logical_cores": cpu_count_logical,
                "physical_cores": cpu_count_physical,
                "frequency_mhz": round(cpu_freq.current, 1) if cpu_freq else None,
                "frequency_max_mhz": round(cpu_freq.max, 1) if cpu_freq and cpu_freq.max else None,
                "load_avg": load_avg,
            },
        ))

        # Memory
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        snapshots.append(ResourceSnapshot(
            resource_type=ResourceType.MEMORY,
            value=mem.percent,
            unit="%",
            details={
                "total_gb": round(mem.total / (1024 ** 3), 2),
                "available_gb": round(mem.available / (1024 ** 3), 2),
                "used_gb": round(mem.used / (1024 ** 3), 2),
                "cached_gb": round(getattr(mem, "cached", 0) / (1024 ** 3), 2),
                "swap_total_gb": round(swap.total / (1024 ** 3), 2),
                "swap_used_gb": round(swap.used / (1024 ** 3), 2),
                "swap_percent": swap.percent,
            },
        ))

        # Disk
        try:
            disk = psutil.disk_usage("/")
        except OSError:
            disk = psutil.disk_usage("C:\\")
        disk_io = None
        try:
            d_io = psutil.disk_io_counters()
            if d_io:
                disk_io = {
                    "read_mb": round(d_io.read_bytes / (1024 ** 2), 2),
                    "write_mb": round(d_io.write_bytes / (1024 ** 2), 2),
                    "read_count": d_io.read_count,
                    "write_count": d_io.write_count,
                }
        except Exception:
            pass

        snapshots.append(ResourceSnapshot(
            resource_type=ResourceType.DISK,
            value=disk.percent,
            unit="%",
            details={
                "total_gb": round(disk.total / (1024 ** 3), 2),
                "used_gb": round(disk.used / (1024 ** 3), 2),
                "free_gb": round(disk.free / (1024 ** 3), 2),
                "io": disk_io,
            },
        ))

        # GPU
        if GPU_AVAILABLE:
            try:
                gpus = GPUtil.getGPUs()
                if gpus:
                    gpu = gpus[0]
                    snapshots.append(ResourceSnapshot(
                        resource_type=ResourceType.GPU,
                        value=gpu.load * 100,
                        unit="%",
                        details={
                            "name": gpu.name,
                            "temperature_c": gpu.temperature,
                            "memory_total_mb": round(gpu.memoryTotal, 1),
                            "memory_used_mb": round(gpu.memoryUsed, 1),
                            "memory_free_mb": round(gpu.memoryFree, 1),
                            "memory_percent": round(gpu.memoryUtil * 100, 1) if gpu.memoryUtil else 0.0,
                            "gpu_count": len(gpus),
                            "all_gpus": [
                                {"id": g.id, "name": g.name, "load": round(g.load * 100, 1),
                                 "temp": g.temperature}
                                for g in gpus
                            ],
                        },
                    ))
            except Exception:
                pass

        # Network
        net_io = psutil.net_io_counters()
        net_connections = 0
        try:
            net_connections = len(psutil.net_connections(kind="inet"))
        except (psutil.AccessDenied, OSError):
            pass

        snapshots.append(ResourceSnapshot(
            resource_type=ResourceType.NETWORK,
            value=0.0,
            unit="bytes",
            details={
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
                "errors_in": net_io.errin,
                "errors_out": net_io.errout,
                "drops_in": net_io.dropin,
                "drops_out": net_io.dropout,
                "connections": net_connections,
            },
        ))

        # Battery
        battery = psutil.sensors_battery()
        if battery:
            snapshots.append(ResourceSnapshot(
                resource_type=ResourceType.BATTERY,
                value=battery.percent,
                unit="%",
                details={
                    "plugged_in": battery.power_plugged,
                    "seconds_left": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else None,
                },
            ))

        return snapshots

    # ------------------------------------------------------------------
    # Threshold Alerts
    # ------------------------------------------------------------------

    def set_threshold(self, resource: ResourceType,
                      warning: float = 75.0, critical: float = 90.0,
                      emergency: float = 95.0) -> None:
        """
        Set alert thresholds for a resource type.

        Args:
            resource: The resource type.
            warning: Warning percentage.
            critical: Critical percentage.
            emergency: Emergency percentage.
        """
        self._thresholds[resource] = ResourceThreshold(
            resource_type=resource,
            warning=warning,
            critical=critical,
            emergency=emergency,
        )

    async def _check_thresholds(self) -> None:
        """Check current resource values against thresholds and emit alerts."""
        for resource_type, threshold in self._thresholds.items():
            if not threshold.enabled:
                continue

            history = self._history.get(resource_type, [])
            if not history:
                continue

            latest = history[-1]
            value = latest.value

            severity: Optional[AlertSeverity] = None
            if value >= threshold.emergency:
                severity = AlertSeverity.EMERGENCY
            elif value >= threshold.critical:
                severity = AlertSeverity.CRITICAL
            elif value >= threshold.warning:
                severity = AlertSeverity.WARNING

            if severity:
                await self._emit_alert(resource_type, severity, value, latest.details)

    async def _emit_alert(self, resource: ResourceType, severity: AlertSeverity,
                          value: float, details: Dict[str, Any]) -> None:
        """Emit a resource alert, respecting cooldown."""
        alert_key = f"{resource.value}_{severity.value}"
        now = datetime.utcnow()

        last = self._last_alerts.get(alert_key)
        if last and (now - last).total_seconds() < self._alert_cooldown:
            return

        self._last_alerts[alert_key] = now
        self._alerts_emitted += 1

        priority_map = {
            AlertSeverity.INFO: EventPriority.LOW,
            AlertSeverity.WARNING: EventPriority.NORMAL,
            AlertSeverity.CRITICAL: EventPriority.HIGH,
            AlertSeverity.EMERGENCY: EventPriority.EMERGENCY,
        }

        nexus_logger.log_system_event(
            f"resource_alert_{severity.value}",
            f"{resource.value} at {value:.1f}%",
            metadata=details,
        )

        await self._event_bus.emit(
            f"system.resource_alert.{resource.value}",
            {
                "resource": resource.value,
                "severity": severity.value,
                "value": round(value, 2),
                "details": details,
            },
            source="system_service",
            category=EventCategory.SYSTEM,
            priority=priority_map.get(severity, EventPriority.NORMAL),
        )

    # ------------------------------------------------------------------
    # Auto-Optimisation
    # ------------------------------------------------------------------

    def set_auto_optimise(self, enabled: bool) -> None:
        """Enable or disable automatic resource optimisation."""
        self._auto_optimise = enabled

    async def _auto_optimise_resources(self) -> None:
        """Run automatic optimisations when resources are under pressure."""
        import gc

        mem_history = self._history.get(ResourceType.MEMORY, [])
        if mem_history:
            mem_pct = mem_history[-1].value
            mem_threshold = self._thresholds[ResourceType.MEMORY]

            if mem_pct >= mem_threshold.critical:
                gc.collect()
                self._log_optimisation(
                    OptimisationAction.GC_COLLECT,
                    f"Garbage collection triggered at {mem_pct:.1f}% memory",
                )

            if mem_pct >= mem_threshold.emergency:
                gc.collect(generation=2)
                self._log_optimisation(
                    OptimisationAction.MEMORY_CLEANUP,
                    f"Full GC triggered at {mem_pct:.1f}% memory",
                )

    def _log_optimisation(self, action: OptimisationAction, detail: str) -> None:
        """Record an optimisation action."""
        entry = {
            "action": action.value,
            "detail": detail,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._optimisation_log.append(entry)
        if len(self._optimisation_log) > 500:
            self._optimisation_log = self._optimisation_log[-250:]
        self._optimisations_run += 1
        logger.debug(f"Auto-optimisation: {action.value} — {detail}")

    # ------------------------------------------------------------------
    # Process Management
    # ------------------------------------------------------------------

    async def list_processes(self, sort_by: str = "cpu",
                             limit: int = 20,
                             filter_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List running processes sorted by resource usage.

        Args:
            sort_by: Sort key — 'cpu', 'memory', 'name', or 'pid'.
            limit: Maximum number of processes to return.
            filter_name: Filter processes whose name contains this string.

        Returns:
            List of process info dicts.
        """
        loop = asyncio.get_running_loop()
        processes = await loop.run_in_executor(
            None, lambda: self._collect_processes(sort_by, limit, filter_name)
        )
        return [p.to_dict() for p in processes]

    def _collect_processes(self, sort_by: str, limit: int,
                           filter_name: Optional[str]) -> List[ProcessInfo]:
        """Collect process info (runs in executor)."""
        procs: List[ProcessInfo] = []
        for proc in psutil.process_iter(
            ["pid", "name", "status", "cpu_percent", "memory_info",
             "num_threads", "create_time", "username", "cmdline"]
        ):
            try:
                info = proc.info
                name = info.get("name", "")
                if filter_name and filter_name.lower() not in (name or "").lower():
                    continue

                mem = info.get("memory_info")
                mem_mb = mem.rss / (1024 ** 2) if mem else 0.0
                ct = info.get("create_time")
                create_dt = datetime.fromtimestamp(ct) if ct else None
                cmdline_parts = info.get("cmdline") or []
                cmdline_str = " ".join(cmdline_parts)[:200] if cmdline_parts else ""

                procs.append(ProcessInfo(
                    pid=info.get("pid", 0),
                    name=name or "",
                    status=info.get("status", ""),
                    cpu_percent=info.get("cpu_percent", 0.0) or 0.0,
                    memory_mb=mem_mb,
                    threads=info.get("num_threads", 0) or 0,
                    create_time=create_dt,
                    username=info.get("username"),
                    cmdline=cmdline_str,
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        sort_keys = {
            "cpu": lambda p: p.cpu_percent,
            "memory": lambda p: p.memory_mb,
            "name": lambda p: p.name.lower(),
            "pid": lambda p: p.pid,
        }
        key_fn = sort_keys.get(sort_by, sort_keys["cpu"])
        procs.sort(key=key_fn, reverse=(sort_by in ("cpu", "memory")))
        return procs[:limit]

    async def get_process_details(self, pid: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed info about a specific process.

        Args:
            pid: Process ID.

        Returns:
            Process details dict or None.
        """
        try:
            proc = psutil.Process(pid)
            with proc.oneshot():
                mem = proc.memory_info()
                cpu = proc.cpu_percent(interval=0.1)
                io_counters = None
                try:
                    io = proc.io_counters()
                    io_counters = {
                        "read_mb": round(io.read_bytes / (1024 ** 2), 2),
                        "write_mb": round(io.write_bytes / (1024 ** 2), 2),
                    }
                except (psutil.AccessDenied, AttributeError):
                    pass

                children = []
                try:
                    for child in proc.children(recursive=True):
                        children.append({"pid": child.pid, "name": child.name()})
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

                return {
                    "pid": pid,
                    "name": proc.name(),
                    "status": proc.status(),
                    "cpu_percent": round(cpu, 2),
                    "memory_mb": round(mem.rss / (1024 ** 2), 2),
                    "memory_vms_mb": round(mem.vms / (1024 ** 2), 2),
                    "threads": proc.num_threads(),
                    "username": proc.username(),
                    "create_time": datetime.fromtimestamp(proc.create_time()).isoformat(),
                    "cmdline": " ".join(proc.cmdline())[:500],
                    "cwd": str(proc.cwd()) if hasattr(proc, "cwd") else None,
                    "io": io_counters,
                    "children": children,
                    "open_files": len(proc.open_files()) if hasattr(proc, "open_files") else 0,
                    "connections": len(proc.connections()) if hasattr(proc, "connections") else 0,
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:
            logger.warning(f"Cannot access process {pid}: {exc}")
            return None

    async def kill_process(self, pid: int, force: bool = False) -> bool:
        """
        Terminate or kill a process.

        Args:
            pid: Process ID.
            force: If True, send SIGKILL; otherwise SIGTERM.

        Returns:
            True on success.
        """
        try:
            proc = psutil.Process(pid)
            proc_name = proc.name()
            if force:
                proc.kill()
            else:
                proc.terminate()

            logger.info(f"{'Killed' if force else 'Terminated'} process {pid} ({proc_name})")
            nexus_logger.log_system_event(
                "process_killed" if force else "process_terminated",
                f"PID {pid} ({proc_name})",
            )
            return True
        except (psutil.NoSuchProcess, psutil.AccessDenied) as exc:
            logger.error(f"Cannot kill process {pid}: {exc}")
            return False

    # ------------------------------------------------------------------
    # Resource Allocation Tracking
    # ------------------------------------------------------------------

    def register_allocation(self, service_name: str,
                            cpu_weight: float = 1.0,
                            memory_mb: float = 0.0) -> None:
        """
        Register a service's resource allocation.

        Args:
            service_name: Name of the service.
            cpu_weight: Relative CPU weight (for priority).
            memory_mb: Expected memory usage in MB.
        """
        self._allocations[service_name] = {
            "cpu_weight": cpu_weight,
            "memory_mb": memory_mb,
            "registered_at": datetime.utcnow().isoformat(),
        }

    def unregister_allocation(self, service_name: str) -> None:
        """Remove a service's allocation."""
        self._allocations.pop(service_name, None)

    def get_allocations(self) -> Dict[str, Dict[str, float]]:
        """Get all service resource allocations."""
        return dict(self._allocations)

    # ------------------------------------------------------------------
    # System Information
    # ------------------------------------------------------------------

    async def get_system_info(self) -> Dict[str, Any]:
        """
        Get comprehensive system information.

        Returns:
            Dict of system details.
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._gather_system_info)

    def _gather_system_info(self) -> Dict[str, Any]:
        """Gather static system info (runs in executor)."""
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = datetime.utcnow() - boot_time

        info: Dict[str, Any] = {
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
                "processor": platform.processor(),
                "python_version": platform.python_version(),
            },
            "hostname": socket.gethostname(),
            "boot_time": boot_time.isoformat(),
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_human": str(uptime).split(".")[0],
            "cpu": {
                "physical_cores": psutil.cpu_count(logical=False),
                "logical_cores": psutil.cpu_count(logical=True),
            },
            "memory": {
                "total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
            },
            "disks": [],
        }

        cpu_freq = psutil.cpu_freq()
        if cpu_freq:
            info["cpu"]["max_frequency_mhz"] = round(cpu_freq.max, 1)
            info["cpu"]["min_frequency_mhz"] = round(cpu_freq.min, 1)

        for part in psutil.disk_partitions(all=False):
            try:
                usage = psutil.disk_usage(part.mountpoint)
                info["disks"].append({
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "fstype": part.fstype,
                    "total_gb": round(usage.total / (1024 ** 3), 2),
                    "used_gb": round(usage.used / (1024 ** 3), 2),
                    "free_gb": round(usage.free / (1024 ** 3), 2),
                    "percent": usage.percent,
                })
            except (PermissionError, OSError):
                continue

        if GPU_AVAILABLE:
            try:
                gpus = GPUtil.getGPUs()
                info["gpus"] = [
                    {
                        "id": g.id,
                        "name": g.name,
                        "driver": g.driver,
                        "memory_total_mb": round(g.memoryTotal, 1),
                    }
                    for g in gpus
                ]
            except Exception:
                info["gpus"] = []

        nics = psutil.net_if_addrs()
        info["network_interfaces"] = list(nics.keys())

        return info

    # ------------------------------------------------------------------
    # History & Trends
    # ------------------------------------------------------------------

    def get_history(self, resource: ResourceType,
                    minutes: int = 60) -> List[Dict[str, Any]]:
        """
        Get historical snapshots for a resource.

        Args:
            resource: Resource type.
            minutes: How far back to look.

        Returns:
            List of snapshot dicts.
        """
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        return [
            snap.to_dict() for snap in self._history.get(resource, [])
            if snap.timestamp >= cutoff
        ]

    def get_resource_trend(self, resource: ResourceType,
                           minutes: int = 30) -> Dict[str, Any]:
        """
        Compute a simple trend for a resource.

        Returns:
            Dict with current, avg, min, max, and trend direction.
        """
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        snapshots = [
            s for s in self._history.get(resource, [])
            if s.timestamp >= cutoff
        ]

        if not snapshots:
            return {"trend": "unknown", "data_points": 0}

        values = [s.value for s in snapshots]
        current = values[-1]
        avg = sum(values) / len(values)
        mn = min(values)
        mx = max(values)

        if len(values) >= 3:
            first_half_avg = sum(values[:len(values) // 2]) / (len(values) // 2)
            second_half_avg = sum(values[len(values) // 2:]) / (len(values) - len(values) // 2)
            diff = second_half_avg - first_half_avg
            if diff > 2.0:
                trend = "rising"
            elif diff < -2.0:
                trend = "falling"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"

        return {
            "resource": resource.value,
            "current": round(current, 2),
            "average": round(avg, 2),
            "min": round(mn, 2),
            "max": round(mx, 2),
            "trend": trend,
            "data_points": len(values),
            "period_minutes": minutes,
        }

    # ------------------------------------------------------------------
    # Quick Accessors
    # ------------------------------------------------------------------

    async def get_cpu_usage(self) -> Dict[str, Any]:
        """Get current CPU usage."""
        loop = asyncio.get_running_loop()
        pct = await loop.run_in_executor(None, lambda: psutil.cpu_percent(interval=0.5))
        per_cpu = psutil.cpu_percent(percpu=True)
        return {"overall": pct, "per_cpu": per_cpu}

    async def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage."""
        mem = psutil.virtual_memory()
        return {
            "percent": mem.percent,
            "total_gb": round(mem.total / (1024 ** 3), 2),
            "available_gb": round(mem.available / (1024 ** 3), 2),
            "used_gb": round(mem.used / (1024 ** 3), 2),
        }

    async def get_disk_usage(self, path: str = "/") -> Dict[str, Any]:
        """Get disk usage for a given path."""
        try:
            usage = psutil.disk_usage(path)
        except OSError:
            usage = psutil.disk_usage("C:\\")
        return {
            "percent": usage.percent,
            "total_gb": round(usage.total / (1024 ** 3), 2),
            "free_gb": round(usage.free / (1024 ** 3), 2),
        }

    async def get_gpu_usage(self) -> Optional[Dict[str, Any]]:
        """Get GPU usage if available."""
        if not GPU_AVAILABLE:
            return None
        try:
            gpus = GPUtil.getGPUs()
            if not gpus:
                return None
            gpu = gpus[0]
            return {
                "name": gpu.name,
                "load_percent": round(gpu.load * 100, 1),
                "memory_used_mb": round(gpu.memoryUsed, 1),
                "memory_total_mb": round(gpu.memoryTotal, 1),
                "temperature_c": gpu.temperature,
            }
        except Exception:
            return None

    async def get_network_io(self) -> Dict[str, Any]:
        """Get current network IO counters."""
        io = psutil.net_io_counters()
        return {
            "bytes_sent_mb": round(io.bytes_sent / (1024 ** 2), 2),
            "bytes_recv_mb": round(io.bytes_recv / (1024 ** 2), 2),
            "packets_sent": io.packets_sent,
            "packets_recv": io.packets_recv,
            "errors_in": io.errin,
            "errors_out": io.errout,
        }

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return system service health status."""
        mem = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        return {
            "service": "system_service",
            "initialized": self._initialized,
            "monitoring": self._monitoring,
            "cpu_percent": cpu,
            "memory_percent": mem.percent,
            "snapshots_taken": self._snapshots_taken,
            "alerts_emitted": self._alerts_emitted,
            "optimisations_run": self._optimisations_run,
            "uptime_seconds": (
                int((datetime.utcnow() - self._start_time).total_seconds())
                if self._start_time else 0
            ),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "monitoring": self._monitoring,
            "monitor_interval": self._monitor_interval,
            "auto_optimise": self._auto_optimise,
            "snapshots_taken": self._snapshots_taken,
            "alerts_emitted": self._alerts_emitted,
            "optimisations_run": self._optimisations_run,
            "history_sizes": {
                rt.value: len(self._history[rt]) for rt in ResourceType
            },
            "allocations_count": len(self._allocations),
            "thresholds": {
                rt.value: {
                    "warning": t.warning,
                    "critical": t.critical,
                    "emergency": t.emergency,
                }
                for rt, t in self._thresholds.items()
            },
        }
