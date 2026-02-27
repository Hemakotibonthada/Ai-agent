# NEXUS AI - Voice Service
"""
Text-to-speech using pyttsx3 and edge-tts, speech-to-text using OpenAI Whisper,
wake-word detection, and full audio processing pipeline for the NEXUS AI OS.
"""

import asyncio
import io
import json
import os
import struct
import tempfile
import time
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class AudioChunk:
    """Represents a chunk of raw audio data."""

    def __init__(self, data: bytes, sample_rate: int = 22050,
                 channels: int = 1, sample_width: int = 2):
        self.data: bytes = data
        self.sample_rate: int = sample_rate
        self.channels: int = channels
        self.sample_width: int = sample_width
        self.timestamp: datetime = datetime.utcnow()

    @property
    def duration_seconds(self) -> float:
        """Calculate duration of this audio chunk in seconds."""
        if self.sample_rate == 0 or self.channels == 0 or self.sample_width == 0:
            return 0.0
        return len(self.data) / (self.sample_rate * self.channels * self.sample_width)

    @property
    def rms_energy(self) -> float:
        """Compute RMS energy of the audio chunk for voice activity detection."""
        if not self.data or self.sample_width != 2:
            return 0.0
        try:
            n_samples = len(self.data) // 2
            if n_samples == 0:
                return 0.0
            samples = struct.unpack(f"<{n_samples}h", self.data[:n_samples * 2])
            mean_sq = sum(s * s for s in samples) / n_samples
            return mean_sq ** 0.5
        except Exception:
            return 0.0


class TTSEngine:
    """Text-to-speech engine abstraction supporting pyttsx3 and edge-tts."""

    def __init__(self, engine_type: str = "pyttsx3", voice_lang: str = "en",
                 rate: int = 175, volume: float = 1.0):
        self._engine_type: str = engine_type
        self._voice_lang: str = voice_lang
        self._rate: int = rate
        self._volume: float = volume
        self._pyttsx3_engine: Any = None
        self._initialized: bool = False

    async def initialize(self) -> None:
        """Initialize the selected TTS engine."""
        try:
            if self._engine_type == "pyttsx3":
                await self._init_pyttsx3()
            logger.info(f"TTS engine '{self._engine_type}' initialized")
            self._initialized = True
        except Exception as exc:
            logger.error(f"TTS engine initialization failed: {exc}")
            self._initialized = False

    async def _init_pyttsx3(self) -> None:
        """Initialize pyttsx3 in a thread-safe manner."""
        def _setup() -> Any:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", self._rate)
            engine.setProperty("volume", self._volume)
            voices = engine.getProperty("voices")
            for voice in voices:
                if self._voice_lang in voice.id.lower():
                    engine.setProperty("voice", voice.id)
                    break
            return engine

        loop = asyncio.get_running_loop()
        self._pyttsx3_engine = await loop.run_in_executor(None, _setup)

    async def speak(self, text: str, output_path: Optional[str] = None) -> Optional[str]:
        """
        Convert text to speech.

        Args:
            text: Text to synthesize.
            output_path: Optional file path to save the audio. If None, plays directly.

        Returns:
            Path to saved file if output_path given, else None.
        """
        if self._engine_type == "edge_tts":
            return await self._speak_edge_tts(text, output_path)
        else:
            return await self._speak_pyttsx3(text, output_path)

    async def _speak_pyttsx3(self, text: str, output_path: Optional[str] = None) -> Optional[str]:
        """Synthesize speech using pyttsx3."""
        def _run() -> Optional[str]:
            if not self._pyttsx3_engine:
                return None
            if output_path:
                self._pyttsx3_engine.save_to_file(text, output_path)
                self._pyttsx3_engine.runAndWait()
                return output_path
            else:
                self._pyttsx3_engine.say(text)
                self._pyttsx3_engine.runAndWait()
                return None

        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, _run)
        except Exception as exc:
            logger.error(f"pyttsx3 speak error: {exc}")
            return None

    async def _speak_edge_tts(self, text: str, output_path: Optional[str] = None) -> Optional[str]:
        """Synthesize speech using edge-tts."""
        try:
            import edge_tts

            voice = "en-US-AriaNeural"
            if self._voice_lang.startswith("en"):
                voice = "en-US-AriaNeural"
            elif self._voice_lang.startswith("es"):
                voice = "es-ES-ElviraNeural"
            elif self._voice_lang.startswith("fr"):
                voice = "fr-FR-DeniseNeural"
            elif self._voice_lang.startswith("de"):
                voice = "de-DE-KatjaNeural"

            communicate = edge_tts.Communicate(text, voice)
            save_path = output_path or tempfile.mktemp(suffix=".mp3")
            await communicate.save(save_path)
            return save_path
        except Exception as exc:
            logger.error(f"edge-tts speak error: {exc}")
            return None

    async def get_available_voices(self) -> List[Dict[str, str]]:
        """List available TTS voices."""
        voices: List[Dict[str, str]] = []
        if self._engine_type == "pyttsx3" and self._pyttsx3_engine:
            def _list() -> List[Dict[str, str]]:
                raw = self._pyttsx3_engine.getProperty("voices")
                return [{"id": v.id, "name": v.name, "languages": str(v.languages)} for v in raw]

            loop = asyncio.get_running_loop()
            voices = await loop.run_in_executor(None, _list)
        elif self._engine_type == "edge_tts":
            try:
                import edge_tts
                raw = await edge_tts.list_voices()
                voices = [{"id": v["ShortName"], "name": v["FriendlyName"],
                           "languages": v.get("Locale", "")} for v in raw]
            except Exception as exc:
                logger.error(f"Failed to list edge-tts voices: {exc}")
        return voices

    async def shutdown(self) -> None:
        """Release TTS engine resources."""
        if self._pyttsx3_engine:
            try:
                def _stop() -> None:
                    self._pyttsx3_engine.stop()
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _stop)
            except Exception:
                pass
        self._initialized = False
        logger.info("TTS engine shut down")


class STTEngine:
    """Speech-to-text engine using OpenAI Whisper."""

    def __init__(self, model_size: str = "base", language: str = "en",
                 device: str = "cpu"):
        self._model_size: str = model_size
        self._language: str = language
        self._device: str = device
        self._model: Any = None
        self._initialized: bool = False

    async def initialize(self) -> None:
        """Load the Whisper model."""
        try:
            def _load() -> Any:
                import whisper
                return whisper.load_model(self._model_size, device=self._device)

            loop = asyncio.get_running_loop()
            self._model = await loop.run_in_executor(None, _load)
            self._initialized = True
            logger.info(f"Whisper STT model '{self._model_size}' loaded on {self._device}")
        except Exception as exc:
            logger.error(f"Failed to load Whisper model: {exc}")
            self._initialized = False

    async def transcribe(
        self, audio_path: str, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe an audio file to text.

        Args:
            audio_path: Path to the audio file (wav, mp3, etc.).
            language: Optional language code override.

        Returns:
            Dict with 'text', 'language', 'segments', 'duration'.
        """
        if not self._model:
            logger.error("STT model not loaded")
            return {"text": "", "language": "", "segments": [], "duration": 0.0, "error": "Model not loaded"}

        lang = language or self._language
        start_time = time.monotonic()

        def _run() -> Dict[str, Any]:
            result = self._model.transcribe(audio_path, language=lang, fp16=False)
            return result

        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, _run)
            elapsed = time.monotonic() - start_time

            segments = [
                {
                    "id": seg.get("id", 0),
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", "").strip(),
                }
                for seg in result.get("segments", [])
            ]

            return {
                "text": result.get("text", "").strip(),
                "language": result.get("language", lang),
                "segments": segments,
                "duration": round(elapsed, 2),
            }
        except Exception as exc:
            logger.error(f"Transcription error: {exc}")
            return {"text": "", "language": lang, "segments": [], "duration": 0.0, "error": str(exc)}

    async def transcribe_audio_data(
        self, audio_data: bytes, sample_rate: int = 16000, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe raw audio bytes by writing to a temporary WAV file.

        Args:
            audio_data: Raw PCM audio bytes (16-bit signed, mono).
            sample_rate: Sample rate of the audio data.
            language: Optional language code override.

        Returns:
            Transcription result dict.
        """
        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
                with wave.open(tmp.name, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(sample_rate)
                    wf.writeframes(audio_data)
            return await self.transcribe(tmp_path, language)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    async def shutdown(self) -> None:
        """Release the STT model from memory."""
        self._model = None
        self._initialized = False
        logger.info("STT engine shut down")


class WakeWordDetector:
    """Simple energy + keyword based wake-word detector."""

    def __init__(self, wake_word: str = "nexus", energy_threshold: float = 500.0,
                 cooldown_seconds: float = 2.0):
        self._wake_word: str = wake_word.lower()
        self._energy_threshold: float = energy_threshold
        self._cooldown_seconds: float = cooldown_seconds
        self._last_trigger: float = 0.0
        self._active: bool = False
        self._callbacks: List[Callable] = []
        self._detection_count: int = 0

    def register_callback(self, callback: Callable) -> None:
        """Register a callback to be invoked when the wake word is detected."""
        self._callbacks.append(callback)

    def check_energy(self, chunk: AudioChunk) -> bool:
        """Check if the audio chunk is above the energy threshold (voice activity)."""
        return chunk.rms_energy >= self._energy_threshold

    async def check_transcript(self, transcript: str) -> bool:
        """
        Check if the transcript contains the wake word.

        Args:
            transcript: Transcribed text to search.

        Returns:
            True if wake word detected and cooldown has elapsed.
        """
        now = time.monotonic()
        if now - self._last_trigger < self._cooldown_seconds:
            return False

        if self._wake_word in transcript.lower():
            self._last_trigger = now
            self._detection_count += 1
            logger.info(f"Wake word '{self._wake_word}' detected (count: {self._detection_count})")
            for cb in self._callbacks:
                try:
                    if asyncio.iscoroutinefunction(cb):
                        await cb(transcript)
                    else:
                        cb(transcript)
                except Exception as exc:
                    logger.error(f"Wake word callback error: {exc}")
            return True
        return False

    @property
    def detection_count(self) -> int:
        """Number of times wake word has been detected."""
        return self._detection_count

    def set_active(self, active: bool) -> None:
        """Enable or disable wake word detection."""
        self._active = active


class AudioBuffer:
    """Ring buffer for accumulating audio chunks before processing."""

    def __init__(self, max_duration_seconds: float = 30.0, sample_rate: int = 16000,
                 channels: int = 1, sample_width: int = 2):
        self._max_bytes: int = int(max_duration_seconds * sample_rate * channels * sample_width)
        self._buffer: bytearray = bytearray()
        self._sample_rate: int = sample_rate
        self._channels: int = channels
        self._sample_width: int = sample_width

    def append(self, chunk: AudioChunk) -> None:
        """Append an audio chunk to the buffer, discarding oldest data if full."""
        self._buffer.extend(chunk.data)
        if len(self._buffer) > self._max_bytes:
            excess = len(self._buffer) - self._max_bytes
            self._buffer = self._buffer[excess:]

    def get_data(self) -> bytes:
        """Retrieve all buffered audio data."""
        return bytes(self._buffer)

    def clear(self) -> None:
        """Clear the buffer."""
        self._buffer.clear()

    @property
    def duration_seconds(self) -> float:
        """Current duration of buffered audio in seconds."""
        if self._sample_rate == 0:
            return 0.0
        return len(self._buffer) / (self._sample_rate * self._channels * self._sample_width)

    @property
    def is_empty(self) -> bool:
        """Whether the buffer contains any data."""
        return len(self._buffer) == 0


class VoiceService:
    """
    Comprehensive voice service for NEXUS AI.

    Provides:
    - Text-to-speech via pyttsx3 or edge-tts
    - Speech-to-text via OpenAI Whisper
    - Wake word detection with energy gating
    - Audio buffering and processing pipeline
    - Voice interaction logging
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._tts: TTSEngine = TTSEngine(
            engine_type="pyttsx3",
            voice_lang=self._config.voice.language,
        )
        self._stt: STTEngine = STTEngine(
            model_size=self._config.voice.stt_model,
            language=self._config.voice.language,
        )
        self._wake_detector: WakeWordDetector = WakeWordDetector(
            wake_word=self._config.voice.wake_word,
        )
        self._audio_buffer: AudioBuffer = AudioBuffer(
            sample_rate=self._config.voice.sample_rate,
            channels=self._config.voice.channels,
        )
        self._initialized: bool = False
        self._listening: bool = False
        self._processing: bool = False
        self._output_dir: Path = Path("./data/voice")
        self._interaction_count: int = 0
        self._total_tts_ms: float = 0.0
        self._total_stt_ms: float = 0.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize TTS, STT engines and wake-word detector."""
        try:
            logger.info("Initializing VoiceService...")
            self._output_dir.mkdir(parents=True, exist_ok=True)
            await self._tts.initialize()
            await self._stt.initialize()
            self._wake_detector.set_active(True)
            self._initialized = True
            logger.info("VoiceService initialized successfully")
            await self._event_bus.emit(
                "voice.initialized",
                {"tts_engine": self._tts._engine_type, "stt_model": self._stt._model_size},
                source="voice_service",
                category=EventCategory.VOICE,
            )
        except Exception as exc:
            logger.error(f"VoiceService initialization failed: {exc}")
            self._initialized = False

    async def shutdown(self) -> None:
        """Release all voice processing resources."""
        try:
            logger.info("Shutting down VoiceService...")
            self._listening = False
            await self._tts.shutdown()
            await self._stt.shutdown()
            self._audio_buffer.clear()
            self._initialized = False
            logger.info("VoiceService shut down complete")
        except Exception as exc:
            logger.error(f"Error during VoiceService shutdown: {exc}")

    # ------------------------------------------------------------------
    # Text-to-Speech
    # ------------------------------------------------------------------

    async def speak(self, text: str, save: bool = False) -> Optional[str]:
        """
        Synthesize speech from text.

        Args:
            text: The text to speak.
            save: Whether to save audio to a file.

        Returns:
            Path to saved audio file if save=True, else None.
        """
        start_time = time.monotonic()
        try:
            output_path: Optional[str] = None
            if save:
                filename = f"tts_{uuid.uuid4().hex[:8]}_{int(time.time())}.wav"
                output_path = str(self._output_dir / filename)

            result = await self._tts.speak(text, output_path)
            elapsed_ms = (time.monotonic() - start_time) * 1000
            self._total_tts_ms += elapsed_ms

            nexus_logger.log_voice_interaction("output", text)
            await self._event_bus.emit(
                "voice.tts_complete",
                {"text_length": len(text), "duration_ms": round(elapsed_ms, 2), "saved": save},
                source="voice_service",
                category=EventCategory.VOICE,
            )
            return result
        except Exception as exc:
            logger.error(f"TTS error: {exc}")
            return None

    async def speak_ssml(self, ssml: str, output_path: Optional[str] = None) -> Optional[str]:
        """
        Synthesize speech from SSML markup (edge-tts only).

        Args:
            ssml: SSML-formatted text.
            output_path: Path to save audio.

        Returns:
            Path to saved audio file.
        """
        try:
            import edge_tts
            communicate = edge_tts.Communicate(ssml, "en-US-AriaNeural")
            save_path = output_path or tempfile.mktemp(suffix=".mp3")
            await communicate.save(save_path)
            return save_path
        except Exception as exc:
            logger.error(f"SSML TTS error: {exc}")
            return None

    async def get_voices(self) -> List[Dict[str, str]]:
        """Get the list of available TTS voices."""
        return await self._tts.get_available_voices()

    # ------------------------------------------------------------------
    # Speech-to-Text
    # ------------------------------------------------------------------

    async def transcribe_file(self, audio_path: str,
                              language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe an audio file to text.

        Args:
            audio_path: Path to the audio file.
            language: Optional language code.

        Returns:
            Dict with 'text', 'language', 'segments', 'duration'.
        """
        start_time = time.monotonic()
        try:
            result = await self._stt.transcribe(audio_path, language)
            elapsed_ms = (time.monotonic() - start_time) * 1000
            self._total_stt_ms += elapsed_ms
            self._interaction_count += 1

            if result.get("text"):
                nexus_logger.log_voice_interaction(
                    "input", result["text"],
                    confidence=None,
                )
                await self._event_bus.emit(
                    "voice.stt_complete",
                    {"text": result["text"][:200], "duration_ms": round(elapsed_ms, 2)},
                    source="voice_service",
                    category=EventCategory.VOICE,
                )
            return result
        except Exception as exc:
            logger.error(f"Transcription error: {exc}")
            return {"text": "", "language": language or "", "segments": [], "duration": 0.0, "error": str(exc)}

    async def transcribe_audio_data(
        self, audio_data: bytes, sample_rate: int = 16000,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transcribe raw audio bytes.

        Args:
            audio_data: Raw PCM audio bytes (16-bit, mono).
            sample_rate: Sample rate.
            language: Optional language code.

        Returns:
            Transcription result dict.
        """
        try:
            result = await self._stt.transcribe_audio_data(audio_data, sample_rate, language)
            self._interaction_count += 1
            return result
        except Exception as exc:
            logger.error(f"Audio data transcription error: {exc}")
            return {"text": "", "error": str(exc)}

    # ------------------------------------------------------------------
    # Wake Word
    # ------------------------------------------------------------------

    async def process_audio_chunk(self, chunk: AudioChunk) -> Optional[str]:
        """
        Process an incoming audio chunk through the full voice pipeline.

        Steps:
        1. Check energy level for voice activity.
        2. Buffer audio if active.
        3. If silence detected after speech, transcribe buffered audio.
        4. Check for wake word in transcription.

        Args:
            chunk: Raw audio chunk.

        Returns:
            Transcribed text if speech was detected, else None.
        """
        if not self._initialized:
            return None

        has_voice = self._wake_detector.check_energy(chunk)

        if has_voice:
            if not self._listening:
                self._listening = True
                logger.debug("Voice activity detected — started buffering")
            self._audio_buffer.append(chunk)
        else:
            if self._listening and not self._audio_buffer.is_empty:
                self._listening = False
                logger.debug(f"Silence detected — processing {self._audio_buffer.duration_seconds:.1f}s of audio")
                audio_data = self._audio_buffer.get_data()
                self._audio_buffer.clear()

                if len(audio_data) > 3200:
                    result = await self.transcribe_audio_data(audio_data, chunk.sample_rate)
                    text = result.get("text", "").strip()
                    if text:
                        await self._wake_detector.check_transcript(text)
                        return text
        return None

    def register_wake_word_callback(self, callback: Callable) -> None:
        """Register a callback for wake word detection events."""
        self._wake_detector.register_callback(callback)

    def set_wake_word(self, word: str) -> None:
        """Change the wake word at runtime."""
        self._wake_detector._wake_word = word.lower()
        logger.info(f"Wake word changed to: {word}")

    # ------------------------------------------------------------------
    # Audio Utilities
    # ------------------------------------------------------------------

    async def save_audio_to_wav(
        self, audio_data: bytes, output_path: str,
        sample_rate: int = 16000, channels: int = 1, sample_width: int = 2,
    ) -> str:
        """
        Save raw PCM audio data to a WAV file.

        Args:
            audio_data: Raw PCM bytes.
            output_path: Target file path.
            sample_rate: Samples per second.
            channels: Number of audio channels.
            sample_width: Bytes per sample.

        Returns:
            The output file path.
        """
        def _write() -> str:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with wave.open(output_path, "wb") as wf:
                wf.setnchannels(channels)
                wf.setsampwidth(sample_width)
                wf.setframerate(sample_rate)
                wf.writeframes(audio_data)
            return output_path

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _write)

    async def convert_audio_format(
        self, input_path: str, output_format: str = "wav"
    ) -> Optional[str]:
        """
        Convert audio between formats using soundfile.

        Args:
            input_path: Source audio file path.
            output_format: Target format ('wav', 'flac', etc.).

        Returns:
            Path to converted file.
        """
        def _convert() -> Optional[str]:
            try:
                import soundfile as sf
                data, samplerate = sf.read(input_path)
                out_path = str(Path(input_path).with_suffix(f".{output_format}"))
                sf.write(out_path, data, samplerate)
                return out_path
            except Exception as exc:
                logger.error(f"Audio conversion error: {exc}")
                return None

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _convert)

    async def get_audio_info(self, audio_path: str) -> Dict[str, Any]:
        """
        Get metadata about an audio file.

        Args:
            audio_path: Path to the audio file.

        Returns:
            Dict with 'duration', 'sample_rate', 'channels', 'format'.
        """
        def _info() -> Dict[str, Any]:
            try:
                import soundfile as sf
                info = sf.info(audio_path)
                return {
                    "duration": info.duration,
                    "sample_rate": info.samplerate,
                    "channels": info.channels,
                    "format": info.format,
                    "subtype": info.subtype,
                    "frames": info.frames,
                }
            except Exception as exc:
                logger.error(f"Audio info error: {exc}")
                return {"error": str(exc)}

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _info)

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return voice service health status."""
        return {
            "service": "voice_service",
            "initialized": self._initialized,
            "tts_initialized": self._tts._initialized,
            "stt_initialized": self._stt._initialized,
            "wake_word": self._wake_detector._wake_word,
            "wake_detections": self._wake_detector.detection_count,
            "listening": self._listening,
            "buffer_duration": round(self._audio_buffer.duration_seconds, 2),
            "interaction_count": self._interaction_count,
            "total_tts_ms": round(self._total_tts_ms, 2),
            "total_stt_ms": round(self._total_stt_ms, 2),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "interaction_count": self._interaction_count,
            "wake_detections": self._wake_detector.detection_count,
            "total_tts_ms": round(self._total_tts_ms, 2),
            "total_stt_ms": round(self._total_stt_ms, 2),
            "avg_tts_ms": (
                round(self._total_tts_ms / max(self._interaction_count, 1), 2)
            ),
            "avg_stt_ms": (
                round(self._total_stt_ms / max(self._interaction_count, 1), 2)
            ),
        }
