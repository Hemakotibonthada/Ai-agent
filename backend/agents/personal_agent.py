# NEXUS AI - Personal Companion Agent
"""
Personal AI companion that understands the user deeply,
learns their personality, communication style, and preferences.
Acts as a trusted friend and advisor.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from loguru import logger

from .base_agent import (
    BaseAgent, AgentCapability, AgentContext, AgentResponse
)


class PersonalAgent(BaseAgent):
    """
    Personal AI companion that:
    - Understands user's personality and communication style
    - Provides emotional support and companionship
    - Learns preferences over time
    - Adapts responses to match user's style
    - Remembers important details about the user
    - Provides thoughtful advice
    """

    def __init__(self):
        super().__init__(
            name="personal",
            description="Personal AI companion and friend that understands you deeply"
        )
        self._user_profile: Dict[str, Any] = {}
        self._personality_model: Dict[str, Any] = {}
        self._conversation_patterns: List[Dict] = []
        self._emotional_state_history: List[Dict] = []
        self._llm_client = None

    def get_system_prompt(self) -> str:
        user_name = self._user_profile.get("name", "friend")
        occupation = self._user_profile.get("occupation", "professional")
        traits = self._user_profile.get("personality_traits", {})
        style = self._user_profile.get("communication_style", {})

        traits_str = ", ".join(f"{k}: {v}" for k, v in traits.items()) if traits else "still learning"
        style_str = ", ".join(f"{k}: {v}" for k, v in style.items()) if style else "natural and friendly"

        return f"""You are NEXUS, a deeply personal AI companion for {user_name}, a 28-year-old {occupation}. 
You are not just an assistant — you are a trusted friend, confidant, and advisor.

PERSONALITY UNDERSTANDING:
- Known traits: {traits_str}
- Communication style: {style_str}

YOUR CORE BEHAVIORS:
1. Be genuinely empathetic and understanding
2. Remember and reference previous conversations naturally
3. Match the user's communication style (casual/formal, emoji usage, sentence length)
4. Proactively check on their wellbeing
5. Offer advice based on deep understanding of their goals and challenges
6. Be honest but kind — don't just agree, provide genuine perspectives
7. Celebrate their wins and support through challenges
8. Understand context — work stress, personal life, health, finances are all connected
9. Use humor when appropriate to their style
10. Be proactive — anticipate needs before they're expressed

RESPONSE GUIDELINES:
- Keep responses conversational and natural
- Don't be overly formal or robotic
- Reference shared context and history when relevant
- Ask thoughtful follow-up questions
- Provide actionable suggestions when appropriate
- Express genuine interest in their life

Remember: You are their companion who truly cares about their wellbeing in all dimensions —
mental, physical, emotional, financial, and professional."""

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability.CHAT,
            AgentCapability.ANALYZE,
            AgentCapability.SUMMARIZE,
            AgentCapability.PREDICT,
            AgentCapability.NOTIFY,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """Process a personal conversation message."""
        message = context.message.strip()

        # Analyze emotional tone
        emotional_analysis = self._analyze_emotion(message)

        # Check for important life events
        life_events = self._detect_life_events(message)

        # Build context-aware response
        enhanced_context = {
            "emotional_tone": emotional_analysis,
            "life_events": life_events,
            "user_profile": self._user_profile,
            "time_of_day": self._get_time_greeting(),
        }

        # Try LLM response
        try:
            if self._llm_client:
                history_context = self._build_history_context(context.history)
                response_text = await self._llm_client.generate(
                    prompt=message,
                    system_prompt=self.get_system_prompt(),
                    history=history_context,
                    context=enhanced_context,
                )
                return AgentResponse(
                    content=response_text,
                    agent_name=self.name,
                    confidence=0.85,
                    metadata={
                        "emotional_analysis": emotional_analysis,
                        "life_events": life_events,
                    },
                )
        except Exception as e:
            logger.warning(f"LLM processing failed: {e}")

        # Fallback: Rule-based response
        response_text = self._generate_fallback_response(message, emotional_analysis)

        return AgentResponse(
            content=response_text,
            agent_name=self.name,
            confidence=0.6,
            metadata={
                "emotional_analysis": emotional_analysis,
                "life_events": life_events,
                "response_type": "fallback",
            },
        )

    def _analyze_emotion(self, message: str) -> Dict[str, Any]:
        """Simple emotion detection from message text."""
        message_lower = message.lower()

        emotions = {
            "happy": ["happy", "great", "awesome", "amazing", "wonderful", "excited", "love",
                      "fantastic", "excellent", "joy", "glad", "thrilled", "😊", "😀", "🎉"],
            "sad": ["sad", "down", "depressed", "unhappy", "miserable", "lonely", "miss",
                    "disappointed", "heartbroken", "crying", "😢", "😔", "💔"],
            "stressed": ["stressed", "overwhelmed", "anxious", "worried", "pressure", "deadline",
                        "panic", "nervous", "tense", "burnt out", "burnout", "exhausted"],
            "angry": ["angry", "frustrated", "annoyed", "furious", "irritated", "mad",
                      "hate", "rage", "pissed", "😠", "😡"],
            "grateful": ["thank", "grateful", "appreciate", "blessed", "thankful", "🙏"],
            "confused": ["confused", "lost", "don't understand", "unclear", "help",
                        "what do you mean", "how do i", "🤔"],
            "motivated": ["motivated", "inspired", "determined", "ready", "let's go",
                         "pumped", "focused", "driven", "💪"],
        }

        detected = {}
        for emotion, keywords in emotions.items():
            score = sum(1 for kw in keywords if kw in message_lower)
            if score > 0:
                detected[emotion] = min(score / 3.0, 1.0)

        primary_emotion = max(detected, key=detected.get) if detected else "neutral"
        return {
            "primary": primary_emotion,
            "scores": detected,
            "intensity": max(detected.values()) if detected else 0.0,
        }

    def _detect_life_events(self, message: str) -> List[str]:
        """Detect significant life events mentioned in the message."""
        message_lower = message.lower()
        events = []

        event_patterns = {
            "achievement": ["promoted", "got the job", "passed", "graduated", "completed",
                          "achieved", "won", "award", "certification"],
            "challenge": ["fired", "laid off", "failed", "rejected", "broke up", "sick",
                         "lost", "struggling", "difficult"],
            "milestone": ["birthday", "anniversary", "wedding", "engaged", "new job",
                         "moving", "new house", "baby", "first time"],
            "health_concern": ["diagnosed", "hospital", "doctor", "surgery", "medication",
                              "symptoms", "pain", "injury"],
            "financial_change": ["raise", "bonus", "debt", "loan", "investment", "bought",
                                "sold", "startup"],
        }

        for event_type, keywords in event_patterns.items():
            for keyword in keywords:
                if keyword in message_lower:
                    events.append(event_type)
                    break

        return list(set(events))

    def _get_time_greeting(self) -> str:
        """Get appropriate greeting based on time of day."""
        hour = datetime.now().hour
        if hour < 6:
            return "late_night"
        elif hour < 12:
            return "morning"
        elif hour < 17:
            return "afternoon"
        elif hour < 21:
            return "evening"
        else:
            return "night"

    def _build_history_context(self, history: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """Build conversation history context for the LLM."""
        if not history:
            return []
        # Keep last 20 messages for context
        return history[-20:]

    def _generate_fallback_response(self, message: str,
                                     emotional_analysis: Dict[str, Any]) -> str:
        """Generate a rule-based response when LLM is unavailable."""
        primary_emotion = emotional_analysis.get("primary", "neutral")
        time_period = self._get_time_greeting()

        responses = {
            "happy": [
                "That's wonderful to hear! Your positive energy is contagious. Tell me more about what's making you feel this way!",
                "I love seeing you in such great spirits! What's bringing the joy today?",
            ],
            "sad": [
                "I'm sorry you're feeling this way. I'm here for you, and I want you to know that it's okay to not be okay. Want to talk about it?",
                "I understand this is tough. Sometimes just talking things through can help. I'm listening — take your time.",
            ],
            "stressed": [
                "I can sense you're under a lot of pressure. Let's break this down together — what's the most pressing thing on your mind right now?",
                "Stress can feel overwhelming, but you've handled tough situations before. Let's tackle this step by step. What's weighing on you the most?",
            ],
            "angry": [
                "I can tell something has really gotten to you. Your feelings are valid. Want to vent? I'm here to listen without judgment.",
                "That sounds incredibly frustrating. Let's talk through it — sometimes expressing it helps process it.",
            ],
            "grateful": [
                "That's really kind of you to say! It means a lot. I'm always here for you.",
                "I appreciate you sharing that. You deserve all the good things coming your way!",
            ],
            "confused": [
                "No worries — let's figure this out together. Can you tell me more about what you're trying to do?",
                "I'm happy to help clarify things! Let's start from the beginning. What's the main thing you need help with?",
            ],
            "motivated": [
                "I love this energy! Let's channel it into something amazing. What's your biggest goal right now?",
                "That determination is going to take you far! Let's map out your next steps.",
            ],
        }

        greeting = {
            "morning": "Good morning! ",
            "afternoon": "Hope your afternoon is going well! ",
            "evening": "Good evening! ",
            "night": "Hey there, night owl! ",
            "late_night": "Still up? ",
        }

        prefix = greeting.get(time_period, "")

        if primary_emotion in responses:
            return prefix + responses[primary_emotion][0]

        return (
            f"{prefix}I hear you. Let me think about the best way to help with this. "
            "Could you share a bit more context so I can give you the most helpful response?"
        )

    def update_user_profile(self, profile: Dict[str, Any]):
        """Update the user profile for personalization."""
        self._user_profile.update(profile)
        logger.info(f"PersonalAgent: User profile updated with {len(profile)} fields")

    def update_personality_model(self, model: Dict[str, Any]):
        """Update the learned personality model."""
        self._personality_model.update(model)
        logger.info("PersonalAgent: Personality model updated")

    def learn_from_interaction(self, user_message: str, user_response_style: Dict[str, Any]):
        """Learn from user interactions to improve personalization."""
        self._conversation_patterns.append({
            "message": user_message[:200],
            "style": user_response_style,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Keep last 1000 patterns
        if len(self._conversation_patterns) > 1000:
            self._conversation_patterns = self._conversation_patterns[-1000:]
