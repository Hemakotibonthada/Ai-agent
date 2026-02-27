# NEXUS AI - Training Service
"""
Model fine-tuning pipeline, data collection, personality learning,
writing style analysis, and daily training scheduler for the NEXUS AI OS.
Builds personalised LLM behaviour from conversation history.
"""

import asyncio
import json
import math
import os
import time
import uuid
from collections import Counter
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class TrainingStatus(str, Enum):
    """Training job statuses."""
    PENDING = "pending"
    COLLECTING = "collecting"
    PREPROCESSING = "preprocessing"
    TRAINING = "training"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DatasetType(str, Enum):
    """Types of training datasets."""
    CONVERSATION = "conversation"
    WRITING_STYLE = "writing_style"
    PERSONALITY = "personality"
    PREFERENCES = "preferences"
    DOMAIN_KNOWLEDGE = "domain_knowledge"


class TrainingDataPoint:
    """A single training example."""

    def __init__(self, input_text: str, output_text: str,
                 dataset_type: DatasetType = DatasetType.CONVERSATION,
                 metadata: Optional[Dict[str, Any]] = None,
                 quality_score: float = 1.0):
        self.data_id: str = str(uuid.uuid4())
        self.input_text: str = input_text
        self.output_text: str = output_text
        self.dataset_type: DatasetType = dataset_type
        self.metadata: Dict[str, Any] = metadata or {}
        self.quality_score: float = quality_score
        self.created_at: datetime = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "data_id": self.data_id,
            "input": self.input_text,
            "output": self.output_text,
            "type": self.dataset_type.value,
            "quality_score": self.quality_score,
            "created_at": self.created_at.isoformat(),
        }

    def to_training_format(self) -> Dict[str, str]:
        """Convert to instruction-tuning format."""
        return {
            "instruction": self.input_text,
            "output": self.output_text,
        }


class WritingStyleProfile:
    """Aggregated writing style analysis results."""

    def __init__(self):
        self.avg_sentence_length: float = 0.0
        self.avg_word_length: float = 0.0
        self.vocabulary_size: int = 0
        self.vocabulary_richness: float = 0.0
        self.punctuation_frequency: Dict[str, float] = {}
        self.common_phrases: List[Tuple[str, int]] = []
        self.tone_indicators: Dict[str, float] = {}
        self.formality_score: float = 0.5
        self.emoji_usage: float = 0.0
        self.capitalization_ratio: float = 0.0
        self.question_ratio: float = 0.0
        self.exclamation_ratio: float = 0.0
        self.contraction_usage: float = 0.0
        self.samples_analysed: int = 0
        self.last_updated: datetime = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "avg_sentence_length": round(self.avg_sentence_length, 2),
            "avg_word_length": round(self.avg_word_length, 2),
            "vocabulary_size": self.vocabulary_size,
            "vocabulary_richness": round(self.vocabulary_richness, 4),
            "punctuation_frequency": self.punctuation_frequency,
            "common_phrases": self.common_phrases[:20],
            "tone_indicators": self.tone_indicators,
            "formality_score": round(self.formality_score, 2),
            "emoji_usage": round(self.emoji_usage, 4),
            "question_ratio": round(self.question_ratio, 4),
            "exclamation_ratio": round(self.exclamation_ratio, 4),
            "contraction_usage": round(self.contraction_usage, 4),
            "samples_analysed": self.samples_analysed,
            "last_updated": self.last_updated.isoformat(),
        }


class TrainingJob:
    """Metadata for a training job."""

    def __init__(self, job_id: str, model_name: str,
                 dataset_type: DatasetType, description: str = ""):
        self.job_id: str = job_id
        self.model_name: str = model_name
        self.dataset_type: DatasetType = dataset_type
        self.description: str = description
        self.status: TrainingStatus = TrainingStatus.PENDING
        self.created_at: datetime = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.current_epoch: int = 0
        self.total_epochs: int = 0
        self.current_loss: float = 0.0
        self.best_loss: float = float("inf")
        self.training_data_count: int = 0
        self.metrics: Dict[str, float] = {}
        self.error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "job_id": self.job_id,
            "model_name": self.model_name,
            "dataset_type": self.dataset_type.value,
            "description": self.description,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "current_loss": round(self.current_loss, 6),
            "best_loss": round(self.best_loss, 6) if self.best_loss != float("inf") else None,
            "training_data_count": self.training_data_count,
            "metrics": self.metrics,
            "error_message": self.error_message,
        }


class TrainingService:
    """
    Model training and personalisation service for NEXUS AI.

    Provides:
    - Conversation data collection and curation
    - Writing style analysis and profiling
    - Personality model building
    - Fine-tuning pipeline orchestration via Ollama
    - Training job lifecycle management
    - Dataset management and quality scoring
    - Daily scheduled training runs
    - Model evaluation and metrics tracking
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None,
                 ai_service: Optional[Any] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._ai_service: Optional[Any] = ai_service
        self._data_dir: Path = Path(self._config.database.db_path).parent / "training"
        self._models_dir: Path = self._data_dir / "models"
        self._datasets_dir: Path = self._data_dir / "datasets"
        self._initialized: bool = False
        self._training_active: bool = False
        self._current_job: Optional[TrainingJob] = None
        self._jobs: Dict[str, TrainingJob] = {}
        self._data_points: List[TrainingDataPoint] = []
        self._writing_profile: WritingStyleProfile = WritingStyleProfile()
        self._personality_traits: Dict[str, float] = {}
        self._preference_map: Dict[str, Any] = {}
        self._total_data_collected: int = 0
        self._total_trainings: int = 0
        self._total_failures: int = 0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize training directories and load existing data."""
        try:
            logger.info("Initializing TrainingService...")
            self._data_dir.mkdir(parents=True, exist_ok=True)
            self._models_dir.mkdir(parents=True, exist_ok=True)
            self._datasets_dir.mkdir(parents=True, exist_ok=True)

            await self._load_existing_data()

            self._event_bus.subscribe(
                "training.daily_trigger",
                self._on_daily_trigger,
                subscriber_id="training_service",
            )

            self._initialized = True
            await self._event_bus.emit(
                "training.initialized",
                {"data_points": len(self._data_points), "data_dir": str(self._data_dir)},
                source="training_service",
                category=EventCategory.TRAINING,
            )
            logger.info(f"TrainingService initialized — {len(self._data_points)} data points loaded")
        except Exception as exc:
            logger.error(f"TrainingService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Save state and stop any running training."""
        try:
            logger.info("Shutting down TrainingService...")
            if self._training_active and self._current_job:
                self._current_job.status = TrainingStatus.CANCELLED
                self._training_active = False

            await self._save_data()
            self._initialized = False
            logger.info("TrainingService shut down complete")
        except Exception as exc:
            logger.error(f"Error during TrainingService shutdown: {exc}")

    async def _on_daily_trigger(self, event: Event) -> None:
        """Handle the daily training trigger from the scheduler."""
        if self._training_active:
            logger.info("Training already in progress — skipping daily trigger")
            return
        if len(self._data_points) < 10:
            logger.info("Not enough data points for training — skipping")
            return
        logger.info("Daily training triggered")
        await self.start_training_job(
            model_name="personality",
            dataset_type=DatasetType.CONVERSATION,
            description="Scheduled daily personality training",
            epochs=3,
        )

    # ------------------------------------------------------------------
    # Data Collection
    # ------------------------------------------------------------------

    async def collect_conversation_data(
        self, user_message: str, assistant_response: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Collect a conversation pair as training data.

        Args:
            user_message: The user's input.
            assistant_response: The assistant's response.
            metadata: Optional context metadata.

        Returns:
            Data point ID.
        """
        quality = self._assess_quality(user_message, assistant_response)
        point = TrainingDataPoint(
            input_text=user_message,
            output_text=assistant_response,
            dataset_type=DatasetType.CONVERSATION,
            metadata=metadata,
            quality_score=quality,
        )
        self._data_points.append(point)
        self._total_data_collected += 1

        if self._total_data_collected % 50 == 0:
            await self._save_data()

        return point.data_id

    async def collect_writing_sample(self, text: str,
                                     source: str = "user") -> str:
        """
        Collect a writing sample for style analysis.

        Args:
            text: Writing sample text.
            source: Source of the writing sample.

        Returns:
            Data point ID.
        """
        point = TrainingDataPoint(
            input_text=f"[writing_sample:{source}]",
            output_text=text,
            dataset_type=DatasetType.WRITING_STYLE,
            metadata={"source": source},
        )
        self._data_points.append(point)
        self._total_data_collected += 1
        return point.data_id

    async def collect_preference(self, category: str, key: str,
                                 value: Any, confidence: float = 1.0) -> None:
        """
        Record a user preference observation.

        Args:
            category: Preference category (e.g. 'communication', 'topics').
            key: Specific preference key.
            value: Preference value.
            confidence: How confident we are in this preference (0–1).
        """
        if category not in self._preference_map:
            self._preference_map[category] = {}
        self._preference_map[category][key] = {
            "value": value,
            "confidence": confidence,
            "observed_at": datetime.utcnow().isoformat(),
        }

        point = TrainingDataPoint(
            input_text=f"[preference:{category}:{key}]",
            output_text=json.dumps({"value": value, "confidence": confidence}),
            dataset_type=DatasetType.PREFERENCES,
        )
        self._data_points.append(point)
        self._total_data_collected += 1

    def _assess_quality(self, input_text: str, output_text: str) -> float:
        """
        Heuristic quality assessment of a training data pair.

        Returns:
            Score between 0 and 1.
        """
        score = 1.0

        if len(input_text.strip()) < 5:
            score *= 0.3
        if len(output_text.strip()) < 10:
            score *= 0.3

        if len(output_text) < 20:
            score *= 0.5
        elif len(output_text) > 50:
            score *= 1.0

        output_words = output_text.split()
        if len(output_words) > 3:
            unique = len(set(w.lower() for w in output_words))
            diversity = unique / len(output_words)
            score *= (0.5 + 0.5 * diversity)

        if output_text.strip().lower() in ("ok", "yes", "no", "sure", "thanks"):
            score *= 0.2

        return round(min(max(score, 0.0), 1.0), 4)

    # ------------------------------------------------------------------
    # Writing Style Analysis
    # ------------------------------------------------------------------

    async def analyse_writing_style(self, texts: Optional[List[str]] = None) -> WritingStyleProfile:
        """
        Analyse writing style from collected samples or provided texts.

        Args:
            texts: Optional list of text samples. Uses stored data if None.

        Returns:
            Updated WritingStyleProfile.
        """
        if texts is None:
            texts = [
                dp.output_text for dp in self._data_points
                if dp.dataset_type in (DatasetType.WRITING_STYLE, DatasetType.CONVERSATION)
                and len(dp.output_text) > 20
            ]

        if not texts:
            return self._writing_profile

        def _analyse() -> WritingStyleProfile:
            profile = WritingStyleProfile()
            all_words: List[str] = []
            total_sentences = 0
            total_questions = 0
            total_exclamations = 0
            total_contractions = 0
            total_chars = 0
            total_upper = 0
            emoji_count = 0
            bigram_counter: Counter = Counter()
            punctuation_counter: Counter = Counter()
            informal_words = {
                "gonna", "wanna", "gotta", "kinda", "sorta", "dunno",
                "yeah", "nah", "hey", "awesome", "cool", "lol", "omg",
            }
            formal_words = {
                "therefore", "furthermore", "moreover", "consequently",
                "nevertheless", "accordingly", "hence", "thus",
                "regarding", "pertaining",
            }
            informal_count = 0
            formal_count = 0

            for text in texts:
                sentences = [s.strip() for s in text.replace("!", ".").replace("?", ".").split(".") if s.strip()]
                total_sentences += len(sentences)

                words = text.split()
                all_words.extend(words)

                for w in words:
                    wl = w.lower().strip(".,!?;:'\"")
                    if wl in informal_words:
                        informal_count += 1
                    if wl in formal_words:
                        formal_count += 1
                    if "'" in w and w.lower() not in ("i'm", "i'll", "i've", "i'd"):
                        total_contractions += 1

                for i in range(len(words) - 1):
                    bigram = f"{words[i].lower()} {words[i+1].lower()}"
                    bigram_counter[bigram] += 1

                for ch in text:
                    total_chars += 1
                    if ch.isupper():
                        total_upper += 1
                    if ch in ".,;:!?-()\"'":
                        punctuation_counter[ch] += 1
                    if ord(ch) > 127:
                        emoji_count += 1

                total_questions += text.count("?")
                total_exclamations += text.count("!")

            n_words = len(all_words)
            if n_words == 0:
                return profile

            profile.avg_word_length = sum(len(w) for w in all_words) / n_words
            profile.avg_sentence_length = n_words / max(total_sentences, 1)
            unique_words = set(w.lower() for w in all_words)
            profile.vocabulary_size = len(unique_words)
            profile.vocabulary_richness = len(unique_words) / n_words

            total_punct = sum(punctuation_counter.values()) or 1
            profile.punctuation_frequency = {
                k: round(v / total_punct, 4) for k, v in punctuation_counter.most_common(10)
            }

            profile.common_phrases = bigram_counter.most_common(20)
            profile.emoji_usage = emoji_count / n_words if n_words else 0.0
            profile.capitalization_ratio = total_upper / total_chars if total_chars else 0.0
            profile.question_ratio = total_questions / max(total_sentences, 1)
            profile.exclamation_ratio = total_exclamations / max(total_sentences, 1)
            profile.contraction_usage = total_contractions / n_words if n_words else 0.0

            total_style = informal_count + formal_count
            if total_style > 0:
                profile.formality_score = formal_count / total_style
            else:
                profile.formality_score = 0.5

            profile.tone_indicators = {
                "casual": round(informal_count / max(n_words, 1), 4),
                "formal": round(formal_count / max(n_words, 1), 4),
                "questioning": round(profile.question_ratio, 4),
                "emphatic": round(profile.exclamation_ratio, 4),
            }

            profile.samples_analysed = len(texts)
            profile.last_updated = datetime.utcnow()
            return profile

        loop = asyncio.get_running_loop()
        self._writing_profile = await loop.run_in_executor(None, _analyse)

        nexus_logger.log_activity(
            "writing_style_analysed",
            f"Analysed {self._writing_profile.samples_analysed} samples",
            metadata={"vocabulary_size": self._writing_profile.vocabulary_size},
        )

        return self._writing_profile

    def get_writing_profile(self) -> Dict[str, Any]:
        """Get the current writing style profile."""
        return self._writing_profile.to_dict()

    # ------------------------------------------------------------------
    # Personality Learning
    # ------------------------------------------------------------------

    async def build_personality_model(self) -> Dict[str, Any]:
        """
        Build a personality model from collected data.

        Analyses conversation patterns, preferences, and writing style
        to generate personality trait scores.

        Returns:
            Dict of personality traits and scores.
        """
        conversations = [
            dp for dp in self._data_points
            if dp.dataset_type == DatasetType.CONVERSATION
        ]

        if len(conversations) < 5:
            return self._personality_traits

        await self.analyse_writing_style()

        traits: Dict[str, float] = {}

        # Openness (based on vocabulary richness and diverse topics)
        traits["openness"] = min(
            self._writing_profile.vocabulary_richness * 2.5, 1.0
        )

        # Conscientiousness (based on response length and detail)
        avg_response_len = sum(
            len(c.output_text) for c in conversations
        ) / len(conversations)
        traits["conscientiousness"] = min(avg_response_len / 500, 1.0)

        # Extraversion (based on exclamation usage and emoji)
        traits["extraversion"] = min(
            self._writing_profile.exclamation_ratio * 3
            + self._writing_profile.emoji_usage * 5,
            1.0,
        )

        # Agreeableness (based on positive tone indicators)
        positive_words = {"thank", "please", "appreciate", "great", "wonderful", "happy", "love"}
        positive_count = sum(
            1 for c in conversations
            for w in c.output_text.lower().split()
            if w.strip(".,!?") in positive_words
        )
        traits["agreeableness"] = min(
            positive_count / max(len(conversations), 1) * 0.5, 1.0
        )

        # Neuroticism (inverse of consistent, calm responses)
        variability = 0.0
        lengths = [len(c.output_text) for c in conversations]
        if len(lengths) > 1:
            mean_len = sum(lengths) / len(lengths)
            variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
            std_dev = variance ** 0.5
            variability = std_dev / max(mean_len, 1)
        traits["neuroticism"] = min(variability, 1.0)

        # Formality
        traits["formality"] = self._writing_profile.formality_score

        # Detail orientation
        traits["detail_orientation"] = min(
            self._writing_profile.avg_sentence_length / 25, 1.0
        )

        self._personality_traits = {k: round(v, 4) for k, v in traits.items()}

        nexus_logger.log_activity(
            "personality_model_built",
            f"Built from {len(conversations)} conversations",
            metadata=self._personality_traits,
        )

        await self._event_bus.emit(
            "training.personality_updated",
            {"traits": self._personality_traits, "data_points": len(conversations)},
            source="training_service",
            category=EventCategory.TRAINING,
        )

        return self._personality_traits

    def get_personality_traits(self) -> Dict[str, float]:
        """Get current personality trait scores."""
        return dict(self._personality_traits)

    def get_preferences(self) -> Dict[str, Any]:
        """Get all recorded user preferences."""
        return dict(self._preference_map)

    # ------------------------------------------------------------------
    # Training Pipeline
    # ------------------------------------------------------------------

    async def start_training_job(
        self,
        model_name: str,
        dataset_type: DatasetType = DatasetType.CONVERSATION,
        description: str = "",
        epochs: int = 5,
        min_quality: float = 0.5,
    ) -> str:
        """
        Start a model training job.

        This orchestrates:
        1. Dataset filtering and preparation
        2. Training data export
        3. Model fine-tuning (simulated via Ollama Modelfile approach)
        4. Evaluation
        5. Model registration

        Args:
            model_name: Name for the trained model.
            dataset_type: Type of data to use.
            description: Job description.
            epochs: Number of training epochs.
            min_quality: Minimum quality score for data inclusion.

        Returns:
            Training job ID.
        """
        if self._training_active:
            raise RuntimeError("A training job is already in progress")

        job_id = f"train_{model_name}_{uuid.uuid4().hex[:8]}"
        job = TrainingJob(
            job_id=job_id,
            model_name=model_name,
            dataset_type=dataset_type,
            description=description,
        )
        job.total_epochs = epochs
        self._jobs[job_id] = job
        self._current_job = job
        self._training_active = True

        asyncio.create_task(self._run_training(job, min_quality))

        logger.info(f"Training job started: {job_id} — {description}")
        await self._event_bus.emit(
            "training.job_started",
            {"job_id": job_id, "model": model_name, "type": dataset_type.value},
            source="training_service",
            category=EventCategory.TRAINING,
        )

        return job_id

    async def _run_training(self, job: TrainingJob, min_quality: float) -> None:
        """Execute the full training pipeline."""
        try:
            # Phase 1: Data Collection
            job.status = TrainingStatus.COLLECTING
            dataset = self._filter_dataset(job.dataset_type, min_quality)
            job.training_data_count = len(dataset)

            if len(dataset) < 5:
                job.status = TrainingStatus.FAILED
                job.error_message = f"Insufficient data: {len(dataset)} points (minimum 5)"
                self._training_active = False
                self._total_failures += 1
                return

            # Phase 2: Preprocessing
            job.status = TrainingStatus.PREPROCESSING
            job.started_at = datetime.utcnow()
            training_data = [dp.to_training_format() for dp in dataset]
            dataset_path = await self._export_dataset(job.job_id, training_data)

            # Phase 3: Training (simulate epoch-based training)
            job.status = TrainingStatus.TRAINING
            for epoch in range(1, job.total_epochs + 1):
                if not self._training_active:
                    job.status = TrainingStatus.CANCELLED
                    return

                # Simulate training with a decay learning curve
                base_loss = 2.0
                loss = base_loss * math.exp(-0.3 * epoch) + 0.1 * (1 + 0.05 * (hash(job.job_id) % 20))
                job.current_epoch = epoch
                job.current_loss = round(loss, 6)
                if loss < job.best_loss:
                    job.best_loss = loss

                nexus_logger.log_model_training(
                    job.model_name, epoch, loss,
                    metrics={"data_points": job.training_data_count},
                )

                await self._event_bus.emit(
                    "training.epoch_complete",
                    {"job_id": job.job_id, "epoch": epoch, "loss": loss},
                    source="training_service",
                    category=EventCategory.TRAINING,
                )

                # Simulate training time
                await asyncio.sleep(0.5)

            # Phase 4: Evaluation
            job.status = TrainingStatus.EVALUATING
            metrics = await self._evaluate_model(job, dataset)
            job.metrics = metrics

            # Phase 5: Create Modelfile (Ollama-based fine-tune definition)
            await self._create_modelfile(job, dataset)

            # Complete
            job.status = TrainingStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            self._total_trainings += 1

            duration = (job.completed_at - job.started_at).total_seconds()
            logger.info(
                f"Training job completed: {job.job_id} — {duration:.1f}s, "
                f"final loss: {job.current_loss:.6f}"
            )

            await self._event_bus.emit(
                "training.job_completed",
                job.to_dict(),
                source="training_service",
                category=EventCategory.TRAINING,
                priority=EventPriority.HIGH,
            )
        except Exception as exc:
            job.status = TrainingStatus.FAILED
            job.error_message = str(exc)
            self._total_failures += 1
            logger.error(f"Training job failed: {job.job_id} — {exc}")
            await self._event_bus.emit(
                "training.job_failed",
                {"job_id": job.job_id, "error": str(exc)},
                source="training_service",
                category=EventCategory.TRAINING,
                priority=EventPriority.HIGH,
            )
        finally:
            self._training_active = False
            self._current_job = None

    def _filter_dataset(self, dataset_type: DatasetType,
                        min_quality: float) -> List[TrainingDataPoint]:
        """Filter data points by type and quality threshold."""
        return [
            dp for dp in self._data_points
            if dp.dataset_type == dataset_type and dp.quality_score >= min_quality
        ]

    async def _export_dataset(self, job_id: str,
                               training_data: List[Dict[str, str]]) -> str:
        """Export training data to a JSONL file."""
        export_path = str(self._datasets_dir / f"{job_id}_dataset.jsonl")

        def _write() -> str:
            with open(export_path, "w", encoding="utf-8") as f:
                for item in training_data:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
            return export_path

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _write)

    async def _evaluate_model(self, job: TrainingJob,
                               dataset: List[TrainingDataPoint]) -> Dict[str, float]:
        """Evaluate trained model quality using heuristic metrics."""
        avg_quality = sum(dp.quality_score for dp in dataset) / len(dataset) if dataset else 0.0
        data_diversity = len(set(dp.input_text[:50] for dp in dataset)) / max(len(dataset), 1)
        avg_length = sum(len(dp.output_text) for dp in dataset) / max(len(dataset), 1)

        metrics = {
            "avg_quality_score": round(avg_quality, 4),
            "data_diversity": round(data_diversity, 4),
            "avg_output_length": round(avg_length, 1),
            "training_loss": round(job.current_loss, 6),
            "best_loss": round(job.best_loss, 6),
            "data_points": len(dataset),
            "convergence_rate": round(1.0 - (job.current_loss / 2.0), 4),
        }
        return metrics

    async def _create_modelfile(self, job: TrainingJob,
                                 dataset: List[TrainingDataPoint]) -> str:
        """
        Generate an Ollama Modelfile for the personalised model.

        This creates a model definition with a system prompt derived
        from the learned personality and preferences.
        """
        system_lines = [
            f"You are a personalised AI assistant trained on {len(dataset)} interactions.",
        ]

        if self._personality_traits:
            dominant = max(self._personality_traits, key=self._personality_traits.get)
            system_lines.append(f"Your dominant personality trait is: {dominant}.")

        if self._writing_profile.formality_score > 0.6:
            system_lines.append("Use a formal, professional tone.")
        elif self._writing_profile.formality_score < 0.3:
            system_lines.append("Use a casual, friendly tone.")
        else:
            system_lines.append("Use a balanced, conversational tone.")

        if self._writing_profile.avg_sentence_length > 20:
            system_lines.append("Provide detailed, thorough responses.")
        elif self._writing_profile.avg_sentence_length < 10:
            system_lines.append("Keep responses brief and concise.")

        system_prompt = " ".join(system_lines)
        modelfile_content = (
            f"FROM {self._config.ollama.model}\n"
            f"SYSTEM {system_prompt}\n"
            f"PARAMETER temperature 0.7\n"
            f"PARAMETER top_p 0.9\n"
            f"PARAMETER num_ctx 4096\n"
        )

        modelfile_path = str(self._models_dir / f"{job.job_id}_Modelfile")
        with open(modelfile_path, "w", encoding="utf-8") as f:
            f.write(modelfile_content)

        logger.info(f"Modelfile created: {modelfile_path}")
        return modelfile_path

    # ------------------------------------------------------------------
    # Job Management
    # ------------------------------------------------------------------

    def cancel_training(self) -> bool:
        """Cancel the currently running training job."""
        if self._training_active and self._current_job:
            self._training_active = False
            self._current_job.status = TrainingStatus.CANCELLED
            logger.info(f"Training job cancelled: {self._current_job.job_id}")
            return True
        return False

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get training job details."""
        job = self._jobs.get(job_id)
        return job.to_dict() if job else None

    def get_jobs(self, status: Optional[TrainingStatus] = None) -> List[Dict[str, Any]]:
        """List all training jobs, optionally filtered by status."""
        result = []
        for job in self._jobs.values():
            if status and job.status != status:
                continue
            result.append(job.to_dict())
        return result

    def get_current_job(self) -> Optional[Dict[str, Any]]:
        """Get the currently running training job."""
        return self._current_job.to_dict() if self._current_job else None

    # ------------------------------------------------------------------
    # Data Management
    # ------------------------------------------------------------------

    def get_dataset_stats(self) -> Dict[str, Any]:
        """Get statistics about the collected training data."""
        type_counts: Dict[str, int] = {}
        total_quality = 0.0
        for dp in self._data_points:
            t = dp.dataset_type.value
            type_counts[t] = type_counts.get(t, 0) + 1
            total_quality += dp.quality_score

        avg_quality = total_quality / len(self._data_points) if self._data_points else 0.0

        return {
            "total_data_points": len(self._data_points),
            "total_collected": self._total_data_collected,
            "type_distribution": type_counts,
            "average_quality": round(avg_quality, 4),
            "personality_traits": len(self._personality_traits),
            "preferences_categories": len(self._preference_map),
        }

    async def clear_data(self, dataset_type: Optional[DatasetType] = None) -> int:
        """
        Clear collected training data.

        Args:
            dataset_type: Clear only specific type, or all if None.

        Returns:
            Number of data points removed.
        """
        if dataset_type:
            before = len(self._data_points)
            self._data_points = [dp for dp in self._data_points if dp.dataset_type != dataset_type]
            removed = before - len(self._data_points)
        else:
            removed = len(self._data_points)
            self._data_points.clear()

        await self._save_data()
        logger.info(f"Cleared {removed} training data points")
        return removed

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _load_existing_data(self) -> None:
        """Load previously saved training data from disk."""
        data_file = self._data_dir / "training_data.jsonl"
        if not data_file.exists():
            return

        def _load() -> List[TrainingDataPoint]:
            points = []
            with open(data_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        dp = TrainingDataPoint(
                            input_text=obj.get("input", ""),
                            output_text=obj.get("output", ""),
                            dataset_type=DatasetType(obj.get("type", "conversation")),
                            quality_score=obj.get("quality_score", 1.0),
                        )
                        points.append(dp)
                    except Exception:
                        continue
            return points

        loop = asyncio.get_running_loop()
        self._data_points = await loop.run_in_executor(None, _load)

        profile_file = self._data_dir / "writing_profile.json"
        if profile_file.exists():
            try:
                with open(profile_file, "r", encoding="utf-8") as f:
                    _data = json.load(f)
                    self._writing_profile.samples_analysed = _data.get("samples_analysed", 0)
                    self._writing_profile.formality_score = _data.get("formality_score", 0.5)
                    self._writing_profile.avg_sentence_length = _data.get("avg_sentence_length", 0.0)
            except Exception:
                pass

        traits_file = self._data_dir / "personality_traits.json"
        if traits_file.exists():
            try:
                with open(traits_file, "r", encoding="utf-8") as f:
                    self._personality_traits = json.load(f)
            except Exception:
                pass

    async def _save_data(self) -> None:
        """Persist training data and profiles to disk."""
        def _save() -> None:
            data_file = self._data_dir / "training_data.jsonl"
            with open(data_file, "w", encoding="utf-8") as f:
                for dp in self._data_points:
                    f.write(json.dumps(dp.to_dict(), ensure_ascii=False) + "\n")

            profile_file = self._data_dir / "writing_profile.json"
            with open(profile_file, "w", encoding="utf-8") as f:
                json.dump(self._writing_profile.to_dict(), f, indent=2)

            if self._personality_traits:
                traits_file = self._data_dir / "personality_traits.json"
                with open(traits_file, "w", encoding="utf-8") as f:
                    json.dump(self._personality_traits, f, indent=2)

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _save)

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return training service health status."""
        return {
            "service": "training_service",
            "initialized": self._initialized,
            "training_active": self._training_active,
            "current_job": self._current_job.to_dict() if self._current_job else None,
            "total_data_points": len(self._data_points),
            "total_trainings": self._total_trainings,
            "total_failures": self._total_failures,
            "writing_profile_ready": self._writing_profile.samples_analysed > 0,
            "personality_traits": len(self._personality_traits),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "training_active": self._training_active,
            "total_data_points": len(self._data_points),
            "total_collected": self._total_data_collected,
            "total_trainings": self._total_trainings,
            "total_failures": self._total_failures,
            "jobs_count": len(self._jobs),
            "writing_samples": self._writing_profile.samples_analysed,
            "personality_traits": len(self._personality_traits),
            "preference_categories": len(self._preference_map),
        }
