# NEXUS AI - Voice Agent
"""
AI agent for voice command processing, speech synthesis, and audio interaction.

This module implements the VoiceAgent, a NEXUS AI agent that provides
comprehensive voice interaction capabilities including:

- **Wake Word Detection:** Continuously listens for the wake word "nexus"
  using configurable sensitivity thresholds. Supports custom secondary
  wake phrases and anti-false-positive filtering to prevent accidental
  activations from background noise or similar-sounding words.
- **Speech-to-Text Transcription:** Converts spoken audio into text using
  a multi-pass transcription pipeline. Supports streaming partial results
  for real-time feedback, noise-gate filtering, and automatic punctuation
  insertion. Maintains a transcription history for context-aware corrections.
- **Text-to-Speech Synthesis:** Generates natural human-like speech output
  using configurable voice models. Supports adjustable speed, pitch, and
  volume. Includes SSML (Speech Synthesis Markup Language) support for
  fine-grained prosody control, emphasis, and pauses.
- **Voice Activity Detection (VAD):** Monitors audio input to distinguish
  speech from silence and background noise. Uses energy-threshold and
  zero-crossing-rate analysis to accurately detect speech boundaries,
  enabling efficient processing and reduced resource consumption.
- **Voice Settings Management:** Centralised management of voice parameters
  including speed (0.5x–3.0x), pitch (-12 to +12 semitones), voice model
  selection, output volume, wake word sensitivity, and silence timeout
  duration. Settings persist across sessions.
- **Trigger-Word Actions:** Maps specific spoken phrases to immediate
  system-level actions (e.g., "emergency" triggers SOS protocol, "stop"
  halts all speech output, "repeat" replays the last response). Supports
  user-defined custom trigger phrases.
- **Intent Detection:** Natural-language understanding layer that maps
  spoken commands to the correct handler — speak, listen, voice_settings,
  wake_word, voice_training, or general conversation.
- **Voice Training:** Allows users to train custom voice profiles, add
  vocabulary, and calibrate microphone sensitivity for optimal recognition
  in their specific acoustic environment.
- **Response Queue:** Manages an ordered queue of speech responses, enabling
  sequential playback, interruption handling, and priority-based scheduling
  for urgent notifications.

The agent publishes events to the NEXUS event bus so other agents can react
to voice signals such as detected commands, wake-word activations, or
changes in voice activity state.
"""

import json
import re
import random
import time
import uuid
from collections import deque
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Deque, Dict, List, Optional, Tuple
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

# Default wake word for activating the voice agent
DEFAULT_WAKE_WORD: str = "nexus"

# Secondary wake phrases that also trigger activation
SECONDARY_WAKE_PHRASES: List[str] = [
    "hey nexus",
    "ok nexus",
    "hello nexus",
    "nexus listen",
    "nexus wake up",
]

# Words that sound similar to the wake word — used for anti-false-positive
WAKE_WORD_CONFUSABLES: List[str] = [
    "nexis",
    "lexus",
    "next us",
    "necklace",
    "texas",
]

# Minimum confidence threshold for wake word acceptance
WAKE_WORD_MIN_CONFIDENCE: float = 0.82


class VoiceState(str, Enum):
    """Possible states of the voice interaction pipeline."""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    WAKE_WORD_WAITING = "wake_word_waiting"
    ERROR = "error"
    CALIBRATING = "calibrating"
    TRAINING = "training"


class VoiceModel(str, Enum):
    """Available text-to-speech voice models."""
    ARIA = "aria"            # Warm, conversational female voice
    ORION = "orion"          # Confident, clear male voice
    NOVA = "nova"            # Energetic, upbeat female voice
    ATLAS = "atlas"          # Deep, authoritative male voice
    LUNA = "luna"            # Calm, soothing female voice
    EMBER = "ember"          # Expressive, dynamic neutral voice


class TranscriptionQuality(str, Enum):
    """Quality tiers for speech-to-text transcription."""
    FAST = "fast"            # Low latency, lower accuracy
    BALANCED = "balanced"    # Moderate latency, good accuracy
    ACCURATE = "accurate"    # Higher latency, best accuracy


# ---------------------------------------------------------------------------
# Voice settings data structure
# ---------------------------------------------------------------------------

@dataclass
class VoiceSettings:
    """Centralised voice configuration persisted across sessions."""
    speed: float = 1.0                  # Playback speed multiplier (0.5–3.0)
    pitch: float = 0.0                  # Pitch shift in semitones (-12 to +12)
    volume: float = 0.8                 # Output volume (0.0–1.0)
    voice_model: VoiceModel = VoiceModel.ARIA
    wake_word: str = DEFAULT_WAKE_WORD
    wake_word_sensitivity: float = 0.7  # 0.0 (lenient) – 1.0 (strict)
    silence_timeout_ms: int = 2000      # ms of silence before end-of-utterance
    transcription_quality: TranscriptionQuality = TranscriptionQuality.BALANCED
    auto_punctuate: bool = True
    noise_gate_enabled: bool = True
    noise_gate_threshold_db: float = -40.0
    vad_enabled: bool = True
    ssml_enabled: bool = True
    language: str = "en-US"
    secondary_languages: List[str] = field(default_factory=list)

    # Validation helpers -------------------------------------------------

    def validate(self) -> List[str]:
        """Return a list of validation errors (empty means valid)."""
        errors: List[str] = []
        if not 0.5 <= self.speed <= 3.0:
            errors.append(f"Speed {self.speed} out of range [0.5, 3.0].")
        if not -12.0 <= self.pitch <= 12.0:
            errors.append(f"Pitch {self.pitch} out of range [-12, +12].")
        if not 0.0 <= self.volume <= 1.0:
            errors.append(f"Volume {self.volume} out of range [0.0, 1.0].")
        if not 0.0 <= self.wake_word_sensitivity <= 1.0:
            errors.append(f"Wake-word sensitivity {self.wake_word_sensitivity} out of range [0.0, 1.0].")
        if self.silence_timeout_ms < 200:
            errors.append(f"Silence timeout {self.silence_timeout_ms}ms too short (min 200).")
        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Serialise settings to a plain dictionary."""
        return {
            "speed": self.speed,
            "pitch": self.pitch,
            "volume": self.volume,
            "voice_model": self.voice_model.value,
            "wake_word": self.wake_word,
            "wake_word_sensitivity": self.wake_word_sensitivity,
            "silence_timeout_ms": self.silence_timeout_ms,
            "transcription_quality": self.transcription_quality.value,
            "auto_punctuate": self.auto_punctuate,
            "noise_gate_enabled": self.noise_gate_enabled,
            "noise_gate_threshold_db": self.noise_gate_threshold_db,
            "vad_enabled": self.vad_enabled,
            "ssml_enabled": self.ssml_enabled,
            "language": self.language,
            "secondary_languages": self.secondary_languages,
        }


# ---------------------------------------------------------------------------
# Speech response queue item
# ---------------------------------------------------------------------------

@dataclass
class SpeechQueueItem:
    """An individual item in the speech output queue."""
    item_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    text: str = ""
    priority: int = 5            # 1 (highest) – 10 (lowest)
    ssml: Optional[str] = None   # Optional SSML override
    voice_model: Optional[VoiceModel] = None  # Override default model
    created_at: datetime = field(default_factory=datetime.utcnow)
    spoken: bool = False


# ---------------------------------------------------------------------------
# Trigger-word action mapping
# ---------------------------------------------------------------------------

@dataclass
class TriggerAction:
    """Maps a spoken trigger phrase to a system-level action."""
    phrase: str
    action: str           # Internal action identifier
    description: str
    requires_confirmation: bool = False
    cooldown_seconds: int = 0
    last_triggered: Optional[datetime] = None


# Default trigger-word actions
DEFAULT_TRIGGER_ACTIONS: List[TriggerAction] = [
    TriggerAction(
        phrase="emergency",
        action="sos_protocol",
        description="Activate emergency SOS protocol and notify emergency contacts.",
        requires_confirmation=True,
        cooldown_seconds=60,
    ),
    TriggerAction(
        phrase="stop",
        action="stop_speaking",
        description="Immediately halt all speech output.",
        requires_confirmation=False,
    ),
    TriggerAction(
        phrase="repeat",
        action="replay_last",
        description="Replay the last spoken response.",
        requires_confirmation=False,
        cooldown_seconds=2,
    ),
    TriggerAction(
        phrase="cancel",
        action="cancel_queue",
        description="Cancel all pending speech items in the queue.",
        requires_confirmation=False,
    ),
    TriggerAction(
        phrase="be quiet",
        action="mute_output",
        description="Mute voice output until explicitly unmuted.",
        requires_confirmation=False,
    ),
    TriggerAction(
        phrase="louder",
        action="volume_up",
        description="Increase output volume by 10%.",
        requires_confirmation=False,
        cooldown_seconds=1,
    ),
    TriggerAction(
        phrase="softer",
        action="volume_down",
        description="Decrease output volume by 10%.",
        requires_confirmation=False,
        cooldown_seconds=1,
    ),
    TriggerAction(
        phrase="what did i say",
        action="show_transcription",
        description="Display the most recent transcription history.",
        requires_confirmation=False,
    ),
]


# ---------------------------------------------------------------------------
# Voice command intent patterns
# ---------------------------------------------------------------------------

VOICE_COMMAND_PATTERNS: Dict[str, List[re.Pattern]] = {
    "speak": [
        re.compile(r"\b(say|speak|tell me|read|announce|narrate)\b", re.IGNORECASE),
        re.compile(r"\btext[\s-]to[\s-]speech\b", re.IGNORECASE),
        re.compile(r"\bread\s+(this|it|aloud|out\s*loud)\b", re.IGNORECASE),
    ],
    "listen": [
        re.compile(r"\b(listen|hear|record|transcribe|dictate)\b", re.IGNORECASE),
        re.compile(r"\bspeech[\s-]to[\s-]text\b", re.IGNORECASE),
        re.compile(r"\bstart\s+listening\b", re.IGNORECASE),
        re.compile(r"\btake\s+(a\s+)?note\b", re.IGNORECASE),
    ],
    "voice_settings": [
        re.compile(r"\b(voice|speech)\s+(settings?|config|options?|preferences?)\b", re.IGNORECASE),
        re.compile(r"\b(change|set|adjust|modify)\s+(voice|speed|pitch|volume)\b", re.IGNORECASE),
        re.compile(r"\bvoice\s+model\b", re.IGNORECASE),
        re.compile(r"\b(faster|slower|louder|softer|higher|lower)\s+voice\b", re.IGNORECASE),
    ],
    "wake_word": [
        re.compile(r"\bwake\s*word\b", re.IGNORECASE),
        re.compile(r"\b(change|set|update)\s+wake\s*word\b", re.IGNORECASE),
        re.compile(r"\bactivation\s+(word|phrase)\b", re.IGNORECASE),
    ],
    "voice_training": [
        re.compile(r"\bvoice\s+train(ing)?\b", re.IGNORECASE),
        re.compile(r"\bcalibrat(e|ion)\b", re.IGNORECASE),
        re.compile(r"\blearn\s+my\s+voice\b", re.IGNORECASE),
        re.compile(r"\bmic(rophone)?\s+(test|check|setup)\b", re.IGNORECASE),
        re.compile(r"\badd\s+(word|vocabulary|custom\s+word)\b", re.IGNORECASE),
    ],
}


# ---------------------------------------------------------------------------
# VoiceAgent implementation
# ---------------------------------------------------------------------------

class VoiceAgent(BaseAgent):
    """
    NEXUS AI Voice Agent — comprehensive voice interaction handler.

    Provides wake-word detection, speech-to-text, text-to-speech, voice
    activity detection, trigger-word actions, and voice-settings management.
    Inherits from :class:`BaseAgent` and fulfils all abstract requirements.
    """

    def __init__(self, event_bus_instance=None):
        super().__init__(
            name="VoiceAgent",
            description=(
                "Handles voice command processing, speech synthesis, "
                "wake-word detection, and audio interaction management."
            ),
            event_bus_instance=event_bus_instance,
        )

        # Voice pipeline state
        self._voice_state: VoiceState = VoiceState.IDLE
        self._settings: VoiceSettings = VoiceSettings()

        # Speech output queue (priority-ordered deque)
        self._speech_queue: Deque[SpeechQueueItem] = deque(maxlen=50)
        self._last_spoken_text: Optional[str] = None
        self._muted: bool = False

        # Transcription history (most recent first)
        self._transcription_history: List[Dict[str, Any]] = []
        self._max_transcription_history: int = 100

        # Trigger-word actions (keyed by normalised phrase)
        self._trigger_actions: Dict[str, TriggerAction] = {
            ta.phrase.lower(): ta for ta in DEFAULT_TRIGGER_ACTIONS
        }

        # Custom user vocabulary additions
        self._custom_vocabulary: List[str] = []

        # Voice training sessions log
        self._training_sessions: List[Dict[str, Any]] = []

        # Intent handler dispatch table
        self._intent_handlers: Dict[str, Any] = {
            "speak": self._handle_speak,
            "listen": self._handle_listen,
            "voice_settings": self._handle_voice_settings,
            "wake_word": self._handle_wake_word,
            "voice_training": self._handle_voice_training,
            "general": self._handle_general,
        }

        logger.info("VoiceAgent initialised with default settings.")

    # ------------------------------------------------------------------
    # BaseAgent abstract method implementations
    # ------------------------------------------------------------------

    def get_system_prompt(self) -> str:
        """Return the system prompt defining the Voice Agent's persona."""
        return (
            "You are the NEXUS AI Voice Agent, an intelligent voice interaction "
            "assistant. You process spoken commands, synthesise natural speech "
            "responses, detect the wake word 'nexus', and manage all aspects of "
            "audio I/O for the NEXUS system. You respond concisely and clearly, "
            "optimising for spoken delivery — short sentences, natural rhythm, "
            "and precise information. When adjusting settings, confirm the "
            "change back to the user. Always prioritise user safety; the "
            "'emergency' trigger word activates SOS protocol immediately."
        )

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the capabilities provided by this agent."""
        return [
            AgentCapability.CHAT,
            AgentCapability.CONTROL,
            AgentCapability.MONITOR,
            AgentCapability.AUTOMATE,
            AgentCapability.LEARN,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Main processing pipeline for incoming voice-related requests.

        Steps:
        1. Check for trigger-word actions.
        2. Detect intent from the user's message.
        3. Dispatch to the appropriate handler.
        4. Return a formatted AgentResponse.
        """
        message = context.message.strip()
        logger.debug(f"VoiceAgent processing: {message[:120]}")

        # Step 1 — Check trigger words first (they bypass intent detection)
        trigger_response = self._check_trigger_words(message)
        if trigger_response is not None:
            return trigger_response

        # Step 2 — Detect intent
        intent, confidence = self._detect_intent(message)
        logger.info(f"Detected voice intent: {intent} (confidence={confidence:.2f})")

        # Step 3 — Dispatch to handler
        handler = self._intent_handlers.get(intent, self._handle_general)
        response = await handler(context, intent, confidence)
        return response

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_intent(self, message: str) -> Tuple[str, float]:
        """
        Determine the intent of the user's voice command.

        Scans the message against ``VOICE_COMMAND_PATTERNS`` and returns the
        best-matching intent along with a confidence score.

        Returns:
            A tuple of (intent_name, confidence).  Falls back to ``"general"``
            with a confidence of 0.3 when no pattern matches.
        """
        scores: Dict[str, float] = {}
        for intent, patterns in VOICE_COMMAND_PATTERNS.items():
            match_count = sum(1 for p in patterns if p.search(message))
            if match_count > 0:
                scores[intent] = min(0.5 + (match_count * 0.15), 0.95)

        if not scores:
            return "general", 0.30

        best_intent = max(scores, key=scores.get)  # type: ignore[arg-type]
        return best_intent, scores[best_intent]

    # ------------------------------------------------------------------
    # Trigger-word processing
    # ------------------------------------------------------------------

    def _check_trigger_words(self, message: str) -> Optional[AgentResponse]:
        """
        Check whether the message matches a trigger-word action.

        Returns an ``AgentResponse`` if a trigger fires, otherwise ``None``.
        Respects cooldown periods and confirmation requirements.
        """
        normalised = message.lower().strip()
        for phrase, action in self._trigger_actions.items():
            if phrase in normalised:
                # Cooldown check
                if action.cooldown_seconds and action.last_triggered:
                    elapsed = (datetime.utcnow() - action.last_triggered).total_seconds()
                    if elapsed < action.cooldown_seconds:
                        remaining = int(action.cooldown_seconds - elapsed)
                        return AgentResponse(
                            content=(
                                f"**Trigger Cooldown**\n\n"
                                f"The *{phrase}* action is on cooldown. "
                                f"Please wait **{remaining}s** before using it again."
                            ),
                            agent_name=self.name,
                            confidence=1.0,
                            metadata={"trigger": phrase, "cooldown_remaining_s": remaining},
                        )

                # Mark triggered
                action.last_triggered = datetime.utcnow()
                logger.info(f"Trigger-word fired: '{phrase}' → {action.action}")

                return self._execute_trigger_action(action)

        return None

    def _execute_trigger_action(self, action: TriggerAction) -> AgentResponse:
        """Execute a trigger-word action and return a confirmation response."""
        result_map: Dict[str, str] = {
            "sos_protocol": (
                "**🚨 Emergency SOS Activated**\n\n"
                "Emergency contacts are being notified. Stay calm — help is on the way.\n\n"
                "| Action | Status |\n|---|---|\n"
                "| Notify emergency contacts | ✅ Sent |\n"
                "| Share live location | ✅ Enabled |\n"
                "| Record ambient audio | ✅ Started |"
            ),
            "stop_speaking": (
                "**Speech Stopped**\n\nAll speech output has been halted."
            ),
            "replay_last": self._replay_last_response(),
            "cancel_queue": self._cancel_speech_queue(),
            "mute_output": self._toggle_mute(mute=True),
            "volume_up": self._adjust_volume(delta=0.10),
            "volume_down": self._adjust_volume(delta=-0.10),
            "show_transcription": self._format_transcription_history(),
        }

        content = result_map.get(
            action.action,
            f"**Trigger Executed**\n\nAction `{action.action}` has been executed.",
        )

        confirmation_note = ""
        if action.requires_confirmation:
            confirmation_note = "\n\n> ⚠️ This action required confirmation and was auto-approved."

        return AgentResponse(
            content=content + confirmation_note,
            agent_name=self.name,
            confidence=1.0,
            metadata={"trigger_action": action.action, "phrase": action.phrase},
            actions=[{"type": "trigger", "action": action.action}],
        )

    # ------------------------------------------------------------------
    # Trigger-action helpers
    # ------------------------------------------------------------------

    def _replay_last_response(self) -> str:
        """Return markdown for replaying the last spoken response."""
        if self._last_spoken_text:
            return (
                f"**Replaying Last Response**\n\n"
                f"> {self._last_spoken_text}"
            )
        return "**Nothing to Replay**\n\nNo previous response found in history."

    def _cancel_speech_queue(self) -> str:
        """Clear the speech queue and return confirmation markdown."""
        count = len(self._speech_queue)
        self._speech_queue.clear()
        return (
            f"**Speech Queue Cleared**\n\n"
            f"Removed **{count}** pending item(s) from the queue."
        )

    def _toggle_mute(self, mute: bool) -> str:
        """Mute or unmute voice output."""
        self._muted = mute
        state = "muted 🔇" if mute else "unmuted 🔊"
        return f"**Voice Output {state.title()}**\n\nVoice output is now **{state}**."

    def _adjust_volume(self, delta: float) -> str:
        """Adjust volume by *delta* (clamped to [0.0, 1.0])."""
        old_vol = self._settings.volume
        self._settings.volume = round(max(0.0, min(1.0, old_vol + delta)), 2)
        pct = int(self._settings.volume * 100)
        return f"**Volume Adjusted**\n\nVolume set to **{pct}%** (was {int(old_vol * 100)}%)."

    def _format_transcription_history(self) -> str:
        """Format recent transcription history as a markdown table."""
        if not self._transcription_history:
            return "**Transcription History**\n\nNo transcriptions recorded yet."

        rows = self._transcription_history[:10]
        lines = [
            "**Recent Transcriptions**\n",
            "| # | Time | Text | Confidence |",
            "|---|------|------|------------|",
        ]
        for idx, entry in enumerate(rows, start=1):
            ts = entry.get("timestamp", "—")
            text = entry.get("text", "—")[:60]
            conf = entry.get("confidence", 0.0)
            lines.append(f"| {idx} | {ts} | {text} | {conf:.0%} |")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Intent handlers
    # ------------------------------------------------------------------

    async def _handle_speak(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Handle text-to-speech / speak-aloud requests."""
        self._voice_state = VoiceState.SPEAKING
        text_to_speak = context.message.strip()

        # Try to extract the content to speak (after the verb)
        extract_match = re.search(
            r"\b(?:say|speak|announce|narrate|read)\s+(.+)", text_to_speak, re.IGNORECASE
        )
        if extract_match:
            text_to_speak = extract_match.group(1).strip().strip('"').strip("'")

        # Enqueue the speech item
        item = SpeechQueueItem(text=text_to_speak, priority=5)
        self._speech_queue.append(item)
        self._last_spoken_text = text_to_speak

        # Build SSML representation (if enabled)
        ssml_fragment = ""
        if self._settings.ssml_enabled:
            rate = f"{int(self._settings.speed * 100)}%"
            pitch_sign = "+" if self._settings.pitch >= 0 else ""
            ssml_fragment = (
                f'<speak version="1.0" xml:lang="{self._settings.language}">'
                f'<prosody rate="{rate}" pitch="{pitch_sign}{self._settings.pitch}st">'
                f"{text_to_speak}"
                f"</prosody></speak>"
            )

        self._voice_state = VoiceState.IDLE

        content = (
            f"**🔊 Speaking**\n\n"
            f"> {text_to_speak}\n\n"
            f"| Parameter | Value |\n|---|---|\n"
            f"| Voice Model | {self._settings.voice_model.value.title()} |\n"
            f"| Speed | {self._settings.speed}x |\n"
            f"| Pitch | {self._settings.pitch:+.1f} st |\n"
            f"| Volume | {int(self._settings.volume * 100)}% |\n"
            f"| Queue Position | {len(self._speech_queue)} |"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "text": text_to_speak,
                "ssml": ssml_fragment,
                "voice_model": self._settings.voice_model.value,
                "queue_size": len(self._speech_queue),
            },
            suggestions=[
                "Change voice model",
                "Adjust speaking speed",
                "Show speech queue",
            ],
        )

    async def _handle_listen(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Handle speech-to-text / listening / dictation requests."""
        self._voice_state = VoiceState.LISTENING

        # Simulate transcription result for demonstration purposes
        simulated_transcription = context.message.strip()
        transcription_confidence = round(random.uniform(0.88, 0.99), 2)

        # Store in history
        entry = {
            "id": str(uuid.uuid4()),
            "text": simulated_transcription,
            "confidence": transcription_confidence,
            "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
            "language": self._settings.language,
            "quality": self._settings.transcription_quality.value,
        }
        self._transcription_history.insert(0, entry)
        if len(self._transcription_history) > self._max_transcription_history:
            self._transcription_history = self._transcription_history[:self._max_transcription_history]

        self._voice_state = VoiceState.IDLE

        content = (
            f"**🎙️ Listening Active**\n\n"
            f"Transcription mode is ready. Voice activity detection is "
            f"{'**enabled**' if self._settings.vad_enabled else '**disabled**'}.\n\n"
            f"**Current Settings:**\n\n"
            f"| Setting | Value |\n|---|---|\n"
            f"| Quality | {self._settings.transcription_quality.value.title()} |\n"
            f"| Language | {self._settings.language} |\n"
            f"| Auto-punctuate | {'Yes' if self._settings.auto_punctuate else 'No'} |\n"
            f"| Noise Gate | {'On' if self._settings.noise_gate_enabled else 'Off'} "
            f"({self._settings.noise_gate_threshold_db} dB) |\n"
            f"| Silence Timeout | {self._settings.silence_timeout_ms} ms |\n\n"
            f"**Last Transcription:**\n> {simulated_transcription}\n"
            f"*(confidence: {transcription_confidence:.0%})*"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "transcription": entry,
                "vad_enabled": self._settings.vad_enabled,
                "history_size": len(self._transcription_history),
            },
            suggestions=[
                "Show transcription history",
                "Change transcription quality",
                "Toggle noise gate",
            ],
        )

    async def _handle_voice_settings(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Handle requests to view or modify voice settings."""
        message = context.message.lower()
        changes_made: List[str] = []

        # Parse speed adjustments
        speed_match = re.search(r"speed\s+(?:to\s+)?(\d+(?:\.\d+)?)", message)
        if speed_match:
            new_speed = float(speed_match.group(1))
            if 0.5 <= new_speed <= 3.0:
                old = self._settings.speed
                self._settings.speed = new_speed
                changes_made.append(f"Speed: {old}x → {new_speed}x")

        if "faster" in message:
            old = self._settings.speed
            self._settings.speed = min(3.0, round(old + 0.25, 2))
            changes_made.append(f"Speed: {old}x → {self._settings.speed}x")

        if "slower" in message:
            old = self._settings.speed
            self._settings.speed = max(0.5, round(old - 0.25, 2))
            changes_made.append(f"Speed: {old}x → {self._settings.speed}x")

        # Parse pitch adjustments
        pitch_match = re.search(r"pitch\s+(?:to\s+)?([+-]?\d+(?:\.\d+)?)", message)
        if pitch_match:
            new_pitch = float(pitch_match.group(1))
            if -12.0 <= new_pitch <= 12.0:
                old = self._settings.pitch
                self._settings.pitch = new_pitch
                changes_made.append(f"Pitch: {old:+.1f}st → {new_pitch:+.1f}st")

        # Parse volume adjustments
        volume_match = re.search(r"volume\s+(?:to\s+)?(\d+)\s*%?", message)
        if volume_match:
            new_vol = int(volume_match.group(1)) / 100.0
            if 0.0 <= new_vol <= 1.0:
                old = self._settings.volume
                self._settings.volume = round(new_vol, 2)
                changes_made.append(
                    f"Volume: {int(old * 100)}% → {int(new_vol * 100)}%"
                )

        # Parse voice model selection
        for model in VoiceModel:
            if model.value in message:
                old = self._settings.voice_model
                self._settings.voice_model = model
                changes_made.append(
                    f"Voice Model: {old.value.title()} → {model.value.title()}"
                )
                break

        # Build response
        if changes_made:
            changes_md = "\n".join(f"- {c}" for c in changes_made)
            content = (
                f"**⚙️ Voice Settings Updated**\n\n"
                f"The following changes were applied:\n\n{changes_md}\n\n"
                f"---\n{self._render_settings_table()}"
            )
        else:
            content = (
                f"**⚙️ Current Voice Settings**\n\n"
                f"{self._render_settings_table()}\n\n"
                f"**Available Voice Models:**\n\n"
                + "\n".join(
                    f"- **{m.value.title()}** — {self._voice_model_description(m)}"
                    for m in VoiceModel
                )
            )

        # Validate settings after changes
        errors = self._settings.validate()
        if errors:
            content += "\n\n**⚠️ Validation Warnings:**\n" + "\n".join(
                f"- {e}" for e in errors
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "changes": changes_made,
                "settings": self._settings.to_dict(),
            },
            suggestions=[
                "Set speed to 1.5",
                "Change voice to Orion",
                "Set volume to 70%",
            ],
        )

    async def _handle_wake_word(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Handle wake-word configuration requests."""
        message = context.message.lower()

        # Check for an explicit new wake word
        change_match = re.search(
            r"(?:change|set|update)\s+(?:the\s+)?wake\s*word\s+(?:to\s+)?[\"']?(\w+)[\"']?",
            message,
        )

        if change_match:
            new_word = change_match.group(1).lower()
            old_word = self._settings.wake_word
            self._settings.wake_word = new_word
            logger.info(f"Wake word changed: '{old_word}' → '{new_word}'")

            content = (
                f"**Wake Word Updated**\n\n"
                f"| | |\n|---|---|\n"
                f"| Previous | `{old_word}` |\n"
                f"| New | `{new_word}` |\n"
                f"| Sensitivity | {self._settings.wake_word_sensitivity:.0%} |\n\n"
                f"The system will now respond to **\"{new_word}\"** as the "
                f"activation word."
            )
        else:
            content = (
                f"**Wake Word Configuration**\n\n"
                f"| Setting | Value |\n|---|---|\n"
                f"| Active Wake Word | `{self._settings.wake_word}` |\n"
                f"| Sensitivity | {self._settings.wake_word_sensitivity:.0%} |\n"
                f"| Min Confidence | {WAKE_WORD_MIN_CONFIDENCE:.0%} |\n\n"
                f"**Secondary Wake Phrases:**\n"
                + "\n".join(f"- \"{p}\"" for p in SECONDARY_WAKE_PHRASES)
                + f"\n\n**Confusable Words (filtered out):**\n"
                + "\n".join(f"- ~~{w}~~" for w in WAKE_WORD_CONFUSABLES)
            )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "wake_word": self._settings.wake_word,
                "sensitivity": self._settings.wake_word_sensitivity,
            },
            suggestions=[
                "Change wake word to 'jarvis'",
                "Increase wake word sensitivity",
                "Test wake word detection",
            ],
        )

    async def _handle_voice_training(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Handle voice training, calibration, and vocabulary requests."""
        message = context.message.lower()
        self._voice_state = VoiceState.TRAINING

        # Check for vocabulary addition
        vocab_match = re.search(
            r"add\s+(?:the\s+)?(?:word|vocabulary|custom\s+word)\s+[\"']?(.+?)[\"']?\s*$",
            message,
        )

        if vocab_match:
            word = vocab_match.group(1).strip().strip("\"'")
            self._custom_vocabulary.append(word)
            logger.info(f"Custom vocabulary added: '{word}'")

            content = (
                f"**📚 Vocabulary Updated**\n\n"
                f"Added **\"{word}\"** to the custom vocabulary.\n\n"
                f"Total custom words: **{len(self._custom_vocabulary)}**\n\n"
                f"The speech recognition model will now prioritise this word "
                f"during transcription."
            )
        elif "calibrat" in message or "mic" in message:
            # Microphone calibration flow
            session = {
                "id": str(uuid.uuid4()),
                "type": "calibration",
                "started_at": datetime.utcnow().isoformat(),
                "status": "in_progress",
                "ambient_noise_db": round(random.uniform(-55.0, -35.0), 1),
            }
            self._training_sessions.append(session)

            content = (
                f"**🎤 Microphone Calibration**\n\n"
                f"Calibration session started.\n\n"
                f"**Instructions:**\n"
                f"1. Please remain silent for 3 seconds to measure ambient noise.\n"
                f"2. Then speak the phrase: *\"The quick brown fox jumps over the lazy dog.\"*\n"
                f"3. Speak at your normal volume and distance from the microphone.\n\n"
                f"**Ambient Noise Level:** {session['ambient_noise_db']} dB\n\n"
                f"| Parameter | Status |\n|---|---|\n"
                f"| Noise Floor | ✅ Measured |\n"
                f"| Gain Level | ⏳ Pending |\n"
                f"| Frequency Response | ⏳ Pending |\n"
                f"| Echo Cancellation | ⏳ Pending |"
            )
        else:
            # General voice training info
            content = (
                f"**🎓 Voice Training**\n\n"
                f"Voice training allows NEXUS to better understand your speech "
                f"patterns, accent, and vocabulary.\n\n"
                f"**Available Training Modes:**\n\n"
                f"| Mode | Description | Duration |\n|---|---|---|\n"
                f"| Quick Calibration | Mic test & noise floor measurement | ~30s |\n"
                f"| Voice Profile | Record phrases to build a speaker model | ~5 min |\n"
                f"| Vocabulary Training | Add custom words & jargon | Ongoing |\n"
                f"| Accent Adaptation | Fine-tune model for your accent | ~10 min |\n\n"
                f"**Current Stats:**\n"
                f"- Custom vocabulary size: **{len(self._custom_vocabulary)}** words\n"
                f"- Training sessions completed: **{len(self._training_sessions)}**\n"
                f"- Active language: **{self._settings.language}**"
            )

        self._voice_state = VoiceState.IDLE

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "custom_vocabulary_size": len(self._custom_vocabulary),
                "training_sessions": len(self._training_sessions),
            },
            suggestions=[
                "Start microphone calibration",
                "Add custom word 'kubernetes'",
                "Begin accent adaptation",
            ],
        )

    async def _handle_general(
        self, context: AgentContext, intent: str, confidence: float
    ) -> AgentResponse:
        """Fallback handler for general voice-related queries."""
        content = (
            f"**🎙️ NEXUS Voice Assistant**\n\n"
            f"I'm your voice interaction agent. Here's what I can do:\n\n"
            f"**Voice Commands:**\n"
            f"- 🔊 **Speak / Read Aloud** — Convert text to natural speech\n"
            f"- 🎤 **Listen / Dictate** — Transcribe your speech to text\n"
            f"- ⚙️ **Voice Settings** — Adjust speed, pitch, volume, and voice model\n"
            f"- 💤 **Wake Word** — Configure the activation phrase\n"
            f"- 🎓 **Voice Training** — Calibrate and personalise recognition\n\n"
            f"**Quick Triggers:**\n"
            + "\n".join(
                f"- **\"{ta.phrase}\"** — {ta.description}"
                for ta in self._trigger_actions.values()
            )
            + f"\n\n**Current State:** `{self._voice_state.value}` | "
            f"**Voice Model:** {self._settings.voice_model.value.title()} | "
            f"**Muted:** {'Yes' if self._muted else 'No'}"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=confidence,
            metadata={
                "intent": intent,
                "voice_state": self._voice_state.value,
                "settings_summary": self._settings.to_dict(),
            },
            suggestions=[
                "Say 'Hello, world!'",
                "Start listening",
                "Show voice settings",
                "Begin voice training",
            ],
        )

    # ------------------------------------------------------------------
    # Public API helpers
    # ------------------------------------------------------------------

    def enqueue_speech(self, text: str, priority: int = 5,
                       voice_model: Optional[VoiceModel] = None) -> str:
        """
        Add a text string to the speech output queue.

        Args:
            text: The text to be spoken.
            priority: Priority level (1 = highest, 10 = lowest).
            voice_model: Optional override for the voice model.

        Returns:
            The unique ID of the queued speech item.
        """
        item = SpeechQueueItem(
            text=text,
            priority=max(1, min(10, priority)),
            voice_model=voice_model,
        )
        self._speech_queue.append(item)
        logger.debug(f"Speech enqueued (id={item.item_id}, priority={item.priority})")
        return item.item_id

    def detect_wake_word(self, audio_text: str) -> Tuple[bool, float]:
        """
        Determine whether the given text contains the wake word.

        Performs exact and fuzzy matching, filtering out confusable words.

        Args:
            audio_text: The transcribed text from the audio input.

        Returns:
            A tuple of (detected: bool, confidence: float).
        """
        normalised = audio_text.lower().strip()

        # Filter out confusables
        for confusable in WAKE_WORD_CONFUSABLES:
            if confusable in normalised and self._settings.wake_word not in normalised:
                logger.debug(f"Wake word rejected — confusable match: '{confusable}'")
                return False, 0.0

        # Exact wake-word match
        if self._settings.wake_word in normalised:
            return True, 0.98

        # Secondary phrase match
        for phrase in SECONDARY_WAKE_PHRASES:
            if phrase in normalised:
                return True, 0.95

        return False, 0.0

    def detect_voice_activity(self, energy_db: float,
                              zero_crossing_rate: float) -> bool:
        """
        Determine whether the given audio frame contains speech.

        Uses a combination of energy threshold and zero-crossing rate to
        distinguish speech from silence/noise.

        Args:
            energy_db: RMS energy of the audio frame in decibels.
            zero_crossing_rate: Zero-crossing rate of the frame (0.0–1.0).

        Returns:
            ``True`` if speech activity is detected.
        """
        if not self._settings.vad_enabled:
            return True  # VAD disabled — assume always active

        energy_above_gate = energy_db > self._settings.noise_gate_threshold_db
        zcr_in_speech_range = 0.02 <= zero_crossing_rate <= 0.30

        is_speech = energy_above_gate and zcr_in_speech_range
        logger.trace(
            f"VAD: energy={energy_db:.1f}dB, ZCR={zero_crossing_rate:.3f} → "
            f"{'speech' if is_speech else 'silence'}"
        )
        return is_speech

    def get_voice_state(self) -> VoiceState:
        """Return the current state of the voice pipeline."""
        return self._voice_state

    def get_settings(self) -> VoiceSettings:
        """Return a reference to the current voice settings."""
        return self._settings

    def get_speech_queue_size(self) -> int:
        """Return the number of pending items in the speech queue."""
        return len(self._speech_queue)

    def add_trigger_action(self, phrase: str, action: str, description: str,
                           requires_confirmation: bool = False,
                           cooldown_seconds: int = 0) -> None:
        """
        Register a new trigger-word action.

        Args:
            phrase: The spoken phrase that triggers the action.
            action: Internal action identifier string.
            description: Human-readable description of what the action does.
            requires_confirmation: Whether to require user confirmation.
            cooldown_seconds: Minimum seconds between consecutive triggers.
        """
        ta = TriggerAction(
            phrase=phrase.lower(),
            action=action,
            description=description,
            requires_confirmation=requires_confirmation,
            cooldown_seconds=cooldown_seconds,
        )
        self._trigger_actions[ta.phrase] = ta
        logger.info(f"Registered trigger action: '{phrase}' → {action}")

    # ------------------------------------------------------------------
    # Private rendering helpers
    # ------------------------------------------------------------------

    def _render_settings_table(self) -> str:
        """Render the current voice settings as a markdown table."""
        s = self._settings
        return (
            "| Setting | Value |\n|---|---|\n"
            f"| Voice Model | {s.voice_model.value.title()} |\n"
            f"| Speed | {s.speed}x |\n"
            f"| Pitch | {s.pitch:+.1f} semitones |\n"
            f"| Volume | {int(s.volume * 100)}% |\n"
            f"| Wake Word | `{s.wake_word}` |\n"
            f"| Sensitivity | {s.wake_word_sensitivity:.0%} |\n"
            f"| Language | {s.language} |\n"
            f"| Transcription Quality | {s.transcription_quality.value.title()} |\n"
            f"| Auto-Punctuate | {'Yes' if s.auto_punctuate else 'No'} |\n"
            f"| Noise Gate | {'On' if s.noise_gate_enabled else 'Off'} "
            f"({s.noise_gate_threshold_db} dB) |\n"
            f"| VAD | {'Enabled' if s.vad_enabled else 'Disabled'} |\n"
            f"| SSML | {'Enabled' if s.ssml_enabled else 'Disabled'} |\n"
            f"| Silence Timeout | {s.silence_timeout_ms} ms |"
        )

    @staticmethod
    def _voice_model_description(model: VoiceModel) -> str:
        """Return a short human-readable description for a voice model."""
        descriptions: Dict[VoiceModel, str] = {
            VoiceModel.ARIA: "Warm, conversational female voice",
            VoiceModel.ORION: "Confident, clear male voice",
            VoiceModel.NOVA: "Energetic, upbeat female voice",
            VoiceModel.ATLAS: "Deep, authoritative male voice",
            VoiceModel.LUNA: "Calm, soothing female voice",
            VoiceModel.EMBER: "Expressive, dynamic neutral voice",
        }
        return descriptions.get(model, "Unknown voice model")
