# NEXUS AI - Vision Agent
"""
AI agent for ESP32-CAM integration, 24/7 house monitoring, and AI-powered
computer vision.

This module implements the VisionAgent, a NEXUS AI agent dedicated to
visual surveillance, object detection, and intelligent monitoring of
the user's home environment:

- **Camera Management:** Register and manage multiple ESP32-CAM devices,
  track device health (online/offline/recording), and configure camera
  settings such as resolution, frame rate, and night-vision mode.
- **Live Monitoring:** Continuous 24/7 house surveillance with a real-time
  frame analysis pipeline, motion detection with configurable sensitivity,
  and per-zone monitoring profiles.
- **Object Detection:** Detect and classify people, vehicles, animals,
  and packages with confidence scores. Maintain a rolling detection
  history for trend analysis and alerts.
- **Person Recognition:** Face detection and recognition against a known-
  persons database. Track visitors with timestamps, snapshots, and
  classification as known or unknown.
- **Anomaly Detection:** Identify unusual activity patterns such as
  movement during odd hours, loitering near entry points, and abandoned
  objects. Generate intruder alerts with associated snapshot captures.
- **Zone Management:** Define logical monitoring zones (front door,
  backyard, garage, driveway, etc.) with per-zone alert rules, activity
  heatmaps, and sensitivity overrides.
- **Alert System:** Multi-level alerting (info, warning, critical) with
  configurable thresholds, rich alert history, and associated frame
  captures for forensic review.
- **Recording Management:** Event-triggered recording with clip lifecycle
  management—save, delete, and export clips. Timelapse generation from
  recorded frames.
- **Vision Model Management:** Track model performance (inference FPS,
  latency, accuracy), manage model versions, and report inference
  statistics.
- **Night Vision / Low Light:** Automatic IR-mode toggling, low-light
  image enhancement, and day/night switching driven by ambient light
  sensor data from the ESP32 board.

The agent publishes vision events to the NEXUS event bus so that other
agents (Security, Home, Notification) can react to detections, alerts,
and status changes in real time.
"""

import json
import re
import time
import uuid
import random
import hashlib
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentContext,
    AgentResponse,
)


# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

# Camera statuses
CAMERA_STATUS: Dict[str, str] = {
    "online": "🟢 Online",
    "offline": "🔴 Offline",
    "recording": "🔵 Recording",
    "maintenance": "🟡 Maintenance",
    "error": "⚠️ Error",
}

# Supported resolutions for ESP32-CAM
SUPPORTED_RESOLUTIONS: List[Dict[str, Any]] = [
    {"label": "QQVGA", "width": 160, "height": 120},
    {"label": "QVGA", "width": 320, "height": 240},
    {"label": "CIF", "width": 400, "height": 296},
    {"label": "VGA", "width": 640, "height": 480},
    {"label": "SVGA", "width": 800, "height": 600},
    {"label": "XGA", "width": 1024, "height": 768},
    {"label": "SXGA", "width": 1280, "height": 1024},
    {"label": "UXGA", "width": 1600, "height": 1200},
]

# Detectable object categories
DETECTABLE_OBJECTS: Dict[str, str] = {
    "person": "🧑 Person",
    "vehicle": "🚗 Vehicle",
    "animal": "🐾 Animal",
    "package": "📦 Package",
    "bicycle": "🚲 Bicycle",
    "motorcycle": "🏍️ Motorcycle",
    "bird": "🐦 Bird",
    "cat": "🐱 Cat",
    "dog": "🐕 Dog",
    "truck": "🚛 Truck",
    "bus": "🚌 Bus",
    "unknown": "❓ Unknown",
}

# Alert severity levels
ALERT_LEVELS: Dict[str, str] = {
    "info": "ℹ️ Info",
    "warning": "⚠️ Warning",
    "critical": "🚨 Critical",
}

# Default monitoring zones
DEFAULT_ZONES: List[Dict[str, Any]] = [
    {
        "id": "front_door",
        "name": "Front Door",
        "description": "Main entrance and porch area",
        "sensitivity": 0.7,
        "alert_on": ["person", "package", "vehicle"],
        "active": True,
    },
    {
        "id": "backyard",
        "name": "Backyard",
        "description": "Rear garden and patio",
        "sensitivity": 0.5,
        "alert_on": ["person", "animal"],
        "active": True,
    },
    {
        "id": "garage",
        "name": "Garage",
        "description": "Garage door and driveway entrance",
        "sensitivity": 0.8,
        "alert_on": ["person", "vehicle"],
        "active": True,
    },
    {
        "id": "driveway",
        "name": "Driveway",
        "description": "Front driveway and street-facing area",
        "sensitivity": 0.6,
        "alert_on": ["person", "vehicle", "package"],
        "active": True,
    },
    {
        "id": "side_yard",
        "name": "Side Yard",
        "description": "Narrow passage along the side of the house",
        "sensitivity": 0.9,
        "alert_on": ["person"],
        "active": True,
    },
]

# Vision model specifications
VISION_MODELS: Dict[str, Dict[str, Any]] = {
    "yolov8n-esp32": {
        "name": "YOLOv8 Nano (ESP32 Optimised)",
        "version": "8.1.0",
        "size_mb": 6.3,
        "input_resolution": "320x320",
        "classes": 80,
        "fps_esp32": 4.2,
        "fps_server": 62.0,
        "accuracy_map50": 0.371,
        "quantised": True,
    },
    "mobilenet-ssd-v2": {
        "name": "MobileNet SSD v2",
        "version": "2.0.0",
        "size_mb": 18.5,
        "input_resolution": "300x300",
        "classes": 90,
        "fps_esp32": 2.8,
        "fps_server": 95.0,
        "accuracy_map50": 0.224,
        "quantised": True,
    },
    "facenet-512": {
        "name": "FaceNet 512-D Embeddings",
        "version": "1.3.0",
        "size_mb": 92.0,
        "input_resolution": "160x160",
        "classes": 0,
        "fps_esp32": 0.0,
        "fps_server": 45.0,
        "accuracy_map50": 0.0,
        "quantised": False,
    },
    "efficientdet-lite0": {
        "name": "EfficientDet Lite0",
        "version": "1.0.0",
        "size_mb": 4.4,
        "input_resolution": "320x320",
        "classes": 90,
        "fps_esp32": 5.5,
        "fps_server": 78.0,
        "accuracy_map50": 0.258,
        "quantised": True,
    },
}


class VisionAgent(BaseAgent):
    """
    ESP32-CAM integration and AI-powered computer vision agent that:

    - Manages a fleet of ESP32-CAM devices for 24/7 home surveillance
    - Performs real-time object detection (people, vehicles, animals, packages)
    - Recognises known persons and logs visitor activity
    - Detects anomalies such as intruders, loitering, and abandoned objects
    - Manages logical monitoring zones with per-zone alerting rules
    - Issues multi-level alerts (info, warning, critical) with frame captures
    - Controls event-triggered recording and timelapse generation
    - Tracks vision model performance and manages model versions
    - Handles night-vision / low-light switching via ESP32 IR LEDs

    The agent is tailored for a 28-year-old DevOps engineer who values
    reliability, automation, and concise technical output.
    """

    def __init__(self) -> None:
        super().__init__(
            name="vision",
            description=(
                "ESP32-CAM computer vision agent for 24/7 house monitoring, "
                "object detection, person recognition, anomaly detection, "
                "zone management, and intelligent alerting"
            ),
        )

        # Camera fleet registry — camera_id -> camera info
        self.cameras: Dict[str, Dict[str, Any]] = {}

        # Monitoring zones — zone_id -> zone config
        self.zones: Dict[str, Dict[str, Any]] = {}

        # Detection event history
        self.detections: List[Dict[str, Any]] = []

        # Alert history
        self.alerts: List[Dict[str, Any]] = []

        # Visitor log
        self.visitors: List[Dict[str, Any]] = []

        # Recording registry — recording_id -> recording info
        self.recordings: Dict[str, Dict[str, Any]] = {}

        # Vision model metadata
        self.models: Dict[str, Dict[str, Any]] = {}

        # Global settings
        self.motion_sensitivity: float = 0.7
        self.night_vision_enabled: bool = False
        self.monitoring_active: bool = True

        # Known persons database — person_id -> person info
        self._known_persons: Dict[str, Dict[str, Any]] = {}

        # Activity heatmap counters per zone
        self._zone_activity: Dict[str, Dict[str, int]] = {}

        # Inference statistics
        self._inference_stats: Dict[str, Any] = {
            "total_frames_processed": 0,
            "total_detections": 0,
            "avg_inference_ms": 0.0,
            "peak_inference_ms": 0.0,
            "model_switches": 0,
        }

        # Initialise with mock data
        self._seed_mock_data()

        logger.info("VisionAgent initialised with ESP32-CAM monitoring capabilities")

    # ------------------------------------------------------------------
    # Mock data seeding
    # ------------------------------------------------------------------

    def _seed_mock_data(self) -> None:
        """Populate the agent with realistic mock data for demonstration."""
        # Register default cameras
        default_cameras = [
            {
                "camera_id": "cam-front-01",
                "name": "Front Door Camera",
                "ip_address": "192.168.1.101",
                "location": "front_door",
                "resolution": "VGA",
                "fps": 15,
                "status": "online",
                "night_vision": False,
                "ir_enabled": True,
                "model": "ESP32-CAM AI-Thinker",
                "firmware": "v2.4.1",
                "uptime_hours": 743.2,
                "last_seen": (datetime.utcnow() - timedelta(seconds=12)).isoformat(),
                "registered_at": (datetime.utcnow() - timedelta(days=90)).isoformat(),
                "stream_url": "http://192.168.1.101:81/stream",
                "snapshot_url": "http://192.168.1.101/capture",
            },
            {
                "camera_id": "cam-back-01",
                "name": "Backyard Camera",
                "ip_address": "192.168.1.102",
                "location": "backyard",
                "resolution": "SVGA",
                "fps": 10,
                "status": "online",
                "night_vision": False,
                "ir_enabled": True,
                "model": "ESP32-CAM AI-Thinker",
                "firmware": "v2.4.1",
                "uptime_hours": 518.7,
                "last_seen": (datetime.utcnow() - timedelta(seconds=8)).isoformat(),
                "registered_at": (datetime.utcnow() - timedelta(days=75)).isoformat(),
                "stream_url": "http://192.168.1.102:81/stream",
                "snapshot_url": "http://192.168.1.102/capture",
            },
            {
                "camera_id": "cam-garage-01",
                "name": "Garage Camera",
                "ip_address": "192.168.1.103",
                "location": "garage",
                "resolution": "VGA",
                "fps": 12,
                "status": "recording",
                "night_vision": True,
                "ir_enabled": True,
                "model": "ESP32-S3-CAM",
                "firmware": "v3.1.0",
                "uptime_hours": 312.9,
                "last_seen": (datetime.utcnow() - timedelta(seconds=3)).isoformat(),
                "registered_at": (datetime.utcnow() - timedelta(days=45)).isoformat(),
                "stream_url": "http://192.168.1.103:81/stream",
                "snapshot_url": "http://192.168.1.103/capture",
            },
            {
                "camera_id": "cam-drive-01",
                "name": "Driveway Camera",
                "ip_address": "192.168.1.104",
                "location": "driveway",
                "resolution": "XGA",
                "fps": 8,
                "status": "offline",
                "night_vision": False,
                "ir_enabled": True,
                "model": "ESP32-CAM AI-Thinker",
                "firmware": "v2.3.8",
                "uptime_hours": 0.0,
                "last_seen": (datetime.utcnow() - timedelta(hours=3, minutes=22)).isoformat(),
                "registered_at": (datetime.utcnow() - timedelta(days=120)).isoformat(),
                "stream_url": "http://192.168.1.104:81/stream",
                "snapshot_url": "http://192.168.1.104/capture",
            },
        ]
        for cam in default_cameras:
            self.cameras[cam["camera_id"]] = cam

        # Register default zones
        for zone in DEFAULT_ZONES:
            zone_copy = dict(zone)
            zone_copy["created_at"] = (datetime.utcnow() - timedelta(days=90)).isoformat()
            zone_copy["event_count"] = random.randint(20, 500)
            self.zones[zone_copy["id"]] = zone_copy
            self._zone_activity[zone_copy["id"]] = {
                str(h): random.randint(0, 15) for h in range(24)
            }

        # Seed detection history
        detection_templates = [
            {"object_type": "person", "confidence": 0.94, "zone_id": "front_door", "camera_id": "cam-front-01"},
            {"object_type": "vehicle", "confidence": 0.88, "zone_id": "driveway", "camera_id": "cam-drive-01"},
            {"object_type": "package", "confidence": 0.91, "zone_id": "front_door", "camera_id": "cam-front-01"},
            {"object_type": "cat", "confidence": 0.79, "zone_id": "backyard", "camera_id": "cam-back-01"},
            {"object_type": "person", "confidence": 0.97, "zone_id": "garage", "camera_id": "cam-garage-01"},
            {"object_type": "dog", "confidence": 0.85, "zone_id": "backyard", "camera_id": "cam-back-01"},
            {"object_type": "person", "confidence": 0.92, "zone_id": "front_door", "camera_id": "cam-front-01"},
            {"object_type": "bicycle", "confidence": 0.76, "zone_id": "driveway", "camera_id": "cam-drive-01"},
            {"object_type": "person", "confidence": 0.89, "zone_id": "side_yard", "camera_id": "cam-front-01"},
            {"object_type": "vehicle", "confidence": 0.95, "zone_id": "driveway", "camera_id": "cam-drive-01"},
            {"object_type": "animal", "confidence": 0.71, "zone_id": "backyard", "camera_id": "cam-back-01"},
            {"object_type": "person", "confidence": 0.96, "zone_id": "front_door", "camera_id": "cam-front-01"},
        ]

        now = datetime.utcnow()
        for i, tmpl in enumerate(detection_templates):
            ts = now - timedelta(hours=random.randint(1, 72), minutes=random.randint(0, 59))
            detection = {
                "detection_id": f"det-{uuid.uuid4().hex[:8]}",
                "timestamp": ts.isoformat(),
                "object_type": tmpl["object_type"],
                "confidence": tmpl["confidence"],
                "zone_id": tmpl["zone_id"],
                "camera_id": tmpl["camera_id"],
                "bounding_box": {
                    "x": random.randint(50, 400),
                    "y": random.randint(30, 300),
                    "width": random.randint(60, 200),
                    "height": random.randint(80, 280),
                },
                "frame_path": f"/data/frames/{tmpl['camera_id']}/{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
                "reviewed": random.choice([True, False]),
            }
            self.detections.append(detection)

        # Sort detections newest first
        self.detections.sort(key=lambda d: d["timestamp"], reverse=True)

        # Seed alerts
        alert_templates = [
            {
                "level": "critical",
                "title": "Unknown person detected at front door",
                "description": "Unrecognised individual spotted at the front porch at 02:17 AM. No matching face in known-persons database.",
                "zone_id": "front_door",
                "camera_id": "cam-front-01",
            },
            {
                "level": "warning",
                "title": "Motion detected in side yard at unusual hour",
                "description": "Motion sensor triggered in the side yard at 03:42 AM. Sensitivity threshold exceeded by 34%.",
                "zone_id": "side_yard",
                "camera_id": "cam-front-01",
            },
            {
                "level": "info",
                "title": "Package delivered at front door",
                "description": "A package was detected at the front door at 14:25 PM. Delivery person identified as regular UPS carrier.",
                "zone_id": "front_door",
                "camera_id": "cam-front-01",
            },
            {
                "level": "warning",
                "title": "Camera cam-drive-01 went offline",
                "description": "Driveway camera lost connectivity. Last frame received 3 hours ago. Possible power or Wi-Fi issue.",
                "zone_id": "driveway",
                "camera_id": "cam-drive-01",
            },
            {
                "level": "info",
                "title": "Vehicle detected in driveway",
                "description": "Known vehicle (silver Honda Civic) arrived in driveway at 18:30 PM.",
                "zone_id": "driveway",
                "camera_id": "cam-drive-01",
            },
            {
                "level": "critical",
                "title": "Loitering detected near garage",
                "description": "An individual has been present near the garage door for over 5 minutes without entering. Face not recognised.",
                "zone_id": "garage",
                "camera_id": "cam-garage-01",
            },
        ]

        for i, tmpl in enumerate(alert_templates):
            ts = now - timedelta(hours=random.randint(1, 48), minutes=random.randint(0, 59))
            alert = {
                "alert_id": f"alert-{uuid.uuid4().hex[:8]}",
                "timestamp": ts.isoformat(),
                "level": tmpl["level"],
                "title": tmpl["title"],
                "description": tmpl["description"],
                "zone_id": tmpl["zone_id"],
                "camera_id": tmpl["camera_id"],
                "acknowledged": random.choice([True, False]),
                "frame_path": f"/data/frames/{tmpl['camera_id']}/alert_{ts.strftime('%Y%m%d_%H%M%S')}.jpg",
            }
            self.alerts.append(alert)

        self.alerts.sort(key=lambda a: a["timestamp"], reverse=True)

        # Seed visitor log
        visitor_entries = [
            {"name": "Arjun (Roommate)", "known": True, "person_id": "p-001"},
            {"name": "Priya (Friend)", "known": True, "person_id": "p-002"},
            {"name": "Amazon Delivery", "known": False, "person_id": None},
            {"name": "Unknown Visitor", "known": False, "person_id": None},
            {"name": "Mom", "known": True, "person_id": "p-003"},
            {"name": "UPS Driver", "known": False, "person_id": None},
            {"name": "Neighbour (Raj)", "known": True, "person_id": "p-004"},
            {"name": "Unknown Visitor", "known": False, "person_id": None},
        ]

        for entry in visitor_entries:
            ts = now - timedelta(hours=random.randint(1, 96), minutes=random.randint(0, 59))
            visitor = {
                "visitor_id": f"vis-{uuid.uuid4().hex[:8]}",
                "timestamp": ts.isoformat(),
                "name": entry["name"],
                "known": entry["known"],
                "person_id": entry["person_id"],
                "camera_id": "cam-front-01",
                "zone_id": "front_door",
                "confidence": round(random.uniform(0.75, 0.99), 2) if entry["known"] else 0.0,
                "snapshot_path": f"/data/visitors/{ts.strftime('%Y%m%d_%H%M%S')}_face.jpg",
                "duration_seconds": random.randint(5, 300),
            }
            self.visitors.append(visitor)

        self.visitors.sort(key=lambda v: v["timestamp"], reverse=True)

        # Seed recordings
        recording_templates = [
            {"trigger": "motion", "zone_id": "front_door", "camera_id": "cam-front-01", "duration_s": 45},
            {"trigger": "alert", "zone_id": "garage", "camera_id": "cam-garage-01", "duration_s": 120},
            {"trigger": "motion", "zone_id": "backyard", "camera_id": "cam-back-01", "duration_s": 30},
            {"trigger": "manual", "zone_id": "driveway", "camera_id": "cam-drive-01", "duration_s": 300},
            {"trigger": "scheduled", "zone_id": "front_door", "camera_id": "cam-front-01", "duration_s": 600},
        ]

        for tmpl in recording_templates:
            rec_id = f"rec-{uuid.uuid4().hex[:8]}"
            ts = now - timedelta(hours=random.randint(1, 48), minutes=random.randint(0, 59))
            recording = {
                "recording_id": rec_id,
                "timestamp": ts.isoformat(),
                "trigger": tmpl["trigger"],
                "zone_id": tmpl["zone_id"],
                "camera_id": tmpl["camera_id"],
                "duration_seconds": tmpl["duration_s"],
                "file_path": f"/data/recordings/{tmpl['camera_id']}/{ts.strftime('%Y%m%d_%H%M%S')}.mp4",
                "file_size_mb": round(tmpl["duration_s"] * 0.3 + random.uniform(0.5, 5.0), 1),
                "status": "completed",
                "has_detections": random.choice([True, False]),
            }
            self.recordings[rec_id] = recording

        # Seed known persons
        known_people = [
            {"person_id": "p-001", "name": "Arjun", "relationship": "Roommate", "face_encoding_hash": hashlib.sha256(b"arjun_face").hexdigest()[:16]},
            {"person_id": "p-002", "name": "Priya", "relationship": "Friend", "face_encoding_hash": hashlib.sha256(b"priya_face").hexdigest()[:16]},
            {"person_id": "p-003", "name": "Mom", "relationship": "Family", "face_encoding_hash": hashlib.sha256(b"mom_face").hexdigest()[:16]},
            {"person_id": "p-004", "name": "Raj", "relationship": "Neighbour", "face_encoding_hash": hashlib.sha256(b"raj_face").hexdigest()[:16]},
        ]
        for p in known_people:
            p["registered_at"] = (now - timedelta(days=random.randint(30, 180))).isoformat()
            p["last_seen"] = (now - timedelta(hours=random.randint(1, 72))).isoformat()
            p["total_visits"] = random.randint(5, 120)
            self._known_persons[p["person_id"]] = p

        # Seed vision models
        self.models = dict(VISION_MODELS)

        # Seed inference stats
        self._inference_stats = {
            "total_frames_processed": 184_329,
            "total_detections": 12_847,
            "avg_inference_ms": 24.7,
            "peak_inference_ms": 112.3,
            "model_switches": 4,
            "active_model": "yolov8n-esp32",
            "last_inference": (now - timedelta(seconds=2)).isoformat(),
        }

    # ------------------------------------------------------------------
    # BaseAgent interface implementation
    # ------------------------------------------------------------------

    def get_system_prompt(self) -> str:
        """Return the comprehensive system prompt for the Vision agent."""
        return """You are NEXUS Vision Agent — the all-seeing eye of the NEXUS AI smart home
platform, specialising in ESP32-CAM integration and AI-powered computer vision.

YOUR IDENTITY:
You are a computer vision engineer with deep expertise in embedded camera
systems (ESP32-CAM), real-time object detection, face recognition, and
intelligent surveillance. You are proactive about safety, privacy-aware,
and deliver concise technical output suited for a 28-year-old DevOps
engineer who values reliability and automation.

CORE COMPETENCIES:
1. **Camera Management** — Register and manage ESP32-CAM devices across the
   home. Monitor device health (online/offline/recording), configure
   resolution, FPS, night-vision mode, and firmware updates. Provide
   stream and snapshot URLs.
2. **Live Monitoring** — Run 24/7 surveillance with a real-time frame
   analysis pipeline. Detect motion with configurable sensitivity and
   per-zone profiles. Report activity levels and frame processing stats.
3. **Object Detection** — Detect people, vehicles, animals, packages,
   bicycles, and other objects using quantised models optimised for
   ESP32 hardware. Report detections with confidence scores, bounding
   boxes, and associated frames.
4. **Person Recognition** — Perform face detection and recognition against
   a known-persons database. Log visitors with timestamps, snapshots,
   and known/unknown classification. Track visitor frequency.
5. **Anomaly Detection** — Identify unusual activity such as movement at
   odd hours, loitering, abandoned objects, and camera tampering.
   Generate alerts with severity ratings and snapshot captures.
6. **Zone Management** — Define and manage logical monitoring zones (front
   door, backyard, garage, driveway, side yard). Set per-zone detection
   targets, alert rules, sensitivity levels, and activity heatmaps.
7. **Alert System** — Issue multi-level alerts (info, warning, critical)
   tied to specific cameras and zones. Maintain alert history with
   frame captures. Support acknowledgement and filtering.
8. **Recording Management** — Event-triggered and manual recording. Manage
   clips: save, delete, export, and generate timelapses.
9. **Vision Model Management** — Track model performance (FPS, latency,
   mAP accuracy). Manage model versions and quantisation. Report
   inference statistics per model and per camera.
10. **Night Vision / Low Light** — Toggle IR mode on ESP32-CAM boards.
    Apply low-light enhancement. Automatically switch between day and
    night profiles based on ambient light sensor readings.

RESPONSE GUIDELINES:
- Use tables for camera status, detection lists, and alert summaries.
- Include confidence percentages for detections and recognitions.
- Provide actionable suggestions (e.g., "Check camera power supply").
- Respect privacy: blur or redact faces of unknown persons in exports.
- Use emoji status indicators for quick scanning of results.
- Always report timestamps in human-readable format with timezone.
- Offer follow-up actions after each response."""

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the list of capabilities this agent provides."""
        return [
            AgentCapability.MONITOR,
            AgentCapability.ANALYZE,
            AgentCapability.CONTROL,
            AgentCapability.NOTIFY,
            AgentCapability.REPORT,
            AgentCapability.SEARCH,
            AgentCapability.PREDICT,
            AgentCapability.AUTOMATE,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process an incoming vision-related query or command.

        Detects the user's intent from the message, delegates to the
        appropriate handler, and returns a rich Markdown response.
        """
        message = context.message.lower().strip()
        intent = self._detect_vision_intent(message)
        logger.debug(f"VisionAgent detected intent: {intent} for message: {message[:80]}")

        handlers: Dict[str, Any] = {
            "show_camera": self._handle_show_camera,
            "camera_status": self._handle_camera_status,
            "add_camera": self._handle_add_camera,
            "remove_camera": self._handle_remove_camera,
            "recent_detections": self._handle_recent_detections,
            "motion_sensitivity": self._handle_motion_sensitivity,
            "night_vision": self._handle_night_vision,
            "who_visited": self._handle_who_visited,
            "recent_alerts": self._handle_recent_alerts,
            "check_zone": self._handle_check_zone,
            "add_zone": self._handle_add_zone,
            "zone_heatmap": self._handle_zone_heatmap,
            "what_happened": self._handle_what_happened,
            "recording_list": self._handle_recording_list,
            "start_recording": self._handle_start_recording,
            "timelapse": self._handle_timelapse,
            "model_info": self._handle_model_info,
            "anomaly_report": self._handle_anomaly_report,
            "monitoring_toggle": self._handle_monitoring_toggle,
            "configure_camera": self._handle_configure_camera,
            "general": self._handle_general_vision,
        }

        handler = handlers.get(intent, self._handle_general_vision)

        try:
            return await handler(context, message)
        except Exception as exc:
            logger.error(f"VisionAgent handler error ({intent}): {exc}")
            return AgentResponse(
                content=(
                    "⚠️ I encountered an issue while processing your vision request. "
                    "Please try rephrasing or provide more details."
                ),
                agent_name=self.name,
                confidence=0.0,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_vision_intent(self, message: str) -> str:
        """
        Detect the vision-related intent from a user message.

        Scans keyword lists in priority order and returns the first match.
        Falls back to ``general`` when no keywords trigger.
        """
        intents: Dict[str, List[str]] = {
            "show_camera": [
                "show me the", "view camera", "show camera", "live feed",
                "stream from", "show feed", "camera feed", "pull up",
                "display camera", "watch camera", "view the",
            ],
            "night_vision": [
                "night vision", "night mode", "ir mode", "infrared",
                "low light", "enable night", "disable night", "toggle night",
                "dark mode camera", "ir led",
            ],
            "motion_sensitivity": [
                "motion sensitivity", "sensitivity high", "sensitivity low",
                "sensitivity medium", "detect motion", "motion detection",
                "adjust sensitivity", "change sensitivity", "set sensitivity",
            ],
            "who_visited": [
                "who visited", "who came", "visitor log", "visitors today",
                "who was here", "who stopped by", "visitor history",
                "who has been", "face log", "recognised visitors",
            ],
            "recent_alerts": [
                "recent alert", "show alert", "alert history", "latest alert",
                "alerts today", "security alert", "check alert", "view alert",
                "any alert", "warning", "critical alert",
            ],
            "what_happened": [
                "what happened", "last night", "overnight", "while i was",
                "events today", "activity summary", "event log",
                "what did i miss", "summary of events", "activity report",
            ],
            "check_zone": [
                "check backyard", "check garage", "check front", "check driveway",
                "check side", "zone status", "zone info", "monitor zone",
                "how is the", "status of",
            ],
            "add_zone": [
                "add zone", "new zone", "create zone", "add a new camera zone",
                "define zone", "setup zone", "register zone",
            ],
            "zone_heatmap": [
                "heatmap", "activity map", "heat map", "activity pattern",
                "busy hours", "peak hours",
            ],
            "recent_detections": [
                "recent detection", "what was detected", "detection history",
                "object detected", "detection log", "detected objects",
                "show detections", "latest detection",
            ],
            "add_camera": [
                "add camera", "register camera", "new camera", "setup camera",
                "connect camera", "pair camera",
            ],
            "remove_camera": [
                "remove camera", "unregister camera", "delete camera",
                "disconnect camera", "unpair camera",
            ],
            "camera_status": [
                "camera status", "all cameras", "camera health", "camera list",
                "cameras online", "camera overview", "list cameras",
            ],
            "recording_list": [
                "recording", "saved clip", "video clip", "recorded video",
                "show recording", "list recording", "playback",
            ],
            "start_recording": [
                "start recording", "record now", "begin recording",
                "capture video", "start capture",
            ],
            "timelapse": [
                "timelapse", "time lapse", "time-lapse", "generate timelapse",
                "create timelapse",
            ],
            "model_info": [
                "model info", "vision model", "detection model", "model performance",
                "inference stat", "model version", "which model", "ai model",
                "model accuracy",
            ],
            "anomaly_report": [
                "anomaly", "anomalies", "unusual activity", "intruder",
                "suspicious", "loitering", "abandoned object", "tampering",
            ],
            "monitoring_toggle": [
                "enable monitoring", "disable monitoring", "pause monitoring",
                "resume monitoring", "stop monitoring", "start monitoring",
                "surveillance on", "surveillance off",
            ],
            "configure_camera": [
                "configure camera", "camera setting", "change resolution",
                "change fps", "camera config", "update camera",
            ],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent

        return "general"

    # ------------------------------------------------------------------
    # Camera Management helpers
    # ------------------------------------------------------------------

    def _get_camera_by_location(self, location: str) -> Optional[Dict[str, Any]]:
        """Find a camera by matching its location or name loosely."""
        location = location.lower().replace("_", " ")
        for cam in self.cameras.values():
            cam_loc = cam.get("location", "").lower().replace("_", " ")
            cam_name = cam.get("name", "").lower()
            if location in cam_loc or location in cam_name:
                return cam
        return None

    def _get_cameras_by_status(self, status: str) -> List[Dict[str, Any]]:
        """Return all cameras matching the specified status."""
        return [c for c in self.cameras.values() if c["status"] == status]

    def _register_camera(
        self,
        name: str,
        ip_address: str,
        location: str,
        resolution: str = "VGA",
        fps: int = 15,
    ) -> Dict[str, Any]:
        """Register a new ESP32-CAM device."""
        camera_id = f"cam-{location.replace(' ', '-').lower()}-{uuid.uuid4().hex[:4]}"
        camera = {
            "camera_id": camera_id,
            "name": name,
            "ip_address": ip_address,
            "location": location,
            "resolution": resolution,
            "fps": fps,
            "status": "online",
            "night_vision": False,
            "ir_enabled": True,
            "model": "ESP32-CAM AI-Thinker",
            "firmware": "v2.4.1",
            "uptime_hours": 0.0,
            "last_seen": datetime.utcnow().isoformat(),
            "registered_at": datetime.utcnow().isoformat(),
            "stream_url": f"http://{ip_address}:81/stream",
            "snapshot_url": f"http://{ip_address}/capture",
        }
        self.cameras[camera_id] = camera
        logger.info(f"Camera registered: {camera_id} ({name})")
        return camera

    def _unregister_camera(self, camera_id: str) -> bool:
        """Remove a camera from the registry."""
        if camera_id in self.cameras:
            del self.cameras[camera_id]
            logger.info(f"Camera unregistered: {camera_id}")
            return True
        return False

    def _format_camera_status(self, cam: Dict[str, Any]) -> str:
        """Format a single camera's status into a readable string."""
        status_icon = CAMERA_STATUS.get(cam["status"], cam["status"])
        nv = "🌙 On" if cam.get("night_vision") else "☀️ Off"
        return (
            f"**{cam['name']}** (`{cam['camera_id']}`)\n"
            f"  - Status: {status_icon}\n"
            f"  - Location: {cam.get('location', 'N/A')}\n"
            f"  - Resolution: {cam['resolution']} @ {cam['fps']} FPS\n"
            f"  - Night Vision: {nv}\n"
            f"  - Model: {cam.get('model', 'N/A')} | FW: {cam.get('firmware', 'N/A')}\n"
            f"  - Uptime: {cam.get('uptime_hours', 0):.1f}h\n"
            f"  - Last Seen: {cam.get('last_seen', 'N/A')}\n"
            f"  - Stream: `{cam.get('stream_url', 'N/A')}`"
        )

    # ------------------------------------------------------------------
    # Zone Management helpers
    # ------------------------------------------------------------------

    def _get_zone(self, zone_query: str) -> Optional[Dict[str, Any]]:
        """Find a zone by id or name."""
        zone_query = zone_query.lower().replace(" ", "_")
        for zone in self.zones.values():
            if zone_query in zone["id"].lower() or zone_query.replace("_", " ") in zone["name"].lower():
                return zone
        return None

    def _create_zone(
        self,
        name: str,
        description: str,
        sensitivity: float = 0.7,
        alert_on: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new monitoring zone."""
        zone_id = name.lower().replace(" ", "_").replace("-", "_")
        zone = {
            "id": zone_id,
            "name": name,
            "description": description,
            "sensitivity": max(0.0, min(1.0, sensitivity)),
            "alert_on": alert_on or ["person"],
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
            "event_count": 0,
        }
        self.zones[zone_id] = zone
        self._zone_activity[zone_id] = {str(h): 0 for h in range(24)}
        logger.info(f"Zone created: {zone_id} ({name})")
        return zone

    def _format_zone_info(self, zone: Dict[str, Any]) -> str:
        """Format a zone's information into a readable string."""
        active = "✅ Active" if zone.get("active") else "⏸️ Paused"
        alerts = ", ".join(zone.get("alert_on", []))
        return (
            f"**{zone['name']}** (`{zone['id']}`)\n"
            f"  - Status: {active}\n"
            f"  - Description: {zone.get('description', 'N/A')}\n"
            f"  - Sensitivity: {zone.get('sensitivity', 0.7):.0%}\n"
            f"  - Alert On: {alerts}\n"
            f"  - Total Events: {zone.get('event_count', 0)}"
        )

    def _generate_zone_heatmap_text(self, zone_id: str) -> str:
        """Generate an ASCII heatmap of hourly activity for a zone."""
        activity = self._zone_activity.get(zone_id, {})
        if not activity:
            return "No activity data available for this zone."

        max_val = max(activity.values()) if activity.values() else 1
        lines = ["```"]
        lines.append("Hour  | Activity")
        lines.append("------+--------------------------------------------------")
        for h in range(24):
            count = activity.get(str(h), 0)
            bar_len = int((count / max(max_val, 1)) * 40) if max_val > 0 else 0
            bar = "█" * bar_len
            label = f"{h:02d}:00"
            lines.append(f"{label} | {bar} ({count})")
        lines.append("```")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Detection helpers
    # ------------------------------------------------------------------

    def _get_recent_detections(
        self,
        limit: int = 10,
        zone_id: Optional[str] = None,
        object_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent detections with optional filters."""
        filtered = self.detections
        if zone_id:
            filtered = [d for d in filtered if d["zone_id"] == zone_id]
        if object_type:
            filtered = [d for d in filtered if d["object_type"] == object_type]
        return filtered[:limit]

    def _format_detection(self, det: Dict[str, Any]) -> str:
        """Format a detection event into a table row."""
        obj_label = DETECTABLE_OBJECTS.get(det["object_type"], det["object_type"])
        conf = f"{det['confidence']:.0%}"
        zone = det.get("zone_id", "N/A")
        cam = det.get("camera_id", "N/A")
        ts = det.get("timestamp", "N/A")
        try:
            dt = datetime.fromisoformat(ts)
            ts = dt.strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            pass
        return f"| {ts} | {obj_label} | {conf} | {zone} | {cam} |"

    def _add_detection(
        self,
        object_type: str,
        confidence: float,
        zone_id: str,
        camera_id: str,
    ) -> Dict[str, Any]:
        """Register a new detection event."""
        now = datetime.utcnow()
        detection = {
            "detection_id": f"det-{uuid.uuid4().hex[:8]}",
            "timestamp": now.isoformat(),
            "object_type": object_type,
            "confidence": confidence,
            "zone_id": zone_id,
            "camera_id": camera_id,
            "bounding_box": {
                "x": random.randint(50, 400),
                "y": random.randint(30, 300),
                "width": random.randint(60, 200),
                "height": random.randint(80, 280),
            },
            "frame_path": f"/data/frames/{camera_id}/{now.strftime('%Y%m%d_%H%M%S')}.jpg",
            "reviewed": False,
        }
        self.detections.insert(0, detection)
        self._inference_stats["total_detections"] += 1
        return detection

    # ------------------------------------------------------------------
    # Alert helpers
    # ------------------------------------------------------------------

    def _get_recent_alerts(
        self,
        limit: int = 10,
        level: Optional[str] = None,
        zone_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent alerts with optional filters."""
        filtered = self.alerts
        if level:
            filtered = [a for a in filtered if a["level"] == level]
        if zone_id:
            filtered = [a for a in filtered if a["zone_id"] == zone_id]
        return filtered[:limit]

    def _create_alert(
        self,
        level: str,
        title: str,
        description: str,
        zone_id: str,
        camera_id: str,
    ) -> Dict[str, Any]:
        """Create a new alert and push it to the head of the list."""
        now = datetime.utcnow()
        alert = {
            "alert_id": f"alert-{uuid.uuid4().hex[:8]}",
            "timestamp": now.isoformat(),
            "level": level,
            "title": title,
            "description": description,
            "zone_id": zone_id,
            "camera_id": camera_id,
            "acknowledged": False,
            "frame_path": f"/data/frames/{camera_id}/alert_{now.strftime('%Y%m%d_%H%M%S')}.jpg",
        }
        self.alerts.insert(0, alert)
        return alert

    def _format_alert(self, alert: Dict[str, Any]) -> str:
        """Format an alert into a readable block."""
        level_icon = ALERT_LEVELS.get(alert["level"], alert["level"])
        ack = "✅ Acknowledged" if alert.get("acknowledged") else "🔔 Pending"
        ts = alert.get("timestamp", "N/A")
        try:
            dt = datetime.fromisoformat(ts)
            ts = dt.strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            pass
        return (
            f"### {level_icon} {alert['title']}\n"
            f"- **Time:** {ts}\n"
            f"- **Zone:** {alert.get('zone_id', 'N/A')} | **Camera:** {alert.get('camera_id', 'N/A')}\n"
            f"- **Status:** {ack}\n"
            f"- {alert.get('description', '')}\n"
            f"- 📸 Frame: `{alert.get('frame_path', 'N/A')}`\n"
        )

    # ------------------------------------------------------------------
    # Visitor / Person Recognition helpers
    # ------------------------------------------------------------------

    def _get_recent_visitors(
        self,
        limit: int = 10,
        known_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """Retrieve recent visitors with optional known-only filter."""
        filtered = self.visitors
        if known_only:
            filtered = [v for v in filtered if v["known"]]
        return filtered[:limit]

    def _format_visitor(self, visitor: Dict[str, Any]) -> str:
        """Format a visitor entry into a table row."""
        status = "✅ Known" if visitor["known"] else "❓ Unknown"
        ts = visitor.get("timestamp", "N/A")
        try:
            dt = datetime.fromisoformat(ts)
            ts = dt.strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            pass
        duration = visitor.get("duration_seconds", 0)
        if duration >= 60:
            dur_str = f"{duration // 60}m {duration % 60}s"
        else:
            dur_str = f"{duration}s"
        conf = f"{visitor['confidence']:.0%}" if visitor["confidence"] > 0 else "N/A"
        return f"| {ts} | {visitor['name']} | {status} | {conf} | {dur_str} |"

    # ------------------------------------------------------------------
    # Recording helpers
    # ------------------------------------------------------------------

    def _get_recordings(
        self,
        limit: int = 10,
        zone_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve recordings sorted by timestamp, with optional zone filter."""
        recs = sorted(self.recordings.values(), key=lambda r: r["timestamp"], reverse=True)
        if zone_id:
            recs = [r for r in recs if r["zone_id"] == zone_id]
        return recs[:limit]

    def _start_new_recording(
        self,
        camera_id: str,
        zone_id: str,
        trigger: str = "manual",
    ) -> Dict[str, Any]:
        """Create a new recording entry (simulated)."""
        rec_id = f"rec-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()
        recording = {
            "recording_id": rec_id,
            "timestamp": now.isoformat(),
            "trigger": trigger,
            "zone_id": zone_id,
            "camera_id": camera_id,
            "duration_seconds": 0,
            "file_path": f"/data/recordings/{camera_id}/{now.strftime('%Y%m%d_%H%M%S')}.mp4",
            "file_size_mb": 0.0,
            "status": "recording",
            "has_detections": False,
        }
        self.recordings[rec_id] = recording
        return recording

    def _format_recording(self, rec: Dict[str, Any]) -> str:
        """Format a recording into a table row."""
        ts = rec.get("timestamp", "N/A")
        try:
            dt = datetime.fromisoformat(ts)
            ts = dt.strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            pass
        dur = rec.get("duration_seconds", 0)
        if dur >= 60:
            dur_str = f"{dur // 60}m {dur % 60}s"
        else:
            dur_str = f"{dur}s"
        size = f"{rec.get('file_size_mb', 0):.1f} MB"
        status = rec.get("status", "unknown")
        trigger = rec.get("trigger", "N/A")
        return f"| {ts} | {rec.get('camera_id', 'N/A')} | {trigger} | {dur_str} | {size} | {status} |"

    # ------------------------------------------------------------------
    # Night Vision helpers
    # ------------------------------------------------------------------

    def _set_night_vision(self, enabled: bool) -> Dict[str, Any]:
        """Toggle night vision across all cameras."""
        self.night_vision_enabled = enabled
        updated = []
        for cam in self.cameras.values():
            if cam.get("ir_enabled"):
                cam["night_vision"] = enabled
                updated.append(cam["camera_id"])
        return {
            "night_vision_enabled": enabled,
            "updated_cameras": updated,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # ------------------------------------------------------------------
    # Model Management helpers
    # ------------------------------------------------------------------

    def _get_model_summary(self, model_key: Optional[str] = None) -> str:
        """Generate a summary of one or all vision models."""
        if model_key and model_key in self.models:
            m = self.models[model_key]
            return (
                f"**{m['name']}** (v{m['version']})\n"
                f"  - Size: {m['size_mb']} MB | Quantised: {'Yes' if m['quantised'] else 'No'}\n"
                f"  - Input: {m['input_resolution']} | Classes: {m['classes']}\n"
                f"  - FPS (ESP32): {m['fps_esp32']} | FPS (Server): {m['fps_server']}\n"
                f"  - mAP@50: {m['accuracy_map50']:.1%}"
            )

        lines = []
        for key, m in self.models.items():
            active = " ⬅️ **Active**" if key == self._inference_stats.get("active_model") else ""
            lines.append(
                f"- **{m['name']}** (v{m['version']}){active}  \n"
                f"  {m['size_mb']} MB | {m['input_resolution']} | "
                f"ESP32 {m['fps_esp32']} FPS | Server {m['fps_server']} FPS | "
                f"mAP@50 {m['accuracy_map50']:.1%}"
            )
        return "\n".join(lines)

    def _get_inference_stats_summary(self) -> str:
        """Format inference statistics into readable text."""
        s = self._inference_stats
        return (
            f"- **Total Frames Processed:** {s['total_frames_processed']:,}\n"
            f"- **Total Detections:** {s['total_detections']:,}\n"
            f"- **Avg Inference Latency:** {s['avg_inference_ms']:.1f} ms\n"
            f"- **Peak Inference Latency:** {s['peak_inference_ms']:.1f} ms\n"
            f"- **Active Model:** {s.get('active_model', 'N/A')}\n"
            f"- **Model Switches:** {s['model_switches']}\n"
            f"- **Last Inference:** {s.get('last_inference', 'N/A')}"
        )

    # ------------------------------------------------------------------
    # Anomaly Detection helpers
    # ------------------------------------------------------------------

    def _analyze_anomalies(self) -> List[Dict[str, Any]]:
        """Analyse recent detections for anomalous patterns."""
        anomalies: List[Dict[str, Any]] = []
        now = datetime.utcnow()

        # Check for detections at unusual hours (midnight to 5 AM)
        for det in self.detections:
            try:
                ts = datetime.fromisoformat(det["timestamp"])
            except (ValueError, TypeError):
                continue
            if ts.hour < 5 and det["object_type"] == "person":
                anomalies.append({
                    "type": "unusual_hour_person",
                    "severity": "warning",
                    "description": f"Person detected at {ts.strftime('%H:%M')} in zone {det['zone_id']}",
                    "detection_id": det["detection_id"],
                    "timestamp": det["timestamp"],
                    "zone_id": det["zone_id"],
                })

        # Check for repeated unknown visitors
        unknown_visitors = [v for v in self.visitors if not v["known"]]
        if len(unknown_visitors) >= 3:
            anomalies.append({
                "type": "repeated_unknowns",
                "severity": "warning",
                "description": f"{len(unknown_visitors)} unknown visitors detected in recent history",
                "timestamp": now.isoformat(),
                "zone_id": "front_door",
            })

        # Check for offline cameras (potential tampering)
        offline_cams = self._get_cameras_by_status("offline")
        for cam in offline_cams:
            last_seen = cam.get("last_seen", now.isoformat())
            try:
                ls_dt = datetime.fromisoformat(last_seen)
                offline_hours = (now - ls_dt).total_seconds() / 3600
            except (ValueError, TypeError):
                offline_hours = 0
            if offline_hours > 1:
                anomalies.append({
                    "type": "camera_offline",
                    "severity": "critical" if offline_hours > 6 else "warning",
                    "description": (
                        f"Camera {cam['camera_id']} ({cam['name']}) has been offline "
                        f"for {offline_hours:.1f} hours. Possible tampering or power failure."
                    ),
                    "camera_id": cam["camera_id"],
                    "timestamp": now.isoformat(),
                    "zone_id": cam.get("location", "unknown"),
                })

        # Check for high-frequency detections in sensitive zones (loitering)
        for zone_id in ["side_yard", "garage"]:
            zone_dets = [
                d for d in self.detections
                if d["zone_id"] == zone_id and d["object_type"] == "person"
            ]
            if len(zone_dets) >= 3:
                anomalies.append({
                    "type": "potential_loitering",
                    "severity": "warning",
                    "description": f"Multiple person detections ({len(zone_dets)}) in sensitive zone '{zone_id}'",
                    "timestamp": now.isoformat(),
                    "zone_id": zone_id,
                })

        return anomalies

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_show_camera(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to show a specific camera feed."""
        # Try to extract location from message
        location = self._extract_location_from_message(message)
        cam = self._get_camera_by_location(location) if location else None

        if cam:
            status_icon = CAMERA_STATUS.get(cam["status"], cam["status"])
            nv = "🌙 On" if cam.get("night_vision") else "☀️ Off"
            content = (
                f"## 📹 {cam['name']}\n\n"
                f"| Property | Value |\n"
                f"|----------|-------|\n"
                f"| Status | {status_icon} |\n"
                f"| Camera ID | `{cam['camera_id']}` |\n"
                f"| IP Address | `{cam['ip_address']}` |\n"
                f"| Location | {cam.get('location', 'N/A')} |\n"
                f"| Resolution | {cam['resolution']} @ {cam['fps']} FPS |\n"
                f"| Night Vision | {nv} |\n"
                f"| Model | {cam.get('model', 'N/A')} |\n"
                f"| Firmware | {cam.get('firmware', 'N/A')} |\n"
                f"| Uptime | {cam.get('uptime_hours', 0):.1f} hours |\n"
                f"| Last Seen | {cam.get('last_seen', 'N/A')} |\n\n"
                f"**🔗 Live Stream:** `{cam.get('stream_url', 'N/A')}`  \n"
                f"**📸 Snapshot:** `{cam.get('snapshot_url', 'N/A')}`\n\n"
            )

            # Show recent detections for this camera
            cam_dets = [d for d in self.detections if d["camera_id"] == cam["camera_id"]][:5]
            if cam_dets:
                content += "### Recent Detections\n\n"
                content += "| Time | Object | Confidence | Zone | Camera |\n"
                content += "|------|--------|------------|------|--------|\n"
                for det in cam_dets:
                    content += self._format_detection(det) + "\n"

            if cam["status"] == "offline":
                content += (
                    "\n> ⚠️ This camera is currently **offline**. "
                    "Check the power supply and Wi-Fi connection.\n"
                )

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.95,
                metadata={"intent": "show_camera", "camera_id": cam["camera_id"]},
                suggestions=[
                    f"Start recording on {cam['name']}",
                    f"Show recent alerts for {cam.get('location', 'this area')}",
                    f"Toggle night vision on {cam['name']}",
                ],
            )
        else:
            # Show all cameras as fallback
            return await self._handle_camera_status(context, message)

    async def _handle_camera_status(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests for camera fleet overview."""
        online = self._get_cameras_by_status("online")
        offline = self._get_cameras_by_status("offline")
        recording = self._get_cameras_by_status("recording")

        total = len(self.cameras)
        content = (
            "## 📹 Camera Fleet Overview\n\n"
            f"**Total Cameras:** {total} | "
            f"🟢 Online: {len(online)} | "
            f"🔵 Recording: {len(recording)} | "
            f"🔴 Offline: {len(offline)}\n\n"
            "### Camera Details\n\n"
            "| Camera | Status | Location | Resolution | FPS | Night Vision |\n"
            "|--------|--------|----------|------------|-----|-------------|\n"
        )

        for cam in self.cameras.values():
            status_icon = CAMERA_STATUS.get(cam["status"], cam["status"])
            nv = "🌙" if cam.get("night_vision") else "☀️"
            content += (
                f"| {cam['name']} | {status_icon} | {cam.get('location', 'N/A')} | "
                f"{cam['resolution']} | {cam['fps']} | {nv} |\n"
            )

        if offline:
            content += "\n### ⚠️ Offline Cameras\n\n"
            for cam in offline:
                content += (
                    f"- **{cam['name']}** (`{cam['camera_id']}`) — "
                    f"Last seen: {cam.get('last_seen', 'Unknown')}. "
                    f"Check power and Wi-Fi connection.\n"
                )

        content += (
            f"\n**Monitoring Status:** {'🟢 Active' if self.monitoring_active else '🔴 Paused'}  \n"
            f"**Night Vision:** {'🌙 Enabled' if self.night_vision_enabled else '☀️ Disabled'}  \n"
            f"**Motion Sensitivity:** {self.motion_sensitivity:.0%}\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.93,
            metadata={"intent": "camera_status", "total": total, "online": len(online), "offline": len(offline)},
            suggestions=[
                "Show me the front door camera",
                "Enable night vision",
                "Check recent alerts",
                "Add a new camera",
            ],
        )

    async def _handle_add_camera(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to register a new camera."""
        # Extract potential IP from message
        ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", message)
        ip_address = ip_match.group(1) if ip_match else "192.168.1.110"

        # Extract location hint
        location = self._extract_location_from_message(message) or "new_zone"
        name = f"Camera - {location.replace('_', ' ').title()}"

        new_cam = self._register_camera(
            name=name,
            ip_address=ip_address,
            location=location,
            resolution="VGA",
            fps=15,
        )

        content = (
            f"## ✅ Camera Registered Successfully\n\n"
            f"| Property | Value |\n"
            f"|----------|-------|\n"
            f"| Camera ID | `{new_cam['camera_id']}` |\n"
            f"| Name | {new_cam['name']} |\n"
            f"| IP Address | `{new_cam['ip_address']}` |\n"
            f"| Location | {new_cam['location']} |\n"
            f"| Resolution | {new_cam['resolution']} @ {new_cam['fps']} FPS |\n"
            f"| Stream URL | `{new_cam['stream_url']}` |\n\n"
            "The camera is now online and ready for monitoring. "
            "Default settings have been applied — you can customise resolution, "
            "FPS, and night vision at any time.\n\n"
            "> 💡 Make sure the ESP32-CAM is connected to the same Wi-Fi network "
            "and has a stable power supply for reliable 24/7 operation."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={"intent": "add_camera", "camera_id": new_cam["camera_id"]},
            actions=[{"type": "camera_registered", "camera_id": new_cam["camera_id"]}],
            suggestions=[
                "Configure camera resolution and FPS",
                "Assign camera to a zone",
                "Show all cameras",
            ],
        )

    async def _handle_remove_camera(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to unregister a camera."""
        location = self._extract_location_from_message(message)
        cam = self._get_camera_by_location(location) if location else None

        if cam:
            cam_id = cam["camera_id"]
            cam_name = cam["name"]
            self._unregister_camera(cam_id)
            content = (
                f"## 🗑️ Camera Removed\n\n"
                f"**{cam_name}** (`{cam_id}`) has been unregistered from the system.\n\n"
                f"- All associated recordings are retained in `/data/recordings/{cam_id}/`\n"
                f"- Detection history referencing this camera remains in the log\n"
                f"- Re-register at any time with the same IP address\n"
            )
            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.88,
                metadata={"intent": "remove_camera", "camera_id": cam_id},
                suggestions=["Show all cameras", "Add a new camera"],
            )
        else:
            content = (
                "I could not identify which camera to remove. "
                "Please specify the camera by name or location. "
                "Available cameras:\n\n"
            )
            for cam in self.cameras.values():
                content += f"- **{cam['name']}** (`{cam['camera_id']}`) — {cam.get('location', 'N/A')}\n"
            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.5,
                metadata={"intent": "remove_camera"},
                requires_followup=True,
            )

    async def _handle_recent_detections(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests for recent detection history."""
        # Check for zone or object type filter
        zone_filter = None
        obj_filter = None
        for zone_id in self.zones:
            if zone_id.replace("_", " ") in message:
                zone_filter = zone_id
                break
        for obj in DETECTABLE_OBJECTS:
            if obj in message:
                obj_filter = obj
                break

        detections = self._get_recent_detections(
            limit=15, zone_id=zone_filter, object_type=obj_filter
        )

        filter_desc = ""
        if zone_filter:
            filter_desc += f" in **{zone_filter}**"
        if obj_filter:
            filter_desc += f" of type **{obj_filter}**"

        content = f"## 🔍 Recent Detections{filter_desc}\n\n"

        if detections:
            content += "| Time | Object | Confidence | Zone | Camera |\n"
            content += "|------|--------|------------|------|--------|\n"
            for det in detections:
                content += self._format_detection(det) + "\n"

            # Detection summary
            obj_counts: Dict[str, int] = {}
            for det in detections:
                obj_counts[det["object_type"]] = obj_counts.get(det["object_type"], 0) + 1
            content += "\n### Summary\n\n"
            for obj, count in sorted(obj_counts.items(), key=lambda x: x[1], reverse=True):
                label = DETECTABLE_OBJECTS.get(obj, obj)
                content += f"- {label}: **{count}** detections\n"
        else:
            content += "No detections found matching the specified criteria.\n"

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.92,
            metadata={
                "intent": "recent_detections",
                "count": len(detections),
                "zone_filter": zone_filter,
                "object_filter": obj_filter,
            },
            suggestions=[
                "Show detections for front door only",
                "Show person detections",
                "What happened last night?",
            ],
        )

    async def _handle_motion_sensitivity(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to view or adjust motion sensitivity."""
        new_sensitivity = None
        if "high" in message:
            new_sensitivity = 0.9
        elif "medium" in message or "normal" in message or "default" in message:
            new_sensitivity = 0.7
        elif "low" in message:
            new_sensitivity = 0.4
        elif "max" in message or "maximum" in message:
            new_sensitivity = 1.0
        elif "min" in message or "minimum" in message:
            new_sensitivity = 0.2

        # Try to extract a numeric value
        if new_sensitivity is None:
            num_match = re.search(r"(\d+\.?\d*)\s*%?", message)
            if num_match:
                val = float(num_match.group(1))
                if val > 1:
                    val = val / 100.0
                new_sensitivity = max(0.1, min(1.0, val))

        if new_sensitivity is not None:
            old_sensitivity = self.motion_sensitivity
            self.motion_sensitivity = new_sensitivity

            # Update all active zones
            for zone in self.zones.values():
                if zone.get("active"):
                    zone["sensitivity"] = new_sensitivity

            content = (
                f"## ⚡ Motion Sensitivity Updated\n\n"
                f"| Setting | Value |\n"
                f"|---------|-------|\n"
                f"| Previous | {old_sensitivity:.0%} |\n"
                f"| New | {self.motion_sensitivity:.0%} |\n"
                f"| Zones Updated | {sum(1 for z in self.zones.values() if z.get('active'))} |\n\n"
            )

            if new_sensitivity >= 0.9:
                content += (
                    "> ⚠️ High sensitivity may increase false positives from shadows, "
                    "small animals, and wind-blown objects. Monitor alert frequency "
                    "and adjust if needed.\n"
                )
            elif new_sensitivity <= 0.3:
                content += (
                    "> ⚠️ Low sensitivity may miss smaller or slower-moving objects. "
                    "Ensure critical zones like the front door have adequate coverage.\n"
                )

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.94,
                metadata={
                    "intent": "motion_sensitivity",
                    "old_value": old_sensitivity,
                    "new_value": self.motion_sensitivity,
                },
                suggestions=[
                    "Show current zone configurations",
                    "Check recent detections",
                    "View camera status",
                ],
            )
        else:
            content = (
                f"## ⚡ Motion Sensitivity\n\n"
                f"**Current sensitivity:** {self.motion_sensitivity:.0%}\n\n"
                "### Per-Zone Sensitivity\n\n"
                "| Zone | Sensitivity | Status |\n"
                "|------|-------------|--------|\n"
            )
            for zone in self.zones.values():
                status = "✅ Active" if zone.get("active") else "⏸️ Paused"
                content += f"| {zone['name']} | {zone.get('sensitivity', 0.7):.0%} | {status} |\n"

            content += (
                "\nTo adjust, say something like:\n"
                "- *\"Set motion sensitivity to high\"*\n"
                "- *\"Motion sensitivity 85%\"*\n"
                "- *\"Detect motion sensitivity low\"*\n"
            )

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.88,
                metadata={"intent": "motion_sensitivity", "current": self.motion_sensitivity},
                suggestions=[
                    "Set sensitivity to high",
                    "Set sensitivity to 60%",
                    "Set sensitivity to low",
                ],
            )

    async def _handle_night_vision(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle night vision toggle requests."""
        enable = None
        if any(kw in message for kw in ["enable", "on", "activate", "turn on"]):
            enable = True
        elif any(kw in message for kw in ["disable", "off", "deactivate", "turn off"]):
            enable = False
        elif "toggle" in message:
            enable = not self.night_vision_enabled
        else:
            # Default: toggle
            enable = not self.night_vision_enabled

        result = self._set_night_vision(enable)

        status = "🌙 Enabled" if enable else "☀️ Disabled"
        content = (
            f"## 🌙 Night Vision {status}\n\n"
            f"Night vision has been **{'enabled' if enable else 'disabled'}** "
            f"across {len(result['updated_cameras'])} camera(s).\n\n"
            "### Updated Cameras\n\n"
            "| Camera | Night Vision | IR LEDs |\n"
            "|--------|-------------|--------|\n"
        )

        for cam_id in result["updated_cameras"]:
            cam = self.cameras.get(cam_id, {})
            nv = "🌙 On" if cam.get("night_vision") else "☀️ Off"
            ir = "✅ Available" if cam.get("ir_enabled") else "❌ N/A"
            content += f"| {cam.get('name', cam_id)} | {nv} | {ir} |\n"

        skipped = [
            c for c in self.cameras.values()
            if c["camera_id"] not in result["updated_cameras"]
        ]
        if skipped:
            content += "\n### Skipped (No IR Support)\n\n"
            for cam in skipped:
                content += f"- {cam['name']} (`{cam['camera_id']}`) — IR LEDs not available\n"

        if enable:
            content += (
                "\n> 💡 IR LEDs will illuminate the scene with infrared light invisible "
                "to the human eye. Image will switch to grayscale for optimal "
                "low-light capture.\n"
            )
        else:
            content += (
                "\n> ☀️ Cameras will use ambient light only. Ensure adequate "
                "outdoor lighting for night-time coverage.\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.96,
            metadata={
                "intent": "night_vision",
                "enabled": enable,
                "cameras_updated": len(result["updated_cameras"]),
            },
            suggestions=[
                "Show camera status",
                "Check motion sensitivity",
                "View recent detections",
            ],
        )

    async def _handle_who_visited(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle visitor log queries."""
        known_only = "known" in message or "recognised" in message or "recognized" in message
        limit = 15

        visitors = self._get_recent_visitors(limit=limit, known_only=known_only)

        filter_label = " (Known Only)" if known_only else ""
        content = (
            f"## 👥 Visitor Log{filter_label}\n\n"
            f"**Total Visitors Recorded:** {len(self.visitors)} | "
            f"**Known:** {sum(1 for v in self.visitors if v['known'])} | "
            f"**Unknown:** {sum(1 for v in self.visitors if not v['known'])}\n\n"
        )

        if visitors:
            content += "| Time | Name | Status | Confidence | Duration |\n"
            content += "|------|------|--------|------------|----------|\n"
            for v in visitors:
                content += self._format_visitor(v) + "\n"
        else:
            content += "No visitor records found.\n"

        # Known persons database
        content += "\n### 🧑 Known Persons Database\n\n"
        content += "| Name | Relationship | Total Visits | Last Seen |\n"
        content += "|------|-------------|-------------|----------|\n"
        for p in self._known_persons.values():
            last_seen = p.get("last_seen", "N/A")
            try:
                dt = datetime.fromisoformat(last_seen)
                last_seen = dt.strftime("%Y-%m-%d %H:%M")
            except (ValueError, TypeError):
                pass
            content += f"| {p['name']} | {p['relationship']} | {p['total_visits']} | {last_seen} |\n"

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.93,
            metadata={
                "intent": "who_visited",
                "total_visitors": len(self.visitors),
                "known_count": sum(1 for v in self.visitors if v["known"]),
                "unknown_count": sum(1 for v in self.visitors if not v["known"]),
            },
            suggestions=[
                "Show only unknown visitors",
                "Show recent alerts",
                "Check front door camera",
            ],
        )

    async def _handle_recent_alerts(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests for recent alert history."""
        level_filter = None
        if "critical" in message:
            level_filter = "critical"
        elif "warning" in message:
            level_filter = "warning"
        elif "info" in message and "information" not in message:
            level_filter = "info"

        zone_filter = None
        for zone_id in self.zones:
            if zone_id.replace("_", " ") in message:
                zone_filter = zone_id
                break

        alerts = self._get_recent_alerts(limit=10, level=level_filter, zone_id=zone_filter)

        filter_parts = []
        if level_filter:
            filter_parts.append(f"Level: **{level_filter}**")
        if zone_filter:
            filter_parts.append(f"Zone: **{zone_filter}**")
        filter_desc = " | ".join(filter_parts) if filter_parts else "All Levels"

        critical_count = sum(1 for a in self.alerts if a["level"] == "critical")
        warning_count = sum(1 for a in self.alerts if a["level"] == "warning")
        info_count = sum(1 for a in self.alerts if a["level"] == "info")
        unack = sum(1 for a in self.alerts if not a.get("acknowledged"))

        content = (
            f"## 🚨 Alert History\n\n"
            f"**Filter:** {filter_desc}  \n"
            f"**Summary:** 🚨 Critical: {critical_count} | ⚠️ Warning: {warning_count} | "
            f"ℹ️ Info: {info_count} | 🔔 Unacknowledged: {unack}\n\n"
        )

        if alerts:
            for alert in alerts:
                content += self._format_alert(alert) + "\n"
        else:
            content += "No alerts matching the specified criteria.\n"

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.94,
            metadata={
                "intent": "recent_alerts",
                "total_alerts": len(self.alerts),
                "critical": critical_count,
                "warning": warning_count,
                "info": info_count,
                "unacknowledged": unack,
            },
            suggestions=[
                "Show critical alerts only",
                "Check front door camera",
                "View anomaly report",
                "Acknowledge all alerts",
            ],
        )

    async def _handle_check_zone(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to check a specific monitoring zone."""
        location = self._extract_location_from_message(message)
        zone = self._get_zone(location) if location else None

        if zone:
            # Get zone-specific detections and alerts
            zone_dets = [d for d in self.detections if d["zone_id"] == zone["id"]][:5]
            zone_alerts = [a for a in self.alerts if a["zone_id"] == zone["id"]][:3]
            zone_cams = [c for c in self.cameras.values() if c.get("location") == zone["id"]]

            content = (
                f"## 📍 Zone Report: {zone['name']}\n\n"
                f"{self._format_zone_info(zone)}\n\n"
            )

            # Associated cameras
            content += "### 📹 Cameras in Zone\n\n"
            if zone_cams:
                for cam in zone_cams:
                    status_icon = CAMERA_STATUS.get(cam["status"], cam["status"])
                    content += f"- **{cam['name']}** — {status_icon}\n"
            else:
                content += "- No cameras directly assigned to this zone.\n"

            # Recent detections
            content += "\n### 🔍 Recent Detections\n\n"
            if zone_dets:
                content += "| Time | Object | Confidence | Camera |\n"
                content += "|------|--------|------------|--------|\n"
                for det in zone_dets:
                    obj_label = DETECTABLE_OBJECTS.get(det["object_type"], det["object_type"])
                    ts = det.get("timestamp", "N/A")
                    try:
                        dt = datetime.fromisoformat(ts)
                        ts = dt.strftime("%Y-%m-%d %H:%M")
                    except (ValueError, TypeError):
                        pass
                    content += f"| {ts} | {obj_label} | {det['confidence']:.0%} | {det['camera_id']} |\n"
            else:
                content += "No recent detections in this zone.\n"

            # Recent alerts
            content += "\n### 🚨 Recent Alerts\n\n"
            if zone_alerts:
                for alert in zone_alerts:
                    content += self._format_alert(alert) + "\n"
            else:
                content += "No recent alerts for this zone.\n"

            # Heatmap
            content += "\n### 📊 Activity Heatmap (24h)\n\n"
            content += self._generate_zone_heatmap_text(zone["id"])

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.94,
                metadata={"intent": "check_zone", "zone_id": zone["id"]},
                suggestions=[
                    f"Show detections for {zone['name']}",
                    f"Adjust sensitivity for {zone['name']}",
                    "Show all zones",
                ],
            )
        else:
            # Show all zones
            content = "## 📍 All Monitoring Zones\n\n"
            for z in self.zones.values():
                content += self._format_zone_info(z) + "\n\n---\n\n"

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.80,
                metadata={"intent": "check_zone", "zones": list(self.zones.keys())},
                suggestions=[
                    "Check the front door zone",
                    "Check the backyard zone",
                    "Add a new zone",
                ],
            )

    async def _handle_add_zone(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to create a new monitoring zone."""
        # Extract zone name from message
        name_match = re.search(
            r"(?:zone|area|region)\s+(?:called|named)?\s*['\"]?(\w[\w\s]{1,30})['\"]?",
            message,
        )
        zone_name = name_match.group(1).strip() if name_match else "Custom Zone"

        # Extract sensitivity if specified
        sens = 0.7
        if "high" in message:
            sens = 0.9
        elif "low" in message:
            sens = 0.4

        new_zone = self._create_zone(
            name=zone_name,
            description=f"User-defined monitoring zone: {zone_name}",
            sensitivity=sens,
            alert_on=["person", "vehicle"],
        )

        content = (
            f"## ✅ New Monitoring Zone Created\n\n"
            f"| Property | Value |\n"
            f"|----------|-------|\n"
            f"| Zone ID | `{new_zone['id']}` |\n"
            f"| Name | {new_zone['name']} |\n"
            f"| Description | {new_zone['description']} |\n"
            f"| Sensitivity | {new_zone['sensitivity']:.0%} |\n"
            f"| Alert On | {', '.join(new_zone['alert_on'])} |\n"
            f"| Status | ✅ Active |\n\n"
            "The zone is now active and will begin tracking detection events. "
            "Assign a camera to this zone for full coverage.\n\n"
            "> 💡 You can adjust sensitivity and alert rules per zone at any time."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.89,
            metadata={"intent": "add_zone", "zone_id": new_zone["id"]},
            actions=[{"type": "zone_created", "zone_id": new_zone["id"]}],
            suggestions=[
                "Show all zones",
                "Assign a camera to this zone",
                "Adjust zone sensitivity",
            ],
        )

    async def _handle_zone_heatmap(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests for zone activity heatmap."""
        location = self._extract_location_from_message(message)
        zone = self._get_zone(location) if location else None

        if zone:
            content = (
                f"## 📊 Activity Heatmap — {zone['name']}\n\n"
                f"Hourly activity distribution over the past 24 hours:\n\n"
                f"{self._generate_zone_heatmap_text(zone['id'])}\n\n"
            )
            # Find peak hours
            activity = self._zone_activity.get(zone["id"], {})
            if activity:
                sorted_hours = sorted(activity.items(), key=lambda x: x[1], reverse=True)
                peak = sorted_hours[:3]
                content += "\n### 🔝 Peak Activity Hours\n\n"
                for h, count in peak:
                    content += f"- **{int(h):02d}:00** — {count} events\n"

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.91,
                metadata={"intent": "zone_heatmap", "zone_id": zone["id"]},
                suggestions=[
                    f"Check {zone['name']} zone details",
                    "Show heatmap for all zones",
                    "View recent detections",
                ],
            )
        else:
            # Show all zones heatmap overview
            content = "## 📊 Activity Heatmaps — All Zones\n\n"
            for z in self.zones.values():
                activity = self._zone_activity.get(z["id"], {})
                total = sum(activity.values()) if activity else 0
                peak_hour = max(activity, key=activity.get) if activity else "N/A"
                content += (
                    f"### {z['name']} (`{z['id']}`)\n"
                    f"- Total Events: {total} | Peak Hour: {peak_hour}:00\n\n"
                    f"{self._generate_zone_heatmap_text(z['id'])}\n\n---\n\n"
                )

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.87,
                metadata={"intent": "zone_heatmap"},
                suggestions=[
                    "Show heatmap for front door",
                    "Check backyard zone",
                    "View recent alerts",
                ],
            )

    async def _handle_what_happened(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle queries about recent events and overnight activity."""
        now = datetime.utcnow()

        # Determine time window
        if "last night" in message or "overnight" in message:
            start = now.replace(hour=22, minute=0, second=0) - timedelta(days=1)
            end = now.replace(hour=7, minute=0, second=0)
            period = "Last Night (22:00 — 07:00)"
        elif "today" in message:
            start = now.replace(hour=0, minute=0, second=0)
            end = now
            period = "Today"
        elif "yesterday" in message:
            start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0)
            end = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59)
            period = "Yesterday"
        else:
            start = now - timedelta(hours=24)
            end = now
            period = "Last 24 Hours"

        # Filter detections in time window
        period_dets = []
        for det in self.detections:
            try:
                dt = datetime.fromisoformat(det["timestamp"])
                if start <= dt <= end:
                    period_dets.append(det)
            except (ValueError, TypeError):
                continue

        # Filter alerts in time window
        period_alerts = []
        for alert in self.alerts:
            try:
                dt = datetime.fromisoformat(alert["timestamp"])
                if start <= dt <= end:
                    period_alerts.append(alert)
            except (ValueError, TypeError):
                continue

        # Filter visitors in time window
        period_visitors = []
        for visitor in self.visitors:
            try:
                dt = datetime.fromisoformat(visitor["timestamp"])
                if start <= dt <= end:
                    period_visitors.append(visitor)
            except (ValueError, TypeError):
                continue

        content = (
            f"## 📋 Activity Summary — {period}\n\n"
            f"**Time Window:** {start.strftime('%Y-%m-%d %H:%M')} → {end.strftime('%Y-%m-%d %H:%M')} UTC\n\n"
            f"### Overview\n\n"
            f"| Metric | Count |\n"
            f"|--------|-------|\n"
            f"| Total Detections | {len(period_dets)} |\n"
            f"| Alerts Triggered | {len(period_alerts)} |\n"
            f"| Visitors | {len(period_visitors)} |\n\n"
        )

        # Detection breakdown
        if period_dets:
            obj_counts: Dict[str, int] = {}
            zone_counts: Dict[str, int] = {}
            for det in period_dets:
                obj_counts[det["object_type"]] = obj_counts.get(det["object_type"], 0) + 1
                zone_counts[det["zone_id"]] = zone_counts.get(det["zone_id"], 0) + 1

            content += "### 🔍 Detections by Object\n\n"
            for obj, count in sorted(obj_counts.items(), key=lambda x: x[1], reverse=True):
                label = DETECTABLE_OBJECTS.get(obj, obj)
                content += f"- {label}: **{count}**\n"

            content += "\n### 📍 Detections by Zone\n\n"
            for zone, count in sorted(zone_counts.items(), key=lambda x: x[1], reverse=True):
                zone_name = self.zones.get(zone, {}).get("name", zone)
                content += f"- {zone_name}: **{count}**\n"

        # Alerts
        if period_alerts:
            content += "\n### 🚨 Alerts\n\n"
            for alert in period_alerts:
                content += self._format_alert(alert) + "\n"

        # Visitors
        if period_visitors:
            content += "\n### 👥 Visitors\n\n"
            content += "| Time | Name | Status |\n"
            content += "|------|------|--------|\n"
            for v in period_visitors:
                status = "✅ Known" if v["known"] else "❓ Unknown"
                ts = v.get("timestamp", "N/A")
                try:
                    dt = datetime.fromisoformat(ts)
                    ts = dt.strftime("%H:%M")
                except (ValueError, TypeError):
                    pass
                content += f"| {ts} | {v['name']} | {status} |\n"

        if not period_dets and not period_alerts and not period_visitors:
            content += "\n✅ **All clear!** No significant activity during this period.\n"

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.92,
            metadata={
                "intent": "what_happened",
                "period": period,
                "detections": len(period_dets),
                "alerts": len(period_alerts),
                "visitors": len(period_visitors),
            },
            suggestions=[
                "Show me front door activity",
                "Check recent alerts",
                "Who visited today?",
            ],
        )

    async def _handle_recording_list(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to list recordings."""
        zone_filter = None
        for zone_id in self.zones:
            if zone_id.replace("_", " ") in message:
                zone_filter = zone_id
                break

        recordings = self._get_recordings(limit=10, zone_id=zone_filter)

        filter_label = f" — Zone: {zone_filter}" if zone_filter else ""
        total_size = sum(r.get("file_size_mb", 0) for r in self.recordings.values())

        content = (
            f"## 🎬 Recordings{filter_label}\n\n"
            f"**Total Recordings:** {len(self.recordings)} | "
            f"**Total Size:** {total_size:.1f} MB\n\n"
            "| Time | Camera | Trigger | Duration | Size | Status |\n"
            "|------|--------|---------|----------|------|--------|\n"
        )

        for rec in recordings:
            content += self._format_recording(rec) + "\n"

        if not recordings:
            content += "No recordings found.\n"

        content += (
            "\n> 💡 Recordings are triggered by motion events, alerts, "
            "manual capture, or scheduled intervals. Use *\"start recording\"* "
            "to capture immediately.\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={
                "intent": "recording_list",
                "total": len(self.recordings),
                "total_size_mb": round(total_size, 1),
            },
            suggestions=[
                "Start recording on front door",
                "Generate timelapse from recordings",
                "Delete old recordings",
            ],
        )

    async def _handle_start_recording(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to start a new recording."""
        location = self._extract_location_from_message(message)
        cam = self._get_camera_by_location(location) if location else None

        if not cam:
            # Use the first online camera
            online_cams = self._get_cameras_by_status("online")
            if online_cams:
                cam = online_cams[0]
            else:
                recording_cams = self._get_cameras_by_status("recording")
                if recording_cams:
                    cam = recording_cams[0]

        if cam:
            zone_id = cam.get("location", "unknown")
            rec = self._start_new_recording(
                camera_id=cam["camera_id"],
                zone_id=zone_id,
                trigger="manual",
            )
            cam["status"] = "recording"

            content = (
                f"## 🔴 Recording Started\n\n"
                f"| Property | Value |\n"
                f"|----------|-------|\n"
                f"| Recording ID | `{rec['recording_id']}` |\n"
                f"| Camera | {cam['name']} (`{cam['camera_id']}`) |\n"
                f"| Zone | {zone_id} |\n"
                f"| Trigger | Manual |\n"
                f"| File | `{rec['file_path']}` |\n"
                f"| Started At | {rec['timestamp']} |\n\n"
                "Recording is now in progress. Say *\"stop recording\"* to end capture.\n"
            )

            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.93,
                metadata={
                    "intent": "start_recording",
                    "recording_id": rec["recording_id"],
                    "camera_id": cam["camera_id"],
                },
                actions=[{"type": "recording_started", "recording_id": rec["recording_id"]}],
                suggestions=[
                    "Show camera status",
                    "Stop recording",
                    "View all recordings",
                ],
            )
        else:
            content = (
                "⚠️ No cameras are currently available for recording. "
                "All cameras may be offline. Check camera status and connectivity.\n"
            )
            return AgentResponse(
                content=content,
                agent_name=self.name,
                confidence=0.5,
                metadata={"intent": "start_recording"},
                suggestions=["Show camera status", "Add a new camera"],
            )

    async def _handle_timelapse(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle timelapse generation requests."""
        location = self._extract_location_from_message(message)
        zone_id = location if location else "front_door"
        zone_name = self.zones.get(zone_id, {}).get("name", zone_id)

        # Simulate timelapse generation
        now = datetime.utcnow()
        timelapse_id = f"tl-{uuid.uuid4().hex[:8]}"
        source_frames = random.randint(200, 2000)
        duration_seconds = source_frames // 30  # 30 fps timelapse
        file_size_mb = round(duration_seconds * 0.8 + random.uniform(1, 10), 1)

        content = (
            f"## ⏱️ Timelapse Generated\n\n"
            f"| Property | Value |\n"
            f"|----------|-------|\n"
            f"| Timelapse ID | `{timelapse_id}` |\n"
            f"| Zone | {zone_name} |\n"
            f"| Source Frames | {source_frames:,} |\n"
            f"| Output Duration | {duration_seconds}s @ 30 FPS |\n"
            f"| File Size | {file_size_mb} MB |\n"
            f"| Output Path | `/data/timelapses/{zone_id}_{now.strftime('%Y%m%d')}.mp4` |\n"
            f"| Created At | {now.strftime('%Y-%m-%d %H:%M UTC')} |\n\n"
            "The timelapse has been compiled from captured frames over the past 24 hours. "
            "You can export or share the file from the recordings manager.\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.88,
            metadata={
                "intent": "timelapse",
                "timelapse_id": timelapse_id,
                "zone_id": zone_id,
                "frames": source_frames,
            },
            suggestions=[
                "Generate timelapse for backyard",
                "View all recordings",
                "Show camera status",
            ],
        )

    async def _handle_model_info(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle vision model information requests."""
        # Check if a specific model is requested
        specific_model = None
        for key in self.models:
            if key.replace("-", " ") in message or self.models[key]["name"].lower() in message:
                specific_model = key
                break

        content = "## 🧠 Vision Model Information\n\n"

        if specific_model:
            content += self._get_model_summary(specific_model) + "\n\n"
        else:
            content += "### Available Models\n\n"
            content += (
                "| Model | Version | Size | Input | ESP32 FPS | Server FPS | mAP@50 | Quantised |\n"
                "|-------|---------|------|-------|-----------|------------|--------|----------|\n"
            )
            for key, m in self.models.items():
                active = " ⬅️" if key == self._inference_stats.get("active_model") else ""
                quant = "✅" if m["quantised"] else "❌"
                content += (
                    f"| {m['name']}{active} | v{m['version']} | {m['size_mb']} MB | "
                    f"{m['input_resolution']} | {m['fps_esp32']} | {m['fps_server']} | "
                    f"{m['accuracy_map50']:.1%} | {quant} |\n"
                )

        content += "\n### 📊 Inference Statistics\n\n"
        content += self._get_inference_stats_summary()

        content += (
            "\n\n> 💡 Quantised models (INT8) are optimised for ESP32 deployment. "
            "Server-side models run at higher accuracy for face recognition "
            "and detailed analysis.\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.91,
            metadata={
                "intent": "model_info",
                "active_model": self._inference_stats.get("active_model"),
                "total_models": len(self.models),
            },
            suggestions=[
                "Switch to EfficientDet model",
                "Show inference statistics",
                "View camera performance",
            ],
        )

    async def _handle_anomaly_report(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle anomaly detection and reporting."""
        anomalies = self._analyze_anomalies()

        critical_count = sum(1 for a in anomalies if a.get("severity") == "critical")
        warning_count = sum(1 for a in anomalies if a.get("severity") == "warning")

        if anomalies:
            threat_icon = "🔴" if critical_count > 0 else "🟡" if warning_count > 0 else "🟢"
        else:
            threat_icon = "🟢"

        content = (
            f"## 🔎 Anomaly Detection Report\n\n"
            f"**Status:** {threat_icon} {'Anomalies Detected' if anomalies else 'All Clear'}  \n"
            f"**Total Anomalies:** {len(anomalies)} | "
            f"🚨 Critical: {critical_count} | ⚠️ Warning: {warning_count}\n\n"
        )

        if anomalies:
            content += "### Detected Anomalies\n\n"
            for i, anomaly in enumerate(anomalies, 1):
                sev_icon = "🚨" if anomaly["severity"] == "critical" else "⚠️"
                content += (
                    f"#### {sev_icon} Anomaly #{i}: {anomaly['type'].replace('_', ' ').title()}\n\n"
                    f"- **Severity:** {anomaly['severity'].title()}\n"
                    f"- **Description:** {anomaly['description']}\n"
                    f"- **Zone:** {anomaly.get('zone_id', 'N/A')}\n"
                    f"- **Time:** {anomaly.get('timestamp', 'N/A')}\n\n"
                )

            content += "### Recommended Actions\n\n"
            if critical_count > 0:
                content += (
                    "1. 🚨 **Immediate:** Check offline cameras for tampering or power issues\n"
                    "2. 📹 Review captured frames for the critical anomalies above\n"
                    "3. 🔒 Consider enabling high sensitivity on all zones\n"
                    "4. 📱 Verify notification channels are active for real-time alerts\n"
                )
            else:
                content += (
                    "1. 📹 Review detection frames for flagged anomalies\n"
                    "2. ⚡ Consider adjusting sensitivity for affected zones\n"
                    "3. 👤 Add recurring unknown visitors to the known-persons database\n"
                )
        else:
            content += (
                "✅ No anomalies detected. All cameras are operating normally "
                "and no unusual activity patterns were identified.\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={
                "intent": "anomaly_report",
                "anomalies": len(anomalies),
                "critical": critical_count,
                "warning": warning_count,
            },
            suggestions=[
                "Show recent alerts",
                "Check camera status",
                "View overnight activity",
                "Increase motion sensitivity",
            ],
        )

    async def _handle_monitoring_toggle(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle requests to enable/disable monitoring."""
        if any(kw in message for kw in ["enable", "start", "resume", "on", "activate"]):
            self.monitoring_active = True
            action = "enabled"
        elif any(kw in message for kw in ["disable", "stop", "pause", "off", "deactivate"]):
            self.monitoring_active = False
            action = "disabled"
        else:
            # Toggle
            self.monitoring_active = not self.monitoring_active
            action = "enabled" if self.monitoring_active else "disabled"

        status_icon = "🟢 Active" if self.monitoring_active else "🔴 Paused"

        content = (
            f"## 📡 Monitoring {action.title()}\n\n"
            f"**Status:** {status_icon}\n\n"
        )

        if self.monitoring_active:
            online_count = len(self._get_cameras_by_status("online")) + len(self._get_cameras_by_status("recording"))
            active_zones = sum(1 for z in self.zones.values() if z.get("active"))
            content += (
                f"24/7 surveillance is now **active** across your home.\n\n"
                f"| Resource | Count |\n"
                f"|----------|-------|\n"
                f"| Online Cameras | {online_count} |\n"
                f"| Active Zones | {active_zones} |\n"
                f"| Motion Sensitivity | {self.motion_sensitivity:.0%} |\n"
                f"| Night Vision | {'🌙 On' if self.night_vision_enabled else '☀️ Off'} |\n"
                f"| Active Model | {self._inference_stats.get('active_model', 'N/A')} |\n\n"
                "All motion events, detections, and alerts will be processed "
                "and logged in real time.\n"
            )
        else:
            content += (
                "⚠️ Monitoring is **paused**. Cameras will continue streaming "
                "but no detection, alerting, or recording will occur.\n\n"
                "Say *\"enable monitoring\"* or *\"resume monitoring\"* to restart.\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.95,
            metadata={"intent": "monitoring_toggle", "monitoring_active": self.monitoring_active},
            suggestions=[
                "Show camera status",
                "Check recent alerts",
                "View monitoring zones",
            ],
        )

    async def _handle_configure_camera(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle camera configuration changes."""
        location = self._extract_location_from_message(message)
        cam = self._get_camera_by_location(location) if location else None

        if not cam:
            online = self._get_cameras_by_status("online")
            if online:
                cam = online[0]

        if not cam:
            return AgentResponse(
                content="⚠️ No camera found. Please specify a camera by name or location.",
                agent_name=self.name,
                confidence=0.4,
                metadata={"intent": "configure_camera"},
                requires_followup=True,
            )

        changes: List[str] = []

        # Check for resolution change
        for res in SUPPORTED_RESOLUTIONS:
            if res["label"].lower() in message:
                cam["resolution"] = res["label"]
                changes.append(f"Resolution → {res['label']} ({res['width']}x{res['height']})")
                break

        # Check for FPS change
        fps_match = re.search(r"(\d+)\s*fps", message)
        if fps_match:
            new_fps = int(fps_match.group(1))
            new_fps = max(1, min(30, new_fps))
            cam["fps"] = new_fps
            changes.append(f"FPS → {new_fps}")

        # Night vision toggle
        if "night vision on" in message or "enable night" in message:
            cam["night_vision"] = True
            changes.append("Night Vision → Enabled")
        elif "night vision off" in message or "disable night" in message:
            cam["night_vision"] = False
            changes.append("Night Vision → Disabled")

        if changes:
            content = (
                f"## ⚙️ Camera Configuration Updated\n\n"
                f"**Camera:** {cam['name']} (`{cam['camera_id']}`)\n\n"
                "### Changes Applied\n\n"
            )
            for change in changes:
                content += f"- ✅ {change}\n"

            content += (
                f"\n### Current Configuration\n\n"
                f"| Setting | Value |\n"
                f"|---------|-------|\n"
                f"| Resolution | {cam['resolution']} |\n"
                f"| FPS | {cam['fps']} |\n"
                f"| Night Vision | {'🌙 On' if cam.get('night_vision') else '☀️ Off'} |\n"
                f"| IR LEDs | {'✅' if cam.get('ir_enabled') else '❌'} |\n"
                f"| Firmware | {cam.get('firmware', 'N/A')} |\n"
            )
        else:
            content = (
                f"## ⚙️ Camera Configuration — {cam['name']}\n\n"
                f"| Setting | Value |\n"
                f"|---------|-------|\n"
                f"| Camera ID | `{cam['camera_id']}` |\n"
                f"| Resolution | {cam['resolution']} |\n"
                f"| FPS | {cam['fps']} |\n"
                f"| Night Vision | {'🌙 On' if cam.get('night_vision') else '☀️ Off'} |\n"
                f"| IR LEDs | {'✅' if cam.get('ir_enabled') else '❌'} |\n"
                f"| Firmware | {cam.get('firmware', 'N/A')} |\n\n"
                "### Available Resolutions\n\n"
            )
            for res in SUPPORTED_RESOLUTIONS:
                active = " ⬅️ Current" if res["label"] == cam["resolution"] else ""
                content += f"- **{res['label']}** ({res['width']}x{res['height']}){active}\n"
            content += (
                "\nTo change, say: *\"Set front door camera to SVGA 12 fps\"*\n"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={"intent": "configure_camera", "camera_id": cam["camera_id"], "changes": changes},
            suggestions=[
                "Show camera status",
                f"Set {cam['name']} to XGA resolution",
                f"Change FPS to 20 on {cam['name']}",
            ],
        )

    async def _handle_general_vision(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle general vision-related queries that don't match specific intents."""
        online_count = len(self._get_cameras_by_status("online")) + len(self._get_cameras_by_status("recording"))
        offline_count = len(self._get_cameras_by_status("offline"))
        total_dets = len(self.detections)
        total_alerts = len(self.alerts)
        unack_alerts = sum(1 for a in self.alerts if not a.get("acknowledged"))
        total_visitors = len(self.visitors)
        unknown_visitors = sum(1 for v in self.visitors if not v["known"])

        content = (
            "## 👁️ NEXUS Vision Agent — Dashboard\n\n"
            f"**Monitoring:** {'🟢 Active' if self.monitoring_active else '🔴 Paused'} | "
            f"**Night Vision:** {'🌙 On' if self.night_vision_enabled else '☀️ Off'} | "
            f"**Sensitivity:** {self.motion_sensitivity:.0%}\n\n"
            "### 📹 Camera Fleet\n\n"
            f"- 🟢 Online: **{online_count}** cameras\n"
            f"- 🔴 Offline: **{offline_count}** cameras\n\n"
            "### 📊 Activity Summary\n\n"
            f"| Metric | Value |\n"
            f"|--------|-------|\n"
            f"| Total Detections | {total_dets} |\n"
            f"| Total Alerts | {total_alerts} (🔔 {unack_alerts} unacknowledged) |\n"
            f"| Visitors Logged | {total_visitors} (❓ {unknown_visitors} unknown) |\n"
            f"| Recordings | {len(self.recordings)} |\n"
            f"| Frames Processed | {self._inference_stats['total_frames_processed']:,} |\n"
            f"| Active Model | {self._inference_stats.get('active_model', 'N/A')} |\n\n"
            "### 📍 Monitoring Zones\n\n"
        )

        for zone in self.zones.values():
            active_icon = "✅" if zone.get("active") else "⏸️"
            content += f"- {active_icon} **{zone['name']}** — Sensitivity: {zone.get('sensitivity', 0.7):.0%}\n"

        content += (
            "\n### 🤖 What can I help you with?\n\n"
            "- 📹 *\"Show me the front door\"* — View a specific camera\n"
            "- 👥 *\"Who visited today?\"* — Check visitor log\n"
            "- 🌙 *\"Enable night mode\"* — Toggle night vision\n"
            "- 📍 *\"Check backyard\"* — Zone status report\n"
            "- 🚨 *\"Show me recent alerts\"* — Alert history\n"
            "- 📍 *\"Add a new camera zone\"* — Create a zone\n"
            "- 🌃 *\"What happened last night?\"* — Overnight report\n"
            "- ⚡ *\"Detect motion sensitivity high\"* — Adjust sensitivity\n"
            "- 🎬 *\"Show recordings\"* — List captured clips\n"
            "- 🧠 *\"Model info\"* — Vision model details\n"
            "- 🔎 *\"Check for anomalies\"* — Anomaly report\n"
            "- 📡 *\"Pause monitoring\"* — Toggle surveillance\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={
                "intent": "general",
                "cameras_online": online_count,
                "total_detections": total_dets,
                "unacknowledged_alerts": unack_alerts,
            },
            suggestions=[
                "Show me the front door",
                "Who visited today?",
                "Show recent alerts",
                "Camera status",
            ],
        )

    # ------------------------------------------------------------------
    # Utility methods
    # ------------------------------------------------------------------

    def _extract_location_from_message(self, message: str) -> Optional[str]:
        """Extract a location/zone reference from a user message."""
        location_map = {
            "front door": "front_door",
            "front porch": "front_door",
            "main entrance": "front_door",
            "porch": "front_door",
            "backyard": "backyard",
            "back yard": "backyard",
            "rear garden": "backyard",
            "patio": "backyard",
            "garden": "backyard",
            "garage": "garage",
            "driveway": "driveway",
            "drive way": "driveway",
            "side yard": "side_yard",
            "side gate": "side_yard",
            "side passage": "side_yard",
        }

        message_lower = message.lower()
        for keyword, zone_id in location_map.items():
            if keyword in message_lower:
                return zone_id

        # Try matching camera names
        for cam in self.cameras.values():
            cam_name_lower = cam["name"].lower()
            # Check if any significant word from the camera name appears in the message
            name_words = [w for w in cam_name_lower.split() if len(w) > 3]
            for word in name_words:
                if word in message_lower:
                    return cam.get("location", cam["camera_id"])

        return None

    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        Return a structured summary suitable for a frontend dashboard.

        This method is called by the API layer to populate the vision
        monitoring panel with real-time data.
        """
        online = self._get_cameras_by_status("online")
        offline = self._get_cameras_by_status("offline")
        recording = self._get_cameras_by_status("recording")

        recent_5_detections = self.detections[:5]
        recent_5_alerts = self.alerts[:5]

        return {
            "monitoring_active": self.monitoring_active,
            "night_vision_enabled": self.night_vision_enabled,
            "motion_sensitivity": self.motion_sensitivity,
            "cameras": {
                "total": len(self.cameras),
                "online": len(online),
                "offline": len(offline),
                "recording": len(recording),
                "list": list(self.cameras.values()),
            },
            "zones": {
                "total": len(self.zones),
                "active": sum(1 for z in self.zones.values() if z.get("active")),
                "list": list(self.zones.values()),
            },
            "detections": {
                "total": len(self.detections),
                "recent": recent_5_detections,
            },
            "alerts": {
                "total": len(self.alerts),
                "unacknowledged": sum(1 for a in self.alerts if not a.get("acknowledged")),
                "recent": recent_5_alerts,
            },
            "visitors": {
                "total": len(self.visitors),
                "known": sum(1 for v in self.visitors if v["known"]),
                "unknown": sum(1 for v in self.visitors if not v["known"]),
            },
            "recordings": {
                "total": len(self.recordings),
                "total_size_mb": round(
                    sum(r.get("file_size_mb", 0) for r in self.recordings.values()), 1
                ),
            },
            "inference_stats": self._inference_stats,
        }
