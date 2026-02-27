# NEXUS AI - Vision & Camera Management Service
"""
Comprehensive vision/camera management service providing infrastructure
for the Vision Agent. Manages ESP32-CAM devices, frame capture, motion
detection, object detection, face recognition, recording, and alert
management for the NEXUS AI home surveillance and monitoring pipeline.
"""

import asyncio
import io
import os
import random
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from loguru import logger

from core.config import settings
from core.events import event_bus, Event, EventCategory, EventPriority


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CameraStatus(str, Enum):
    """Status of a registered camera device."""
    ONLINE = "online"
    OFFLINE = "offline"
    STREAMING = "streaming"
    RECORDING = "recording"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class DetectionClass(str, Enum):
    """Supported object detection classes."""
    PERSON = "person"
    VEHICLE = "vehicle"
    ANIMAL = "animal"
    PACKAGE = "package"
    UNKNOWN = "unknown"
    FACE = "face"
    MOTION = "motion"


class AlertSeverity(str, Enum):
    """Severity of a vision alert."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertStatus(str, Enum):
    """Lifecycle status of a vision alert."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED = "dismissed"
    RESOLVED = "resolved"
    EXPIRED = "expired"


class RecordingState(str, Enum):
    """State of a recording session."""
    IDLE = "idle"
    RECORDING = "recording"
    PAUSED = "paused"
    FINALIZING = "finalizing"
    COMPLETE = "complete"
    FAILED = "failed"


class NightVisionMode(str, Enum):
    """Night vision / IR illuminator modes."""
    OFF = "off"
    AUTO = "auto"
    ON = "on"
    LOW_LIGHT_ENHANCE = "low_light_enhance"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class CameraDevice:
    """Represents a registered ESP32-CAM or IP camera."""
    camera_id: str
    name: str
    ip_address: str
    port: int = 80
    stream_path: str = "/stream"
    snapshot_path: str = "/capture"
    status: CameraStatus = CameraStatus.OFFLINE
    resolution: str = "640x480"
    framerate: int = 15
    quality: int = 80
    flip_horizontal: bool = False
    flip_vertical: bool = False
    night_vision: NightVisionMode = NightVisionMode.AUTO
    ir_intensity: int = 50
    location: str = ""
    model: str = "ESP32-CAM"
    firmware_version: str = "unknown"
    last_heartbeat: Optional[datetime] = None
    last_frame_time: Optional[datetime] = None
    registered_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def stream_url(self) -> str:
        return f"http://{self.ip_address}:{self.port}{self.stream_path}"

    @property
    def snapshot_url(self) -> str:
        return f"http://{self.ip_address}:{self.port}{self.snapshot_path}"

    @property
    def is_online(self) -> bool:
        if self.last_heartbeat is None:
            return False
        return (datetime.utcnow() - self.last_heartbeat).total_seconds() < 60

    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "name": self.name,
            "ip_address": self.ip_address,
            "port": self.port,
            "stream_url": self.stream_url,
            "snapshot_url": self.snapshot_url,
            "status": self.status.value,
            "resolution": self.resolution,
            "framerate": self.framerate,
            "quality": self.quality,
            "flip_horizontal": self.flip_horizontal,
            "flip_vertical": self.flip_vertical,
            "night_vision": self.night_vision.value,
            "ir_intensity": self.ir_intensity,
            "location": self.location,
            "model": self.model,
            "firmware_version": self.firmware_version,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_frame_time": self.last_frame_time.isoformat() if self.last_frame_time else None,
            "registered_at": self.registered_at.isoformat(),
            "is_online": self.is_online,
            "metadata": self.metadata,
        }


@dataclass
class CapturedFrame:
    """A single captured image frame."""
    frame_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    width: int = 640
    height: int = 480
    format: str = "jpeg"
    size_bytes: int = 0
    file_path: Optional[str] = None
    detections: List[Dict[str, Any]] = field(default_factory=list)
    motion_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "frame_id": self.frame_id,
            "camera_id": self.camera_id,
            "timestamp": self.timestamp.isoformat(),
            "width": self.width,
            "height": self.height,
            "format": self.format,
            "size_bytes": self.size_bytes,
            "file_path": self.file_path,
            "detections": self.detections,
            "motion_score": round(self.motion_score, 4),
            "metadata": self.metadata,
        }


@dataclass
class Detection:
    """An object detection result."""
    detection_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    class_name: str = "unknown"
    confidence: float = 0.0
    bbox: Tuple[int, int, int, int] = (0, 0, 0, 0)  # x, y, w, h
    frame_id: str = ""
    camera_id: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    label: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "detection_id": self.detection_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": list(self.bbox),
            "frame_id": self.frame_id,
            "camera_id": self.camera_id,
            "timestamp": self.timestamp.isoformat(),
            "label": self.label,
            "metadata": self.metadata,
        }


@dataclass
class VisionAlert:
    """A vision-triggered alert."""
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str = ""
    alert_type: str = "motion"
    severity: AlertSeverity = AlertSeverity.INFO
    status: AlertStatus = AlertStatus.ACTIVE
    message: str = ""
    detections: List[Detection] = field(default_factory=list)
    frame_id: Optional[str] = None
    zone_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "camera_id": self.camera_id,
            "alert_type": self.alert_type,
            "severity": self.severity.value,
            "status": self.status.value,
            "message": self.message,
            "detections": [d.to_dict() for d in self.detections],
            "frame_id": self.frame_id,
            "zone_id": self.zone_id,
            "created_at": self.created_at.isoformat(),
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "acknowledged_by": self.acknowledged_by,
            "metadata": self.metadata,
        }


@dataclass
class MonitoringZone:
    """A user-defined monitoring zone within a camera's field of view."""
    zone_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str = ""
    name: str = ""
    points: List[Tuple[int, int]] = field(default_factory=list)  # polygon vertices
    enabled: bool = True
    motion_sensitivity: float = 0.5
    detection_classes: List[str] = field(default_factory=lambda: ["person", "vehicle"])
    alert_severity: AlertSeverity = AlertSeverity.WARNING
    schedule_active_start: Optional[str] = None  # "HH:MM"
    schedule_active_end: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "zone_id": self.zone_id,
            "camera_id": self.camera_id,
            "name": self.name,
            "points": [list(p) for p in self.points],
            "enabled": self.enabled,
            "motion_sensitivity": self.motion_sensitivity,
            "detection_classes": self.detection_classes,
            "alert_severity": self.alert_severity.value,
            "schedule_active_start": self.schedule_active_start,
            "schedule_active_end": self.schedule_active_end,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class RecordingSession:
    """Represents an active or completed recording session."""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: str = ""
    state: RecordingState = RecordingState.IDLE
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    duration_seconds: float = 0.0
    frame_count: int = 0
    file_path: Optional[str] = None
    file_size_bytes: int = 0
    trigger: str = "manual"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "camera_id": self.camera_id,
            "state": self.state.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "stopped_at": self.stopped_at.isoformat() if self.stopped_at else None,
            "duration_seconds": round(self.duration_seconds, 2),
            "frame_count": self.frame_count,
            "file_path": self.file_path,
            "file_size_bytes": self.file_size_bytes,
            "trigger": self.trigger,
            "metadata": self.metadata,
        }


@dataclass
class KnownFace:
    """A face enrolled in the recognition database."""
    face_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    person_name: str = ""
    encoding: Optional[List[float]] = None
    image_paths: List[str] = field(default_factory=list)
    added_at: datetime = field(default_factory=datetime.utcnow)
    last_seen: Optional[datetime] = None
    recognition_count: int = 0
    trusted: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "face_id": self.face_id,
            "person_name": self.person_name,
            "has_encoding": self.encoding is not None,
            "image_count": len(self.image_paths),
            "added_at": self.added_at.isoformat(),
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "recognition_count": self.recognition_count,
            "trusted": self.trusted,
            "metadata": self.metadata,
        }


@dataclass
class VisionStats:
    """Accumulated statistics for the vision pipeline."""
    frames_processed: int = 0
    total_detections: int = 0
    motion_events: int = 0
    alerts_created: int = 0
    alerts_acknowledged: int = 0
    recordings_completed: int = 0
    faces_recognized: int = 0
    faces_unknown: int = 0
    inference_fps: float = 0.0
    avg_inference_ms: float = 0.0
    bytes_stored: int = 0
    uptime_seconds: float = 0.0
    last_reset: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "frames_processed": self.frames_processed,
            "total_detections": self.total_detections,
            "motion_events": self.motion_events,
            "alerts_created": self.alerts_created,
            "alerts_acknowledged": self.alerts_acknowledged,
            "recordings_completed": self.recordings_completed,
            "faces_recognized": self.faces_recognized,
            "faces_unknown": self.faces_unknown,
            "inference_fps": round(self.inference_fps, 2),
            "avg_inference_ms": round(self.avg_inference_ms, 2),
            "bytes_stored": self.bytes_stored,
            "uptime_seconds": round(self.uptime_seconds, 2),
            "last_reset": self.last_reset.isoformat(),
        }


# ---------------------------------------------------------------------------
# VisionService
# ---------------------------------------------------------------------------

class VisionService:
    """
    Vision and camera management service for NEXUS AI.

    Provides:
    - ESP32-CAM device registration, health monitoring, and stream management
    - Frame capture, storage, and retrieval
    - Motion detection via frame differencing with configurable sensitivity
    - Object detection interface (mock / placeholder for YOLO / MobileNet)
    - Face recognition interface with enrolled-face database
    - Recording management (start, stop, timelapse generation)
    - Vision alert lifecycle (create, acknowledge, dismiss, resolve)
    - Monitoring zone configuration with per-zone rules
    - Night vision and IR control
    - Camera settings management (resolution, framerate, quality, flip/mirror)
    - Pipeline statistics tracking and reporting
    - Event publishing to the NEXUS EventBus
    """

    def __init__(self):
        self._initialized: bool = False

        # Camera registry
        self._cameras: Dict[str, CameraDevice] = {}

        # Frame storage
        self._frame_buffer: Dict[str, List[CapturedFrame]] = {}  # per-camera ring buffer
        self._frame_buffer_max: int = 120  # keep last N frames per camera
        self._storage_dir: Path = Path("data/vision")
        self._snapshot_dir: Path = self._storage_dir / "snapshots"
        self._recording_dir: Path = self._storage_dir / "recordings"
        self._timelapse_dir: Path = self._storage_dir / "timelapses"
        self._face_dir: Path = self._storage_dir / "faces"

        # Motion detection settings
        self._motion_threshold: float = 0.15  # 0.0–1.0
        self._motion_min_area: int = 500  # pixels
        self._motion_cooldown: float = 5.0  # seconds between events
        self._last_motion_time: Dict[str, float] = {}
        self._previous_frame_data: Dict[str, Any] = {}

        # Object detection
        self._detection_model_loaded: bool = False
        self._detection_model_name: str = "yolov8n"
        self._detection_confidence_threshold: float = 0.45
        self._detection_nms_threshold: float = 0.50
        self._supported_classes: List[str] = [
            "person", "vehicle", "animal", "bicycle", "motorcycle",
            "bus", "truck", "bird", "cat", "dog", "backpack", "umbrella",
            "handbag", "suitcase", "bottle", "cup", "chair", "couch",
            "potted_plant", "bed", "dining_table", "tv", "laptop", "phone",
        ]

        # Face recognition
        self._known_faces: Dict[str, KnownFace] = {}
        self._face_recognition_threshold: float = 0.60
        self._face_model_loaded: bool = False

        # Recording
        self._active_recordings: Dict[str, RecordingSession] = {}
        self._completed_recordings: List[RecordingSession] = []
        self._max_recording_history: int = 500

        # Alerts
        self._alerts: Dict[str, VisionAlert] = {}
        self._alert_history: List[VisionAlert] = []
        self._alert_history_max: int = 5000
        self._alert_cooldown: float = 30.0  # seconds between duplicate alerts
        self._last_alert_time: Dict[str, float] = {}

        # Zones
        self._zones: Dict[str, MonitoringZone] = {}

        # Stats
        self._stats: VisionStats = VisionStats()
        self._start_time: Optional[datetime] = None
        self._inference_times: List[float] = []
        self._inference_window: int = 100  # rolling window

        # Background tasks
        self._health_check_task: Optional[asyncio.Task] = None
        self._health_check_interval: float = 30.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the vision service, create directories, start health check loop."""
        try:
            logger.info("Initializing VisionService...")

            # Create storage directories
            for directory in [
                self._storage_dir, self._snapshot_dir,
                self._recording_dir, self._timelapse_dir,
                self._face_dir,
            ]:
                directory.mkdir(parents=True, exist_ok=True)
                logger.debug(f"Ensured vision directory: {directory}")

            self._start_time = datetime.utcnow()
            self._stats.last_reset = self._start_time

            # Start background health-check loop
            self._health_check_task = asyncio.create_task(self._health_check_loop())

            self._initialized = True

            await event_bus.emit(
                "vision.initialized",
                {"storage_dir": str(self._storage_dir)},
                source="vision_service",
                category=EventCategory.SYSTEM,
            )
            logger.info("VisionService initialized successfully")
        except Exception as exc:
            logger.error(f"VisionService initialization failed: {exc}")
            self._initialized = True  # mark to avoid repeated attempts

    async def shutdown(self) -> None:
        """Gracefully shut down the vision service."""
        logger.info("Shutting down VisionService...")
        if self._health_check_task and not self._health_check_task.done():
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        # Stop any active recordings
        for camera_id in list(self._active_recordings.keys()):
            await self.stop_recording(camera_id)

        # Set all cameras offline
        for cam in self._cameras.values():
            cam.status = CameraStatus.OFFLINE

        await event_bus.emit(
            "vision.shutdown",
            {"stats": self._stats.to_dict()},
            source="vision_service",
            category=EventCategory.SYSTEM,
        )
        logger.info("VisionService shut down")

    # ------------------------------------------------------------------
    # Camera Management
    # ------------------------------------------------------------------

    async def register_camera(
        self,
        name: str,
        ip_address: str,
        port: int = 80,
        location: str = "",
        resolution: str = "640x480",
        framerate: int = 15,
        quality: int = 80,
        stream_path: str = "/stream",
        snapshot_path: str = "/capture",
        model: str = "ESP32-CAM",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> CameraDevice:
        """Register a new camera device with the vision service."""
        camera_id = str(uuid.uuid4())
        camera = CameraDevice(
            camera_id=camera_id,
            name=name,
            ip_address=ip_address,
            port=port,
            stream_path=stream_path,
            snapshot_path=snapshot_path,
            resolution=resolution,
            framerate=framerate,
            quality=quality,
            location=location,
            model=model,
            metadata=metadata or {},
        )
        self._cameras[camera_id] = camera
        self._frame_buffer[camera_id] = []
        self._last_motion_time[camera_id] = 0.0
        self._last_alert_time[camera_id] = 0.0

        logger.info(f"Registered camera '{name}' ({ip_address}:{port}) -> {camera_id}")

        await event_bus.emit(
            "vision.camera.registered",
            camera.to_dict(),
            source="vision_service",
            category=EventCategory.HOME,
        )
        return camera

    async def unregister_camera(self, camera_id: str) -> bool:
        """Remove a camera from the registry."""
        if camera_id not in self._cameras:
            logger.warning(f"Cannot unregister unknown camera {camera_id}")
            return False

        camera = self._cameras.pop(camera_id)
        self._frame_buffer.pop(camera_id, None)
        self._previous_frame_data.pop(camera_id, None)
        self._last_motion_time.pop(camera_id, None)

        # Stop recording if active
        if camera_id in self._active_recordings:
            await self.stop_recording(camera_id)

        # Remove zones for this camera
        zone_ids = [z.zone_id for z in self._zones.values() if z.camera_id == camera_id]
        for zid in zone_ids:
            self._zones.pop(zid, None)

        logger.info(f"Unregistered camera '{camera.name}' ({camera_id})")
        await event_bus.emit(
            "vision.camera.unregistered",
            {"camera_id": camera_id, "name": camera.name},
            source="vision_service",
            category=EventCategory.HOME,
        )
        return True

    def get_camera(self, camera_id: str) -> Optional[CameraDevice]:
        """Get a camera device by ID."""
        return self._cameras.get(camera_id)

    def list_cameras(self, status_filter: Optional[CameraStatus] = None) -> List[CameraDevice]:
        """List all registered cameras, optionally filtered by status."""
        cameras = list(self._cameras.values())
        if status_filter is not None:
            cameras = [c for c in cameras if c.status == status_filter]
        return cameras

    async def camera_heartbeat(self, camera_id: str, firmware_version: Optional[str] = None) -> bool:
        """Record a heartbeat from a camera device, marking it online."""
        camera = self._cameras.get(camera_id)
        if camera is None:
            logger.warning(f"Heartbeat from unknown camera {camera_id}")
            return False

        was_offline = camera.status == CameraStatus.OFFLINE
        camera.last_heartbeat = datetime.utcnow()
        if camera.status in (CameraStatus.OFFLINE, CameraStatus.ERROR):
            camera.status = CameraStatus.ONLINE
        if firmware_version:
            camera.firmware_version = firmware_version

        if was_offline:
            logger.info(f"Camera '{camera.name}' came online")
            await event_bus.emit(
                "vision.camera.online",
                {"camera_id": camera_id, "name": camera.name},
                source="vision_service",
                category=EventCategory.HOME,
            )
        return True

    async def update_camera_settings(
        self,
        camera_id: str,
        resolution: Optional[str] = None,
        framerate: Optional[int] = None,
        quality: Optional[int] = None,
        flip_horizontal: Optional[bool] = None,
        flip_vertical: Optional[bool] = None,
        night_vision: Optional[NightVisionMode] = None,
        ir_intensity: Optional[int] = None,
    ) -> Optional[CameraDevice]:
        """Update camera settings (resolution, framerate, quality, flip, night vision)."""
        camera = self._cameras.get(camera_id)
        if camera is None:
            logger.warning(f"Cannot update settings for unknown camera {camera_id}")
            return None

        if resolution is not None:
            camera.resolution = resolution
        if framerate is not None:
            camera.framerate = max(1, min(framerate, 60))
        if quality is not None:
            camera.quality = max(1, min(quality, 100))
        if flip_horizontal is not None:
            camera.flip_horizontal = flip_horizontal
        if flip_vertical is not None:
            camera.flip_vertical = flip_vertical
        if night_vision is not None:
            camera.night_vision = night_vision
        if ir_intensity is not None:
            camera.ir_intensity = max(0, min(ir_intensity, 100))

        logger.info(f"Updated settings for camera '{camera.name}' ({camera_id})")

        await event_bus.emit(
            "vision.camera.settings_updated",
            camera.to_dict(),
            source="vision_service",
            category=EventCategory.HOME,
        )
        return camera

    def get_stream_url(self, camera_id: str) -> Optional[str]:
        """Get the MJPEG stream URL for a camera."""
        camera = self._cameras.get(camera_id)
        return camera.stream_url if camera else None

    def get_snapshot_url(self, camera_id: str) -> Optional[str]:
        """Get the snapshot URL for a camera."""
        camera = self._cameras.get(camera_id)
        return camera.snapshot_url if camera else None

    # ------------------------------------------------------------------
    # Frame Capture & Storage
    # ------------------------------------------------------------------

    async def capture_frame(
        self,
        camera_id: str,
        frame_data: Optional[bytes] = None,
        width: int = 640,
        height: int = 480,
        run_detection: bool = False,
    ) -> Optional[CapturedFrame]:
        """
        Capture (or receive) a frame from a camera.

        If *frame_data* is ``None`` a placeholder frame is stored
        (useful when the actual HTTP fetch is handled elsewhere).
        """
        camera = self._cameras.get(camera_id)
        if camera is None:
            logger.warning(f"Cannot capture frame from unknown camera {camera_id}")
            return None

        try:
            frame = CapturedFrame(
                camera_id=camera_id,
                width=width,
                height=height,
                size_bytes=len(frame_data) if frame_data else 0,
            )

            # Store bytes to disk
            if frame_data:
                file_path = await self._store_frame(camera_id, frame.frame_id, frame_data)
                frame.file_path = str(file_path) if file_path else None

            camera.last_frame_time = frame.timestamp

            # Optional detection pipeline
            if run_detection:
                detections = await self.detect_objects(camera_id, frame.frame_id, frame_data)
                frame.detections = [d.to_dict() for d in detections]

            # Motion scoring
            motion = await self._compute_motion_score(camera_id, frame_data)
            frame.motion_score = motion

            # Buffer management
            buf = self._frame_buffer.setdefault(camera_id, [])
            buf.append(frame)
            if len(buf) > self._frame_buffer_max:
                buf.pop(0)

            self._stats.frames_processed += 1
            self._update_inference_fps()

            return frame
        except Exception as exc:
            logger.error(f"Error capturing frame from camera {camera_id}: {exc}")
            return None

    async def _store_frame(self, camera_id: str, frame_id: str, data: bytes) -> Optional[Path]:
        """Persist a frame to disk under data/vision/snapshots/<camera_id>/."""
        try:
            cam_dir = self._snapshot_dir / camera_id
            cam_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            file_path = cam_dir / f"{ts}_{frame_id[:8]}.jpg"
            file_path.write_bytes(data)
            self._stats.bytes_stored += len(data)
            logger.debug(f"Stored frame {frame_id[:8]} -> {file_path}")
            return file_path
        except Exception as exc:
            logger.error(f"Failed to store frame {frame_id}: {exc}")
            return None

    async def capture_snapshot(self, camera_id: str) -> Optional[CapturedFrame]:
        """Convenience wrapper – captures a single high-quality snapshot."""
        logger.debug(f"Capturing snapshot from camera {camera_id}")
        # In a real implementation this would HTTP GET the snapshot URL.
        # Here we create a placeholder frame for the pipeline.
        placeholder = b"\xff\xd8\xff\xe0" + os.urandom(1024)  # fake JPEG header
        return await self.capture_frame(camera_id, frame_data=placeholder, run_detection=True)

    def get_recent_frames(self, camera_id: str, count: int = 10) -> List[CapturedFrame]:
        """Return the most recent *count* frames for a camera."""
        buf = self._frame_buffer.get(camera_id, [])
        return buf[-count:]

    # ------------------------------------------------------------------
    # Motion Detection
    # ------------------------------------------------------------------

    async def _compute_motion_score(self, camera_id: str, frame_data: Optional[bytes]) -> float:
        """
        Estimate a motion score via simple frame differencing.

        Without real image processing libraries this returns a simulated
        score based on byte-level changes between consecutive frames.
        """
        if frame_data is None:
            return 0.0

        previous = self._previous_frame_data.get(camera_id)
        self._previous_frame_data[camera_id] = frame_data

        if previous is None:
            return 0.0

        try:
            # Byte-level rough comparison (placeholder for cv2 frame diff)
            min_len = min(len(previous), len(frame_data))
            if min_len == 0:
                return 0.0
            diff_count = sum(
                1 for i in range(0, min_len, max(1, min_len // 500))
                if previous[i % len(previous)] != frame_data[i % len(frame_data)]
            )
            sample_size = min(500, min_len)
            score = diff_count / sample_size if sample_size else 0.0
            return min(score, 1.0)
        except Exception as exc:
            logger.error(f"Motion score computation error: {exc}")
            return 0.0

    async def check_motion(self, camera_id: str, frame_data: Optional[bytes] = None) -> Dict[str, Any]:
        """
        Run motion detection on the latest (or provided) frame.

        Returns a dict with ``motion_detected``, ``score``, and ``threshold``.
        """
        score = await self._compute_motion_score(camera_id, frame_data)
        detected = score >= self._motion_threshold
        now = time.time()

        result: Dict[str, Any] = {
            "camera_id": camera_id,
            "motion_detected": detected,
            "score": round(score, 4),
            "threshold": self._motion_threshold,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if detected:
            last = self._last_motion_time.get(camera_id, 0.0)
            if now - last >= self._motion_cooldown:
                self._last_motion_time[camera_id] = now
                self._stats.motion_events += 1
                logger.info(f"Motion detected on camera {camera_id} (score={score:.3f})")
                await event_bus.emit(
                    "vision.motion.detected",
                    result,
                    source="vision_service",
                    category=EventCategory.SECURITY,
                    priority=EventPriority.HIGH,
                )

        return result

    def set_motion_threshold(self, threshold: float) -> None:
        """Set the global motion detection sensitivity (0.0–1.0)."""
        self._motion_threshold = max(0.0, min(threshold, 1.0))
        logger.info(f"Motion threshold set to {self._motion_threshold}")

    def set_motion_cooldown(self, seconds: float) -> None:
        """Set the minimum seconds between motion events per camera."""
        self._motion_cooldown = max(0.0, seconds)
        logger.info(f"Motion cooldown set to {self._motion_cooldown}s")

    # ------------------------------------------------------------------
    # Object Detection (placeholder / mock)
    # ------------------------------------------------------------------

    async def load_detection_model(self, model_name: str = "yolov8n") -> bool:
        """
        Load an object detection model.

        This is a placeholder – in production you would load a YOLO or
        MobileNet model via ONNX Runtime / PyTorch / TFLite.
        """
        try:
            logger.info(f"Loading detection model '{model_name}' (placeholder)...")
            await asyncio.sleep(0.1)  # simulate load time
            self._detection_model_name = model_name
            self._detection_model_loaded = True
            logger.info(f"Detection model '{model_name}' loaded (mock)")
            await event_bus.emit(
                "vision.model.loaded",
                {"model": model_name},
                source="vision_service",
                category=EventCategory.SYSTEM,
            )
            return True
        except Exception as exc:
            logger.error(f"Failed to load detection model: {exc}")
            return False

    async def detect_objects(
        self,
        camera_id: str,
        frame_id: str = "",
        frame_data: Optional[bytes] = None,
    ) -> List[Detection]:
        """
        Run object detection on a frame.

        Returns mock detections when no real model is loaded.
        """
        t0 = time.monotonic()
        detections: List[Detection] = []

        try:
            if not self._detection_model_loaded:
                logger.debug("Detection model not loaded – returning mock detections")

            # --- Mock detection logic ---
            mock_classes = ["person", "vehicle", "animal", "package"]
            num_det = random.randint(0, 3)
            for _ in range(num_det):
                cls = random.choice(mock_classes)
                conf = round(random.uniform(0.50, 0.98), 4)
                x = random.randint(10, 400)
                y = random.randint(10, 300)
                w = random.randint(40, 200)
                h = random.randint(40, 200)
                det = Detection(
                    class_name=cls,
                    confidence=conf,
                    bbox=(x, y, w, h),
                    frame_id=frame_id,
                    camera_id=camera_id,
                    label=cls,
                )
                detections.append(det)
            # --- End mock ---

            elapsed_ms = (time.monotonic() - t0) * 1000.0
            self._record_inference_time(elapsed_ms)
            self._stats.total_detections += len(detections)

            if detections:
                logger.debug(
                    f"Detected {len(detections)} objects on camera {camera_id} "
                    f"in {elapsed_ms:.1f}ms"
                )
                await event_bus.emit(
                    "vision.detection.result",
                    {
                        "camera_id": camera_id,
                        "frame_id": frame_id,
                        "detections": [d.to_dict() for d in detections],
                        "inference_ms": round(elapsed_ms, 2),
                    },
                    source="vision_service",
                    category=EventCategory.SECURITY,
                )

            return detections
        except Exception as exc:
            logger.error(f"Object detection error: {exc}")
            return []

    def set_detection_confidence(self, threshold: float) -> None:
        """Set minimum confidence for object detections."""
        self._detection_confidence_threshold = max(0.0, min(threshold, 1.0))
        logger.info(f"Detection confidence threshold set to {self._detection_confidence_threshold}")

    # ------------------------------------------------------------------
    # Face Recognition
    # ------------------------------------------------------------------

    async def load_face_model(self) -> bool:
        """Load the face recognition model (placeholder)."""
        try:
            logger.info("Loading face recognition model (placeholder)...")
            await asyncio.sleep(0.05)
            self._face_model_loaded = True
            logger.info("Face recognition model loaded (mock)")
            return True
        except Exception as exc:
            logger.error(f"Failed to load face model: {exc}")
            return False

    async def enroll_face(
        self,
        person_name: str,
        image_data: Optional[bytes] = None,
        image_path: Optional[str] = None,
        trusted: bool = False,
    ) -> KnownFace:
        """Add a new face to the recognition database."""
        face = KnownFace(
            person_name=person_name,
            trusted=trusted,
        )

        # Store reference image
        if image_data:
            face_img_dir = self._face_dir / face.face_id
            face_img_dir.mkdir(parents=True, exist_ok=True)
            img_path = face_img_dir / "enrolled.jpg"
            img_path.write_bytes(image_data)
            face.image_paths.append(str(img_path))

        if image_path:
            face.image_paths.append(image_path)

        # Generate mock encoding (128-d vector placeholder)
        face.encoding = [random.gauss(0, 1) for _ in range(128)]

        self._known_faces[face.face_id] = face
        logger.info(f"Enrolled face '{person_name}' -> {face.face_id}")

        await event_bus.emit(
            "vision.face.enrolled",
            face.to_dict(),
            source="vision_service",
            category=EventCategory.SECURITY,
        )
        return face

    async def remove_face(self, face_id: str) -> bool:
        """Remove a face from the recognition database."""
        if face_id not in self._known_faces:
            return False
        face = self._known_faces.pop(face_id)
        logger.info(f"Removed face '{face.person_name}' ({face_id})")
        return True

    def list_known_faces(self) -> List[KnownFace]:
        """List all enrolled faces."""
        return list(self._known_faces.values())

    async def recognize_face(
        self,
        camera_id: str,
        frame_data: Optional[bytes] = None,
    ) -> List[Dict[str, Any]]:
        """
        Attempt face recognition on a frame.

        Returns list of dicts with ``face_id``, ``person_name``,
        ``confidence``, ``trusted``, and ``bbox``.
        """
        results: List[Dict[str, Any]] = []
        try:
            if not self._known_faces:
                return results

            # --- Mock recognition ---
            known = list(self._known_faces.values())
            num_faces = random.randint(0, min(2, len(known)))
            for face in random.sample(known, num_faces):
                conf = round(random.uniform(0.55, 0.99), 4)
                if conf >= self._face_recognition_threshold:
                    face.last_seen = datetime.utcnow()
                    face.recognition_count += 1
                    self._stats.faces_recognized += 1
                    results.append({
                        "face_id": face.face_id,
                        "person_name": face.person_name,
                        "confidence": conf,
                        "trusted": face.trusted,
                        "bbox": [random.randint(50, 200), random.randint(50, 200), 120, 120],
                    })
            # --- End mock ---

            if results:
                await event_bus.emit(
                    "vision.face.recognized",
                    {"camera_id": camera_id, "faces": results},
                    source="vision_service",
                    category=EventCategory.SECURITY,
                )
            else:
                self._stats.faces_unknown += 1

            return results
        except Exception as exc:
            logger.error(f"Face recognition error: {exc}")
            return []

    # ------------------------------------------------------------------
    # Recording Management
    # ------------------------------------------------------------------

    async def start_recording(
        self,
        camera_id: str,
        trigger: str = "manual",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[RecordingSession]:
        """Start recording on a camera."""
        camera = self._cameras.get(camera_id)
        if camera is None:
            logger.warning(f"Cannot record from unknown camera {camera_id}")
            return None

        if camera_id in self._active_recordings:
            logger.warning(f"Recording already active on camera {camera_id}")
            return self._active_recordings[camera_id]

        session = RecordingSession(
            camera_id=camera_id,
            state=RecordingState.RECORDING,
            started_at=datetime.utcnow(),
            trigger=trigger,
            metadata=metadata or {},
        )

        rec_dir = self._recording_dir / camera_id
        rec_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        session.file_path = str(rec_dir / f"rec_{ts}_{session.session_id[:8]}.mjpeg")

        self._active_recordings[camera_id] = session
        camera.status = CameraStatus.RECORDING

        logger.info(f"Started recording on camera '{camera.name}' -> {session.session_id}")

        await event_bus.emit(
            "vision.recording.started",
            session.to_dict(),
            source="vision_service",
            category=EventCategory.HOME,
        )
        return session

    async def stop_recording(self, camera_id: str) -> Optional[RecordingSession]:
        """Stop an active recording on a camera."""
        session = self._active_recordings.pop(camera_id, None)
        if session is None:
            logger.debug(f"No active recording to stop on camera {camera_id}")
            return None

        session.state = RecordingState.COMPLETE
        session.stopped_at = datetime.utcnow()
        if session.started_at:
            session.duration_seconds = (session.stopped_at - session.started_at).total_seconds()

        # Restore camera status
        camera = self._cameras.get(camera_id)
        if camera:
            camera.status = CameraStatus.ONLINE if camera.is_online else CameraStatus.OFFLINE

        self._completed_recordings.append(session)
        if len(self._completed_recordings) > self._max_recording_history:
            self._completed_recordings.pop(0)
        self._stats.recordings_completed += 1

        logger.info(
            f"Stopped recording on camera {camera_id} "
            f"(duration={session.duration_seconds:.1f}s)"
        )

        await event_bus.emit(
            "vision.recording.stopped",
            session.to_dict(),
            source="vision_service",
            category=EventCategory.HOME,
        )
        return session

    def get_active_recording(self, camera_id: str) -> Optional[RecordingSession]:
        """Get the active recording session for a camera, if any."""
        return self._active_recordings.get(camera_id)

    def list_recordings(
        self,
        camera_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[RecordingSession]:
        """List completed recordings, optionally filtered by camera."""
        recs = self._completed_recordings
        if camera_id:
            recs = [r for r in recs if r.camera_id == camera_id]
        return recs[-limit:]

    async def generate_timelapse(
        self,
        camera_id: str,
        hours: float = 1.0,
        interval_seconds: float = 10.0,
    ) -> Dict[str, Any]:
        """
        Generate a timelapse from stored frames (placeholder).

        In production this would assemble JPEG frames into an MP4 via ffmpeg
        or similar. Here we return metadata about the would-be output.
        """
        frames = self._frame_buffer.get(camera_id, [])
        if not frames:
            return {"status": "error", "message": "No frames available"}

        tl_dir = self._timelapse_dir / camera_id
        tl_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_path = tl_dir / f"timelapse_{ts}.mp4"

        result = {
            "status": "generated",
            "camera_id": camera_id,
            "output_path": str(output_path),
            "source_frames": len(frames),
            "hours": hours,
            "interval_seconds": interval_seconds,
            "generated_at": datetime.utcnow().isoformat(),
        }
        logger.info(f"Timelapse generated (mock) for camera {camera_id}: {output_path}")

        await event_bus.emit(
            "vision.timelapse.generated",
            result,
            source="vision_service",
            category=EventCategory.HOME,
        )
        return result

    # ------------------------------------------------------------------
    # Alert Management
    # ------------------------------------------------------------------

    async def create_alert(
        self,
        camera_id: str,
        alert_type: str,
        message: str,
        severity: AlertSeverity = AlertSeverity.WARNING,
        detections: Optional[List[Detection]] = None,
        frame_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[VisionAlert]:
        """Create a new vision alert."""
        # Cooldown check
        key = f"{camera_id}:{alert_type}"
        now = time.time()
        last = self._last_alert_time.get(key, 0.0)
        if now - last < self._alert_cooldown:
            logger.debug(f"Alert cooldown active for {key}")
            return None

        alert = VisionAlert(
            camera_id=camera_id,
            alert_type=alert_type,
            severity=severity,
            message=message,
            detections=detections or [],
            frame_id=frame_id,
            zone_id=zone_id,
            metadata=metadata or {},
        )

        self._alerts[alert.alert_id] = alert
        self._last_alert_time[key] = now
        self._stats.alerts_created += 1

        logger.info(f"Vision alert created: [{severity.value}] {message} (camera={camera_id})")

        priority_map = {
            AlertSeverity.INFO: EventPriority.NORMAL,
            AlertSeverity.WARNING: EventPriority.HIGH,
            AlertSeverity.CRITICAL: EventPriority.CRITICAL,
            AlertSeverity.EMERGENCY: EventPriority.EMERGENCY,
        }

        await event_bus.emit(
            "vision.alert.created",
            alert.to_dict(),
            source="vision_service",
            category=EventCategory.SECURITY,
            priority=priority_map.get(severity, EventPriority.NORMAL),
        )
        return alert

    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str = "user") -> bool:
        """Acknowledge an active alert."""
        alert = self._alerts.get(alert_id)
        if alert is None:
            logger.warning(f"Cannot acknowledge unknown alert {alert_id}")
            return False
        if alert.status != AlertStatus.ACTIVE:
            logger.debug(f"Alert {alert_id} is already {alert.status.value}")
            return False

        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = acknowledged_by
        self._stats.alerts_acknowledged += 1

        logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
        await event_bus.emit(
            "vision.alert.acknowledged",
            {"alert_id": alert_id, "acknowledged_by": acknowledged_by},
            source="vision_service",
            category=EventCategory.SECURITY,
        )
        return True

    async def dismiss_alert(self, alert_id: str) -> bool:
        """Dismiss (close) an alert."""
        alert = self._alerts.get(alert_id)
        if alert is None:
            return False

        alert.status = AlertStatus.DISMISSED
        alert.resolved_at = datetime.utcnow()

        # Move to history
        self._alert_history.append(alert)
        if len(self._alert_history) > self._alert_history_max:
            self._alert_history.pop(0)
        self._alerts.pop(alert_id, None)

        logger.info(f"Alert {alert_id} dismissed")
        await event_bus.emit(
            "vision.alert.dismissed",
            {"alert_id": alert_id},
            source="vision_service",
            category=EventCategory.SECURITY,
        )
        return True

    def list_active_alerts(
        self,
        camera_id: Optional[str] = None,
        severity: Optional[AlertSeverity] = None,
    ) -> List[VisionAlert]:
        """List currently active alerts with optional filtering."""
        alerts = [a for a in self._alerts.values() if a.status == AlertStatus.ACTIVE]
        if camera_id:
            alerts = [a for a in alerts if a.camera_id == camera_id]
        if severity:
            alerts = [a for a in alerts if a.severity == severity]
        return sorted(alerts, key=lambda a: a.created_at, reverse=True)

    def get_alert_history(self, limit: int = 100) -> List[VisionAlert]:
        """Get resolved / dismissed alert history."""
        return self._alert_history[-limit:]

    # ------------------------------------------------------------------
    # Monitoring Zones
    # ------------------------------------------------------------------

    async def create_zone(
        self,
        camera_id: str,
        name: str,
        points: List[Tuple[int, int]],
        motion_sensitivity: float = 0.5,
        detection_classes: Optional[List[str]] = None,
        alert_severity: AlertSeverity = AlertSeverity.WARNING,
        schedule_start: Optional[str] = None,
        schedule_end: Optional[str] = None,
    ) -> MonitoringZone:
        """Create a monitoring zone within a camera's field of view."""
        zone = MonitoringZone(
            camera_id=camera_id,
            name=name,
            points=points,
            motion_sensitivity=max(0.0, min(motion_sensitivity, 1.0)),
            detection_classes=detection_classes or ["person", "vehicle"],
            alert_severity=alert_severity,
            schedule_active_start=schedule_start,
            schedule_active_end=schedule_end,
        )
        self._zones[zone.zone_id] = zone

        logger.info(f"Created monitoring zone '{name}' on camera {camera_id}")
        await event_bus.emit(
            "vision.zone.created",
            zone.to_dict(),
            source="vision_service",
            category=EventCategory.HOME,
        )
        return zone

    async def update_zone(self, zone_id: str, **kwargs: Any) -> Optional[MonitoringZone]:
        """Update zone attributes."""
        zone = self._zones.get(zone_id)
        if zone is None:
            logger.warning(f"Unknown zone {zone_id}")
            return None

        updatable = {
            "name", "points", "enabled", "motion_sensitivity",
            "detection_classes", "alert_severity",
            "schedule_active_start", "schedule_active_end",
        }
        for key, value in kwargs.items():
            if key in updatable and hasattr(zone, key):
                setattr(zone, key, value)

        logger.info(f"Updated zone '{zone.name}' ({zone_id})")
        return zone

    async def delete_zone(self, zone_id: str) -> bool:
        """Delete a monitoring zone."""
        zone = self._zones.pop(zone_id, None)
        if zone is None:
            return False
        logger.info(f"Deleted zone '{zone.name}' ({zone_id})")
        await event_bus.emit(
            "vision.zone.deleted",
            {"zone_id": zone_id, "name": zone.name},
            source="vision_service",
            category=EventCategory.HOME,
        )
        return True

    def list_zones(self, camera_id: Optional[str] = None) -> List[MonitoringZone]:
        """List monitoring zones, optionally filtered by camera."""
        zones = list(self._zones.values())
        if camera_id:
            zones = [z for z in zones if z.camera_id == camera_id]
        return zones

    def is_point_in_zone(self, zone_id: str, x: int, y: int) -> bool:
        """
        Ray-casting point-in-polygon test.

        Determines whether pixel coordinate (x, y) falls inside the
        zone's polygon.
        """
        zone = self._zones.get(zone_id)
        if zone is None or len(zone.points) < 3:
            return False

        n = len(zone.points)
        inside = False
        px, py = x, y
        j = n - 1
        for i in range(n):
            xi, yi = zone.points[i]
            xj, yj = zone.points[j]
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    # ------------------------------------------------------------------
    # Night Vision Control
    # ------------------------------------------------------------------

    async def set_night_vision(self, camera_id: str, mode: NightVisionMode) -> bool:
        """Set the night vision / IR mode for a camera."""
        camera = self._cameras.get(camera_id)
        if camera is None:
            return False

        camera.night_vision = mode
        logger.info(f"Night vision for camera '{camera.name}' set to {mode.value}")

        await event_bus.emit(
            "vision.nightvision.changed",
            {"camera_id": camera_id, "mode": mode.value},
            source="vision_service",
            category=EventCategory.HOME,
        )
        return True

    async def set_ir_intensity(self, camera_id: str, intensity: int) -> bool:
        """Set IR illuminator intensity (0–100)."""
        camera = self._cameras.get(camera_id)
        if camera is None:
            return False

        camera.ir_intensity = max(0, min(intensity, 100))
        logger.info(f"IR intensity for camera '{camera.name}' set to {camera.ir_intensity}")
        return True

    # ------------------------------------------------------------------
    # Statistics & Internals
    # ------------------------------------------------------------------

    def _record_inference_time(self, ms: float) -> None:
        """Record an inference duration for fps/latency tracking."""
        self._inference_times.append(ms)
        if len(self._inference_times) > self._inference_window:
            self._inference_times.pop(0)

    def _update_inference_fps(self) -> None:
        """Re-compute rolling inference FPS and average latency."""
        if not self._inference_times:
            self._stats.inference_fps = 0.0
            self._stats.avg_inference_ms = 0.0
            return
        avg_ms = sum(self._inference_times) / len(self._inference_times)
        self._stats.avg_inference_ms = avg_ms
        self._stats.inference_fps = 1000.0 / avg_ms if avg_ms > 0 else 0.0

    def get_stats(self) -> Dict[str, Any]:
        """Return current vision pipeline statistics."""
        if self._start_time:
            self._stats.uptime_seconds = (datetime.utcnow() - self._start_time).total_seconds()
        return self._stats.to_dict()

    def get_dashboard(self) -> Dict[str, Any]:
        """Aggregate dashboard data: cameras, alerts, recordings, stats."""
        return {
            "cameras": [c.to_dict() for c in self._cameras.values()],
            "active_alerts": [a.to_dict() for a in self.list_active_alerts()],
            "active_recordings": {
                cid: s.to_dict() for cid, s in self._active_recordings.items()
            },
            "zones": [z.to_dict() for z in self._zones.values()],
            "known_faces_count": len(self._known_faces),
            "stats": self.get_stats(),
        }

    # ------------------------------------------------------------------
    # Background Health-Check Loop
    # ------------------------------------------------------------------

    async def _health_check_loop(self) -> None:
        """Periodically check camera health and emit status events."""
        logger.debug("Vision health-check loop started")
        while True:
            try:
                await asyncio.sleep(self._health_check_interval)
                await self._run_health_checks()
            except asyncio.CancelledError:
                logger.debug("Vision health-check loop cancelled")
                break
            except Exception as exc:
                logger.error(f"Vision health-check error: {exc}")
                await asyncio.sleep(5.0)

    async def _run_health_checks(self) -> None:
        """Check each camera for staleness and update status."""
        now = datetime.utcnow()
        for camera in self._cameras.values():
            try:
                if camera.last_heartbeat is None:
                    continue

                age = (now - camera.last_heartbeat).total_seconds()
                if age > 120 and camera.status not in (CameraStatus.OFFLINE, CameraStatus.ERROR):
                    prev = camera.status
                    camera.status = CameraStatus.OFFLINE
                    logger.warning(
                        f"Camera '{camera.name}' marked offline "
                        f"(last heartbeat {age:.0f}s ago)"
                    )
                    await event_bus.emit(
                        "vision.camera.offline",
                        {
                            "camera_id": camera.camera_id,
                            "name": camera.name,
                            "previous_status": prev.value,
                            "seconds_since_heartbeat": round(age, 1),
                        },
                        source="vision_service",
                        category=EventCategory.HOME,
                        priority=EventPriority.HIGH,
                    )
            except Exception as exc:
                logger.error(f"Health check failed for camera {camera.camera_id}: {exc}")

    # ------------------------------------------------------------------
    # Cleanup / Maintenance
    # ------------------------------------------------------------------

    async def cleanup_old_frames(self, max_age_hours: float = 24.0) -> int:
        """Remove snapshot files older than *max_age_hours*."""
        removed = 0
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        try:
            for cam_dir in self._snapshot_dir.iterdir():
                if not cam_dir.is_dir():
                    continue
                for img in cam_dir.iterdir():
                    if img.is_file():
                        mtime = datetime.utcfromtimestamp(img.stat().st_mtime)
                        if mtime < cutoff:
                            img.unlink()
                            removed += 1
            logger.info(f"Cleaned up {removed} old frames (>{max_age_hours}h)")
        except Exception as exc:
            logger.error(f"Frame cleanup error: {exc}")
        return removed

    async def cleanup_old_recordings(self, max_age_days: float = 7.0) -> int:
        """Remove recording files older than *max_age_days*."""
        removed = 0
        cutoff = datetime.utcnow() - timedelta(days=max_age_days)
        try:
            for cam_dir in self._recording_dir.iterdir():
                if not cam_dir.is_dir():
                    continue
                for rec in cam_dir.iterdir():
                    if rec.is_file():
                        mtime = datetime.utcfromtimestamp(rec.stat().st_mtime)
                        if mtime < cutoff:
                            rec.unlink()
                            removed += 1
            logger.info(f"Cleaned up {removed} old recordings (>{max_age_days}d)")
        except Exception as exc:
            logger.error(f"Recording cleanup error: {exc}")
        return removed

    def reset_stats(self) -> None:
        """Reset all pipeline statistics."""
        self._stats = VisionStats()
        self._inference_times.clear()
        logger.info("Vision stats reset")


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
vision_service = VisionService()
