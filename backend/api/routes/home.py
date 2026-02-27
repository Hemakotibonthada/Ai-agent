# NEXUS AI - Home Automation API Routes
"""
Endpoints for smart home device management, sensor data,
energy monitoring, room management, and scene automation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import HomeRepository
from api.dependencies import get_engine, get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class DeviceInfo(BaseModel):
    """Smart home device information."""
    id: str
    name: str
    device_type: str
    room: Optional[str] = None
    state: Dict[str, Any] = {}
    is_online: bool = False
    last_seen: Optional[str] = None
    firmware_version: Optional[str] = None
    mqtt_topic: Optional[str] = None
    esp32_id: Optional[str] = None


class DeviceControlRequest(BaseModel):
    """Request to control a smart home device."""
    action: str = Field(..., description="Action to perform: on, off, toggle, set, dim, color")
    parameters: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Action parameters (e.g., brightness, color, temperature)",
    )


class DeviceControlResponse(BaseModel):
    """Response after controlling a device."""
    device_id: str
    device_name: str
    action: str
    success: bool
    new_state: Dict[str, Any] = {}
    message: str
    timestamp: str


class SensorReadingOut(BaseModel):
    """A single sensor reading."""
    id: str
    device_id: str
    sensor_type: str
    value: float
    unit: str
    metadata: Dict[str, Any] = {}
    timestamp: str


class SensorDataResponse(BaseModel):
    """Response containing sensor readings."""
    device_id: Optional[str] = None
    sensor_type: Optional[str] = None
    readings: List[SensorReadingOut]
    total: int


class EnergyUsageResponse(BaseModel):
    """Energy usage summary."""
    total_watts: float = 0.0
    total_kwh: float = 0.0
    estimated_cost: float = 0.0
    readings: List[Dict[str, Any]] = []
    period_hours: int = 24
    timestamp: str


class RoomInfo(BaseModel):
    """Room with its devices."""
    name: str
    device_count: int = 0
    devices: List[DeviceInfo] = []


class SceneRequest(BaseModel):
    """Request to create or activate a home scene."""
    name: str = Field(..., min_length=1, max_length=100, description="Scene name")
    description: Optional[str] = Field(None, description="Scene description")
    actions: List[Dict[str, Any]] = Field(
        ...,
        description="List of device actions: [{device_id, action, parameters}]",
    )
    schedule: Optional[Dict[str, Any]] = Field(None, description="Optional schedule trigger")


class SceneResponse(BaseModel):
    """Response after creating/activating a scene."""
    scene_name: str
    success: bool
    devices_affected: int = 0
    results: List[Dict[str, Any]] = []
    message: str
    timestamp: str


class HomeDashboardResponse(BaseModel):
    """Aggregated home automation dashboard data."""
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0
    rooms: List[str] = []
    device_summary: Dict[str, int] = {}
    recent_readings: List[Dict[str, Any]] = []
    energy: Dict[str, Any] = {}
    alerts: List[Dict[str, Any]] = []
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/home", tags=["Home Automation"])


@router.get(
    "/devices",
    response_model=List[DeviceInfo],
    summary="List all smart home devices",
)
async def list_devices(
    room: Optional[str] = Query(None, description="Filter by room name"),
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    db: AsyncSession = Depends(get_db),
):
    """Get all registered smart home devices with optional filtering."""
    try:
        repo = HomeRepository(db)
        devices = await repo.get_all_devices(room=room, device_type=device_type)

        return [
            DeviceInfo(
                id=d.id,
                name=d.name,
                device_type=d.device_type,
                room=d.room,
                state=d.state or {},
                is_online=d.is_online,
                last_seen=d.last_seen.isoformat() if d.last_seen else None,
                firmware_version=d.firmware_version,
                mqtt_topic=d.mqtt_topic,
                esp32_id=d.esp32_id,
            )
            for d in devices
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching devices: {str(e)}",
        )


@router.post(
    "/devices/{device_id}/control",
    response_model=DeviceControlResponse,
    summary="Control a smart home device",
)
async def control_device(
    device_id: str,
    request: DeviceControlRequest,
    db: AsyncSession = Depends(get_db),
    engine=Depends(get_engine),
):
    """Send a control command to a smart home device."""
    try:
        repo = HomeRepository(db)
        device = await repo.get_device(device_id)

        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device '{device_id}' not found",
            )

        action = request.action.lower()
        new_state = dict(device.state or {})
        success = True
        message = ""

        if action == "on":
            new_state["power"] = True
            message = f"{device.name} turned on"
        elif action == "off":
            new_state["power"] = False
            message = f"{device.name} turned off"
        elif action == "toggle":
            new_state["power"] = not new_state.get("power", False)
            state_str = "on" if new_state["power"] else "off"
            message = f"{device.name} toggled {state_str}"
        elif action == "set":
            new_state.update(request.parameters or {})
            message = f"{device.name} settings updated"
        elif action == "dim":
            brightness = (request.parameters or {}).get("brightness", 50)
            new_state["brightness"] = max(0, min(100, int(brightness)))
            message = f"{device.name} brightness set to {new_state['brightness']}%"
        elif action == "color":
            color = (request.parameters or {}).get("color", "#FFFFFF")
            new_state["color"] = color
            message = f"{device.name} color set to {color}"
        else:
            new_state.update(request.parameters or {})
            message = f"Custom action '{action}' applied to {device.name}"

        # Persist the new state
        await repo.update_device_state(device_id, new_state)

        # Publish to MQTT via home agent if available
        home_agent = engine.get_agent("home")
        if home_agent and hasattr(home_agent, "publish_device_command"):
            try:
                await home_agent.publish_device_command(device_id, action, request.parameters or {})
            except Exception:
                pass  # MQTT publish is best-effort

        return DeviceControlResponse(
            device_id=device_id,
            device_name=device.name,
            action=action,
            success=success,
            new_state=new_state,
            message=message,
            timestamp=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error controlling device: {str(e)}",
        )


@router.get(
    "/sensors",
    response_model=SensorDataResponse,
    summary="Get sensor readings",
)
async def get_sensor_data(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    sensor_type: Optional[str] = Query(None, description="Filter by sensor type"),
    hours: int = Query(24, ge=1, le=720, description="Hours of data to retrieve"),
    limit: int = Query(100, ge=1, le=5000, description="Maximum readings"),
    db: AsyncSession = Depends(get_db),
):
    """Get sensor readings from smart home devices."""
    try:
        repo = HomeRepository(db)

        if device_id:
            readings = await repo.get_sensor_readings(
                device_id=device_id,
                sensor_type=sensor_type,
                hours=hours,
                limit=limit,
            )
        else:
            # Get all devices and fetch readings
            devices = await repo.get_all_devices()
            readings = []
            for d in devices:
                device_readings = await repo.get_sensor_readings(
                    device_id=d.id,
                    sensor_type=sensor_type,
                    hours=hours,
                    limit=limit // max(len(devices), 1),
                )
                readings.extend(device_readings)

        reading_list = [
            SensorReadingOut(
                id=r.id,
                device_id=r.device_id,
                sensor_type=r.sensor_type,
                value=r.value,
                unit=r.unit,
                metadata=r.metadata or {},
                timestamp=r.timestamp.isoformat() if r.timestamp else "",
            )
            for r in readings
        ]

        return SensorDataResponse(
            device_id=device_id,
            sensor_type=sensor_type,
            readings=reading_list,
            total=len(reading_list),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching sensor data: {str(e)}",
        )


@router.get(
    "/energy",
    response_model=EnergyUsageResponse,
    summary="Get energy usage data",
)
async def get_energy_usage(
    hours: int = Query(24, ge=1, le=720, description="Hours of data to retrieve"),
    db: AsyncSession = Depends(get_db),
):
    """Get energy consumption data across all devices."""
    try:
        repo = HomeRepository(db)
        usage_records = await repo.get_power_usage(hours=hours)

        total_watts = sum(u.watts for u in usage_records) if usage_records else 0.0
        total_kwh = sum(u.kilowatt_hours or 0 for u in usage_records) if usage_records else 0.0
        total_cost = sum(u.cost_estimate or 0 for u in usage_records) if usage_records else 0.0

        readings = [
            {
                "id": u.id,
                "device_id": u.device_id,
                "watts": u.watts,
                "kwh": u.kilowatt_hours,
                "cost": u.cost_estimate,
                "timestamp": u.timestamp.isoformat() if u.timestamp else "",
            }
            for u in usage_records
        ]

        return EnergyUsageResponse(
            total_watts=round(total_watts, 2),
            total_kwh=round(total_kwh, 4),
            estimated_cost=round(total_cost, 2),
            readings=readings,
            period_hours=hours,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching energy data: {str(e)}",
        )


@router.get(
    "/rooms",
    response_model=List[RoomInfo],
    summary="List rooms with devices",
)
async def list_rooms(db: AsyncSession = Depends(get_db)):
    """Get all rooms with their associated devices."""
    try:
        repo = HomeRepository(db)
        room_names = await repo.get_rooms()
        rooms: List[RoomInfo] = []

        for room_name in room_names:
            devices = await repo.get_all_devices(room=room_name)
            rooms.append(
                RoomInfo(
                    name=room_name,
                    device_count=len(devices),
                    devices=[
                        DeviceInfo(
                            id=d.id,
                            name=d.name,
                            device_type=d.device_type,
                            room=d.room,
                            state=d.state or {},
                            is_online=d.is_online,
                            last_seen=d.last_seen.isoformat() if d.last_seen else None,
                            firmware_version=d.firmware_version,
                            mqtt_topic=d.mqtt_topic,
                            esp32_id=d.esp32_id,
                        )
                        for d in devices
                    ],
                )
            )

        return rooms

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching rooms: {str(e)}",
        )


@router.post(
    "/scenes",
    response_model=SceneResponse,
    summary="Create and activate a home scene",
)
async def create_scene(
    request: SceneRequest,
    db: AsyncSession = Depends(get_db),
    engine=Depends(get_engine),
):
    """Create a scene that applies actions to multiple devices at once."""
    try:
        repo = HomeRepository(db)
        results: List[Dict[str, Any]] = []
        devices_affected = 0

        for action_def in request.actions:
            device_id = action_def.get("device_id")
            action = action_def.get("action", "set")
            params = action_def.get("parameters", {})

            if not device_id:
                results.append({"error": "Missing device_id in action"})
                continue

            device = await repo.get_device(device_id)
            if not device:
                results.append({
                    "device_id": device_id,
                    "success": False,
                    "error": "Device not found",
                })
                continue

            # Apply the state change
            new_state = dict(device.state or {})
            if action == "on":
                new_state["power"] = True
            elif action == "off":
                new_state["power"] = False
            else:
                new_state.update(params)

            await repo.update_device_state(device_id, new_state)
            devices_affected += 1
            results.append({
                "device_id": device_id,
                "device_name": device.name,
                "success": True,
                "action": action,
                "new_state": new_state,
            })

        return SceneResponse(
            scene_name=request.name,
            success=devices_affected > 0,
            devices_affected=devices_affected,
            results=results,
            message=f"Scene '{request.name}' applied to {devices_affected} device(s)",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error applying scene: {str(e)}",
        )


@router.get(
    "/dashboard",
    response_model=HomeDashboardResponse,
    summary="Get home automation dashboard data",
)
async def home_dashboard(
    db: AsyncSession = Depends(get_db),
):
    """Get an aggregated dashboard view of the smart home."""
    try:
        repo = HomeRepository(db)

        # Devices
        all_devices = await repo.get_all_devices()
        online = [d for d in all_devices if d.is_online]
        offline = [d for d in all_devices if not d.is_online]

        # Device type counts
        type_counts: Dict[str, int] = {}
        for d in all_devices:
            type_counts[d.device_type] = type_counts.get(d.device_type, 0) + 1

        # Rooms
        rooms = await repo.get_rooms()

        # Recent sensor readings (last 1 hour, limited)
        recent_readings: List[Dict[str, Any]] = []
        for device in all_devices[:10]:
            readings = await repo.get_sensor_readings(device.id, hours=1, limit=5)
            for r in readings:
                recent_readings.append({
                    "device_id": r.device_id,
                    "sensor_type": r.sensor_type,
                    "value": r.value,
                    "unit": r.unit,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else "",
                })

        # Energy
        power_records = await repo.get_power_usage(hours=24)
        energy = {
            "total_watts": round(sum(u.watts for u in power_records), 2) if power_records else 0.0,
            "total_kwh": round(sum(u.kilowatt_hours or 0 for u in power_records), 4) if power_records else 0.0,
            "estimated_daily_cost": round(sum(u.cost_estimate or 0 for u in power_records), 2) if power_records else 0.0,
        }

        # Alerts (offline devices, high readings, etc.)
        alerts: List[Dict[str, Any]] = []
        for d in offline:
            alerts.append({
                "type": "device_offline",
                "severity": "warning",
                "message": f"{d.name} is offline",
                "device_id": d.id,
            })

        return HomeDashboardResponse(
            total_devices=len(all_devices),
            online_devices=len(online),
            offline_devices=len(offline),
            rooms=rooms,
            device_summary=type_counts,
            recent_readings=recent_readings[:20],
            energy=energy,
            alerts=alerts,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building home dashboard: {str(e)}",
        )
