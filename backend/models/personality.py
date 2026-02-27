"""
Nexus AI OS - Personality Model
Big Five personality tracking, communication style learning, vocabulary analysis,
tone calibration, mood correlation, and personality profile evolution.
"""

import json
import logging
import math
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("nexus.models.personality")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BIG_FIVE_TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]

DEFAULT_BIG_FIVE: Dict[str, float] = {t: 0.5 for t in BIG_FIVE_TRAITS}

FORMALITY_MARKERS_HIGH = {
    "furthermore", "therefore", "consequently", "nevertheless", "regarding",
    "accordingly", "moreover", "hence", "thus", "whereby", "henceforth",
    "notwithstanding", "per", "kindly", "sincerely", "respectfully",
}

FORMALITY_MARKERS_LOW = {
    "hey", "lol", "gonna", "wanna", "kinda", "nah", "yep", "yeah", "nope",
    "cool", "awesome", "dude", "yo", "sup", "omg", "btw", "imo", "tbh",
    "bruh", "lit", "vibe", "chill", "bro",
}

HUMOR_MARKERS = {
    "haha", "hehe", "lol", "lmao", "rofl", "😂", "🤣", "😄", "jk",
    "just kidding", "funny", "hilarious", "joke", ":)", ";)", "xd",
}

EMOJI_PATTERN = re.compile(
    "[\U0001f600-\U0001f64f\U0001f300-\U0001f5ff"
    "\U0001f680-\U0001f6ff\U0001f1e0-\U0001f1ff"
    "\U00002702-\U000027b0\U0000fe0f]+",
    flags=re.UNICODE,
)

POSITIVE_WORDS = {
    "good", "great", "love", "happy", "amazing", "wonderful", "excellent",
    "fantastic", "brilliant", "awesome", "nice", "perfect", "beautiful",
    "glad", "pleased", "thankful", "grateful", "enjoy", "excited",
}

NEGATIVE_WORDS = {
    "bad", "terrible", "hate", "sad", "awful", "horrible", "angry",
    "annoyed", "frustrated", "disappointed", "worried", "stressed",
    "upset", "tired", "bored", "anxious", "miserable", "depressed",
}


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z']+|[\U0001f600-\U0001faff]", text.lower())


def _word_overlap(tokens: List[str], word_set: set) -> float:
    if not tokens:
        return 0.0
    return sum(1 for t in tokens if t in word_set) / len(tokens)


def _average_word_length(tokens: List[str]) -> float:
    alpha = [t for t in tokens if t.isalpha()]
    if not alpha:
        return 0.0
    return sum(len(t) for t in alpha) / len(alpha)


def _sentence_count(text: str) -> int:
    return max(len(re.split(r"[.!?]+", text.strip())), 1)


# ---------------------------------------------------------------------------
# Personality profile
# ---------------------------------------------------------------------------


class PersonalityProfile:
    """Stores and evolves a user's personality profile over time."""

    def __init__(self) -> None:
        self.big_five: Dict[str, float] = dict(DEFAULT_BIG_FIVE)
        self.formality: float = 0.5
        self.humor_level: float = 0.3
        self.emoji_frequency: float = 0.1
        self.avg_message_length: float = 50.0
        self.vocabulary_richness: float = 0.5
        self.detail_preference: float = 0.5
        self.sentiment_baseline: float = 0.0  # -1..1
        self.preferred_tone: str = "neutral"  # neutral, warm, professional, casual
        self.time_patterns: Dict[str, Dict[str, float]] = {
            "morning": {"activity": 0.5, "mood": 0.0},
            "afternoon": {"activity": 0.5, "mood": 0.0},
            "evening": {"activity": 0.5, "mood": 0.0},
            "night": {"activity": 0.5, "mood": 0.0},
        }
        self.top_words: Counter = Counter()
        self.topic_interests: Counter = Counter()
        self.message_count: int = 0
        self.last_updated: Optional[str] = None
        self._history: List[Dict[str, Any]] = []

    # -- serialisation -------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        return {
            "big_five": dict(self.big_five),
            "formality": self.formality,
            "humor_level": self.humor_level,
            "emoji_frequency": self.emoji_frequency,
            "avg_message_length": self.avg_message_length,
            "vocabulary_richness": self.vocabulary_richness,
            "detail_preference": self.detail_preference,
            "sentiment_baseline": self.sentiment_baseline,
            "preferred_tone": self.preferred_tone,
            "time_patterns": self.time_patterns,
            "top_words": dict(self.top_words.most_common(100)),
            "topic_interests": dict(self.topic_interests.most_common(50)),
            "message_count": self.message_count,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PersonalityProfile":
        p = cls()
        p.big_five = data.get("big_five", dict(DEFAULT_BIG_FIVE))
        p.formality = data.get("formality", 0.5)
        p.humor_level = data.get("humor_level", 0.3)
        p.emoji_frequency = data.get("emoji_frequency", 0.1)
        p.avg_message_length = data.get("avg_message_length", 50.0)
        p.vocabulary_richness = data.get("vocabulary_richness", 0.5)
        p.detail_preference = data.get("detail_preference", 0.5)
        p.sentiment_baseline = data.get("sentiment_baseline", 0.0)
        p.preferred_tone = data.get("preferred_tone", "neutral")
        p.time_patterns = data.get("time_patterns", p.time_patterns)
        p.top_words = Counter(data.get("top_words", {}))
        p.topic_interests = Counter(data.get("topic_interests", {}))
        p.message_count = data.get("message_count", 0)
        p.last_updated = data.get("last_updated")
        return p


# ---------------------------------------------------------------------------
# Main model
# ---------------------------------------------------------------------------


class PersonalityModel:
    """Analyses user messages to build and evolve a personality profile."""

    def __init__(self, persist_path: str = "./data/personality.json") -> None:
        self.persist_path = persist_path
        self.profile = PersonalityProfile()
        self._ema_alpha = 0.05  # exponential moving average weight for updates
        self.load()

    # -- persistence ---------------------------------------------------------

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.persist_path), exist_ok=True)
        with open(self.persist_path, "w") as f:
            json.dump(self.profile.to_dict(), f, indent=2)
        logger.debug("Personality profile saved to %s", self.persist_path)

    def load(self) -> bool:
        if not os.path.exists(self.persist_path):
            return False
        try:
            with open(self.persist_path) as f:
                data = json.load(f)
            self.profile = PersonalityProfile.from_dict(data)
            logger.info("Personality profile loaded (%d messages analysed)", self.profile.message_count)
            return True
        except Exception as exc:
            logger.error("Failed to load personality profile: %s", exc)
            return False

    # -- analysis entry point ------------------------------------------------

    def analyse_message(self, text: str, timestamp: Optional[datetime] = None) -> Dict[str, Any]:
        ts = timestamp or datetime.now(timezone.utc)
        tokens = _tokenize(text)
        analysis = {
            "formality": self._measure_formality(tokens),
            "humor": self._detect_humor(tokens, text),
            "emoji_count": len(EMOJI_PATTERN.findall(text)),
            "sentiment": self._measure_sentiment(tokens),
            "message_length": len(text),
            "word_count": len(tokens),
            "avg_word_len": _average_word_length(tokens),
            "sentence_count": _sentence_count(text),
            "vocabulary_richness": len(set(tokens)) / max(len(tokens), 1),
        }

        self._update_profile(analysis, tokens, ts)
        self.profile.message_count += 1
        self.profile.last_updated = ts.isoformat()
        self.profile._history.append({"ts": ts.isoformat(), **analysis})
        if len(self.profile._history) > 500:
            self.profile._history = self.profile._history[-500:]

        if self.profile.message_count % 20 == 0:
            self.save()

        return analysis

    # -- individual measurements --------------------------------------------

    def _measure_formality(self, tokens: List[str]) -> float:
        high = _word_overlap(tokens, FORMALITY_MARKERS_HIGH)
        low = _word_overlap(tokens, FORMALITY_MARKERS_LOW)
        avg_len = _average_word_length(tokens)
        length_score = min(avg_len / 8.0, 1.0)
        score = 0.4 * length_score + 0.3 * high - 0.3 * low + 0.3 * 0.5
        return max(0.0, min(1.0, score))

    def _detect_humor(self, tokens: List[str], raw: str) -> float:
        marker_count = sum(1 for t in tokens if t in HUMOR_MARKERS)
        raw_lower = raw.lower()
        marker_count += sum(1 for m in HUMOR_MARKERS if m in raw_lower and len(m) > 2)
        score = min(marker_count / max(len(tokens), 1) * 5.0, 1.0)
        return score

    def _measure_sentiment(self, tokens: List[str]) -> float:
        pos = _word_overlap(tokens, POSITIVE_WORDS)
        neg = _word_overlap(tokens, NEGATIVE_WORDS)
        return max(-1.0, min(1.0, (pos - neg) * 5.0))

    # -- profile update (EMA) -----------------------------------------------

    def _ema(self, old: float, new: float) -> float:
        return old * (1 - self._ema_alpha) + new * self._ema_alpha

    def _update_profile(self, analysis: Dict[str, Any], tokens: List[str], ts: datetime) -> None:
        p = self.profile
        p.formality = self._ema(p.formality, analysis["formality"])
        p.humor_level = self._ema(p.humor_level, analysis["humor"])
        emoji_rate = analysis["emoji_count"] / max(analysis["word_count"], 1)
        p.emoji_frequency = self._ema(p.emoji_frequency, emoji_rate)
        p.avg_message_length = self._ema(p.avg_message_length, analysis["message_length"])
        p.vocabulary_richness = self._ema(p.vocabulary_richness, analysis["vocabulary_richness"])
        p.sentiment_baseline = self._ema(p.sentiment_baseline, analysis["sentiment"])

        # detail preference from sentence count and message length
        detail_signal = min(analysis["sentence_count"] / 5.0, 1.0)
        p.detail_preference = self._ema(p.detail_preference, detail_signal)

        # preferred tone inference
        if p.formality > 0.65:
            p.preferred_tone = "professional"
        elif p.formality < 0.35:
            p.preferred_tone = "casual"
        elif p.humor_level > 0.4:
            p.preferred_tone = "warm"
        else:
            p.preferred_tone = "neutral"

        # time-of-day patterns
        hour = ts.hour
        if 5 <= hour < 12:
            period = "morning"
        elif 12 <= hour < 17:
            period = "afternoon"
        elif 17 <= hour < 22:
            period = "evening"
        else:
            period = "night"
        tp = p.time_patterns[period]
        tp["activity"] = self._ema(tp["activity"], 1.0)
        tp["mood"] = self._ema(tp["mood"], analysis["sentiment"])
        # decay other periods slightly
        for other_period in p.time_patterns:
            if other_period != period:
                p.time_patterns[other_period]["activity"] = self._ema(
                    p.time_patterns[other_period]["activity"], 0.0
                )

        # vocabulary tracking
        alpha_tokens = [t for t in tokens if t.isalpha() and len(t) > 2]
        p.top_words.update(alpha_tokens)

        # Big Five rough heuristic updates
        self._update_big_five(analysis, tokens)

    def _update_big_five(self, analysis: Dict[str, Any], tokens: List[str]) -> None:
        p = self.profile

        # Openness: vocabulary richness + diverse topics
        openness_signal = analysis["vocabulary_richness"]
        p.big_five["openness"] = self._ema(p.big_five["openness"], openness_signal)

        # Conscientiousness: message length, sentence structure
        consc_signal = min(analysis["sentence_count"] / 4.0, 1.0) * 0.6 + (
            1.0 if analysis["avg_word_len"] > 5 else 0.4
        ) * 0.4
        p.big_five["conscientiousness"] = self._ema(p.big_five["conscientiousness"], consc_signal)

        # Extraversion: message length, emoji usage, exclamation marks
        extra_signal = min(analysis["emoji_count"] / 3.0, 1.0) * 0.4 + min(
            analysis["message_length"] / 200.0, 1.0
        ) * 0.3 + (analysis["humor"] * 0.3)
        p.big_five["extraversion"] = self._ema(p.big_five["extraversion"], extra_signal)

        # Agreeableness: positive sentiment, thanking words
        agree_signal = max(0, analysis["sentiment"]) * 0.6 + (
            0.4 if any(t in tokens for t in ("thanks", "thank", "please", "appreciate")) else 0.0
        )
        p.big_five["agreeableness"] = self._ema(p.big_five["agreeableness"], min(agree_signal, 1.0))

        # Neuroticism: negative sentiment
        neuro_signal = max(0, -analysis["sentiment"])
        p.big_five["neuroticism"] = self._ema(p.big_five["neuroticism"], neuro_signal)

    # -- response calibration ------------------------------------------------

    def get_response_params(self) -> Dict[str, Any]:
        """Return LLM generation parameters calibrated to the user's personality."""
        p = self.profile
        temperature = 0.5 + p.big_five["openness"] * 0.4
        top_p = 0.85 + p.big_five["openness"] * 0.1
        params: Dict[str, Any] = {
            "temperature": round(temperature, 2),
            "top_p": round(min(top_p, 0.99), 2),
            "personality_traits": {
                "formality": round(p.formality, 2),
                "humor": round(p.humor_level, 2),
                "detail": round(p.detail_preference, 2),
            },
            "preferred_tone": p.preferred_tone,
            "emoji_ok": p.emoji_frequency > 0.05,
        }
        return params

    def get_system_prompt_hints(self) -> str:
        """Return hints to inject into the system prompt based on personality."""
        p = self.profile
        hints: List[str] = []

        tone_map = {
            "professional": "Maintain a formal, professional tone.",
            "casual": "Use a casual, friendly tone.",
            "warm": "Be warm and personable.",
            "neutral": "Use a balanced, neutral tone.",
        }
        hints.append(tone_map.get(p.preferred_tone, ""))

        if p.humor_level > 0.5:
            hints.append("The user appreciates humor; feel free to add wit.")
        if p.detail_preference > 0.6:
            hints.append("Provide detailed, thorough responses.")
        elif p.detail_preference < 0.3:
            hints.append("Keep responses concise and to the point.")
        if p.emoji_frequency > 0.1:
            hints.append("Occasional emoji usage is welcome.")
        if p.sentiment_baseline < -0.3:
            hints.append("The user may be stressed; be supportive and encouraging.")

        return " ".join(h for h in hints if h)

    def get_mood_for_period(self, period: str) -> Dict[str, float]:
        return self.profile.time_patterns.get(period, {"activity": 0.5, "mood": 0.0})

    def get_current_mood_context(self) -> Dict[str, Any]:
        hour = datetime.now(timezone.utc).hour
        if 5 <= hour < 12:
            period = "morning"
        elif 12 <= hour < 17:
            period = "afternoon"
        elif 17 <= hour < 22:
            period = "evening"
        else:
            period = "night"
        return {
            "period": period,
            **self.get_mood_for_period(period),
            "sentiment_baseline": self.profile.sentiment_baseline,
        }

    # -- vocabulary analysis -------------------------------------------------

    def get_vocabulary_stats(self) -> Dict[str, Any]:
        p = self.profile
        total_words = sum(p.top_words.values())
        unique_words = len(p.top_words)
        return {
            "total_words_seen": total_words,
            "unique_words": unique_words,
            "vocabulary_richness": round(p.vocabulary_richness, 3),
            "top_20_words": p.top_words.most_common(20),
            "avg_word_frequency": round(total_words / max(unique_words, 1), 2),
        }

    def get_topic_interests(self) -> List[Tuple[str, int]]:
        return self.profile.topic_interests.most_common(20)

    def record_topic(self, topic: str) -> None:
        self.profile.topic_interests[topic.lower()] += 1

    # -- profile summary -----------------------------------------------------

    def get_summary(self) -> Dict[str, Any]:
        p = self.profile
        return {
            "big_five": {k: round(v, 3) for k, v in p.big_five.items()},
            "formality": round(p.formality, 3),
            "humor_level": round(p.humor_level, 3),
            "emoji_frequency": round(p.emoji_frequency, 3),
            "detail_preference": round(p.detail_preference, 3),
            "preferred_tone": p.preferred_tone,
            "sentiment_baseline": round(p.sentiment_baseline, 3),
            "message_count": p.message_count,
            "vocabulary": self.get_vocabulary_stats(),
            "time_patterns": p.time_patterns,
            "current_mood": self.get_current_mood_context(),
        }

    def reset(self) -> None:
        self.profile = PersonalityProfile()
        self.save()
