from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.schemas import MarketDataResponse


class FinanceService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def get_market_data(
        self,
        symbol: str,
        asset_type: str,
        base_currency: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        if self.settings.demo_mode or self.settings.market_data_provider == "demo":
            return self._demo(symbol, asset_type, quote_currency)

        if asset_type == "forex" and self.settings.exchange_rate_api_key:
            return await self._exchange_rate(base_currency, quote_currency)

        if self.settings.twelve_data_api_key:
            return await self._twelve_data(symbol, asset_type)

        raise HTTPException(
            status_code=503,
            detail="Aucun provider financier n'est configure.",
        )

    def _demo(self, symbol: str, asset_type: str, currency: str) -> MarketDataResponse:
        return MarketDataResponse(
            provider="demo",
            asset_type=asset_type,
            symbol=symbol.upper(),
            price=612.45,
            currency=currency.upper(),
            change_percent=1.18,
            last_updated=datetime.now(timezone.utc).isoformat(),
            notes="Valeur de demonstration. Connectez un provider reel pour la production.",
        )

    async def _twelve_data(self, symbol: str, asset_type: str) -> MarketDataResponse:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.twelvedata.com/quote",
                    params={"symbol": symbol, "apikey": self.settings.twelve_data_api_key},
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail="Impossible de joindre Twelve Data pour le moment.",
            ) from exc

        if response.is_error:
            raise HTTPException(
                status_code=502,
                detail="Le provider Twelve Data a retourne une erreur.",
            )

        data = response.json()
        if data.get("status") == "error":
            raise HTTPException(
                status_code=502,
                detail=f"Twelve Data a refuse la requete: {data.get('message', 'erreur inconnue')}",
            )

        try:
            price = float(data["close"])
            change_percent = float(data.get("percent_change", 0))
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Twelve Data a retourne une charge utile invalide.",
            ) from exc

        return MarketDataResponse(
            provider="twelve-data",
            asset_type=asset_type,
            symbol=symbol.upper(),
            price=price,
            currency=data.get("currency", "USD"),
            change_percent=change_percent,
            last_updated=datetime.now(timezone.utc).isoformat(),
            notes=data.get("exchange"),
        )

    async def _exchange_rate(
        self,
        base_currency: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    f"https://v6.exchangerate-api.com/v6/{self.settings.exchange_rate_api_key}/pair/"
                    f"{base_currency.upper()}/{quote_currency.upper()}"
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail="Impossible de joindre ExchangeRate API pour le moment.",
            ) from exc

        if response.is_error:
            raise HTTPException(
                status_code=502,
                detail="Le provider ExchangeRate API a retourne une erreur.",
            )

        data = response.json()
        if data.get("result") != "success":
            raise HTTPException(
                status_code=502,
                detail="ExchangeRate API a retourne une reponse invalide.",
            )

        try:
            price = float(data["conversion_rate"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="ExchangeRate API a retourne un taux invalide.",
            ) from exc

        return MarketDataResponse(
            provider="exchange-rate-api",
            asset_type="forex",
            symbol=f"{base_currency.upper()}/{quote_currency.upper()}",
            price=price,
            currency=quote_currency.upper(),
            change_percent=None,
            last_updated=datetime.now(timezone.utc).isoformat(),
            notes="Taux spot recupere a la demande.",
        )


def get_finance_service() -> FinanceService:
    return FinanceService(get_settings())
