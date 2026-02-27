# NEXUS AI - Database Models
"""
SQLAlchemy ORM models for all NEXUS AI data entities.
Covers user profiles, conversations, agents, home automation,
financial records, health metrics, and system logs.
"""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, JSON, Enum as SQLEnum, Index, Table,
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
import enum


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


# ============================================================
# Enums
# ============================================================

class AgentType(str, enum.Enum):
    ORCHESTRATOR = "orchestrator"
    PERSONAL = "personal"
    FINANCIAL = "financial"
    HEALTH = "health"
    HOME = "home"
    COMMUNICATION = "communication"
    VOICE = "voice"
    WORK = "work"
    REPORT = "report"
    AUTOMATION = "automation"
    LEARNING = "learning"
    SECURITY = "security"
    MEMORY = "memory"
    TASK = "task"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    AGENT = "agent"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DeviceType(str, enum.Enum):
    LIGHT = "light"
    SWITCH = "switch"
    SENSOR = "sensor"
    THERMOSTAT = "thermostat"
    CAMERA = "camera"
    LOCK = "lock"
    FAN = "fan"
    APPLIANCE = "appliance"
    WATER_SENSOR = "water_sensor"
    GAS_SENSOR = "gas_sensor"
    AIR_QUALITY = "air_quality"
    POWER_METER = "power_meter"


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    INVESTMENT = "investment"
    SAVINGS = "savings"
    TRANSFER = "transfer"


class HealthMetricType(str, enum.Enum):
    WEIGHT = "weight"
    HEART_RATE = "heart_rate"
    BLOOD_PRESSURE = "blood_pressure"
    SLEEP = "sleep"
    STEPS = "steps"
    CALORIES = "calories"
    WATER_INTAKE = "water_intake"
    MOOD = "mood"
    STRESS = "stress"
    EXERCISE = "exercise"


class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    REMINDER = "reminder"
    ALERT = "alert"


# ============================================================
# User & Profile Models
# ============================================================

class UserProfile(Base):
    """User profile with comprehensive personal information."""
    __tablename__ = "user_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    date_of_birth: Mapped[Optional[datetime]] = mapped_column(DateTime)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    language: Mapped[str] = mapped_column(String(10), default="en")
    occupation: Mapped[Optional[str]] = mapped_column(String(100))
    skills: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    education: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    personality_traits: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    communication_style: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    financial_goals: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    health_goals: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    work_preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    avatar_path: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    financial_records = relationship("FinancialRecord", back_populates="user", cascade="all, delete-orphan")
    health_metrics = relationship("HealthMetric", back_populates="user", cascade="all, delete-orphan")


class PersonalityModel(Base):
    """Learned personality model for response generation."""
    __tablename__ = "personality_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    model_version: Mapped[int] = mapped_column(Integer, default=1)
    writing_style: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    vocabulary_patterns: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    response_patterns: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    emotional_patterns: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    topic_preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    tone_analysis: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    training_data_count: Mapped[int] = mapped_column(Integer, default=0)
    accuracy_score: Mapped[Optional[float]] = mapped_column(Float)
    last_trained: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================
# Conversation & Memory Models
# ============================================================

class Conversation(Base):
    """Chat conversation session."""
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    title: Mapped[Optional[str]] = mapped_column(String(200))
    agent_type: Mapped[str] = mapped_column(String(50), default="personal")
    context: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("UserProfile", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                          order_by="Message.created_at")

    __table_args__ = (
        Index("idx_conv_user_id", "user_id"),
        Index("idx_conv_created", "created_at"),
    )


class Message(Base):
    """Individual message in a conversation."""
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(20), default="user")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agent_name: Mapped[Optional[str]] = mapped_column(String(50))
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer)
    processing_time_ms: Mapped[Optional[float]] = mapped_column(Float)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_msg_conv_id", "conversation_id"),
        Index("idx_msg_created", "created_at"),
        Index("idx_msg_role", "role"),
    )


class Memory(Base):
    """Long-term memory storage for the AI."""
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.5)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(100))
    source: Mapped[Optional[str]] = mapped_column(String(100))
    context: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    last_accessed: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_mem_user_id", "user_id"),
        Index("idx_mem_category", "category"),
        Index("idx_mem_importance", "importance"),
    )


# ============================================================
# Task Management Models
# ============================================================

class Task(Base):
    """Task/todo item."""
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.PENDING.value)
    priority: Mapped[str] = mapped_column(String(20), default=TaskPriority.MEDIUM.value)
    category: Mapped[Optional[str]] = mapped_column(String(50))
    assigned_agent: Mapped[Optional[str]] = mapped_column(String(50))
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    estimated_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    actual_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    tags: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    result: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    parent_task_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("tasks.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("UserProfile", back_populates="tasks")
    subtasks = relationship("Task", backref="parent_task", remote_side="Task.id")

    __table_args__ = (
        Index("idx_task_user_id", "user_id"),
        Index("idx_task_status", "status"),
        Index("idx_task_priority", "priority"),
        Index("idx_task_due_date", "due_date"),
    )


# ============================================================
# Home Automation Models
# ============================================================

class HomeDevice(Base):
    """Smart home device."""
    __tablename__ = "home_devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_type: Mapped[str] = mapped_column(String(30), nullable=False)
    room: Mapped[Optional[str]] = mapped_column(String(50))
    mqtt_topic: Mapped[Optional[str]] = mapped_column(String(200))
    esp32_id: Mapped[Optional[str]] = mapped_column(String(50))
    state: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime)
    firmware_version: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    readings = relationship("SensorReading", back_populates="device", cascade="all, delete-orphan")
    automations = relationship("HomeAutomation", back_populates="device", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_device_type", "device_type"),
        Index("idx_device_room", "room"),
    )


class SensorReading(Base):
    """Sensor data reading from home devices."""
    __tablename__ = "sensor_readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("home_devices.id"))
    sensor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    device = relationship("HomeDevice", back_populates="readings")

    __table_args__ = (
        Index("idx_reading_device", "device_id"),
        Index("idx_reading_type", "sensor_type"),
        Index("idx_reading_timestamp", "timestamp"),
    )


class HomeAutomation(Base):
    """Home automation rules and schedules."""
    __tablename__ = "home_automations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), ForeignKey("home_devices.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(30), nullable=False)  # time, sensor, event
    trigger_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    action_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered: Mapped[Optional[datetime]] = mapped_column(DateTime)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    device = relationship("HomeDevice", back_populates="automations")


class PowerUsage(Base):
    """Power consumption tracking."""
    __tablename__ = "power_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("home_devices.id"))
    watts: Mapped[float] = mapped_column(Float, nullable=False)
    kilowatt_hours: Mapped[Optional[float]] = mapped_column(Float)
    cost_estimate: Mapped[Optional[float]] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_power_device", "device_id"),
        Index("idx_power_timestamp", "timestamp"),
    )


# ============================================================
# Financial Models
# ============================================================

class FinancialRecord(Base):
    """Financial transaction record."""
    __tablename__ = "financial_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    subcategory: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    tags: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_pattern: Mapped[Optional[str]] = mapped_column(String(50))
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("UserProfile", back_populates="financial_records")

    __table_args__ = (
        Index("idx_fin_user_id", "user_id"),
        Index("idx_fin_type", "transaction_type"),
        Index("idx_fin_category", "category"),
        Index("idx_fin_date", "date"),
    )


class FinancialGoal(Base):
    """Financial goal tracking."""
    __tablename__ = "financial_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[float] = mapped_column(Float, nullable=False)
    current_amount: Mapped[float] = mapped_column(Float, default=0.0)
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime)
    category: Mapped[str] = mapped_column(String(50), default="general")
    strategy: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Budget(Base):
    """Monthly budget tracking."""
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    budget_amount: Mapped[float] = mapped_column(Float, nullable=False)
    spent_amount: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_budget_user_month", "user_id", "month", "year"),
    )


# ============================================================
# Health & Wellness Models
# ============================================================

class HealthMetric(Base):
    """Health and wellness metric."""
    __tablename__ = "health_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    metric_type: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(String(50))
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("UserProfile", back_populates="health_metrics")

    __table_args__ = (
        Index("idx_health_user_id", "user_id"),
        Index("idx_health_type", "metric_type"),
        Index("idx_health_recorded", "recorded_at"),
    )


class MoodEntry(Base):
    """Daily mood and mental health tracking."""
    __tablename__ = "mood_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    energy_level: Mapped[Optional[int]] = mapped_column(Integer)  # 1-10
    stress_level: Mapped[Optional[int]] = mapped_column(Integer)  # 1-10
    sleep_hours: Mapped[Optional[float]] = mapped_column(Float)
    sleep_quality: Mapped[Optional[int]] = mapped_column(Integer)  # 1-10
    notes: Mapped[Optional[str]] = mapped_column(Text)
    activities: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    triggers: Mapped[Optional[dict]] = mapped_column(JSON, default=list)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_mood_user_id", "user_id"),
        Index("idx_mood_recorded", "recorded_at"),
    )


# ============================================================
# Communication Models
# ============================================================

class EmailRecord(Base):
    """Email tracking record."""
    __tablename__ = "email_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    email_id: Mapped[Optional[str]] = mapped_column(String(200))
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # inbound/outbound
    sender: Mapped[str] = mapped_column(String(200), nullable=False)
    recipients: Mapped[dict] = mapped_column(JSON, nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_preview: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_replied: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply_content: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[Optional[str]] = mapped_column(String(50))
    priority: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_email_user_id", "user_id"),
        Index("idx_email_direction", "direction"),
        Index("idx_email_received", "received_at"),
    )


class ChatMessage(Base):
    """External chat message (Slack, Teams, etc.)."""
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    platform: Mapped[str] = mapped_column(String(30), nullable=False)
    channel: Mapped[Optional[str]] = mapped_column(String(100))
    sender: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    auto_replied: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_reply_content: Mapped[Optional[str]] = mapped_column(Text)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_chat_user_id", "user_id"),
        Index("idx_chat_platform", "platform"),
    )


# ============================================================
# System & Logging Models
# ============================================================

class ActivityLog(Base):
    """System activity log."""
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    agent_name: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="success")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_activity_type", "activity_type"),
        Index("idx_activity_agent", "agent_name"),
        Index("idx_activity_created", "created_at"),
    )


class TrainingLog(Base):
    """AI model training log."""
    __tablename__ = "training_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False)
    epoch: Mapped[int] = mapped_column(Integer, nullable=False)
    total_epochs: Mapped[int] = mapped_column(Integer, nullable=False)
    loss: Mapped[float] = mapped_column(Float, nullable=False)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    training_data_size: Mapped[Optional[int]] = mapped_column(Integer)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="running")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_training_model", "model_name"),
        Index("idx_training_status", "status"),
    )


class AgentState(Base):
    """Persistent agent state storage."""
    __tablename__ = "agent_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    agent_type: Mapped[str] = mapped_column(String(30), nullable=False)
    state_data: Mapped[dict] = mapped_column(JSON, default=dict)
    config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_action: Mapped[Optional[str]] = mapped_column(String(200))
    last_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """System notification."""
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(20), default=NotificationType.INFO.value)
    source_agent: Mapped[Optional[str]] = mapped_column(String(50))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    action_url: Mapped[Optional[str]] = mapped_column(String(500))
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_notif_user_id", "user_id"),
        Index("idx_notif_read", "is_read"),
        Index("idx_notif_created", "created_at"),
    )


class Report(Base):
    """Generated report record."""
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_profiles.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    report_type: Mapped[str] = mapped_column(String(30), nullable=False)  # financial, health, home, etc.
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # md, pdf, xlsx
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_report_user_id", "user_id"),
        Index("idx_report_type", "report_type"),
    )
