# NEXUS AI OS — API Reference

> Complete REST API and WebSocket documentation with request/response examples.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [REST Endpoints](#rest-endpoints)
  - [Root & Health](#root--health)
  - [Chat](#chat)
  - [Agents](#agents)
  - [Home Automation](#home-automation)
  - [Health & Wellness](#health--wellness)
  - [Finance](#finance)
  - [Tasks](#tasks)
  - [System](#system)
  - [Voice](#voice)
  - [Reports](#reports)
- [WebSocket Channels](#websocket-channels)

---

## Base URL

```
Development: http://localhost:8000
Production:  https://your-domain.com
```

All REST endpoints are prefixed with `/api/`. WebSocket endpoints use `/ws/`.

---

## Authentication

### Development Mode
No authentication required. All endpoints are open.

### Production Mode
API key authentication via header:

```http
X-API-Key: your-api-key-here
```

Or Bearer token (JWT):

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad Request — Invalid input data |
| `401` | Unauthorized — Missing or invalid authentication |
| `403` | Forbidden — Insufficient permissions |
| `404` | Not Found — Resource does not exist |
| `422` | Validation Error — Request body failed validation |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error — Unexpected server error |
| `503` | Service Unavailable — Ollama or service down |

### Validation Error Response

```json
{
  "detail": [
    {
      "loc": ["body", "message"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Rate Limiting

| Endpoint Category | Limit |
|-------------------|-------|
| Chat / AI | 30 requests/minute |
| CRUD operations | 60 requests/minute |
| System / Health | 120 requests/minute |
| WebSocket messages | 60 messages/minute |

---

## REST Endpoints

### Root & Health

#### `GET /`

Root endpoint with system information.

**Response:**
```json
{
  "name": "NEXUS AI",
  "version": "1.0.0",
  "status": "running",
  "environment": "development",
  "docs": "/docs",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

#### `GET /health`

Health check for monitoring and load balancers.

**Response:**
```json
{
  "status": "healthy",
  "engine": "healthy",
  "database": "healthy",
  "agents": 14,
  "services": 9,
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

Status values: `healthy`, `degraded`, `unhealthy`

---

### Chat

#### `POST /api/chat/message`

Send a message to the AI and receive a response.

**Request:**
```json
{
  "message": "What's my budget looking like this month?",
  "conversation_id": null,
  "agent": null,
  "metadata": {},
  "attachments": []
}
```

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `message` | string | Yes | User message (1-10000 chars) |
| `conversation_id` | string | No | Continue existing conversation |
| `agent` | string | No | Target agent (auto-routed if omitted) |
| `metadata` | object | No | Extra context data |
| `attachments` | string[] | No | File paths to attach |

**Response (200):**
```json
{
  "message_id": "msg_abc123",
  "conversation_id": "conv_xyz789",
  "content": "Based on your spending this month, you've used about 65% of your budget...",
  "agent_name": "financial",
  "confidence": 0.92,
  "suggestions": [
    "Would you like to see a detailed breakdown?",
    "Should I compare with last month?"
  ],
  "actions": [
    {"type": "show_chart", "data": {"chart_type": "budget_pie"}}
  ],
  "processing_time_ms": 1250.5,
  "metadata": {},
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

#### `GET /api/chat/conversations`

List all conversations.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 20 | Max results |
| `offset` | int | 0 | Pagination offset |
| `active_only` | bool | true | Only active conversations |

**Response (200):**
```json
[
  {
    "id": "conv_xyz789",
    "title": "Budget Discussion",
    "agent_type": "financial",
    "message_count": 5,
    "is_active": true,
    "created_at": "2025-01-15T10:00:00",
    "updated_at": "2025-01-15T10:30:00"
  }
]
```

#### `GET /api/chat/conversations/{conversation_id}`

Get full conversation with messages.

**Response (200):**
```json
{
  "id": "conv_xyz789",
  "title": "Budget Discussion",
  "agent_type": "financial",
  "message_count": 5,
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "What's my budget?",
      "timestamp": "2025-01-15T10:00:00"
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "Your current budget status...",
      "agent": "financial",
      "timestamp": "2025-01-15T10:00:02"
    }
  ],
  "created_at": "2025-01-15T10:00:00",
  "updated_at": "2025-01-15T10:30:00"
}
```

#### `DELETE /api/chat/conversations/{conversation_id}`

Delete a conversation and its messages.

**Response (200):**
```json
{
  "success": true
}
```

---

### Agents

#### `GET /api/agents/`

List all registered agents with status.

**Response (200):**
```json
[
  {
    "name": "orchestrator",
    "description": "Master orchestrator agent",
    "status": "idle",
    "capabilities": ["chat", "analyze"],
    "messages_processed": 150,
    "avg_response_time_ms": 45.2
  },
  {
    "name": "financial",
    "description": "Financial intelligence agent",
    "status": "idle",
    "capabilities": ["chat", "analyze", "report", "predict"],
    "messages_processed": 42,
    "avg_response_time_ms": 1200.0
  }
]
```

#### `GET /api/agents/{agent_name}`

Get detailed information about a specific agent.

**Response (200):**
```json
{
  "name": "financial",
  "description": "Financial intelligence agent for budgets, investments, and financial health",
  "status": "idle",
  "capabilities": ["chat", "analyze", "report", "predict"],
  "system_prompt_preview": "You are NEXUS Financial Advisor...",
  "messages_processed": 42,
  "avg_response_time_ms": 1200.0,
  "last_active": "2025-01-15T10:30:00"
}
```

#### `GET /api/agents/{agent_name}/stats`

Get agent statistics and performance metrics.

**Response (200):**
```json
{
  "name": "financial",
  "total_messages": 42,
  "avg_response_time_ms": 1200.0,
  "avg_confidence": 0.88,
  "error_rate": 0.02,
  "uptime_seconds": 86400,
  "status_history": [
    {"status": "idle", "since": "2025-01-15T10:30:00"}
  ]
}
```

#### `POST /api/agents/{agent_name}/message`

Send a message directly to a specific agent (bypass orchestrator).

**Request:**
```json
{
  "message": "Show my spending breakdown",
  "context": {}
}
```

**Response (200):** Same as `POST /api/chat/message`

---

### Home Automation

#### `GET /api/home/status`

Get full smart home status including all devices and sensors.

**Response (200):**
```json
{
  "rooms": {
    "living_room": {
      "temperature": 24.5,
      "humidity": 55.0,
      "air_quality": 42,
      "devices": {
        "light_1": {"state": "on", "brightness": 80},
        "light_2": {"state": "off"},
        "fan": {"state": "on", "speed": 60}
      }
    }
  },
  "alerts": [],
  "total_power_watts": 450.2,
  "connected_devices": 8
}
```

#### `POST /api/home/devices/{device_id}/control`

Control a smart home device.

**Request:**
```json
{
  "action": "turn_on",
  "params": {
    "brightness": 75
  }
}
```

| Action | Params | Description |
|--------|--------|-------------|
| `turn_on` | `brightness` (opt) | Turn device on |
| `turn_off` | — | Turn device off |
| `toggle` | — | Toggle state |
| `set_brightness` | `brightness` (0-100) | Set light brightness |
| `set_speed` | `speed` (0-100) | Set fan speed |
| `set_temperature` | `temperature` | Set thermostat |
| `set_color` | `r`, `g`, `b` | Set RGB light color |

**Response (200):**
```json
{
  "device_id": "light_1",
  "action": "turn_on",
  "success": true,
  "new_state": {"state": "on", "brightness": 75}
}
```

#### `GET /api/home/rooms`

List all rooms with summary data.

#### `GET /api/home/rooms/{room_name}`

Get detailed room information including all sensors and devices.

#### `GET /api/home/energy`

Get energy consumption data and statistics.

**Response (200):**
```json
{
  "current_power_watts": 450.2,
  "today_kwh": 5.8,
  "month_kwh": 128.5,
  "estimated_bill": 15.42,
  "devices": [
    {"name": "AC", "power_watts": 200.0, "percentage": 44.4}
  ]
}
```

#### `POST /api/home/scenes`

Activate a predefined scene.

**Request:**
```json
{
  "scene": "movie_night"
}
```

#### `GET /api/home/sensors`

Get all sensor data.

---

### Health & Wellness

#### `POST /api/health/metrics`

Log health metrics.

**Request:**
```json
{
  "type": "weight",
  "value": 72.5,
  "unit": "kg",
  "timestamp": "2025-01-15T08:00:00"
}
```

#### `POST /api/health/mood`

Log a mood entry.

**Request:**
```json
{
  "mood": "good",
  "energy": 7,
  "stress": 3,
  "notes": "Productive morning",
  "timestamp": "2025-01-15T10:00:00"
}
```

#### `POST /api/health/workout`

Log a workout session.

**Request:**
```json
{
  "type": "running",
  "duration_minutes": 30,
  "calories_burned": 300,
  "distance_km": 5.2,
  "heart_rate_avg": 145,
  "notes": "Morning jog in the park"
}
```

#### `GET /api/health/dashboard`

Get health dashboard with today's summary.

**Response (200):**
```json
{
  "date": "2025-01-15",
  "mood": {"current": "good", "trend": "improving"},
  "sleep": {"hours": 7.5, "quality": "good"},
  "exercise": {"minutes": 30, "goal": 45},
  "water": {"glasses": 5, "goal": 8},
  "steps": {"count": 6500, "goal": 10000},
  "stress": {"level": 3, "trend": "stable"},
  "health_score": 78
}
```

#### `GET /api/health/trends`

Get health trends over time.

**Query Parameters:** `period` (week/month/year), `metric` (weight/mood/sleep/etc)

#### `GET /api/health/goals`

Get active health goals and progress.

---

### Finance

#### `POST /api/finance/transactions`

Add a financial transaction.

**Request:**
```json
{
  "type": "expense",
  "amount": 45.99,
  "category": "food",
  "description": "Grocery shopping at Trader Joe's",
  "date": "2025-01-15"
}
```

#### `GET /api/finance/summary`

Get financial summary.

**Query Parameters:** `period` (week/month/year)

**Response (200):**
```json
{
  "period": "month",
  "total_income": 5000.00,
  "total_expenses": 3200.50,
  "net": 1799.50,
  "savings_rate": 36.0,
  "top_categories": [
    {"name": "housing", "amount": 1200.00, "percentage": 37.5},
    {"name": "food", "amount": 650.00, "percentage": 20.3}
  ]
}
```

#### `GET /api/finance/budget`

Get budget overview with actual vs planned.

#### `POST /api/finance/goals`

Set a financial goal.

**Request:**
```json
{
  "name": "Emergency Fund",
  "target_amount": 10000.00,
  "current_amount": 3500.00,
  "deadline": "2025-12-31",
  "priority": "high"
}
```

#### `GET /api/finance/trends`

Get spending trends and patterns.

#### `GET /api/finance/insights`

Get AI-generated financial insights and recommendations.

---

### Tasks

#### `POST /api/tasks/`

Create a new task.

**Request:**
```json
{
  "title": "Review quarterly report",
  "description": "Review and approve Q1 financial report",
  "priority": "high",
  "due_date": "2025-01-20",
  "category": "work",
  "tags": ["finance", "quarterly"]
}
```

#### `GET /api/tasks/`

List tasks with filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: pending/in_progress/completed |
| `priority` | string | Filter: low/medium/high/urgent |
| `category` | string | Filter by category |
| `limit` | int | Max results (default 50) |
| `offset` | int | Pagination offset |

#### `PUT /api/tasks/{task_id}`

Update a task.

**Request:**
```json
{
  "status": "completed",
  "completion_notes": "Report approved with minor changes"
}
```

#### `DELETE /api/tasks/{task_id}`

Delete a task.

#### `GET /api/tasks/stats`

Get task statistics.

**Response (200):**
```json
{
  "total": 45,
  "completed": 30,
  "pending": 10,
  "in_progress": 5,
  "overdue": 2,
  "completion_rate": 66.7,
  "avg_completion_time_hours": 24.5
}
```

#### `GET /api/tasks/upcoming`

Get upcoming tasks for the next 7 days.

---

### System

#### `GET /api/system/status`

Get system health and resource usage.

**Response (200):**
```json
{
  "status": "healthy",
  "uptime_seconds": 86400,
  "cpu_percent": 15.2,
  "memory_percent": 45.8,
  "disk_percent": 32.1,
  "agents_active": 14,
  "services_active": 9,
  "ollama_status": "connected",
  "mqtt_status": "connected"
}
```

#### `GET /api/system/metrics`

Get detailed system metrics (CPU, memory, disk, GPU).

#### `GET /api/system/config`

Get current (non-sensitive) configuration values.

#### `POST /api/system/backup`

Trigger a manual backup.

**Response (200):**
```json
{
  "success": true,
  "backup_path": "./data/backups/nexus_2025-01-15_10-30-00.db",
  "size_bytes": 1048576,
  "timestamp": "2025-01-15T10:30:00"
}
```

#### `GET /api/system/logs`

Get recent log entries.

**Query Parameters:** `level` (DEBUG/INFO/WARNING/ERROR), `limit` (default 100)

---

### Voice

#### `POST /api/voice/speak`

Convert text to speech audio.

**Request:**
```json
{
  "text": "Good morning! Here's your daily briefing.",
  "voice": "default",
  "speed": 1.0
}
```

**Response:** Audio file (WAV) or base64-encoded audio string.

#### `POST /api/voice/listen`

Convert speech audio to text.

**Request:** Multipart form with audio file upload.

**Response (200):**
```json
{
  "text": "What's the weather like today?",
  "confidence": 0.95,
  "language": "en",
  "duration_seconds": 2.5
}
```

#### `POST /api/voice/process`

Process a voice command end-to-end (STT → Agent → TTS).

**Request:** Multipart form with audio file.

**Response (200):**
```json
{
  "transcription": "Turn on the living room lights",
  "response_text": "I've turned on the living room lights for you.",
  "response_audio": "base64_encoded_audio...",
  "agent": "home",
  "actions": [{"type": "device_control", "device": "light_1", "action": "turn_on"}]
}
```

#### `GET /api/voice/status`

Get voice engine status (TTS/STT model loaded, wake word listener active).

---

### Reports

#### `POST /api/reports/generate`

Generate a report.

**Request:**
```json
{
  "type": "financial_monthly",
  "format": "pdf",
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "options": {
    "include_charts": true,
    "include_recommendations": true
  }
}
```

| Type | Description |
|------|-------------|
| `financial_monthly` | Monthly financial summary |
| `financial_annual` | Annual financial report |
| `health_weekly` | Weekly health report |
| `health_monthly` | Monthly health trends |
| `home_energy` | Energy consumption report |
| `productivity` | Task/work productivity report |
| `daily_briefing` | Daily combined briefing |

**Response (200):**
```json
{
  "report_id": "rpt_abc123",
  "type": "financial_monthly",
  "format": "pdf",
  "status": "completed",
  "file_path": "./reports/financial_monthly_2025-01.pdf",
  "generated_at": "2025-01-15T10:30:00",
  "size_bytes": 245760
}
```

#### `GET /api/reports/`

List generated reports.

#### `GET /api/reports/{report_id}`

Get report metadata and status.

#### `GET /api/reports/{report_id}/download`

Download the generated report file.

---

## WebSocket Channels

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat?client_id=my-client-123');
```

All WebSocket connections accept an optional `client_id` query parameter.

### `/ws/chat` — Real-time AI Chat

**Client → Server (Send Message):**
```json
{
  "type": "message",
  "data": {
    "message": "Hello, how are you?",
    "conversation_id": "conv_123",
    "agent": null
  }
}
```

**Server → Client (AI Response - Streaming):**
```json
{
  "type": "response",
  "data": {
    "message_id": "msg_456",
    "conversation_id": "conv_123",
    "content": "I'm doing well! How can I help you today?",
    "agent_name": "personal",
    "confidence": 0.95,
    "suggestions": ["Tell me about your day", "Any tasks to manage?"],
    "done": true
  }
}
```

**Server → Client (Typing Indicator):**
```json
{
  "type": "typing",
  "data": {
    "agent": "personal",
    "is_typing": true
  }
}
```

### `/ws/home` — IoT Device Updates

**Server → Client (Sensor Update):**
```json
{
  "type": "sensor_update",
  "data": {
    "room": "living_room",
    "sensor": "temperature",
    "value": 24.5,
    "unit": "°C",
    "timestamp": "2025-01-15T10:30:00"
  }
}
```

**Server → Client (Device State Change):**
```json
{
  "type": "device_update",
  "data": {
    "device_id": "light_1",
    "room": "living_room",
    "state": "on",
    "brightness": 80
  }
}
```

**Server → Client (Alert):**
```json
{
  "type": "alert",
  "data": {
    "severity": "warning",
    "message": "Gas leak detected in kitchen!",
    "sensor": "gas",
    "value": 450,
    "threshold": 400
  }
}
```

### `/ws/system` — System Metrics

**Server → Client (Metrics Stream):**
```json
{
  "type": "metrics",
  "data": {
    "cpu_percent": 15.2,
    "memory_percent": 45.8,
    "disk_percent": 32.1,
    "gpu_percent": 25.0,
    "active_connections": 3,
    "timestamp": "2025-01-15T10:30:00"
  }
}
```

### `/ws/notifications` — Live Notifications

**Server → Client (Notification):**
```json
{
  "type": "notification",
  "data": {
    "id": "notif_789",
    "title": "Task Due Soon",
    "message": "Review quarterly report is due in 2 hours",
    "category": "task",
    "priority": "high",
    "actions": [
      {"label": "View Task", "action": "open_task", "task_id": "task_123"}
    ],
    "timestamp": "2025-01-15T10:30:00"
  }
}
```

### WebSocket Statistics

```
GET /api/ws/stats
```

**Response (200):**
```json
{
  "total_connections": 3,
  "connections_by_channel": {
    "chat": 1,
    "home": 1,
    "system": 1,
    "notifications": 0
  },
  "total_messages_sent": 1250,
  "uptime_seconds": 3600
}
```
