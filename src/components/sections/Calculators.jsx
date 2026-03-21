import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Home, Loader2, Target, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { calculateLocally } from '@/lib/calculations';
import { getApiBase } from '@/lib/api';

const API_BASE = getApiBase();
const CALCULATION_REQUEST_TIMEOUT_MS = 8000;
const IS_PRODUCTION = import.meta.env.PROD;
const ALLOW_LOCAL_FALLBACK = !IS_PRODUCTION;
const INPUT_CLASS_NAME =
  'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/35 outline-none transition focus:border-gold-400';
const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});

const calculatorsData = [
  {
    id: 'retirement',
    name: 'Retraite',
    icon: Target,
    accentClassName: 'from-emerald-400 to-green-500',
    title: 'Projection retraite',
    resultLabel: 'Capital net projeté',
    assumption:
      "Hypothèse : capitalisation mensuelle avec versements en fin de mois, fiscalité appliquée sur les gains et valeur réelle ajustée par l'inflation annuelle saisie. Résultats arrondis à 0,01.",
    breakdownOrder: [
      'principal',
      'contribution',
      'total_contributions',
      'annual_rate',
      'tax_rate',
      'inflation_rate',
      'nominal_future_value',
      'taxes_due',
      'real_future_value',
      'duration_months',
    ],
    fields: [
      { name: 'currentAge', label: 'Âge actuel', min: 18, max: 80 },
      { name: 'retirementAge', label: 'Âge de retraite visé', min: 19, max: 80 },
      { name: 'currentSavings', label: 'Capital déjà disponible', min: 0, step: '1000' },
      { name: 'monthlyContribution', label: 'Épargne mensuelle', min: 0, step: '1000' },
      {
        name: 'annualReturn',
        label: 'Rendement annuel estimé (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
      {
        name: 'taxRate',
        label: 'Fiscalité effective sur gains (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
      {
        name: 'inflationRate',
        label: 'Inflation annuelle (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
    ],
    validate(values) {
      const currentAge = toNumber(values.currentAge);
      const retirementAge = toNumber(values.retirementAge);
      const currentSavings = toNumber(values.currentSavings);
      const monthlyContribution = toNumber(values.monthlyContribution);
      const annualReturn = toNumber(values.annualReturn);
      const taxRate = toNumber(values.taxRate);
      const inflationRate = toNumber(values.inflationRate);

      if (Number.isNaN(currentAge) || Number.isNaN(retirementAge)) {
        return 'Renseignez des âges valides pour la projection retraite.';
      }
      if (retirementAge <= currentAge) {
        return "L'âge de retraite doit être strictement supérieur à l'âge actuel.";
      }
      if (retirementAge - currentAge > 50) {
        return 'La projection retraite est limitée à 50 ans pour garder une estimation réaliste.';
      }
      if (
        currentSavings < 0 ||
        monthlyContribution < 0 ||
        annualReturn < 0 ||
        taxRate < 0 ||
        inflationRate < 0
      ) {
        return 'Les montants et les taux doivent être positifs.';
      }
      return null;
    },
    buildRequest(values) {
      const currentAge = toNumber(values.currentAge);
      const retirementAge = toNumber(values.retirementAge);
      return {
        type: 'compound-savings',
        principal: toNumber(values.currentSavings),
        annual_rate: toNumber(values.annualReturn),
        tax_rate: toNumber(values.taxRate),
        inflation_rate: toNumber(values.inflationRate),
        duration_months: (retirementAge - currentAge) * 12,
        contribution: toNumber(values.monthlyContribution),
        periods_per_year: 12,
      };
    },
  },
  {
    id: 'mortgage',
    name: 'Prêt Immobilier',
    icon: Home,
    accentClassName: 'from-blue-400 to-cyan-500',
    title: 'Mensualité de crédit',
    resultLabel: 'Mensualité totale estimée',
    assumption:
      "Hypothèse : crédit amortissable classique à mensualités constantes, avec assurance emprunteur linéaire sur capital initial si renseignée. Frais de dossier et pénalités exclus.",
    breakdownOrder: [
      'base_monthly_payment',
      'insurance_monthly',
      'total_monthly_payment',
      'interest_paid',
      'insurance_total',
      'total_payment',
      'duration_months',
    ],
    fields: [
      { name: 'loanAmount', label: 'Montant emprunté', min: 1, step: '1000' },
      {
        name: 'interestRate',
        label: 'Taux annuel nominal (%)',
        min: 0,
        max: 100,
        step: '0.01',
      },
      {
        name: 'insuranceRate',
        label: 'Assurance emprunteur (%)',
        min: 0,
        max: 100,
        step: '0.01',
      },
      { name: 'loanTermYears', label: 'Durée du prêt (années)', min: 1, max: 50 },
    ],
    validate(values) {
      const loanAmount = toNumber(values.loanAmount);
      const interestRate = toNumber(values.interestRate);
      const insuranceRate = toNumber(values.insuranceRate);
      const loanTermYears = toNumber(values.loanTermYears);

      if (loanAmount <= 0 || Number.isNaN(loanAmount)) {
        return 'Le montant du prêt doit être strictement positif.';
      }
      if (Number.isNaN(interestRate) || interestRate < 0) {
        return "Le taux d'intérêt doit être positif ou nul.";
      }
      if (Number.isNaN(insuranceRate) || insuranceRate < 0) {
        return "Le taux d'assurance doit être positif ou nul.";
      }
      if (loanTermYears <= 0 || Number.isNaN(loanTermYears)) {
        return 'La durée du prêt doit être strictement positive.';
      }
      return null;
    },
    buildRequest(values) {
      return {
        type: 'loan-payment',
        principal: toNumber(values.loanAmount),
        annual_rate: toNumber(values.interestRate),
        insurance_rate: toNumber(values.insuranceRate),
        duration_months: toNumber(values.loanTermYears) * 12,
      };
    },
  },
  {
    id: 'investment',
    name: 'Investissement',
    icon: TrendingUp,
    accentClassName: 'from-amber-400 to-orange-500',
    title: "Projection d'investissement",
    resultLabel: 'Valeur future nette estimée',
    assumption:
      "Hypothèse : versements mensuels en fin de période, fiscalité appliquée sur les gains et valeur réelle ajustée par l'inflation annuelle saisie. Sans garantie de rendement.",
    breakdownOrder: [
      'principal',
      'contribution',
      'total_contributions',
      'annual_rate',
      'tax_rate',
      'inflation_rate',
      'nominal_future_value',
      'gain_before_tax',
      'taxes_due',
      'real_future_value',
      'duration_months',
    ],
    fields: [
      { name: 'initialAmount', label: 'Montant initial', min: 0, step: '1000' },
      { name: 'monthlyContribution', label: 'Versement mensuel', min: 0, step: '1000' },
      {
        name: 'expectedReturn',
        label: 'Rendement annuel estimé (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
      {
        name: 'taxRate',
        label: 'Fiscalité effective sur gains (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
      {
        name: 'inflationRate',
        label: 'Inflation annuelle (%)',
        min: 0,
        max: 100,
        step: '0.1',
      },
      { name: 'years', label: 'Horizon (années)', min: 1, max: 50 },
    ],
    validate(values) {
      const initialAmount = toNumber(values.initialAmount);
      const monthlyContribution = toNumber(values.monthlyContribution);
      const expectedReturn = toNumber(values.expectedReturn);
      const taxRate = toNumber(values.taxRate);
      const inflationRate = toNumber(values.inflationRate);
      const years = toNumber(values.years);

      if (Number.isNaN(initialAmount) || initialAmount < 0) {
        return 'Le montant initial doit être positif ou nul.';
      }
      if (Number.isNaN(monthlyContribution) || monthlyContribution < 0) {
        return 'Le versement mensuel doit être positif ou nul.';
      }
      if (Number.isNaN(expectedReturn) || expectedReturn < 0) {
        return 'Le rendement annuel estimé doit être positif ou nul.';
      }
      if (Number.isNaN(taxRate) || taxRate < 0) {
        return 'La fiscalité effective doit être positive ou nulle.';
      }
      if (Number.isNaN(inflationRate) || inflationRate < 0) {
        return "L'inflation annuelle doit être positive ou nulle.";
      }
      if (Number.isNaN(years) || years <= 0) {
        return "L'horizon d'investissement doit être strictement positif.";
      }
      return null;
    },
    buildRequest(values) {
      return {
        type: 'compound-savings',
        principal: toNumber(values.initialAmount),
        annual_rate: toNumber(values.expectedReturn),
        tax_rate: toNumber(values.taxRate),
        inflation_rate: toNumber(values.inflationRate),
        duration_months: toNumber(values.years) * 12,
        contribution: toNumber(values.monthlyContribution),
        periods_per_year: 12,
      };
    },
  },
];

const initialValues = {
  retirement: {
    currentAge: '30',
    retirementAge: '60',
    currentSavings: '500000',
    monthlyContribution: '25000',
    annualReturn: '6',
    taxRate: '12',
    inflationRate: '3',
  },
  mortgage: {
    loanAmount: '25000000',
    interestRate: '8',
    insuranceRate: '0.35',
    loanTermYears: '20',
  },
  investment: {
    initialAmount: '1000000',
    monthlyContribution: '50000',
    expectedReturn: '7',
    taxRate: '12',
    inflationRate: '3',
    years: '10',
  },
};

const emptyResult = {
  status: 'idle',
  result: null,
  summary: '',
  breakdown: {},
  notes: [],
  schedule: [],
  error: '',
  source: null,
};

const breakdownLabels = {
  principal: 'Capital initial',
  contribution: 'Versement periodique',
  total_contributions: 'Total versé',
  annual_rate: 'Taux annuel',
  tax_rate: 'Fiscalité sur gains',
  inflation_rate: 'Inflation annuelle',
  duration_months: 'Durée',
  base_monthly_payment: 'Mensualité hors assurance',
  insurance_monthly: 'Assurance mensuelle',
  monthly_payment: 'Mensualité crédit',
  total_monthly_payment: 'Mensualité totale',
  interest_paid: 'Intérêts estimés',
  insurance_total: 'Total assurance',
  total_payment: 'Coût total',
  nominal_future_value: 'Valeur nominale finale',
  gain_before_tax: 'Gains avant fiscalité',
  taxes_due: 'Fiscalité estimée',
  real_future_value: 'Valeur réelle estimée',
};

const moneyKeys = new Set([
  'principal',
  'contribution',
  'total_contributions',
  'base_monthly_payment',
  'insurance_monthly',
  'monthly_payment',
  'total_monthly_payment',
  'interest_paid',
  'insurance_total',
  'total_payment',
  'nominal_future_value',
  'gain_before_tax',
  'taxes_due',
  'real_future_value',
]);

const percentageKeys = new Set(['annual_rate', 'tax_rate', 'inflation_rate', 'insurance_rate']);

const Calculators = () => {
  const [activeCalculator, setActiveCalculator] = useState('retirement');
  const [calculatorValues, setCalculatorValues] = useState(initialValues);
  const [results, setResults] = useState({
    retirement: emptyResult,
    mortgage: emptyResult,
    investment: emptyResult,
  });
  const requestSequenceRef = useRef(0);

  const activeConfig = useMemo(
    () => calculatorsData.find((calculator) => calculator.id === activeCalculator),
    [activeCalculator]
  );
  const activeValues = calculatorValues[activeCalculator];
  const activeResult = results[activeCalculator];
  const scheduleHasInsurance =
    Array.isArray(activeResult.schedule) &&
    activeResult.schedule.length > 0 &&
    Object.prototype.hasOwnProperty.call(activeResult.schedule[0], 'insurance_payment');

  useEffect(() => {
    if (!activeConfig) {
      return undefined;
    }

    const validationError = activeConfig.validate(activeValues);
    if (validationError) {
      setResults((prev) => ({
        ...prev,
        [activeCalculator]: {
          ...emptyResult,
          status: 'invalid',
          error: validationError,
        },
      }));
      return undefined;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    let didTimeout = false;
    let isStale = false;
    let requestController = null;
    let requestTimeoutId = null;

    const debounceId = window.setTimeout(async () => {
      if (isStale || requestId !== requestSequenceRef.current) {
        return;
      }

      requestController = new AbortController();
      requestTimeoutId = window.setTimeout(() => {
        didTimeout = true;
        requestController?.abort();
      }, CALCULATION_REQUEST_TIMEOUT_MS);

      setResults((prev) => ({
        ...prev,
        [activeCalculator]: {
          ...prev[activeCalculator],
          status: 'loading',
          error: '',
        },
      }));

      const calculationRequest = activeConfig.buildRequest(activeValues);

      try {
        const response = await fetch(`${API_BASE}/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calculationRequest),
          signal: requestController.signal,
        });

        const payload = await safeParseJson(response);
        if (isStale || requestId !== requestSequenceRef.current) {
          return;
        }

        if (!response.ok) {
          const detail = extractApiError(payload) || `Erreur API ${response.status}`;
          if (response.status >= 500 && ALLOW_LOCAL_FALLBACK) {
            setResults((prev) => ({
              ...prev,
              [activeCalculator]: buildSuccessResult(buildLocalFallback(calculationRequest), 'local'),
            }));
            return;
          }

          throw new Error(detail);
        }

        setResults((prev) => ({
          ...prev,
          [activeCalculator]: buildSuccessResult(payload, 'api'),
        }));
      } catch (error) {
        if (isStale || requestId !== requestSequenceRef.current) {
          return;
        }

        if (error.name === 'AbortError') {
          if (!didTimeout) {
            return;
          }

          if (ALLOW_LOCAL_FALLBACK) {
            try {
              setResults((prev) => ({
                ...prev,
                [activeCalculator]: buildSuccessResult(buildLocalFallback(calculationRequest), 'local'),
              }));
              return;
            } catch {
              return;
            }
          }

          setResults((prev) => ({
            ...prev,
            [activeCalculator]: {
              ...emptyResult,
              status: 'error',
              error: "L'API de calcul n'a pas répondu à temps.",
            },
          }));
          return;
        }

        const networkFallback = ALLOW_LOCAL_FALLBACK
          ? tryBuildLocalFallback(calculationRequest, error)
          : null;
        if (networkFallback) {
          setResults((prev) => ({
            ...prev,
            [activeCalculator]: buildSuccessResult(networkFallback, 'local'),
          }));
          return;
        }

        setResults((prev) => ({
          ...prev,
          [activeCalculator]: {
            ...emptyResult,
            status: 'error',
          error: error.message || "La simulation n'a pas pu être calculée.",
          },
        }));
      } finally {
        if (requestTimeoutId !== null) {
          window.clearTimeout(requestTimeoutId);
        }
      }
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(debounceId);
      if (requestTimeoutId !== null) {
        window.clearTimeout(requestTimeoutId);
      }
      requestController?.abort();
    };
  }, [activeCalculator, activeConfig, activeValues]);

  const handleCalculatorChange = (calculatorId, fieldName, value) => {
    setCalculatorValues((prev) => ({
      ...prev,
      [calculatorId]: {
        ...prev[calculatorId],
        [fieldName]: value,
      },
    }));
  };

  return (
    <section id="calculators" className="scroll-mt-20 px-6 py-20">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-white">Calculateurs Financiers</h2>
        </motion.div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
            {calculatorsData.map((calculator) => (
              <Button
                key={calculator.id}
                onClick={() => setActiveCalculator(calculator.id)}
                variant={activeCalculator === calculator.id ? 'default' : 'outline'}
                className={`px-6 py-3 ${
                  activeCalculator === calculator.id
                    ? 'bg-gradient-to-r from-gold-400 to-yellow-500 text-white'
                    : 'border-white/30 text-white hover:bg-white/10'
                }`}
              >
                <calculator.icon className="mr-2 h-4 w-4" />
                {calculator.name}
              </Button>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4 text-sm text-cyan-50">
            Conservez la m&ecirc;me devise du d&eacute;but &agrave; la fin de la simulation. Les
            outils ci-dessous n&apos;effectuent aucune conversion automatique.
          </div>

          {activeConfig && (
            <motion.div
              key={activeCalculator}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md"
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div>
                  <h3 className="mb-2 text-2xl font-bold text-white">{activeConfig.title}</h3>
                  <p className="mb-6 text-sm leading-6 text-white/60">{activeConfig.assumption}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    {activeConfig.fields.map((field) => (
                      <div key={field.name}>
                        <label className="mb-2 block text-sm text-white/80">{field.label}</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={field.min}
                          max={field.max}
                          step={field.step || '1'}
                          value={activeValues[field.name]}
                          onChange={(event) =>
                            handleCalculatorChange(activeCalculator, field.name, event.target.value)
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-full rounded-[28px] border border-white/10 bg-slate-950/55 p-8 text-center shadow-[0_24px_70px_rgba(2,10,18,0.35)]">
                    <div
                      className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r ${activeConfig.accentClassName}`}
                    >
                      <activeConfig.icon className="h-12 w-12 text-white" />
                    </div>
                    <h4 className="mb-3 text-lg text-white/75">{activeConfig.resultLabel}</h4>

                    {activeResult.status === 'loading' && (
                      <div className="flex flex-col items-center gap-3 text-cyan-200">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p>SIKA recalcule la simulation...</p>
                      </div>
                    )}

                    {(activeResult.status === 'invalid' || activeResult.status === 'error') && (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-5 text-left text-amber-50">
                        <div className="mb-2 flex items-center gap-2 font-semibold">
                          <AlertCircle className="h-5 w-5" />
                          Simulation &agrave; v&eacute;rifier
                        </div>
                        <p className="text-sm leading-6">{activeResult.error}</p>
                      </div>
                    )}

                    {activeResult.status === 'success' && activeResult.result !== null && (
                      <>
                        <p className="text-4xl font-bold text-white">
                          {formatAmount(activeResult.result)}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-white/60">
                          {activeResult.summary}
                        </p>
                        {!IS_PRODUCTION && activeResult.source === 'local' && (
                          <div className="mt-3 flex justify-center">
                            <span className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                              Secours local actif
                            </span>
                          </div>
                        )}

                        <div className="mt-6 space-y-3 text-left">
                          {activeConfig.breakdownOrder
                            .filter((key) => activeResult.breakdown[key] !== undefined)
                            .map((key) => (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                              >
                                <span className="text-white/60">{breakdownLabels[key] || key}</span>
                                <span className="font-semibold text-white">
                                  {formatBreakdownValue(key, activeResult.breakdown[key])}
                                </span>
                              </div>
                            ))}
                        </div>

                        {activeResult.notes.length > 0 && (
                          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                              Cadre de calcul
                            </p>
                            <div className="space-y-2">
                              {activeResult.notes.map((note) => (
                                <p key={note} className="text-sm leading-6 text-white/70">
                                  {'\u2022'} {note}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeResult.schedule.length > 0 && (
                          <div className="mt-6 text-left">
                            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                              Tableau d&apos;amortissement
                            </p>
                            <div className="max-h-80 overflow-auto rounded-2xl border border-white/10 bg-white/5">
                              <table className="min-w-full text-sm text-white/80">
                                <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase tracking-[0.18em] text-white/45 backdrop-blur">
                                  <tr>
                                    <th className="px-4 py-3 text-left">Mois</th>
                                    <th className="px-4 py-3 text-right">Crédit</th>
                                    {scheduleHasInsurance && (
                                      <th className="px-4 py-3 text-right">Assurance</th>
                                    )}
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Capital</th>
                                    <th className="px-4 py-3 text-right">Intérêts</th>
                                    <th className="px-4 py-3 text-right">Solde</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeResult.schedule.map((row) => (
                                    <tr key={row.month} className="border-t border-white/10">
                                      <td className="px-4 py-3 text-left text-white/70">
                                        {row.month}
                                      </td>
                                      <td className="px-4 py-3 text-right font-medium text-white">
                                        {formatAmount(row.loan_payment ?? row.payment)}
                                      </td>
                                      {scheduleHasInsurance && (
                                        <td className="px-4 py-3 text-right text-white/80">
                                          {formatAmount(row.insurance_payment ?? 0)}
                                        </td>
                                      )}
                                      <td className="px-4 py-3 text-right font-medium text-white">
                                        {formatAmount(row.payment)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-white/80">
                                        {formatAmount(row.principal_paid)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-white/80">
                                        {formatAmount(row.interest_paid)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-white/80">
                                        {formatAmount(row.remaining_balance)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildSuccessResult(payload, source) {
  return {
    status: 'success',
    result: payload.result,
    summary: payload.summary,
    breakdown: payload.breakdown || {},
    notes: payload.notes || [],
    schedule: payload.schedule || [],
    error: '',
    source,
  };
}

function formatAmount(value) {
  return NUMBER_FORMATTER.format(Number(value));
}

function formatBreakdownValue(key, value) {
  if (moneyKeys.has(key)) {
    return formatAmount(value);
  }

  if (percentageKeys.has(key)) {
    return `${NUMBER_FORMATTER.format(Number(value))} %`;
  }

  if (key === 'duration_months') {
    return `${value} mois`;
  }

  return String(value);
}

function buildLocalFallback(requestPayload) {
  return calculateLocally(requestPayload);
}

function tryBuildLocalFallback(requestPayload, error) {
  if (!isNetworkLikeError(error)) {
    return null;
  }

  try {
    return buildLocalFallback(requestPayload);
  } catch {
    return null;
  }
}

function isNetworkLikeError(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || '');
  return (
    error.name === 'TypeError' ||
    /Failed to fetch|NetworkError|Load failed|ERR_CONNECTION|ERR_FAILED/i.test(message)
  );
}

function extractApiError(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload.detail === 'string') {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default Calculators;
