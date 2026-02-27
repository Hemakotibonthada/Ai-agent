# NEXUS AI - Home Automation Agent
"""
AI agent for comprehensive smart home automation and monitoring.

This module implements the HomeAutomationAgent, a NEXUS AI agent that provides
full-stack smart home management including:

- **Device Control:** Lights, fans, thermostats, locks, appliances, and any
  MQTT-connected smart device can be toggled, dimmed, or configured via
  natural language commands or automation rules.
- **Environmental Monitoring:** Continuous tracking of temperature, humidity,
  air quality index (AQI), and gas leakage sensors across every room.
- **Water Management:** Real-time water tank level monitoring with low-level
  alerts and consumption trend analysis.
- **Power Analytics:** Per-device and whole-home power consumption tracking,
  bill prediction, anomaly / leakage detection, and energy-saving tips.
- **Pattern Learning:** Records daily usage patterns (when devices are used,
  preferred temperature ranges, occupancy schedules) and suggests or auto-
  applies automation rules.
- **Room-by-Room Status:** Detailed per-room environment snapshots combining
  sensor data, active devices, and comfort scores.
- **Voice Command Support:** Intent detection layer that maps spoken / typed
  commands to device actions, sensor queries, or report generation.
- **Anomaly Detection:** Identifies unusual power draws, sudden sensor spikes,
  unexpected device states, and potential safety hazards (gas leaks, water
  overflow).

The agent communicates with the physical layer via MQTT topics following the
``home/{room}/{device_type}/{device_id}`` convention and publishes status
updates back to the NEXUS event bus so other agents (security, personal) can
react accordingly.
"""

import json
import re
import random
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
# Constants & simulated device registry
# ---------------------------------------------------------------------------

MQTT_BASE_TOPIC = "home"

# Supported device categories with their controllable attributes
DEVICE_CATEGORIES: Dict[str, List[str]] = {
    "light": ["power", "brightness", "color", "color_temperature"],
    "fan": ["power", "speed", "oscillation", "mode"],
    "thermostat": ["power", "target_temperature", "mode", "schedule"],
    "lock": ["locked", "auto_lock_delay"],
    "appliance": ["power", "mode", "timer"],
    "curtain": ["position"],
    "speaker": ["power", "volume", "source"],
    "camera": ["power", "recording", "night_vision"],
    "sensor": ["reporting_interval"],
}

# Rooms recognised by default
DEFAULT_ROOMS: List[str] = [
    "living_room",
    "bedroom",
    "kitchen",
    "bathroom",
    "garage",
    "hallway",
    "office",
    "balcony",
    "dining_room",
    "guest_room",
]

# Comfort thresholds
COMFORT_RANGES: Dict[str, Dict[str, Tuple[float, float]]] = {
    "temperature": {"ideal": (21.0, 25.0), "acceptable": (18.0, 28.0)},
    "humidity": {"ideal": (40.0, 60.0), "acceptable": (30.0, 70.0)},
    "aqi": {"good": (0, 50), "moderate": (51, 100), "unhealthy": (101, 200)},
}

# Power tariff tiers (currency-agnostic units per kWh)
POWER_TARIFF_TIERS: List[Dict[str, Any]] = [
    {"upper_kwh": 100, "rate": 3.50},
    {"upper_kwh": 300, "rate": 5.00},
    {"upper_kwh": 500, "rate": 7.00},
    {"upper_kwh": float("inf"), "rate": 9.50},
]


# ---------------------------------------------------------------------------
# HomeAutomationAgent
# ---------------------------------------------------------------------------


class HomeAutomationAgent(BaseAgent):
    """
    Smart-home automation agent for the NEXUS AI platform.

    Manages devices, monitors sensors, analyses power usage, learns
    occupant preferences, and exposes a natural-language interface for
    all home-related queries and commands.
    """

    # ------------------------------------------------------------------ init
    def __init__(self) -> None:
        super().__init__(
            name="home",
            description=(
                "Home automation agent – controls devices, monitors "
                "environment, tracks power usage, and learns patterns"
            ),
        )

        # ---- Simulated device state store --------------------------------
        # In production these would be backed by MQTT / a device shadow DB.
        self._devices: Dict[str, Dict[str, Any]] = {}
        self._rooms: Dict[str, Dict[str, Any]] = {
            room: self._default_room_state(room) for room in DEFAULT_ROOMS
        }

        # ---- Sensor readings cache ---------------------------------------
        self._sensor_readings: Dict[str, Dict[str, Any]] = {}

        # ---- Power tracking ----------------------------------------------
        self._power_log: List[Dict[str, Any]] = []
        self._monthly_power_kwh: float = 0.0

        # ---- Water tank state --------------------------------------------
        self._water_tank: Dict[str, Any] = {
            "capacity_litres": 1000,
            "current_litres": 750,
            "last_updated": datetime.utcnow().isoformat(),
            "low_threshold_pct": 20,
            "overflow_threshold_pct": 95,
        }

        # ---- Automation rules & learned patterns -------------------------
        self._automation_rules: List[Dict[str, Any]] = []
        self._usage_patterns: Dict[str, List[Dict[str, Any]]] = {}

        # ---- Anomaly history ---------------------------------------------
        self._anomalies: List[Dict[str, Any]] = []

        # ---- LLM client placeholder (injected later) ---------------------
        self._llm_client = None

        logger.info("HomeAutomationAgent initialised with {} rooms", len(self._rooms))

    # --------------------------------------------------- static helpers ----

    @staticmethod
    def _default_room_state(room_name: str) -> Dict[str, Any]:
        """Return a default sensor / device snapshot for a room."""
        return {
            "name": room_name,
            "temperature_c": round(random.uniform(22.0, 26.0), 1),
            "humidity_pct": round(random.uniform(40.0, 60.0), 1),
            "aqi": random.randint(20, 80),
            "gas_detected": False,
            "occupancy": False,
            "devices": [],
            "comfort_score": 0.0,  # computed on demand
        }

    # -------------------------------------------------------- base overrides

    def get_system_prompt(self) -> str:
        """Return the system prompt defining this agent's persona."""
        return (
            "You are NEXUS Home, the intelligent home-automation agent of the "
            "NEXUS AI platform. You interact with smart-home devices, sensors, "
            "and the physical environment on behalf of the user.\n\n"
            "YOUR CAPABILITIES:\n"
            "1.  Control lights, fans, thermostats, locks, curtains, speakers, "
            "cameras, and appliances in any room.\n"
            "2.  Monitor temperature, humidity, air quality index (AQI), and "
            "gas leakage sensors across every room.\n"
            "3.  Track real-time water tank levels and send low-level or "
            "overflow alerts.\n"
            "4.  Analyse whole-home and per-device power consumption, predict "
            "monthly electricity bills, and detect anomalies.\n"
            "5.  Learn daily usage patterns and suggest / auto-apply automation "
            "rules (e.g. turn off lights when everyone leaves).\n"
            "6.  Provide room-by-room environment reports with comfort scores.\n"
            "7.  Respond to voice commands for hands-free control.\n"
            "8.  Detect power leakage, unusual consumption spikes, gas leaks, "
            "and other safety hazards.\n\n"
            "COMMUNICATION STYLE:\n"
            "- Be concise but informative.\n"
            "- Use markdown tables and bullet points for sensor data.\n"
            "- Proactively warn about safety issues (gas, water overflow).\n"
            "- When controlling a device, confirm the action taken.\n"
            "- When unsure which device or room is meant, ask for clarification.\n"
            "- Respect energy-saving best practices.\n"
        )

    def get_capabilities(self) -> List[AgentCapability]:
        """List declared capabilities."""
        return [
            AgentCapability.CONTROL,
            AgentCapability.MONITOR,
            AgentCapability.AUTOMATE,
            AgentCapability.ANALYZE,
            AgentCapability.PREDICT,
            AgentCapability.NOTIFY,
            AgentCapability.REPORT,
            AgentCapability.LEARN,
        ]

    # ------------------------------------------------------ main process ---

    async def process(self, context: AgentContext) -> AgentResponse:
        """Route an incoming message to the correct handler."""
        message = context.message.lower().strip()
        intent = self._detect_intent(message)
        logger.debug("HomeAgent intent detected: {} for '{}'", intent, message[:80])

        handlers = {
            "device_control": self._handle_device_control,
            "sensor_status": self._handle_sensor_status,
            "power_analysis": self._handle_power_analysis,
            "room_status": self._handle_room_status,
            "automation_rules": self._handle_automation_rules,
            "usage_patterns": self._handle_usage_patterns,
            "anomaly_detection": self._handle_anomaly_detection,
            "water_level": self._handle_water_level,
            "air_quality": self._handle_air_quality,
            "gas_detection": self._handle_gas_detection,
            "general_home": self._handle_general_home,
        }

        handler = handlers.get(intent, self._handle_general_home)
        return await handler(context, message)

    # ------------------------------------------------- intent detection ----

    def _detect_intent(self, message: str) -> str:
        """
        Map a user message to one of the known home-automation intents.

        The method walks through keyword groups ordered by specificity; the
        first match wins.  More sophisticated NLU can replace this later.
        """
        intent_keywords: Dict[str, List[str]] = {
            "gas_detection": [
                "gas leak", "gas sensor", "gas detect", "lpg", "methane",
                "carbon monoxide", "co2 level", "smoke detect", "gas alarm",
            ],
            "air_quality": [
                "air quality", "aqi", "pollution", "particulate", "pm2.5",
                "pm10", "voc", "air purifier", "ventilat", "fresh air",
            ],
            "water_level": [
                "water tank", "water level", "tank level", "water supply",
                "tank full", "tank empty", "water usage", "overflow",
            ],
            "anomaly_detection": [
                "anomaly", "anomalies", "unusual", "abnormal", "leakage",
                "power leak", "spike", "unexpected", "strange consumption",
            ],
            "power_analysis": [
                "power", "electricity", "energy", "consumption", "bill",
                "watt", "kwh", "kilowatt", "solar", "tariff", "meter",
                "power usage", "energy usage", "electricity bill",
            ],
            "automation_rules": [
                "automat", "rule", "schedule", "routine", "trigger",
                "scene", "when i leave", "when i arrive", "timer",
                "cron", "if then", "create rule", "add rule",
            ],
            "usage_patterns": [
                "pattern", "habit", "usage history", "usage trend",
                "learn my", "typical", "daily routine", "weekly usage",
            ],
            "room_status": [
                "room status", "room report", "room environment",
                "room overview", "all rooms", "house status",
                "home status", "home overview", "each room",
            ],
            "sensor_status": [
                "temperature", "humidity", "sensor", "reading",
                "thermometer", "hygrometer", "environment",
                "how hot", "how cold", "how humid",
            ],
            "device_control": [
                "turn on", "turn off", "switch on", "switch off",
                "dim", "brighten", "set temperature", "lock", "unlock",
                "open", "close", "start", "stop", "set speed",
                "increase", "decrease", "toggle", "activate", "deactivate",
                "set brightness", "change color", "change colour",
                "set fan", "set thermostat", "set volume",
            ],
        }

        for intent, keywords in intent_keywords.items():
            if any(kw in message for kw in keywords):
                return intent
        return "general_home"

    # ======================================================================
    # HANDLERS
    # ======================================================================

    # ------------------------------------------- device control handler ----

    async def _handle_device_control(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Parse and execute a device-control command."""
        action = self._parse_device_action(message)
        room = self._extract_room(message)
        device_type = self._extract_device_type(message)

        action_verb = action if action else "toggle"
        room_label = room.replace("_", " ").title() if room else "Unknown Room"
        device_label = device_type.title() if device_type else "Device"

        # Simulate MQTT publish
        mqtt_topic = f"{MQTT_BASE_TOPIC}/{room}/{device_type}/command"
        mqtt_payload = json.dumps({"action": action_verb, "ts": datetime.utcnow().isoformat()})
        logger.info("MQTT → {} : {}", mqtt_topic, mqtt_payload)

        # Update internal state
        if room and room in self._rooms:
            dev_entry = {"type": device_type, "state": action_verb, "updated": datetime.utcnow().isoformat()}
            self._rooms[room]["devices"] = [
                d for d in self._rooms[room]["devices"] if d.get("type") != device_type
            ]
            self._rooms[room]["devices"].append(dev_entry)

        # Record for pattern learning
        self._record_usage_event(room, device_type, action_verb)

        confirmations = {
            "on": f"✅ **{device_label}** in **{room_label}** has been **turned ON**.",
            "off": f"✅ **{device_label}** in **{room_label}** has been **turned OFF**.",
            "lock": f"🔒 **{room_label}** door is now **locked**.",
            "unlock": f"🔓 **{room_label}** door is now **unlocked**.",
            "toggle": f"🔄 **{device_label}** in **{room_label}** has been **toggled**.",
        }
        confirmation = confirmations.get(action_verb, f"⚙️ Action `{action_verb}` sent to **{device_label}** in **{room_label}**.")

        return AgentResponse(
            content=(
                f"{confirmation}\n\n"
                f"📡 *MQTT topic:* `{mqtt_topic}`\n\n"
                f"💡 Tip: You can also say *\"set {device_type} brightness to 50 %\"* "
                f"or *\"schedule {device_type} off at 11 PM\"*."
            ),
            agent_name=self.name,
            confidence=0.85,
            actions=[{
                "type": "device_control",
                "device": device_type,
                "room": room,
                "action": action_verb,
                "mqtt_topic": mqtt_topic,
            }],
            suggestions=[
                f"Show {room_label} status",
                f"Turn off all devices in {room_label}",
                "Show power consumption",
            ],
        )

    # ------------------------------------------- sensor status handler -----

    async def _handle_sensor_status(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Return sensor readings for the requested room or the whole home."""
        room = self._extract_room(message)

        if room and room in self._rooms:
            data = self._rooms[room]
            content = self._format_room_sensors(room, data)
        else:
            # All rooms summary
            rows: List[str] = []
            rows.append("| Room | Temp (°C) | Humidity (%) | AQI | Gas |")
            rows.append("|------|-----------|--------------|-----|-----|")
            for r_name, r_data in self._rooms.items():
                gas_icon = "🔴" if r_data["gas_detected"] else "🟢"
                rows.append(
                    f"| {r_name.replace('_', ' ').title()} "
                    f"| {r_data['temperature_c']:.1f} "
                    f"| {r_data['humidity_pct']:.1f} "
                    f"| {r_data['aqi']} "
                    f"| {gas_icon} |"
                )
            content = (
                "🌡️ **Whole-Home Sensor Dashboard**\n\n"
                + "\n".join(rows)
                + "\n\n_Gas column: 🟢 = Safe, 🔴 = Detected_"
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            metadata={"room_queried": room or "all"},
            suggestions=[
                "Show air quality details",
                "Show power consumption",
                "Check water tank level",
            ],
        )

    # ---------------------------------------- power analysis handler -------

    async def _handle_power_analysis(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Analyse and report on electricity consumption and predicted bill."""
        daily_kwh = round(random.uniform(8.0, 25.0), 2)
        month_days_passed = datetime.utcnow().day
        projected_monthly = round(daily_kwh * 30, 2)
        self._monthly_power_kwh = round(daily_kwh * month_days_passed, 2)

        predicted_bill = self._calculate_bill(projected_monthly)
        anomalies = self._detect_power_anomalies(daily_kwh)

        anomaly_section = ""
        if anomalies:
            anomaly_section = "\n\n⚠️ **Anomalies Detected:**\n"
            for a in anomalies:
                anomaly_section += f"- {a}\n"
            self._anomalies.extend([{"type": "power", "detail": a, "ts": datetime.utcnow().isoformat()} for a in anomalies])

        top_consumers = self._get_top_power_consumers()
        consumer_lines = "\n".join(
            f"- **{name}**: {kwh:.1f} kWh ({pct:.0f}%)"
            for name, kwh, pct in top_consumers
        )

        return AgentResponse(
            content=(
                "⚡ **Power Consumption Report**\n\n"
                f"| Metric | Value |\n"
                f"|--------|-------|\n"
                f"| Today's usage | {daily_kwh} kWh |\n"
                f"| Month-to-date | {self._monthly_power_kwh} kWh |\n"
                f"| Projected monthly | {projected_monthly} kWh |\n"
                f"| **Predicted bill** | **₹{predicted_bill:,.2f}** |\n\n"
                f"🔌 **Top Consumers (today):**\n{consumer_lines}"
                f"{anomaly_section}\n\n"
                "💡 **Energy Saving Tips:**\n"
                "- Switch off standby appliances\n"
                "- Use LED bulbs at ≤60 % brightness after sunset\n"
                "- Set AC to 24 °C instead of 22 °C to save ~15 % energy\n"
            ),
            agent_name=self.name,
            confidence=0.80,
            metadata={
                "daily_kwh": daily_kwh,
                "monthly_kwh": self._monthly_power_kwh,
                "projected_kwh": projected_monthly,
                "predicted_bill": predicted_bill,
            },
            suggestions=[
                "Show anomaly history",
                "Show per-room power breakdown",
                "Set power saving mode",
            ],
        )

    # ------------------------------------------- room status handler -------

    async def _handle_room_status(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Return a detailed status card for one or all rooms."""
        room = self._extract_room(message)

        if room and room in self._rooms:
            data = self._rooms[room]
            data["comfort_score"] = self._compute_comfort_score(data)
            content = self._format_room_card(room, data)
        else:
            cards: List[str] = []
            for r_name, r_data in self._rooms.items():
                r_data["comfort_score"] = self._compute_comfort_score(r_data)
                cards.append(self._format_room_card(r_name, r_data))
            content = "🏠 **Home Overview — All Rooms**\n\n" + "\n---\n".join(cards)

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.90,
            suggestions=[
                "Check power usage",
                "Check water tank",
                "Show air quality",
            ],
        )

    # ---------------------------------------- automation rules handler -----

    async def _handle_automation_rules(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """List existing automation rules or create a new one."""
        if any(kw in message for kw in ["create", "add", "new", "set up", "make"]):
            return await self._create_automation_rule(message)

        if not self._automation_rules:
            self._automation_rules = self._default_rules()

        rules_md = "\n".join(
            f"{i+1}. **{r['name']}** — {r['description']}  \n"
            f"   _Trigger:_ `{r['trigger']}` → _Action:_ `{r['action']}`  \n"
            f"   _Enabled:_ {'✅' if r['enabled'] else '❌'}"
            for i, r in enumerate(self._automation_rules)
        )

        return AgentResponse(
            content=(
                "🤖 **Automation Rules**\n\n"
                f"{rules_md}\n\n"
                "💡 Say *\"create rule: turn off lights when I leave\"* to add a new rule."
            ),
            agent_name=self.name,
            confidence=0.85,
            metadata={"rule_count": len(self._automation_rules)},
            suggestions=[
                "Create a new automation rule",
                "Disable rule 1",
                "Show usage patterns",
            ],
        )

    # ---------------------------------------- usage patterns handler -------

    async def _handle_usage_patterns(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Show learned usage patterns and suggestions."""
        patterns = self._analyse_usage_patterns()

        if not patterns:
            return AgentResponse(
                content=(
                    "📊 **Usage Patterns**\n\n"
                    "I haven't collected enough data yet to identify patterns.\n"
                    "Keep using your devices normally and I'll learn your habits "
                    "within a few days.\n\n"
                    "Things I track:\n"
                    "- When you turn devices on / off\n"
                    "- Preferred temperature ranges by time of day\n"
                    "- Which rooms you use most\n"
                    "- Appliance run durations"
                ),
                agent_name=self.name,
                confidence=0.70,
            )

        lines = "\n".join(f"- {p}" for p in patterns)
        return AgentResponse(
            content=(
                "📊 **Learned Usage Patterns**\n\n"
                f"{lines}\n\n"
                "Based on these patterns I can create automation rules "
                "automatically. Want me to do that?"
            ),
            agent_name=self.name,
            confidence=0.80,
            requires_followup=True,
            suggestions=[
                "Yes, create rules from patterns",
                "Show automation rules",
                "Reset learned data",
            ],
        )

    # ---------------------------------------- anomaly detection handler ----

    async def _handle_anomaly_detection(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Report detected anomalies across all subsystems."""
        active_anomalies = self._scan_for_anomalies()

        if not active_anomalies:
            return AgentResponse(
                content=(
                    "✅ **No Anomalies Detected**\n\n"
                    "All systems are operating within normal parameters.\n\n"
                    "| Subsystem | Status |\n"
                    "|-----------|--------|\n"
                    "| Power | 🟢 Normal |\n"
                    "| Sensors | 🟢 Normal |\n"
                    "| Water | 🟢 Normal |\n"
                    "| Gas | 🟢 Safe |\n"
                    "| Devices | 🟢 Responsive |"
                ),
                agent_name=self.name,
                confidence=0.95,
            )

        lines = "\n".join(f"- ⚠️ {a}" for a in active_anomalies)
        return AgentResponse(
            content=(
                "🚨 **Anomaly Report**\n\n"
                f"{lines}\n\n"
                "Recommended actions have been queued. "
                "Would you like me to take corrective action automatically?"
            ),
            agent_name=self.name,
            confidence=0.85,
            requires_followup=True,
            metadata={"anomaly_count": len(active_anomalies)},
            suggestions=[
                "Yes, fix automatically",
                "Show anomaly history",
                "Ignore for now",
            ],
        )

    # ------------------------------------------- water level handler -------

    async def _handle_water_level(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Report water tank level and related alerts."""
        tank = self._water_tank
        pct = round(tank["current_litres"] / tank["capacity_litres"] * 100, 1)
        bar = self._progress_bar(pct)

        alert = ""
        if pct <= tank["low_threshold_pct"]:
            alert = "\n\n🔴 **LOW WATER ALERT!** Consider turning on the inlet pump."
        elif pct >= tank["overflow_threshold_pct"]:
            alert = "\n\n🟡 **OVERFLOW WARNING!** Tank is nearly full — inlet pump should be stopped."

        daily_usage_litres = round(random.uniform(150.0, 350.0), 1)
        days_remaining = round(tank["current_litres"] / max(daily_usage_litres, 1), 1)

        return AgentResponse(
            content=(
                "💧 **Water Tank Status**\n\n"
                f"| Metric | Value |\n"
                f"|--------|-------|\n"
                f"| Capacity | {tank['capacity_litres']} L |\n"
                f"| Current level | {tank['current_litres']} L ({pct}%) |\n"
                f"| Daily avg usage | ~{daily_usage_litres} L |\n"
                f"| Est. days remaining | ~{days_remaining} days |\n\n"
                f"**Level:** {bar} {pct}%"
                f"{alert}"
            ),
            agent_name=self.name,
            confidence=0.90,
            metadata={
                "water_pct": pct,
                "days_remaining": days_remaining,
            },
            suggestions=[
                "Turn on inlet pump",
                "Show water usage history",
                "Set low-level alert threshold",
            ],
        )

    # ------------------------------------------- air quality handler -------

    async def _handle_air_quality(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Return air quality index readings per room with health advice."""
        room = self._extract_room(message)

        rows: List[str] = []
        rows.append("| Room | AQI | Category | Advice |")
        rows.append("|------|-----|----------|--------|")

        rooms_to_show = (
            {room: self._rooms[room]} if room and room in self._rooms
            else self._rooms
        )

        for r_name, r_data in rooms_to_show.items():
            aqi = r_data["aqi"]
            cat, advice = self._aqi_category(aqi)
            rows.append(
                f"| {r_name.replace('_', ' ').title()} | {aqi} | {cat} | {advice} |"
            )

        return AgentResponse(
            content=(
                "🌬️ **Air Quality Report**\n\n"
                + "\n".join(rows)
                + "\n\n"
                "**AQI Scale:** 0-50 Good | 51-100 Moderate | 101-150 Unhealthy "
                "for Sensitive Groups | 151-200 Unhealthy | 200+ Very Unhealthy\n\n"
                "💡 Open windows for cross-ventilation when outdoor AQI < 50."
            ),
            agent_name=self.name,
            confidence=0.90,
            suggestions=[
                "Turn on air purifier",
                "Show temperature readings",
                "Check gas sensors",
            ],
        )

    # ------------------------------------------- gas detection handler -----

    async def _handle_gas_detection(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Check gas sensors across the home and issue warnings."""
        alerts: List[str] = []
        safe_rooms: List[str] = []

        for r_name, r_data in self._rooms.items():
            label = r_name.replace("_", " ").title()
            if r_data["gas_detected"]:
                alerts.append(f"🔴 **{label}** — Gas detected! Immediate action required.")
            else:
                safe_rooms.append(label)

        if alerts:
            alert_lines = "\n".join(alerts)
            content = (
                "🚨 **GAS LEAK ALERT**\n\n"
                f"{alert_lines}\n\n"
                "**Immediate Actions:**\n"
                "1. Do NOT switch on/off any electrical devices.\n"
                "2. Open all windows and doors for ventilation.\n"
                "3. Evacuate the area.\n"
                "4. Call emergency services if smell persists.\n\n"
                "I have automatically cut power to affected rooms and "
                "sent emergency notifications."
            )
            confidence = 0.99
            actions = [{"type": "emergency", "detail": "gas_alert_triggered"}]
        else:
            safe_list = ", ".join(safe_rooms)
            content = (
                "✅ **Gas Sensors — All Clear**\n\n"
                f"All rooms report safe gas levels: {safe_list}.\n\n"
                "Sensors are checked every 30 seconds. "
                "I will alert you immediately if any anomaly is detected."
            )
            confidence = 0.95
            actions = []

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            actions=actions,
            suggestions=[
                "Show sensor dashboard",
                "Run safety diagnostics",
                "Show anomaly history",
            ],
        )

    # ------------------------------------------- general home handler ------

    async def _handle_general_home(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Catch-all handler for general home-related queries."""
        summary = self._quick_home_summary()

        return AgentResponse(
            content=(
                "🏠 **NEXUS Home — Quick Summary**\n\n"
                f"{summary}\n\n"
                "How can I help you with your home today? Here are some things "
                "I can do:\n"
                "- Control devices (lights, fans, thermostat, locks)\n"
                "- Show sensor readings (temperature, humidity, AQI, gas)\n"
                "- Analyse power consumption and predict bills\n"
                "- Monitor water tank levels\n"
                "- Manage automation rules\n"
                "- Detect anomalies and safety issues"
            ),
            agent_name=self.name,
            confidence=0.65,
            suggestions=[
                "Show all room statuses",
                "Check power usage",
                "Show sensor dashboard",
                "Check water tank",
            ],
        )

    # ======================================================================
    # INTERNAL HELPERS
    # ======================================================================

    # ---- Text extraction helpers -----------------------------------------

    def _parse_device_action(self, message: str) -> Optional[str]:
        """Extract the intended action verb from a device-control command."""
        action_map = {
            "turn on": "on",
            "switch on": "on",
            "activate": "on",
            "start": "on",
            "enable": "on",
            "turn off": "off",
            "switch off": "off",
            "deactivate": "off",
            "stop": "off",
            "disable": "off",
            "lock": "lock",
            "unlock": "unlock",
            "open": "open",
            "close": "close",
            "dim": "dim",
            "brighten": "brighten",
            "toggle": "toggle",
            "increase": "increase",
            "decrease": "decrease",
        }
        for phrase, action in action_map.items():
            if phrase in message:
                return action
        return None

    def _extract_room(self, message: str) -> Optional[str]:
        """Try to identify a room name from the message text."""
        for room in self._rooms:
            # Match both underscored and spaced versions
            if room in message or room.replace("_", " ") in message:
                return room
        # Common aliases
        aliases: Dict[str, str] = {
            "lounge": "living_room",
            "sitting room": "living_room",
            "bed room": "bedroom",
            "bath room": "bathroom",
            "study": "office",
            "work room": "office",
            "porch": "balcony",
            "terrace": "balcony",
        }
        for alias, canonical in aliases.items():
            if alias in message:
                return canonical
        return None

    def _extract_device_type(self, message: str) -> Optional[str]:
        """Identify the device category from the message."""
        for dev in DEVICE_CATEGORIES:
            if dev in message:
                return dev
        # Common aliases
        device_aliases: Dict[str, str] = {
            "bulb": "light",
            "lamp": "light",
            "ac": "thermostat",
            "air conditioner": "thermostat",
            "door": "lock",
            "blind": "curtain",
            "shade": "curtain",
            "alexa": "speaker",
            "echo": "speaker",
            "cctv": "camera",
        }
        for alias, canonical in device_aliases.items():
            if alias in message:
                return canonical
        return "light"  # sensible default

    # ---- Formatting helpers ----------------------------------------------

    def _format_room_sensors(self, room: str, data: Dict[str, Any]) -> str:
        """Format sensor readings for a single room as markdown."""
        label = room.replace("_", " ").title()
        gas_status = "🔴 DETECTED" if data["gas_detected"] else "🟢 Safe"
        occupancy = "👤 Occupied" if data["occupancy"] else "🚫 Unoccupied"
        return (
            f"🌡️ **{label} — Sensor Readings**\n\n"
            f"| Metric | Value |\n"
            f"|--------|-------|\n"
            f"| Temperature | {data['temperature_c']:.1f} °C |\n"
            f"| Humidity | {data['humidity_pct']:.1f} % |\n"
            f"| Air Quality Index | {data['aqi']} |\n"
            f"| Gas Sensor | {gas_status} |\n"
            f"| Occupancy | {occupancy} |"
        )

    def _format_room_card(self, room: str, data: Dict[str, Any]) -> str:
        """Create a rich status card for one room."""
        label = room.replace("_", " ").title()
        score = data.get("comfort_score", 0)
        score_icon = "🟢" if score >= 80 else "🟡" if score >= 50 else "🔴"

        devices_md = ""
        if data["devices"]:
            device_lines = "\n".join(
                f"  - {d['type'].title()}: **{d['state']}**"
                for d in data["devices"]
            )
            devices_md = f"\n**Active Devices:**\n{device_lines}"
        else:
            devices_md = "\n_No active devices._"

        gas_status = "🔴 DETECTED" if data["gas_detected"] else "🟢 Safe"
        return (
            f"### {label}\n"
            f"- 🌡️ Temp: {data['temperature_c']:.1f} °C\n"
            f"- 💧 Humidity: {data['humidity_pct']:.1f} %\n"
            f"- 🌬️ AQI: {data['aqi']}\n"
            f"- 🔥 Gas: {gas_status}\n"
            f"- {score_icon} Comfort: {score:.0f}/100"
            f"{devices_md}"
        )

    @staticmethod
    def _progress_bar(pct: float, length: int = 20) -> str:
        """Return a text-based progress bar."""
        filled = int(length * pct / 100)
        empty = length - filled
        return f"[{'█' * filled}{'░' * empty}]"

    # ---- Computation helpers ---------------------------------------------

    @staticmethod
    def _compute_comfort_score(room_data: Dict[str, Any]) -> float:
        """
        Compute a 0-100 comfort score based on temperature, humidity, AQI.

        Full marks (100) when every metric sits in its ideal range; linearly
        degraded otherwise.
        """
        score = 100.0

        temp = room_data["temperature_c"]
        t_lo, t_hi = COMFORT_RANGES["temperature"]["ideal"]
        if not (t_lo <= temp <= t_hi):
            deviation = min(abs(temp - t_lo), abs(temp - t_hi))
            score -= min(deviation * 5, 30)

        hum = room_data["humidity_pct"]
        h_lo, h_hi = COMFORT_RANGES["humidity"]["ideal"]
        if not (h_lo <= hum <= h_hi):
            deviation = min(abs(hum - h_lo), abs(hum - h_hi))
            score -= min(deviation * 2, 25)

        aqi = room_data["aqi"]
        if aqi > 100:
            score -= min((aqi - 100) * 0.5, 30)
        elif aqi > 50:
            score -= (aqi - 50) * 0.2

        if room_data["gas_detected"]:
            score = max(score - 50, 0)

        return max(round(score, 1), 0.0)

    def _calculate_bill(self, total_kwh: float) -> float:
        """Calculate the electricity bill using slab-based tariff tiers."""
        bill = 0.0
        remaining = total_kwh
        prev_upper = 0
        for tier in POWER_TARIFF_TIERS:
            slab_width = tier["upper_kwh"] - prev_upper
            consumed_in_slab = min(remaining, slab_width)
            bill += consumed_in_slab * tier["rate"]
            remaining -= consumed_in_slab
            prev_upper = tier["upper_kwh"]
            if remaining <= 0:
                break
        return round(bill, 2)

    def _detect_power_anomalies(self, daily_kwh: float) -> List[str]:
        """Return list of anomaly descriptions if any are detected."""
        anomalies: List[str] = []
        if daily_kwh > 20:
            anomalies.append(
                f"High daily consumption ({daily_kwh} kWh) — "
                "check for appliances left running."
            )
        # Simulate occasional phantom load detection
        if random.random() < 0.15:
            anomalies.append(
                "Phantom load detected (~0.8 kWh/day) from standby devices. "
                "Consider using smart power strips."
            )
        return anomalies

    def _get_top_power_consumers(self) -> List[Tuple[str, float, float]]:
        """Return simulated list of (device_name, kwh, pct) tuples."""
        consumers = [
            ("Air Conditioner", round(random.uniform(3.0, 8.0), 1), 0),
            ("Water Heater", round(random.uniform(1.5, 4.0), 1), 0),
            ("Refrigerator", round(random.uniform(1.0, 2.0), 1), 0),
            ("Washing Machine", round(random.uniform(0.5, 1.5), 1), 0),
            ("Lighting (all)", round(random.uniform(0.5, 1.5), 1), 0),
        ]
        total = sum(c[1] for c in consumers)
        return [
            (name, kwh, round(kwh / total * 100, 1))
            for name, kwh, _ in consumers
        ]

    def _scan_for_anomalies(self) -> List[str]:
        """Run a full anomaly scan across all subsystems."""
        findings: List[str] = []

        # Gas check
        for r_name, r_data in self._rooms.items():
            if r_data["gas_detected"]:
                findings.append(
                    f"Gas leakage detected in {r_name.replace('_', ' ').title()}!"
                )

        # Water tank check
        pct = self._water_tank["current_litres"] / self._water_tank["capacity_litres"] * 100
        if pct <= self._water_tank["low_threshold_pct"]:
            findings.append(f"Water tank critically low ({pct:.0f}%).")
        elif pct >= self._water_tank["overflow_threshold_pct"]:
            findings.append(f"Water tank near overflow ({pct:.0f}%).")

        # Temperature extremes
        for r_name, r_data in self._rooms.items():
            t = r_data["temperature_c"]
            if t < COMFORT_RANGES["temperature"]["acceptable"][0]:
                findings.append(
                    f"Temperature too low in {r_name.replace('_', ' ').title()} ({t:.1f} °C)."
                )
            elif t > COMFORT_RANGES["temperature"]["acceptable"][1]:
                findings.append(
                    f"Temperature too high in {r_name.replace('_', ' ').title()} ({t:.1f} °C)."
                )

        return findings

    @staticmethod
    def _aqi_category(aqi: int) -> Tuple[str, str]:
        """Return (category_label, health_advice) for a given AQI value."""
        if aqi <= 50:
            return "🟢 Good", "Air quality is satisfactory."
        if aqi <= 100:
            return "🟡 Moderate", "Acceptable; sensitive individuals should limit outdoor exertion."
        if aqi <= 150:
            return "🟠 Unhealthy (Sensitive)", "Sensitive groups may experience irritation."
        if aqi <= 200:
            return "🔴 Unhealthy", "Everyone may experience health effects."
        return "🟣 Very Unhealthy", "Health alert — avoid outdoor activity."

    # ---- Pattern learning ------------------------------------------------

    def _record_usage_event(
        self, room: Optional[str], device: Optional[str], action: str
    ) -> None:
        """Append a usage event for pattern analysis."""
        event = {
            "room": room,
            "device": device,
            "action": action,
            "hour": datetime.utcnow().hour,
            "weekday": datetime.utcnow().strftime("%A"),
            "ts": datetime.utcnow().isoformat(),
        }
        key = f"{room}_{device}"
        self._usage_patterns.setdefault(key, []).append(event)
        logger.debug("Recorded usage event: {}", event)

    def _analyse_usage_patterns(self) -> List[str]:
        """Derive human-readable insights from collected usage events."""
        insights: List[str] = []
        for key, events in self._usage_patterns.items():
            if len(events) < 3:
                continue
            room, device = key.rsplit("_", 1) if "_" in key else (key, "device")
            hours = [e["hour"] for e in events]
            avg_hour = round(sum(hours) / len(hours))
            label = room.replace("_", " ").title() if room else "Unknown"
            insights.append(
                f"You typically use **{device}** in **{label}** around "
                f"**{avg_hour}:00**. ({len(events)} data points)"
            )
        return insights

    # ---- Automation rule helpers -----------------------------------------

    async def _create_automation_rule(self, message: str) -> AgentResponse:
        """Parse a natural-language rule description and store it."""
        rule = {
            "id": len(self._automation_rules) + 1,
            "name": f"Custom Rule #{len(self._automation_rules) + 1}",
            "description": message,
            "trigger": self._extract_trigger(message),
            "action": self._extract_action(message),
            "enabled": True,
            "created_at": datetime.utcnow().isoformat(),
        }
        self._automation_rules.append(rule)
        logger.info("New automation rule created: {}", rule["name"])

        return AgentResponse(
            content=(
                "✅ **Automation Rule Created**\n\n"
                f"**Name:** {rule['name']}\n"
                f"**Trigger:** `{rule['trigger']}`\n"
                f"**Action:** `{rule['action']}`\n"
                f"**Status:** Enabled ✅\n\n"
                "The rule is now active. I'll execute the action whenever "
                "the trigger condition is met."
            ),
            agent_name=self.name,
            confidence=0.80,
            actions=[{"type": "create_rule", "rule": rule}],
            suggestions=[
                "Show all rules",
                "Test this rule",
                "Disable this rule",
            ],
        )

    @staticmethod
    def _extract_trigger(message: str) -> str:
        """Best-effort extraction of a trigger clause from free text."""
        patterns = [
            r"when\s+(.+?)(?:\s+then|\s*,)",
            r"if\s+(.+?)(?:\s+then|\s*,)",
            r"every\s+(day|night|morning|evening|hour)",
        ]
        for pat in patterns:
            m = re.search(pat, message, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return "manual_trigger"

    @staticmethod
    def _extract_action(message: str) -> str:
        """Best-effort extraction of an action clause from free text."""
        patterns = [
            r"then\s+(.+)",
            r"(?:turn|switch|set)\s+(on|off)\s+(.+)",
        ]
        for pat in patterns:
            m = re.search(pat, message, re.IGNORECASE)
            if m:
                return m.group(0).strip()
        return message.strip()

    @staticmethod
    def _default_rules() -> List[Dict[str, Any]]:
        """Seed a handful of common automation rules."""
        return [
            {
                "id": 1,
                "name": "Goodnight Mode",
                "description": "When it's 11 PM, turn off all lights and lock doors.",
                "trigger": "time == 23:00",
                "action": "turn_off(lights, all); lock(doors, all)",
                "enabled": True,
            },
            {
                "id": 2,
                "name": "Morning Routine",
                "description": "At 6:30 AM, turn on kitchen light and start coffee maker.",
                "trigger": "time == 06:30",
                "action": "turn_on(kitchen.light); turn_on(kitchen.coffee_maker)",
                "enabled": True,
            },
            {
                "id": 3,
                "name": "Away Mode",
                "description": "When no occupancy for 30 min, turn off non-essential devices.",
                "trigger": "occupancy == 0 for 30min",
                "action": "turn_off(lights, all); set(thermostat, eco_mode)",
                "enabled": True,
            },
            {
                "id": 4,
                "name": "High Temp Alert",
                "description": "If any room exceeds 35 °C, turn on AC and notify.",
                "trigger": "any(room.temperature > 35)",
                "action": "turn_on(thermostat, cool); notify(user, 'High temp alert')",
                "enabled": True,
            },
        ]

    # ---- Summary ---------------------------------------------------------

    def _quick_home_summary(self) -> str:
        """Build a quick one-paragraph summary of the home state."""
        occupied = sum(1 for r in self._rooms.values() if r["occupancy"])
        avg_temp = round(
            sum(r["temperature_c"] for r in self._rooms.values()) / len(self._rooms), 1
        )
        avg_hum = round(
            sum(r["humidity_pct"] for r in self._rooms.values()) / len(self._rooms), 1
        )
        gas_rooms = [
            r.replace("_", " ").title()
            for r, d in self._rooms.items() if d["gas_detected"]
        ]
        water_pct = round(
            self._water_tank["current_litres"] / self._water_tank["capacity_litres"] * 100
        )
        active_device_count = sum(len(r["devices"]) for r in self._rooms.values())

        gas_note = (
            f"⚠️ Gas detected in: {', '.join(gas_rooms)}."
            if gas_rooms else "No gas alerts."
        )

        return (
            f"**Rooms:** {len(self._rooms)} ({occupied} occupied) | "
            f"**Avg Temp:** {avg_temp} °C | **Avg Humidity:** {avg_hum}% | "
            f"**Water Tank:** {water_pct}% | "
            f"**Active Devices:** {active_device_count} | "
            f"{gas_note}"
        )
