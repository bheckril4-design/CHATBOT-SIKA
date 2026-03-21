from fastapi import APIRouter

from app.schemas import (
    TextToSpeechRequest,
    TextToSpeechResponse,
    VoiceToTextRequest,
    VoiceToTextResponse,
)

router = APIRouter(tags=["voice"])


@router.post("/voice-to-text", response_model=VoiceToTextResponse)
async def voice_to_text(payload: VoiceToTextRequest) -> VoiceToTextResponse:
    return VoiceToTextResponse(
        transcript=(
            "Le module voice-to-text sera active en phase 2. "
            f"Payload recu en {payload.mime_type}."
        ),
        language=payload.language,
        source="placeholder",
        ready=False,
    )


@router.post("/text-to-speech", response_model=TextToSpeechResponse)
async def text_to_speech(payload: TextToSpeechRequest) -> TextToSpeechResponse:
    return TextToSpeechResponse(
        audio_url=None,
        source="placeholder",
        ready=False,
        message=(
            "Le text-to-speech n'est pas encore active dans ce MVP. "
            f"Texte recu: {payload.text[:80]}"
        ),
    )
