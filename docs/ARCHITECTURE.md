# NEXUS AI OS — System Architecture

> Detailed architecture documentation covering all system layers, communication patterns, and design decisions.

---

## Table of Contents

- [System Overview](#system-overview)
- [Component Diagram](#component-diagram)
- [Backend Architecture](#backend-architecture)
- [Agent System Design](#agent-system-design)
- [Local AI Pipeline](#local-ai-pipeline)
- [Event Bus Architecture](#event-bus-architecture)
- [IoT Communication Flow](#iot-communication-flow)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Security Model](#security-model)
- [Training Pipeline](#training-pipeline)
- [Deployment Architecture](#deployment-architecture)

---

## System Overview

NEXUS AI OS is a multi-tier, event-driven architecture designed for local-first AI operations. The system operates entirely on the user's hardware, with no cloud dependencies for core functionality.

### Design Principles

1. **Local-First**: All AI inference, data storage, and processing runs locally
2. **Agent-Oriented**: Business logic is encapsulated in specialized agents
3. **Event-Driven**: Components communicate through an asynchronous event bus
4. **Layered**: Clear separation between presentation, API, business logic, and data layers
5. **Extensible**: New agents, services, and IoT devices can be added without modifying core code

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│                                                                         │
│    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│    │   Electron    │    │   React Web  │    │ React Native │            │
│    │   Desktop     │    │    (Vite)    │    │   Mobile     │            │
│    │   App         │    │              │    │   App        │            │
│    └──────┬────────┘    └──────┬───────┘    └──────┬───────┘            │
│           │                    │                    │                    │
│           └──────────┬─────────┴────────────────────┘                   │
│                      │                                                  │
│              ┌───────▼─────────┐                                        │
│              │   HTTP / WS     │                                        │
│              │   Client Layer  │                                        │
│              └───────┬─────────┘                                        │
└──────────────────────┼──────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────────┐
│                      │          API LAYER (FastAPI)                      │
│              ┌───────▼─────────┐                                        │
│              │  ASGI Server    │  Uvicorn                                │
│              │  (HTTP + WS)    │                                        │
│              └───────┬─────────┘                                        │
│                      │                                                  │
│    ┌─────────────────┼─────────────────────┐                            │
│    │                 │                     │                             │
│    ▼                 ▼                     ▼                             │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐                        │
│  │  REST    │  │ WebSocket│  │  Middleware     │                        │
│  │  Routes  │  │ Handlers │  │  (CORS, Auth,  │                        │
│  │          │  │          │  │   Logging)      │                        │
│  └──────────┘  └──────────┘  └────────────────┘                        │
│                                                                         │
│  Routes: /api/chat, /api/agents, /api/home, /api/health,               │
│          /api/finance, /api/tasks, /api/system, /api/voice,            │
│          /api/reports                                                    │
│  WebSockets: /ws/chat, /ws/home, /ws/system, /ws/notifications         │
└─────────────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────────┐
│                      │      BUSINESS LOGIC LAYER                        │
│              ┌───────▼─────────┐                                        │
│              │  NexusEngine    │  Singleton — central coordinator        │
│              └───────┬─────────┘                                        │
│                      │                                                  │
│         ┌────────────┼────────────────┐                                 │
│         │            │                │                                  │
│    ┌────▼─────┐ ┌────▼──────┐  ┌─────▼──────┐                          │
│    │  Agent   │ │  Service  │  │  Event     │                           │
│    │  Layer   │ │  Layer    │  │  Bus       │                           │
│    └────┬─────┘ └────┬──────┘  └────┬───────┘                          │
│         │            │              │                                    │
│    13+ Agents   9 Services    Pub/Sub Events                            │
└─────────┼────────────┼──────────────┼───────────────────────────────────┘
          │            │              │
┌─────────┼────────────┼──────────────┼───────────────────────────────────┐
│         │       AI / MODEL LAYER    │                                    │
│    ┌────▼────────────▼──────┐       │                                    │
│    │  Ollama LLM Client     │       │                                    │
│    │  ┌───────────────────┐ │       │                                    │
│    │  │ LLM (llama3.1)    │ │       │                                    │
│    │  │ Embeddings        │ │       │                                    │
│    │  │ Vision (llava)    │ │       │                                    │
│    │  └───────────────────┘ │       │                                    │
│    └────────────────────────┘       │                                    │
│    ┌────────────────────────┐       │                                    │
│    │  RAG Engine            │       │                                    │
│    │  (ChromaDB + LangChain)│       │                                    │
│    └────────────────────────┘       │                                    │
│    ┌────────────────────────┐       │                                    │
│    │  Voice Pipeline        │       │                                    │
│    │  Whisper (STT)         │       │                                    │
│    │  Coqui TTS (TTS)       │       │                                    │
│    └────────────────────────┘       │                                    │
│    ┌────────────────────────┐       │                                    │
│    │  Personality Model     │       │                                    │
│    │  Fine-Tuner            │       │                                    │
│    └────────────────────────┘       │                                    │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────┐
│                        DATA LAYER   │                                    │
│                                     │                                    │
│    ┌──────────────┐  ┌──────────────┼──┐  ┌──────────────┐              │
│    │  SQLite      │  │  ChromaDB    │  │  │  File System │              │
│    │  (aiosqlite) │  │  (Vectors)   │  │  │  (logs,      │              │
│    │              │  │              │  │  │   reports,    │              │
│    │  Users       │  │  Embeddings  │  │  │   backups)   │              │
│    │  Conversations│  │  Documents  │  │  │              │              │
│    │  Messages    │  │  Memory      │  │  │              │              │
│    │  Tasks       │  │              │  │  │              │              │
│    │  Health Data │  │              │  │  │              │              │
│    │  Finance Data│  │              │  │  │              │              │
│    └──────────────┘  └─────────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────┐
│                        IoT LAYER    │                                    │
│                                     │                                    │
│    ┌──────────────────┐  ┌──────────▼──────┐  ┌──────────────────┐      │
│    │  MQTT Broker     │  │  MQTT Service   │  │  ESP32 Nodes     │      │
│    │  (Mosquitto)     │◄─┤  (paho-mqtt)    │  │  ┌────────────┐  │      │
│    │                  │  │                 │  │  │ Sensors    │  │      │
│    │  Topics:         │──┤                 ├──│  │ Actuators  │  │      │
│    │  home/sensors/*  │  │  Publish/       │  │  │ Web Server │  │      │
│    │  home/devices/*  │  │  Subscribe      │  │  └────────────┘  │      │
│    │  home/status     │  │                 │  │                  │      │
│    │  home/alert      │  │                 │  │                  │      │
│    └──────────────────┘  └─────────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

The backend follows a **layered architecture** with clear separation of concerns:

### Layer Responsibilities

| Layer | Directory | Purpose |
|-------|-----------|---------|
| **API** | `api/` | HTTP/WS request handling, validation, serialization |
| **Agents** | `agents/` | Domain-specific AI logic and intent processing |
| **Services** | `services/` | Cross-cutting business logic (email, MQTT, voice) |
| **Models** | `models/` | AI model wrappers (LLM, RAG, embeddings, TTS/STT) |
| **Core** | `core/` | Infrastructure (config, engine, events, logging, security) |
| **Database** | `database/` | Data access, ORM models, repositories |
| **Scheduler** | `scheduler/` | Scheduled jobs, triggers, workflows |

### Request Lifecycle

```
HTTP Request
    │
    ▼
FastAPI Router ──► Middleware (CORS, Auth, Logging)
    │
    ▼
Route Handler ──► Pydantic Validation
    │
    ▼
NexusEngine ──► Agent Selection (Orchestrator)
    │
    ▼
Specialized Agent ──► Ollama LLM (if needed)
    │                  ──► RAG Engine (if needed)
    │                  ──► Database (if needed)
    │
    ▼
AgentResponse ──► JSON Serialization
    │
    ▼
HTTP Response
```

---

## Agent System Design

### Orchestrator Pattern

The **OrchestratorAgent** acts as a router, analyzing user intent and dispatching to the appropriate specialized agent.

```
User Message: "What's my budget looking like?"
        │
        ▼
┌─────────────────────────┐
│    OrchestratorAgent    │
│                         │
│  1. Keyword matching    │
│  2. Intent scoring      │
│  3. LLM classification  │  (fallback)
│  4. Route to agent      │
└────────────┬────────────┘
             │  intent = "financial" (score: 0.85)
             ▼
┌─────────────────────────┐
│    FinancialAgent       │
│                         │
│  1. Load user context   │
│  2. Build system prompt │
│  3. Query Ollama LLM    │
│  4. Format response     │
│  5. Suggest actions     │
└────────────┬────────────┘
             │
             ▼
       AgentResponse
```

### Intent Classification

The orchestrator uses a **two-phase** intent detection:

1. **Keyword Matching** (fast): Scores each agent based on keyword overlap
2. **LLM Classification** (fallback): Uses the LLM for ambiguous messages

Intent keyword categories:
- `financial`: money, spend, budget, invest, savings, bank, portfolio...
- `health`: exercise, workout, diet, sleep, weight, calories, mood, stress...
- `home`: light, temperature, sensor, power, energy, smart home, esp32...
- `communication`: email, message, inbox, notification, reply...
- `voice`: speak, say, listen, audio, speech, transcribe...
- `work`: project, deadline, meeting, code, deploy, devops, git...
- `report`: report, pdf, excel, summary, analytics, chart...
- `automation`: automate, schedule, cron, trigger, workflow...
- `learning`: learn, train, improve, adapt, fine-tune...
- `security`: password, encrypt, protect, backup, firewall...
- `memory`: remember, recall, forget, history, remind...

### Agent Base Class

Every agent extends `BaseAgent` which provides:

```python
class BaseAgent(ABC):
    # Lifecycle
    async def initialize()
    async def shutdown()

    # Core (abstract — must implement)
    async def process(context: AgentContext) -> AgentResponse
    def get_system_prompt() -> str
    def get_capabilities() -> List[AgentCapability]

    # Built-in
    async def emit_event(category, data)
    async def log_activity(action, details)
    def get_status() -> AgentStatus
    def get_stats() -> Dict
```

### Inter-Agent Communication

Agents communicate via the **Event Bus**:

```
Agent A ──emit_event(category, data)──► Event Bus
                                            │
                                            ├──► Agent B (subscribed)
                                            ├──► Agent C (subscribed)
                                            └──► Service D (subscribed)
```

---

## Local AI Pipeline

```
┌──────────────────────────────────────────────────────────┐
│                    AI Pipeline                            │
│                                                          │
│  ┌─────────┐     ┌──────────┐     ┌──────────────────┐  │
│  │  User   │────►│  Agent   │────►│  System Prompt   │  │
│  │  Input  │     │  Context │     │  + User Context  │  │
│  └─────────┘     └──────────┘     └────────┬─────────┘  │
│                                            │             │
│                                   ┌────────▼─────────┐  │
│                                   │  RAG Engine      │  │
│                                   │  (ChromaDB)      │  │
│                                   │                  │  │
│                                   │  1. Embed query  │  │
│                                   │  2. Search docs  │  │
│                                   │  3. Add context  │  │
│                                   └────────┬─────────┘  │
│                                            │             │
│                                   ┌────────▼─────────┐  │
│                                   │  Ollama LLM      │  │
│                                   │  (llama3.1)      │  │
│                                   │                  │  │
│                                   │  Generate        │  │
│                                   │  response with   │  │
│                                   │  full context    │  │
│                                   └────────┬─────────┘  │
│                                            │             │
│                                   ┌────────▼─────────┐  │
│                                   │  Post-process    │  │
│                                   │  - Parse actions │  │
│                                   │  - Suggestions   │  │
│                                   │  - Confidence    │  │
│                                   └────────┬─────────┘  │
│                                            │             │
│                                   ┌────────▼─────────┐  │
│                                   │  AgentResponse   │  │
│                                   └──────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Model Configuration

| Model | Purpose | Default |
|-------|---------|---------|
| **Primary LLM** | Chat, reasoning, analysis | `llama3.1` |
| **Embedding** | Document/query embeddings | `nomic-embed-text` |
| **Vision** | Image analysis | `llava` |
| **STT** | Speech-to-text | `whisper-base` |
| **TTS** | Text-to-speech | `tacotron2-DDC` |

---

## Event Bus Architecture

The event bus enables loose coupling between components:

```python
class EventCategory(str, Enum):
    AGENT = "agent"
    SYSTEM = "system"
    HOME = "home"
    HEALTH = "health"
    FINANCE = "finance"
    TASK = "task"
    NOTIFICATION = "notification"
    SECURITY = "security"

class EventPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"
```

### Event Flow Example

```
[PIR Sensor detects motion]
    │
    ▼
ESP32 ──MQTT──► home/sensors/motion = {"room": "living", "detected": true}
    │
    ▼
MQTTService ──► event_bus.emit(HOME, "motion_detected", data)
    │
    ├──► HomeAgent: Update room status
    ├──► SecurityAgent: Check if alarm armed
    ├──► AutomationAgent: Trigger "welcome home" scene
    └──► WebSocket: Push update to /ws/home clients
```

---

## IoT Communication Flow

```
┌────────────┐        ┌──────────────┐        ┌──────────────┐
│  ESP32     │        │  Mosquitto   │        │  Backend     │
│  Node      │  MQTT  │  MQTT Broker │  MQTT  │  MQTTService │
│            │◄──────►│              │◄──────►│              │
│  Sensors:  │        │  Topics:     │        │  Subscribe:  │
│  - DHT22   │ pub    │  home/+/+    │        │  home/#      │
│  - MQ-135  │──────► │              │        │              │
│  - PIR     │        │              │  ──────►  Process     │
│  - SCT-013 │        │              │        │  + Store     │
│            │        │              │        │              │
│  Actuators:│ sub    │              │  pub   │  Control:    │
│  - Relays  │◄────── │              │ ◄────── │  home/      │
│  - PWM Fan │        │              │        │  devices/    │
│  - IR LED  │        │              │        │  {id}/control│
└────────────┘        └──────────────┘        └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  Event Bus   │
                                              └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  WebSocket   │
                                              │  /ws/home    │
                                              └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  Frontend    │
                                              │  Real-time   │
                                              │  Dashboard   │
                                              └──────────────┘
```

### MQTT Topic Convention

```
home/{category}/{measurement_or_device}
home/sensors/temperature        # Sensor readings
home/sensors/humidity
home/sensors/air_quality
home/sensors/gas
home/sensors/water_level
home/sensors/power
home/sensors/motion
home/sensors/door
home/devices/light/control      # Device control
home/devices/fan/control
home/devices/ac/control
home/status                     # Device status reports
home/alert                      # Alert notifications
home/scene/activate             # Scene activation
```

---

## Security Model

```
┌─────────────────────────────────────────────────┐
│                Security Layers                   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Transport Security                      │   │
│  │  - HTTPS (production)                    │   │
│  │  - WSS for WebSockets                    │   │
│  │  - MQTT TLS (optional)                   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Authentication                          │   │
│  │  - API key validation (production)       │   │
│  │  - JWT tokens (python-jose)              │   │
│  │  - Session management                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Data Security                           │   │
│  │  - Encryption at rest (cryptography)     │   │
│  │  - Password hashing (passlib + bcrypt)   │   │
│  │  - Secret key rotation                   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Application Security                    │   │
│  │  - Input validation (Pydantic)           │   │
│  │  - Rate limiting (middleware)            │   │
│  │  - CORS configuration                   │   │
│  │  - Security agent monitoring             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Training Pipeline

The system runs a daily training pipeline to improve personalization:

```
┌─────────────────────────────────────────────────────────────┐
│                 Daily Training Pipeline                       │
│                 (Runs at 3:00 AM by default)                 │
│                                                              │
│  ┌────────────┐     ┌─────────────┐     ┌───────────────┐  │
│  │ 1. Backup  │────►│ 2. Collect  │────►│ 3. Process    │  │
│  │ Database   │     │ Interaction │     │ Training      │  │
│  │            │     │ Data        │     │ Data          │  │
│  └────────────┘     └─────────────┘     └───────┬───────┘  │
│                                                  │          │
│  ┌────────────┐     ┌─────────────┐     ┌───────▼───────┐  │
│  │ 6. Log     │◄────│ 5. Update   │◄────│ 4. Train      │  │
│  │ Results    │     │ Embeddings  │     │ Personality   │  │
│  │            │     │ & Knowledge │     │ Model         │  │
│  └────────────┘     └─────────────┘     └───────────────┘  │
└─────────────────────────────────────────────────────────────┘

Scheduled by: APScheduler (SchedulerSettings)
Triggered by: scripts/train.ps1 | scripts/train.sh
Service:      TrainingService
```

---

## Deployment Architecture

### Development (Local)

```
Developer Machine
├── Ollama (localhost:11434)
├── Backend: uvicorn --reload (localhost:8000)
├── Frontend: vite dev server (localhost:5173)
├── Mosquitto (localhost:1883) [optional]
└── ESP32 nodes on local network [optional]
```

### Production (Docker)

```
Docker Host
├── nexus-backend (port 8000)
│   └── Python 3.11 + FastAPI + Uvicorn
├── nexus-frontend (port 80)
│   └── Nginx serving React build
├── nexus-mosquitto (port 1883, 9001)
│   └── Eclipse Mosquitto MQTT broker
├── nexus-ollama (port 11434)
│   └── Ollama with GPU passthrough
│
├── Volumes:
│   ├── nexus-ai-data (SQLite + ChromaDB)
│   ├── nexus-ai-logs
│   ├── nexus-ai-models
│   ├── nexus-ai-reports
│   ├── nexus-ai-backups
│   ├── nexus-mosquitto-data
│   └── nexus-ollama-data
│
└── Network: nexus-ai-network (bridge)
```

### Network Topology with IoT

```
┌──────────── Local Network (192.168.1.0/24) ──────────────┐
│                                                           │
│  ┌─────────────┐                                         │
│  │  Docker     │  :8000 (API)                            │
│  │  Host       │  :80   (Web UI)                         │
│  │  (Server)   │  :11434 (Ollama)                        │
│  │             │  :1883  (MQTT)                           │
│  └──────┬──────┘                                         │
│         │                                                 │
│    ─────┼─────── WiFi / Ethernet ─────────               │
│         │                                                 │
│  ┌──────┴──────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ ESP32       │  │ ESP32        │  │ ESP32        │    │
│  │ Living Room │  │ Bedroom      │  │ Kitchen      │    │
│  │ - DHT22     │  │ - DHT22      │  │ - MQ-2 Gas   │    │
│  │ - PIR       │  │ - PIR        │  │ - Relay x2   │    │
│  │ - Relay x4  │  │ - NeoPixel   │  │ - Fan PWM    │    │
│  │ - SCT-013   │  │ - IR LED     │  │              │    │
│  └─────────────┘  └──────────────┘  └──────────────┘    │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐                       │
│  │  Desktop    │  │  Mobile      │                       │
│  │  (Electron) │  │  (React      │                       │
│  │             │  │   Native)    │                       │
│  └─────────────┘  └──────────────┘                       │
└───────────────────────────────────────────────────────────┘
```
