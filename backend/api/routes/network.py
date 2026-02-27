# NEXUS AI - Network Monitoring API Routes
"""
Endpoints for network interface monitoring, bandwidth tracking,
threat detection, anomaly analysis, firewall rules, DNS queries,
device discovery, and network health scoring.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.dependencies import get_engine


# ============================================================
# Request / Response Models
# ============================================================

class NetworkInterface(BaseModel):
    """Network interface information."""
    name: str
    display_name: str
    is_up: bool = True
    speed_mbps: Optional[int] = None
    mtu: int = 1500
    mac_address: Optional[str] = None
    ipv4_address: Optional[str] = None
    ipv6_address: Optional[str] = None
    bytes_sent: int = 0
    bytes_recv: int = 0
    packets_sent: int = 0
    packets_recv: int = 0
    errors_in: int = 0
    errors_out: int = 0


class NetworkConnection(BaseModel):
    """An active network connection."""
    fd: Optional[int] = None
    family: str = "IPv4"
    type: str = "TCP"
    local_address: str
    local_port: int
    remote_address: Optional[str] = None
    remote_port: Optional[int] = None
    status: str = "ESTABLISHED"
    pid: Optional[int] = None
    process_name: Optional[str] = None


class ConnectionSummaryResponse(BaseModel):
    """Connection statistics summary."""
    total_connections: int = 0
    by_status: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    by_family: Dict[str, int] = {}
    top_processes: List[Dict[str, Any]] = []
    timestamp: str


class BandwidthUsage(BaseModel):
    """Current bandwidth usage per interface."""
    interface: str
    bytes_sent_per_sec: float = 0.0
    bytes_recv_per_sec: float = 0.0
    mbps_sent: float = 0.0
    mbps_recv: float = 0.0
    total_bytes_sent: int = 0
    total_bytes_recv: int = 0
    timestamp: str


class BandwidthHistoryEntry(BaseModel):
    """A single bandwidth history data point."""
    timestamp: str
    bytes_sent_per_sec: float
    bytes_recv_per_sec: float
    interface: str


class BandwidthHistoryResponse(BaseModel):
    """Bandwidth history over time."""
    interface: str
    entries: List[BandwidthHistoryEntry] = []
    time_range_minutes: int = 60
    timestamp: str


class NetworkThreat(BaseModel):
    """A detected network threat."""
    id: str
    threat_type: str
    severity: str = "medium"
    source_ip: str
    source_port: Optional[int] = None
    destination_ip: Optional[str] = None
    destination_port: Optional[int] = None
    protocol: str = "TCP"
    description: str
    blocked: bool = False
    dismissed: bool = False
    detected_at: str


class ThreatSummaryResponse(BaseModel):
    """Threat summary and severity distribution."""
    total_threats: int = 0
    active_threats: int = 0
    blocked_threats: int = 0
    dismissed_threats: int = 0
    by_severity: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    recent_sources: List[str] = []
    timestamp: str


class ThreatActionResponse(BaseModel):
    """Response after blocking or dismissing a threat."""
    threat_id: str
    action: str
    success: bool
    message: str
    timestamp: str


class NetworkAnomaly(BaseModel):
    """A detected network anomaly."""
    id: str
    anomaly_type: str
    severity: str = "low"
    description: str
    affected_interface: Optional[str] = None
    metric_name: str
    expected_value: float
    actual_value: float
    deviation_percent: float
    detected_at: str


class NetworkDevice(BaseModel):
    """A discovered network device."""
    id: str
    ip_address: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    device_type: str = "unknown"
    vendor: Optional[str] = None
    is_trusted: bool = False
    first_seen: str
    last_seen: str
    open_ports: List[int] = []


class DeviceTrustResponse(BaseModel):
    """Response after marking a device as trusted."""
    device_id: str
    is_trusted: bool
    message: str
    timestamp: str


class FirewallRule(BaseModel):
    """A firewall rule."""
    id: str
    name: str
    direction: str = "inbound"
    action: str = "block"
    protocol: str = "TCP"
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    port: Optional[int] = None
    port_range: Optional[str] = None
    enabled: bool = True
    created_at: str


class FirewallRuleCreateRequest(BaseModel):
    """Request to create a firewall rule."""
    name: str = Field(..., min_length=1, max_length=100)
    direction: str = Field(default="inbound", description="inbound or outbound")
    action: str = Field(default="block", description="block, allow, or log")
    protocol: str = Field(default="TCP", description="TCP, UDP, ICMP, or ANY")
    source_ip: Optional[str] = Field(None, description="Source IP or CIDR")
    destination_ip: Optional[str] = Field(None, description="Destination IP or CIDR")
    port: Optional[int] = Field(None, ge=1, le=65535, description="Single port")
    port_range: Optional[str] = Field(None, description="Port range e.g. 8000-9000")
    enabled: bool = Field(default=True)


class FirewallRuleDeleteResponse(BaseModel):
    """Response after deleting a firewall rule."""
    rule_id: str
    deleted: bool
    message: str
    timestamp: str


class DnsQuery(BaseModel):
    """A DNS query record."""
    id: str
    domain: str
    query_type: str = "A"
    response_ip: Optional[str] = None
    response_time_ms: float = 0.0
    status: str = "resolved"
    client_ip: str = "127.0.0.1"
    blocked: bool = False
    timestamp: str


class NetworkHealthResponse(BaseModel):
    """Network health score and details."""
    overall_score: float = 0.0
    status: str = "healthy"
    interface_health: List[Dict[str, Any]] = []
    latency_ms: float = 0.0
    packet_loss_percent: float = 0.0
    active_threats: int = 0
    anomalies_detected: int = 0
    uptime_percent: float = 100.0
    recommendations: List[str] = []
    timestamp: str


class NetworkDashboardResponse(BaseModel):
    """Full network monitoring dashboard."""
    health: NetworkHealthResponse
    interfaces: List[NetworkInterface] = []
    bandwidth: List[BandwidthUsage] = []
    active_threats: List[NetworkThreat] = []
    recent_anomalies: List[NetworkAnomaly] = []
    device_count: int = 0
    trusted_devices: int = 0
    firewall_rules_count: int = 0
    timestamp: str


class TrafficAnalysisResponse(BaseModel):
    """Traffic analysis with protocol distribution and top talkers."""
    protocol_distribution: Dict[str, int] = {}
    top_talkers: List[Dict[str, Any]] = []
    top_destinations: List[Dict[str, Any]] = []
    bytes_by_port: Dict[str, int] = {}
    time_range_minutes: int = 60
    timestamp: str


class NetworkScanRequest(BaseModel):
    """Request to trigger a network scan."""
    subnet: str = Field(default="192.168.1.0/24", description="Subnet to scan")
    scan_type: str = Field(default="quick", description="quick, full, or port_scan")
    ports: Optional[List[int]] = Field(None, description="Specific ports to scan")


class NetworkScanResponse(BaseModel):
    """Response after triggering a network scan."""
    scan_id: str
    subnet: str
    scan_type: str
    status: str = "started"
    estimated_duration_seconds: int = 30
    message: str
    timestamp: str


# ============================================================
# Demo Data
# ============================================================

_DEMO_THREATS: List[Dict[str, Any]] = [
    {
        "id": "threat-001",
        "threat_type": "port_scan",
        "severity": "high",
        "source_ip": "203.0.113.42",
        "source_port": 54321,
        "destination_ip": "192.168.1.1",
        "destination_port": None,
        "protocol": "TCP",
        "description": "Port scan detected from 203.0.113.42 — 150+ ports probed in 10 seconds",
        "blocked": False,
        "dismissed": False,
        "detected_at": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
    },
    {
        "id": "threat-002",
        "threat_type": "brute_force",
        "severity": "critical",
        "source_ip": "198.51.100.77",
        "source_port": 44892,
        "destination_ip": "192.168.1.10",
        "destination_port": 22,
        "protocol": "TCP",
        "description": "SSH brute-force attempt — 200 failed logins from 198.51.100.77",
        "blocked": True,
        "dismissed": False,
        "detected_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
    },
    {
        "id": "threat-003",
        "threat_type": "suspicious_dns",
        "severity": "medium",
        "source_ip": "192.168.1.105",
        "source_port": None,
        "destination_ip": None,
        "destination_port": 53,
        "protocol": "UDP",
        "description": "Suspicious DNS queries to known malware C2 domain",
        "blocked": False,
        "dismissed": False,
        "detected_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
    },
    {
        "id": "threat-004",
        "threat_type": "data_exfiltration",
        "severity": "high",
        "source_ip": "192.168.1.55",
        "source_port": 49152,
        "destination_ip": "45.33.32.156",
        "destination_port": 443,
        "protocol": "TCP",
        "description": "Abnormal outbound data transfer — 2.3 GB sent to external IP in 30 minutes",
        "blocked": False,
        "dismissed": False,
        "detected_at": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
    },
]

_DEMO_ANOMALIES: List[Dict[str, Any]] = [
    {
        "id": "anom-001",
        "anomaly_type": "bandwidth_spike",
        "severity": "medium",
        "description": "Unusual bandwidth spike on eth0 — 3x normal traffic",
        "affected_interface": "eth0",
        "metric_name": "bytes_recv_per_sec",
        "expected_value": 1048576.0,
        "actual_value": 3145728.0,
        "deviation_percent": 200.0,
        "detected_at": (datetime.utcnow() - timedelta(minutes=30)).isoformat(),
    },
    {
        "id": "anom-002",
        "anomaly_type": "new_device",
        "severity": "low",
        "description": "New device detected on the network: 192.168.1.200",
        "affected_interface": None,
        "metric_name": "device_count",
        "expected_value": 12.0,
        "actual_value": 13.0,
        "deviation_percent": 8.3,
        "detected_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
    },
    {
        "id": "anom-003",
        "anomaly_type": "latency_increase",
        "severity": "low",
        "description": "Network latency increased by 45% on Wi-Fi interface",
        "affected_interface": "wlan0",
        "metric_name": "latency_ms",
        "expected_value": 12.0,
        "actual_value": 17.4,
        "deviation_percent": 45.0,
        "detected_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
    },
]

_DEMO_DEVICES: List[Dict[str, Any]] = [
    {
        "id": "dev-001",
        "ip_address": "192.168.1.1",
        "mac_address": "AA:BB:CC:DD:EE:01",
        "hostname": "gateway",
        "device_type": "router",
        "vendor": "TP-Link",
        "is_trusted": True,
        "first_seen": (datetime.utcnow() - timedelta(days=90)).isoformat(),
        "last_seen": datetime.utcnow().isoformat(),
        "open_ports": [80, 443, 53],
    },
    {
        "id": "dev-002",
        "ip_address": "192.168.1.10",
        "mac_address": "AA:BB:CC:DD:EE:02",
        "hostname": "nexus-server",
        "device_type": "server",
        "vendor": "Dell",
        "is_trusted": True,
        "first_seen": (datetime.utcnow() - timedelta(days=60)).isoformat(),
        "last_seen": datetime.utcnow().isoformat(),
        "open_ports": [22, 80, 443, 8000],
    },
    {
        "id": "dev-003",
        "ip_address": "192.168.1.50",
        "mac_address": "AA:BB:CC:DD:EE:03",
        "hostname": "esp32-cam-front",
        "device_type": "iot",
        "vendor": "Espressif",
        "is_trusted": True,
        "first_seen": (datetime.utcnow() - timedelta(days=30)).isoformat(),
        "last_seen": datetime.utcnow().isoformat(),
        "open_ports": [80, 81],
    },
    {
        "id": "dev-004",
        "ip_address": "192.168.1.105",
        "mac_address": "AA:BB:CC:DD:EE:04",
        "hostname": "laptop-guest",
        "device_type": "laptop",
        "vendor": "Apple",
        "is_trusted": False,
        "first_seen": (datetime.utcnow() - timedelta(hours=4)).isoformat(),
        "last_seen": datetime.utcnow().isoformat(),
        "open_ports": [],
    },
    {
        "id": "dev-005",
        "ip_address": "192.168.1.200",
        "mac_address": "AA:BB:CC:DD:EE:05",
        "hostname": None,
        "device_type": "unknown",
        "vendor": None,
        "is_trusted": False,
        "first_seen": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "last_seen": datetime.utcnow().isoformat(),
        "open_ports": [22, 8080],
    },
]

_DEMO_FIREWALL_RULES: List[Dict[str, Any]] = [
    {
        "id": "fw-001",
        "name": "Block external SSH",
        "direction": "inbound",
        "action": "block",
        "protocol": "TCP",
        "source_ip": "0.0.0.0/0",
        "destination_ip": None,
        "port": 22,
        "port_range": None,
        "enabled": True,
        "created_at": (datetime.utcnow() - timedelta(days=60)).isoformat(),
    },
    {
        "id": "fw-002",
        "name": "Allow HTTPS",
        "direction": "inbound",
        "action": "allow",
        "protocol": "TCP",
        "source_ip": None,
        "destination_ip": None,
        "port": 443,
        "port_range": None,
        "enabled": True,
        "created_at": (datetime.utcnow() - timedelta(days=60)).isoformat(),
    },
    {
        "id": "fw-003",
        "name": "Block known malicious IP",
        "direction": "inbound",
        "action": "block",
        "protocol": "ANY",
        "source_ip": "203.0.113.42",
        "destination_ip": None,
        "port": None,
        "port_range": None,
        "enabled": True,
        "created_at": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
    },
]

_DEMO_DNS_QUERIES: List[Dict[str, Any]] = [
    {
        "id": "dns-001",
        "domain": "api.openai.com",
        "query_type": "A",
        "response_ip": "104.18.6.192",
        "response_time_ms": 12.3,
        "status": "resolved",
        "client_ip": "192.168.1.10",
        "blocked": False,
        "timestamp": (datetime.utcnow() - timedelta(seconds=30)).isoformat(),
    },
    {
        "id": "dns-002",
        "domain": "github.com",
        "query_type": "A",
        "response_ip": "140.82.121.4",
        "response_time_ms": 8.1,
        "status": "resolved",
        "client_ip": "192.168.1.10",
        "blocked": False,
        "timestamp": (datetime.utcnow() - timedelta(minutes=1)).isoformat(),
    },
    {
        "id": "dns-003",
        "domain": "malware-c2.evil.example",
        "query_type": "A",
        "response_ip": None,
        "response_time_ms": 0.0,
        "status": "blocked",
        "client_ip": "192.168.1.105",
        "blocked": True,
        "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
    },
    {
        "id": "dns-004",
        "domain": "pypi.org",
        "query_type": "A",
        "response_ip": "151.101.0.223",
        "response_time_ms": 15.7,
        "status": "resolved",
        "client_ip": "192.168.1.10",
        "blocked": False,
        "timestamp": (datetime.utcnow() - timedelta(minutes=10)).isoformat(),
    },
    {
        "id": "dns-005",
        "domain": "fastapi.tiangolo.com",
        "query_type": "AAAA",
        "response_ip": "2606:4700:3031::ac43:a562",
        "response_time_ms": 22.0,
        "status": "resolved",
        "client_ip": "192.168.1.10",
        "blocked": False,
        "timestamp": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
    },
]


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/network", tags=["Network"])


# ---- Interfaces ----------------------------------------------

@router.get(
    "/interfaces",
    response_model=List[NetworkInterface],
    summary="List network interfaces with stats",
)
async def list_interfaces(
    engine=Depends(get_engine),
):
    """List all network interfaces with real-time statistics from psutil."""
    try:
        import psutil

        stats = psutil.net_if_stats()
        counters = psutil.net_io_counters(pernic=True)
        addrs = psutil.net_if_addrs()

        interfaces: List[NetworkInterface] = []
        for name, st in stats.items():
            ctr = counters.get(name)
            addr_list = addrs.get(name, [])
            ipv4 = next((a.address for a in addr_list if a.family.name == "AF_INET"), None)
            ipv6 = next((a.address for a in addr_list if a.family.name == "AF_INET6"), None)
            mac = next((a.address for a in addr_list if a.family.name in ("AF_LINK", "AF_PACKET")), None)

            interfaces.append(NetworkInterface(
                name=name,
                display_name=name,
                is_up=st.isup,
                speed_mbps=st.speed if st.speed else None,
                mtu=st.mtu,
                mac_address=mac,
                ipv4_address=ipv4,
                ipv6_address=ipv6,
                bytes_sent=ctr.bytes_sent if ctr else 0,
                bytes_recv=ctr.bytes_recv if ctr else 0,
                packets_sent=ctr.packets_sent if ctr else 0,
                packets_recv=ctr.packets_recv if ctr else 0,
                errors_in=ctr.errin if ctr else 0,
                errors_out=ctr.errout if ctr else 0,
            ))
        return interfaces

    except ImportError:
        return [
            NetworkInterface(
                name="eth0",
                display_name="Ethernet",
                is_up=True,
                speed_mbps=1000,
                ipv4_address="192.168.1.10",
                bytes_sent=1_073_741_824,
                bytes_recv=5_368_709_120,
            ),
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching interfaces: {str(e)}",
        )


# ---- Connections ---------------------------------------------

@router.get(
    "/connections",
    response_model=List[NetworkConnection],
    summary="Active network connections",
)
async def list_connections(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: ESTABLISHED, LISTEN, etc."),
    conn_type: Optional[str] = Query(None, alias="type", description="Filter by type: TCP, UDP"),
    limit: int = Query(100, ge=1, le=1000),
    engine=Depends(get_engine),
):
    """List active network connections using psutil."""
    try:
        import psutil

        kind = "inet"
        if conn_type:
            kind = conn_type.lower() if conn_type.lower() in ("tcp", "udp", "tcp4", "tcp6", "udp4", "udp6") else "inet"

        raw = psutil.net_connections(kind=kind)
        connections: List[NetworkConnection] = []

        for c in raw:
            conn_status = c.status if hasattr(c, "status") else "NONE"
            if status_filter and conn_status != status_filter.upper():
                continue

            proc_name = None
            if c.pid:
                try:
                    proc_name = psutil.Process(c.pid).name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    proc_name = None

            family_str = "IPv4" if c.family.name == "AF_INET" else "IPv6"
            type_str = "TCP" if c.type.name == "SOCK_STREAM" else "UDP"

            connections.append(NetworkConnection(
                fd=c.fd if c.fd != -1 else None,
                family=family_str,
                type=type_str,
                local_address=c.laddr.ip if c.laddr else "0.0.0.0",
                local_port=c.laddr.port if c.laddr else 0,
                remote_address=c.raddr.ip if c.raddr else None,
                remote_port=c.raddr.port if c.raddr else None,
                status=conn_status,
                pid=c.pid,
                process_name=proc_name,
            ))
            if len(connections) >= limit:
                break

        return connections

    except (ImportError, psutil.AccessDenied):
        return []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching connections: {str(e)}",
        )


@router.get(
    "/connections/summary",
    response_model=ConnectionSummaryResponse,
    summary="Connection statistics summary",
)
async def connection_summary(
    engine=Depends(get_engine),
):
    """Get summary statistics of active network connections."""
    try:
        import psutil

        raw = psutil.net_connections(kind="inet")
        by_status: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        by_family: Dict[str, int] = {}
        proc_counts: Dict[str, int] = {}

        for c in raw:
            st = c.status if hasattr(c, "status") else "NONE"
            by_status[st] = by_status.get(st, 0) + 1

            tp = "TCP" if c.type.name == "SOCK_STREAM" else "UDP"
            by_type[tp] = by_type.get(tp, 0) + 1

            fm = "IPv4" if c.family.name == "AF_INET" else "IPv6"
            by_family[fm] = by_family.get(fm, 0) + 1

            if c.pid:
                try:
                    pname = psutil.Process(c.pid).name()
                    proc_counts[pname] = proc_counts.get(pname, 0) + 1
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        top_procs = sorted(proc_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        return ConnectionSummaryResponse(
            total_connections=len(raw),
            by_status=by_status,
            by_type=by_type,
            by_family=by_family,
            top_processes=[{"process": p, "count": c} for p, c in top_procs],
            timestamp=datetime.utcnow().isoformat(),
        )

    except (ImportError, psutil.AccessDenied):
        return ConnectionSummaryResponse(
            total_connections=0,
            timestamp=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching connection summary: {str(e)}",
        )


# ---- Bandwidth -----------------------------------------------

@router.get(
    "/bandwidth",
    response_model=List[BandwidthUsage],
    summary="Current bandwidth usage per interface",
)
async def get_bandwidth(
    engine=Depends(get_engine),
):
    """Get current bandwidth usage for each network interface using psutil."""
    try:
        import psutil
        import asyncio

        counters_before = psutil.net_io_counters(pernic=True)
        await asyncio.sleep(0.5)
        counters_after = psutil.net_io_counters(pernic=True)

        result: List[BandwidthUsage] = []
        for iface in counters_before:
            before = counters_before[iface]
            after = counters_after.get(iface)
            if not after:
                continue

            sent_per_sec = (after.bytes_sent - before.bytes_sent) * 2
            recv_per_sec = (after.bytes_recv - before.bytes_recv) * 2

            result.append(BandwidthUsage(
                interface=iface,
                bytes_sent_per_sec=sent_per_sec,
                bytes_recv_per_sec=recv_per_sec,
                mbps_sent=round(sent_per_sec * 8 / 1_000_000, 4),
                mbps_recv=round(recv_per_sec * 8 / 1_000_000, 4),
                total_bytes_sent=after.bytes_sent,
                total_bytes_recv=after.bytes_recv,
                timestamp=datetime.utcnow().isoformat(),
            ))

        return result

    except ImportError:
        return [
            BandwidthUsage(
                interface="eth0",
                bytes_sent_per_sec=524288,
                bytes_recv_per_sec=2097152,
                mbps_sent=4.19,
                mbps_recv=16.78,
                total_bytes_sent=1_073_741_824,
                total_bytes_recv=5_368_709_120,
                timestamp=datetime.utcnow().isoformat(),
            ),
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching bandwidth: {str(e)}",
        )


@router.get(
    "/bandwidth/history",
    response_model=BandwidthHistoryResponse,
    summary="Bandwidth history over time",
)
async def bandwidth_history(
    interface: str = Query("eth0", description="Interface name"),
    minutes: int = Query(60, ge=1, le=1440, description="Time range in minutes"),
    engine=Depends(get_engine),
):
    """Get historical bandwidth data (mock data for demo)."""
    import random

    entries: List[BandwidthHistoryEntry] = []
    for i in range(minutes):
        ts = (datetime.utcnow() - timedelta(minutes=minutes - i)).isoformat()
        entries.append(BandwidthHistoryEntry(
            timestamp=ts,
            bytes_sent_per_sec=random.uniform(100_000, 2_000_000),
            bytes_recv_per_sec=random.uniform(500_000, 10_000_000),
            interface=interface,
        ))

    return BandwidthHistoryResponse(
        interface=interface,
        entries=entries,
        time_range_minutes=minutes,
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Threats -------------------------------------------------

@router.get(
    "/threats",
    response_model=List[NetworkThreat],
    summary="List detected network threats",
)
async def list_threats(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    blocked: Optional[bool] = Query(None, description="Filter by blocked status"),
    limit: int = Query(50, ge=1, le=500),
    engine=Depends(get_engine),
):
    """List detected network threats."""
    results = list(_DEMO_THREATS)
    if severity:
        results = [t for t in results if t["severity"] == severity]
    if blocked is not None:
        results = [t for t in results if t["blocked"] == blocked]
    return [NetworkThreat(**t) for t in results[:limit]]


@router.get(
    "/threats/summary",
    response_model=ThreatSummaryResponse,
    summary="Threat summary and severity distribution",
)
async def threat_summary(
    engine=Depends(get_engine),
):
    """Get threat summary with severity and type distributions."""
    by_severity: Dict[str, int] = {}
    by_type: Dict[str, int] = {}
    active = 0
    blocked_count = 0
    dismissed_count = 0
    sources: List[str] = []

    for t in _DEMO_THREATS:
        by_severity[t["severity"]] = by_severity.get(t["severity"], 0) + 1
        by_type[t["threat_type"]] = by_type.get(t["threat_type"], 0) + 1
        if not t["blocked"] and not t["dismissed"]:
            active += 1
        if t["blocked"]:
            blocked_count += 1
        if t["dismissed"]:
            dismissed_count += 1
        if t["source_ip"] not in sources:
            sources.append(t["source_ip"])

    return ThreatSummaryResponse(
        total_threats=len(_DEMO_THREATS),
        active_threats=active,
        blocked_threats=blocked_count,
        dismissed_threats=dismissed_count,
        by_severity=by_severity,
        by_type=by_type,
        recent_sources=sources,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post(
    "/threats/{threat_id}/block",
    response_model=ThreatActionResponse,
    summary="Block a threat source IP",
)
async def block_threat(
    threat_id: str,
    engine=Depends(get_engine),
):
    """Block the source IP associated with a threat."""
    for t in _DEMO_THREATS:
        if t["id"] == threat_id:
            t["blocked"] = True
            # Auto-create firewall rule
            _DEMO_FIREWALL_RULES.append({
                "id": f"fw-{uuid4().hex[:6]}",
                "name": f"Auto-block {t['source_ip']}",
                "direction": "inbound",
                "action": "block",
                "protocol": "ANY",
                "source_ip": t["source_ip"],
                "destination_ip": None,
                "port": None,
                "port_range": None,
                "enabled": True,
                "created_at": datetime.utcnow().isoformat(),
            })
            return ThreatActionResponse(
                threat_id=threat_id,
                action="block",
                success=True,
                message=f"Blocked source IP {t['source_ip']} and created firewall rule",
                timestamp=datetime.utcnow().isoformat(),
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Threat '{threat_id}' not found",
    )


@router.post(
    "/threats/{threat_id}/dismiss",
    response_model=ThreatActionResponse,
    summary="Dismiss a threat",
)
async def dismiss_threat(
    threat_id: str,
    engine=Depends(get_engine),
):
    """Dismiss a threat as a false positive or handled."""
    for t in _DEMO_THREATS:
        if t["id"] == threat_id:
            t["dismissed"] = True
            return ThreatActionResponse(
                threat_id=threat_id,
                action="dismiss",
                success=True,
                message="Threat dismissed",
                timestamp=datetime.utcnow().isoformat(),
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Threat '{threat_id}' not found",
    )


# ---- Anomalies -----------------------------------------------

@router.get(
    "/anomalies",
    response_model=List[NetworkAnomaly],
    summary="List detected network anomalies",
)
async def list_anomalies(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(50, ge=1, le=500),
    engine=Depends(get_engine),
):
    """List detected network anomalies."""
    results = list(_DEMO_ANOMALIES)
    if severity:
        results = [a for a in results if a["severity"] == severity]
    return [NetworkAnomaly(**a) for a in results[:limit]]


# ---- Devices -------------------------------------------------

@router.get(
    "/devices",
    response_model=List[NetworkDevice],
    summary="List discovered network devices",
)
async def list_devices(
    trusted: Optional[bool] = Query(None, description="Filter by trust status"),
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    engine=Depends(get_engine),
):
    """List all discovered devices on the network."""
    results = list(_DEMO_DEVICES)
    if trusted is not None:
        results = [d for d in results if d["is_trusted"] == trusted]
    if device_type:
        results = [d for d in results if d["device_type"] == device_type]
    return [NetworkDevice(**d) for d in results]


@router.post(
    "/devices/{device_id}/trust",
    response_model=DeviceTrustResponse,
    summary="Mark a device as trusted",
)
async def trust_device(
    device_id: str,
    engine=Depends(get_engine),
):
    """Mark a discovered network device as trusted."""
    for d in _DEMO_DEVICES:
        if d["id"] == device_id:
            d["is_trusted"] = True
            return DeviceTrustResponse(
                device_id=device_id,
                is_trusted=True,
                message=f"Device {d.get('hostname', d['ip_address'])} marked as trusted",
                timestamp=datetime.utcnow().isoformat(),
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Device '{device_id}' not found",
    )


# ---- Firewall ------------------------------------------------

@router.get(
    "/firewall/rules",
    response_model=List[FirewallRule],
    summary="List firewall rules",
)
async def list_firewall_rules(
    engine=Depends(get_engine),
):
    """List all configured firewall rules."""
    return [FirewallRule(**r) for r in _DEMO_FIREWALL_RULES]


@router.post(
    "/firewall/rules",
    response_model=FirewallRule,
    status_code=status.HTTP_201_CREATED,
    summary="Create a firewall rule",
)
async def create_firewall_rule(
    request: FirewallRuleCreateRequest,
    engine=Depends(get_engine),
):
    """Create a new firewall rule."""
    rule_id = f"fw-{uuid4().hex[:6]}"
    rule = {
        "id": rule_id,
        "name": request.name,
        "direction": request.direction,
        "action": request.action,
        "protocol": request.protocol,
        "source_ip": request.source_ip,
        "destination_ip": request.destination_ip,
        "port": request.port,
        "port_range": request.port_range,
        "enabled": request.enabled,
        "created_at": datetime.utcnow().isoformat(),
    }
    _DEMO_FIREWALL_RULES.append(rule)
    return FirewallRule(**rule)


@router.delete(
    "/firewall/rules/{rule_id}",
    response_model=FirewallRuleDeleteResponse,
    summary="Delete a firewall rule",
)
async def delete_firewall_rule(
    rule_id: str,
    engine=Depends(get_engine),
):
    """Delete a firewall rule by ID."""
    for i, r in enumerate(_DEMO_FIREWALL_RULES):
        if r["id"] == rule_id:
            _DEMO_FIREWALL_RULES.pop(i)
            return FirewallRuleDeleteResponse(
                rule_id=rule_id,
                deleted=True,
                message=f"Firewall rule '{r['name']}' deleted",
                timestamp=datetime.utcnow().isoformat(),
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Firewall rule '{rule_id}' not found",
    )


# ---- DNS -----------------------------------------------------

@router.get(
    "/dns/queries",
    response_model=List[DnsQuery],
    summary="Recent DNS queries",
)
async def list_dns_queries(
    blocked: Optional[bool] = Query(None, description="Filter by blocked status"),
    limit: int = Query(50, ge=1, le=500),
    engine=Depends(get_engine),
):
    """Get recent DNS queries."""
    results = list(_DEMO_DNS_QUERIES)
    if blocked is not None:
        results = [q for q in results if q["blocked"] == blocked]
    return [DnsQuery(**q) for q in results[:limit]]


# ---- Health ---------------------------------------------------

@router.get(
    "/health",
    response_model=NetworkHealthResponse,
    summary="Network health score and details",
)
async def network_health(
    engine=Depends(get_engine),
):
    """Compute an overall network health score."""
    active_threats = sum(1 for t in _DEMO_THREATS if not t["blocked"] and not t["dismissed"])
    anomaly_count = len(_DEMO_ANOMALIES)

    # Score: start at 100, deduct for issues
    score = 100.0
    score -= active_threats * 15
    score -= anomaly_count * 5
    score = max(0.0, score)

    status_str = "healthy" if score >= 80 else ("degraded" if score >= 50 else "critical")

    recommendations: List[str] = []
    if active_threats > 0:
        recommendations.append(f"Address {active_threats} active threat(s)")
    if anomaly_count > 0:
        recommendations.append(f"Review {anomaly_count} detected anomaly(ies)")

    interface_health: List[Dict[str, Any]] = []
    try:
        import psutil
        stats = psutil.net_if_stats()
        for name, st in stats.items():
            interface_health.append({
                "name": name,
                "is_up": st.isup,
                "speed_mbps": st.speed,
            })
    except ImportError:
        interface_health.append({"name": "eth0", "is_up": True, "speed_mbps": 1000})

    return NetworkHealthResponse(
        overall_score=round(score, 1),
        status=status_str,
        interface_health=interface_health,
        latency_ms=4.2,
        packet_loss_percent=0.01,
        active_threats=active_threats,
        anomalies_detected=anomaly_count,
        uptime_percent=99.97,
        recommendations=recommendations,
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Dashboard ------------------------------------------------

@router.get(
    "/dashboard",
    response_model=NetworkDashboardResponse,
    summary="Full network monitoring dashboard",
)
async def network_dashboard(
    engine=Depends(get_engine),
):
    """Get full network monitoring dashboard data."""
    health = await network_health(engine=engine)
    interfaces = await list_interfaces(engine=engine)

    # Bandwidth snapshot (simplified)
    bandwidth: List[BandwidthUsage] = []
    try:
        import psutil
        counters = psutil.net_io_counters(pernic=True)
        for iface, ctr in counters.items():
            bandwidth.append(BandwidthUsage(
                interface=iface,
                total_bytes_sent=ctr.bytes_sent,
                total_bytes_recv=ctr.bytes_recv,
                timestamp=datetime.utcnow().isoformat(),
            ))
    except ImportError:
        pass

    active_threats = [NetworkThreat(**t) for t in _DEMO_THREATS if not t["blocked"] and not t["dismissed"]]
    recent_anomalies = [NetworkAnomaly(**a) for a in _DEMO_ANOMALIES]
    trusted = sum(1 for d in _DEMO_DEVICES if d["is_trusted"])

    return NetworkDashboardResponse(
        health=health,
        interfaces=interfaces,
        bandwidth=bandwidth,
        active_threats=active_threats,
        recent_anomalies=recent_anomalies,
        device_count=len(_DEMO_DEVICES),
        trusted_devices=trusted,
        firewall_rules_count=len(_DEMO_FIREWALL_RULES),
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Traffic Analysis ----------------------------------------

@router.get(
    "/traffic/analysis",
    response_model=TrafficAnalysisResponse,
    summary="Traffic analysis — protocol distribution and top talkers",
)
async def traffic_analysis(
    minutes: int = Query(60, ge=1, le=1440, description="Time range in minutes"),
    engine=Depends(get_engine),
):
    """Get traffic analysis including protocol distribution and top talkers (mock data)."""
    protocol_distribution = {"TCP": 7823, "UDP": 2145, "ICMP": 42, "Other": 15}
    top_talkers = [
        {"ip": "192.168.1.10", "hostname": "nexus-server", "bytes_sent": 524_288_000, "bytes_recv": 1_073_741_824},
        {"ip": "192.168.1.50", "hostname": "esp32-cam-front", "bytes_sent": 209_715_200, "bytes_recv": 10_485_760},
        {"ip": "192.168.1.105", "hostname": "laptop-guest", "bytes_sent": 104_857_600, "bytes_recv": 314_572_800},
        {"ip": "192.168.1.1", "hostname": "gateway", "bytes_sent": 52_428_800, "bytes_recv": 52_428_800},
    ]
    top_destinations = [
        {"ip": "140.82.121.4", "hostname": "github.com", "bytes": 314_572_800},
        {"ip": "104.18.6.192", "hostname": "api.openai.com", "bytes": 209_715_200},
        {"ip": "151.101.0.223", "hostname": "pypi.org", "bytes": 52_428_800},
    ]
    bytes_by_port = {"443": 5_242_880, "80": 1_048_576, "22": 524_288, "53": 262_144, "8000": 131_072}

    return TrafficAnalysisResponse(
        protocol_distribution=protocol_distribution,
        top_talkers=top_talkers,
        top_destinations=top_destinations,
        bytes_by_port=bytes_by_port,
        time_range_minutes=minutes,
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Network Scan ---------------------------------------------

@router.post(
    "/scan",
    response_model=NetworkScanResponse,
    summary="Trigger a network scan",
)
async def trigger_scan(
    request: NetworkScanRequest,
    engine=Depends(get_engine),
):
    """Trigger a network scan on the specified subnet."""
    scan_id = f"scan-{uuid4().hex[:8]}"
    duration = 30 if request.scan_type == "quick" else (120 if request.scan_type == "full" else 60)

    return NetworkScanResponse(
        scan_id=scan_id,
        subnet=request.subnet,
        scan_type=request.scan_type,
        status="started",
        estimated_duration_seconds=duration,
        message=f"{request.scan_type.capitalize()} scan started on {request.subnet}",
        timestamp=datetime.utcnow().isoformat(),
    )
