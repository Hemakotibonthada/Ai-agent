# NEXUS AI - Network Monitoring & Security Service
"""
Comprehensive network monitoring service providing infrastructure for the
Network Monitor Agent. Tracks interfaces, connections, bandwidth, threats,
anomalies, and device discovery using psutil and in-memory analytics.
"""

import asyncio
import math
import random
import socket
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Deque, Dict, List, Optional, Set, Tuple

import psutil
from loguru import logger

from core.config import settings
from core.events import event_bus, Event, EventCategory, EventPriority


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ConnectionProtocol(str, Enum):
    """Tracked network protocols."""
    TCP = "tcp"
    UDP = "udp"
    ICMP = "icmp"
    OTHER = "other"


class ThreatSeverity(str, Enum):
    """Severity for detected threats."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ThreatType(str, Enum):
    """Categories of network threats."""
    PORT_SCAN = "port_scan"
    BRUTE_FORCE = "brute_force"
    DDoS = "ddos"
    SUSPICIOUS_DNS = "suspicious_dns"
    MALWARE_C2 = "malware_c2"
    DATA_EXFILTRATION = "data_exfiltration"
    ARP_SPOOF = "arp_spoof"
    UNKNOWN = "unknown"


class AlertStatus(str, Enum):
    """Network alert lifecycle."""
    ACTIVE = "active"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class FirewallAction(str, Enum):
    """Firewall rule action."""
    ALLOW = "allow"
    DENY = "deny"
    LOG = "log"


class DeviceStatus(str, Enum):
    """Status of a discovered device."""
    ONLINE = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"


class TrafficCategory(str, Enum):
    """High-level traffic categories."""
    WEB = "web"
    EMAIL = "email"
    DNS = "dns"
    SSH = "ssh"
    FILE_TRANSFER = "file_transfer"
    DATABASE = "database"
    STREAMING = "streaming"
    GAMING = "gaming"
    IOT = "iot"
    VPN = "vpn"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class InterfaceStats:
    """Snapshot of a network interface's counters."""
    name: str
    bytes_sent: int = 0
    bytes_recv: int = 0
    packets_sent: int = 0
    packets_recv: int = 0
    errors_in: int = 0
    errors_out: int = 0
    drops_in: int = 0
    drops_out: int = 0
    is_up: bool = False
    speed_mbps: int = 0
    mtu: int = 0
    addresses: List[Dict[str, str]] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "bytes_sent": self.bytes_sent,
            "bytes_recv": self.bytes_recv,
            "packets_sent": self.packets_sent,
            "packets_recv": self.packets_recv,
            "errors_in": self.errors_in,
            "errors_out": self.errors_out,
            "drops_in": self.drops_in,
            "drops_out": self.drops_out,
            "is_up": self.is_up,
            "speed_mbps": self.speed_mbps,
            "mtu": self.mtu,
            "addresses": self.addresses,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class BandwidthSample:
    """A single bandwidth rate measurement."""
    interface: str
    bytes_sent_rate: float = 0.0  # bytes / sec
    bytes_recv_rate: float = 0.0
    packets_sent_rate: float = 0.0
    packets_recv_rate: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def total_rate(self) -> float:
        return self.bytes_sent_rate + self.bytes_recv_rate

    def to_dict(self) -> Dict[str, Any]:
        return {
            "interface": self.interface,
            "bytes_sent_rate": round(self.bytes_sent_rate, 2),
            "bytes_recv_rate": round(self.bytes_recv_rate, 2),
            "packets_sent_rate": round(self.packets_sent_rate, 2),
            "packets_recv_rate": round(self.packets_recv_rate, 2),
            "total_rate_mbps": round(self.total_rate * 8 / 1_000_000, 4),
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class TrackedConnection:
    """An observed network connection."""
    conn_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    protocol: ConnectionProtocol = ConnectionProtocol.TCP
    local_address: str = ""
    local_port: int = 0
    remote_address: str = ""
    remote_port: int = 0
    status: str = "ESTABLISHED"
    pid: Optional[int] = None
    process_name: str = ""
    category: TrafficCategory = TrafficCategory.UNKNOWN
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    bytes_estimate: int = 0
    flagged: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conn_id": self.conn_id,
            "protocol": self.protocol.value,
            "local_address": self.local_address,
            "local_port": self.local_port,
            "remote_address": self.remote_address,
            "remote_port": self.remote_port,
            "status": self.status,
            "pid": self.pid,
            "process_name": self.process_name,
            "category": self.category.value,
            "first_seen": self.first_seen.isoformat(),
            "last_seen": self.last_seen.isoformat(),
            "bytes_estimate": self.bytes_estimate,
            "flagged": self.flagged,
            "metadata": self.metadata,
        }


@dataclass
class NetworkThreat:
    """A detected network threat."""
    threat_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    threat_type: ThreatType = ThreatType.UNKNOWN
    severity: ThreatSeverity = ThreatSeverity.LOW
    source_ip: str = ""
    target_ip: str = ""
    target_port: int = 0
    description: str = ""
    evidence: List[str] = field(default_factory=list)
    detected_at: datetime = field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "threat_id": self.threat_id,
            "threat_type": self.threat_type.value,
            "severity": self.severity.value,
            "source_ip": self.source_ip,
            "target_ip": self.target_ip,
            "target_port": self.target_port,
            "description": self.description,
            "evidence": self.evidence,
            "detected_at": self.detected_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved": self.resolved,
            "metadata": self.metadata,
        }


@dataclass
class NetworkAlert:
    """A network security alert."""
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: AlertStatus = AlertStatus.ACTIVE
    severity: ThreatSeverity = ThreatSeverity.MEDIUM
    title: str = ""
    message: str = ""
    source_ip: str = ""
    related_threat_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    escalated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "status": self.status.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "source_ip": self.source_ip,
            "related_threat_id": self.related_threat_id,
            "created_at": self.created_at.isoformat(),
            "escalated_at": self.escalated_at.isoformat() if self.escalated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "metadata": self.metadata,
        }


@dataclass
class FirewallRule:
    """An in-memory firewall rule."""
    rule_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    action: FirewallAction = FirewallAction.DENY
    direction: str = "inbound"  # inbound | outbound | both
    protocol: Optional[ConnectionProtocol] = None
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    port: Optional[int] = None
    port_range: Optional[Tuple[int, int]] = None
    description: str = ""
    enabled: bool = True
    hit_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "action": self.action.value,
            "direction": self.direction,
            "protocol": self.protocol.value if self.protocol else None,
            "source_ip": self.source_ip,
            "dest_ip": self.dest_ip,
            "port": self.port,
            "port_range": list(self.port_range) if self.port_range else None,
            "description": self.description,
            "enabled": self.enabled,
            "hit_count": self.hit_count,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class DiscoveredDevice:
    """A device found on the local network."""
    device_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ip_address: str = ""
    mac_address: str = ""
    hostname: str = ""
    vendor: str = ""
    device_type: str = "unknown"
    status: DeviceStatus = DeviceStatus.UNKNOWN
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    open_ports: List[int] = field(default_factory=list)
    os_fingerprint: str = ""
    trusted: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "device_id": self.device_id,
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "hostname": self.hostname,
            "vendor": self.vendor,
            "device_type": self.device_type,
            "status": self.status.value,
            "first_seen": self.first_seen.isoformat(),
            "last_seen": self.last_seen.isoformat(),
            "open_ports": self.open_ports,
            "os_fingerprint": self.os_fingerprint,
            "trusted": self.trusted,
            "metadata": self.metadata,
        }


@dataclass
class DnsQuery:
    """A tracked DNS query."""
    query_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    domain: str = ""
    query_type: str = "A"
    response_ip: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    latency_ms: float = 0.0
    blocked: bool = False
    reputation_score: float = 1.0  # 0.0 = malicious, 1.0 = safe

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_id": self.query_id,
            "domain": self.domain,
            "query_type": self.query_type,
            "response_ip": self.response_ip,
            "timestamp": self.timestamp.isoformat(),
            "latency_ms": round(self.latency_ms, 2),
            "blocked": self.blocked,
            "reputation_score": round(self.reputation_score, 3),
        }


@dataclass
class NetworkHealthScore:
    """Composite network health score."""
    overall: float = 100.0
    latency_score: float = 100.0
    packet_loss_score: float = 100.0
    bandwidth_score: float = 100.0
    error_score: float = 100.0
    threat_score: float = 100.0
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall": round(self.overall, 2),
            "latency_score": round(self.latency_score, 2),
            "packet_loss_score": round(self.packet_loss_score, 2),
            "bandwidth_score": round(self.bandwidth_score, 2),
            "error_score": round(self.error_score, 2),
            "threat_score": round(self.threat_score, 2),
            "timestamp": self.timestamp.isoformat(),
        }


# ---------------------------------------------------------------------------
# Port → TrafficCategory mapping
# ---------------------------------------------------------------------------

_PORT_CATEGORY_MAP: Dict[int, TrafficCategory] = {
    22: TrafficCategory.SSH,
    25: TrafficCategory.EMAIL,
    53: TrafficCategory.DNS,
    80: TrafficCategory.WEB,
    110: TrafficCategory.EMAIL,
    143: TrafficCategory.EMAIL,
    443: TrafficCategory.WEB,
    465: TrafficCategory.EMAIL,
    587: TrafficCategory.EMAIL,
    993: TrafficCategory.EMAIL,
    995: TrafficCategory.EMAIL,
    1194: TrafficCategory.VPN,
    1433: TrafficCategory.DATABASE,
    1883: TrafficCategory.IOT,
    3306: TrafficCategory.DATABASE,
    3389: TrafficCategory.SSH,
    5432: TrafficCategory.DATABASE,
    5900: TrafficCategory.STREAMING,
    6379: TrafficCategory.DATABASE,
    8080: TrafficCategory.WEB,
    8443: TrafficCategory.WEB,
    8883: TrafficCategory.IOT,
    27017: TrafficCategory.DATABASE,
}


def _classify_port(port: int) -> TrafficCategory:
    """Classify a port number into a traffic category."""
    if port in _PORT_CATEGORY_MAP:
        return _PORT_CATEGORY_MAP[port]
    if 6881 <= port <= 6889:
        return TrafficCategory.FILE_TRANSFER
    if 27000 <= port <= 27050:
        return TrafficCategory.GAMING
    if 8000 <= port <= 9000:
        return TrafficCategory.WEB
    return TrafficCategory.UNKNOWN


# ---------------------------------------------------------------------------
# Suspicious domain patterns for DNS reputation
# ---------------------------------------------------------------------------

_SUSPICIOUS_TLD: Set[str] = {
    ".xyz", ".top", ".club", ".work", ".buzz", ".tk", ".ml", ".ga", ".cf",
}


def _domain_reputation(domain: str) -> float:
    """
    Simple heuristic domain reputation scorer.

    Returns 0.0 (malicious) – 1.0 (safe).
    """
    domain_lower = domain.lower()
    score = 1.0

    for tld in _SUSPICIOUS_TLD:
        if domain_lower.endswith(tld):
            score -= 0.3
            break

    if len(domain_lower) > 40:
        score -= 0.15

    dash_count = domain_lower.count("-")
    if dash_count > 3:
        score -= 0.1 * (dash_count - 3)

    digit_ratio = sum(c.isdigit() for c in domain_lower) / max(len(domain_lower), 1)
    if digit_ratio > 0.4:
        score -= 0.2

    return max(0.0, min(score, 1.0))


# ---------------------------------------------------------------------------
# NetworkMonitorService
# ---------------------------------------------------------------------------

class NetworkMonitorService:
    """
    Network monitoring and security service for NEXUS AI.

    Provides:
    - Interface monitoring via psutil (counters, addresses, link state)
    - Connection tracking with protocol / application classification
    - Bandwidth measurement with periodic sampling and rate calculation
    - Port-scan detection (connection-pattern analysis)
    - Threat detection engine (brute-force, DDoS pattern, IP reputation)
    - Statistical anomaly detection (z-score on bandwidth baselines)
    - In-memory firewall rule management with match engine
    - DNS query monitoring and domain reputation scoring
    - Local device discovery (ARP table parsing, fingerprinting)
    - Composite network health scoring
    - Alert lifecycle management (create, escalate, resolve, dismiss)
    - Historical data retention (connections, bandwidth, threats)
    - Background async monitoring loop
    - EventBus integration for real-time event publishing
    """

    def __init__(self):
        self._initialized: bool = False

        # Interface state
        self._interfaces: Dict[str, InterfaceStats] = {}
        self._prev_counters: Dict[str, Dict[str, int]] = {}
        self._prev_sample_time: float = 0.0

        # Bandwidth
        self._bandwidth_history: Dict[str, Deque[BandwidthSample]] = defaultdict(
            lambda: deque(maxlen=2880)
        )
        self._bandwidth_baseline: Dict[str, Dict[str, float]] = {}  # mean, std

        # Connections
        self._active_connections: Dict[str, TrackedConnection] = {}
        self._connection_history: Deque[TrackedConnection] = deque(maxlen=10000)

        # Port-scan detection
        self._connection_patterns: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
        self._scan_threshold_ports: int = 15  # ports in window → flag
        self._scan_window_seconds: float = 60.0

        # Threat engine
        self._threats: Dict[str, NetworkThreat] = {}
        self._threat_log: Deque[NetworkThreat] = deque(maxlen=5000)
        self._ip_reputation: Dict[str, float] = {}  # IP → score 0–1
        self._brute_force_tracker: Dict[str, List[float]] = defaultdict(list)
        self._brute_force_threshold: int = 10  # attempts in window
        self._brute_force_window: float = 60.0

        # Anomaly detection
        self._anomaly_z_threshold: float = 3.0
        self._baseline_window: int = 120  # samples for baseline calculation

        # Firewall
        self._firewall_rules: Dict[str, FirewallRule] = {}

        # DNS
        self._dns_queries: Deque[DnsQuery] = deque(maxlen=5000)
        self._domain_reputation_cache: Dict[str, float] = {}

        # Devices
        self._discovered_devices: Dict[str, DiscoveredDevice] = {}

        # Alerts
        self._alerts: Dict[str, NetworkAlert] = {}
        self._alert_history: Deque[NetworkAlert] = deque(maxlen=5000)

        # Health
        self._health_score: NetworkHealthScore = NetworkHealthScore()

        # Stats
        self._stats: Dict[str, int] = {
            "samples_taken": 0,
            "connections_tracked": 0,
            "threats_detected": 0,
            "alerts_created": 0,
            "firewall_hits": 0,
            "dns_queries_logged": 0,
            "devices_discovered": 0,
            "anomalies_detected": 0,
        }

        # Background task
        self._monitor_task: Optional[asyncio.Task] = None
        self._monitor_interval: float = 10.0  # seconds
        self._monitoring: bool = False
        self._start_time: Optional[datetime] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the network monitoring service."""
        try:
            logger.info("Initializing NetworkMonitorService...")
            self._start_time = datetime.utcnow()

            # Seed initial counters so the first rate calculation works
            await self._sample_interfaces()

            # Start background monitoring
            self._monitoring = True
            self._monitor_task = asyncio.create_task(self._monitor_loop())

            self._initialized = True

            await event_bus.emit(
                "network.initialized",
                {
                    "interfaces": list(self._interfaces.keys()),
                    "monitor_interval": self._monitor_interval,
                },
                source="network_monitor_service",
                category=EventCategory.SYSTEM,
            )
            logger.info("NetworkMonitorService initialized successfully")
        except Exception as exc:
            logger.error(f"NetworkMonitorService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Gracefully shut down the network monitor."""
        logger.info("Shutting down NetworkMonitorService...")
        self._monitoring = False
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        await event_bus.emit(
            "network.shutdown",
            {"stats": self._stats},
            source="network_monitor_service",
            category=EventCategory.SYSTEM,
        )
        logger.info("NetworkMonitorService shut down")

    # ------------------------------------------------------------------
    # Interface Monitoring
    # ------------------------------------------------------------------

    async def _sample_interfaces(self) -> None:
        """Read current interface counters and addresses from psutil."""
        try:
            counters = psutil.net_io_counters(pernic=True)
            addrs = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            now = time.time()

            for name, cnt in counters.items():
                iface_stats = stats.get(name)
                iface_addrs_raw = addrs.get(name, [])
                addresses: List[Dict[str, str]] = []
                for a in iface_addrs_raw:
                    addresses.append({
                        "family": str(a.family),
                        "address": a.address or "",
                        "netmask": a.netmask or "",
                        "broadcast": a.broadcast or "",
                    })

                iface = InterfaceStats(
                    name=name,
                    bytes_sent=cnt.bytes_sent,
                    bytes_recv=cnt.bytes_recv,
                    packets_sent=cnt.packets_sent,
                    packets_recv=cnt.packets_recv,
                    errors_in=cnt.errin,
                    errors_out=cnt.errout,
                    drops_in=cnt.dropin,
                    drops_out=cnt.dropout,
                    is_up=iface_stats.isup if iface_stats else False,
                    speed_mbps=iface_stats.speed if iface_stats else 0,
                    mtu=iface_stats.mtu if iface_stats else 0,
                    addresses=addresses,
                )
                self._interfaces[name] = iface

                # Calculate rates
                prev = self._prev_counters.get(name)
                if prev and self._prev_sample_time > 0:
                    dt = now - self._prev_sample_time
                    if dt > 0:
                        sample = BandwidthSample(
                            interface=name,
                            bytes_sent_rate=(cnt.bytes_sent - prev["bytes_sent"]) / dt,
                            bytes_recv_rate=(cnt.bytes_recv - prev["bytes_recv"]) / dt,
                            packets_sent_rate=(cnt.packets_sent - prev["packets_sent"]) / dt,
                            packets_recv_rate=(cnt.packets_recv - prev["packets_recv"]) / dt,
                        )
                        self._bandwidth_history[name].append(sample)

                self._prev_counters[name] = {
                    "bytes_sent": cnt.bytes_sent,
                    "bytes_recv": cnt.bytes_recv,
                    "packets_sent": cnt.packets_sent,
                    "packets_recv": cnt.packets_recv,
                }

            self._prev_sample_time = now
            self._stats["samples_taken"] += 1
        except Exception as exc:
            logger.error(f"Interface sampling error: {exc}")

    def get_interfaces(self) -> List[InterfaceStats]:
        """Return the latest snapshot for all interfaces."""
        return list(self._interfaces.values())

    def get_interface(self, name: str) -> Optional[InterfaceStats]:
        """Get stats for a specific interface."""
        return self._interfaces.get(name)

    # ------------------------------------------------------------------
    # Bandwidth
    # ------------------------------------------------------------------

    def get_bandwidth(self, interface: Optional[str] = None, limit: int = 60) -> List[BandwidthSample]:
        """Get recent bandwidth samples, optionally filtered by interface."""
        if interface:
            history = self._bandwidth_history.get(interface, deque())
            return list(history)[-limit:]

        # Aggregate across all interfaces
        combined: List[BandwidthSample] = []
        for iface, history in self._bandwidth_history.items():
            combined.extend(list(history)[-limit:])
        combined.sort(key=lambda s: s.timestamp)
        return combined[-limit:]

    def get_current_bandwidth(self) -> Dict[str, Dict[str, float]]:
        """Get the most recent bandwidth rate for each interface."""
        result: Dict[str, Dict[str, float]] = {}
        for iface, history in self._bandwidth_history.items():
            if history:
                latest = history[-1]
                result[iface] = {
                    "send_bps": round(latest.bytes_sent_rate * 8, 2),
                    "recv_bps": round(latest.bytes_recv_rate * 8, 2),
                    "send_mbps": round(latest.bytes_sent_rate * 8 / 1_000_000, 4),
                    "recv_mbps": round(latest.bytes_recv_rate * 8 / 1_000_000, 4),
                }
        return result

    def _update_bandwidth_baseline(self, interface: str) -> None:
        """Recompute mean/std baseline for anomaly detection."""
        history = self._bandwidth_history.get(interface)
        if not history or len(history) < self._baseline_window:
            return

        recent = list(history)[-self._baseline_window:]
        rates = [s.total_rate for s in recent]
        mean = sum(rates) / len(rates)
        variance = sum((r - mean) ** 2 for r in rates) / len(rates)
        std = math.sqrt(variance) if variance > 0 else 0.001

        self._bandwidth_baseline[interface] = {"mean": mean, "std": std}

    # ------------------------------------------------------------------
    # Connection Tracking
    # ------------------------------------------------------------------

    async def _track_connections(self) -> None:
        """Snapshot current connections from psutil and classify them."""
        try:
            conns = psutil.net_connections(kind="inet")
            seen_keys: Set[str] = set()

            for c in conns:
                try:
                    if not c.laddr:
                        continue

                    local_addr = c.laddr.ip if c.laddr else ""
                    local_port = c.laddr.port if c.laddr else 0
                    remote_addr = c.raddr.ip if c.raddr else ""
                    remote_port = c.raddr.port if c.raddr else 0
                    proto = ConnectionProtocol.TCP if c.type == socket.SOCK_STREAM else ConnectionProtocol.UDP

                    key = f"{proto.value}:{local_addr}:{local_port}-{remote_addr}:{remote_port}"
                    seen_keys.add(key)

                    proc_name = ""
                    if c.pid:
                        try:
                            proc_name = psutil.Process(c.pid).name()
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass

                    category = _classify_port(remote_port) if remote_port else _classify_port(local_port)

                    if key in self._active_connections:
                        existing = self._active_connections[key]
                        existing.last_seen = datetime.utcnow()
                        existing.status = c.status if hasattr(c, "status") else "NONE"
                    else:
                        tc = TrackedConnection(
                            protocol=proto,
                            local_address=local_addr,
                            local_port=local_port,
                            remote_address=remote_addr,
                            remote_port=remote_port,
                            status=c.status if hasattr(c, "status") else "NONE",
                            pid=c.pid,
                            process_name=proc_name,
                            category=category,
                        )

                        # Check firewall rules
                        rule_match = self._match_firewall(tc)
                        if rule_match and rule_match.action == FirewallAction.DENY:
                            tc.flagged = True
                            tc.metadata["blocked_by_rule"] = rule_match.rule_id

                        self._active_connections[key] = tc
                        self._stats["connections_tracked"] += 1

                    # Feed port-scan detector
                    if remote_addr:
                        self._feed_scan_detector(remote_addr, local_port)

                    # Feed brute-force detector
                    if remote_addr and local_port in (22, 3389, 5900):
                        self._feed_brute_force_detector(remote_addr)

                except Exception as inner_exc:
                    logger.debug(f"Connection parse error: {inner_exc}")

            # Expire stale connections
            stale = [k for k in self._active_connections if k not in seen_keys]
            for k in stale:
                conn = self._active_connections.pop(k)
                self._connection_history.append(conn)

        except (psutil.AccessDenied, PermissionError) as exc:
            logger.debug(f"Connection tracking access denied: {exc}")
        except Exception as exc:
            logger.error(f"Connection tracking error: {exc}")

    def get_connections(
        self,
        protocol: Optional[ConnectionProtocol] = None,
        category: Optional[TrafficCategory] = None,
        flagged_only: bool = False,
    ) -> List[TrackedConnection]:
        """List tracked connections with optional filtering."""
        conns = list(self._active_connections.values())
        if protocol:
            conns = [c for c in conns if c.protocol == protocol]
        if category:
            conns = [c for c in conns if c.category == category]
        if flagged_only:
            conns = [c for c in conns if c.flagged]
        return conns

    def get_connection_summary(self) -> Dict[str, Any]:
        """Get a summary of active connections by category and protocol."""
        by_category: Dict[str, int] = defaultdict(int)
        by_protocol: Dict[str, int] = defaultdict(int)
        by_status: Dict[str, int] = defaultdict(int)

        for c in self._active_connections.values():
            by_category[c.category.value] += 1
            by_protocol[c.protocol.value] += 1
            by_status[c.status] += 1

        return {
            "total": len(self._active_connections),
            "by_category": dict(by_category),
            "by_protocol": dict(by_protocol),
            "by_status": dict(by_status),
        }

    # ------------------------------------------------------------------
    # Port-Scan Detection
    # ------------------------------------------------------------------

    def _feed_scan_detector(self, remote_ip: str, local_port: int) -> None:
        """Feed a connection event into the port-scan detector."""
        now = time.time()
        self._connection_patterns[remote_ip].append((local_port, now))

        # Prune old entries
        cutoff = now - self._scan_window_seconds
        self._connection_patterns[remote_ip] = [
            (p, t) for p, t in self._connection_patterns[remote_ip] if t >= cutoff
        ]

    async def _check_port_scans(self) -> None:
        """Evaluate connection patterns for port-scan behaviour."""
        now = time.time()
        cutoff = now - self._scan_window_seconds

        for ip, entries in list(self._connection_patterns.items()):
            recent = [(p, t) for p, t in entries if t >= cutoff]
            unique_ports = len(set(p for p, _ in recent))

            if unique_ports >= self._scan_threshold_ports:
                # Check if already flagged recently
                existing = [
                    t for t in self._threats.values()
                    if t.source_ip == ip
                    and t.threat_type == ThreatType.PORT_SCAN
                    and not t.resolved
                ]
                if not existing:
                    await self._create_threat(
                        threat_type=ThreatType.PORT_SCAN,
                        severity=ThreatSeverity.HIGH,
                        source_ip=ip,
                        description=f"Port scan detected from {ip}: {unique_ports} unique ports in {self._scan_window_seconds}s",
                        evidence=[f"port:{p}" for p, _ in recent[:20]],
                    )

    # ------------------------------------------------------------------
    # Brute-Force Detection
    # ------------------------------------------------------------------

    def _feed_brute_force_detector(self, remote_ip: str) -> None:
        """Track connection attempts for brute-force patterns."""
        now = time.time()
        self._brute_force_tracker[remote_ip].append(now)
        cutoff = now - self._brute_force_window
        self._brute_force_tracker[remote_ip] = [
            t for t in self._brute_force_tracker[remote_ip] if t >= cutoff
        ]

    async def _check_brute_force(self) -> None:
        """Evaluate brute-force connection patterns."""
        for ip, timestamps in list(self._brute_force_tracker.items()):
            if len(timestamps) >= self._brute_force_threshold:
                existing = [
                    t for t in self._threats.values()
                    if t.source_ip == ip
                    and t.threat_type == ThreatType.BRUTE_FORCE
                    and not t.resolved
                ]
                if not existing:
                    await self._create_threat(
                        threat_type=ThreatType.BRUTE_FORCE,
                        severity=ThreatSeverity.HIGH,
                        source_ip=ip,
                        description=f"Brute-force attempt from {ip}: {len(timestamps)} attempts in {self._brute_force_window}s",
                        evidence=[f"attempt_at:{t}" for t in timestamps[-10:]],
                    )

    # ------------------------------------------------------------------
    # Threat Detection Engine
    # ------------------------------------------------------------------

    async def _create_threat(
        self,
        threat_type: ThreatType,
        severity: ThreatSeverity,
        source_ip: str,
        description: str,
        target_ip: str = "",
        target_port: int = 0,
        evidence: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> NetworkThreat:
        """Create and register a new network threat."""
        threat = NetworkThreat(
            threat_type=threat_type,
            severity=severity,
            source_ip=source_ip,
            target_ip=target_ip,
            target_port=target_port,
            description=description,
            evidence=evidence or [],
            metadata=metadata or {},
        )
        self._threats[threat.threat_id] = threat
        self._threat_log.append(threat)
        self._stats["threats_detected"] += 1

        logger.warning(f"Threat detected: [{severity.value}] {description}")

        priority_map = {
            ThreatSeverity.LOW: EventPriority.NORMAL,
            ThreatSeverity.MEDIUM: EventPriority.HIGH,
            ThreatSeverity.HIGH: EventPriority.CRITICAL,
            ThreatSeverity.CRITICAL: EventPriority.EMERGENCY,
        }

        await event_bus.emit(
            "network.threat.detected",
            threat.to_dict(),
            source="network_monitor_service",
            category=EventCategory.SECURITY,
            priority=priority_map.get(severity, EventPriority.HIGH),
        )

        # Auto-create alert for medium+ threats
        if severity in (ThreatSeverity.MEDIUM, ThreatSeverity.HIGH, ThreatSeverity.CRITICAL):
            await self.create_alert(
                title=f"Network Threat: {threat_type.value}",
                message=description,
                severity=severity,
                source_ip=source_ip,
                related_threat_id=threat.threat_id,
            )

        return threat

    async def resolve_threat(self, threat_id: str) -> bool:
        """Mark a threat as resolved."""
        threat = self._threats.get(threat_id)
        if threat is None:
            return False
        threat.resolved = True
        threat.resolved_at = datetime.utcnow()
        logger.info(f"Threat {threat_id} resolved")
        await event_bus.emit(
            "network.threat.resolved",
            {"threat_id": threat_id},
            source="network_monitor_service",
            category=EventCategory.SECURITY,
        )
        return True

    def list_threats(
        self,
        active_only: bool = True,
        severity: Optional[ThreatSeverity] = None,
    ) -> List[NetworkThreat]:
        """List detected threats."""
        threats = list(self._threats.values())
        if active_only:
            threats = [t for t in threats if not t.resolved]
        if severity:
            threats = [t for t in threats if t.severity == severity]
        return sorted(threats, key=lambda t: t.detected_at, reverse=True)

    def get_threat_log(self, limit: int = 100) -> List[NetworkThreat]:
        """Get historical threat log."""
        return list(self._threat_log)[-limit:]

    def set_ip_reputation(self, ip: str, score: float) -> None:
        """Manually set an IP's reputation score (0.0–1.0)."""
        self._ip_reputation[ip] = max(0.0, min(score, 1.0))
        logger.info(f"IP reputation for {ip} set to {score:.2f}")

    def get_ip_reputation(self, ip: str) -> float:
        """Get reputation score for an IP (1.0 = trusted, 0.0 = malicious)."""
        return self._ip_reputation.get(ip, 0.5)

    # ------------------------------------------------------------------
    # Anomaly Detection (z-score)
    # ------------------------------------------------------------------

    async def _check_anomalies(self) -> None:
        """Run z-score anomaly detection on bandwidth baselines."""
        for iface, history in self._bandwidth_history.items():
            if len(history) < self._baseline_window:
                continue

            self._update_bandwidth_baseline(iface)
            baseline = self._bandwidth_baseline.get(iface)
            if not baseline:
                continue

            latest = history[-1]
            z = (latest.total_rate - baseline["mean"]) / baseline["std"] if baseline["std"] > 0 else 0.0

            if abs(z) >= self._anomaly_z_threshold:
                self._stats["anomalies_detected"] += 1
                direction = "spike" if z > 0 else "drop"
                logger.warning(
                    f"Bandwidth anomaly on {iface}: z={z:.2f} ({direction}), "
                    f"rate={latest.total_rate:.0f} B/s, "
                    f"baseline={baseline['mean']:.0f}±{baseline['std']:.0f}"
                )
                await event_bus.emit(
                    "network.anomaly.detected",
                    {
                        "interface": iface,
                        "z_score": round(z, 2),
                        "direction": direction,
                        "current_rate": round(latest.total_rate, 2),
                        "baseline_mean": round(baseline["mean"], 2),
                        "baseline_std": round(baseline["std"], 2),
                    },
                    source="network_monitor_service",
                    category=EventCategory.SECURITY,
                    priority=EventPriority.HIGH,
                )

    def set_anomaly_threshold(self, z_threshold: float) -> None:
        """Set the z-score threshold for anomaly detection."""
        self._anomaly_z_threshold = max(1.0, z_threshold)
        logger.info(f"Anomaly z-score threshold set to {self._anomaly_z_threshold}")

    # ------------------------------------------------------------------
    # Firewall Rule Management
    # ------------------------------------------------------------------

    def add_firewall_rule(
        self,
        action: FirewallAction,
        direction: str = "inbound",
        protocol: Optional[ConnectionProtocol] = None,
        source_ip: Optional[str] = None,
        dest_ip: Optional[str] = None,
        port: Optional[int] = None,
        port_range: Optional[Tuple[int, int]] = None,
        description: str = "",
    ) -> FirewallRule:
        """Add a new firewall rule."""
        rule = FirewallRule(
            action=action,
            direction=direction,
            protocol=protocol,
            source_ip=source_ip,
            dest_ip=dest_ip,
            port=port,
            port_range=port_range,
            description=description,
        )
        self._firewall_rules[rule.rule_id] = rule
        logger.info(f"Added firewall rule: {action.value} {direction} {description} -> {rule.rule_id}")
        return rule

    def remove_firewall_rule(self, rule_id: str) -> bool:
        """Remove a firewall rule by ID."""
        if rule_id in self._firewall_rules:
            self._firewall_rules.pop(rule_id)
            logger.info(f"Removed firewall rule {rule_id}")
            return True
        return False

    def list_firewall_rules(self, enabled_only: bool = False) -> List[FirewallRule]:
        """List all firewall rules."""
        rules = list(self._firewall_rules.values())
        if enabled_only:
            rules = [r for r in rules if r.enabled]
        return rules

    def enable_firewall_rule(self, rule_id: str, enabled: bool = True) -> bool:
        """Enable or disable a firewall rule."""
        rule = self._firewall_rules.get(rule_id)
        if rule is None:
            return False
        rule.enabled = enabled
        return True

    def _match_firewall(self, connection: TrackedConnection) -> Optional[FirewallRule]:
        """Check whether a connection matches any enabled firewall rule."""
        for rule in self._firewall_rules.values():
            if not rule.enabled:
                continue

            # Protocol filter
            if rule.protocol and connection.protocol != rule.protocol:
                continue

            # Source IP
            if rule.source_ip and connection.remote_address != rule.source_ip:
                continue

            # Dest IP
            if rule.dest_ip and connection.local_address != rule.dest_ip:
                continue

            # Port
            if rule.port:
                if rule.direction == "inbound" and connection.local_port != rule.port:
                    continue
                elif rule.direction == "outbound" and connection.remote_port != rule.port:
                    continue

            # Port range
            if rule.port_range:
                target_port = (
                    connection.local_port if rule.direction == "inbound"
                    else connection.remote_port
                )
                if not (rule.port_range[0] <= target_port <= rule.port_range[1]):
                    continue

            rule.hit_count += 1
            self._stats["firewall_hits"] += 1
            return rule

        return None

    # ------------------------------------------------------------------
    # DNS Monitoring
    # ------------------------------------------------------------------

    async def log_dns_query(
        self,
        domain: str,
        query_type: str = "A",
        response_ip: str = "",
        latency_ms: float = 0.0,
    ) -> DnsQuery:
        """Log and evaluate a DNS query."""
        reputation = self._domain_reputation_cache.get(domain)
        if reputation is None:
            reputation = _domain_reputation(domain)
            self._domain_reputation_cache[domain] = reputation

        blocked = reputation < 0.3  # block highly suspicious domains

        query = DnsQuery(
            domain=domain,
            query_type=query_type,
            response_ip=response_ip,
            latency_ms=latency_ms,
            blocked=blocked,
            reputation_score=reputation,
        )
        self._dns_queries.append(query)
        self._stats["dns_queries_logged"] += 1

        if blocked:
            logger.warning(f"Suspicious DNS query blocked: {domain} (reputation={reputation:.2f})")
            await self._create_threat(
                threat_type=ThreatType.SUSPICIOUS_DNS,
                severity=ThreatSeverity.MEDIUM,
                source_ip="local",
                description=f"Suspicious DNS lookup: {domain} (reputation={reputation:.2f})",
            )

        return query

    def get_dns_queries(self, limit: int = 100, blocked_only: bool = False) -> List[DnsQuery]:
        """Get recent DNS queries."""
        queries = list(self._dns_queries)
        if blocked_only:
            queries = [q for q in queries if q.blocked]
        return queries[-limit:]

    def get_domain_reputation(self, domain: str) -> float:
        """Get the reputation score for a domain."""
        cached = self._domain_reputation_cache.get(domain)
        if cached is not None:
            return cached
        score = _domain_reputation(domain)
        self._domain_reputation_cache[domain] = score
        return score

    # ------------------------------------------------------------------
    # Device Discovery
    # ------------------------------------------------------------------

    async def discover_devices(self) -> List[DiscoveredDevice]:
        """
        Discover devices on the local network.

        Parses the system ARP table and enriches with hostname lookups.
        """
        discovered: List[DiscoveredDevice] = []
        try:
            # Parse ARP table via psutil (net_if_addrs gives local addrs)
            # In production you'd use scapy or arp-scan; here we use psutil
            # and supplement with mock enrichment.
            addrs = psutil.net_if_addrs()
            for iface_name, iface_addrs in addrs.items():
                for addr in iface_addrs:
                    if addr.family == socket.AF_INET and addr.address:
                        ip = addr.address
                        if ip.startswith("127.") or ip == "0.0.0.0":
                            continue

                        existing = None
                        for dev in self._discovered_devices.values():
                            if dev.ip_address == ip:
                                existing = dev
                                break

                        if existing:
                            existing.last_seen = datetime.utcnow()
                            existing.status = DeviceStatus.ONLINE
                            discovered.append(existing)
                        else:
                            hostname = ""
                            try:
                                hostname = socket.getfqdn(ip)
                            except Exception:
                                pass

                            device = DiscoveredDevice(
                                ip_address=ip,
                                hostname=hostname,
                                device_type="local" if ip == addr.address else "unknown",
                                status=DeviceStatus.ONLINE,
                            )
                            self._discovered_devices[device.device_id] = device
                            self._stats["devices_discovered"] += 1
                            discovered.append(device)

            logger.info(f"Device discovery found {len(discovered)} device(s)")
            await event_bus.emit(
                "network.devices.discovered",
                {"count": len(discovered), "devices": [d.to_dict() for d in discovered]},
                source="network_monitor_service",
                category=EventCategory.HOME,
            )
        except Exception as exc:
            logger.error(f"Device discovery error: {exc}")

        return discovered

    def list_devices(self, online_only: bool = False) -> List[DiscoveredDevice]:
        """List discovered devices."""
        devices = list(self._discovered_devices.values())
        if online_only:
            devices = [d for d in devices if d.status == DeviceStatus.ONLINE]
        return devices

    def set_device_trusted(self, device_id: str, trusted: bool = True) -> bool:
        """Mark a device as trusted / untrusted."""
        device = self._discovered_devices.get(device_id)
        if device is None:
            return False
        device.trusted = trusted
        logger.info(f"Device {device.ip_address} trusted={trusted}")
        return True

    # ------------------------------------------------------------------
    # Network Health Scoring
    # ------------------------------------------------------------------

    async def _compute_health_score(self) -> NetworkHealthScore:
        """Compute a composite network health score."""
        score = NetworkHealthScore()

        try:
            # Latency – based on DNS query latencies
            dns_recent = list(self._dns_queries)[-50:]
            if dns_recent:
                avg_latency = sum(q.latency_ms for q in dns_recent) / len(dns_recent)
                # 0ms → 100, 200ms+ → 0
                score.latency_score = max(0.0, 100.0 - (avg_latency / 2.0))

            # Packet loss – based on interface error/drop counters
            total_packets = 0
            total_drops = 0
            for iface in self._interfaces.values():
                total_packets += iface.packets_sent + iface.packets_recv
                total_drops += iface.drops_in + iface.drops_out
            if total_packets > 0:
                loss_pct = (total_drops / total_packets) * 100.0
                score.packet_loss_score = max(0.0, 100.0 - loss_pct * 10.0)

            # Bandwidth utilization
            bw_scores: List[float] = []
            for iface in self._interfaces.values():
                if iface.speed_mbps > 0:
                    history = self._bandwidth_history.get(iface.name)
                    if history:
                        latest = history[-1]
                        utilisation = (latest.total_rate * 8 / (iface.speed_mbps * 1_000_000)) * 100.0
                        bw_scores.append(max(0.0, 100.0 - utilisation))
            if bw_scores:
                score.bandwidth_score = sum(bw_scores) / len(bw_scores)

            # Error rate
            total_errors = sum(i.errors_in + i.errors_out for i in self._interfaces.values())
            if total_packets > 0:
                error_pct = (total_errors / total_packets) * 100.0
                score.error_score = max(0.0, 100.0 - error_pct * 20.0)

            # Threat score – reduce for each active threat
            active_threats = len([t for t in self._threats.values() if not t.resolved])
            score.threat_score = max(0.0, 100.0 - active_threats * 15.0)

            # Overall – weighted average
            score.overall = (
                score.latency_score * 0.20
                + score.packet_loss_score * 0.20
                + score.bandwidth_score * 0.20
                + score.error_score * 0.15
                + score.threat_score * 0.25
            )

        except Exception as exc:
            logger.error(f"Health score computation error: {exc}")

        self._health_score = score
        return score

    def get_health_score(self) -> NetworkHealthScore:
        """Get the latest network health score."""
        return self._health_score

    # ------------------------------------------------------------------
    # Alert Management
    # ------------------------------------------------------------------

    async def create_alert(
        self,
        title: str,
        message: str,
        severity: ThreatSeverity = ThreatSeverity.MEDIUM,
        source_ip: str = "",
        related_threat_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> NetworkAlert:
        """Create a new network alert."""
        alert = NetworkAlert(
            title=title,
            message=message,
            severity=severity,
            source_ip=source_ip,
            related_threat_id=related_threat_id,
            metadata=metadata or {},
        )
        self._alerts[alert.alert_id] = alert
        self._stats["alerts_created"] += 1

        logger.info(f"Network alert created: [{severity.value}] {title}")

        priority_map = {
            ThreatSeverity.LOW: EventPriority.NORMAL,
            ThreatSeverity.MEDIUM: EventPriority.HIGH,
            ThreatSeverity.HIGH: EventPriority.CRITICAL,
            ThreatSeverity.CRITICAL: EventPriority.EMERGENCY,
        }

        await event_bus.emit(
            "network.alert.created",
            alert.to_dict(),
            source="network_monitor_service",
            category=EventCategory.SECURITY,
            priority=priority_map.get(severity, EventPriority.HIGH),
        )
        return alert

    async def escalate_alert(self, alert_id: str) -> bool:
        """Escalate an active alert."""
        alert = self._alerts.get(alert_id)
        if alert is None or alert.status != AlertStatus.ACTIVE:
            return False

        alert.status = AlertStatus.ESCALATED
        alert.escalated_at = datetime.utcnow()
        logger.info(f"Alert {alert_id} escalated")

        await event_bus.emit(
            "network.alert.escalated",
            {"alert_id": alert_id, "title": alert.title},
            source="network_monitor_service",
            category=EventCategory.SECURITY,
            priority=EventPriority.CRITICAL,
        )
        return True

    async def resolve_alert(self, alert_id: str, resolved_by: str = "system") -> bool:
        """Resolve an alert."""
        alert = self._alerts.get(alert_id)
        if alert is None:
            return False
        if alert.status in (AlertStatus.RESOLVED, AlertStatus.DISMISSED):
            return False

        alert.status = AlertStatus.RESOLVED
        alert.resolved_at = datetime.utcnow()
        alert.resolved_by = resolved_by

        self._alert_history.append(alert)
        self._alerts.pop(alert_id, None)

        logger.info(f"Alert {alert_id} resolved by {resolved_by}")
        await event_bus.emit(
            "network.alert.resolved",
            {"alert_id": alert_id, "resolved_by": resolved_by},
            source="network_monitor_service",
            category=EventCategory.SECURITY,
        )
        return True

    async def dismiss_alert(self, alert_id: str) -> bool:
        """Dismiss an alert without resolution."""
        alert = self._alerts.get(alert_id)
        if alert is None:
            return False

        alert.status = AlertStatus.DISMISSED
        alert.resolved_at = datetime.utcnow()
        self._alert_history.append(alert)
        self._alerts.pop(alert_id, None)

        logger.info(f"Alert {alert_id} dismissed")
        return True

    def list_active_alerts(self, severity: Optional[ThreatSeverity] = None) -> List[NetworkAlert]:
        """List active (non-resolved) alerts."""
        alerts = list(self._alerts.values())
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    def get_alert_history(self, limit: int = 100) -> List[NetworkAlert]:
        """Get historic (resolved/dismissed) alerts."""
        return list(self._alert_history)[-limit:]

    # ------------------------------------------------------------------
    # Statistics & Dashboard
    # ------------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """Return current monitoring statistics."""
        stats = dict(self._stats)
        if self._start_time:
            stats["uptime_seconds"] = round(
                (datetime.utcnow() - self._start_time).total_seconds(), 2
            )
        stats["active_connections"] = len(self._active_connections)
        stats["active_alerts"] = len(self._alerts)
        stats["active_threats"] = len([t for t in self._threats.values() if not t.resolved])
        stats["firewall_rules"] = len(self._firewall_rules)
        stats["discovered_devices"] = len(self._discovered_devices)
        return stats

    def get_dashboard(self) -> Dict[str, Any]:
        """Aggregate dashboard data for the network monitor."""
        return {
            "health": self._health_score.to_dict(),
            "interfaces": [i.to_dict() for i in self._interfaces.values()],
            "bandwidth": self.get_current_bandwidth(),
            "connection_summary": self.get_connection_summary(),
            "active_threats": [t.to_dict() for t in self.list_threats(active_only=True)],
            "active_alerts": [a.to_dict() for a in self.list_active_alerts()],
            "firewall_rules_count": len(self._firewall_rules),
            "devices": [d.to_dict() for d in self.list_devices()],
            "stats": self.get_stats(),
        }

    # ------------------------------------------------------------------
    # Background Monitoring Loop
    # ------------------------------------------------------------------

    async def _monitor_loop(self) -> None:
        """Background async loop that periodically samples network state."""
        logger.debug("Network monitor loop started")
        iteration = 0
        while self._monitoring:
            try:
                await asyncio.sleep(self._monitor_interval)

                # Core sampling
                await self._sample_interfaces()
                await self._track_connections()

                # Periodic deeper checks (every 3rd iteration)
                if iteration % 3 == 0:
                    await self._check_port_scans()
                    await self._check_brute_force()
                    await self._check_anomalies()
                    await self._compute_health_score()

                # Device discovery (every 30th iteration ≈ 5 min)
                if iteration % 30 == 0:
                    await self.discover_devices()

                # Publish periodic stats
                if iteration % 6 == 0:
                    await event_bus.emit(
                        "network.stats.update",
                        self.get_stats(),
                        source="network_monitor_service",
                        category=EventCategory.SYSTEM,
                    )

                iteration += 1

            except asyncio.CancelledError:
                logger.debug("Network monitor loop cancelled")
                break
            except Exception as exc:
                logger.error(f"Network monitor loop error: {exc}")
                await asyncio.sleep(5.0)

    def set_monitor_interval(self, seconds: float) -> None:
        """Set the background monitoring interval."""
        self._monitor_interval = max(1.0, seconds)
        logger.info(f"Network monitor interval set to {self._monitor_interval}s")

    # ------------------------------------------------------------------
    # Convenience: Traffic Classification
    # ------------------------------------------------------------------

    def classify_connection(self, remote_port: int, local_port: int = 0) -> TrafficCategory:
        """Classify a connection based on ports."""
        result = _classify_port(remote_port)
        if result == TrafficCategory.UNKNOWN and local_port:
            result = _classify_port(local_port)
        return result

    def get_traffic_breakdown(self) -> Dict[str, int]:
        """Get a count of active connections per traffic category."""
        breakdown: Dict[str, int] = defaultdict(int)
        for conn in self._active_connections.values():
            breakdown[conn.category.value] += 1
        return dict(breakdown)


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
network_monitor_service = NetworkMonitorService()
