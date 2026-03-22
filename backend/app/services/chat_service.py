from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from typing import Any

from fastapi import HTTPException

try:
    from openai import AsyncOpenAI, OpenAIError
except ModuleNotFoundError:  # pragma: no cover
    AsyncOpenAI = None

    class OpenAIError(Exception):
        pass

from app.core.config import Settings, get_settings
from app.schemas import CalculationRequest, CalculationResponse, ChatRequest, ChatResponse, MarketDataResponse
from app.services.calculation_service import run_calculation
from app.services.finance_service import FinanceService

BASE_SYSTEM_PROMPT = """
Tu es SIKA, un assistant financier concis, pédagogique, fiable et proactif.
Tu aides en priorité des utilisateurs en Afrique francophone.

Règles :
- commence par une réponse directe et utile, pas par une formule générique ;
- exploite l'historique récent pour éviter de reposer les mêmes questions ;
- quand le montant, la durée ou le taux sont déjà présents, donne une orientation concrète ;
- si des données internes ou un calcul vérifié sont fournis, appuie-toi dessus explicitement ;
- quand l'utilisateur demande un avis pratique, formule d'abord une recommandation provisoire, puis le point critique à vérifier pour affiner ;
- pour une comparaison, propose 2 ou 3 options clairement nommées ;
- quand il y a des chiffres, fais une synthèse numérique utile au lieu de rester abstrait ;
- n'invente jamais une donnée de marché ni un résultat de calcul ;
- ne promets jamais de rendement garanti ;
- ne fournis jamais de conseil d'investissement personnalisé, de promesse de gain, ni d'instruction fiscale ou légale définitive ;
- formule les réponses comme un contenu éducatif, prudent et actionnable.
""".strip()

CALCULATION_LABELS = {
    "principal": "capital initial",
    "contribution": "versement periodique",
    "total_contributions": "total verse",
    "annual_rate": "taux annuel",
    "tax_rate": "fiscalite",
    "inflation_rate": "inflation",
    "duration_months": "duree",
    "nominal_future_value": "capital nominal projete",
    "gain_before_tax": "gains avant fiscalite",
    "taxes_due": "impots estimes",
    "real_future_value": "capital reel projete",
    "base_monthly_payment": "mensualite hors assurance",
    "insurance_monthly": "assurance mensuelle",
    "total_monthly_payment": "mensualite totale",
    "total_payment": "cout total",
    "interest_paid": "interets estimes",
    "insurance_total": "cout total assurance",
    "amount": "montant",
    "exchange_rate": "taux de change",
}

CALCULATION_PRIORITY = {
    "compound-savings": ["capital nominal projete", "capital reel projete", "impots estimes", "total verse", "duree"],
    "simple-interest": ["capital reel projete", "impots estimes", "duree"],
    "loan-payment": ["mensualite totale", "mensualite hors assurance", "cout total", "interets estimes", "duree"],
    "currency-conversion": ["montant", "taux de change"],
}


class ChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key and AsyncOpenAI is not None else None
        self.finance_service = FinanceService(settings)

    async def answer(self, payload: ChatRequest) -> ChatResponse:
        language = self._resolve_language(payload.language)
        user_id = payload.user_id or "anonymous"
        context = self._extract_context(payload)

        if self.settings.demo_mode:
            return ChatResponse(
                answer=await self._demo_answer(context, language),
                language=language,
                source="demo",
                user_id=user_id,
            )

        if not self.client:
            if self.settings.openai_api_key and AsyncOpenAI is None:
                raise HTTPException(status_code=503, detail="Le package OpenAI n'est pas installé sur ce serveur.")
            raise HTTPException(status_code=503, detail="Le mode démo est désactivé et OPENAI_API_KEY n'est pas configuré.")

        try:
            prompt = await self._build_prompt(payload, language, context)
            response = await self.client.responses.create(**self._build_openai_request(prompt))
        except OpenAIError as exc:
            error_message = self._extract_openai_error_message(exc)
            raise HTTPException(
                status_code=502,
                detail=f"Erreur du fournisseur IA ({exc.__class__.__name__}): {error_message}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Erreur interne lors de l'appel OpenAI ({exc.__class__.__name__}): {str(exc).strip() or 'erreur inconnue'}",
            ) from exc

        answer = (response.output_text or "").strip()
        if not answer:
            raise HTTPException(status_code=502, detail="La réponse IA est vide. Merci de réessayer.")

        return ChatResponse(answer=answer, language=language, source="openai", user_id=user_id)

    async def _build_prompt(self, payload: ChatRequest, language: str, context: dict[str, Any]) -> list[dict[str, Any]]:
        prompt: list[dict[str, Any]] = [{
            "role": "system",
            "content": [{
                "type": "input_text",
                "text": (
                    f"{BASE_SYSTEM_PROMPT}\n\nLangue de sortie cible: {language}.\n"
                    "Si la langue est 'fr', réponds en français. "
                    "Quand une réponse courte suffit, reste concise. Quand un calcul ou une comparaison est utile, "
                    "donne les chiffres importants, l'interprétation et le point de vigilance."
                ),
            }],
        }]

        context_summary = self._build_context_summary(context)
        if context_summary:
            prompt.append({"role": "system", "content": [{"type": "input_text", "text": context_summary}]})

        tool_context = await self._build_tool_context(context)
        if tool_context:
            prompt.append({"role": "system", "content": [{"type": "input_text", "text": tool_context}]})

        for item in payload.history[-self.settings.max_history_messages :]:
            prompt.append(
                {
                    "role": item.role,
                    "content": [
                        {
                            "type": "output_text" if item.role == "assistant" else "input_text",
                            "text": item.content,
                        }
                    ],
                }
            )

        prompt.append({"role": "user", "content": [{"type": "input_text", "text": payload.message}]})
        return prompt

    def _build_openai_request(self, prompt: list[dict[str, Any]]) -> dict[str, Any]:
        model = self.settings.openai_model
        request: dict[str, Any] = {"model": model, "input": prompt}
        if model.startswith("gpt-5"):
            effort = self._resolve_reasoning_effort_for_model(model)
            request["reasoning"] = {"effort": effort}
            request["text"] = {"verbosity": self.settings.openai_text_verbosity}
            if (model.startswith("gpt-5.1") or model.startswith("gpt-5.2")) and effort == "none" and self.settings.openai_temperature is not None:
                request["temperature"] = self.settings.openai_temperature
            return request
        if self.settings.openai_temperature is not None:
            request["temperature"] = self.settings.openai_temperature
        return request

    def _resolve_reasoning_effort_for_model(self, model: str) -> str:
        requested_effort = self.settings.openai_reasoning_effort
        if model.startswith("gpt-5.1") or model.startswith("gpt-5.2"):
            return requested_effort
        return "minimal" if requested_effort == "none" else requested_effort

    def _extract_openai_error_message(self, exc: OpenAIError) -> str:
        response = getattr(exc, "response", None)
        if response is not None:
            try:
                payload = response.json()
            except Exception:
                payload = None
            if isinstance(payload, dict):
                error = payload.get("error")
                if isinstance(error, dict):
                    message = error.get("message")
                    if isinstance(message, str) and message.strip():
                        return message.strip()

        body = getattr(exc, "body", None)
        if isinstance(body, dict):
            error = body.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()

        message = str(exc).strip()
        return message or "requête invalide ou modèle non disponible."

    def _resolve_language(self, requested: str) -> str:
        return "fr" if requested == "auto" else requested

    async def _build_tool_context(self, context: dict[str, Any]) -> str:
        sections: list[str] = []
        calculation_request = self._resolve_calculation_request(context)
        if calculation_request is not None:
            try:
                calculation_response = run_calculation(calculation_request)
            except HTTPException:
                calculation_response = None
            if calculation_response is not None:
                sections.append(self._format_calculation_tool_context(calculation_request, calculation_response))

        market_request = self._resolve_market_request(context)
        if market_request is not None:
            try:
                market_response = await self.finance_service.get_market_data(**market_request)
            except HTTPException:
                market_response = None
            if market_response is not None:
                sections.append(self._format_market_tool_context(market_response))

        if not sections:
            return ""

        return (
            "Donnees internes verifiees par SIKA. Appuie-toi sur elles quand elles sont presentes.\n"
            "- si un calcul ou une donnee de marche est fournie, cite-la plutot que d'improviser;\n"
            "- si un provider de marche est en mode demo, precise que la valeur est indicative;\n"
            "- fais confiance au calcul outille pour les chiffres et ajoute seulement l'interpretation.\n\n"
            + "\n\n".join(sections)
        )

    def _build_context_summary(self, context: dict[str, Any]) -> str:
        lines: list[str] = []
        if context.get("topic"):
            lines.append(f"- sujet infere: {context['topic']}")
        if context.get("amount") is not None:
            lines.append(f"- capital ou montant mentionne: {self._format_amount(context['amount'])}")
        if context.get("monthly_savings_amount") is not None:
            lines.append(f"- effort mensuel mentionne: {self._format_amount(context['monthly_savings_amount'])} par mois")
        if context.get("duration_months") is not None:
            lines.append(f"- horizon mentionne: {self._format_duration(context['duration_months'])}")
        if context.get("annual_rate") is not None:
            lines.append(f"- taux annuel mentionne: {context['annual_rate']} %")
        if context.get("risk_profile"):
            lines.append(f"- profil de risque mentionne: {context['risk_profile']}")
        if context.get("is_follow_up"):
            lines.append("- la demande actuelle est une relance courte")
        if not lines:
            return ""
        return "Resume interne du contexte recent. Utilise-le pour eviter une reponse generique:\n" + "\n".join(lines)

    async def _collect_tool_results(
        self,
        context: dict[str, Any],
    ) -> tuple[CalculationRequest | None, CalculationResponse | None, MarketDataResponse | None]:
        calculation_request = self._resolve_calculation_request(context)
        calculation_response: CalculationResponse | None = None
        if calculation_request is not None:
            try:
                calculation_response = run_calculation(calculation_request)
            except HTTPException:
                calculation_response = None

        market_request = self._resolve_market_request(context)
        market_response: MarketDataResponse | None = None
        if market_request is not None:
            try:
                market_response = await self.finance_service.get_market_data(**market_request)
            except HTTPException:
                market_response = None

        return calculation_request, calculation_response, market_response

    def _resolve_calculation_request(self, context: dict[str, Any]) -> CalculationRequest | None:
        topic = context.get("topic")
        amount = context.get("amount")
        monthly_amount = context.get("monthly_savings_amount")
        duration_months = context.get("duration_months")
        annual_rate = context.get("annual_rate")
        tax_rate = context.get("tax_rate") or 0
        inflation_rate = context.get("inflation_rate") or 0

        if topic == "credit":
            if amount is None or duration_months is None or annual_rate is None:
                return None
            return CalculationRequest(type="loan-payment", principal=amount, annual_rate=annual_rate, insurance_rate=context.get("insurance_rate") or 0, duration_months=duration_months, to_currency="XOF")

        if topic in {"investment", "retirement", "savings"}:
            if duration_months is None or annual_rate is None:
                return None
            principal = self._infer_starting_principal(context)
            contribution = monthly_amount or 0
            if topic == "savings" and monthly_amount is None:
                return None
            if principal == 0 and contribution == 0:
                return None
            return CalculationRequest(type="compound-savings", principal=principal, contribution=contribution, annual_rate=annual_rate, tax_rate=tax_rate, inflation_rate=inflation_rate, duration_months=duration_months, periods_per_year=12, to_currency="XOF")

        return None

    def _infer_starting_principal(self, context: dict[str, Any]) -> float:
        amount = context.get("amount")
        monthly_amount = context.get("monthly_savings_amount")
        if amount is None:
            return 0
        return 0 if monthly_amount is not None and amount == monthly_amount else amount

    def _resolve_market_request(self, context: dict[str, Any]) -> dict[str, str] | None:
        text = context.get("combined_normalized", "")
        raw_text = context.get("combined_text", "")
        if not text:
            return None

        has_market_signal = self._matches_any(text, ["cours", "prix", "taux", "change", "forex", "bitcoin", "btc", "ethereum", "eth", "dollar", "usd", "euro", "eur", "fcfa", "xof"])
        explicit_pair = re.search(r"\b[a-z]{3}\s*/\s*[a-z]{3}\b", text) is not None
        if not has_market_signal and not explicit_pair:
            return None

        if self._matches_any(text, ["bitcoin", "btc"]):
            return {"symbol": "BTC/USD", "asset_type": "crypto", "base_currency": "BTC", "quote_currency": "USD"}
        if self._matches_any(text, ["ethereum", " eth ", "eth/"]):
            return {"symbol": "ETH/USD", "asset_type": "crypto", "base_currency": "ETH", "quote_currency": "USD"}

        pair = self._resolve_forex_pair(text, raw_text)
        if pair is not None:
            return pair

        ticker_match = re.search(r"\b(AAPL|TSLA|NVDA|MSFT|META|GOOGL|AMZN)\b", raw_text.upper())
        if ticker_match:
            symbol = ticker_match.group(1)
            return {"symbol": symbol, "asset_type": "stock", "base_currency": "USD", "quote_currency": "USD"}
        return None

    def _format_calculation_tool_context(self, request: CalculationRequest, response: CalculationResponse) -> str:
        return (
            "Outil interne utilise: calculate\n"
            f"- type: {request.type}\n"
            f"- resultat principal: {self._format_amount(response.result)} {response.currency or ''}\n"
            f"- resume calcul: {response.summary}\n"
            f"- chiffres utiles: {self._summarize_calculation_breakdown(response)}"
        )

    def _summarize_calculation_breakdown(self, response: CalculationResponse) -> str:
        human_breakdown = {CALCULATION_LABELS.get(key, key): value for key, value in response.breakdown.items()}
        parts = [
            f"{key}: {self._format_breakdown_value(human_breakdown[key])}"
            for key in CALCULATION_PRIORITY.get(response.type, [])
            if key in human_breakdown
        ]
        if not parts:
            parts = [f"{key}: {self._format_breakdown_value(value)}" for key, value in list(human_breakdown.items())[:4]]
        return "; ".join(parts)

    def _format_market_tool_context(self, response: MarketDataResponse) -> str:
        change_part = f"{response.change_percent:+.2f} %" if response.change_percent is not None else "n/a"
        return (
            "Outil interne utilise: market-data\n"
            f"- provider: {response.provider}\n"
            f"- symbole: {response.symbol}\n"
            f"- prix ou taux: {response.price:.6f} {response.currency}\n"
            f"- variation: {change_part}\n"
            f"- derniere mise a jour: {response.last_updated}\n"
            f"- commentaire: {response.notes or 'aucune note'}"
        )

    def _format_breakdown_value(self, value: float | int | str) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, int):
            return str(value)
        return self._format_amount(value) if abs(value) >= 1000 else f"{value:.2f}"

    async def _demo_answer(self, context: dict[str, Any], language: str) -> str:
        if language in {"fon", "mina"}:
            return "Je peux déjà donner une orientation simple ici. Si vous voulez une réponse plus riche, reformulez aussi en français."
        calculation_request, calculation_response, market_response = await self._collect_tool_results(context)

        if market_response is not None and context.get("wants_market_data"):
            return self._build_market_demo_reply(market_response)

        if context["topic"] == "investment":
            base_reply = self._build_investment_demo_reply(context)
        elif context["topic"] == "credit":
            base_reply = self._build_credit_demo_reply(context)
        elif context["topic"] == "retirement":
            base_reply = self._build_retirement_demo_reply(context)
        elif context["topic"] == "savings":
            base_reply = self._build_savings_demo_reply(context)
        else:
            base_reply = self._build_general_demo_reply(context)

        insights: list[str] = []
        calculation_insight = self._build_demo_calculation_insight(context, calculation_request, calculation_response)
        if calculation_insight:
            insights.append(calculation_insight)

        market_insight = self._build_demo_market_insight(context, market_response)
        if market_insight:
            insights.append(market_insight)

        if not insights:
            return base_reply

        return base_reply + "\n\n" + "\n\n".join(insights)

    def _build_market_demo_reply(self, response: MarketDataResponse) -> str:
        change_part = ""
        if response.change_percent is not None:
            change_part = f", soit {response.change_percent:+.2f} %"

        note_part = f" Source: {response.provider}." if response.provider != "demo" else " Valeur indicative de démonstration."
        return (
            f"Le dernier niveau disponible pour {response.symbol} ressort autour de {response.price:,.6f} {response.currency}".replace(",", " ")
            + change_part
            + ". "
            + (response.notes or "Taux spot récupéré à la demande.")
            + note_part
        )

    def _build_demo_market_insight(
        self,
        context: dict[str, Any],
        response: MarketDataResponse | None,
    ) -> str:
        if response is None or context.get("topic") not in {"investment", "savings"}:
            return ""

        if response.asset_type == "forex":
            return (
                f"Repere marche: {response.symbol} vaut environ {response.price:,.6f} {response.currency}.".replace(",", " ")
                + " Utile si vous comparez un objectif local à une référence en devise."
            )

        if response.asset_type in {"crypto", "stock"}:
            change_part = ""
            if response.change_percent is not None:
                change_part = f" sur la derniere variation observee ({response.change_percent:+.2f} %)"
            return (
                f"Repere marche: {response.symbol} cote autour de {response.price:,.2f} {response.currency}".replace(",", " ")
                + change_part
                + ". Cela sert de point de référence, pas de promesse de rendement."
            )

        return ""

    def _build_demo_calculation_insight(
        self,
        context: dict[str, Any],
        request: CalculationRequest | None,
        response: CalculationResponse | None,
    ) -> str:
        if request is None or response is None:
            return ""

        if response.type == "compound-savings":
            real_future_value = response.breakdown.get("real_future_value")
            taxes_due = response.breakdown.get("taxes_due")
            base = (
                f"Projection SIKA : avec ces hypothèses, le capital net projeté ressort autour de {self._format_amount(response.result)} {response.currency or 'XOF'}."
            )
            if isinstance(real_future_value, (int, float)):
                base += f" En valeur réelle après inflation, cela correspond à environ {self._format_amount(float(real_future_value))} {response.currency or 'XOF'}."
            if isinstance(taxes_due, (int, float)) and taxes_due > 0:
                base += f" Les impôts estimés sur les gains représentent environ {self._format_amount(float(taxes_due))} {response.currency or 'XOF'}."
            return base

        if response.type == "loan-payment":
            total_monthly_payment = response.breakdown.get("total_monthly_payment")
            total_payment = response.breakdown.get("total_payment")
            if not isinstance(total_monthly_payment, (int, float)):
                return ""
            message = (
                f"Simulation SIKA : la mensualité totale estimée ressort autour de {self._format_amount(float(total_monthly_payment))} {response.currency or 'XOF'}."
            )
            if isinstance(total_payment, (int, float)):
                message += f" Le coût total estimé du crédit atteint environ {self._format_amount(float(total_payment))} {response.currency or 'XOF'}."
            return message

        if response.type == "simple-interest":
            return (
                f"Projection SIKA : le montant final net ressort autour de {self._format_amount(response.result)} {response.currency or 'XOF'}."
            )

        return ""

    def _build_savings_demo_reply(self, context: dict[str, Any]) -> str:
        if context.get("wants_savings_plan") or (
            context.get("is_affirmative_follow_up")
            and (context.get("monthly_savings_amount") is not None or context.get("amount") is not None)
        ):
            return self._build_savings_plan_reply(context)
        monthly_savings_amount = context.get("monthly_savings_amount")
        if monthly_savings_amount is not None:
            reserve_share = round(monthly_savings_amount * 0.4)
            project_share = round(monthly_savings_amount * 0.3)
            return (
                f"Avec {self._format_amount(monthly_savings_amount)} par mois, vous pouvez déjà construire quelque chose de solide. "
                f"Je commencerais par mettre environ {self._format_amount(reserve_share)} de côté pour la réserve de sécurité et {self._format_amount(project_share)} pour vos projets à court ou moyen terme. "
                "Le reste peut servir à prendre doucement l'habitude d'investir de façon régulière. "
                "Si vous voulez, je peux maintenant vous transformer ça en plan simple en 3 étapes."
            )
        amount = context.get("amount")
        if amount is not None:
            return (
                f"Avec {self._format_amount(amount)} au départ, je ne chercherais pas tout de suite la performance. "
                "Je commencerais par protéger une partie en réserve disponible, puis j'installerais une épargne mensuelle simple et régulière. "
                "Si vous voulez, donnez-moi votre revenu mensuel et je vous propose une répartition concrète."
            )
        return (
            "Pour bien démarrer, il n'est pas nécessaire de viser gros tout de suite. "
            "Le plus utile est de mettre en place une épargne automatique réaliste, de construire une réserve de sécurité, puis d'augmenter progressivement l'effort quand le budget le permet. "
            "Si vous me donnez votre revenu mensuel, je peux vous proposer une méthode simple et concrète."
        )

    def _build_savings_plan_reply(self, context: dict[str, Any]) -> str:
        monthly_amount = context.get("monthly_savings_amount") or context.get("amount")
        if monthly_amount is None:
            return (
                "Voici un plan simple en 3 étapes : 1. sécuriser une réserve de précaution, 2. automatiser un montant fixe chaque mois, 3. augmenter progressivement l'effort d'épargne quand le revenu progresse. "
                "Si vous me donnez votre revenu mensuel net et vos charges fixes, je peux le traduire en montants concrets."
            )

        reserve_amount = round(monthly_amount * 0.5)
        project_amount = round(monthly_amount * 0.3)
        progression_amount = max(0, round(monthly_amount - reserve_amount - project_amount))
        return (
            f"Voici un plan simple en 3 étapes avec {self._format_amount(monthly_amount)} par mois :\n"
            f"1. Réserve de sécurité : mettez {self._format_amount(reserve_amount)} par mois de côté jusqu'à atteindre au moins 2 à 3 mois de dépenses essentielles.\n"
            f"2. Objectif court ou moyen terme : affectez {self._format_amount(project_amount)} par mois à un support disponible pour vos projets des 12 à 36 prochains mois.\n"
            f"3. Progression : gardez {self._format_amount(progression_amount)} par mois pour un objectif plus long terme ou pour augmenter graduellement votre effort d'épargne.\n"
            "Quand la réserve est suffisante, vous pouvez rediriger une partie de l'étape 1 vers l'étape 2 ou 3. Si vous me donnez votre revenu mensuel net, je peux recalibrer ce plan plus finement."
        )

    def _build_credit_demo_reply(self, context: dict[str, Any]) -> str:
        duration_months = context.get("duration_months")
        if duration_months:
            return (
                f"Avec un horizon de {self._format_duration(duration_months)}, regardez surtout la mensualité supportable, le coût total du crédit et la marge de sécurité restante. "
                "Si vous me donnez montant, taux et durée, je peux répondre plus concrètement."
            )
        return (
            "Avant d'accepter un crédit, vérifiez mensualité, coût total et marge de sécurité après charges fixes. "
            "Donnez-moi montant, taux et durée si vous voulez une réponse directe."
        )

    def _build_retirement_demo_reply(self, context: dict[str, Any]) -> str:
        duration_months = context.get("duration_months")
        if duration_months:
            return (
                f"Sur {self._format_duration(duration_months)}, utilisez une hypothèse de rendement prudente et testez plusieurs scénarios. "
                "Si vous avez déjà un capital et un effort mensuel cible, je peux structurer une réponse plus concrète."
            )
        return (
            "Pour un objectif long terme, partez d'un horizon clair, d'un capital de départ, d'un versement régulier et d'une hypothèse prudente. "
            "Donnez-moi votre âge cible et votre effort mensuel si vous voulez aller plus loin."
        )

    def _build_investment_demo_reply(self, context: dict[str, Any]) -> str:
        if (
            (context.get("wants_allocation_plan") or context.get("is_affirmative_follow_up"))
            and context.get("amount") is not None
            and context.get("duration_months")
        ):
            return self._build_allocation_plan_reply(context)

        amount = context.get("amount")
        monthly_savings_amount = context.get("monthly_savings_amount")
        duration_months = context.get("duration_months")
        risk_profile = context.get("risk_profile")
        amount_part = f"Avec {self._format_amount(amount)}" if amount is not None else "Avec ce capital"
        horizon_part = f" sur {self._format_duration(duration_months)}" if duration_months else ""
        risk_part = f", dans un profil {risk_profile}" if risk_profile else ""

        if amount is not None and monthly_savings_amount is not None:
            monthly_part = self._format_amount(monthly_savings_amount)
            if duration_months:
                return (
                    f"Avec {self._format_amount(amount)} déjà disponibles et {monthly_part} par mois{horizon_part}{risk_part}, vous avez déjà une bonne base. "
                    "Je structurerais cela en 3 poches : une réserve disponible, une poche projets pour ce qui peut arriver dans les 12 à 24 prochains mois, puis une poche investissement diversifiée pour le moyen terme. "
                    f"Sur les nouveaux versements, vous pouvez garder une petite partie des {monthly_part} pour la trésorerie et investir progressivement le reste pour lisser le risque. "
                    "Si vous voulez, je peux maintenant vous proposer 3 allocations types et vous dire comment répartir aussi les nouveaux versements mensuels."
                )
            return (
                f"Avec {self._format_amount(amount)} aujourd'hui et {monthly_part} par mois, je commencerais par séparer votre effort en deux : épargne de sécurité d'un côté, investissement progressif de l'autre. "
                "Conservez d'abord une poche disponible pour les imprévus et les projets proches, puis investissez progressivement une partie fixe chaque mois pour lisser le risque. "
                "Pour la partie investissement, dites-moi simplement votre horizon et si vous voulez quelque chose de prudent, équilibré ou plus dynamique, et je vous propose une répartition concrète."
            )

        if duration_months and duration_months <= 24:
            return (
                f"{amount_part}{horizon_part}{risk_part}, je serais plutot prudent: sur un horizon aussi court, la priorite est la protection du capital et la disponibilite. "
                "Je n'exposerais pas l'ensemble a des actifs trop volatils. Gardez l'essentiel sur un support court terme ou faible risque, et seulement une petite part plus dynamique si une baisse temporaire reste acceptable. "
                "Si vous voulez, je peux proposer une répartition prudente, équilibrée ou dynamique."
            )
        if duration_months and duration_months <= 60:
            return (
                f"{amount_part}{horizon_part}{risk_part}, une approche équilibrée peut se discuter : une base défensive pour stabiliser le capital, puis une poche de croissance mesurée. "
                "Le plus important est de diversifier plutot que tout mettre sur un seul actif. Si vous voulez, je peux proposer 3 allocations types."
            )
        if duration_months and duration_months > 60:
            return (
                f"{amount_part}{horizon_part}{risk_part}, vous avez davantage de marge pour accepter des fluctuations temporaires, a condition de garder une reserve liquide a part. "
                "Une diversification plus dynamique peut se discuter, mais toujours sans promesse de rendement."
            )
        if context.get("is_follow_up") and amount is not None:
            return (
                f"{amount_part}, je peux deja vous orienter, mais l'horizon de placement change beaucoup la recommandation. "
                "Sur moins de 2 ans, je serais prudent. Sur 3 à 5 ans, une approche équilibrée devient plus défendable. Donnez-moi simplement la durée et votre profil de risque."
            )
        return (
            "Je peux vous orienter utilement sur un investissement, mais il me manque encore trois repères : le montant, la durée visée et votre niveau de prudence face au risque. "
            "Vous pouvez me le dire naturellement, par exemple : j'ai 25 000 à placer sur 5 ans, profil équilibré."
        )

    def _build_allocation_plan_reply(self, context: dict[str, Any]) -> str:
        profiles = self._get_allocation_profiles(context["duration_months"])
        lines = []
        for index, profile in enumerate(profiles, start=1):
            allocations = self._format_allocation_breakdown(context["amount"], profile["mix"])
            lines.append(f"{index}. {profile['name']}: {allocations}.")

        risk_profile = context.get("risk_profile")
        if risk_profile == "dynamique":
            recommendation = "Pour votre profil dynamique, l'option 3 est la plus proche de votre demande, mais sur 4 ans je garderais quand meme une vraie base defensive."
        elif risk_profile == "equilibre":
            recommendation = "Pour votre profil équilibré, l'option 2 est en général le meilleur point de départ."
        else:
            recommendation = "Pour un profil prudent, l'option 1 est la plus defensive."

        annual_rate = context.get("annual_rate")
        target_rate = (
            f" Si votre objectif implicite est proche de {annual_rate} % par an, l'option 2 ou 3 peut se discuter sans garantie de resultat."
            if annual_rate is not None
            else ""
        )
        monthly_extension = ""
        if context.get("monthly_savings_amount") is not None:
            monthly_extension = (
                f" Si vous versez aussi {self._format_amount(context['monthly_savings_amount'])} par mois, vous pouvez reprendre la même logique de répartition sur les nouveaux versements."
            )
        return (
            f"Voici 3 allocations types adaptées à {self._format_duration(context['duration_months'])} pour {self._format_amount(context['amount'])} :\n"
            + "\n".join(lines)
            + "\n"
            + recommendation
            + target_rate
            + monthly_extension
        )

    def _build_general_demo_reply(self, context: dict[str, Any]) -> str:
        if context.get("is_greeting_only"):
            return (
                "Bonjour. Dites-moi simplement ce que vous voulez faire : mieux épargner, investir progressivement, comprendre un crédit ou préparer un objectif comme la retraite. "
                "Vous pouvez parler naturellement, par exemple: j'ai 25 000 aujourd'hui et 200 000 par mois, comment m'organiser ?"
            )
        if context.get("is_follow_up") and context.get("topic"):
            return (
                "Je peux aller plus loin, mais j'ai besoin d'un detail concret pour sortir du generique. "
                "Donnez-moi votre montant, votre horizon et votre objectif principal."
            )
        return (
            "Je peux vous aider sur l'épargne, le budget, le crédit, la retraite et les bases de l'investissement. "
            "Pour que ma réponse soit vraiment utile, dites-moi simplement votre objectif, les montants en jeu et votre horizon. Je m'adapte ensuite."
        )

    def _extract_context(self, payload: ChatRequest) -> dict[str, Any]:
        user_messages = [item.content for item in payload.history if item.role == "user"]
        assistant_messages = [item.content for item in payload.history if item.role == "assistant"]
        user_messages.append(payload.message)
        current_normalized = self._normalize(payload.message)
        combined_normalized = " || ".join(self._normalize(message) for message in user_messages)
        combined_text = " || ".join(user_messages)
        assistant_normalized = " || ".join(self._normalize(message) for message in assistant_messages)
        wants_allocation_plan = self._is_allocation_request(current_normalized)
        wants_savings_plan = self._is_savings_plan_request(current_normalized)
        is_affirmative_follow_up = self._is_affirmative_follow_up(current_normalized)
        is_greeting_only = self._is_greeting_only(current_normalized)
        amount = self._find_latest_amount(user_messages)
        monthly_savings_amount = self._find_latest_monthly_amount(user_messages)
        duration_months = self._find_latest_duration_months(user_messages)
        annual_rate = self._find_latest_annual_rate(user_messages)
        tax_rate = self._find_latest_tax_rate(user_messages)
        inflation_rate = self._find_latest_inflation_rate(user_messages)
        insurance_rate = self._find_latest_insurance_rate(user_messages)
        risk_profile = self._find_latest_risk_profile(user_messages)
        topic = self._find_latest_topic(user_messages)

        if topic is None and wants_allocation_plan and (amount is not None or duration_months is not None or risk_profile is not None):
            topic = "investment"
        if topic is None and wants_savings_plan and (monthly_savings_amount is not None or amount is not None):
            topic = "savings"
        if topic is None and is_affirmative_follow_up:
            if self._matches_any(assistant_normalized, ["allocation", "allocations", "repartition", "portefeuille", "profil"]):
                topic = "investment"
            elif self._matches_any(assistant_normalized, ["plan simple", "epargne", "reserve de securite", "revenu mensuel"]):
                topic = "savings"

        return {
            "topic": topic,
            "amount": amount,
            "monthly_savings_amount": monthly_savings_amount,
            "duration_months": duration_months,
            "annual_rate": annual_rate,
            "tax_rate": tax_rate,
            "inflation_rate": inflation_rate,
            "insurance_rate": insurance_rate,
            "risk_profile": risk_profile,
            "is_follow_up": self._is_advice_follow_up(current_normalized),
            "is_affirmative_follow_up": is_affirmative_follow_up,
            "is_greeting_only": is_greeting_only,
            "wants_allocation_plan": wants_allocation_plan,
            "wants_savings_plan": wants_savings_plan,
            "wants_market_data": self._looks_like_market_question(current_normalized),
            "current_normalized": current_normalized,
            "combined_normalized": combined_normalized,
            "combined_text": combined_text,
            "assistant_normalized": assistant_normalized,
        }

    def _find_latest_topic(self, messages: list[str]) -> str | None:
        for raw_message in reversed(messages):
            normalized = self._normalize(raw_message)
            if self._matches_any(normalized, ["invest", "placement", "rendement", "bourse", "crypto"]):
                return "investment"
            if self._matches_any(normalized, ["credit", "pret", "mensualite", "remboursement", "emprunt"]):
                return "credit"
            if self._matches_any(normalized, ["retraite", "patrimoine", "long terme"]):
                return "retirement"
            if self._matches_any(normalized, ["epargne", "budget", "econom", "tresorerie"]):
                return "savings"
        return None

    def _find_latest_amount(self, messages: list[str]) -> float | None:
        pattern = re.compile(r"(\d[\d\s.,]{2,})(?:\s*)(k|m)?\b", re.IGNORECASE)
        for raw_message in reversed(messages):
            match = pattern.search(raw_message.replace("\xa0", " "))
            if not match:
                continue
            numeric_part = match.group(1).replace(" ", "").replace(",", ".")
            try:
                value = float(numeric_part)
            except ValueError:
                continue
            suffix = (match.group(2) or "").lower()
            if suffix == "k":
                return value * 1000
            if suffix == "m":
                return value * 1_000_000
            return value
        return None

    def _find_latest_monthly_amount(self, messages: list[str]) -> float | None:
        pattern = re.compile(r"(\d[\d\s.,]{2,})(?:\s*)(k|m)?\s*(?:/|\bpar\b)\s*(?:mois|mensuel(?:le)?s?)\b", re.IGNORECASE)
        for raw_message in reversed(messages):
            match = pattern.search(raw_message.replace("\xa0", " "))
            if not match:
                continue
            numeric_part = match.group(1).replace(" ", "").replace(",", ".")
            try:
                value = float(numeric_part)
            except ValueError:
                continue
            suffix = (match.group(2) or "").lower()
            if suffix == "k":
                return value * 1000
            if suffix == "m":
                return value * 1_000_000
            return value
        return None

    def _find_latest_duration_months(self, messages: list[str]) -> int | None:
        pattern = re.compile(r"(\d+(?:[.,]\d+)?)\s*(ans?|annees?|mois)\b", re.IGNORECASE)
        for raw_message in reversed(messages):
            normalized = self._normalize(raw_message)
            match = pattern.search(normalized)
            if not match:
                continue
            value = float(match.group(1).replace(",", "."))
            return round(value) if match.group(2).startswith("mois") else round(value * 12)
        return None

    def _find_latest_risk_profile(self, messages: list[str]) -> str | None:
        for raw_message in reversed(messages):
            normalized = self._normalize(raw_message)
            if self._matches_any(normalized, ["prudent", "faible risque", "sans risque"]):
                return "prudent"
            if self._matches_any(normalized, ["equilibre", "modere", "moderer"]):
                return "equilibre"
            if self._matches_any(normalized, ["dynamique", "agressif", "volatil"]):
                return "dynamique"
        return None

    def _find_latest_annual_rate(self, messages: list[str]) -> float | None:
        for raw_message in reversed(messages):
            normalized = self._normalize(raw_message)
            match = re.search(r"taux\s+de\s+(\d+(?:[.,]\d+)?)\s*%", normalized) or re.search(r"(\d+(?:[.,]\d+)?)\s*%", normalized)
            if match:
                return float(match.group(1).replace(",", "."))
        return None

    def _find_latest_tax_rate(self, messages: list[str]) -> float | None:
        pattern = re.compile(r"(?:fiscalite|impot|taxe|taxation)\D{0,16}(\d+(?:[.,]\d+)?)\s*%", re.IGNORECASE)
        for raw_message in reversed(messages):
            match = pattern.search(self._normalize(raw_message))
            if match:
                return float(match.group(1).replace(",", "."))
        return None

    def _find_latest_inflation_rate(self, messages: list[str]) -> float | None:
        pattern = re.compile(r"inflation\D{0,16}(\d+(?:[.,]\d+)?)\s*%", re.IGNORECASE)
        for raw_message in reversed(messages):
            match = pattern.search(self._normalize(raw_message))
            if match:
                return float(match.group(1).replace(",", "."))
        return None

    def _find_latest_insurance_rate(self, messages: list[str]) -> float | None:
        pattern = re.compile(r"assurance\D{0,16}(\d+(?:[.,]\d+)?)\s*%", re.IGNORECASE)
        for raw_message in reversed(messages):
            match = pattern.search(self._normalize(raw_message))
            if match:
                return float(match.group(1).replace(",", "."))
        return None

    def _is_advice_follow_up(self, normalized_message: str) -> bool:
        return self._matches_any(normalized_message, ["tu me conseilles", "vous me conseillez", "que faire", "je fais quoi", "tu proposes", "vous proposez", "tu ferais quoi", "que me proposes", "quelle option"])

    def _is_affirmative_follow_up(self, normalized_message: str) -> bool:
        return self._matches_any(
            normalized_message,
            [
                "d'accord",
                "ok",
                "okay",
                "oui",
                "vas-y",
                "vas y",
                "allons-y",
                "allons y",
                "je veux bien",
                "ca marche",
                "tres bien",
                "parfait",
            ],
        )

    def _is_greeting_only(self, normalized_message: str) -> bool:
        stripped = normalized_message.strip()
        return stripped in {"bonjour", "bonsoir", "salut", "hello", "bjr", "coucou"}

    def _is_allocation_request(self, normalized_message: str) -> bool:
        return self._matches_any(normalized_message, ["allocation", "allocations", "repartition", "repartitions", "portefeuille type", "portefeuilles types", "3 allocations", "trois allocations", "3 options", "trois options"])

    def _is_savings_plan_request(self, normalized_message: str) -> bool:
        return self._matches_any(normalized_message, ["plan simple", "propose moi un plan", "proposez moi un plan", "3 etapes", "trois etapes", "par etapes", "methode simple", "revenu mensuel"])

    def _resolve_forex_pair(self, normalized_text: str, raw_text: str) -> dict[str, str] | None:
        explicit_match = re.search(r"\b([A-Z]{3})\s*/\s*([A-Z]{3})\b", raw_text.upper())
        if explicit_match:
            base = explicit_match.group(1)
            quote = explicit_match.group(2)
            return {"symbol": f"{base}/{quote}", "asset_type": "forex", "base_currency": base, "quote_currency": quote}

        def has_any(code: str) -> bool:
            mapping = {"xof": ["xof", "fcfa", "cfa"], "eur": ["eur", "euro"], "usd": ["usd", "dollar", "dollars"]}
            return self._matches_any(normalized_text, mapping[code])

        if has_any("usd") and has_any("xof"):
            if re.search(r"(usd|dollar).*(xof|fcfa|cfa)", normalized_text):
                return {"symbol": "USD/XOF", "asset_type": "forex", "base_currency": "USD", "quote_currency": "XOF"}
            return {"symbol": "XOF/USD", "asset_type": "forex", "base_currency": "XOF", "quote_currency": "USD"}
        if has_any("eur") and has_any("xof"):
            if re.search(r"(eur|euro).*(xof|fcfa|cfa)", normalized_text):
                return {"symbol": "EUR/XOF", "asset_type": "forex", "base_currency": "EUR", "quote_currency": "XOF"}
            return {"symbol": "XOF/EUR", "asset_type": "forex", "base_currency": "XOF", "quote_currency": "EUR"}
        if has_any("eur") and has_any("usd"):
            if re.search(r"(usd|dollar).*(eur|euro)", normalized_text):
                return {"symbol": "USD/EUR", "asset_type": "forex", "base_currency": "USD", "quote_currency": "EUR"}
            return {"symbol": "EUR/USD", "asset_type": "forex", "base_currency": "EUR", "quote_currency": "USD"}
        return None

    def _looks_like_market_question(self, normalized_message: str) -> bool:
        return self._matches_any(
            normalized_message,
            [
                "cours",
                "prix",
                "taux",
                "change",
                "forex",
                "bitcoin",
                "btc",
                "ethereum",
                "eth",
                "dollar",
                "usd",
                "euro",
                "eur",
                "fcfa",
                "xof",
            ],
        ) or re.search(r"\b[a-z]{3}\s*/\s*[a-z]{3}\b", normalized_message) is not None

    def _matches_any(self, text: str, needles: list[str]) -> bool:
        return any(needle in text for needle in needles)

    def _normalize(self, value: str) -> str:
        normalized = unicodedata.normalize("NFD", value.lower())
        return "".join(char for char in normalized if not unicodedata.combining(char))

    def _format_amount(self, value: float) -> str:
        return f"{value:,.0f}".replace(",", " ")

    def _format_duration(self, duration_months: int) -> str:
        if duration_months % 12 == 0:
            years = duration_months // 12
            return "1 an" if years == 1 else f"{years} ans"
        return f"{duration_months} mois"

    def _get_allocation_profiles(self, duration_months: int) -> list[dict[str, Any]]:
        if duration_months <= 24:
            return [
                {"name": "Prudente", "mix": [("supports liquides / faible risque", 70), ("fonds defensifs / obligataires", 25), ("poche croissance", 5)]},
                {"name": "Equilibree", "mix": [("supports liquides / faible risque", 55), ("fonds defensifs / diversifies", 35), ("poche croissance", 10)]},
                {"name": "Dynamique", "mix": [("supports liquides / faible risque", 40), ("fonds diversifies", 40), ("poche croissance", 20)]},
            ]
        if duration_months <= 60:
            return [
                {"name": "Prudente", "mix": [("supports liquides / faible risque", 50), ("fonds defensifs / obligataires", 35), ("poche croissance", 15)]},
                {"name": "Equilibree", "mix": [("supports liquides / faible risque", 35), ("fonds diversifies", 40), ("actions / croissance", 25)]},
                {"name": "Dynamique", "mix": [("supports liquides / faible risque", 20), ("fonds diversifies", 35), ("actions / croissance", 45)]},
            ]
        return [
            {"name": "Prudente", "mix": [("supports liquides / faible risque", 35), ("fonds defensifs / obligataires", 40), ("actions / croissance", 25)]},
            {"name": "Equilibree", "mix": [("supports liquides / faible risque", 20), ("fonds diversifies", 40), ("actions / croissance", 40)]},
            {"name": "Dynamique", "mix": [("supports liquides / faible risque", 10), ("fonds diversifies", 30), ("actions / croissance", 60)]},
        ]

    def _format_allocation_breakdown(self, amount: float, mix: list[tuple[str, int]]) -> str:
        values: list[float] = []
        for index, (_, percentage) in enumerate(mix):
            if index == len(mix) - 1:
                values.append(amount - sum(values))
            else:
                values.append(round(amount * percentage / 100))
        return ", ".join(f"{percentage} % {label} ({self._format_amount(values[index])})" for index, (label, percentage) in enumerate(mix))


@lru_cache
def get_chat_service() -> ChatService:
    return ChatService(get_settings())
