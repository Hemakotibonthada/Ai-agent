# NEXUS AI - Orchestrator Agent
"""
Master agent that coordinates all other agents.
Routes requests to the appropriate agent, manages multi-agent workflows,
and ensures optimal task distribution.
"""

import asyncio
import json
import re
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent, AgentCapability, AgentContext, AgentResponse, AgentStatus
)
from core.events import EventCategory, EventPriority


# Intent classification keywords
INTENT_KEYWORDS = {
    "financial": [
        "money", "spend", "income", "expense", "budget", "invest", "savings",
        "bank", "salary", "tax", "bill", "payment", "loan", "debt", "finance",
        "financial", "stock", "crypto", "portfolio", "cost", "price", "cash",
    ],
    "health": [
        "health", "exercise", "workout", "diet", "sleep", "weight", "calories",
        "mood", "stress", "meditation", "steps", "heart", "blood", "mental",
        "wellness", "fitness", "nutrition", "water", "medicine", "doctor",
    ],
    "home": [
        "light", "lights", "temperature", "thermostat", "humidity", "fan",
        "door", "lock", "camera", "sensor", "power", "energy", "water tank",
        "gas", "air quality", "home", "room", "kitchen", "bedroom", "living",
        "appliance", "smart home", "automation", "switch", "esp32",
    ],
    "communication": [
        "email", "mail", "message", "chat", "slack", "teams", "reply",
        "send", "inbox", "notification", "respond", "forward", "compose",
    ],
    "voice": [
        "voice", "speak", "say", "listen", "audio", "speech", "sound",
        "pronounce", "read aloud", "dictate", "transcribe",
    ],
    "work": [
        "work", "task", "project", "deadline", "meeting", "calendar",
        "schedule", "code", "debug", "deploy", "pipeline", "ci/cd",
        "kubernetes", "docker", "server", "monitor", "devops", "git",
    ],
    "report": [
        "report", "generate report", "pdf", "excel", "spreadsheet",
        "summary", "analytics", "dashboard", "export", "chart", "graph",
    ],
    "automation": [
        "automate", "schedule", "cron", "trigger", "workflow", "script",
        "batch", "recurring", "periodic", "backup",
    ],
    "learning": [
        "learn", "train", "improve", "adapt", "model", "fine-tune",
        "training", "personalize", "customize",
    ],
    "security": [
        "security", "password", "encrypt", "private", "protect", "backup",
        "firewall", "threat", "vulnerability", "access",
    ],
    "memory": [
        "remember", "recall", "forget", "memory", "memorize", "remind",
        "history", "past", "previous", "earlier", "ago",
    ],
}


class OrchestratorAgent(BaseAgent):
    """
    Master orchestrator that routes requests to specialized agents
    and coordinates multi-agent workflows.
    
    Capabilities:
    - Intent classification and routing
    - Multi-agent coordination
    - Context management
    - Fallback handling
    - Priority-based routing
    """

    def __init__(self):
        super().__init__(
            name="orchestrator",
            description="Master orchestrator agent that coordinates all specialized agents"
        )
        self._agents: Dict[str, BaseAgent] = {}
        self._routing_history: List[Dict[str, Any]] = []
        self._llm_client = None

    def register_agent(self, agent: BaseAgent):
        """Register a specialized agent for routing."""
        self._agents[agent.name] = agent
        logger.info(f"Orchestrator: Registered agent '{agent.name}'")

    def get_registered_agents(self) -> Dict[str, BaseAgent]:
        """Get all registered agents."""
        return self._agents

    def get_system_prompt(self) -> str:
        return """You are NEXUS AI, an advanced personal AI operating system. You are the master orchestrator 
that coordinates specialized agents to serve the user. You understand context deeply and route 
requests to the best-suited agent.

Your registered agents and their specialties:
- personal: Personal companion, general conversation, emotional support, understanding user personality
- financial: Financial management, budgeting, investments, expense tracking
- health: Health tracking, fitness, mental wellness, sleep, nutrition
- home: Smart home automation, IoT devices, energy management, sensors
- communication: Email management, chat responses, notifications
- voice: Voice commands, speech synthesis, audio processing
- work: DevOps tasks, project management, development workflows
- report: Report generation (MD, PDF, Excel), analytics, summaries
- automation: Task automation, scheduling, workflow management
- learning: Self-improvement, model training, personalization
- security: Data protection, encryption, access management
- memory: Long-term memory, recall, context preservation
- task: Task management, to-do lists, reminders

When you receive a message, classify the intent and route to the appropriate agent.
For complex queries, coordinate multiple agents.
Always be helpful, friendly, and proactive."""

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability.CHAT,
            AgentCapability.ANALYZE,
            AgentCapability.AUTOMATE,
            AgentCapability.NOTIFY,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process incoming request by classifying intent and routing
        to the appropriate agent(s).
        """
        message = context.message.lower().strip()

        if not message:
            return AgentResponse(
                content="Hello! I'm NEXUS AI, your personal AI companion. How can I help you today?",
                agent_name=self.name,
            )

        # Classify intent
        intents = self._classify_intent(message)

        if not intents:
            # Default to personal agent for general conversation
            intents = [("personal", 0.5)]

        # Get the primary agent
        primary_intent, confidence = intents[0]
        target_agent = self._agents.get(primary_intent)

        if target_agent and target_agent.is_healthy():
            # Route to specialized agent
            logger.info(f"Orchestrator routing to '{primary_intent}' (confidence: {confidence:.2f})")
            response = await target_agent.handle_message(context)
            response.metadata["routed_by"] = "orchestrator"
            response.metadata["intent"] = primary_intent
            response.metadata["confidence"] = confidence
            response.metadata["alternative_intents"] = [
                {"intent": i, "confidence": c} for i, c in intents[1:3]
            ]

            # Log routing decision
            self._routing_history.append({
                "message": context.message[:100],
                "intent": primary_intent,
                "confidence": confidence,
                "agent": target_agent.name,
                "timestamp": str(asyncio.get_event_loop().time()),
            })

            return response
        else:
            # Fallback: handle directly
            return await self._handle_directly(context)

    def _classify_intent(self, message: str) -> List[Tuple[str, float]]:
        """
        Classify the intent of a message using keyword matching.
        Returns sorted list of (intent, confidence) tuples.
        """
        scores: Dict[str, float] = {}

        for intent, keywords in INTENT_KEYWORDS.items():
            score = 0.0
            word_count = len(message.split())

            for keyword in keywords:
                if keyword in message:
                    # Exact match bonus
                    score += 2.0
                    # Position bonus (earlier = more relevant)
                    pos = message.find(keyword)
                    score += max(0, 1.0 - (pos / max(len(message), 1)))

            if score > 0:
                # Normalize by message length
                scores[intent] = min(score / max(word_count, 1), 1.0)

        # Sort by score descending
        sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_intents

    async def _handle_directly(self, context: AgentContext) -> AgentResponse:
        """Handle request directly when no suitable agent is available."""
        # Try to use LLM for general response
        try:
            if self._llm_client:
                response_text = await self._llm_client.generate(
                    prompt=context.message,
                    system_prompt=self.get_system_prompt(),
                    history=context.history,
                )
                return AgentResponse(
                    content=response_text,
                    agent_name=self.name,
                    confidence=0.7,
                )
        except Exception as e:
            logger.warning(f"LLM fallback failed: {e}")

        return AgentResponse(
            content="I understand your request. Let me help you with that. "
                    "Could you provide more details so I can route your request "
                    "to the best agent for the job?",
            agent_name=self.name,
            confidence=0.3,
            suggestions=[
                "Ask about your finances",
                "Check your health metrics",
                "Control smart home devices",
                "Manage your tasks",
                "Generate a report",
            ],
        )

    async def coordinate_multi_agent(self, context: AgentContext,
                                      agent_names: List[str]) -> List[AgentResponse]:
        """
        Coordinate a request across multiple agents.
        Useful for complex queries that span multiple domains.
        """
        tasks = []
        for name in agent_names:
            agent = self._agents.get(name)
            if agent and agent.is_healthy():
                tasks.append(agent.handle_message(context))

        if tasks:
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            valid_responses = [
                r for r in responses
                if isinstance(r, AgentResponse) and not r.error
            ]
            return valid_responses

        return []

    def get_routing_stats(self) -> Dict[str, Any]:
        """Get routing statistics."""
        intent_counts: Dict[str, int] = {}
        for entry in self._routing_history:
            intent = entry["intent"]
            intent_counts[intent] = intent_counts.get(intent, 0) + 1

        return {
            "total_routes": len(self._routing_history),
            "intent_distribution": intent_counts,
            "registered_agents": list(self._agents.keys()),
            "healthy_agents": [
                name for name, agent in self._agents.items()
                if agent.is_healthy()
            ],
        }
