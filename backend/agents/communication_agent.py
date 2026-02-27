# NEXUS AI - Communication Agent
"""
AI agent for comprehensive communication management and automation.

This module implements the CommunicationAgent, a NEXUS AI agent that provides
intelligent communication management across multiple channels including:

- **Email Management:** Read, compose, and auto-reply to emails with context-
  aware drafts. Supports inbox monitoring, priority classification, and
  thread summarization so users never miss important messages.
- **Chat Platform Integration:** Monitor and respond to chat messages across
  platforms like Slack and Microsoft Teams. Auto-responses are generated
  using the user's learned communication style.
- **Communication Style Learning:** Analyses the user's historical messages
  to build a writing-style profile covering tone, vocabulary complexity,
  greeting preferences, sign-off patterns, and average response length.
  Drafted responses match the user's natural voice.
- **Email Importance Classification:** Multi-signal priority scoring that
  considers sender reputation, subject keywords, body urgency cues,
  attachment presence, CC list size, and historical interaction frequency.
- **Thread Summarization:** Condenses long email threads or chat histories
  into concise, actionable summaries with key decisions, open questions,
  and action items extracted automatically.
- **Notification Management:** Centralised notification preferences per
  channel and sender. Supports do-not-disturb windows, batched digests,
  and smart filtering to reduce notification fatigue.
- **Sentiment Detection:** Real-time sentiment analysis on incoming messages
  to flag frustrated customers, urgent internal escalations, or positive
  feedback that deserves acknowledgement.
- **Intent Detection:** Natural-language understanding layer that maps user
  commands to the correct handler — compose, check inbox, reply, summarize,
  manage notifications, or analyse communication patterns.

The agent publishes events to the NEXUS event bus so other agents (personal,
work, task) can react to communication signals such as high-priority emails,
meeting invitations, or deadline mentions.
"""

import json
import re
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from loguru import logger

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentContext,
    AgentResponse,
)


# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

# Supported communication platforms
SUPPORTED_PLATFORMS: List[str] = [
    "email",
    "slack",
    "teams",
    "discord",
    "sms",
]

# Email priority levels
class EmailPriority:
    """Enumeration of email priority tiers."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    SPAM = "spam"

# Priority keywords mapped to urgency weight
URGENCY_KEYWORDS: Dict[str, float] = {
    "urgent": 0.9,
    "asap": 0.85,
    "immediately": 0.9,
    "deadline": 0.7,
    "critical": 0.95,
    "important": 0.6,
    "action required": 0.75,
    "time-sensitive": 0.8,
    "follow up": 0.4,
    "reminder": 0.35,
    "fyi": 0.1,
    "no rush": 0.05,
}

# Sentiment lexicon — positive and negative cue words with polarity scores
SENTIMENT_LEXICON: Dict[str, float] = {
    # Positive
    "thank": 0.3, "thanks": 0.3, "appreciate": 0.4, "great": 0.5,
    "excellent": 0.6, "wonderful": 0.5, "happy": 0.4, "pleased": 0.4,
    "congratulations": 0.6, "well done": 0.5, "love": 0.5, "fantastic": 0.6,
    "amazing": 0.6, "good job": 0.5, "brilliant": 0.6, "perfect": 0.5,
    # Negative
    "urgent": -0.3, "frustrated": -0.6, "disappointed": -0.5,
    "unacceptable": -0.7, "angry": -0.7, "terrible": -0.8, "horrible": -0.7,
    "worst": -0.8, "complaint": -0.5, "issue": -0.2, "problem": -0.3,
    "broken": -0.4, "fail": -0.5, "failure": -0.5, "delay": -0.3,
    "overdue": -0.4, "missing": -0.3, "error": -0.4,
}

# Default notification preferences
DEFAULT_NOTIFICATION_PREFERENCES: Dict[str, Any] = {
    "email": {"enabled": True, "digest": False, "digest_interval_minutes": 60},
    "slack": {"enabled": True, "digest": False, "digest_interval_minutes": 30},
    "teams": {"enabled": True, "digest": True, "digest_interval_minutes": 30},
    "dnd_start": "22:00",
    "dnd_end": "07:00",
    "smart_filter": True,
    "min_priority_during_dnd": EmailPriority.CRITICAL,
}

# Communication-style profile defaults
DEFAULT_STYLE_PROFILE: Dict[str, Any] = {
    "tone": "professional",
    "formality_score": 0.7,
    "avg_response_length_words": 85,
    "greeting_preference": "Hi {name},",
    "sign_off_preference": "Best regards,",
    "uses_emoji": False,
    "vocabulary_complexity": "moderate",
    "response_speed_category": "prompt",
    "samples_analysed": 0,
}

# VIP senders get automatic priority boost
VIP_SENDERS: List[str] = [
    "ceo@company.com",
    "cto@company.com",
    "manager@company.com",
    "hr@company.com",
]


# ---------------------------------------------------------------------------
# Data classes for internal message representation
# ---------------------------------------------------------------------------

@dataclass
class EmailMessage:
    """Represents a single email message."""
    id: str
    sender: str
    recipients: List[str]
    subject: str
    body: str
    timestamp: datetime
    is_read: bool = False
    priority: str = EmailPriority.MEDIUM
    labels: List[str] = field(default_factory=list)
    attachments: List[str] = field(default_factory=list)
    thread_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    sentiment_score: float = 0.0


@dataclass
class ChatMessage:
    """Represents a chat message from Slack / Teams / etc."""
    id: str
    platform: str
    channel: str
    sender: str
    text: str
    timestamp: datetime
    thread_id: Optional[str] = None
    is_mention: bool = False
    reactions: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# CommunicationAgent
# ---------------------------------------------------------------------------

class CommunicationAgent(BaseAgent):
    """
    NEXUS AI Communication Agent.

    Manages all aspects of the user's digital communication — email, chat
    platforms, notifications — and learns the user's writing style to draft
    context-appropriate responses automatically.

    Handlers
    --------
    - compose_email      : Draft or send an email
    - check_inbox        : Retrieve and display inbox status
    - auto_reply         : Generate an automatic reply to a message
    - summarize_thread   : Summarize an email or chat thread
    - chat_response      : Generate a chat response for Slack / Teams
    - notification_management : Adjust notification preferences
    - communication_style : Analyse or update writing-style profile
    - general            : Catch-all for general communication queries
    """

    def __init__(self, event_bus_instance=None):
        super().__init__(
            name="CommunicationAgent",
            description=(
                "Manages email, chat, notifications, and learns your "
                "communication style to draft responses that sound like you."
            ),
            event_bus_instance=event_bus_instance,
        )

        # --- Internal state ---------------------------------------------------
        self._inbox: List[EmailMessage] = []
        self._sent: List[EmailMessage] = []
        self._chat_history: Dict[str, List[ChatMessage]] = {}
        self._style_profile: Dict[str, Any] = dict(DEFAULT_STYLE_PROFILE)
        self._notification_prefs: Dict[str, Any] = dict(DEFAULT_NOTIFICATION_PREFERENCES)
        self._contact_interaction_count: Dict[str, int] = {}
        self._auto_reply_enabled: bool = False
        self._auto_reply_message: Optional[str] = None
        self._notification_queue: List[Dict[str, Any]] = []

        # Seed a demo inbox so the agent has data to work with immediately
        self._seed_demo_inbox()
        logger.info("CommunicationAgent initialised with demo inbox data.")

    # ------------------------------------------------------------------
    # BaseAgent interface
    # ------------------------------------------------------------------

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the set of capabilities this agent provides."""
        return [
            AgentCapability.CHAT,
            AgentCapability.ANALYZE,
            AgentCapability.GENERATE,
            AgentCapability.MONITOR,
            AgentCapability.AUTOMATE,
            AgentCapability.LEARN,
            AgentCapability.NOTIFY,
            AgentCapability.SUMMARIZE,
        ]

    def get_system_prompt(self) -> str:
        """Return the system prompt defining this agent's persona."""
        return (
            "You are NEXUS Communication Agent — an expert at managing "
            "emails, chat messages, and notifications. You learn the user's "
            "writing style and draft responses that sound authentically like "
            "them. You classify email importance, summarise long threads, "
            "detect sentiment, and keep the user's communication channels "
            "organised and under control."
        )

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Route the user's message to the appropriate handler based on
        detected intent, then return a formatted AgentResponse.
        """
        message = context.message.strip()
        intent = self._detect_intent(message)
        logger.debug(f"CommunicationAgent detected intent: {intent}")

        handler_map = {
            "compose_email": self._handle_compose_email,
            "check_inbox": self._handle_check_inbox,
            "auto_reply": self._handle_auto_reply,
            "summarize_thread": self._handle_summarize_thread,
            "chat_response": self._handle_chat_response,
            "notification_management": self._handle_notification_management,
            "communication_style": self._handle_communication_style,
            "general": self._handle_general,
        }

        handler = handler_map.get(intent, self._handle_general)
        return await handler(context)

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_intent(self, message: str) -> str:
        """
        Classify the user's message into one of the supported intents.

        Uses keyword / pattern matching against a ranked list of intent
        signatures.  Returns the best-matching intent string.

        Parameters
        ----------
        message : str
            Raw user message.

        Returns
        -------
        str
            One of: compose_email, check_inbox, auto_reply,
            summarize_thread, chat_response, notification_management,
            communication_style, general.
        """
        lower = message.lower()

        intent_patterns: List[Tuple[str, List[str]]] = [
            ("compose_email", [
                r"\bcompose\b", r"\bdraft\b", r"\bwrite\s+(?:an?\s+)?email\b",
                r"\bsend\s+(?:an?\s+)?email\b", r"\bemail\s+to\b",
                r"\bnew\s+email\b", r"\breply\s+to\b.*email",
            ]),
            ("check_inbox", [
                r"\binbox\b", r"\bcheck\s+(?:my\s+)?mail\b",
                r"\bunread\b", r"\bnew\s+(?:emails?|messages?)\b",
                r"\bmail\s+status\b", r"\bemail\s+status\b",
            ]),
            ("auto_reply", [
                r"\bauto[\s-]?reply\b", r"\bout[\s-]?of[\s-]?office\b",
                r"\bautomatic\s+reply\b", r"\bauto[\s-]?respond\b",
                r"\bset\s+.*reply\b",
            ]),
            ("summarize_thread", [
                r"\bsummar", r"\bdigest\b", r"\bthread\b",
                r"\btl;?dr\b", r"\bcondense\b", r"\bbrief\b",
                r"\brecap\b", r"\bkey\s+points\b",
            ]),
            ("chat_response", [
                r"\bslack\b", r"\bteams\b", r"\bchat\b",
                r"\bdiscord\b", r"\bmessage\s+(on|in)\b",
                r"\breply\s+(on|in)\s+(slack|teams|discord)\b",
            ]),
            ("notification_management", [
                r"\bnotif", r"\bdo\s+not\s+disturb\b", r"\bdnd\b",
                r"\bmute\b", r"\bunmute\b", r"\bsilence\b",
                r"\bdigest\s+mode\b", r"\bquiet\s+hours\b",
            ]),
            ("communication_style", [
                r"\bstyle\b", r"\btone\b", r"\bwriting\s+style\b",
                r"\bformality\b", r"\blearn\s+.*style\b",
                r"\bhow\s+do\s+i\s+write\b",
            ]),
        ]

        best_intent = "general"
        best_score = 0

        for intent, patterns in intent_patterns:
            score = sum(1 for p in patterns if re.search(p, lower))
            if score > best_score:
                best_score = score
                best_intent = intent

        return best_intent

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_compose_email(self, context: AgentContext) -> AgentResponse:
        """
        Handle email composition requests.

        Extracts recipient, subject, and body cues from the user's message
        and drafts an email matching the user's communication style.
        """
        message = context.message
        recipient = self._extract_email_address(message) or "recipient@example.com"
        subject = self._extract_subject(message) or "Follow-up"
        body_cue = self._extract_body_cue(message) or message

        # Build draft using learned style
        draft_body = self._draft_in_user_style(body_cue, recipient)

        draft = EmailMessage(
            id=f"draft-{len(self._sent) + 1}",
            sender="you@nexus.ai",
            recipients=[recipient],
            subject=subject,
            body=draft_body,
            timestamp=datetime.utcnow(),
        )
        self._sent.append(draft)

        content = (
            "## ✉️ Email Draft Ready\n\n"
            f"**To:** {recipient}  \n"
            f"**Subject:** {subject}  \n\n"
            "---\n\n"
            f"{draft_body}\n\n"
            "---\n\n"
            "_Say **send it** to deliver, or provide edits._"
        )

        logger.info(f"Composed email draft to {recipient} | subject='{subject}'")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.88,
            metadata={"intent": "compose_email", "recipient": recipient, "subject": subject},
            suggestions=[
                "Send this email",
                "Change the subject line",
                "Make it more formal",
                "Add an attachment",
            ],
        )

    async def _handle_check_inbox(self, context: AgentContext) -> AgentResponse:
        """
        Handle inbox status requests.

        Returns an overview of unread emails, priority breakdown, and
        highlights the most urgent messages.
        """
        unread = [e for e in self._inbox if not e.is_read]
        total = len(self._inbox)
        unread_count = len(unread)

        # Priority breakdown
        priority_counts: Dict[str, int] = {}
        for email in unread:
            priority_counts[email.priority] = priority_counts.get(email.priority, 0) + 1

        # Build markdown
        lines = [
            "## 📬 Inbox Overview\n",
            f"**Total emails:** {total}  ",
            f"**Unread:** {unread_count}\n",
            "### Priority Breakdown\n",
            "| Priority | Count |",
            "|----------|-------|",
        ]
        for pri in [EmailPriority.CRITICAL, EmailPriority.HIGH,
                     EmailPriority.MEDIUM, EmailPriority.LOW, EmailPriority.SPAM]:
            count = priority_counts.get(pri, 0)
            if count:
                lines.append(f"| {pri.capitalize()} | {count} |")

        # Top urgent emails
        urgent = sorted(unread, key=lambda e: self._priority_sort_key(e.priority))[:5]
        if urgent:
            lines.append("\n### 🔥 Top Priority Messages\n")
            for idx, email in enumerate(urgent, 1):
                sentiment_icon = self._sentiment_icon(email.sentiment_score)
                lines.append(
                    f"{idx}. **{email.subject}** — from *{email.sender}* "
                    f"({email.priority}) {sentiment_icon}"
                )

        content = "\n".join(lines)
        logger.info(f"Inbox checked: {unread_count} unread of {total} total")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.95,
            metadata={"intent": "check_inbox", "unread": unread_count, "total": total},
            suggestions=[
                "Show only critical emails",
                "Summarise the top thread",
                "Auto-reply to low-priority emails",
                "Mark all as read",
            ],
        )

    async def _handle_auto_reply(self, context: AgentContext) -> AgentResponse:
        """
        Enable, disable, or configure automatic replies.

        Supports out-of-office messages and smart auto-responses that
        use the user's communication style.
        """
        lower = context.message.lower()

        if any(kw in lower for kw in ["disable", "off", "stop", "cancel"]):
            self._auto_reply_enabled = False
            self._auto_reply_message = None
            content = (
                "## 🔕 Auto-Reply Disabled\n\n"
                "Automatic replies have been turned **off**. "
                "You will need to respond to messages manually."
            )
            logger.info("Auto-reply disabled.")
        else:
            # Extract or generate auto-reply message
            custom_msg = self._extract_body_cue(context.message)
            if custom_msg and len(custom_msg) > 20:
                self._auto_reply_message = custom_msg
            else:
                self._auto_reply_message = (
                    "Thank you for your message. I'm currently unavailable "
                    "and will respond as soon as possible. For urgent matters, "
                    "please contact my team directly."
                )
            self._auto_reply_enabled = True

            content = (
                "## ✅ Auto-Reply Enabled\n\n"
                "**Message:**\n\n"
                f"> {self._auto_reply_message}\n\n"
                "I'll automatically respond to incoming emails with this message. "
                "Say **disable auto-reply** to turn it off."
            )
            logger.info("Auto-reply enabled.")

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.92,
            metadata={
                "intent": "auto_reply",
                "enabled": self._auto_reply_enabled,
            },
            suggestions=[
                "Customise the auto-reply message",
                "Set auto-reply for Slack too",
                "Schedule auto-reply for next week",
            ],
        )

    async def _handle_summarize_thread(self, context: AgentContext) -> AgentResponse:
        """
        Summarize an email thread or chat conversation.

        Extracts key decisions, open questions, action items, and
        participant contributions.
        """
        # Determine which thread to summarise
        thread_emails = self._find_thread(context.message)

        if not thread_emails:
            thread_emails = self._inbox[:5]  # Fallback: latest 5

        participants = list({e.sender for e in thread_emails})
        total_messages = len(thread_emails)

        # Build a synthetic summary (production would use LLM)
        decisions = self._extract_decisions(thread_emails)
        action_items = self._extract_action_items(thread_emails)
        open_questions = self._extract_open_questions(thread_emails)

        lines = [
            "## 📋 Thread Summary\n",
            f"**Messages:** {total_messages}  ",
            f"**Participants:** {', '.join(participants)}\n",
        ]

        if decisions:
            lines.append("### ✅ Key Decisions\n")
            for d in decisions:
                lines.append(f"- {d}")

        if action_items:
            lines.append("\n### 📌 Action Items\n")
            for a in action_items:
                lines.append(f"- [ ] {a}")

        if open_questions:
            lines.append("\n### ❓ Open Questions\n")
            for q in open_questions:
                lines.append(f"- {q}")

        # Sentiment overview
        avg_sentiment = (
            sum(e.sentiment_score for e in thread_emails) / max(total_messages, 1)
        )
        sentiment_label = self._sentiment_label(avg_sentiment)
        lines.append(f"\n**Overall Sentiment:** {sentiment_label}")

        content = "\n".join(lines)
        logger.info(f"Summarised thread with {total_messages} messages.")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={
                "intent": "summarize_thread",
                "message_count": total_messages,
                "participants": participants,
            },
            suggestions=[
                "Expand on the action items",
                "Reply to the thread",
                "Forward summary to team",
            ],
        )

    async def _handle_chat_response(self, context: AgentContext) -> AgentResponse:
        """
        Generate a context-aware chat response for Slack, Teams, etc.

        The response is drafted in the user's learned communication style
        and adapted to the platform's typical message length and tone.
        """
        platform = self._detect_platform(context.message)
        channel = self._extract_channel(context.message) or "#general"
        body_cue = self._extract_body_cue(context.message) or context.message

        # Adjust style for chat (shorter, less formal)
        chat_draft = self._draft_chat_response(body_cue, platform)

        # Store in chat history
        chat_msg = ChatMessage(
            id=f"chat-{random.randint(1000, 9999)}",
            platform=platform,
            channel=channel,
            sender="you",
            text=chat_draft,
            timestamp=datetime.utcnow(),
        )
        self._chat_history.setdefault(platform, []).append(chat_msg)

        content = (
            f"## 💬 {platform.capitalize()} Response Draft\n\n"
            f"**Channel:** {channel}  \n"
            f"**Platform:** {platform.capitalize()}\n\n"
            "---\n\n"
            f"{chat_draft}\n\n"
            "---\n\n"
            "_Say **send** to post, or provide edits._"
        )

        logger.info(f"Chat response drafted for {platform} #{channel}")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.84,
            metadata={"intent": "chat_response", "platform": platform, "channel": channel},
            suggestions=[
                "Make it shorter",
                f"Send it to {channel}",
                "Add a reaction instead",
                "Translate to Spanish",
            ],
        )

    async def _handle_notification_management(self, context: AgentContext) -> AgentResponse:
        """
        View or update notification preferences.

        Supports enabling/disabling per-platform, setting DND windows,
        switching to digest mode, and smart filtering.
        """
        lower = context.message.lower()
        changes_made: List[str] = []

        # Do-Not-Disturb toggle
        if "dnd" in lower or "do not disturb" in lower:
            if any(kw in lower for kw in ["off", "disable", "stop"]):
                self._notification_prefs["dnd_start"] = None
                self._notification_prefs["dnd_end"] = None
                changes_made.append("Do-Not-Disturb **disabled**")
            else:
                self._notification_prefs["dnd_start"] = "22:00"
                self._notification_prefs["dnd_end"] = "07:00"
                changes_made.append("Do-Not-Disturb set to **22:00 – 07:00**")

        # Digest mode
        if "digest" in lower:
            for plat in SUPPORTED_PLATFORMS[:3]:
                if plat in self._notification_prefs:
                    self._notification_prefs[plat]["digest"] = True
            changes_made.append("Digest mode **enabled** for email, Slack, Teams")

        # Mute / unmute platforms
        for plat in SUPPORTED_PLATFORMS:
            if plat in lower:
                if "mute" in lower or "silence" in lower:
                    if plat in self._notification_prefs:
                        self._notification_prefs[plat]["enabled"] = False
                    changes_made.append(f"**{plat.capitalize()}** notifications muted")
                elif "unmute" in lower or "enable" in lower:
                    if plat in self._notification_prefs:
                        self._notification_prefs[plat]["enabled"] = True
                    changes_made.append(f"**{plat.capitalize()}** notifications enabled")

        # Build response
        if changes_made:
            body = "## 🔔 Notification Preferences Updated\n\n"
            for change in changes_made:
                body += f"- {change}\n"
        else:
            body = self._render_notification_status()

        logger.info(f"Notification management: {len(changes_made)} changes applied.")
        return AgentResponse(
            content=body,
            agent_name=self.name,
            confidence=0.90,
            metadata={"intent": "notification_management", "changes": changes_made},
            suggestions=[
                "Enable digest mode",
                "Mute Slack notifications",
                "Set quiet hours 23:00–06:00",
                "Show current settings",
            ],
        )

    async def _handle_communication_style(self, context: AgentContext) -> AgentResponse:
        """
        Analyse or update the user's communication-style profile.

        If the user provides sample text, the agent ingests it to refine
        the style model.  Otherwise it displays the current profile.
        """
        message = context.message
        lower = message.lower()

        # Check if user wants to feed sample text
        if any(kw in lower for kw in ["learn", "analyse", "analyze", "update", "train"]):
            sample = self._extract_body_cue(message) or message
            self._ingest_style_sample(sample)
            content = (
                "## 🧠 Style Profile Updated\n\n"
                "I've analysed your sample and updated your communication style profile.\n\n"
                + self._render_style_profile()
            )
        else:
            content = (
                "## 🎨 Your Communication Style Profile\n\n"
                + self._render_style_profile()
            )

        logger.info("Communication style profile accessed/updated.")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.87,
            metadata={"intent": "communication_style", "profile": self._style_profile},
            suggestions=[
                "Make my tone more casual",
                "Analyse my last 10 sent emails",
                "Show an example response in my style",
            ],
        )

    async def _handle_general(self, context: AgentContext) -> AgentResponse:
        """
        Catch-all handler for general communication queries.

        Provides a helpful overview and suggests specific actions.
        """
        unread_count = sum(1 for e in self._inbox if not e.is_read)
        total_chats = sum(len(msgs) for msgs in self._chat_history.values())

        content = (
            "## 📡 NEXUS Communication Hub\n\n"
            f"**Unread Emails:** {unread_count}  \n"
            f"**Chat Messages Tracked:** {total_chats}  \n"
            f"**Auto-Reply:** {'Enabled' if self._auto_reply_enabled else 'Disabled'}  \n"
            f"**Style Profile Tone:** {self._style_profile['tone'].capitalize()}\n\n"
            "### What can I help with?\n\n"
            "- 📧 **Compose or send** an email\n"
            "- 📬 **Check your inbox** for new messages\n"
            "- 🔁 **Set up auto-replies** for when you're away\n"
            "- 📋 **Summarise** email threads or chat conversations\n"
            "- 💬 **Draft chat responses** for Slack or Teams\n"
            "- 🔔 **Manage notifications** and quiet hours\n"
            "- 🎨 **Analyse your writing style** for smarter drafts\n"
        )

        logger.info("General communication overview requested.")
        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.75,
            metadata={"intent": "general"},
            suggestions=[
                "Check my inbox",
                "Compose an email",
                "Summarise my latest thread",
                "Show my writing style profile",
            ],
        )

    # ------------------------------------------------------------------
    # Email importance classification
    # ------------------------------------------------------------------

    def _classify_email_priority(self, email: EmailMessage) -> str:
        """
        Classify an email's priority using multiple signals.

        Signals considered:
        - Sender VIP status
        - Urgency keywords in subject and body
        - Attachment presence
        - CC list size
        - Historical interaction frequency with sender

        Parameters
        ----------
        email : EmailMessage
            The email to classify.

        Returns
        -------
        str
            Priority level from EmailPriority.
        """
        score = 0.0

        # VIP sender boost
        if email.sender in VIP_SENDERS:
            score += 0.4

        # Urgency keywords
        combined_text = f"{email.subject} {email.body}".lower()
        for keyword, weight in URGENCY_KEYWORDS.items():
            if keyword in combined_text:
                score += weight * 0.3  # Scale down since multiple can match

        # Attachments indicate substance
        if email.attachments:
            score += 0.1

        # Large CC list may dilute importance
        if len(email.recipients) > 10:
            score -= 0.1

        # Interaction frequency
        interaction_count = self._contact_interaction_count.get(email.sender, 0)
        if interaction_count > 20:
            score += 0.15
        elif interaction_count > 5:
            score += 0.05

        # Map score to priority tier
        if score >= 0.7:
            return EmailPriority.CRITICAL
        elif score >= 0.45:
            return EmailPriority.HIGH
        elif score >= 0.2:
            return EmailPriority.MEDIUM
        elif score >= 0.0:
            return EmailPriority.LOW
        else:
            return EmailPriority.SPAM

    # ------------------------------------------------------------------
    # Sentiment analysis
    # ------------------------------------------------------------------

    def _analyse_sentiment(self, text: str) -> float:
        """
        Compute a sentiment score for the given text.

        Uses a keyword-based lexicon approach.  Returns a float in [-1, 1]
        where -1 is very negative and +1 is very positive.

        Parameters
        ----------
        text : str
            The text to analyse.

        Returns
        -------
        float
            Sentiment score between -1.0 and 1.0.
        """
        lower = text.lower()
        total_score = 0.0
        matches = 0

        for word, polarity in SENTIMENT_LEXICON.items():
            count = lower.count(word)
            if count > 0:
                total_score += polarity * count
                matches += count

        if matches == 0:
            return 0.0

        # Normalise to [-1, 1]
        normalised = max(-1.0, min(1.0, total_score / max(matches, 1)))
        return round(normalised, 3)

    def _sentiment_label(self, score: float) -> str:
        """Convert a numeric sentiment score to a human label."""
        if score >= 0.4:
            return "😊 Very Positive"
        elif score >= 0.15:
            return "🙂 Positive"
        elif score > -0.15:
            return "😐 Neutral"
        elif score > -0.4:
            return "😟 Negative"
        else:
            return "😠 Very Negative"

    def _sentiment_icon(self, score: float) -> str:
        """Return a single emoji representing sentiment."""
        if score >= 0.3:
            return "😊"
        elif score >= 0.0:
            return "😐"
        else:
            return "😟"

    # ------------------------------------------------------------------
    # Communication-style learning
    # ------------------------------------------------------------------

    def _ingest_style_sample(self, text: str) -> None:
        """
        Analyse a text sample and update the user's communication-style
        profile accordingly.

        Examines word count, sentence length, formality indicators,
        greeting/sign-off patterns, and emoji usage.

        Parameters
        ----------
        text : str
            A representative sample of the user's writing.
        """
        words = text.split()
        word_count = len(words)
        sentences = re.split(r'[.!?]+', text)
        sentence_count = max(len([s for s in sentences if s.strip()]), 1)
        avg_sentence_len = word_count / sentence_count

        # Update running average response length
        prev_samples = self._style_profile["samples_analysed"]
        prev_avg = self._style_profile["avg_response_length_words"]
        new_avg = ((prev_avg * prev_samples) + word_count) / (prev_samples + 1)
        self._style_profile["avg_response_length_words"] = round(new_avg)
        self._style_profile["samples_analysed"] = prev_samples + 1

        # Formality heuristics
        formal_markers = ["sincerely", "regards", "dear", "pursuant", "attached", "herewith"]
        informal_markers = ["hey", "hi", "lol", "gonna", "wanna", "btw", "omg", "haha"]
        formal_hits = sum(1 for m in formal_markers if m in text.lower())
        informal_hits = sum(1 for m in informal_markers if m in text.lower())

        if formal_hits > informal_hits:
            self._style_profile["tone"] = "formal"
            self._style_profile["formality_score"] = min(1.0, 0.7 + formal_hits * 0.05)
        elif informal_hits > formal_hits:
            self._style_profile["tone"] = "casual"
            self._style_profile["formality_score"] = max(0.0, 0.4 - informal_hits * 0.05)
        else:
            self._style_profile["tone"] = "professional"
            self._style_profile["formality_score"] = 0.6

        # Emoji usage
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "]+", flags=re.UNICODE,
        )
        self._style_profile["uses_emoji"] = bool(emoji_pattern.search(text))

        # Vocabulary complexity (simple heuristic: avg word length)
        avg_word_len = sum(len(w) for w in words) / max(word_count, 1)
        if avg_word_len >= 6.5:
            self._style_profile["vocabulary_complexity"] = "advanced"
        elif avg_word_len >= 4.5:
            self._style_profile["vocabulary_complexity"] = "moderate"
        else:
            self._style_profile["vocabulary_complexity"] = "simple"

        # Detect greeting preference
        greeting_match = re.match(r"^(hi|hey|hello|dear|good\s+\w+)[,!]?\s*", text, re.I)
        if greeting_match:
            self._style_profile["greeting_preference"] = greeting_match.group(0).strip() + " {name},"

        # Detect sign-off preference
        signoff_match = re.search(
            r"(best regards|regards|cheers|thanks|thank you|sincerely|warm regards|best)[,.]?\s*$",
            text, re.I | re.MULTILINE,
        )
        if signoff_match:
            self._style_profile["sign_off_preference"] = signoff_match.group(1).strip().title() + ","

        logger.debug(f"Style profile updated: {self._style_profile}")

    def _render_style_profile(self) -> str:
        """Render the communication-style profile as markdown."""
        p = self._style_profile
        return (
            f"| Attribute | Value |\n"
            f"|-----------|-------|\n"
            f"| Tone | {p['tone'].capitalize()} |\n"
            f"| Formality | {p['formality_score']:.0%} |\n"
            f"| Avg Response Length | ~{p['avg_response_length_words']} words |\n"
            f"| Greeting | {p['greeting_preference']} |\n"
            f"| Sign-off | {p['sign_off_preference']} |\n"
            f"| Uses Emoji | {'Yes' if p['uses_emoji'] else 'No'} |\n"
            f"| Vocabulary | {p['vocabulary_complexity'].capitalize()} |\n"
            f"| Samples Analysed | {p['samples_analysed']} |\n"
        )

    # ------------------------------------------------------------------
    # Drafting helpers
    # ------------------------------------------------------------------

    def _draft_in_user_style(self, body_cue: str, recipient: str) -> str:
        """
        Draft an email body that matches the user's communication style.

        Applies greeting, sign-off, and tone adjustments based on the
        stored style profile.

        Parameters
        ----------
        body_cue : str
            The core message or topic to address.
        recipient : str
            Recipient's email address (used for greeting personalisation).

        Returns
        -------
        str
            The complete email body text.
        """
        profile = self._style_profile
        name = recipient.split("@")[0].replace(".", " ").title()
        greeting = profile["greeting_preference"].format(name=name)
        sign_off = profile["sign_off_preference"]

        # Adjust body based on formality
        if profile["formality_score"] >= 0.7:
            body = (
                f"I hope this message finds you well. "
                f"I wanted to reach out regarding: {body_cue}\n\n"
                f"Please let me know if you have any questions or require "
                f"further information."
            )
        elif profile["formality_score"] >= 0.4:
            body = (
                f"Just wanted to follow up on this: {body_cue}\n\n"
                f"Let me know your thoughts when you get a chance."
            )
        else:
            body = (
                f"Quick note about: {body_cue}\n\n"
                f"Lmk what you think!"
            )

        return f"{greeting}\n\n{body}\n\n{sign_off}"

    def _draft_chat_response(self, body_cue: str, platform: str) -> str:
        """
        Draft a short chat response appropriate for the specified platform.

        Chat messages are typically shorter and less formal than emails.

        Parameters
        ----------
        body_cue : str
            Context or topic for the response.
        platform : str
            Target platform (slack, teams, discord, etc.).

        Returns
        -------
        str
            The drafted chat message.
        """
        profile = self._style_profile

        if profile["tone"] == "casual":
            response = f"Hey! RE: {body_cue} — sounds good, let's do it 👍"
        elif profile["tone"] == "formal":
            response = f"Thank you for raising this. Regarding {body_cue}, I'll follow up shortly."
        else:
            response = f"Got it — regarding {body_cue}, I'll take a look and get back to you."

        # Platform-specific adjustments
        if platform == "slack":
            response = response.replace("RE:", ">")
        elif platform == "teams":
            response = f"📌 {response}"

        return response

    # ------------------------------------------------------------------
    # Extraction utilities
    # ------------------------------------------------------------------

    def _extract_email_address(self, text: str) -> Optional[str]:
        """Extract the first email address found in the text."""
        match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
        return match.group(0) if match else None

    def _extract_subject(self, text: str) -> Optional[str]:
        """Extract an email subject from phrases like 'subject: ...' or 'about ...'."""
        match = re.search(r'(?:subject|about|regarding|re)[:\s]+([^.!?\n]{5,80})', text, re.I)
        return match.group(1).strip() if match else None

    def _extract_body_cue(self, text: str) -> Optional[str]:
        """Extract the core body cue after common prefixes are stripped."""
        # Remove command-like prefixes
        cleaned = re.sub(
            r'^(compose|draft|write|send|reply|email|message|chat)\s+(an?\s+)?(email|message|reply)?\s*(to\s+\S+\s*)?',
            '', text, flags=re.I,
        ).strip()
        return cleaned if len(cleaned) > 10 else None

    def _extract_channel(self, text: str) -> Optional[str]:
        """Extract a channel reference like #general from the text."""
        match = re.search(r'#([\w-]+)', text)
        return f"#{match.group(1)}" if match else None

    def _detect_platform(self, text: str) -> str:
        """Detect which chat platform the user is referring to."""
        lower = text.lower()
        for platform in SUPPORTED_PLATFORMS:
            if platform in lower:
                return platform
        return "slack"  # Default

    # ------------------------------------------------------------------
    # Thread helpers
    # ------------------------------------------------------------------

    def _find_thread(self, message: str) -> List[EmailMessage]:
        """
        Locate an email thread matching keywords in the user's message.

        Falls back to the most recent emails if no match is found.
        """
        keywords = set(re.findall(r'\b\w{4,}\b', message.lower()))
        # Remove common stop-words
        keywords -= {"this", "that", "with", "from", "about", "thread", "summarize",
                      "summary", "email", "please", "could", "would", "should"}

        if not keywords:
            return []

        scored: List[Tuple[float, EmailMessage]] = []
        for email in self._inbox:
            text = f"{email.subject} {email.body}".lower()
            match_count = sum(1 for kw in keywords if kw in text)
            if match_count > 0:
                scored.append((match_count, email))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [email for _, email in scored[:8]]

    def _extract_decisions(self, emails: List[EmailMessage]) -> List[str]:
        """Extract decision-like statements from a thread."""
        decisions = []
        decision_cues = ["decided", "agreed", "approved", "confirmed", "will proceed", "go ahead"]
        for email in emails:
            for cue in decision_cues:
                if cue in email.body.lower():
                    decisions.append(
                        f"{email.sender.split('@')[0].title()}: "
                        f"{self._extract_sentence_with(email.body, cue)}"
                    )
        return decisions[:5]

    def _extract_action_items(self, emails: List[EmailMessage]) -> List[str]:
        """Extract action items from a thread."""
        items = []
        action_cues = ["please", "need to", "action required", "to-do", "follow up",
                        "deadline", "by end of", "make sure", "can you"]
        for email in emails:
            for cue in action_cues:
                if cue in email.body.lower():
                    items.append(
                        f"{self._extract_sentence_with(email.body, cue)} "
                        f"(from {email.sender.split('@')[0].title()})"
                    )
        return items[:5]

    def _extract_open_questions(self, emails: List[EmailMessage]) -> List[str]:
        """Extract open questions from a thread."""
        questions = []
        for email in emails:
            sentences = re.split(r'[.!]+', email.body)
            for s in sentences:
                if "?" in s:
                    questions.append(s.strip())
        return questions[:5]

    def _extract_sentence_with(self, text: str, keyword: str) -> str:
        """Return the sentence containing a particular keyword."""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for s in sentences:
            if keyword in s.lower():
                return s.strip()
        return text[:120]

    # ------------------------------------------------------------------
    # Notification helpers
    # ------------------------------------------------------------------

    def _render_notification_status(self) -> str:
        """Render current notification settings as markdown."""
        prefs = self._notification_prefs
        lines = [
            "## 🔔 Current Notification Settings\n",
            "| Setting | Value |",
            "|---------|-------|",
        ]

        for plat in SUPPORTED_PLATFORMS[:3]:
            if plat in prefs:
                p = prefs[plat]
                status = "✅ On" if p.get("enabled") else "❌ Off"
                digest = "📦 Digest" if p.get("digest") else "⚡ Instant"
                lines.append(f"| {plat.capitalize()} | {status} / {digest} |")

        dnd_start = prefs.get("dnd_start")
        dnd_end = prefs.get("dnd_end")
        if dnd_start and dnd_end:
            lines.append(f"| Do-Not-Disturb | 🌙 {dnd_start} – {dnd_end} |")
        else:
            lines.append("| Do-Not-Disturb | Off |")

        smart = "✅ On" if prefs.get("smart_filter") else "❌ Off"
        lines.append(f"| Smart Filter | {smart} |")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Priority sorting
    # ------------------------------------------------------------------

    @staticmethod
    def _priority_sort_key(priority: str) -> int:
        """
        Map a priority string to a sort-friendly integer.

        Lower values sort first (higher priority).
        """
        order = {
            EmailPriority.CRITICAL: 0,
            EmailPriority.HIGH: 1,
            EmailPriority.MEDIUM: 2,
            EmailPriority.LOW: 3,
            EmailPriority.SPAM: 4,
        }
        return order.get(priority, 5)

    # ------------------------------------------------------------------
    # Demo data seeding
    # ------------------------------------------------------------------

    def _seed_demo_inbox(self) -> None:
        """
        Populate the inbox with realistic demo emails for immediate use.

        Each email is classified for priority and analysed for sentiment
        so that inbox views are rich from the start.
        """
        now = datetime.utcnow()
        demo_emails = [
            {
                "sender": "ceo@company.com",
                "recipients": ["you@nexus.ai"],
                "subject": "Q4 Strategy Review — Action Required",
                "body": (
                    "Team, the board has approved the Q4 roadmap. Please review "
                    "the attached deck and confirm your department milestones by "
                    "Friday. This is critical to our annual planning. Thank you."
                ),
                "attachments": ["Q4_Strategy_Deck.pdf"],
            },
            {
                "sender": "alice.dev@company.com",
                "recipients": ["you@nexus.ai", "bob@company.com"],
                "subject": "Bug in production — needs immediate fix",
                "body": (
                    "Hey, we have a critical bug in the authentication module. "
                    "Users are getting locked out intermittently. Can you look "
                    "into this ASAP? I've attached the error logs. The issue "
                    "started after yesterday's deployment."
                ),
                "attachments": ["error_logs.txt"],
            },
            {
                "sender": "newsletter@techdigest.com",
                "recipients": ["you@nexus.ai"],
                "subject": "This Week in AI — Feb 2026 Roundup",
                "body": (
                    "Welcome to your weekly AI digest! This week: new transformer "
                    "architectures, open-source LLM benchmarks, and the latest "
                    "in autonomous agents. No rush — enjoy at your leisure."
                ),
                "attachments": [],
            },
            {
                "sender": "manager@company.com",
                "recipients": ["you@nexus.ai"],
                "subject": "1:1 Agenda — Please add your topics",
                "body": (
                    "Hi, our 1:1 is scheduled for Thursday. Please add any topics "
                    "you'd like to discuss to the shared doc. I'd like to follow "
                    "up on the project timeline and resource allocation. Thanks!"
                ),
                "attachments": [],
            },
            {
                "sender": "hr@company.com",
                "recipients": ["all-staff@company.com"],
                "subject": "Updated Leave Policy — Effective March 1",
                "body": (
                    "Dear colleagues, please find attached the updated leave "
                    "policy document. Key changes include increased parental "
                    "leave and a new mental health day allowance. Please review "
                    "and reach out with any questions."
                ),
                "attachments": ["Leave_Policy_v3.pdf"],
            },
            {
                "sender": "client.support@external.com",
                "recipients": ["you@nexus.ai"],
                "subject": "RE: Integration issue — still unresolved",
                "body": (
                    "We are extremely frustrated that this integration issue has "
                    "not been resolved after two weeks. Our customers are affected "
                    "and we need a fix immediately. This is unacceptable and we "
                    "are considering escalating to your management."
                ),
                "attachments": [],
            },
            {
                "sender": "noreply@github.com",
                "recipients": ["you@nexus.ai"],
                "subject": "[nexus-ai] PR #347 merged",
                "body": (
                    "Pull request #347 'Add communication agent module' has been "
                    "merged into main by @dev-lead. Great work on the comprehensive "
                    "test coverage! The CI pipeline passed all checks."
                ),
                "attachments": [],
            },
        ]

        for idx, data in enumerate(demo_emails):
            email = EmailMessage(
                id=f"email-{idx + 1:04d}",
                sender=data["sender"],
                recipients=data["recipients"],
                subject=data["subject"],
                body=data["body"],
                timestamp=now - timedelta(hours=random.randint(1, 72)),
                attachments=data.get("attachments", []),
                thread_id=f"thread-{idx + 1:04d}",
            )
            # Classify and score
            email.sentiment_score = self._analyse_sentiment(email.body)
            email.priority = self._classify_email_priority(email)
            self._inbox.append(email)

            # Track sender interactions
            self._contact_interaction_count[email.sender] = (
                self._contact_interaction_count.get(email.sender, 0)
                + random.randint(1, 15)
            )

        logger.debug(f"Seeded {len(demo_emails)} demo emails into inbox.")
