from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


SupportedLanguage = Literal["fr", "fon", "mina", "auto"]
ChatRole = Literal["user", "assistant"]
CalculationType = Literal[
    "loan-payment",
    "simple-interest",
    "compound-savings",
    "currency-conversion",
]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    language: SupportedLanguage = "fr"
    user_id: str | None = Field(default=None, max_length=128)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le message ne peut pas etre vide.")
        return cleaned


class ChatResponse(BaseModel):
    answer: str
    language: str
    source: Literal["demo", "openai"]
    user_id: str


class VoiceToTextResponse(BaseModel):
    transcript: str
    language: str
    source: Literal["placeholder"]
    ready: bool


class VoiceToTextRequest(BaseModel):
    audio_base64: str = Field(min_length=1, max_length=2_000_000)
    mime_type: str = Field(default="audio/webm", max_length=64)
    language: SupportedLanguage = "fr"


class TextToSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: SupportedLanguage = "fr"


class TextToSpeechResponse(BaseModel):
    audio_url: str | None
    source: Literal["placeholder"]
    ready: bool
    message: str


class MarketDataResponse(BaseModel):
    provider: str
    asset_type: str
    symbol: str
    price: float
    currency: str
    change_percent: float | None = None
    last_updated: str
    notes: str | None = None


class CalculationRequest(BaseModel):
    type: CalculationType
    principal: float | None = Field(default=None, ge=0, le=1_000_000_000_000)
    annual_rate: float | None = Field(default=None, ge=0, le=100)
    tax_rate: float | None = Field(default=0, ge=0, le=100)
    inflation_rate: float | None = Field(default=0, ge=0, le=100)
    insurance_rate: float | None = Field(default=0, ge=0, le=100)
    duration_months: int | None = Field(default=None, gt=0, le=600)
    contribution: float | None = Field(default=0, ge=0, le=1_000_000_000_000)
    amount: float | None = Field(default=None, gt=0, le=1_000_000_000_000)
    exchange_rate: float | None = Field(default=None, gt=0, le=100_000)
    from_currency: str | None = Field(default=None, max_length=10)
    to_currency: str | None = Field(default=None, max_length=10)
    periods_per_year: int = Field(default=12, gt=0, le=365)

    @field_validator("from_currency", "to_currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = value.strip().upper()
        if not cleaned:
            return None
        return cleaned

    @model_validator(mode="after")
    def validate_type_specific_values(self) -> "CalculationRequest":
        if (
            self.type in {"loan-payment", "simple-interest"}
            and self.principal is not None
            and self.principal <= 0
        ):
            raise ValueError("principal doit etre strictement positif pour ce calcul.")

        return self


class CalculationResponse(BaseModel):
    type: CalculationType
    result: float
    currency: str | None
    summary: str
    breakdown: dict[str, float | int | str]
    notes: list[str] = Field(default_factory=list)
    schedule: list[dict[str, float | int | str]] = Field(default_factory=list)
