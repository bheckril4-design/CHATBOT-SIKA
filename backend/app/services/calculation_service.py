from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException

from app.schemas import CalculationRequest, CalculationResponse

MONEY_QUANTUM = Decimal("0.01")
RATE_QUANTUM = Decimal("0.000001")


def run_calculation(payload: CalculationRequest) -> CalculationResponse:
    if payload.type == "loan-payment":
        return _loan_payment(payload)
    if payload.type == "simple-interest":
        return _simple_interest(payload)
    if payload.type == "compound-savings":
        return _compound_savings(payload)
    if payload.type == "currency-conversion":
        return _currency_conversion(payload)

    raise HTTPException(status_code=400, detail="Type de calcul non support\u00e9.")


def _loan_payment(payload: CalculationRequest) -> CalculationResponse:
    if payload.principal is None or payload.annual_rate is None or payload.duration_months is None:
        raise HTTPException(
            status_code=422,
            detail="principal, annual_rate et duration_months sont requis.",
        )

    principal = _decimal(payload.principal)
    annual_rate = _decimal(payload.annual_rate)
    months = payload.duration_months

    if principal <= 0:
        raise HTTPException(
            status_code=422,
            detail="principal doit etre strictement positif pour ce calcul.",
        )

    monthly_rate = annual_rate / Decimal("100") / Decimal("12")
    insurance_rate = _decimal(payload.insurance_rate or 0)
    insurance_monthly = principal * (insurance_rate / Decimal("100")) / Decimal("12")

    if monthly_rate == 0:
        payment = principal / Decimal(months)
    else:
        denominator = Decimal("1") - (Decimal("1") + monthly_rate) ** (-months)
        if denominator == 0:
            raise HTTPException(status_code=422, detail="Param\u00e8tres de cr\u00e9dit invalides.")

        payment = principal * (monthly_rate / denominator)

    loan_total_payment = payment * Decimal(months)
    insurance_total = insurance_monthly * Decimal(months)
    total_payment = loan_total_payment + insurance_total
    interest_paid = loan_total_payment - principal
    schedule = _build_loan_schedule(
        principal=principal,
        months=months,
        monthly_rate=monthly_rate,
        standard_payment=payment,
        insurance_monthly=insurance_monthly,
    )

    return CalculationResponse(
        type=payload.type,
        result=_money(payment + insurance_monthly),
        currency=payload.to_currency or "XOF",
        summary="Mensualité totale estimée pour un crédit amortissable classique, assurance incluse si renseignée.",
        breakdown={
            "base_monthly_payment": _money(payment),
            "insurance_monthly": _money(insurance_monthly),
            "monthly_payment": _money(payment),
            "total_monthly_payment": _money(payment + insurance_monthly),
            "total_payment": _money(total_payment),
            "interest_paid": _money(interest_paid),
            "insurance_total": _money(insurance_total),
            "insurance_rate": _rate(insurance_rate),
            "duration_months": months,
        },
        notes=[
            "Mensualités calculées sur la base d'échéances mensuelles constantes.",
            "Le taux nominal annuel est converti en taux mensuel pour la simulation.",
            "L'assurance emprunteur est estimée ici de façon linéaire sur le capital initial.",
            "Frais de dossier, frais de garantie et pénalités non inclus.",
            "Les montants du tableau sont arrondis à 0,01 par ligne.",
        ],
        schedule=schedule,
    )


def _simple_interest(payload: CalculationRequest) -> CalculationResponse:
    if payload.principal is None or payload.annual_rate is None or payload.duration_months is None:
        raise HTTPException(
            status_code=422,
            detail="principal, annual_rate et duration_months sont requis.",
        )

    principal = _decimal(payload.principal)
    annual_rate = _decimal(payload.annual_rate)
    tax_rate = _decimal(payload.tax_rate or 0)
    inflation_rate = _decimal(payload.inflation_rate or 0)
    years = _decimal(payload.duration_months) / Decimal("12")

    if principal <= 0:
        raise HTTPException(
            status_code=422,
            detail="principal doit etre strictement positif pour ce calcul.",
        )

    interest = principal * (annual_rate / Decimal("100")) * years
    taxes_due = interest * (tax_rate / Decimal("100"))
    net_interest = interest - taxes_due
    final_amount = principal + net_interest
    inflation_factor = (Decimal("1") + (inflation_rate / Decimal("100"))) ** years
    real_final_amount = final_amount / inflation_factor if inflation_factor != 0 else final_amount

    return CalculationResponse(
        type=payload.type,
        result=_money(final_amount),
        currency=payload.to_currency or "XOF",
        summary="Montant final net après fiscalité, avec estimation du pouvoir d'achat réel.",
        breakdown={
            "principal": _money(principal),
            "interest": _money(interest),
            "taxes_due": _money(taxes_due),
            "tax_rate": _rate(tax_rate),
            "inflation_rate": _rate(inflation_rate),
            "real_future_value": _money(real_final_amount),
            "years": float(years.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)),
        },
        notes=[
            "Le calcul repose sur un intérêt simple, sans capitalisation intermédiaire.",
            "La fiscalité appliquée ici est un taux effectif sur les gains seulement.",
            "La valeur réelle correspond à une actualisation par l'inflation annuelle saisie.",
            "Frais et fiscalité spécifique à un produit réel exclus.",
        ],
    )


def _compound_savings(payload: CalculationRequest) -> CalculationResponse:
    if payload.principal is None or payload.annual_rate is None or payload.duration_months is None:
        raise HTTPException(
            status_code=422,
            detail="principal, annual_rate et duration_months sont requis.",
        )

    periods_per_year = payload.periods_per_year
    if (payload.duration_months * periods_per_year) % 12 != 0:
        raise HTTPException(
            status_code=422,
            detail="duration_months doit \u00eatre compatible avec periods_per_year.",
        )

    principal = _decimal(payload.principal)
    annual_rate = _decimal(payload.annual_rate)
    tax_rate = _decimal(payload.tax_rate or 0)
    inflation_rate = _decimal(payload.inflation_rate or 0)
    contribution = _decimal(payload.contribution or 0)
    rate = annual_rate / Decimal("100")
    periodic_rate = rate / Decimal(periods_per_year)
    total_periods = (payload.duration_months * periods_per_year) // 12

    if periodic_rate == 0:
        future_value = principal + (contribution * Decimal(total_periods))
    else:
        growth_factor = (Decimal("1") + periodic_rate) ** total_periods
        future_value = principal * growth_factor
        future_value += contribution * (
            (growth_factor - Decimal("1")) / periodic_rate
        )

    total_contributions = principal + (contribution * Decimal(total_periods))
    gain_before_tax = max(Decimal("0"), future_value - total_contributions)
    taxes_due = gain_before_tax * (tax_rate / Decimal("100"))
    net_future_value = future_value - taxes_due
    years = _decimal(payload.duration_months) / Decimal("12")
    inflation_factor = (Decimal("1") + (inflation_rate / Decimal("100"))) ** years
    real_future_value = (
        net_future_value / inflation_factor if inflation_factor != 0 else net_future_value
    )

    return CalculationResponse(
        type=payload.type,
        result=_money(net_future_value),
        currency=payload.to_currency or "XOF",
        summary="Projection nette après fiscalité, avec estimation du pouvoir d'achat réel.",
        breakdown={
            "principal": _money(principal),
            "contribution": _money(contribution),
            "total_contributions": _money(total_contributions),
            "annual_rate": float(annual_rate.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)),
            "tax_rate": _rate(tax_rate),
            "inflation_rate": _rate(inflation_rate),
            "duration_months": payload.duration_months,
            "nominal_future_value": _money(future_value),
            "gain_before_tax": _money(gain_before_tax),
            "taxes_due": _money(taxes_due),
            "real_future_value": _money(real_future_value),
        },
        notes=[
            "Capitalisation périodique avec versements supposés en fin de période.",
            "Le rendement saisi est une hypothèse et non une garantie de performance.",
            "La fiscalité appliquée ici est un taux effectif sur les gains seulement.",
            "La valeur réelle correspond à une actualisation par l'inflation annuelle saisie.",
            "Frais de gestion réels, frottements et fiscalité produit-spécifique exclus.",
        ],
    )


def _currency_conversion(payload: CalculationRequest) -> CalculationResponse:
    if payload.amount is None or payload.exchange_rate is None:
        raise HTTPException(
            status_code=422,
            detail="amount et exchange_rate sont requis.",
        )

    converted = _decimal(payload.amount) * _decimal(payload.exchange_rate)
    from_currency = (payload.from_currency or "XOF").upper()
    to_currency = (payload.to_currency or "EUR").upper()

    return CalculationResponse(
        type=payload.type,
        result=_money(converted),
        currency=to_currency,
        summary="Conversion mon\u00e9taire bas\u00e9e sur le taux fourni.",
        breakdown={
            "amount": _money(_decimal(payload.amount)),
            "exchange_rate": _rate(_decimal(payload.exchange_rate)),
            "from_currency": from_currency,
            "to_currency": to_currency,
        },
        notes=[
            "Conversion basée sur le taux fourni à l'entrée.",
            "Spread de change, commissions et frais bancaires non inclus.",
        ],
    )


def _decimal(value: float | int) -> Decimal:
    return Decimal(str(value))


def _money(value: Decimal) -> float:
    return float(value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP))


def _rate(value: Decimal) -> float:
    return float(value.quantize(RATE_QUANTUM, rounding=ROUND_HALF_UP))


def _build_loan_schedule(
    *,
    principal: Decimal,
    months: int,
    monthly_rate: Decimal,
    standard_payment: Decimal,
    insurance_monthly: Decimal,
) -> list[dict[str, float | int | str]]:
    schedule: list[dict[str, float | int | str]] = []
    remaining_balance = principal

    for month in range(1, months + 1):
        if monthly_rate == 0:
            interest_component = Decimal("0")
            principal_component = remaining_balance if month == months else standard_payment
            payment_amount = principal_component
        else:
            interest_component = remaining_balance * monthly_rate
            if month == months:
                principal_component = remaining_balance
                payment_amount = principal_component + interest_component
            else:
                principal_component = standard_payment - interest_component
                payment_amount = standard_payment

        remaining_balance -= principal_component
        if remaining_balance < 0:
            remaining_balance = Decimal("0")

        schedule.append(
            {
                "month": month,
                "loan_payment": _money(payment_amount),
                "insurance_payment": _money(insurance_monthly),
                "payment": _money(payment_amount + insurance_monthly),
                "principal_paid": _money(principal_component),
                "interest_paid": _money(interest_component),
                "remaining_balance": _money(remaining_balance),
            }
        )

    return schedule
