# NEXUS AI - Voice API Routes
"""
Endpoints for speech-to-text, text-to-speech, voice commands,
and voice settings management.
"""

import base64
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.dependencies import get_engine


# ============================================================
# Request / Response Models
# ============================================================

class SpeechToTextRequest(BaseModel):
    """Request for speech-to-text conversion."""
    audio_data: str = Field(..., description="Base64-encoded audio data")
    audio_format: str = Field("wav", description="Audio format: wav, mp3, ogg, webm")
    language: str = Field("en", description="Language code")
    sample_rate: Optional[int] = Field(None, description="Sample rate in Hz")


class SpeechToTextResponse(BaseModel):
    """Response from speech-to-text conversion."""
    text: str
    confidence: float = 0.0
    language: str = "en"
    duration_seconds: float = 0.0
    processing_time_ms: float = 0.0
    timestamp: str


class TextToSpeechRequest(BaseModel):
    """Request for text-to-speech conversion."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to synthesize")
    voice: Optional[str] = Field(None, description="Voice model/name")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    language: str = Field("en", description="Language code")
    output_format: str = Field("wav", description="Output audio format")


class TextToSpeechResponse(BaseModel):
    """Response from text-to-speech conversion."""
    audio_data: str = Field(..., description="Base64-encoded audio output")
    audio_format: str
    duration_seconds: float = 0.0
    sample_rate: int = 22050
    processing_time_ms: float = 0.0
    timestamp: str


class VoiceCommandRequest(BaseModel):
    """Request for processing a voice command."""
    audio_data: Optional[str] = Field(None, description="Base64-encoded audio data (if raw audio)")
    text: Optional[str] = Field(None, description="Pre-transcribed text (alternative to audio)")
    language: str = Field("en", description="Language code")


class VoiceCommandResponse(BaseModel):
    """Response after processing a voice command."""
    transcribed_text: str
    response_text: str
    response_audio: Optional[str] = Field(None, description="Base64-encoded audio response")
    intent: Optional[str] = None
    agent_name: str = "orchestrator"
    confidence: float = 0.0
    processing_time_ms: float = 0.0
    timestamp: str


class VoiceSettingsResponse(BaseModel):
    """Current voice engine settings."""
    tts_model: str = ""
    stt_model: str = ""
    wake_word: str = "nexus"
    language: str = "en"
    sample_rate: int = 22050
    channels: int = 1
    available_voices: List[str] = []
    is_listening: bool = False
    timestamp: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/voice", tags=["Voice"])


@router.post(
    "/speech-to-text",
    response_model=SpeechToTextResponse,
    summary="Convert speech audio to text",
)
async def speech_to_text(
    request: SpeechToTextRequest,
    engine=Depends(get_engine),
):
    """Transcribe audio to text using the configured STT model."""
    import time

    start = time.time()

    try:
        voice_service = engine.get_service("voice")

        if voice_service and hasattr(voice_service, "transcribe"):
            # Decode audio
            audio_bytes = base64.b64decode(request.audio_data)
            result = await voice_service.transcribe(
                audio_data=audio_bytes,
                language=request.language,
                sample_rate=request.sample_rate,
            )
            text = result.get("text", "") if isinstance(result, dict) else str(result)
            confidence = result.get("confidence", 0.9) if isinstance(result, dict) else 0.9
            duration = result.get("duration", 0.0) if isinstance(result, dict) else 0.0
        else:
            # Fallback when voice service is not available
            text = "[Voice service not available - audio received but not processed]"
            confidence = 0.0
            duration = 0.0

        elapsed_ms = (time.time() - start) * 1000

        return SpeechToTextResponse(
            text=text,
            confidence=confidence,
            language=request.language,
            duration_seconds=duration,
            processing_time_ms=round(elapsed_ms, 2),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech-to-text error: {str(e)}",
        )


@router.post(
    "/text-to-speech",
    response_model=TextToSpeechResponse,
    summary="Convert text to speech audio",
)
async def text_to_speech(
    request: TextToSpeechRequest,
    engine=Depends(get_engine),
):
    """Synthesize speech from text using the configured TTS model."""
    import time

    start = time.time()

    try:
        voice_service = engine.get_service("voice")

        if voice_service and hasattr(voice_service, "synthesize"):
            audio_result = await voice_service.synthesize(
                text=request.text,
                voice=request.voice,
                speed=request.speed,
                language=request.language,
            )
            if isinstance(audio_result, dict):
                audio_bytes = audio_result.get("audio", b"")
                duration = audio_result.get("duration", 0.0)
                sr = audio_result.get("sample_rate", 22050)
            elif isinstance(audio_result, bytes):
                audio_bytes = audio_result
                duration = 0.0
                sr = 22050
            else:
                audio_bytes = b""
                duration = 0.0
                sr = 22050

            audio_b64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""
        else:
            audio_b64 = ""
            duration = 0.0
            sr = 22050

        elapsed_ms = (time.time() - start) * 1000

        return TextToSpeechResponse(
            audio_data=audio_b64,
            audio_format=request.output_format,
            duration_seconds=duration,
            sample_rate=sr,
            processing_time_ms=round(elapsed_ms, 2),
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text-to-speech error: {str(e)}",
        )


@router.post(
    "/command",
    response_model=VoiceCommandResponse,
    summary="Process a voice command",
)
async def process_voice_command(
    request: VoiceCommandRequest,
    engine=Depends(get_engine),
):
    """Process a voice command: transcribe → route to orchestrator → optionally synthesize response."""
    import time

    start = time.time()

    try:
        transcribed = request.text or ""

        # Transcribe if audio data provided and no text
        if request.audio_data and not transcribed:
            voice_service = engine.get_service("voice")
            if voice_service and hasattr(voice_service, "transcribe"):
                audio_bytes = base64.b64decode(request.audio_data)
                result = await voice_service.transcribe(
                    audio_data=audio_bytes,
                    language=request.language,
                )
                transcribed = result.get("text", "") if isinstance(result, dict) else str(result)

        if not transcribed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No audio or text provided for command processing",
            )

        # Route through orchestrator
        from agents.base_agent import AgentContext, AgentResponse

        context = AgentContext(message=transcribed)
        orchestrator = engine.get_agent("orchestrator")

        if orchestrator:
            agent_response: AgentResponse = await orchestrator.handle_message(context)
            response_text = agent_response.content
            agent_name = agent_response.agent_name
            confidence = agent_response.confidence
            intent = agent_response.metadata.get("intent")
        else:
            response_text = "Voice command received but orchestrator is not available."
            agent_name = "system"
            confidence = 0.0
            intent = None

        elapsed_ms = (time.time() - start) * 1000

        return VoiceCommandResponse(
            transcribed_text=transcribed,
            response_text=response_text,
            response_audio=None,
            intent=intent,
            agent_name=agent_name,
            confidence=confidence,
            processing_time_ms=round(elapsed_ms, 2),
            timestamp=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice command error: {str(e)}",
        )


@router.get(
    "/settings",
    response_model=VoiceSettingsResponse,
    summary="Get voice engine settings",
)
async def get_voice_settings(engine=Depends(get_engine)):
    """Get the current voice engine configuration and available voices."""
    try:
        config = engine.config.voice

        voice_service = engine.get_service("voice")
        available = []
        is_listening = False

        if voice_service:
            if hasattr(voice_service, "get_available_voices"):
                available = voice_service.get_available_voices()
            if hasattr(voice_service, "is_listening"):
                is_listening = (
                    voice_service.is_listening()
                    if callable(voice_service.is_listening)
                    else voice_service.is_listening
                )

        return VoiceSettingsResponse(
            tts_model=config.tts_model,
            stt_model=config.stt_model,
            wake_word=config.wake_word,
            language=config.language,
            sample_rate=config.sample_rate,
            channels=config.channels,
            available_voices=available,
            is_listening=is_listening,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching voice settings: {str(e)}",
        )
