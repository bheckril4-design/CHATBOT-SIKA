from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable

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
        symbol = symbol.upper()
        asset_type = asset_type.lower()
        base_currency = base_currency.upper()
        quote_currency = quote_currency.upper()

        if self.settings.demo_mode or self.settings.market_data_provider == "demo":
            return self._demo(symbol, asset_type, quote_currency)

        if asset_type == "forex":
            return await self._get_forex_market_data(
                base_currency=base_currency,
                quote_currency=quote_currency,
            )

        return await self._get_quote_market_data(
            symbol=symbol,
            asset_type=asset_type,
            base_currency=base_currency,
            quote_currency=quote_currency,
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

    async def _get_forex_market_data(
        self,
        base_currency: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        provider = (self.settings.market_data_provider or "auto").lower()
        symbol = f"{base_currency}/{quote_currency}"

        strategies: list[tuple[str, Callable[[], Awaitable[MarketDataResponse]]]] = []

        if provider == "alpha-vantage":
            if self.settings.alpha_vantage_api_key:
                strategies.append(
                    (
                        "alpha-vantage",
                        lambda: self._alpha_vantage(
                            symbol=symbol,
                            asset_type="forex",
                            base_currency=base_currency,
                            quote_currency=quote_currency,
                        ),
                    )
                )
            if self.settings.exchange_rate_api_key:
                strategies.append(
                    (
                        "exchange-rate-api",
                        lambda: self._exchange_rate(base_currency, quote_currency),
                    )
                )
        else:
            if self.settings.exchange_rate_api_key:
                strategies.append(
                    (
                        "exchange-rate-api",
                        lambda: self._exchange_rate(base_currency, quote_currency),
                    )
                )
            if self.settings.twelve_data_api_key:
                strategies.append(
                    (
                        "twelve-data",
                        lambda: self._twelve_data(symbol, "forex"),
                    )
                )
            if self.settings.alpha_vantage_api_key:
                strategies.append(
                    (
                        "alpha-vantage",
                        lambda: self._alpha_vantage(
                            symbol=symbol,
                            asset_type="forex",
                            base_currency=base_currency,
                            quote_currency=quote_currency,
                        ),
                    )
                )

        return await self._execute_provider_chain(strategies)

    async def _get_quote_market_data(
        self,
        symbol: str,
        asset_type: str,
        base_currency: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        provider = (self.settings.market_data_provider or "auto").lower()
        strategies: list[tuple[str, Callable[[], Awaitable[MarketDataResponse]]]] = []

        if provider == "alpha-vantage":
            if self.settings.alpha_vantage_api_key:
                strategies.append(
                    (
                        "alpha-vantage",
                        lambda: self._alpha_vantage(
                            symbol=symbol,
                            asset_type=asset_type,
                            base_currency=base_currency,
                            quote_currency=quote_currency,
                        ),
                    )
                )
            if self.settings.twelve_data_api_key:
                strategies.append(
                    (
                        "twelve-data",
                        lambda: self._twelve_data(symbol, asset_type),
                    )
                )
        else:
            if self.settings.twelve_data_api_key:
                strategies.append(
                    (
                        "twelve-data",
                        lambda: self._twelve_data(symbol, asset_type),
                    )
                )
            if self.settings.alpha_vantage_api_key:
                strategies.append(
                    (
                        "alpha-vantage",
                        lambda: self._alpha_vantage(
                            symbol=symbol,
                            asset_type=asset_type,
                            base_currency=base_currency,
                            quote_currency=quote_currency,
                        ),
                    )
                )

        return await self._execute_provider_chain(strategies)

    async def _execute_provider_chain(
        self,
        strategies: list[tuple[str, Callable[[], Awaitable[MarketDataResponse]]]],
    ) -> MarketDataResponse:
        seen_providers: set[str] = set()
        filtered_strategies: list[Callable[[], Awaitable[MarketDataResponse]]] = []

        for provider_name, strategy in strategies:
            if provider_name in seen_providers:
                continue
            seen_providers.add(provider_name)
            filtered_strategies.append(strategy)

        last_error: HTTPException | None = None
        for strategy in filtered_strategies:
            try:
                return await strategy()
            except HTTPException as exc:
                last_error = exc
                continue

        if last_error is not None:
            raise last_error

        raise HTTPException(
            status_code=503,
            detail="Aucun provider financier n'est configure.",
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

    async def _alpha_vantage(
        self,
        symbol: str,
        asset_type: str,
        base_currency: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        if asset_type == "stock":
            return await self._alpha_vantage_global_quote(symbol, quote_currency)

        return await self._alpha_vantage_exchange_rate(
            base_currency=base_currency,
            quote_currency=quote_currency,
            asset_type=asset_type,
        )

    async def _alpha_vantage_global_quote(
        self,
        symbol: str,
        quote_currency: str,
    ) -> MarketDataResponse:
        data = await self._alpha_vantage_query(
            function="GLOBAL_QUOTE",
            symbol=symbol.upper(),
        )
        quote = data.get("Global Quote")

        if not isinstance(quote, dict) or not quote:
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage a retourne une charge utile invalide.",
            )

        try:
            price = float(quote["05. price"])
            raw_change_percent = str(quote.get("10. change percent", "0")).replace("%", "")
            change_percent = float(raw_change_percent)
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage a retourne une cotation invalide.",
            ) from exc

        return MarketDataResponse(
            provider="alpha-vantage",
            asset_type="stock",
            symbol=symbol.upper(),
            price=price,
            currency=quote_currency.upper(),
            change_percent=change_percent,
            last_updated=datetime.now(timezone.utc).isoformat(),
            notes="Alpha Vantage GLOBAL_QUOTE",
        )

    async def _alpha_vantage_exchange_rate(
        self,
        base_currency: str,
        quote_currency: str,
        asset_type: str,
    ) -> MarketDataResponse:
        data = await self._alpha_vantage_query(
            function="CURRENCY_EXCHANGE_RATE",
            from_currency=base_currency.upper(),
            to_currency=quote_currency.upper(),
        )
        exchange_rate = data.get("Realtime Currency Exchange Rate")

        if not isinstance(exchange_rate, dict) or not exchange_rate:
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage a retourne une charge utile invalide.",
            )

        try:
            price = float(exchange_rate["5. Exchange Rate"])
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage a retourne un taux invalide.",
            ) from exc

        return MarketDataResponse(
            provider="alpha-vantage",
            asset_type=asset_type,
            symbol=f"{base_currency.upper()}/{quote_currency.upper()}",
            price=price,
            currency=quote_currency.upper(),
            change_percent=None,
            last_updated=exchange_rate.get("6. Last Refreshed", datetime.now(timezone.utc).isoformat()),
            notes="Alpha Vantage CURRENCY_EXCHANGE_RATE",
        )

    async def _alpha_vantage_query(self, **params: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://www.alphavantage.co/query",
                    params={**params, "apikey": self.settings.alpha_vantage_api_key},
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail="Impossible de joindre Alpha Vantage pour le moment.",
            ) from exc

        if response.is_error:
            raise HTTPException(
                status_code=502,
                detail="Le provider Alpha Vantage a retourne une erreur.",
            )

        data = response.json()
        if not isinstance(data, dict):
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage a retourne une reponse invalide.",
            )

        for key in ("Error Message", "Information", "Note"):
            if data.get(key):
                raise HTTPException(
                    status_code=502,
                    detail=f"Alpha Vantage a refuse la requete: {data[key]}",
                )

        return data

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
