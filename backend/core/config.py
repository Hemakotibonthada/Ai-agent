# NEXUS AI - Configuration Management
"""
Centralized configuration management using Pydantic Settings.
Loads from environment variables and .env file.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database configuration."""
    model_config = SettingsConfigDict(env_prefix="NEXUS_")

    db_path: str = Field(default="./data/nexus.db", description="SQLite database path")
    vector_db_path: str = Field(default="./data/chromadb", description="ChromaDB path")
    backup_path: str = Field(default="./data/backups", description="Backup directory")


class OllamaSettings(BaseSettings):
    """Ollama AI model configuration."""
    model_config = SettingsConfigDict(env_prefix="OLLAMA_")

    base_url: str = Field(default="http://localhost:11434", description="Ollama API URL")
    model: str = Field(default="llama3.1", description="Primary LLM model")
    embedding_model: str = Field(default="nomic-embed-text", description="Embedding model")
    vision_model: str = Field(default="llava", description="Vision model")
    timeout: int = Field(default=120, description="Request timeout in seconds")
    max_retries: int = Field(default=3, description="Maximum retry attempts")


class VoiceSettings(BaseSettings):
    """Voice engine configuration."""
    model_config = SettingsConfigDict(env_prefix="VOICE_")

    tts_model: str = Field(
        default="tts_models/en/ljspeech/tacotron2-DDC",
        description="Text-to-speech model"
    )
    stt_model: str = Field(default="base", description="Speech-to-text model (whisper)")
    wake_word: str = Field(default="nexus", description="Wake word for activation")
    language: str = Field(default="en", description="Voice language")
    sample_rate: int = Field(default=22050, description="Audio sample rate")
    channels: int = Field(default=1, description="Audio channels")


class MQTTSettings(BaseSettings):
    """MQTT broker configuration for home automation."""
    model_config = SettingsConfigDict(env_prefix="MQTT_")

    broker_host: str = Field(default="localhost", description="MQTT broker hostname")
    broker_port: int = Field(default=1883, description="MQTT broker port")
    username: str = Field(default="nexus", description="MQTT username")
    password: str = Field(default="nexus_mqtt_password", description="MQTT password")
    topic_prefix: str = Field(default="nexus/home", description="Root topic prefix")
    keepalive: int = Field(default=60, description="Keepalive interval")
    qos: int = Field(default=1, description="Quality of Service level")


class EmailSettings(BaseSettings):
    """Email configuration."""
    model_config = SettingsConfigDict(env_prefix="EMAIL_")

    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP server")
    smtp_port: int = Field(default=587, description="SMTP port")
    username: str = Field(default="", description="Email username")
    password: str = Field(default="", description="Email password/app password")
    imap_host: str = Field(default="imap.gmail.com", description="IMAP server")
    imap_port: int = Field(default=993, description="IMAP port")
    check_interval: int = Field(default=300, description="Check interval in seconds")


class SchedulerSettings(BaseSettings):
    """Task scheduler configuration."""
    model_config = SettingsConfigDict(env_prefix="")

    training_schedule_hour: int = Field(default=3, description="Daily training hour")
    training_schedule_minute: int = Field(default=0, description="Daily training minute")
    backup_schedule_hour: int = Field(default=2, description="Daily backup hour")
    backup_schedule_minute: int = Field(default=0, description="Daily backup minute")


class LoggingSettings(BaseSettings):
    """Logging configuration."""
    model_config = SettingsConfigDict(env_prefix="LOG_")

    level: str = Field(default="DEBUG", description="Log level")
    file_path: str = Field(default="./logs/nexus.log", description="Log file path")
    max_size: str = Field(default="10MB", description="Maximum log file size")
    rotation: str = Field(default="1 day", description="Log rotation interval")
    retention: str = Field(default="30 days", description="Log retention period")
    format: str = Field(
        default="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} | {message}",
        description="Log format string"
    )


class NotificationSettings(BaseSettings):
    """Notification configuration."""
    model_config = SettingsConfigDict(env_prefix="NOTIFICATION_")

    enabled: bool = Field(default=True, description="Enable notifications")
    sound: bool = Field(default=True, description="Enable sound notifications")
    desktop: bool = Field(default=True, description="Enable desktop notifications")


class UserSettings(BaseSettings):
    """User profile configuration."""
    model_config = SettingsConfigDict(env_prefix="USER_")

    name: str = Field(default="User", description="User's name")
    timezone: str = Field(default="UTC", description="User's timezone")
    language: str = Field(default="en", description="Preferred language")


class NexusSettings(BaseSettings):
    """
    Master configuration class for NEXUS AI.
    Aggregates all sub-configurations.
    """
    model_config = SettingsConfigDict(
        env_prefix="NEXUS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    app_name: str = Field(default="NEXUS AI", description="Application name")
    version: str = Field(default="1.0.0", description="Application version")
    env: str = Field(default="development", description="Environment")
    debug: bool = Field(default=True, description="Debug mode")
    secret_key: str = Field(default="nexus-dev-secret-key", description="Secret key")
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")

    # Sub-configurations
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    ollama: OllamaSettings = Field(default_factory=OllamaSettings)
    voice: VoiceSettings = Field(default_factory=VoiceSettings)
    mqtt: MQTTSettings = Field(default_factory=MQTTSettings)
    email: EmailSettings = Field(default_factory=EmailSettings)
    scheduler: SchedulerSettings = Field(default_factory=SchedulerSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    notification: NotificationSettings = Field(default_factory=NotificationSettings)
    user: UserSettings = Field(default_factory=UserSettings)

    @property
    def data_dir(self) -> Path:
        """Get or create data directory."""
        path = Path(self.database.db_path).parent
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def logs_dir(self) -> Path:
        """Get or create logs directory."""
        path = Path(self.logging.file_path).parent
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def is_development(self) -> bool:
        return self.env == "development"


# Global settings instance
settings = NexusSettings()


def get_settings() -> NexusSettings:
    """Dependency injection helper for FastAPI."""
    return settings
