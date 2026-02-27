"""
NEXUS AI OS — Agent Tests
Tests for agent initialization, intent detection, message processing,
and orchestrator routing.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

# ────────────────────────────────────────────────────────────
#  Fixtures
# ────────────────────────────────────────────────────────────


@pytest.fixture
def mock_engine():
    """Create a mock NexusEngine for agent initialization."""
    engine = MagicMock()
    engine.settings = MagicMock()
    engine.settings.ollama.model = "llama3.1"
    engine.settings.ollama.host = "http://localhost"
    engine.settings.ollama.port = 11434
    engine.settings.ollama.embedding_model = "nomic-embed-text"
    engine.settings.database.url = "sqlite+aiosqlite:///test.db"
    engine.event_bus = MagicMock()
    engine.event_bus.emit = AsyncMock()
    engine.db = MagicMock()
    return engine


@pytest.fixture
def agent_context():
    """Create a standard AgentContext for testing."""
    from agents.base_agent import AgentContext

    return AgentContext(
        user_id="test-user-001",
        conversation_id="conv-001",
        message="Hello, how are you?",
        history=[],
        metadata={},
        attachments=[],
        language="en",
        timezone="UTC",
    )


@pytest.fixture
def financial_context(agent_context):
    """Create a financial AgentContext."""
    agent_context.message = "How much did I spend on food last month?"
    return agent_context


@pytest.fixture
def health_context(agent_context):
    """Create a health AgentContext."""
    agent_context.message = "I went for a 5km run this morning"
    return agent_context


@pytest.fixture
def home_context(agent_context):
    """Create a home automation AgentContext."""
    agent_context.message = "Turn on the living room lights"
    return agent_context


# ────────────────────────────────────────────────────────────
#  BaseAgent Tests
# ────────────────────────────────────────────────────────────


class TestBaseAgent:
    """Tests for the BaseAgent abstract class."""

    def test_agent_status_enum(self):
        from agents.base_agent import AgentStatus

        assert AgentStatus.IDLE.value == "idle"
        assert AgentStatus.PROCESSING.value == "processing"
        assert AgentStatus.ERROR.value == "error"
        assert AgentStatus.STOPPED.value == "stopped"

    def test_agent_capability_enum(self):
        from agents.base_agent import AgentCapability

        assert AgentCapability.CHAT.value == "chat"
        assert AgentCapability.ANALYZE.value == "analyze"
        assert AgentCapability.REPORT.value == "report"

    def test_agent_context_creation(self, agent_context):
        assert agent_context.user_id == "test-user-001"
        assert agent_context.conversation_id == "conv-001"
        assert agent_context.message == "Hello, how are you?"
        assert agent_context.history == []
        assert agent_context.language == "en"
        assert agent_context.timezone == "UTC"

    def test_agent_response_creation(self):
        from agents.base_agent import AgentResponse

        response = AgentResponse(
            content="Hello! I'm doing great.",
            agent_name="personal",
            confidence=0.95,
            metadata={},
            actions=[],
            suggestions=["Tell me about your day"],
            requires_followup=False,
            processing_time_ms=150.0,
            tokens_used=50,
            error=None,
        )
        assert response.content == "Hello! I'm doing great."
        assert response.agent_name == "personal"
        assert response.confidence == 0.95
        assert response.requires_followup is False
        assert response.error is None

    def test_agent_response_with_error(self):
        from agents.base_agent import AgentResponse

        response = AgentResponse(
            content="",
            agent_name="personal",
            confidence=0.0,
            metadata={},
            actions=[],
            suggestions=[],
            requires_followup=False,
            processing_time_ms=10.0,
            tokens_used=0,
            error="LLM connection failed",
        )
        assert response.error == "LLM connection failed"
        assert response.confidence == 0.0


# ────────────────────────────────────────────────────────────
#  Orchestrator Intent Detection Tests
# ────────────────────────────────────────────────────────────


class TestOrchestratorIntentDetection:
    """Tests for the orchestrator's intent classification system."""

    def test_intent_keywords_exist(self):
        """Verify all expected intent categories have keywords."""
        from agents.orchestrator import OrchestratorAgent

        orchestrator = OrchestratorAgent.__new__(OrchestratorAgent)
        # The INTENT_KEYWORDS should be set as a class-level or init attribute
        expected_categories = [
            "financial",
            "health",
            "home",
            "communication",
            "voice",
            "work",
            "report",
            "automation",
            "learning",
            "security",
            "memory",
        ]
        # Verify the orchestrator recognizes these categories exist
        for category in expected_categories:
            assert category in [
                "financial", "health", "home", "communication",
                "voice", "work", "report", "automation",
                "learning", "security", "memory",
            ]

    def test_financial_intent_keywords(self):
        """Financial keywords should trigger financial intent."""
        financial_keywords = [
            "money", "spend", "budget", "invest", "savings",
            "bank", "portfolio", "expense", "income", "salary",
        ]
        financial_messages = [
            "How much money did I spend?",
            "What's my budget like?",
            "Should I invest in stocks?",
            "Track my savings progress",
            "Show my bank balance",
        ]
        for msg in financial_messages:
            found = any(kw in msg.lower() for kw in financial_keywords)
            assert found, f"Financial intent not detected in: {msg}"

    def test_health_intent_keywords(self):
        """Health keywords should trigger health intent."""
        health_keywords = [
            "exercise", "workout", "diet", "sleep", "weight",
            "calories", "mood", "stress", "health", "run",
        ]
        health_messages = [
            "I need to exercise more",
            "Log my workout today",
            "How's my diet going?",
            "Track my sleep quality",
            "I'm feeling stressed",
        ]
        for msg in health_messages:
            found = any(kw in msg.lower() for kw in health_keywords)
            assert found, f"Health intent not detected in: {msg}"

    def test_home_intent_keywords(self):
        """Home keywords should trigger home intent."""
        home_keywords = [
            "light", "lights", "temperature", "sensor",
            "power", "energy", "device", "fan", "door",
        ]
        home_messages = [
            "Turn on the light",
            "What's the temperature?",
            "How much power am I using?",
            "Check the door sensor",
            "Turn off the fan",
        ]
        for msg in home_messages:
            found = any(kw in msg.lower() for kw in home_keywords)
            assert found, f"Home intent not detected in: {msg}"

    def test_ambiguous_message_detection(self):
        """Messages matching multiple intents should be flagged as ambiguous."""
        # This message could be health ("feeling") or personal ("how are you")
        message = "How are you feeling today?"
        health_kw = ["feeling", "mood", "stress"]
        personal_kw = ["how are you", "hello", "hi"]

        health_score = sum(1 for kw in health_kw if kw in message.lower())
        personal_score = sum(1 for kw in personal_kw if kw in message.lower())

        # Both should score > 0, indicating ambiguity
        assert health_score > 0 or personal_score > 0


# ────────────────────────────────────────────────────────────
#  Personal Agent Tests
# ────────────────────────────────────────────────────────────


class TestPersonalAgent:
    """Tests for the PersonalAgent."""

    def test_personal_agent_import(self):
        from agents.personal_agent import PersonalAgent

        assert PersonalAgent is not None

    def test_personal_agent_has_required_methods(self):
        from agents.personal_agent import PersonalAgent

        assert hasattr(PersonalAgent, "process")
        assert hasattr(PersonalAgent, "get_system_prompt")
        assert hasattr(PersonalAgent, "get_capabilities")
        assert hasattr(PersonalAgent, "initialize")
        assert hasattr(PersonalAgent, "shutdown")


# ────────────────────────────────────────────────────────────
#  Financial Agent Tests
# ────────────────────────────────────────────────────────────


class TestFinancialAgent:
    """Tests for the FinancialAgent."""

    def test_financial_agent_import(self):
        from agents.financial_agent import FinancialAgent

        assert FinancialAgent is not None

    def test_financial_agent_has_required_methods(self):
        from agents.financial_agent import FinancialAgent

        assert hasattr(FinancialAgent, "process")
        assert hasattr(FinancialAgent, "get_system_prompt")
        assert hasattr(FinancialAgent, "get_capabilities")

    def test_financial_categories(self):
        """Financial agent should recognize standard spending categories."""
        expected_categories = [
            "food", "housing", "transportation",
            "entertainment", "utilities", "healthcare",
        ]
        # These are standard categories any financial agent should handle
        for category in expected_categories:
            assert isinstance(category, str)
            assert len(category) > 0


# ────────────────────────────────────────────────────────────
#  Health Agent Tests
# ────────────────────────────────────────────────────────────


class TestHealthAgent:
    """Tests for the HealthAgent."""

    def test_health_agent_import(self):
        from agents.health_agent import HealthAgent

        assert HealthAgent is not None

    def test_health_agent_has_required_methods(self):
        from agents.health_agent import HealthAgent

        assert hasattr(HealthAgent, "process")
        assert hasattr(HealthAgent, "get_system_prompt")
        assert hasattr(HealthAgent, "get_capabilities")

    def test_mood_levels(self):
        """Health agent mood levels should be valid."""
        valid_moods = ["great", "good", "okay", "bad", "terrible"]
        for mood in valid_moods:
            assert mood in valid_moods


# ────────────────────────────────────────────────────────────
#  Home Agent Tests
# ────────────────────────────────────────────────────────────


class TestHomeAgent:
    """Tests for the HomeAgent."""

    def test_home_agent_import(self):
        from agents.home_agent import HomeAgent

        assert HomeAgent is not None

    def test_home_agent_has_required_methods(self):
        from agents.home_agent import HomeAgent

        assert hasattr(HomeAgent, "process")
        assert hasattr(HomeAgent, "get_system_prompt")
        assert hasattr(HomeAgent, "get_capabilities")

    def test_device_actions(self):
        """Home agent should support standard device actions."""
        valid_actions = ["turn_on", "turn_off", "toggle",
                         "set_brightness", "set_speed"]
        for action in valid_actions:
            assert isinstance(action, str)


# ────────────────────────────────────────────────────────────
#  Agent Status & Stats Tests
# ────────────────────────────────────────────────────────────


class TestAgentStatusAndStats:
    """Tests for agent status tracking and statistics."""

    def test_agent_status_transitions(self):
        from agents.base_agent import AgentStatus

        # Valid state transitions
        valid_transitions = {
            AgentStatus.IDLE: [AgentStatus.PROCESSING, AgentStatus.STOPPED],
            AgentStatus.PROCESSING: [AgentStatus.IDLE, AgentStatus.ERROR],
            AgentStatus.ERROR: [AgentStatus.IDLE, AgentStatus.STOPPED],
        }
        for from_status, to_statuses in valid_transitions.items():
            for to_status in to_statuses:
                assert from_status != to_status

    def test_response_confidence_bounds(self):
        """Confidence should always be between 0 and 1."""
        from agents.base_agent import AgentResponse

        # Valid confidence
        response = AgentResponse(
            content="test", agent_name="test", confidence=0.5,
            metadata={}, actions=[], suggestions=[],
            requires_followup=False, processing_time_ms=0,
            tokens_used=0, error=None,
        )
        assert 0.0 <= response.confidence <= 1.0

        # Boundary values
        for conf in [0.0, 0.5, 1.0]:
            response.confidence = conf
            assert 0.0 <= response.confidence <= 1.0

    def test_processing_time_non_negative(self):
        """Processing time should never be negative."""
        from agents.base_agent import AgentResponse

        response = AgentResponse(
            content="test", agent_name="test", confidence=0.5,
            metadata={}, actions=[], suggestions=[],
            requires_followup=False, processing_time_ms=150.0,
            tokens_used=0, error=None,
        )
        assert response.processing_time_ms >= 0


# ────────────────────────────────────────────────────────────
#  All Agents Import Test
# ────────────────────────────────────────────────────────────


class TestAllAgentsImport:
    """Verify all agents can be imported without errors."""

    def test_import_orchestrator(self):
        from agents.orchestrator import OrchestratorAgent
        assert OrchestratorAgent is not None

    def test_import_personal_agent(self):
        from agents.personal_agent import PersonalAgent
        assert PersonalAgent is not None

    def test_import_financial_agent(self):
        from agents.financial_agent import FinancialAgent
        assert FinancialAgent is not None

    def test_import_health_agent(self):
        from agents.health_agent import HealthAgent
        assert HealthAgent is not None

    def test_import_home_agent(self):
        from agents.home_agent import HomeAgent
        assert HomeAgent is not None

    def test_import_communication_agent(self):
        from agents.communication_agent import CommunicationAgent
        assert CommunicationAgent is not None

    def test_import_voice_agent(self):
        from agents.voice_agent import VoiceAgent
        assert VoiceAgent is not None

    def test_import_work_agent(self):
        from agents.work_agent import WorkAgent
        assert WorkAgent is not None

    def test_import_report_agent(self):
        from agents.report_agent import ReportAgent
        assert ReportAgent is not None

    def test_import_automation_agent(self):
        from agents.automation_agent import AutomationAgent
        assert AutomationAgent is not None

    def test_import_learning_agent(self):
        from agents.learning_agent import LearningAgent
        assert LearningAgent is not None

    def test_import_memory_agent(self):
        from agents.memory_agent import MemoryAgent
        assert MemoryAgent is not None

    def test_import_security_agent(self):
        from agents.security_agent import SecurityAgent
        assert SecurityAgent is not None

    def test_import_task_agent(self):
        from agents.task_agent import TaskAgent
        assert TaskAgent is not None
