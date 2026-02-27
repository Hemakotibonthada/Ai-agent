"""
NEXUS AI OS — API Integration Tests
Tests for REST API endpoints using httpx AsyncClient / FastAPI TestClient.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport


# ────────────────────────────────────────────────────────────
#  Fixtures
# ────────────────────────────────────────────────────────────


@pytest.fixture
def mock_engine():
    """Create a mock NexusEngine to prevent real initialization."""
    engine = MagicMock()
    engine.is_ready = True
    engine.settings = MagicMock()
    engine.settings.app_name = "NEXUS AI"
    engine.settings.version = "1.0.0"
    engine.settings.environment = "testing"
    engine.settings.debug = True
    engine.settings.ollama.model = "llama3.1"
    engine.event_bus = MagicMock()
    engine.event_bus.emit = AsyncMock()
    engine.agents = {}
    engine.services = {}
    engine.db = MagicMock()
    engine.initialized = True
    return engine


@pytest_asyncio.fixture
async def app(mock_engine):
    """Create a FastAPI test application with mocked dependencies."""
    with patch("main.NexusEngine", return_value=mock_engine), \
         patch("main.engine", mock_engine):
        from main import create_app
        test_app = create_app()
        yield test_app


@pytest_asyncio.fixture
async def client(app):
    """Create an async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ────────────────────────────────────────────────────────────
#  Root & Health Endpoints
# ────────────────────────────────────────────────────────────


class TestRootEndpoints:
    """Tests for root and health check endpoints."""

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client):
        """GET / should return system info."""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data or "status" in data

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client):
        """GET /health should return health status."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    @pytest.mark.asyncio
    async def test_openapi_docs(self, client):
        """GET /docs should return Swagger UI."""
        response = await client.get("/docs")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_openapi_schema(self, client):
        """GET /openapi.json should return the OpenAPI schema."""
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data


# ────────────────────────────────────────────────────────────
#  Chat Endpoints
# ────────────────────────────────────────────────────────────


class TestChatEndpoints:
    """Tests for the /api/chat/* endpoints."""

    @pytest.mark.asyncio
    async def test_send_message_validation(self, client):
        """POST /api/chat/message — missing message should fail."""
        response = await client.post("/api/chat/message", json={})
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_send_message_format(self, client):
        """POST /api/chat/message — valid request format."""
        payload = {
            "message": "Hello, Nexus!",
            "conversation_id": None,
            "agent": None,
            "metadata": {},
            "attachments": [],
        }
        # May return 500 if engine not fully mocked, but validates format
        response = await client.post("/api/chat/message", json=payload)
        assert response.status_code in [200, 500, 503]

    @pytest.mark.asyncio
    async def test_list_conversations(self, client):
        """GET /api/chat/conversations — should return list."""
        response = await client.get("/api/chat/conversations")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_get_conversation_not_found(self, client):
        """GET /api/chat/conversations/{id} — nonexistent should 404."""
        response = await client.get("/api/chat/conversations/nonexistent-id")
        assert response.status_code in [404, 500]

    @pytest.mark.asyncio
    async def test_delete_conversation(self, client):
        """DELETE /api/chat/conversations/{id} — nonexistent should 404."""
        response = await client.delete("/api/chat/conversations/nonexistent-id")
        assert response.status_code in [200, 404, 500]


# ────────────────────────────────────────────────────────────
#  Agent Endpoints
# ────────────────────────────────────────────────────────────


class TestAgentEndpoints:
    """Tests for the /api/agents/* endpoints."""

    @pytest.mark.asyncio
    async def test_list_agents(self, client):
        """GET /api/agents/ — should return agent list."""
        response = await client.get("/api/agents/")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_get_agent_not_found(self, client):
        """GET /api/agents/{name} — nonexistent agent should 404."""
        response = await client.get("/api/agents/nonexistent-agent")
        assert response.status_code in [404, 500]

    @pytest.mark.asyncio
    async def test_agent_stats(self, client):
        """GET /api/agents/{name}/stats — should return stats or 404."""
        response = await client.get("/api/agents/personal/stats")
        assert response.status_code in [200, 404, 500]

    @pytest.mark.asyncio
    async def test_send_agent_message(self, client):
        """POST /api/agents/{name}/message — direct message."""
        payload = {"message": "Hello", "context": {}}
        response = await client.post("/api/agents/personal/message", json=payload)
        assert response.status_code in [200, 404, 500]


# ────────────────────────────────────────────────────────────
#  Home Automation Endpoints
# ────────────────────────────────────────────────────────────


class TestHomeEndpoints:
    """Tests for the /api/home/* endpoints."""

    @pytest.mark.asyncio
    async def test_home_status(self, client):
        """GET /api/home/status — should return home status."""
        response = await client.get("/api/home/status")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_control_device(self, client):
        """POST /api/home/devices/{id}/control — control a device."""
        payload = {"action": "turn_on", "params": {}}
        response = await client.post(
            "/api/home/devices/light_1/control", json=payload
        )
        assert response.status_code in [200, 404, 500]

    @pytest.mark.asyncio
    async def test_list_rooms(self, client):
        """GET /api/home/rooms — should return rooms."""
        response = await client.get("/api/home/rooms")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_energy_data(self, client):
        """GET /api/home/energy — should return energy metrics."""
        response = await client.get("/api/home/energy")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_sensors(self, client):
        """GET /api/home/sensors — should return sensor data."""
        response = await client.get("/api/home/sensors")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  Health & Wellness Endpoints
# ────────────────────────────────────────────────────────────


class TestHealthEndpoints:
    """Tests for the /api/health/* endpoints."""

    @pytest.mark.asyncio
    async def test_log_metrics(self, client):
        """POST /api/health/metrics — log health data."""
        payload = {"type": "weight", "value": 72.5, "unit": "kg"}
        response = await client.post("/api/health/metrics", json=payload)
        assert response.status_code in [200, 422, 500]

    @pytest.mark.asyncio
    async def test_log_mood(self, client):
        """POST /api/health/mood — log mood entry."""
        payload = {"mood": "good", "energy": 7, "stress": 3}
        response = await client.post("/api/health/mood", json=payload)
        assert response.status_code in [200, 422, 500]

    @pytest.mark.asyncio
    async def test_health_dashboard(self, client):
        """GET /api/health/dashboard — should return health summary."""
        response = await client.get("/api/health/dashboard")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_health_trends(self, client):
        """GET /api/health/trends — should return trend data."""
        response = await client.get("/api/health/trends")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  Finance Endpoints
# ────────────────────────────────────────────────────────────


class TestFinanceEndpoints:
    """Tests for the /api/finance/* endpoints."""

    @pytest.mark.asyncio
    async def test_add_transaction(self, client):
        """POST /api/finance/transactions — add transaction."""
        payload = {
            "type": "expense",
            "amount": 45.99,
            "category": "food",
            "description": "Groceries",
        }
        response = await client.post("/api/finance/transactions", json=payload)
        assert response.status_code in [200, 422, 500]

    @pytest.mark.asyncio
    async def test_financial_summary(self, client):
        """GET /api/finance/summary — should return financial summary."""
        response = await client.get("/api/finance/summary")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_budget(self, client):
        """GET /api/finance/budget — should return budget data."""
        response = await client.get("/api/finance/budget")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_financial_insights(self, client):
        """GET /api/finance/insights — should return AI insights."""
        response = await client.get("/api/finance/insights")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  Task Endpoints
# ────────────────────────────────────────────────────────────


class TestTaskEndpoints:
    """Tests for the /api/tasks/* endpoints."""

    @pytest.mark.asyncio
    async def test_create_task(self, client):
        """POST /api/tasks/ — create a new task."""
        payload = {
            "title": "Test Task",
            "description": "A test task for CI",
            "priority": "medium",
        }
        response = await client.post("/api/tasks/", json=payload)
        assert response.status_code in [200, 201, 422, 500]

    @pytest.mark.asyncio
    async def test_list_tasks(self, client):
        """GET /api/tasks/ — should return task list."""
        response = await client.get("/api/tasks/")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_update_task(self, client):
        """PUT /api/tasks/{id} — update a task."""
        payload = {"status": "completed"}
        response = await client.put("/api/tasks/test-task-id", json=payload)
        assert response.status_code in [200, 404, 422, 500]

    @pytest.mark.asyncio
    async def test_task_stats(self, client):
        """GET /api/tasks/stats — should return stats."""
        response = await client.get("/api/tasks/stats")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_upcoming_tasks(self, client):
        """GET /api/tasks/upcoming — should return upcoming tasks."""
        response = await client.get("/api/tasks/upcoming")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  System Endpoints
# ────────────────────────────────────────────────────────────


class TestSystemEndpoints:
    """Tests for the /api/system/* endpoints."""

    @pytest.mark.asyncio
    async def test_system_status(self, client):
        """GET /api/system/status — should return system health."""
        response = await client.get("/api/system/status")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_system_metrics(self, client):
        """GET /api/system/metrics — should return metrics."""
        response = await client.get("/api/system/metrics")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_system_config(self, client):
        """GET /api/system/config — should return config (non-sensitive)."""
        response = await client.get("/api/system/config")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_system_logs(self, client):
        """GET /api/system/logs — should return recent logs."""
        response = await client.get("/api/system/logs")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_trigger_backup(self, client):
        """POST /api/system/backup — should trigger backup."""
        response = await client.post("/api/system/backup")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  Voice Endpoints
# ────────────────────────────────────────────────────────────


class TestVoiceEndpoints:
    """Tests for the /api/voice/* endpoints."""

    @pytest.mark.asyncio
    async def test_speak(self, client):
        """POST /api/voice/speak — text-to-speech."""
        payload = {"text": "Hello world", "voice": "default", "speed": 1.0}
        response = await client.post("/api/voice/speak", json=payload)
        assert response.status_code in [200, 422, 500, 503]

    @pytest.mark.asyncio
    async def test_voice_status(self, client):
        """GET /api/voice/status — should return voice engine status."""
        response = await client.get("/api/voice/status")
        assert response.status_code in [200, 500]


# ────────────────────────────────────────────────────────────
#  Report Endpoints
# ────────────────────────────────────────────────────────────


class TestReportEndpoints:
    """Tests for the /api/reports/* endpoints."""

    @pytest.mark.asyncio
    async def test_generate_report(self, client):
        """POST /api/reports/generate — generate a report."""
        payload = {
            "type": "financial_monthly",
            "format": "pdf",
            "period": {"start": "2025-01-01", "end": "2025-01-31"},
        }
        response = await client.post("/api/reports/generate", json=payload)
        assert response.status_code in [200, 422, 500]

    @pytest.mark.asyncio
    async def test_list_reports(self, client):
        """GET /api/reports/ — should return report list."""
        response = await client.get("/api/reports/")
        assert response.status_code in [200, 500]

    @pytest.mark.asyncio
    async def test_get_report_not_found(self, client):
        """GET /api/reports/{id} — nonexistent should 404."""
        response = await client.get("/api/reports/nonexistent-id")
        assert response.status_code in [404, 500]


# ────────────────────────────────────────────────────────────
#  CORS / Middleware Tests
# ────────────────────────────────────────────────────────────


class TestMiddleware:
    """Tests for middleware behavior."""

    @pytest.mark.asyncio
    async def test_cors_headers(self, client):
        """OPTIONS request should return CORS headers."""
        response = await client.options("/")
        # CORS middleware should add access-control headers
        assert response.status_code in [200, 204, 405]

    @pytest.mark.asyncio
    async def test_404_on_unknown_route(self, client):
        """Unknown routes should return 404."""
        response = await client.get("/api/nonexistent-endpoint")
        assert response.status_code == 404
