import unicodedata

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas import CalculationRequest
from app.services.calculation_service import run_calculation


def normalize_text(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value.lower())
        if not unicodedata.combining(char)
    )


def test_loan_payment_matches_reference_amount() -> None:
    result = run_calculation(
        CalculationRequest(
            type="loan-payment",
            principal=1_000_000,
            annual_rate=12,
            duration_months=12,
            to_currency="XOF",
        )
    )

    assert result.currency == "XOF"
    assert result.result == 88848.79
    assert result.breakdown["base_monthly_payment"] == 88848.79
    assert result.breakdown["insurance_monthly"] == 0.0
    assert result.breakdown["total_monthly_payment"] == 88848.79
    assert result.breakdown["monthly_payment"] == 88848.79
    assert result.breakdown["interest_paid"] == 66185.46
    assert result.breakdown["duration_months"] == 12
    assert len(result.schedule) == 12
    assert result.schedule[0] == {
        "month": 1,
        "loan_payment": 88848.79,
        "insurance_payment": 0.0,
        "payment": 88848.79,
        "principal_paid": 78848.79,
        "interest_paid": 10000.0,
        "remaining_balance": 921151.21,
    }
    assert result.schedule[-1] == {
        "month": 12,
        "loan_payment": 88848.79,
        "insurance_payment": 0.0,
        "payment": 88848.79,
        "principal_paid": 87969.1,
        "interest_paid": 879.69,
        "remaining_balance": 0.0,
    }
    assert any(
        "assurance emprunteur est estimee ici de facon lineaire sur le capital initial"
        in normalize_text(note)
        for note in result.notes
    )


def test_loan_payment_includes_insurance_when_provided() -> None:
    result = run_calculation(
        CalculationRequest(
            type="loan-payment",
            principal=25_000_000,
            annual_rate=8,
            insurance_rate=0.35,
            duration_months=240,
            to_currency="XOF",
        )
    )

    assert result.result == 216401.68
    assert result.breakdown["base_monthly_payment"] == 209110.02
    assert result.breakdown["insurance_monthly"] == 7291.67
    assert result.breakdown["total_monthly_payment"] == 216401.68
    assert result.breakdown["insurance_total"] == 1750000.0
    assert result.schedule[0]["insurance_payment"] == 7291.67
    assert result.schedule[-1]["payment"] == 216401.68


def test_currency_conversion_uses_given_rate() -> None:
    result = run_calculation(
        CalculationRequest(
            type="currency-conversion",
            amount=100,
            exchange_rate=0.001524,
            from_currency="XOF",
            to_currency="EUR",
        )
    )

    assert result.currency == "EUR"
    assert result.result == 0.15


def test_zero_interest_loan_returns_straight_line_payment() -> None:
    result = run_calculation(
        CalculationRequest(
            type="loan-payment",
            principal=1_200_000,
            annual_rate=0,
            duration_months=12,
        )
    )

    assert result.result == 100000.0
    assert result.breakdown["interest_paid"] == 0.0


def test_compound_savings_allows_zero_starting_capital() -> None:
    result = run_calculation(
        CalculationRequest(
            type="compound-savings",
            principal=0,
            annual_rate=5,
            duration_months=48,
            contribution=10_000,
            periods_per_year=12,
        )
    )

    assert result.result == 530148.85
    assert result.breakdown["principal"] == 0.0
    assert result.breakdown["contribution"] == 10000.0


def test_compound_savings_matches_reference_amount() -> None:
    result = run_calculation(
        CalculationRequest(
            type="compound-savings",
            principal=1_000_000,
            annual_rate=7,
            duration_months=120,
            contribution=50_000,
            periods_per_year=12,
        )
    )

    assert result.result == 10663901.75
    assert result.breakdown["nominal_future_value"] == 10663901.75
    assert result.breakdown["gain_before_tax"] == 3663901.75
    normalized_notes = [normalize_text(note) for note in result.notes]
    assert normalized_notes == [
        "capitalisation periodique avec versements supposes en fin de periode.",
        "le rendement saisi est une hypothese et non une garantie de performance.",
        "la fiscalite appliquee ici est un taux effectif sur les gains seulement.",
        "la valeur reelle correspond a une actualisation par l'inflation annuelle saisie.",
        "frais de gestion reels, frottements et fiscalite produit-specifique exclus.",
    ]


def test_compound_savings_applies_tax_and_inflation() -> None:
    result = run_calculation(
        CalculationRequest(
            type="compound-savings",
            principal=1_000_000,
            annual_rate=7,
            tax_rate=12,
            inflation_rate=3,
            duration_months=120,
            contribution=50_000,
            periods_per_year=12,
        )
    )

    assert result.result == 10224233.54
    assert result.breakdown["taxes_due"] == 439668.21
    assert result.breakdown["real_future_value"] == 7607789.96


def test_loan_payment_rejects_zero_principal() -> None:
    with pytest.raises(ValidationError) as exc_info:
        CalculationRequest(
            type="loan-payment",
            principal=0,
            annual_rate=5,
            duration_months=12,
        )

    assert "strictement positif" in str(exc_info.value)


def test_compound_savings_rejects_incompatible_periodicity() -> None:
    with pytest.raises(HTTPException) as exc_info:
        run_calculation(
            CalculationRequest(
                type="compound-savings",
                principal=100000,
                annual_rate=5,
                duration_months=10,
                contribution=5000,
                periods_per_year=4,
            )
        )

    assert exc_info.value.status_code == 422
