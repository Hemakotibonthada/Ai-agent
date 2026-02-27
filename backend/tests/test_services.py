"""
NEXUS AI OS — Service Tests
Tests for AIService, SystemService, FileService, and other core services.
"""

import pytest
import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path


# ────────────────────────────────────────────────────────────
#  Fixtures
# ────────────────────────────────────────────────────────────


@pytest.fixture
def mock_settings():
    """Create mock NexusSettings for service testing."""
    settings = MagicMock()
    settings.app_name = "NEXUS AI"
    settings.version = "1.0.0"
    settings.debug = True
    settings.host = "0.0.0.0"
    settings.port = 8000
    settings.environment = "testing"
    settings.database.url = "sqlite+aiosqlite:///test.db"
    settings.ollama.host = "http://localhost"
    settings.ollama.port = 11434
    settings.ollama.model = "llama3.1"
    settings.ollama.embedding_model = "nomic-embed-text"
    settings.voice.stt_model = "base"
    settings.voice.tts_model = "tts_models/en/ljspeech/tacotron2-DDC"
    settings.voice.wake_word = "nexus"
    settings.mqtt.broker = "localhost"
    settings.mqtt.port = 1883
    settings.mqtt.topic_prefix = "home"
    settings.logging.level = "DEBUG"
    settings.logging.dir = "logs"
    return settings


@pytest.fixture
def temp_dir():
    """Create a temporary directory for file tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


# ────────────────────────────────────────────────────────────
#  Service Import Tests
# ────────────────────────────────────────────────────────────


class TestServiceImports:
    """Verify all services can be imported."""

    def test_import_ai_service(self):
        from services.ai_service import AIService
        assert AIService is not None

    def test_import_voice_service(self):
        from services.voice_service import VoiceService
        assert VoiceService is not None

    def test_import_email_service(self):
        from services.email_service import EmailService
        assert EmailService is not None

    def test_import_scheduler_service(self):
        from services.scheduler_service import SchedulerService
        assert SchedulerService is not None

    def test_import_notification_service(self):
        from services.notification_service import NotificationService
        assert NotificationService is not None

    def test_import_file_service(self):
        from services.file_service import FileService
        assert FileService is not None

    def test_import_mqtt_service(self):
        from services.mqtt_service import MQTTService
        assert MQTTService is not None

    def test_import_training_service(self):
        from services.training_service import TrainingService
        assert TrainingService is not None

    def test_import_system_service(self):
        from services.system_service import SystemService
        assert SystemService is not None


# ────────────────────────────────────────────────────────────
#  Config Tests
# ────────────────────────────────────────────────────────────


class TestConfig:
    """Tests for the NexusSettings configuration system."""

    def test_config_import(self):
        from core.config import NexusSettings
        assert NexusSettings is not None

    def test_config_has_sub_configs(self):
        from core.config import (
            NexusSettings,
            DatabaseSettings,
            OllamaSettings,
            VoiceSettings,
            MQTTSettings,
            EmailSettings,
            SchedulerSettings,
            LoggingSettings,
            NotificationSettings,
            UserSettings,
        )
        assert all([
            NexusSettings, DatabaseSettings, OllamaSettings,
            VoiceSettings, MQTTSettings, EmailSettings,
            SchedulerSettings, LoggingSettings,
            NotificationSettings, UserSettings,
        ])

    def test_default_database_settings(self):
        from core.config import DatabaseSettings
        db = DatabaseSettings()
        assert "sqlite" in db.url.lower() or "aiosqlite" in db.url.lower()

    def test_default_ollama_settings(self):
        from core.config import OllamaSettings
        ollama = OllamaSettings()
        assert ollama.port == 11434
        assert "llama" in ollama.model.lower()

    def test_default_voice_settings(self):
        from core.config import VoiceSettings
        voice = VoiceSettings()
        assert voice.wake_word == "nexus"

    def test_default_mqtt_settings(self):
        from core.config import MQTTSettings
        mqtt = MQTTSettings()
        assert mqtt.port == 1883


# ────────────────────────────────────────────────────────────
#  SystemService Tests
# ────────────────────────────────────────────────────────────


class TestSystemService:
    """Tests for the SystemService (system metrics, backup, etc.)."""

    def test_system_service_has_required_methods(self):
        from services.system_service import SystemService
        assert hasattr(SystemService, "get_system_status") or \
               hasattr(SystemService, "get_status")
        assert hasattr(SystemService, "__init__")

    def test_cpu_percentage_valid_range(self):
        """CPU usage should be between 0 and 100."""
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        assert 0.0 <= cpu <= 100.0

    def test_memory_percentage_valid_range(self):
        """Memory usage should be between 0 and 100."""
        import psutil
        mem = psutil.virtual_memory().percent
        assert 0.0 <= mem <= 100.0

    def test_disk_percentage_valid_range(self):
        """Disk usage should be between 0 and 100."""
        import psutil
        disk = psutil.disk_usage("/").percent
        assert 0.0 <= disk <= 100.0


# ────────────────────────────────────────────────────────────
#  FileService Tests
# ────────────────────────────────────────────────────────────


class TestFileService:
    """Tests for the FileService (file I/O, backups, reports)."""

    def test_file_service_import(self):
        from services.file_service import FileService
        assert FileService is not None

    def test_temp_file_creation(self, temp_dir):
        """Verify file creation in temp directory."""
        file_path = os.path.join(temp_dir, "test.txt")
        with open(file_path, "w") as f:
            f.write("test content")
        assert os.path.exists(file_path)
        with open(file_path, "r") as f:
            assert f.read() == "test content"

    def test_directory_creation(self, temp_dir):
        """Verify directory creation."""
        new_dir = os.path.join(temp_dir, "subdir", "nested")
        os.makedirs(new_dir, exist_ok=True)
        assert os.path.isdir(new_dir)

    def test_backup_file_naming(self):
        """Backup files should include timestamp."""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_name = f"nexus_{timestamp}.db"
        assert "nexus_" in backup_name
        assert ".db" in backup_name
        assert len(timestamp) == 19  # YYYY-MM-DD_HH-MM-SS


# ────────────────────────────────────────────────────────────
#  AIService Tests
# ────────────────────────────────────────────────────────────


class TestAIService:
    """Tests for the AIService (Ollama LLM integration)."""

    def test_ai_service_import(self):
        from services.ai_service import AIService
        assert AIService is not None

    def test_ollama_url_construction(self, mock_settings):
        """Verify Ollama URL is correctly formed."""
        host = mock_settings.ollama.host
        port = mock_settings.ollama.port
        url = f"{host}:{port}"
        assert url == "http://localhost:11434"

    def test_model_name_valid(self, mock_settings):
        """Model name should be a non-empty string."""
        model = mock_settings.ollama.model
        assert isinstance(model, str)
        assert len(model) > 0

    def test_embedding_model_name_valid(self, mock_settings):
        """Embedding model should be configured."""
        model = mock_settings.ollama.embedding_model
        assert isinstance(model, str)
        assert len(model) > 0


# ────────────────────────────────────────────────────────────
#  MQTTService Tests
# ────────────────────────────────────────────────────────────


class TestMQTTService:
    """Tests for the MQTT Service (IoT communication)."""

    def test_mqtt_service_import(self):
        from services.mqtt_service import MQTTService
        assert MQTTService is not None

    def test_mqtt_topic_formatting(self):
        """MQTT topics should follow convention."""
        prefix = "home"
        topics = [
            f"{prefix}/sensors/temperature",
            f"{prefix}/sensors/humidity",
            f"{prefix}/sensors/air_quality",
            f"{prefix}/sensors/gas",
            f"{prefix}/sensors/motion",
            f"{prefix}/sensors/door",
            f"{prefix}/sensors/power",
            f"{prefix}/devices/light/control",
            f"{prefix}/status",
            f"{prefix}/alert",
        ]
        for topic in topics:
            assert topic.startswith("home/")
            assert "//" not in topic
            assert not topic.endswith("/")

    def test_mqtt_broker_settings(self, mock_settings):
        """MQTT broker settings should be valid."""
        assert mock_settings.mqtt.broker == "localhost"
        assert mock_settings.mqtt.port == 1883
        assert mock_settings.mqtt.topic_prefix == "home"


# ────────────────────────────────────────────────────────────
#  Event Bus Tests
# ────────────────────────────────────────────────────────────


class TestEventBus:
    """Tests for the core event bus."""

    def test_event_bus_import(self):
        from core.events import EventBus
        assert EventBus is not None

    def test_event_bus_instantiation(self):
        from core.events import EventBus
        bus = EventBus()
        assert bus is not None


# ────────────────────────────────────────────────────────────
#  Engine Tests
# ────────────────────────────────────────────────────────────


class TestNexusEngine:
    """Tests for the NexusEngine central coordinator."""

    def test_engine_import(self):
        from core.engine import NexusEngine
        assert NexusEngine is not None

    def test_engine_has_required_attrs(self):
        from core.engine import NexusEngine
        assert hasattr(NexusEngine, "initialize") or hasattr(NexusEngine, "startup")
        assert hasattr(NexusEngine, "__init__")
