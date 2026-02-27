# NEXUS AI OS — Agent Documentation

> Detailed documentation for all 14 specialized agents in the NEXUS AI system.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Agent Lifecycle](#agent-lifecycle)
- [Orchestrator Agent](#orchestrator-agent)
- [Personal Agent](#personal-agent)
- [Financial Agent](#financial-agent)
- [Health Agent](#health-agent)
- [Home Automation Agent](#home-automation-agent)
- [Communication Agent](#communication-agent)
- [Voice Agent](#voice-agent)
- [Work Agent](#work-agent)
- [Report Agent](#report-agent)
- [Automation Agent](#automation-agent)
- [Learning Agent](#learning-agent)
- [Memory Agent](#memory-agent)
- [Security Agent](#security-agent)
- [Task Agent](#task-agent)

---

## Architecture Overview

NEXUS AI uses an **Orchestrator Pattern** for agent coordination:

```
                    User Input
                        │
                        ▼
               ┌─────────────────┐
               │  Orchestrator   │
               │  Agent          │
               │                 │
               │  Intent         │
               │  Classification │
               └────────┬────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌────▼────┐
   │ Agent A │    │  Agent B  │   │ Agent C │
   └─────────┘    └───────────┘   └─────────┘
```

### Common Agent Interface

Every agent implements the `BaseAgent` abstract class:

```python
class BaseAgent(ABC):
    name: str                                    # Unique identifier
    description: str                             # Human-readable description
    status: AgentStatus                          # Current lifecycle state

    async def initialize()                       # Setup resources
    async def process(ctx: AgentContext) -> AgentResponse  # Handle request
    def get_system_prompt() -> str               # LLM system prompt
    def get_capabilities() -> List[AgentCapability]       # What it can do
    async def shutdown()                         # Cleanup resources
```

### AgentContext

```python
@dataclass
class AgentContext:
    user_id: str              # Current user
    conversation_id: str      # Conversation thread
    message: str              # User's message
    history: List[Dict]       # Conversation history
    metadata: Dict            # Extra context
    attachments: List[str]    # File attachments
    language: str             # User's language
    timezone: str             # User's timezone
```

### AgentResponse

```python
@dataclass
class AgentResponse:
    content: str              # Response text
    agent_name: str           # Which agent responded
    confidence: float         # Confidence score (0-1)
    metadata: Dict            # Additional data
    actions: List[Dict]       # UI actions to perform
    suggestions: List[str]    # Follow-up suggestions
    requires_followup: bool   # Needs more input?
    processing_time_ms: float # Time taken
    tokens_used: int          # LLM tokens consumed
    error: Optional[str]      # Error message if failed
```

---

## Agent Lifecycle

```
INITIALIZING → IDLE ⇄ PROCESSING → IDLE
                 │                    │
                 └──── LEARNING ──────┘
                 │
                 └──── ERROR ──── STOPPED
```

| Status | Description |
|--------|-------------|
| `INITIALIZING` | Loading models, connecting to services |
| `IDLE` | Ready to process requests |
| `PROCESSING` | Currently handling a request |
| `LEARNING` | Running training/adaptation cycle |
| `ERROR` | Encountered an error |
| `STOPPED` | Shut down |

---

## Orchestrator Agent

**File:** `agents/orchestrator.py`
**Name:** `orchestrator`

### Purpose
The master coordinator that routes all incoming user messages to the appropriate specialized agent. It analyzes intent, manages multi-agent workflows, and handles fallback scenarios.

### Capabilities
- Intent classification (keyword + LLM-based)
- Multi-agent workflow coordination
- Context-aware routing
- Fallback handling for ambiguous requests

### How Intent Classification Works

**Phase 1 — Keyword Matching:**
The orchestrator scores each agent based on keyword overlap with the user's message. Each agent has a set of keywords (e.g., financial: "money", "budget", "invest").

**Phase 2 — LLM Classification (fallback):**
If keyword matching is ambiguous (top scores are close), the LLM is asked to classify the intent explicitly.

### Keyword Categories

| Agent | Sample Keywords |
|-------|----------------|
| financial | money, spend, budget, invest, bank, salary, tax |
| health | exercise, workout, diet, sleep, weight, calories, mood |
| home | light, temperature, sensor, power, energy, smart home |
| communication | email, message, inbox, notification, reply |
| voice | speak, say, listen, audio, speech, transcribe |
| work | project, deadline, meeting, code, deploy, devops |
| report | report, pdf, excel, summary, analytics, chart |
| automation | automate, schedule, cron, trigger, workflow |
| learning | learn, train, improve, adapt, fine-tune |
| security | password, encrypt, protect, backup, firewall |
| memory | remember, recall, forget, history, remind |

### Example Interactions

```
User: "How much did I spend on food last week?"
→ Routed to: Financial Agent (keywords: spend, food)

User: "Turn off the bedroom lights"
→ Routed to: Home Agent (keywords: turn, lights, bedroom)

User: "How am I feeling today?"
→ Routed to: Health Agent (keywords: feeling)

User: "Tell me a joke"
→ Routed to: Personal Agent (fallback — general conversation)
```

---

## Personal Agent

**File:** `agents/personal_agent.py`
**Name:** `personal`

### Purpose
Your AI companion and trusted friend. Understands your personality, communication style, and preferences. Provides emotional support, advice, and casual conversation.

### Capabilities
- Adaptive communication style
- Emotional state detection
- Personality profiling
- Preference learning
- Thoughtful advice and companionship
- Context-aware casual conversation

### Available Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `general_chat` | Casual conversation | "How's it going?" |
| `advice` | Ask for personal advice | "What should I do about...?" |
| `emotional_support` | Emotional check-in | "I'm feeling stressed" |
| `preferences` | Share/recall preferences | "I love Italian food" |
| `about_me` | User profile queries | "What do you know about me?" |

### Example Interactions

```
User: "I had a rough day at work"
Nexus: "I'm sorry to hear that. Want to talk about what happened?
        Sometimes venting helps, and I'm here to listen. 
        If you'd like, I can also suggest some relaxation 
        techniques to help you unwind."

User: "What music do I like?"
Nexus: "Based on what you've shared, you enjoy lo-fi hip hop
        for working, rock for driving, and jazz for evenings.
        Last week you mentioned discovering a new indie band."
```

---

## Financial Agent

**File:** `agents/financial_agent.py`
**Name:** `financial`

### Purpose
Comprehensive financial management including expense tracking, budget analysis, investment insights, and personalized financial advice.

### Capabilities
- Expense tracking and categorization
- Budget management and monitoring
- Investment portfolio analysis
- Spending pattern detection
- Future expense prediction
- Financial report generation
- Savings goal tracking

### Available Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `add_expense` | Log an expense | "I spent $50 on groceries" |
| `add_income` | Log income | "I received $5000 salary" |
| `budget_status` | Check budget | "What's my budget looking like?" |
| `spending_analysis` | Analyze spending | "Where does my money go?" |
| `investment_advice` | Investment help | "Should I invest in index funds?" |
| `savings_goal` | Set/check goals | "How's my emergency fund?" |
| `financial_report` | Generate report | "Give me a monthly finance report" |

### Categories
`housing`, `food`, `transportation`, `healthcare`, `entertainment`, `education`, `savings`, `investments`, `utilities`, `insurance`, `clothing`, `personal`, `gifts`, `subscriptions`, `debt_payment`

### Example Interactions

```
User: "I spent $45 on groceries today"
Nexus: "Got it! I've logged $45.00 under Food. This month 
        you've spent $320 on food (80% of your $400 budget).
        You have $80 remaining with 10 days left."

User: "How can I save more money?"
Nexus: "Looking at your spending patterns, here are my 
        suggestions:
        1. Your subscription costs are $89/month — review 
           which ones you actively use
        2. Food spending is 15% above average — meal 
           planning could save ~$60/month
        3. Consider automating transfers of $200 to savings 
           on payday"
```

---

## Health Agent

**File:** `agents/health_agent.py`
**Name:** `health`

### Purpose
Comprehensive health and wellness management covering physical health, mental wellbeing, fitness, nutrition, and sleep tracking.

### Capabilities
- Physical metrics tracking (weight, heart rate, blood pressure, steps)
- Mental health monitoring (mood, stress, sleep quality)
- Exercise recommendations
- Nutrition planning
- Water intake tracking
- Health trend analysis
- Health report generation

### Available Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `log_metrics` | Log health data | "I weigh 72 kg today" |
| `log_mood` | Record mood | "I'm feeling great today" |
| `log_workout` | Record exercise | "I ran 5km in 30 minutes" |
| `log_water` | Track water | "I drank 2 glasses of water" |
| `health_status` | Check health | "How's my health this week?" |
| `exercise_plan` | Get workout plan | "Suggest a workout for today" |
| `nutrition_advice` | Diet advice | "What should I eat for lunch?" |
| `sleep_analysis` | Sleep insights | "How was my sleep this week?" |

### Example Interactions

```
User: "I did a 30-minute run this morning"
Nexus: "Great workout! 🏃 I've logged 30 minutes of running.
        That's 3 workouts this week — you're on track for 
        your goal of 4 per week. Your fitness streak is at 
        12 days! Keep it up!"

User: "I've been feeling stressed lately"
Nexus: "I've noticed your stress levels have been elevated 
        for 3 days. Here are some suggestions:
        1. Try a 10-minute guided meditation
        2. Take a short walk outside  
        3. Practice deep breathing (4-7-8 technique)
        Your mood tends to improve with exercise — want me 
        to schedule a workout?"
```

---

## Home Automation Agent

**File:** `agents/home_agent.py`
**Name:** `home`

### Purpose
Full smart home management including device control, environmental monitoring, power analytics, and automation rules. Communicates with ESP32 nodes via MQTT.

### Capabilities
- Device control (lights, fans, AC, locks)
- Environmental monitoring (temperature, humidity, air quality)
- Water tank level monitoring
- Power consumption tracking
- Scene management
- Usage pattern learning
- Anomaly detection (gas leaks, power spikes)
- Room-by-room status

### Available Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `control_device` | Toggle device | "Turn on the living room light" |
| `check_status` | Get status | "What's the temperature?" |
| `set_scene` | Activate scene | "Set movie night mode" |
| `energy_report` | Power data | "How much energy did I use today?" |
| `water_level` | Tank level | "What's the water tank level?" |
| `automation_rule` | Set rule | "Turn off lights at midnight" |
| `room_status` | Room info | "What's happening in the bedroom?" |

### MQTT Topics
Publishes to and subscribes from topics like `home/devices/{id}/control`, `home/sensors/{type}`, `home/scene/activate`.

### Example Interactions

```
User: "Turn on all lights in the living room"
Nexus: "Done! I've turned on all 4 lights in the living room.
        Current brightness is at 100%. The room temperature 
        is 24°C with 55% humidity."

User: "What's my energy usage today?"
Nexus: "Today's energy consumption: 5.8 kWh ($0.70)
        Top consumers:
        • AC: 2.1 kWh (36%)
        • Water Heater: 1.5 kWh (26%)
        • Lights: 0.8 kWh (14%)
        You're 12% below your daily average."
```

---

## Communication Agent

**File:** `agents/communication_agent.py`
**Name:** `communication`

### Purpose
Email and messaging hub. Manages inbox, drafts responses, summarizes emails, and handles notifications.

### Capabilities
- Email inbox management
- Smart email drafting
- Inbox summarization
- Priority email detection
- Reply suggestions
- Email forwarding

### Example Interactions

```
User: "Check my email"
Nexus: "You have 12 new emails since this morning:
        • 3 high priority (from your manager, client, HR)
        • 5 newsletters
        • 4 notifications
        Shall I summarize the important ones?"

User: "Draft a reply to the client email"
Nexus: "Here's a draft reply:
        'Hi [Client], Thank you for your feedback on the 
        project. I'll review the changes you suggested and 
        get back to you by Friday with an updated timeline.'
        Want me to adjust the tone or add anything?"
```

---

## Voice Agent

**File:** `agents/voice_agent.py`
**Name:** `voice`

### Purpose
Voice interface engine providing speech-to-text, text-to-speech, and wake-word detection.

### Capabilities
- Speech-to-text (OpenAI Whisper)
- Text-to-speech (Coqui TTS)
- Wake-word detection ("Nexus")
- Voice command processing
- Multi-language support

### Example Interactions

```
User: [Voice] "Nexus, what's the weather like?"
Nexus: [Speaks] "Currently it's 24 degrees and partly cloudy.  
        The forecast shows a high of 28 today with a chance 
        of rain in the evening."
```

---

## Work Agent

**File:** `agents/work_agent.py`
**Name:** `work`

### Purpose
Productivity assistant for project management, code assistance, DevOps monitoring, and work scheduling.

### Capabilities
- Project and task tracking
- Code review and assistance
- DevOps pipeline monitoring
- Meeting management
- Calendar scheduling
- Work-life balance tracking

### Example Interactions

```
User: "What's on my work schedule today?"
Nexus: "Today's work schedule:
        • 10:00 — Team standup (15 min)
        • 11:00 — Code review for PR #234
        • 14:00 — Sprint planning (1 hour)
        • 16:00 — Deploy staging build
        You have 2 tasks due today: API documentation 
        and bug fix for issue #89."
```

---

## Report Agent

**File:** `agents/report_agent.py`
**Name:** `report`

### Purpose
Generates professional PDF and Excel reports across all domains — finance, health, home, and productivity.

### Capabilities
- PDF report generation (ReportLab)
- Excel spreadsheet generation (openpyxl)
- Chart generation
- Multi-domain reports
- Scheduled report delivery
- Template-based formatting

### Report Types
| Type | Description |
|------|-------------|
| `financial_monthly` | Monthly income/expense analysis |
| `financial_annual` | Year-end financial summary |
| `health_weekly` | Weekly health metrics |
| `health_monthly` | Monthly health trends |
| `home_energy` | Energy consumption analysis |
| `productivity` | Task/project productivity metrics |
| `daily_briefing` | Combined daily summary |

### Example Interactions

```
User: "Generate my monthly finance report"
Nexus: "I've generated your January 2025 financial report.
        📊 Summary: Income $5,000 | Expenses $3,200 | 
        Saved $1,800 (36% savings rate)
        
        The PDF is ready at reports/financial_jan2025.pdf
        Shall I email it to you?"
```

---

## Automation Agent

**File:** `agents/automation_agent.py`
**Name:** `automation`

### Purpose
Workflow automation engine for scheduled tasks, event-driven triggers, and routine automation.

### Capabilities
- Cron-based job scheduling
- Event-driven triggers
- Multi-step workflow chains
- Batch operations
- Backup automation

### Example Interactions

```
User: "Schedule a backup every night at 2 AM"
Nexus: "Done! I've created an automated backup task:
        • Schedule: Daily at 2:00 AM
        • Action: Full database backup
        • Retention: Last 30 backups
        • Location: data/backups/"
```

---

## Learning Agent

**File:** `agents/learning_agent.py`
**Name:** `learning`

### Purpose
Manages the continuous learning pipeline — updating the personality model, fine-tuning embeddings, and adapting to user preferences.

### Capabilities
- Personality model updating
- Preference learning from interactions
- Embedding model fine-tuning
- Knowledge base expansion
- Communication style adaptation

### Example Interactions

```
User: "I prefer shorter, more direct responses"
Nexus: "Got it. I'll keep my responses concise and to the 
        point. I've updated my communication style 
        preferences for you."
```

---

## Memory Agent

**File:** `agents/memory_agent.py`
**Name:** `memory`

### Purpose
Long-term memory management using RAG (Retrieval-Augmented Generation). Stores and retrieves personal knowledge, past conversations, and user preferences.

### Capabilities
- Long-term information storage
- Contextual recall
- Knowledge base search (RAG + ChromaDB)
- Conversation history management
- Preference and fact extraction

### Example Interactions

```
User: "Remember that my anniversary is March 15th"
Nexus: "Noted! I'll remember your anniversary is on March 
        15th. I'll also set a reminder a week before so you 
        have time to plan something special."

User: "What's my favorite restaurant?"
Nexus: "Based on what you've shared, your favorite restaurant 
        is Olive Garden. You mentioned going there for 
        special occasions. You especially like their pasta 
        carbonara."
```

---

## Security Agent

**File:** `agents/security_agent.py`
**Name:** `security`

### Purpose
Security monitoring and management — data encryption, access control, threat detection, and backup management.

### Capabilities
- Data encryption (at rest)
- Access control management
- Threat/anomaly detection
- Password security auditing
- Backup integrity verification
- Security event logging

### Example Interactions

```
User: "Is my data secure?"
Nexus: "Here's your security status:
        ✅ Database encryption: Active
        ✅ Last backup: 2 hours ago (verified)
        ✅ No unauthorized access attempts
        ⚠️ Recommendation: Update your API key (90 days old)
        Overall security score: 92/100"
```

---

## Task Agent

**File:** `agents/task_agent.py`
**Name:** `task`

### Purpose
Task management with smart scheduling, priority handling, recurring tasks, and deadline tracking.

### Capabilities
- Task creation and management
- Priority-based scheduling
- Recurring task templates
- Deadline tracking and reminders
- Task categorization
- Productivity statistics

### Available Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `create_task` | Add new task | "Remind me to call the dentist" |
| `list_tasks` | View tasks | "What's on my todo list?" |
| `complete_task` | Mark done | "I finished the report" |
| `update_task` | Modify task | "Change the deadline to Friday" |
| `task_stats` | View stats | "How productive was I this week?" |

### Example Interactions

```
User: "Add a task to review the quarterly report by Friday"
Nexus: "Task created:
        📋 Review quarterly report
        📅 Due: Friday, Jan 17, 2025
        🔹 Priority: Medium
        📁 Category: Work
        
        You have 3 other tasks due this week. Want me to 
        prioritize them?"

User: "What tasks are overdue?"
Nexus: "You have 2 overdue tasks:
        1. Update project documentation (2 days overdue)
        2. Submit expense report (1 day overdue)
        
        Shall I reschedule them or mark them as completed?"
```
