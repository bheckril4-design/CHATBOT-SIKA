from __future__ import annotations

import re
import unicodedata
from functools import lru_cache
from typing import Any

from fastapi import HTTPException

try:
    from openai import AsyncOpenAI, OpenAIError
except ModuleNotFoundError:  # pragma: no cover - fallback for bootstrapping
    AsyncOpenAI = None

    class OpenAIError(Exception):
        pass

from app.core.config import Settings, get_settings
from app.schemas import ChatRequest, ChatResponse


BASE_SYSTEM_PROMPT = """
Tu es SIKA, un assistant financier concis, pédagogique, fiable et proactif.
Tu aides en priorité des utilisateurs en Afrique francophone.

Regles:
- réponds avec clarté et sans jargon inutile;
- adapte le niveau au contexte de l'utilisateur;
- exploite l'historique récent pour éviter de reposer les mêmes questions;
- quand l'utilisateur donne deja un montant, un horizon ou un objectif, donne directement
  une orientation utile avant de demander au plus une précision critique;
- pour les relances courtes comme "tu me conseilles quoi ?", inférer le contexte récent
  au lieu de repartir sur une réponse générique;
- quand c'est utile, propose 2 ou 3 options concrètement nommées, par exemple prudent,
  équilibré et dynamique;
- si l'utilisateur demande un avis pratique, commence par une recommandation provisoire
  argumentée, puis mentionne l'élément qu'il faudrait vérifier pour affiner;
- propose des options prudentes, et annonce clairement les limites ou les points à vérifier;
- ne promets jamais de rendement garanti;
- ne fournis jamais de conseil d'investissement personnalisé, de promesse de gain,
  ni d'instruction fiscale ou légale définitive;
- formule les réponses comme un contenu éducatif et prudent;
- si la langue demandee est Fon ou Mina et que tu n'es pas certain, reponds simplement
  dans cette langue quand possible, sinon propose une reformulation courte en français.
""".strip()


class ChatService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = (
            AsyncOpenAI(api_key=settings.openai_api_key)
            if settings.openai_api_key and AsyncOpenAI is not None
            else None
        )

    async def answer(self, payload: ChatRequest) -> ChatResponse:
        language = self._resolve_language(payload.language)
        user_id = payload.user_id or "anonymous"

        if self.settings.demo_mode:
            return ChatResponse(
                answer=self._demo_answer(payload, language),
                language=language,
                source="demo",
                user_id=user_id,
            )

        if not self.client:
            if self.settings.openai_api_key and AsyncOpenAI is None:
                raise HTTPException(
                    status_code=503,
                    detail="Le package OpenAI n'est pas installé sur ce serveur.",
                )

            raise HTTPException(
                status_code=503,
                detail="Le mode démo est désactivé et OPENAI_API_KEY n'est pas configuré.",
            )

        try:
            response = await self.client.responses.create(
                **self._build_openai_request(
                    self._build_prompt(payload, language)
                )
            )
        except OpenAIError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Erreur du fournisseur IA: {exc.__class__.__name__}",
            ) from exc

        answer = (response.output_text or "").strip()
        if not answer:
            raise HTTPException(
                status_code=502,
                detail="La réponse IA est vide. Merci de réessayer.",
            )

        return ChatResponse(
            answer=answer,
            language=language,
            source="openai",
            user_id=user_id,
        )

    def _build_prompt(self, payload: ChatRequest, language: str) -> list[dict[str, Any]]:
        prompt: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            f"{BASE_SYSTEM_PROMPT}\n\n"
                            f"Langue de sortie cible: {language}.\n"
                            "Si la langue est 'fr', réponds en français."
                        ),
                    }
                ],
            }
        ]

        history = payload.history[-self.settings.max_history_messages :]
        for item in history:
            prompt.append(
                {
                    "role": item.role,
                    "content": [{"type": "input_text", "text": item.content}],
                }
            )

        prompt.append(
            {
                "role": "user",
                "content": [{"type": "input_text", "text": payload.message}],
            }
        )
        return prompt

    def _build_openai_request(self, prompt: list[dict[str, Any]]) -> dict[str, Any]:
        model = self.settings.openai_model
        request: dict[str, Any] = {
            "model": model,
            "input": prompt,
        }

        if model.startswith("gpt-5"):
            reasoning_effort = self._resolve_reasoning_effort_for_model(model)
            request["reasoning"] = {"effort": reasoning_effort}
            request["text"] = {"verbosity": self.settings.openai_text_verbosity}

            supports_temperature = (
                (model.startswith("gpt-5.1") or model.startswith("gpt-5.2"))
                and reasoning_effort == "none"
            )
            if supports_temperature and self.settings.openai_temperature is not None:
                request["temperature"] = self.settings.openai_temperature
            return request

        if self.settings.openai_temperature is not None:
            request["temperature"] = self.settings.openai_temperature

        return request

    def _resolve_reasoning_effort_for_model(self, model: str) -> str:
        requested_effort = self.settings.openai_reasoning_effort
        if model.startswith("gpt-5.1") or model.startswith("gpt-5.2"):
            return requested_effort

        if requested_effort == "none":
            return "minimal"

        return requested_effort

    def _resolve_language(self, requested: str) -> str:
        return "fr" if requested == "auto" else requested

    def _demo_answer(self, payload: ChatRequest, language: str) -> str:
        if language in {"fon", "mina"}:
            return (
                "Je peux déjà donner une orientation simple ici. "
                "Si vous voulez une réponse plus riche, reformulez aussi en français."
            )

        context = self._extract_context(payload)
        topic = context["topic"]

        if topic == "investment":
            return self._build_investment_demo_reply(context)
        if topic == "credit":
            return self._build_credit_demo_reply(context)
        if topic == "retirement":
            return self._build_retirement_demo_reply(context)
        if topic == "savings":
            return self._build_savings_demo_reply(context)

        return self._build_general_demo_reply(context)

    def _build_savings_demo_reply(self, context: dict[str, Any]) -> str:
        if context.get("wants_savings_plan"):
            return self._build_savings_plan_reply(context)

        monthly_savings_amount = context.get("monthly_savings_amount")
        if monthly_savings_amount is not None:
            return (
                f"Si vous pouvez épargner {self._format_amount(monthly_savings_amount)} par mois, "
                "le plus utile est de séparer réserve de sécurité et argent de projet. "
                "Commencez par mettre quelques mois de dépenses de côté, puis automatisez un "
                "versement régulier. Si vous voulez, je peux proposer un plan simple en 3 étapes "
                "à partir de ce montant mensuel."
            )

        amount = context.get("amount")
        if amount is not None:
            return (
                f"Si vous partez avec {self._format_amount(amount)}, le plus utile est de séparer "
                "réserve de sécurité et argent de projet. Commencez par mettre quelques mois de "
                "dépenses de côté, puis automatisez un versement régulier. Si vous voulez, "
                "donnez-moi votre revenu mensuel et vos charges fixes."
            )

        return (
            "Pour épargner efficacement, commencez par un montant automatique réaliste, puis "
            "construisez une réserve de sécurité avant de chercher du rendement. Donnez-moi "
            "votre revenu mensuel et vos charges fixes si vous voulez une méthode concrète."
        )

    def _build_savings_plan_reply(self, context: dict[str, Any]) -> str:
        monthly_amount = context.get("monthly_savings_amount") or context.get("amount")
        if monthly_amount is None:
            return (
                "Voici un plan simple en 3 étapes: 1. sécuriser une réserve de précaution, 2. "
                "automatiser un montant fixe chaque mois, 3. augmenter progressivement l'effort "
                "d'épargne quand le revenu progresse. Si vous me donnez votre revenu mensuel net "
                "et vos charges fixes, je peux le traduire en montants concrets."
            )

        reserve_amount = round(monthly_amount * 0.5)
        project_amount = round(monthly_amount * 0.3)
        progression_amount = max(0, round(monthly_amount - reserve_amount - project_amount))

        return (
            f"Voici un plan simple en 3 étapes avec {self._format_amount(monthly_amount)} par mois:\n"
            f"1. Réserve de sécurité: mettez {self._format_amount(reserve_amount)} par mois "
            "de côté jusqu'à atteindre au moins 2 à 3 mois de dépenses essentielles.\n"
            f"2. Objectif court ou moyen terme: affectez {self._format_amount(project_amount)} "
            "par mois à un support disponible pour vos projets des 12 à 36 prochains mois.\n"
            f"3. Progression: gardez {self._format_amount(progression_amount)} par mois pour un "
            "objectif plus long terme ou pour augmenter graduellement votre effort d'épargne.\n"
            "Quand la réserve est suffisante, vous pouvez rediriger une partie de l'étape 1 vers "
            "l'étape 2 ou 3. Si vous me donnez votre revenu mensuel net, je peux recalibrer ce "
            "plan plus finement."
        )

    def _build_credit_demo_reply(self, context: dict[str, Any]) -> str:
        duration_months = context.get("duration_months")
        if duration_months:
            return (
                f"Avec un horizon de {self._format_duration(duration_months)}, regardez surtout "
                "la mensualité supportable, le coût total du crédit et la marge de sécurité "
                "restante. Si vous me donnez montant, taux et durée, je peux répondre plus "
                "concrètement."
            )

        return (
            "Avant d'accepter un crédit, vérifiez mensualité, coût total et marge de sécurité "
            "après charges fixes. Donnez-moi montant, taux et durée si vous voulez une réponse "
            "directe."
        )

    def _build_retirement_demo_reply(self, context: dict[str, Any]) -> str:
        duration_months = context.get("duration_months")
        if duration_months:
            return (
                f"Sur {self._format_duration(duration_months)}, utilisez une hypothese de "
                "rendement prudente et testez plusieurs scenarios. Si vous avez deja un capital "
                "et un effort mensuel cible, je peux structurer une réponse plus concrète."
            )

        return (
            "Pour un objectif long terme, partez d'un horizon clair, d'un capital de depart, "
            "d'un versement regulier et d'une hypothese prudente. Donnez-moi votre age cible et "
            "votre effort mensuel si vous voulez aller plus loin."
        )

    def _build_investment_demo_reply(self, context: dict[str, Any]) -> str:
        if (
            context.get("wants_allocation_plan")
            and context.get("amount") is not None
            and context.get("duration_months")
        ):
            return self._build_allocation_plan_reply(context)

        amount = context.get("amount")
        duration_months = context.get("duration_months")
        risk_profile = context.get("risk_profile")

        amount_part = (
            f"Avec {self._format_amount(amount)}" if amount is not None else "Avec ce capital"
        )
        horizon_part = (
            f" sur {self._format_duration(duration_months)}" if duration_months else ""
        )
        risk_part = f", dans un profil {risk_profile}" if risk_profile else ""

        if duration_months and duration_months <= 24:
            return (
                f"{amount_part}{horizon_part}{risk_part}, je serais plutot prudent: sur un "
                "horizon aussi court, la priorite est la protection du capital et la "
                "disponibilite. Je n'exposerais pas l'ensemble a des actifs trop volatils. "
                "Gardez l'essentiel sur un support court terme ou faible risque, et seulement "
                "une petite part plus dynamique si une baisse temporaire reste acceptable. Si "
                "vous voulez, je peux proposer une répartition prudente, équilibrée ou dynamique."
            )

        if duration_months and duration_months <= 60:
            return (
                f"{amount_part}{horizon_part}{risk_part}, une approche équilibrée peut se "
                "discuter: une base défensive pour stabiliser le capital, puis une poche de "
                "croissance mesurée. Le plus important est de diversifier plutôt que tout mettre "
                "sur un seul actif. Si vous voulez, je peux proposer 3 allocations types."
            )

        if duration_months and duration_months > 60:
            return (
                f"{amount_part}{horizon_part}{risk_part}, vous avez davantage de marge pour "
                "accepter des fluctuations temporaires, à condition de garder une réserve liquide "
                "à part. Une diversification plus dynamique peut se discuter, mais toujours sans "
                "promesse de rendement."
            )

        if context.get("is_follow_up") and amount is not None:
            return (
                f"{amount_part}, je peux deja vous orienter, mais l'horizon de placement change "
                "beaucoup la recommandation. Sur moins de 2 ans, je serais prudent. Sur 3 à 5 "
                "ans, une approche équilibrée devient plus défendable. Donnez-moi simplement la "
                "durée et votre profil de risque."
            )

        return (
            "Pour vous conseiller utilement sur un investissement, j'ai surtout besoin de trois "
            "infos: montant, horizon et tolérance au risque. Répondez juste sous la forme: "
            "montant / durée / prudent-équilibré-dynamique."
        )

    def _build_allocation_plan_reply(self, context: dict[str, Any]) -> str:
        profiles = self._get_allocation_profiles(context["duration_months"])
        lines = []
        for index, profile in enumerate(profiles, start=1):
            allocations = self._format_allocation_breakdown(context["amount"], profile["mix"])
            lines.append(f"{index}. {profile['name']}: {allocations}.")

        risk_profile = context.get("risk_profile")
        if risk_profile == "dynamique":
            recommendation = (
                "Pour votre profil dynamique, l'option 3 est la plus proche de votre demande, "
                "mais sur 4 ans je garderais quand meme une vraie base defensive."
            )
        elif risk_profile == "equilibre":
            recommendation = (
                "Pour votre profil équilibré, l'option 2 est en général le meilleur point de départ."
            )
        else:
            recommendation = "Pour un profil prudent, l'option 1 est la plus defensive."

        annual_rate = context.get("annual_rate")
        target_rate = (
            f" Si votre objectif implicite est proche de {annual_rate} % par an, l'option 2 ou 3 "
            "peut se discuter sans garantie de resultat."
            if annual_rate is not None
            else ""
        )

        return (
            f"Voici 3 allocations types adaptees a {self._format_duration(context['duration_months'])} "
            f"pour {self._format_amount(context['amount'])}:\n"
            + "\n".join(lines)
            + "\n"
            + recommendation
            + target_rate
        )

    def _build_general_demo_reply(self, context: dict[str, Any]) -> str:
        if context.get("is_follow_up") and context.get("topic"):
            return (
                "Je peux aller plus loin, mais j'ai besoin d'un detail concret pour sortir du "
                "generique. Donnez-moi votre montant, votre horizon et votre objectif principal."
            )

        return (
            "Je peux aider sur l'épargne, le budget, le crédit, la retraite et les bases de "
            "l'investissement. Pour une réponse vraiment utile, donnez-moi votre objectif, le "
            "montant concerné, votre horizon et votre tolérance au risque."
        )

    def _extract_context(self, payload: ChatRequest) -> dict[str, Any]:
        user_messages = [item.content for item in payload.history if item.role == "user"]
        user_messages.append(payload.message)

        current_normalized = self._normalize(payload.message)
        wants_allocation_plan = self._is_allocation_request(current_normalized)
        wants_savings_plan = self._is_savings_plan_request(current_normalized)
        amount = self._find_latest_amount(user_messages)
        monthly_savings_amount = self._find_latest_monthly_amount(user_messages)
        duration_months = self._find_latest_duration_months(user_messages)
        annual_rate = self._find_latest_annual_rate(user_messages)
        risk_profile = self._find_latest_risk_profile(user_messages)
        topic = self._find_latest_topic(user_messages)

        if topic is None and wants_allocation_plan and (
            amount is not None or duration_months is not None or risk_profile is not None
        ):
            topic = "investment"

        if topic is None and wants_savings_plan and (
            monthly_savings_amount is not None or amount is not None
        ):
            topic = "savings"

        return {
            "topic": topic,
            "amount": amount,
            "monthly_savings_amount": monthly_savings_amount,
            "duration_months": duration_months,
            "annual_rate": annual_rate,
            "risk_profile": risk_profile,
            "is_follow_up": self._is_advice_follow_up(current_normalized),
            "wants_allocation_plan": wants_allocation_plan,
            "wants_savings_plan": wants_savings_plan,
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
        pattern = re.compile(
            r"(\d[\d\s.,]{2,})(?:\s*)(k|m)?\s*(?:/|\bpar\b)\s*(?:mois|mensuel(?:le)?s?)\b",
            re.IGNORECASE,
        )
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
            unit = match.group(2)
            return round(value) if unit.startswith("mois") else round(value * 12)
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
            match = re.search(r"taux\s+de\s+(\d+(?:[.,]\d+)?)\s*%", normalized) or re.search(
                r"(\d+(?:[.,]\d+)?)\s*%", normalized
            )
            if not match:
                continue

            return float(match.group(1).replace(",", "."))
        return None

    def _is_advice_follow_up(self, normalized_message: str) -> bool:
        return self._matches_any(
            normalized_message,
            [
                "tu me conseilles",
                "vous me conseillez",
                "que faire",
                "je fais quoi",
                "tu proposes",
                "vous proposez",
                "tu ferais quoi",
                "que me proposes",
                "quelle option",
            ],
        )

    def _is_allocation_request(self, normalized_message: str) -> bool:
        return self._matches_any(
            normalized_message,
            [
                "allocation",
                "allocations",
                "repartition",
                "repartitions",
                "portefeuille type",
                "portefeuilles types",
                "3 allocations",
                "trois allocations",
                "3 options",
                "trois options",
            ],
        )

    def _is_savings_plan_request(self, normalized_message: str) -> bool:
        return self._matches_any(
            normalized_message,
            [
                "plan simple",
                "propose moi un plan",
                "proposez moi un plan",
                "3 etapes",
                "trois etapes",
                "par etapes",
                "methode simple",
                "revenu mensuel",
            ],
        )

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
                {
                    "name": "Prudente",
                    "mix": [
                        ("supports liquides / faible risque", 70),
                        ("fonds defensifs / obligataires", 25),
                        ("poche croissance", 5),
                    ],
                },
                {
                    "name": "Equilibree",
                    "mix": [
                        ("supports liquides / faible risque", 55),
                        ("fonds defensifs / diversifies", 35),
                        ("poche croissance", 10),
                    ],
                },
                {
                    "name": "Dynamique",
                    "mix": [
                        ("supports liquides / faible risque", 40),
                        ("fonds diversifies", 40),
                        ("poche croissance", 20),
                    ],
                },
            ]

        if duration_months <= 60:
            return [
                {
                    "name": "Prudente",
                    "mix": [
                        ("supports liquides / faible risque", 50),
                        ("fonds defensifs / obligataires", 35),
                        ("poche croissance", 15),
                    ],
                },
                {
                    "name": "Equilibree",
                    "mix": [
                        ("supports liquides / faible risque", 35),
                        ("fonds diversifies", 40),
                        ("actions / croissance", 25),
                    ],
                },
                {
                    "name": "Dynamique",
                    "mix": [
                        ("supports liquides / faible risque", 20),
                        ("fonds diversifies", 35),
                        ("actions / croissance", 45),
                    ],
                },
            ]

        return [
            {
                "name": "Prudente",
                "mix": [
                    ("supports liquides / faible risque", 35),
                    ("fonds defensifs / obligataires", 40),
                    ("actions / croissance", 25),
                ],
            },
            {
                "name": "Equilibree",
                "mix": [
                    ("supports liquides / faible risque", 20),
                    ("fonds diversifies", 40),
                    ("actions / croissance", 40),
                ],
            },
            {
                "name": "Dynamique",
                "mix": [
                    ("supports liquides / faible risque", 10),
                    ("fonds diversifies", 30),
                    ("actions / croissance", 60),
                ],
            },
        ]

    def _format_allocation_breakdown(self, amount: float, mix: list[tuple[str, int]]) -> str:
        values: list[float] = []
        for index, (_, percentage) in enumerate(mix):
            if index == len(mix) - 1:
                allocated_so_far = sum(values)
                values.append(amount - allocated_so_far)
            else:
                values.append(round(amount * percentage / 100))

        parts = []
        for index, (label, percentage) in enumerate(mix):
            parts.append(f"{percentage} % {label} ({self._format_amount(values[index])})")
        return ", ".join(parts)


@lru_cache
def get_chat_service() -> ChatService:
    return ChatService(get_settings())
