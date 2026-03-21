function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundRate(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function calculateLocally(payload) {
  switch (payload.type) {
    case 'loan-payment':
      return calculateLoanPayment(payload);
    case 'simple-interest':
      return calculateSimpleInterest(payload);
    case 'compound-savings':
      return calculateCompoundSavings(payload);
    case 'currency-conversion':
      return calculateCurrencyConversion(payload);
    default:
      throw new Error('Type de calcul non pris en charge en mode local.');
  }
}

function calculateLoanPayment(payload) {
  const principal = Number(payload.principal);
  const annualRate = Number(payload.annual_rate);
  const insuranceRate = Number(payload.insurance_rate || 0);
  const months = Number(payload.duration_months);
  const monthlyRate = annualRate / 100 / 12;
  const insuranceMonthly = principal * (insuranceRate / 100) / 12;

  let payment;
  if (monthlyRate === 0) {
    payment = principal / months;
  } else {
    const denominator = 1 - (1 + monthlyRate) ** -months;
    if (denominator === 0) {
      throw new Error('Param\u00e8tres de cr\u00e9dit invalides.');
    }
    payment = principal * (monthlyRate / denominator);
  }

  const loanTotalPayment = payment * months;
  const insuranceTotal = insuranceMonthly * months;
  const totalPayment = loanTotalPayment + insuranceTotal;
  const interestPaid = loanTotalPayment - principal;
  const schedule = buildLoanSchedule({
    principal,
    months,
    monthlyRate,
    standardPayment: payment,
    insuranceMonthly,
  });

  return {
    type: payload.type,
    result: roundMoney(payment + insuranceMonthly),
    currency: (payload.to_currency || 'XOF').toUpperCase(),
    summary: 'Mensualité totale estimée pour un crédit amortissable classique, assurance incluse si renseignée.',
    breakdown: {
      base_monthly_payment: roundMoney(payment),
      insurance_monthly: roundMoney(insuranceMonthly),
      monthly_payment: roundMoney(payment),
      total_monthly_payment: roundMoney(payment + insuranceMonthly),
      total_payment: roundMoney(totalPayment),
      interest_paid: roundMoney(interestPaid),
      insurance_total: roundMoney(insuranceTotal),
      insurance_rate: roundRate(insuranceRate),
      duration_months: months,
    },
    notes: [
      "Mensualités calculées sur la base d'échéances mensuelles constantes.",
      'Le taux nominal annuel est converti en taux mensuel pour la simulation.',
      "L'assurance emprunteur est estimée ici de façon linéaire sur le capital initial.",
      'Frais de dossier, frais de garantie et pénalités non inclus.',
      'Les montants du tableau sont arrondis à 0,01 par ligne.',
    ],
    schedule,
  };
}

function calculateSimpleInterest(payload) {
  const principal = Number(payload.principal);
  const annualRate = Number(payload.annual_rate);
  const taxRate = Number(payload.tax_rate || 0);
  const inflationRate = Number(payload.inflation_rate || 0);
  const years = Number(payload.duration_months) / 12;
  const interest = principal * (annualRate / 100) * years;
  const taxesDue = interest * (taxRate / 100);
  const netInterest = interest - taxesDue;
  const finalAmount = principal + netInterest;
  const inflationFactor = (1 + inflationRate / 100) ** years;
  const realFutureValue = inflationFactor === 0 ? finalAmount : finalAmount / inflationFactor;

  return {
    type: payload.type,
    result: roundMoney(finalAmount),
    currency: (payload.to_currency || 'XOF').toUpperCase(),
    summary: "Montant final net après fiscalité, avec estimation du pouvoir d'achat réel.",
    breakdown: {
      principal: roundMoney(principal),
      interest: roundMoney(interest),
      taxes_due: roundMoney(taxesDue),
      tax_rate: roundRate(taxRate),
      inflation_rate: roundRate(inflationRate),
      real_future_value: roundMoney(realFutureValue),
      years: roundMoney(years),
    },
    notes: [
      'Le calcul repose sur un intérêt simple, sans capitalisation intermédiaire.',
      'La fiscalité appliquée ici est un taux effectif sur les gains seulement.',
      "La valeur réelle correspond à une actualisation par l'inflation annuelle saisie.",
      'Frais et fiscalité spécifique à un produit réel exclus.',
    ],
  };
}

function calculateCompoundSavings(payload) {
  const principal = Number(payload.principal);
  const annualRate = Number(payload.annual_rate);
  const taxRate = Number(payload.tax_rate || 0);
  const inflationRate = Number(payload.inflation_rate || 0);
  const contribution = Number(payload.contribution || 0);
  const periodsPerYear = Number(payload.periods_per_year || 12);
  const totalPeriods = (Number(payload.duration_months) * periodsPerYear) / 12;
  const periodicRate = annualRate / 100 / periodsPerYear;

  let futureValue;
  if (periodicRate === 0) {
    futureValue = principal + contribution * totalPeriods;
  } else {
    const growthFactor = (1 + periodicRate) ** totalPeriods;
    futureValue = principal * growthFactor;
    futureValue += contribution * ((growthFactor - 1) / periodicRate);
  }

  const totalContributions = principal + contribution * totalPeriods;
  const gainBeforeTax = Math.max(0, futureValue - totalContributions);
  const taxesDue = gainBeforeTax * (taxRate / 100);
  const netFutureValue = futureValue - taxesDue;
  const years = Number(payload.duration_months) / 12;
  const inflationFactor = (1 + inflationRate / 100) ** years;
  const realFutureValue = inflationFactor === 0 ? netFutureValue : netFutureValue / inflationFactor;

  return {
    type: payload.type,
    result: roundMoney(netFutureValue),
    currency: (payload.to_currency || 'XOF').toUpperCase(),
    summary: "Projection nette après fiscalité, avec estimation du pouvoir d'achat réel.",
    breakdown: {
      principal: roundMoney(principal),
      contribution: roundMoney(contribution),
      total_contributions: roundMoney(totalContributions),
      annual_rate: roundMoney(annualRate),
      tax_rate: roundRate(taxRate),
      inflation_rate: roundRate(inflationRate),
      duration_months: Number(payload.duration_months),
      nominal_future_value: roundMoney(futureValue),
      gain_before_tax: roundMoney(gainBeforeTax),
      taxes_due: roundMoney(taxesDue),
      real_future_value: roundMoney(realFutureValue),
    },
    notes: [
      'Capitalisation périodique avec versements supposés en fin de période.',
      'Le rendement saisi est une hypothèse et non une garantie de performance.',
      'La fiscalité appliquée ici est un taux effectif sur les gains seulement.',
      "La valeur réelle correspond à une actualisation par l'inflation annuelle saisie.",
      'Frais de gestion réels, frottements et fiscalité produit-spécifique exclus.',
    ],
  };
}

function calculateCurrencyConversion(payload) {
  const amount = Number(payload.amount);
  const exchangeRate = Number(payload.exchange_rate);
  const converted = amount * exchangeRate;

  return {
    type: payload.type,
    result: roundMoney(converted),
    currency: (payload.to_currency || 'EUR').toUpperCase(),
    summary: 'Conversion mon\u00e9taire bas\u00e9e sur le taux fourni.',
    breakdown: {
      amount: roundMoney(amount),
      exchange_rate: roundRate(exchangeRate),
      from_currency: (payload.from_currency || 'XOF').toUpperCase(),
      to_currency: (payload.to_currency || 'EUR').toUpperCase(),
    },
    notes: [
      "Conversion basée sur le taux fourni à l'entrée.",
      'Spread de change, commissions et frais bancaires non inclus.',
    ],
  };
}

function buildLoanSchedule({ principal, months, monthlyRate, standardPayment, insuranceMonthly }) {
  const schedule = [];
  let remainingBalance = principal;

  for (let month = 1; month <= months; month += 1) {
    let interestComponent;
    let principalComponent;
    let paymentAmount;

    if (monthlyRate === 0) {
      interestComponent = 0;
      principalComponent = month === months ? remainingBalance : standardPayment;
      paymentAmount = principalComponent;
    } else {
      interestComponent = remainingBalance * monthlyRate;
      if (month === months) {
        principalComponent = remainingBalance;
        paymentAmount = principalComponent + interestComponent;
      } else {
        principalComponent = standardPayment - interestComponent;
        paymentAmount = standardPayment;
      }
    }

    remainingBalance -= principalComponent;
    if (remainingBalance < 0) {
      remainingBalance = 0;
    }

    schedule.push({
      month,
      loan_payment: roundMoney(paymentAmount),
      insurance_payment: roundMoney(insuranceMonthly),
      payment: roundMoney(paymentAmount + insuranceMonthly),
      principal_paid: roundMoney(principalComponent),
      interest_paid: roundMoney(interestComponent),
      remaining_balance: roundMoney(remainingBalance),
    });
  }

  return schedule;
}
