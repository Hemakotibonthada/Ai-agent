# NEXUS AI - Vision API Routes
"""
Endpoints for ESP32-CAM management, object detection,
monitoring zones, recording, alerts, and vision analytics.
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

class CameraInfo(BaseModel):
    """Registered camera device information."""
    id: str
    name: str
    location: str
    model: str = "ESP32-CAM"
    resolution: str = "1280x720"
    fps: int = 15
    is_online: bool = True
    is_recording: bool = False
    stream_url: Optional[str] = None
    last_seen: Optional[str] = None
    firmware_version: str = "1.0.0"
    ip_address: Optional[str] = None
    uptime_seconds: float = 0.0


class CameraRegisterRequest(BaseModel):
    """Request to register a new ESP32-CAM device."""
    name: str = Field(..., min_length=1, max_length=100, description="Camera display name")
    location: str = Field(..., description="Physical location of the camera")
    ip_address: str = Field(..., description="Camera IP address on the local network")
    model: str = Field(default="ESP32-CAM", description="Camera model")
    resolution: str = Field(default="1280x720", description="Capture resolution")
    fps: int = Field(default=15, ge=1, le=60, description="Frames per second")


class CameraRegisterResponse(BaseModel):
    """Response after registering a camera."""
    camera_id: str
    name: str
    success: bool
    message: str
    timestamp: str


class CameraStatusResponse(BaseModel):
    """Camera status and health details."""
    camera_id: str
    name: str
    is_online: bool
    is_recording: bool
    signal_strength: int = -45
    temperature_c: float = 38.5
    free_memory_kb: int = 120
    fps_actual: float = 14.8
    uptime_seconds: float = 0.0
    last_capture: Optional[str] = None
    errors: List[str] = []
    timestamp: str


class CaptureRequest(BaseModel):
    """Optional capture parameters."""
    resolution: Optional[str] = Field(None, description="Override resolution for this capture")
    flash: bool = Field(default=False, description="Enable flash LED")


class CaptureResponse(BaseModel):
    """Response after capturing a snapshot."""
    camera_id: str
    image_path: str
    resolution: str
    size_bytes: int
    detections: List[Dict[str, Any]] = []
    timestamp: str


class StreamResponse(BaseModel):
    """Camera stream URL information."""
    camera_id: str
    stream_url: str
    protocol: str = "MJPEG"
    resolution: str
    fps: int
    timestamp: str


class CameraSettingsRequest(BaseModel):
    """Request to update camera settings."""
    resolution: Optional[str] = None
    fps: Optional[int] = Field(None, ge=1, le=60)
    brightness: Optional[int] = Field(None, ge=-2, le=2)
    contrast: Optional[int] = Field(None, ge=-2, le=2)
    saturation: Optional[int] = Field(None, ge=-2, le=2)
    flip_horizontal: Optional[bool] = None
    flip_vertical: Optional[bool] = None
    night_mode: Optional[bool] = None


class CameraSettingsResponse(BaseModel):
    """Response after updating camera settings."""
    camera_id: str
    updated_settings: Dict[str, Any]
    success: bool
    message: str
    timestamp: str


class DetectionRecord(BaseModel):
    """A single object detection record."""
    id: str
    camera_id: str
    camera_name: str
    object_type: str
    confidence: float
    bounding_box: Dict[str, float] = {}
    zone: Optional[str] = None
    image_path: Optional[str] = None
    timestamp: str


class DetectionSummaryResponse(BaseModel):
    """Detection statistics summary."""
    total_detections: int
    by_object_type: Dict[str, int] = {}
    by_camera: Dict[str, int] = {}
    by_zone: Dict[str, int] = {}
    time_range_hours: int = 24
    peak_hour: Optional[int] = None
    timestamp: str


class VisionAlert(BaseModel):
    """A vision-related alert."""
    id: str
    camera_id: str
    camera_name: str
    alert_type: str
    severity: str = "medium"
    description: str
    acknowledged: bool = False
    image_path: Optional[str] = None
    detection_id: Optional[str] = None
    created_at: str
    acknowledged_at: Optional[str] = None


class AlertAcknowledgeResponse(BaseModel):
    """Response after acknowledging an alert."""
    alert_id: str
    acknowledged: bool
    message: str
    timestamp: str


class MonitoringZone(BaseModel):
    """A monitoring zone definition."""
    id: str
    name: str
    camera_id: str
    camera_name: str
    zone_type: str = "detection"
    coordinates: List[Dict[str, float]] = []
    sensitivity: float = 0.7
    alerts_enabled: bool = True
    active: bool = True
    created_at: str


class ZoneCreateRequest(BaseModel):
    """Request to create a monitoring zone."""
    name: str = Field(..., min_length=1, max_length=100)
    camera_id: str = Field(..., description="Camera this zone belongs to")
    zone_type: str = Field(default="detection", description="Zone type: detection, exclusion, counting")
    coordinates: List[Dict[str, float]] = Field(..., description="Polygon coordinates [{x, y}]")
    sensitivity: float = Field(default=0.7, ge=0.0, le=1.0)
    alerts_enabled: bool = Field(default=True)


class ZoneUpdateRequest(BaseModel):
    """Request to update an existing monitoring zone."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    coordinates: Optional[List[Dict[str, float]]] = None
    sensitivity: Optional[float] = Field(None, ge=0.0, le=1.0)
    alerts_enabled: Optional[bool] = None
    active: Optional[bool] = None


class RecordingInfo(BaseModel):
    """Recording clip information."""
    id: str
    camera_id: str
    camera_name: str
    file_path: str
    duration_seconds: float
    size_mb: float
    resolution: str
    started_at: str
    ended_at: Optional[str] = None
    has_detections: bool = False


class RecordingControlResponse(BaseModel):
    """Response after starting/stopping recording."""
    camera_id: str
    recording: bool
    recording_id: Optional[str] = None
    message: str
    timestamp: str


class VisionDashboardResponse(BaseModel):
    """Full vision dashboard data."""
    total_cameras: int = 0
    online_cameras: int = 0
    recording_cameras: int = 0
    cameras: List[CameraInfo] = []
    recent_detections: List[DetectionRecord] = []
    active_alerts: List[VisionAlert] = []
    zones: List[MonitoringZone] = []
    timestamp: str


class VisionAnalyticsResponse(BaseModel):
    """Vision analytics and trends."""
    detection_trends: List[Dict[str, Any]] = []
    busiest_hours: List[Dict[str, Any]] = []
    object_distribution: Dict[str, int] = {}
    alerts_by_type: Dict[str, int] = {}
    camera_activity: Dict[str, int] = {}
    time_range_hours: int = 24
    timestamp: str


# ============================================================
# Demo Data
# ============================================================

_now_iso = datetime.utcnow().isoformat

_DEMO_CAMERAS: List[Dict[str, Any]] = [
    {
        "id": "cam-001",
        "name": "Front Door Camera",
        "location": "Front Entrance",
        "model": "ESP32-CAM",
        "resolution": "1280x720",
        "fps": 15,
        "is_online": True,
        "is_recording": True,
        "stream_url": "http://192.168.1.50:81/stream",
        "last_seen": datetime.utcnow().isoformat(),
        "firmware_version": "1.2.3",
        "ip_address": "192.168.1.50",
        "uptime_seconds": 86400.0,
    },
    {
        "id": "cam-002",
        "name": "Backyard Camera",
        "location": "Backyard",
        "model": "ESP32-CAM",
        "resolution": "1024x768",
        "fps": 10,
        "is_online": True,
        "is_recording": False,
        "stream_url": "http://192.168.1.51:81/stream",
        "last_seen": datetime.utcnow().isoformat(),
        "firmware_version": "1.2.3",
        "ip_address": "192.168.1.51",
        "uptime_seconds": 43200.0,
    },
    {
        "id": "cam-003",
        "name": "Garage Camera",
        "location": "Garage",
        "model": "ESP32-CAM",
        "resolution": "640x480",
        "fps": 10,
        "is_online": False,
        "is_recording": False,
        "stream_url": None,
        "last_seen": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "firmware_version": "1.1.0",
        "ip_address": "192.168.1.52",
        "uptime_seconds": 0.0,
    },
]

_DEMO_DETECTIONS: List[Dict[str, Any]] = [
    {
        "id": "det-001",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "object_type": "person",
        "confidence": 0.94,
        "bounding_box": {"x": 120, "y": 80, "width": 200, "height": 400},
        "zone": "entrance",
        "image_path": "/data/detections/det-001.jpg",
        "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
    },
    {
        "id": "det-002",
        "camera_id": "cam-002",
        "camera_name": "Backyard Camera",
        "object_type": "cat",
        "confidence": 0.87,
        "bounding_box": {"x": 300, "y": 200, "width": 150, "height": 120},
        "zone": "yard",
        "image_path": "/data/detections/det-002.jpg",
        "timestamp": (datetime.utcnow() - timedelta(minutes=15)).isoformat(),
    },
    {
        "id": "det-003",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "object_type": "car",
        "confidence": 0.91,
        "bounding_box": {"x": 50, "y": 150, "width": 400, "height": 250},
        "zone": "driveway",
        "image_path": "/data/detections/det-003.jpg",
        "timestamp": (datetime.utcnow() - timedelta(minutes=30)).isoformat(),
    },
    {
        "id": "det-004",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "object_type": "person",
        "confidence": 0.82,
        "bounding_box": {"x": 200, "y": 100, "width": 180, "height": 380},
        "zone": "entrance",
        "image_path": "/data/detections/det-004.jpg",
        "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
    },
    {
        "id": "det-005",
        "camera_id": "cam-002",
        "camera_name": "Backyard Camera",
        "object_type": "dog",
        "confidence": 0.89,
        "bounding_box": {"x": 400, "y": 300, "width": 180, "height": 140},
        "zone": "yard",
        "image_path": "/data/detections/det-005.jpg",
        "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
    },
]

_DEMO_ALERTS: List[Dict[str, Any]] = [
    {
        "id": "alert-001",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "alert_type": "motion_detected",
        "severity": "low",
        "description": "Motion detected at front entrance",
        "acknowledged": False,
        "image_path": "/data/alerts/alert-001.jpg",
        "detection_id": "det-001",
        "created_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        "acknowledged_at": None,
    },
    {
        "id": "alert-002",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "alert_type": "unknown_person",
        "severity": "high",
        "description": "Unrecognised person detected at front door",
        "acknowledged": False,
        "image_path": "/data/alerts/alert-002.jpg",
        "detection_id": "det-004",
        "created_at": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
        "acknowledged_at": None,
    },
    {
        "id": "alert-003",
        "camera_id": "cam-003",
        "camera_name": "Garage Camera",
        "alert_type": "camera_offline",
        "severity": "medium",
        "description": "Garage camera has gone offline",
        "acknowledged": True,
        "image_path": None,
        "detection_id": None,
        "created_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        "acknowledged_at": (datetime.utcnow() - timedelta(hours=1, minutes=30)).isoformat(),
    },
]

_DEMO_ZONES: List[Dict[str, Any]] = [
    {
        "id": "zone-001",
        "name": "Entrance Zone",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "zone_type": "detection",
        "coordinates": [{"x": 0, "y": 0}, {"x": 640, "y": 0}, {"x": 640, "y": 480}, {"x": 0, "y": 480}],
        "sensitivity": 0.8,
        "alerts_enabled": True,
        "active": True,
        "created_at": (datetime.utcnow() - timedelta(days=30)).isoformat(),
    },
    {
        "id": "zone-002",
        "name": "Driveway Zone",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "zone_type": "counting",
        "coordinates": [{"x": 0, "y": 200}, {"x": 640, "y": 200}, {"x": 640, "y": 480}, {"x": 0, "y": 480}],
        "sensitivity": 0.6,
        "alerts_enabled": False,
        "active": True,
        "created_at": (datetime.utcnow() - timedelta(days=20)).isoformat(),
    },
    {
        "id": "zone-003",
        "name": "Yard Zone",
        "camera_id": "cam-002",
        "camera_name": "Backyard Camera",
        "zone_type": "detection",
        "coordinates": [{"x": 100, "y": 100}, {"x": 500, "y": 100}, {"x": 500, "y": 400}, {"x": 100, "y": 400}],
        "sensitivity": 0.7,
        "alerts_enabled": True,
        "active": True,
        "created_at": (datetime.utcnow() - timedelta(days=15)).isoformat(),
    },
]

_DEMO_RECORDINGS: List[Dict[str, Any]] = [
    {
        "id": "rec-001",
        "camera_id": "cam-001",
        "camera_name": "Front Door Camera",
        "file_path": "/data/recordings/cam-001/rec-001.mp4",
        "duration_seconds": 300.0,
        "size_mb": 45.2,
        "resolution": "1280x720",
        "started_at": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
        "ended_at": (datetime.utcnow() - timedelta(hours=3) + timedelta(minutes=5)).isoformat(),
        "has_detections": True,
    },
    {
        "id": "rec-002",
        "camera_id": "cam-002",
        "camera_name": "Backyard Camera",
        "file_path": "/data/recordings/cam-002/rec-002.mp4",
        "duration_seconds": 600.0,
        "size_mb": 72.8,
        "resolution": "1024x768",
        "started_at": (datetime.utcnow() - timedelta(hours=6)).isoformat(),
        "ended_at": (datetime.utcnow() - timedelta(hours=6) + timedelta(minutes=10)).isoformat(),
        "has_detections": False,
    },
]


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/vision", tags=["Vision"])


# ---- Cameras ------------------------------------------------

@router.get(
    "/cameras",
    response_model=List[CameraInfo],
    summary="List all registered cameras",
)
async def list_cameras(
    engine=Depends(get_engine),
):
    """Get all registered cameras with their current status."""
    return [CameraInfo(**c) for c in _DEMO_CAMERAS]


@router.post(
    "/cameras",
    response_model=CameraRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new ESP32-CAM device",
)
async def register_camera(
    request: CameraRegisterRequest,
    engine=Depends(get_engine),
):
    """Register a new ESP32-CAM device with NEXUS AI."""
    camera_id = f"cam-{uuid4().hex[:6]}"
    new_camera = {
        "id": camera_id,
        "name": request.name,
        "location": request.location,
        "model": request.model,
        "resolution": request.resolution,
        "fps": request.fps,
        "is_online": True,
        "is_recording": False,
        "stream_url": f"http://{request.ip_address}:81/stream",
        "last_seen": datetime.utcnow().isoformat(),
        "firmware_version": "1.0.0",
        "ip_address": request.ip_address,
        "uptime_seconds": 0.0,
    }
    _DEMO_CAMERAS.append(new_camera)
    return CameraRegisterResponse(
        camera_id=camera_id,
        name=request.name,
        success=True,
        message=f"Camera '{request.name}' registered at {request.location}",
        timestamp=datetime.utcnow().isoformat(),
    )


def _find_camera(camera_id: str) -> Dict[str, Any]:
    for cam in _DEMO_CAMERAS:
        if cam["id"] == camera_id:
            return cam
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Camera '{camera_id}' not found",
    )


@router.get(
    "/cameras/{camera_id}/status",
    response_model=CameraStatusResponse,
    summary="Get camera status and health",
)
async def get_camera_status(
    camera_id: str,
    engine=Depends(get_engine),
):
    """Get detailed status and health info for a specific camera."""
    cam = _find_camera(camera_id)
    return CameraStatusResponse(
        camera_id=cam["id"],
        name=cam["name"],
        is_online=cam["is_online"],
        is_recording=cam["is_recording"],
        signal_strength=-42 if cam["is_online"] else -100,
        temperature_c=38.5 if cam["is_online"] else 0.0,
        free_memory_kb=120 if cam["is_online"] else 0,
        fps_actual=cam["fps"] - 0.2 if cam["is_online"] else 0.0,
        uptime_seconds=cam["uptime_seconds"],
        last_capture=(datetime.utcnow() - timedelta(seconds=10)).isoformat() if cam["is_online"] else None,
        errors=[] if cam["is_online"] else ["Camera unreachable"],
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post(
    "/cameras/{camera_id}/capture",
    response_model=CaptureResponse,
    summary="Capture a snapshot from a camera",
)
async def capture_snapshot(
    camera_id: str,
    request: Optional[CaptureRequest] = None,
    engine=Depends(get_engine),
):
    """Capture a snapshot image from the specified camera."""
    cam = _find_camera(camera_id)
    if not cam["is_online"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Camera '{camera_id}' is offline",
        )
    resolution = (request.resolution if request and request.resolution else cam["resolution"])
    capture_id = uuid4().hex[:8]
    return CaptureResponse(
        camera_id=camera_id,
        image_path=f"/data/captures/{camera_id}/{capture_id}.jpg",
        resolution=resolution,
        size_bytes=245760,
        detections=[
            {"object_type": "person", "confidence": 0.92, "bounding_box": {"x": 120, "y": 80, "w": 200, "h": 400}},
        ],
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get(
    "/cameras/{camera_id}/stream",
    response_model=StreamResponse,
    summary="Get stream URL for a camera",
)
async def get_stream_url(
    camera_id: str,
    engine=Depends(get_engine),
):
    """Get the live stream URL for a specific camera."""
    cam = _find_camera(camera_id)
    if not cam["is_online"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Camera '{camera_id}' is offline",
        )
    return StreamResponse(
        camera_id=camera_id,
        stream_url=cam["stream_url"],
        protocol="MJPEG",
        resolution=cam["resolution"],
        fps=cam["fps"],
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post(
    "/cameras/{camera_id}/settings",
    response_model=CameraSettingsResponse,
    summary="Update camera settings",
)
async def update_camera_settings(
    camera_id: str,
    request: CameraSettingsRequest,
    engine=Depends(get_engine),
):
    """Update settings for a specific camera."""
    cam = _find_camera(camera_id)
    updated: Dict[str, Any] = {}
    if request.resolution is not None:
        cam["resolution"] = request.resolution
        updated["resolution"] = request.resolution
    if request.fps is not None:
        cam["fps"] = request.fps
        updated["fps"] = request.fps
    for field in ("brightness", "contrast", "saturation", "flip_horizontal", "flip_vertical", "night_mode"):
        val = getattr(request, field, None)
        if val is not None:
            updated[field] = val
    return CameraSettingsResponse(
        camera_id=camera_id,
        updated_settings=updated,
        success=True,
        message=f"Updated {len(updated)} setting(s) for {cam['name']}",
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Detections ----------------------------------------------

@router.get(
    "/detections",
    response_model=List[DetectionRecord],
    summary="Get recent object detections",
)
async def list_detections(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    object_type: Optional[str] = Query(None, description="Filter by object type"),
    zone: Optional[str] = Query(None, description="Filter by zone name"),
    limit: int = Query(50, ge=1, le=500, description="Maximum results"),
    engine=Depends(get_engine),
):
    """Get recent object detections with optional filters."""
    results = list(_DEMO_DETECTIONS)
    if camera_id:
        results = [d for d in results if d["camera_id"] == camera_id]
    if object_type:
        results = [d for d in results if d["object_type"] == object_type]
    if zone:
        results = [d for d in results if d.get("zone") == zone]
    return [DetectionRecord(**d) for d in results[:limit]]


@router.get(
    "/detections/summary",
    response_model=DetectionSummaryResponse,
    summary="Detection statistics summary",
)
async def detection_summary(
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    engine=Depends(get_engine),
):
    """Get aggregated detection statistics."""
    by_type: Dict[str, int] = {}
    by_camera: Dict[str, int] = {}
    by_zone: Dict[str, int] = {}
    for d in _DEMO_DETECTIONS:
        by_type[d["object_type"]] = by_type.get(d["object_type"], 0) + 1
        by_camera[d["camera_name"]] = by_camera.get(d["camera_name"], 0) + 1
        z = d.get("zone", "unknown")
        by_zone[z] = by_zone.get(z, 0) + 1
    return DetectionSummaryResponse(
        total_detections=len(_DEMO_DETECTIONS),
        by_object_type=by_type,
        by_camera=by_camera,
        by_zone=by_zone,
        time_range_hours=hours,
        peak_hour=14,
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Alerts --------------------------------------------------

@router.get(
    "/alerts",
    response_model=List[VisionAlert],
    summary="Get vision alerts",
)
async def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledged status"),
    limit: int = Query(50, ge=1, le=500),
    engine=Depends(get_engine),
):
    """Get vision alerts such as intruder detection, motion, and camera offline events."""
    results = list(_DEMO_ALERTS)
    if severity:
        results = [a for a in results if a["severity"] == severity]
    if acknowledged is not None:
        results = [a for a in results if a["acknowledged"] == acknowledged]
    return [VisionAlert(**a) for a in results[:limit]]


@router.post(
    "/alerts/{alert_id}/acknowledge",
    response_model=AlertAcknowledgeResponse,
    summary="Acknowledge a vision alert",
)
async def acknowledge_alert(
    alert_id: str,
    engine=Depends(get_engine),
):
    """Mark a vision alert as acknowledged."""
    for alert in _DEMO_ALERTS:
        if alert["id"] == alert_id:
            alert["acknowledged"] = True
            alert["acknowledged_at"] = datetime.utcnow().isoformat()
            return AlertAcknowledgeResponse(
                alert_id=alert_id,
                acknowledged=True,
                message="Alert acknowledged",
                timestamp=datetime.utcnow().isoformat(),
            )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Alert '{alert_id}' not found",
    )


# ---- Monitoring Zones ----------------------------------------

@router.get(
    "/zones",
    response_model=List[MonitoringZone],
    summary="List monitoring zones",
)
async def list_zones(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    engine=Depends(get_engine),
):
    """List all monitoring zones, optionally filtered by camera."""
    results = list(_DEMO_ZONES)
    if camera_id:
        results = [z for z in results if z["camera_id"] == camera_id]
    return [MonitoringZone(**z) for z in results]


@router.post(
    "/zones",
    response_model=MonitoringZone,
    status_code=status.HTTP_201_CREATED,
    summary="Create a monitoring zone",
)
async def create_zone(
    request: ZoneCreateRequest,
    engine=Depends(get_engine),
):
    """Create a new monitoring zone on a camera."""
    _find_camera(request.camera_id)
    cam = next(c for c in _DEMO_CAMERAS if c["id"] == request.camera_id)
    zone_id = f"zone-{uuid4().hex[:6]}"
    zone = {
        "id": zone_id,
        "name": request.name,
        "camera_id": request.camera_id,
        "camera_name": cam["name"],
        "zone_type": request.zone_type,
        "coordinates": request.coordinates,
        "sensitivity": request.sensitivity,
        "alerts_enabled": request.alerts_enabled,
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    _DEMO_ZONES.append(zone)
    return MonitoringZone(**zone)


@router.put(
    "/zones/{zone_id}",
    response_model=MonitoringZone,
    summary="Update zone settings",
)
async def update_zone(
    zone_id: str,
    request: ZoneUpdateRequest,
    engine=Depends(get_engine),
):
    """Update an existing monitoring zone's settings."""
    for zone in _DEMO_ZONES:
        if zone["id"] == zone_id:
            if request.name is not None:
                zone["name"] = request.name
            if request.coordinates is not None:
                zone["coordinates"] = request.coordinates
            if request.sensitivity is not None:
                zone["sensitivity"] = request.sensitivity
            if request.alerts_enabled is not None:
                zone["alerts_enabled"] = request.alerts_enabled
            if request.active is not None:
                zone["active"] = request.active
            return MonitoringZone(**zone)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Zone '{zone_id}' not found",
    )


# ---- Recordings ----------------------------------------------

@router.get(
    "/recordings",
    response_model=List[RecordingInfo],
    summary="List recorded clips",
)
async def list_recordings(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    limit: int = Query(50, ge=1, le=500),
    engine=Depends(get_engine),
):
    """List recorded video clips."""
    results = list(_DEMO_RECORDINGS)
    if camera_id:
        results = [r for r in results if r["camera_id"] == camera_id]
    return [RecordingInfo(**r) for r in results[:limit]]


@router.post(
    "/recordings/{camera_id}/start",
    response_model=RecordingControlResponse,
    summary="Start recording on a camera",
)
async def start_recording(
    camera_id: str,
    engine=Depends(get_engine),
):
    """Start recording on a specific camera."""
    cam = _find_camera(camera_id)
    if not cam["is_online"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Camera '{camera_id}' is offline",
        )
    cam["is_recording"] = True
    rec_id = f"rec-{uuid4().hex[:6]}"
    _DEMO_RECORDINGS.append({
        "id": rec_id,
        "camera_id": camera_id,
        "camera_name": cam["name"],
        "file_path": f"/data/recordings/{camera_id}/{rec_id}.mp4",
        "duration_seconds": 0.0,
        "size_mb": 0.0,
        "resolution": cam["resolution"],
        "started_at": datetime.utcnow().isoformat(),
        "ended_at": None,
        "has_detections": False,
    })
    return RecordingControlResponse(
        camera_id=camera_id,
        recording=True,
        recording_id=rec_id,
        message=f"Recording started on {cam['name']}",
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post(
    "/recordings/{camera_id}/stop",
    response_model=RecordingControlResponse,
    summary="Stop recording on a camera",
)
async def stop_recording(
    camera_id: str,
    engine=Depends(get_engine),
):
    """Stop recording on a specific camera."""
    cam = _find_camera(camera_id)
    cam["is_recording"] = False
    return RecordingControlResponse(
        camera_id=camera_id,
        recording=False,
        recording_id=None,
        message=f"Recording stopped on {cam['name']}",
        timestamp=datetime.utcnow().isoformat(),
    )


# ---- Dashboard & Analytics -----------------------------------

@router.get(
    "/dashboard",
    response_model=VisionDashboardResponse,
    summary="Full vision dashboard data",
)
async def vision_dashboard(
    engine=Depends(get_engine),
):
    """Get aggregated vision dashboard data including cameras, detections, alerts, and zones."""
    online = [c for c in _DEMO_CAMERAS if c["is_online"]]
    recording = [c for c in _DEMO_CAMERAS if c["is_recording"]]
    active_alerts = [a for a in _DEMO_ALERTS if not a["acknowledged"]]
    return VisionDashboardResponse(
        total_cameras=len(_DEMO_CAMERAS),
        online_cameras=len(online),
        recording_cameras=len(recording),
        cameras=[CameraInfo(**c) for c in _DEMO_CAMERAS],
        recent_detections=[DetectionRecord(**d) for d in _DEMO_DETECTIONS[:5]],
        active_alerts=[VisionAlert(**a) for a in active_alerts],
        zones=[MonitoringZone(**z) for z in _DEMO_ZONES],
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get(
    "/analytics",
    response_model=VisionAnalyticsResponse,
    summary="Vision analytics and trends",
)
async def vision_analytics(
    hours: int = Query(24, ge=1, le=168, description="Time range in hours"),
    engine=Depends(get_engine),
):
    """Get vision analytics including detection trends, busiest hours, and object distribution."""
    # Build mock trend data
    detection_trends = []
    for i in range(min(hours, 24)):
        hour_label = (datetime.utcnow() - timedelta(hours=i)).strftime("%Y-%m-%d %H:00")
        detection_trends.append({"hour": hour_label, "count": max(0, 12 - abs(i - 14) + (i % 3))})

    busiest_hours = sorted(detection_trends, key=lambda x: x["count"], reverse=True)[:5]

    object_distribution: Dict[str, int] = {}
    for d in _DEMO_DETECTIONS:
        obj = d["object_type"]
        object_distribution[obj] = object_distribution.get(obj, 0) + 1

    alerts_by_type: Dict[str, int] = {}
    for a in _DEMO_ALERTS:
        at = a["alert_type"]
        alerts_by_type[at] = alerts_by_type.get(at, 0) + 1

    camera_activity: Dict[str, int] = {}
    for d in _DEMO_DETECTIONS:
        cn = d["camera_name"]
        camera_activity[cn] = camera_activity.get(cn, 0) + 1

    return VisionAnalyticsResponse(
        detection_trends=detection_trends,
        busiest_hours=busiest_hours,
        object_distribution=object_distribution,
        alerts_by_type=alerts_by_type,
        camera_activity=camera_activity,
        time_range_hours=hours,
        timestamp=datetime.utcnow().isoformat(),
    )
