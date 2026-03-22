import asyncio

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.schemas import MarketDataResponse
from app.services.finance_service import FinanceService


def test_finance_service_uses_alpha_vantage_for_stock_when_provider_selected(monkeypatch) -> None:
    service = FinanceService(
        Settings(
            demo_mode=False,
            market_data_provider="alpha-vantage",
            alpha_vantage_api_key="av-key",
            twelve_data_api_key="td-key",
        )
    )
    calls = {"alpha": 0, "twelve": 0}

    async def fake_alpha(self, symbol, asset_type, base_currency, quote_currency):
        calls["alpha"] += 1
        return MarketDataResponse(
            provider="alpha-vantage",
            asset_type=asset_type,
            symbol=symbol,
            price=123.45,
            currency=quote_currency,
            change_percent=1.2,
            last_updated="2026-03-22T17:00:00+00:00",
            notes="Alpha test",
        )

    async def fake_twelve(self, symbol, asset_type):
        calls["twelve"] += 1
        raise AssertionError("Twelve Data ne devait pas etre appele en priorite.")

    monkeypatch.setattr(FinanceService, "_alpha_vantage", fake_alpha)
    monkeypatch.setattr(FinanceService, "_twelve_data", fake_twelve)

    result = asyncio.run(
        service.get_market_data(
            symbol="AAPL",
            asset_type="stock",
            base_currency="USD",
            quote_currency="USD",
        )
    )

    assert result.provider == "alpha-vantage"
    assert calls == {"alpha": 1, "twelve": 0}


def test_finance_service_falls_back_to_alpha_vantage_when_twelve_data_fails(monkeypatch) -> None:
    service = FinanceService(
        Settings(
            demo_mode=False,
            market_data_provider="twelve-data",
            alpha_vantage_api_key="av-key",
            twelve_data_api_key="td-key",
        )
    )

    async def fake_twelve(self, symbol, asset_type):
        raise HTTPException(status_code=502, detail="Twelve Data indisponible")

    async def fake_alpha(self, symbol, asset_type, base_currency, quote_currency):
        return MarketDataResponse(
            provider="alpha-vantage",
            asset_type=asset_type,
            symbol=symbol,
            price=456.78,
            currency=quote_currency,
            change_percent=-0.8,
            last_updated="2026-03-22T17:00:00+00:00",
            notes="Fallback Alpha",
        )

    monkeypatch.setattr(FinanceService, "_twelve_data", fake_twelve)
    monkeypatch.setattr(FinanceService, "_alpha_vantage", fake_alpha)

    result = asyncio.run(
        service.get_market_data(
            symbol="BTC/USD",
            asset_type="crypto",
            base_currency="BTC",
            quote_currency="USD",
        )
    )

    assert result.provider == "alpha-vantage"
    assert result.symbol == "BTC/USD"


def test_alpha_vantage_global_quote_is_parsed(monkeypatch) -> None:
    service = FinanceService(
        Settings(
            demo_mode=False,
            alpha_vantage_api_key="av-key",
        )
    )

    async def fake_query(self, **params):
        assert params["function"] == "GLOBAL_QUOTE"
        assert params["symbol"] == "AAPL"
        return {
            "Global Quote": {
                "05. price": "189.98",
                "10. change percent": "1.2345%",
            }
        }

    monkeypatch.setattr(FinanceService, "_alpha_vantage_query", fake_query)

    result = asyncio.run(service._alpha_vantage_global_quote("AAPL", "USD"))

    assert result.provider == "alpha-vantage"
    assert result.asset_type == "stock"
    assert result.symbol == "AAPL"
    assert result.price == pytest.approx(189.98)
    assert result.currency == "USD"
    assert result.change_percent == pytest.approx(1.2345)


def test_alpha_vantage_exchange_rate_is_parsed(monkeypatch) -> None:
    service = FinanceService(
        Settings(
            demo_mode=False,
            alpha_vantage_api_key="av-key",
        )
    )

    async def fake_query(self, **params):
        assert params["function"] == "CURRENCY_EXCHANGE_RATE"
        assert params["from_currency"] == "BTC"
        assert params["to_currency"] == "USD"
        return {
            "Realtime Currency Exchange Rate": {
                "5. Exchange Rate": "68804.87",
                "6. Last Refreshed": "2026-03-22 17:03:39",
            }
        }

    monkeypatch.setattr(FinanceService, "_alpha_vantage_query", fake_query)

    result = asyncio.run(service._alpha_vantage_exchange_rate("BTC", "USD", "crypto"))

    assert result.provider == "alpha-vantage"
    assert result.asset_type == "crypto"
    assert result.symbol == "BTC/USD"
    assert result.price == pytest.approx(68804.87)
    assert result.currency == "USD"
    assert result.change_percent is None
    assert result.last_updated == "2026-03-22 17:03:39"
