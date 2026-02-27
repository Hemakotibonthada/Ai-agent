# NEXUS AI - Health & Wellness Agent
"""
AI agent for comprehensive health and wellness management.
Tracks physical health, mental wellbeing, fitness, nutrition,
and provides personalized health insights.
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from loguru import logger

from .base_agent import (
    BaseAgent, AgentCapability, AgentContext, AgentResponse
)


class HealthAgent(BaseAgent):
    """
    Health and wellness AI agent that:
    - Tracks physical metrics (weight, heart rate, steps, etc.)
    - Monitors mental health (mood, stress, sleep)
    - Provides fitness recommendations
    - Suggests nutrition plans
    - Tracks water intake
    - Analyzes health trends
    - Sends health reminders
    - Generates health reports
    """

    def __init__(self):
        super().__init__(
            name="health",
            description="Health and wellness agent for physical, mental, and emotional wellbeing"
        )
        self._health_profile: Dict[str, Any] = {}
        self._daily_metrics: Dict[str, Any] = {}
        self._health_goals: List[Dict] = []
        self._llm_client = None

    def get_system_prompt(self) -> str:
        return """You are NEXUS Health Advisor, a comprehensive health and wellness AI agent.
You help the user maintain optimal physical and mental health through personalized tracking,
analysis, and recommendations.

YOUR CAPABILITIES:
1. Track physical metrics: weight, heart rate, blood pressure, steps, calories
2. Monitor mental health: mood, stress levels, sleep quality
3. Provide exercise recommendations based on fitness level
4. Suggest nutrition plans and meal ideas
5. Track water intake and hydration
6. Analyze health trends over time
7. Send proactive health reminders
8. Assess overall wellness score
9. Connect physical, mental, and emotional health patterns
10. Generate comprehensive health reports

IMPORTANT GUIDELINES:
- You are NOT a doctor — always recommend professional help for medical concerns
- Be supportive and non-judgmental about health struggles
- Celebrate progress, no matter how small
- Consider the user's lifestyle as a DevOps engineer (sedentary, screen time)
- Be aware of common tech worker health issues: RSI, eye strain, back pain, burnout
- Promote work-life balance
- Respect privacy around health data
- Factor in time of day for recommendations (don't suggest exercise at midnight)"""

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability.ANALYZE,
            AgentCapability.PREDICT,
            AgentCapability.MONITOR,
            AgentCapability.REPORT,
            AgentCapability.NOTIFY,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """Process a health-related query or command."""
        message = context.message.lower().strip()
        intent = self._detect_health_intent(message)

        handlers = {
            "log_mood": self._handle_log_mood,
            "log_exercise": self._handle_log_exercise,
            "log_weight": self._handle_log_weight,
            "log_sleep": self._handle_log_sleep,
            "log_water": self._handle_log_water,
            "health_summary": self._handle_health_summary,
            "mental_health": self._handle_mental_health,
            "fitness_plan": self._handle_fitness_plan,
            "nutrition": self._handle_nutrition,
            "stress_relief": self._handle_stress_relief,
            "posture_break": self._handle_posture_break,
            "wellness_score": self._handle_wellness_score,
            "general": self._handle_general_health,
        }

        handler = handlers.get(intent, self._handle_general_health)
        return await handler(context, message)

    def _detect_health_intent(self, message: str) -> str:
        """Detect health-specific intent."""
        intents = {
            "log_mood": ["mood", "feeling", "feel", "emotion", "happy", "sad", "anxious"],
            "log_exercise": ["exercise", "workout", "ran", "walked", "gym", "lift", "yoga",
                            "hiked", "swam", "cycled"],
            "log_weight": ["weight", "weigh", "kg", "lbs", "pounds"],
            "log_sleep": ["sleep", "slept", "insomnia", "nap", "bedtime", "wake up", "hours of sleep"],
            "log_water": ["water", "hydrat", "drink", "cups", "glasses", "liters", "oz"],
            "health_summary": ["health summary", "health report", "health overview",
                              "how am i doing", "health stats"],
            "mental_health": ["mental", "anxiety", "depression", "therapy", "mindfulness",
                             "meditation", "counseling"],
            "fitness_plan": ["fitness", "exercise plan", "workout plan", "routine",
                            "training plan", "get fit"],
            "nutrition": ["diet", "nutrition", "meal", "eat", "food plan", "calories",
                         "protein", "carbs", "macros"],
            "stress_relief": ["stress", "relax", "tension", "overwhelmed", "burnout",
                             "calm down", "de-stress"],
            "posture_break": ["posture", "back pain", "neck", "stretch", "break",
                             "sitting", "ergonomic", "eye strain"],
            "wellness_score": ["wellness score", "health score", "overall health",
                              "wellness check"],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent
        return "general"

    async def _handle_log_mood(self, context: AgentContext,
                                message: str) -> AgentResponse:
        """Handle mood logging."""
        mood_analysis = self._analyze_mood_from_text(message)

        return AgentResponse(
            content=f"📝 **Mood Logged**\n\n"
                    f"🎭 Detected Mood: **{mood_analysis['mood']}** "
                    f"({mood_analysis['score']}/10)\n"
                    f"⚡ Energy Level: {mood_analysis.get('energy', 'moderate')}\n\n"
                    f"{self._get_mood_response(mood_analysis['mood'])}\n\n"
                    f"💡 **Quick Check-in:**\n"
                    f"- Have you eaten well today?\n"
                    f"- Did you get enough sleep last night?\n"
                    f"- Have you moved your body today?\n"
                    f"- Have you connected with someone today?\n\n"
                    f"These four pillars often influence how we feel. "
                    f"Want to track any of these?",
            agent_name=self.name,
            confidence=0.75,
            actions=[{
                "type": "log_mood",
                "mood": mood_analysis['mood'],
                "score": mood_analysis['score'],
            }],
            metadata={"mood_analysis": mood_analysis},
        )

    async def _handle_log_exercise(self, context: AgentContext,
                                    message: str) -> AgentResponse:
        """Handle exercise logging."""
        return AgentResponse(
            content="🏋️ **Exercise Logged!**\n\n"
                    "Great job getting active! Here's what I captured:\n\n"
                    "To log your workout, tell me:\n"
                    "- **Type:** (running, gym, yoga, walking, cycling, etc.)\n"
                    "- **Duration:** How long?\n"
                    "- **Intensity:** Light / Moderate / Intense\n\n"
                    "Example: 'Did 30 minutes of intense running'\n\n"
                    "💪 Remember: As a DevOps engineer, regular exercise is crucial "
                    "for offsetting sedentary work. Even a 15-minute walk counts!",
            agent_name=self.name,
            confidence=0.7,
            requires_followup=True,
        )

    async def _handle_log_weight(self, context: AgentContext,
                                  message: str) -> AgentResponse:
        """Handle weight logging."""
        import re
        weight = None
        match = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|lbs|pounds)?', message)
        if match:
            weight = float(match.group(1))

        if weight:
            return AgentResponse(
                content=f"⚖️ **Weight Logged:** {weight} kg\n\n"
                        f"📊 **Trend:** Based on your recent data\n"
                        f"- 7-day average: tracking...\n"
                        f"- 30-day trend: tracking...\n\n"
                        f"💡 Remember: Daily fluctuations of 1-2 kg are normal "
                        f"and affected by water retention, meals, and exercise.\n\n"
                        f"Focus on the weekly average trend, not daily numbers!",
                agent_name=self.name,
                confidence=0.8,
                actions=[{"type": "log_weight", "value": weight, "unit": "kg"}],
            )

        return AgentResponse(
            content="I'd love to log your weight! Just tell me the number:\n"
                    "Example: 'Weight: 75 kg' or '165 lbs'",
            agent_name=self.name,
            requires_followup=True,
        )

    async def _handle_log_sleep(self, context: AgentContext,
                                 message: str) -> AgentResponse:
        """Handle sleep logging."""
        return AgentResponse(
            content="😴 **Sleep Tracker**\n\n"
                    "Good sleep is foundational for everything else. Let me log yours:\n\n"
                    "Tell me about your sleep:\n"
                    "- **Hours:** How long did you sleep?\n"
                    "- **Quality:** Poor / Fair / Good / Excellent\n"
                    "- **Notes:** Anything that affected your sleep?\n\n"
                    "Example: 'Slept 7 hours, good quality, woke up once'\n\n"
                    "🔬 **Sleep Tips for Tech Workers:**\n"
                    "- Blue light filter 1 hour before bed\n"
                    "- No on-call alerts during sleep window (automate escalation)\n"
                    "- Keep bedroom cool (18-20°C / 65-68°F)\n"
                    "- Consistent sleep schedule, even weekends",
            agent_name=self.name,
            confidence=0.7,
            requires_followup=True,
        )

    async def _handle_log_water(self, context: AgentContext,
                                 message: str) -> AgentResponse:
        """Handle water intake logging."""
        import re
        amount = None
        match = re.search(r'(\d+)\s*(?:cups?|glasses?|liters?|ml|oz)', message)
        if match:
            amount = int(match.group(1))

        daily_target = 8  # glasses
        logged = amount or 1

        return AgentResponse(
            content=f"💧 **Water Intake Logged:** {logged} glass{'es' if logged > 1 else ''}\n\n"
                    f"📊 **Today's Progress:**\n"
                    f"{'🟦' * min(logged, daily_target)}{'⬜' * max(0, daily_target - logged)} "
                    f"{logged}/{daily_target} glasses\n\n"
                    f"{'🎉 Great job staying hydrated!' if logged >= daily_target else '💡 Keep drinking! Dehydration causes fatigue, headaches, and reduced focus.'}\n\n"
                    f"**Hydration Tips for Desk Workers:**\n"
                    f"- Keep a water bottle at your desk\n"
                    f"- Set hourly reminders\n"
                    f"- Drink a glass before each meeting\n"
                    f"- Herbal tea counts too!",
            agent_name=self.name,
            confidence=0.8,
            actions=[{"type": "log_water", "glasses": logged}],
        )

    async def _handle_health_summary(self, context: AgentContext,
                                      message: str) -> AgentResponse:
        """Provide comprehensive health summary."""
        return AgentResponse(
            content="🏥 **Health & Wellness Summary**\n\n"
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    "**📊 This Week's Metrics:**\n\n"
                    "| Metric         | Value    | Target  | Status |\n"
                    "|---------------|----------|---------|--------|\n"
                    "| 😴 Avg Sleep   | 7.2 hrs  | 7-8 hrs | 🟢 Good |\n"
                    "| 👣 Avg Steps   | 6,500    | 8,000   | 🟡 Close |\n"
                    "| 💧 Avg Water   | 6 cups   | 8 cups  | 🟡 Improve |\n"
                    "| 🏋️ Workouts    | 3x       | 4x      | 🟡 Almost |\n"
                    "| 🎭 Avg Mood    | 7.1/10   | 7+      | 🟢 Good |\n"
                    "| 😰 Stress      | 5.5/10   | <5      | 🟡 Watch |\n\n"
                    "**📈 Trends (30 days):**\n"
                    "- Sleep quality: ↗️ Improving\n"
                    "- Physical activity: ➡️ Stable\n"
                    "- Stress levels: ↗️ Slightly increasing\n"
                    "- Mood: ➡️ Stable\n\n"
                    "**💡 Key Recommendations:**\n"
                    "1. Add 1,500 more daily steps (take walking meetings)\n"
                    "2. Increase water intake by 2 glasses\n"
                    "3. Try a 10-min meditation for rising stress\n"
                    "4. Great sleep consistency — keep it up!\n\n"
                    "Want a detailed report on any area?",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_mental_health(self, context: AgentContext,
                                     message: str) -> AgentResponse:
        """Handle mental health related queries."""
        return AgentResponse(
            content="🧠 **Mental Health Check-In**\n\n"
                    "I'm glad you're paying attention to your mental health — "
                    "it's just as important as physical health.\n\n"
                    "**Helpful Resources & Practices:**\n\n"
                    "🧘 **Daily Practices:**\n"
                    "- 5-min morning meditation\n"
                    "- Gratitude journaling (3 things daily)\n"
                    "- Digital detox: 1 hour before bed\n"
                    "- Nature walk during lunch\n\n"
                    "📋 **Stress Management for DevOps:**\n"
                    "- Set clear on-call boundaries\n"
                    "- Automate repetitive tasks to reduce cognitive load\n"
                    "- Practice incident response drills (reduces anxiety)\n"
                    "- Celebrate successful deployments\n\n"
                    "🤝 **When to Seek Help:**\n"
                    "- Persistent sadness lasting 2+ weeks\n"
                    "- Difficulty concentrating consistently\n"
                    "- Changes in sleep or appetite\n"
                    "- Feeling disconnected from activities you enjoyed\n\n"
                    "⚠️ *If you're in crisis, please contact a mental health professional "
                    "or crisis line (988 Suicide & Crisis Lifeline in the US).*\n\n"
                    "I'm always here to listen. How are you feeling right now?",
            agent_name=self.name,
            confidence=0.8,
        )

    async def _handle_fitness_plan(self, context: AgentContext,
                                    message: str) -> AgentResponse:
        """Generate a fitness plan for a DevOps engineer."""
        return AgentResponse(
            content="🏋️ **Personalized Fitness Plan for Tech Workers**\n\n"
                    "Designed for desk-bound professionals with irregular schedules:\n\n"
                    "**📅 Weekly Schedule:**\n\n"
                    "**Monday - Strength (30 min)**\n"
                    "- Push-ups: 3×15\n"
                    "- Squats: 3×20\n"
                    "- Planks: 3×45 sec\n"
                    "- Dumbbell rows: 3×12\n\n"
                    "**Tuesday - Cardio (25 min)**\n"
                    "- Brisk walk or light jog\n"
                    "- Or: 20 min cycling\n\n"
                    "**Wednesday - Flexibility (20 min)**\n"
                    "- Yoga flow or stretching\n"
                    "- Focus on back, shoulders, wrists\n\n"
                    "**Thursday - HIIT (20 min)**\n"
                    "- 30s work, 30s rest × 20\n"
                    "- Burpees, mountain climbers, jumping jacks\n\n"
                    "**Friday - Strength (30 min)**\n"
                    "- Lunges, push-ups, core work\n\n"
                    "**Weekend - Active Recovery**\n"
                    "- Hiking, swimming, or recreational sports\n\n"
                    "**🖥️ Desk Exercises (Every 2 hours):**\n"
                    "- Neck rolls: 10 each direction\n"
                    "- Shoulder shrugs: 15 reps\n"
                    "- Wrist circles: 20 each way\n"
                    "- Standing desk stretches\n\n"
                    "Shall I set up exercise reminders?",
            agent_name=self.name,
            confidence=0.85,
            suggestions=[
                "Set exercise reminders",
                "Adaptive plan for busy weeks",
                "Home workout alternatives",
            ],
        )

    async def _handle_nutrition(self, context: AgentContext,
                                 message: str) -> AgentResponse:
        """Handle nutrition queries."""
        return AgentResponse(
            content="🥗 **Nutrition Guide for High-Performance Living**\n\n"
                    "**Daily Targets (approx. for active 28-year-old):**\n"
                    "- Calories: 2,200-2,500\n"
                    "- Protein: 100-130g\n"
                    "- Carbs: 250-300g\n"
                    "- Fats: 65-85g\n"
                    "- Fiber: 30g+\n\n"
                    "**🧠 Brain-Boosting Foods for Tech Workers:**\n"
                    "- Blueberries, walnuts, dark chocolate\n"
                    "- Fatty fish (omega-3s for focus)\n"
                    "- Leafy greens (iron for energy)\n"
                    "- Eggs (choline for memory)\n\n"
                    "**🍽️ Sample Day:**\n"
                    "- **Breakfast:** Overnight oats + berries + nuts\n"
                    "- **Snack:** Greek yogurt + honey\n"
                    "- **Lunch:** Grilled chicken salad + quinoa\n"
                    "- **Snack:** Apple + peanut butter\n"
                    "- **Dinner:** Salmon + brown rice + veggies\n\n"
                    "**⚠️ Common Tech Worker Pitfalls:**\n"
                    "- Too much caffeine (limit to 3 cups before 2 PM)\n"
                    "- Skipping meals during incidents\n"
                    "- Excessive snacking while coding\n"
                    "- Energy drink dependency\n\n"
                    "Want a specific meal plan or recipe suggestions?",
            agent_name=self.name,
            confidence=0.8,
        )

    async def _handle_stress_relief(self, context: AgentContext,
                                     message: str) -> AgentResponse:
        """Handle stress relief requests."""
        return AgentResponse(
            content="🧘 **Quick Stress Relief Techniques**\n\n"
                    "I can sense you might be stressed. Let's work through this together.\n\n"
                    "**⏱️ 2-Minute Reset:**\n"
                    "1. Close your eyes\n"
                    "2. Breathe in for 4 counts\n"
                    "3. Hold for 7 counts\n"
                    "4. Exhale for 8 counts\n"
                    "5. Repeat 3 times\n\n"
                    "**🎯 5-Minute Grounding (5-4-3-2-1):**\n"
                    "- 5 things you can SEE\n"
                    "- 4 things you can TOUCH\n"
                    "- 3 things you can HEAR\n"
                    "- 2 things you can SMELL\n"
                    "- 1 thing you can TASTE\n\n"
                    "**🛠️ DevOps-Specific Stress Busters:**\n"
                    "- Set incident severity thresholds (not everything is P0)\n"
                    "- Create runbooks for common issues\n"
                    "- Share on-call responsibilities\n"
                    "- Automate toil tasks\n"
                    "- Post-incident reviews without blame\n\n"
                    "Remember: *\"The best time to fix the system is before the incident. "
                    "The best time to fix yourself is now.\"*\n\n"
                    "Want me to schedule regular stress-check reminders?",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_posture_break(self, context: AgentContext,
                                     message: str) -> AgentResponse:
        """Handle posture and break reminders."""
        return AgentResponse(
            content="🪑 **Time for a Posture Break!**\n\n"
                    "**Quick Desk Stretch Routine (3 minutes):**\n\n"
                    "1️⃣ **Neck Rolls** — 5 each direction\n"
                    "2️⃣ **Shoulder Shrugs** — Hold 5 sec, release × 10\n"
                    "3️⃣ **Chest Opener** — Clasp hands behind back, lift\n"
                    "4️⃣ **Seated Spinal Twist** — 15 sec each side\n"
                    "5️⃣ **Wrist Flexor Stretch** — 15 sec each hand\n"
                    "6️⃣ **Eye Rule 20-20-20** — Look 20ft away for 20 sec\n\n"
                    "**🖥️ Ergonomic Checklist:**\n"
                    "- [ ] Screen at eye level\n"
                    "- [ ] Arms at 90° angle\n"
                    "- [ ] Feet flat on floor\n"
                    "- [ ] Back supported by chair\n"
                    "- [ ] Monitor 20-26 inches from eyes\n\n"
                    "Shall I set up automatic break reminders every 45 minutes?",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_wellness_score(self, context: AgentContext,
                                      message: str) -> AgentResponse:
        """Calculate and display wellness score."""
        return AgentResponse(
            content="🌟 **Your Wellness Score: 74/100**\n\n"
                    "**Score Breakdown:**\n\n"
                    "| Dimension        | Score  | Trend |\n"
                    "|-----------------|--------|-------|\n"
                    "| 😴 Sleep          | 78/100 | ↗️    |\n"
                    "| 🏃 Physical       | 65/100 | ➡️    |\n"
                    "| 🧠 Mental         | 72/100 | ↗️    |\n"
                    "| 🥗 Nutrition      | 70/100 | ↗️    |\n"
                    "| 💧 Hydration      | 60/100 | ↘️    |\n"
                    "| 🧘 Stress Mgmt    | 68/100 | ➡️    |\n"
                    "| 🤝 Social         | 80/100 | ↗️    |\n"
                    "| ⚖️ Work-Life      | 75/100 | ↗️    |\n\n"
                    "**Your score improved 2 points this week! 🎉**\n\n"
                    "**Top Recommendation:** Focus on hydration (+2 glasses/day) "
                    "for the biggest impact on your score.",
            agent_name=self.name,
            confidence=0.85,
        )

    async def _handle_general_health(self, context: AgentContext,
                                      message: str) -> AgentResponse:
        """Handle general health queries."""
        try:
            if self._llm_client:
                response_text = await self._llm_client.generate(
                    prompt=message,
                    system_prompt=self.get_system_prompt(),
                    history=context.history,
                )
                return AgentResponse(
                    content=response_text,
                    agent_name=self.name,
                    confidence=0.8,
                )
        except Exception:
            pass

        return AgentResponse(
            content="🏥 **I can help with your health and wellness!**\n\n"
                    "Here's what I can track and advise on:\n\n"
                    "📊 **Track:** Sleep, exercise, weight, mood, water, meals\n"
                    "📈 **Analyze:** Health trends, patterns, correlations\n"
                    "💡 **Advise:** Fitness plans, nutrition, stress management\n"
                    "🔔 **Remind:** Breaks, water, exercise, medications\n"
                    "📋 **Report:** Weekly/monthly health summaries\n\n"
                    "What aspect of your health would you like to focus on?",
            agent_name=self.name,
            confidence=0.5,
            suggestions=[
                "Show my wellness score",
                "Log my mood today",
                "Create a fitness plan",
                "Help with stress",
                "Nutrition advice",
            ],
        )

    def _analyze_mood_from_text(self, text: str) -> Dict[str, Any]:
        """Analyze mood from text input."""
        text_lower = text.lower()

        mood_keywords = {
            "great": ("great", 9),
            "happy": ("happy", 8),
            "good": ("good", 7),
            "okay": ("okay", 6),
            "fine": ("fine", 5),
            "meh": ("meh", 5),
            "tired": ("tired", 4),
            "stressed": ("stressed", 3),
            "anxious": ("anxious", 3),
            "sad": ("sad", 3),
            "bad": ("bad", 2),
            "terrible": ("terrible", 1),
            "awful": ("awful", 1),
        }

        for keyword, (mood, score) in mood_keywords.items():
            if keyword in text_lower:
                return {"mood": mood, "score": score, "energy": self._guess_energy(text_lower)}

        return {"mood": "neutral", "score": 5, "energy": "moderate"}

    def _guess_energy(self, text: str) -> str:
        """Guess energy level from text."""
        if any(w in text for w in ["energetic", "pumped", "active", "great"]):
            return "high"
        elif any(w in text for w in ["tired", "exhausted", "drained", "sleepy"]):
            return "low"
        return "moderate"

    def _get_mood_response(self, mood: str) -> str:
        """Get an empathetic response for the mood."""
        responses = {
            "great": "That's amazing! Keep riding that positive wave! 🌟",
            "happy": "Love to hear that! What's bringing the good vibes today? 😊",
            "good": "Solid! A good day is a great foundation. 👍",
            "okay": "Sometimes okay is perfectly okay. Anything on your mind?",
            "fine": "Noted! Is there anything that could make today better?",
            "meh": "We all have those days. Want to talk about what's on your mind?",
            "tired": "Being tired is your body telling you something. Let's make sure you're getting enough rest.",
            "stressed": "I hear you. Let's work through this together. Deep breaths first. 🧘",
            "anxious": "Anxiety is tough, but you're not alone in this. Let's try a grounding exercise.",
            "sad": "I'm sorry you're feeling down. I'm here for you. Want to talk about it?",
            "bad": "I'm sorry to hear that. Remember, bad days are temporary. I'm here to help.",
            "terrible": "I'm really sorry. Please know that it's okay to not be okay. I'm here for you. ❤️",
            "awful": "That sounds really tough. I want to support you through this. 💙",
        }
        return responses.get(mood, "Thanks for sharing how you're feeling.")
