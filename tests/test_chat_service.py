import asyncio
import unicodedata

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.schemas import ChatRequest
from app.services.chat_service import ChatService, OpenAIError


def normalize_text(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value.lower())
        if not unicodedata.combining(char)
    )


def test_chat_service_requires_openai_when_demo_disabled() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key=None))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.answer(ChatRequest(message="Bonjour", language="fr")))

    assert exc_info.value.status_code == 503


def test_chat_service_extracts_openai_error_message_from_body() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key="test-key"))

    class FakeOpenAIError(OpenAIError):
        def __init__(self) -> None:
            self.body = {"error": {"message": "The model `gpt-5.2` does not exist or you do not have access to it."}}

    message = service._extract_openai_error_message(FakeOpenAIError())

    assert "gpt-5.2" in message


def test_chat_service_returns_readable_error_for_unexpected_openai_exception() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key="test-key"))

    class FakeClient:
        class Responses:
            async def create(self, **kwargs):
                raise TypeError("unexpected keyword argument 'input'")

        responses = Responses()

    service.client = FakeClient()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.answer(ChatRequest(message="bonjour", language="fr")))

    assert exc_info.value.status_code == 502
    assert "TypeError" in exc_info.value.detail


def test_chat_service_demo_mode_returns_safe_message() -> None:
    service = ChatService(Settings(demo_mode=True, openai_api_key=None))

    result = asyncio.run(service.answer(ChatRequest(message="Comment epargner ?", language="fr")))

    assert result.source == "demo"
    assert "epargne" in normalize_text(result.answer)


def test_chat_service_demo_mode_uses_recent_context_for_follow_up() -> None:
    service = ChatService(Settings(demo_mode=True, openai_api_key=None))

    result = asyncio.run(
        service.answer(
            ChatRequest(
                message="tu me conseilles quoi ?",
                language="fr",
                history=[
                    {"role": "user", "content": "j'ai 40000 a investir sur 2 ans"},
                ],
            )
        )
    )

    assert result.source == "demo"
    assert "2 ans" in result.answer
    assert "prudent" in normalize_text(result.answer)


def test_chat_service_demo_mode_returns_allocation_plan_when_requested() -> None:
    service = ChatService(Settings(demo_mode=True, openai_api_key=None))

    result = asyncio.run(
        service.answer(
            ChatRequest(
                message="propose les 3 allocations types adaptees a cet horizon",
                language="fr",
                history=[
                    {"role": "user", "content": "40000/4ans/dynamique"},
                    {"role": "assistant", "content": "Si vous voulez, je peux vous proposer 3 allocations types adaptees a cet horizon."},
                ],
            )
        )
    )

    assert result.source == "demo"
    assert "1. Prudente" in result.answer
    assert "2. equilibree" in normalize_text(result.answer)
    assert "3. Dynamique" in result.answer


def test_chat_service_demo_mode_returns_savings_plan_when_requested() -> None:
    service = ChatService(Settings(demo_mode=True, openai_api_key=None))

    result = asyncio.run(
        service.answer(
            ChatRequest(
                message="propose moi un plan simple en 3 etapes a partir de mon revenu mensuel",
                language="fr",
                history=[
                    {"role": "user", "content": "comment commencer a epargner avec 20000 par mois ?"},
                    {"role": "assistant", "content": "Si vous voulez, je peux vous proposer un plan simple en 3 etapes a partir de ce montant mensuel."},
                ],
            )
        )
    )

    assert result.source == "demo"
    assert "voici un plan simple en 3 etapes" in normalize_text(result.answer)
    assert "20 000 par mois" in result.answer
    assert "1. reserve de securite" in normalize_text(result.answer)


def test_chat_service_builds_gpt52_request_with_reasoning_and_temperature() -> None:
    service = ChatService(
        Settings(
            demo_mode=False,
            openai_api_key="test-key",
            openai_model="gpt-5.2",
            openai_reasoning_effort="none",
            openai_text_verbosity="medium",
            openai_temperature=0.2,
        )
    )

    request = service._build_openai_request([{"role": "user", "content": [{"type": "input_text", "text": "Bonjour"}]}])

    assert request["model"] == "gpt-5.2"
    assert request["reasoning"]["effort"] == "none"
    assert request["text"]["verbosity"] == "medium"
    assert request["temperature"] == 0.2


def test_chat_service_builds_older_gpt5_request_without_temperature_when_needed() -> None:
    service = ChatService(
        Settings(
            demo_mode=False,
            openai_api_key="test-key",
            openai_model="gpt-5-mini",
            openai_reasoning_effort="none",
            openai_text_verbosity="medium",
            openai_temperature=0.2,
        )
    )

    request = service._build_openai_request([{"role": "user", "content": [{"type": "input_text", "text": "Bonjour"}]}])

    assert request["model"] == "gpt-5-mini"
    assert request["reasoning"]["effort"] == "minimal"
    assert request["text"]["verbosity"] == "medium"
    assert "temperature" not in request


def test_chat_service_resolves_compound_savings_tool_request_from_investment_prompt() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key="test-key"))
    payload = ChatRequest(
        message="J'ai 40000 a investir sur 4 ans a un taux de 5 %",
        language="fr",
    )

    context = service._extract_context(payload)
    calculation_request = service._resolve_calculation_request(context)

    assert calculation_request is not None
    assert calculation_request.type == "compound-savings"
    assert calculation_request.principal == 40000
    assert calculation_request.duration_months == 48
    assert calculation_request.annual_rate == 5


def test_chat_service_resolves_market_request_for_xof_eur() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key="test-key"))
    payload = ChatRequest(
        message="Quel est le taux XOF/EUR aujourd'hui ?",
        language="fr",
    )

    context = service._extract_context(payload)
    market_request = service._resolve_market_request(context)

    assert market_request is not None
    assert market_request["symbol"] == "XOF/EUR"
    assert market_request["asset_type"] == "forex"
    assert market_request["base_currency"] == "XOF"
    assert market_request["quote_currency"] == "EUR"


def test_chat_service_formats_assistant_history_as_output_text() -> None:
    service = ChatService(Settings(demo_mode=False, openai_api_key="test-key"))
    payload = ChatRequest(
        message="bonjour",
        language="fr",
        history=[
            {"role": "assistant", "content": "Bonjour. Je suis SIKA."},
            {"role": "user", "content": "salut"},
        ],
    )

    prompt = asyncio.run(service._build_prompt(payload, "fr", service._extract_context(payload)))

    assistant_items = [item for item in prompt if item["role"] == "assistant"]
    user_items = [item for item in prompt if item["role"] == "user"]

    assert assistant_items[0]["content"][0]["type"] == "output_text"
    assert user_items[0]["content"][0]["type"] == "input_text"
