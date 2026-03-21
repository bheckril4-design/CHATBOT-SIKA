from fastapi import APIRouter, Depends, Query

from app.schemas import MarketDataResponse
from app.services.finance_service import FinanceService, get_finance_service

router = APIRouter(tags=["finance"])


@router.get("/market-data", response_model=MarketDataResponse)
async def get_market_data(
    symbol: str = Query(default="XOF/EUR", min_length=3, max_length=20),
    asset_type: str = Query(default="forex", pattern="^(forex|stock|crypto)$"),
    base_currency: str = Query(default="XOF", min_length=3, max_length=3),
    quote_currency: str = Query(default="EUR", min_length=3, max_length=3),
    service: FinanceService = Depends(get_finance_service),
) -> MarketDataResponse:
    return await service.get_market_data(
        symbol=symbol,
        asset_type=asset_type,
        base_currency=base_currency,
        quote_currency=quote_currency,
    )

