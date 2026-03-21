from fastapi import APIRouter

from app.schemas import CalculationRequest, CalculationResponse
from app.services.calculation_service import run_calculation

router = APIRouter(tags=["calculate"])


@router.post("/calculate", response_model=CalculationResponse)
async def calculate(payload: CalculationRequest) -> CalculationResponse:
    return run_calculation(payload)

