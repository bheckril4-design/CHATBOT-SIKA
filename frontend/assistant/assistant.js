const API_BASE = (window.SIKA_API_BASE || window.location.origin).replace(/\/$/, '');
const STORAGE_KEY = 'sika_assistant_user_id';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 16;
const ALLOW_LOCAL_FALLBACK =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  /localhost|127\.0\.0\.1/.test(API_BASE);
const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

const userId = loadOrCreateUserId();
const state = {
  history: [],
};

const messagesEl = document.getElementById('assistant-messages');
const formEl = document.getElementById('assistant-form');
const inputEl = document.getElementById('assistant-input');
const languageEl = document.getElementById('assistant-language');
const statusEl = document.getElementById('assistant-status');
const micButton = document.getElementById('assistant-mic');

addMessage(
  'assistant',
  "Bonjour. Je suis SIKA. Je peux déjà vous aider sur l'épargne, le budget, le crédit et les notions d'investissement."
);

formEl.addEventListener('submit', async function (event) {
  event.preventDefault();
  const message = inputEl.value.trim();
  if (!message) {
    return;
  }

  inputEl.value = '';
  addMessage('user', message);
  setStatus('SIKA réfléchit...');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const recentHistory = state.history.slice(-MAX_CONTEXT_MESSAGES);
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        language: languageEl.value,
        user_id: userId,
        history: recentHistory,
      }),
    });

    const payload = await safeParseJson(response);

    if (!response.ok) {
      if (ALLOW_LOCAL_FALLBACK && response.status >= 500) {
        addMessage('assistant', buildLocalAssistantReply(message, languageEl.value, recentHistory));
        return;
      }

      throw new Error(extractApiError(payload) || `Erreur API ${response.status}`);
    }

    if (!payload?.answer) {
      if (ALLOW_LOCAL_FALLBACK) {
        addMessage('assistant', buildLocalAssistantReply(message, languageEl.value, recentHistory));
        return;
      }

      throw new Error("L'API SIKA a renvoye une reponse vide.");
    }

    addMessage('assistant', payload.answer);
    if (payload.source === 'demo') {
      setStatus("Mode gratuit actif. Cette page répond sans OpenAI avec le moteur pédagogique de SIKA.");
    } else {
      setStatus('');
    }
  } catch (error) {
    if (ALLOW_LOCAL_FALLBACK && (error.name === 'AbortError' || isNetworkLikeError(error))) {
      addMessage(
        'assistant',
        buildLocalAssistantReply(message, languageEl.value, state.history.slice(-MAX_CONTEXT_MESSAGES))
      );
      setStatus("Mode local actif. Cette page utilise un moteur de secours en environnement local.");
    } else {
      if (error.name === 'AbortError') {
        addMessage('assistant', "L'assistant SIKA a mis trop de temps a repondre. Merci de reessayer.");
      } else if (isNetworkLikeError(error)) {
        addMessage('assistant', "Impossible de joindre l'API SIKA pour le moment. Merci de reessayer dans quelques instants.");
      } else {
        addMessage('assistant', error.message || "Une erreur s'est produite.");
      }
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (statusEl.textContent === 'SIKA réfléchit...' || statusEl.textContent === 'SIKA reflechit...') {
      setStatus('');
    }
  }
});

micButton.addEventListener('click', function () {
  addMessage(
    'assistant',
    'Le mode vocal est prévu pour la phase 2. Cette page est déjà prête pour le brancher.'
  );
});

function addMessage(role, content) {
  const bubble = document.createElement('article');
  bubble.className = `assistant-bubble assistant-bubble-${role}`;
  bubble.textContent = content;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  state.history.push({ role, content });
  state.history = state.history.slice(-MAX_HISTORY_MESSAGES);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function loadOrCreateUserId() {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}

function buildLocalAssistantReply(message, language, history) {
  if (language === 'fon' || language === 'mina') {
    return (
      'Je peux déjà donner une orientation simple ici. ' +
      'Si vous voulez une réponse plus riche, reformulez aussi en français.'
    );
  }

  const context = extractConversationContext(history, message);

  if (context.topic === 'investment') {
    return buildInvestmentReply(context);
  }

  if (context.topic === 'credit') {
    return buildCreditReply(context);
  }

  if (context.topic === 'retirement') {
    return buildRetirementReply(context);
  }

  if (context.topic === 'savings') {
    return buildSavingsReply(context);
  }

  return buildGeneralReply(context);
}

function buildSavingsReply(context) {
  if (context.wantsSavingsPlan) {
    return buildSavingsPlanReply(context);
  }

  if (context.monthlySavingsAmount) {
    return (
      `Si vous pouvez épargner ${formatAmount(context.monthlySavingsAmount)} par mois, le plus utile est de séparer réserve de sécurité et argent de projet. ` +
      "Commencez par mettre quelques mois de dépenses de côté, puis automatisez un versement régulier. " +
      "Si vous voulez, je peux vous proposer un plan simple en 3 étapes à partir de ce montant mensuel."
    );
  }

  if (context.amount) {
    return (
      `Si vous partez avec ${formatAmount(context.amount)}, le plus utile est de séparer réserve de sécurité et argent de projet. ` +
      "Commencez par mettre quelques mois de dépenses de côté, puis automatisez un versement régulier. " +
      "Si vous voulez, donnez-moi votre revenu mensuel et vos charges fixes."
    );
  }

  return (
    "Pour épargner efficacement, commencez par un montant automatique réaliste, puis construisez une réserve de sécurité avant de chercher du rendement. " +
    "Donnez-moi votre revenu mensuel et vos charges fixes si vous voulez une méthode concrète."
  );
}

function buildSavingsPlanReply(context) {
  const monthlyAmount = context.monthlySavingsAmount || context.amount;

  if (!monthlyAmount) {
    return (
      "Voici un plan simple en 3 étapes : 1. sécuriser une réserve de précaution, 2. automatiser un montant fixe chaque mois, 3. augmenter progressivement l'effort d'épargne quand le revenu progresse. " +
      "Si vous me donnez votre revenu mensuel net et vos charges fixes, je peux le traduire en montants concrets."
    );
  }

  const reserveAmount = Math.round(monthlyAmount * 0.5);
  const projectAmount = Math.round(monthlyAmount * 0.3);
  const progressionAmount = Math.max(0, Math.round(monthlyAmount - reserveAmount - projectAmount));

  return (
    `Voici un plan simple en 3 étapes avec ${formatAmount(monthlyAmount)} par mois :\n` +
    `1. Réserve de sécurité : mettez ${formatAmount(reserveAmount)} par mois de côté jusqu'à atteindre au moins 2 à 3 mois de dépenses essentielles.\n` +
    `2. Objectif court ou moyen terme : affectez ${formatAmount(projectAmount)} par mois à un support disponible pour vos projets des 12 à 36 prochains mois.\n` +
    `3. Progression : gardez ${formatAmount(progressionAmount)} par mois pour un objectif plus long terme ou pour augmenter graduellement votre effort d'épargne.\n` +
    "Quand la réserve est suffisante, vous pouvez rediriger une partie de l'étape 1 vers l'étape 2 ou 3. Si vous me donnez votre revenu mensuel net, je peux recalibrer ce plan plus finement."
  );
}

function buildCreditReply(context) {
  if (context.durationMonths) {
    return (
      `Avec un horizon de ${formatDuration(context.durationMonths)}, regardez surtout la mensualité supportable, le coût total du crédit et la marge de sécurité restante. ` +
      "Si vous me donnez montant, taux et durée, je peux vous répondre plus concrètement."
    );
  }

  return (
    "Avant d'accepter un crédit, vérifiez mensualité, coût total et marge de sécurité après charges fixes. " +
    "Donnez-moi montant, taux et durée si vous voulez une réponse directe."
  );
}

function buildRetirementReply(context) {
  if (context.durationMonths) {
    return (
      `Sur ${formatDuration(context.durationMonths)}, utilisez une hypothèse de rendement prudente et testez plusieurs scénarios. ` +
      "Si vous avez déjà un capital et un effort mensuel cible, je peux structurer une réponse plus concrète."
    );
  }

  return (
    "Pour un objectif long terme, partez d'un horizon clair, d'un capital de départ, d'un versement régulier et d'une hypothèse prudente. " +
    "Donnez-moi votre âge cible et votre effort mensuel si vous voulez aller plus loin."
  );
}

function buildInvestmentReply(context) {
  if (context.wantsAllocationPlan && context.amount && context.durationMonths) {
    return buildAllocationPlans(context);
  }

  const amountPart = context.amount ? `Avec ${formatAmount(context.amount)}` : 'Avec ce capital';
  const horizonPart = context.durationMonths ? ` sur ${formatDuration(context.durationMonths)}` : '';
  const riskPart = context.riskProfile ? `, dans un profil ${context.riskProfile}` : '';

  if (context.durationMonths && context.durationMonths <= 24) {
    return (
      `${amountPart}${horizonPart}${riskPart}, je serais plutot prudent : sur un horizon aussi court, la priorite est la protection du capital et la disponibilite. ` +
      "Je n'exposerais pas l'ensemble a des actifs trop volatils. " +
      "Gardez l'essentiel sur un support court terme ou faible risque, et seulement une petite part plus dynamique si une baisse temporaire reste acceptable. " +
      "Si vous voulez, je peux vous proposer une répartition prudente, équilibrée ou dynamique."
    );
  }

  if (context.durationMonths && context.durationMonths <= 60) {
    return (
      `${amountPart}${horizonPart}${riskPart}, une approche équilibrée peut se discuter : une base défensive pour stabiliser le capital, puis une poche de croissance mesurée. ` +
      "Le plus important est de diversifier plutôt que tout mettre sur un seul actif. " +
      "Si vous voulez, je peux vous proposer 3 allocations types."
    );
  }

  if (context.durationMonths && context.durationMonths > 60) {
    return (
      `${amountPart}${horizonPart}${riskPart}, vous avez davantage de marge pour accepter des fluctuations temporaires, à condition de garder une réserve liquide à part. ` +
      "Une diversification plus dynamique peut se discuter, mais toujours sans promesse de rendement."
    );
  }

  if (context.isFollowUp && context.amount) {
    return (
      `${amountPart}, je peux déjà vous orienter, mais l'horizon de placement change beaucoup la recommandation. ` +
      "Sur moins de 2 ans, je serais prudent. Sur 3 à 5 ans, une approche équilibrée devient plus défendable. " +
      "Donnez-moi simplement la durée et votre profil de risque."
    );
  }

  return (
    "Pour vous conseiller utilement sur un investissement, j'ai surtout besoin de trois infos : montant, horizon et tolérance au risque. " +
    "Répondez juste sous la forme : montant / durée / prudent-équilibré-dynamique."
  );
}

function buildAllocationPlans(context) {
  const profiles = getAllocationProfiles(context.durationMonths);
  const lines = profiles.map(function (profile, index) {
    const allocations = formatAllocationBreakdown(context.amount, profile.mix);
    return `${index + 1}. ${profile.name}: ${allocations}.`;
  });

  const recommendation =
    context.riskProfile === 'dynamique'
      ? "Pour votre profil dynamique, l'option 3 est la plus proche de votre demande, mais sur 4 ans je garderais quand même une vraie base défensive."
      : context.riskProfile === 'equilibre'
        ? "Pour votre profil équilibré, l'option 2 est en général le meilleur point de départ."
        : "Pour un profil prudent, l'option 1 est la plus défensive.";

  const targetRate = context.annualRate
    ? ` Si votre objectif implicite est proche de ${context.annualRate} % par an, l'option 2 ou 3 peut se discuter sans garantie de resultat.`
    : '';

  return (
    `Voici 3 allocations types adaptees a ${formatDuration(context.durationMonths)} pour ${formatAmount(context.amount)} :\n` +
    `${lines.join('\n')}\n` +
    `${recommendation}${targetRate}`
  );
}

function buildGeneralReply(context) {
  if (context.isFollowUp && context.topic) {
    return (
      "Je peux aller plus loin, mais j'ai besoin d'un detail concret pour sortir du generique. " +
      "Donnez-moi votre montant, votre horizon et votre objectif principal."
    );
  }

  return (
    "Je peux vous aider sur l'épargne, le budget, le crédit, la retraite et les bases de l'investissement. " +
    "Pour une réponse vraiment utile, donnez-moi votre objectif, le montant concerné, votre horizon et votre tolérance au risque."
  );
}

function extractConversationContext(history, message) {
  const userMessages = history
    .filter(function (item) {
      return item.role === 'user';
    })
    .map(function (item) {
      return item.content;
    });
  userMessages.push(message);
  const normalizedMessage = normalizeForMatch(message);
  const wantsAllocationPlan = isAllocationRequest(normalizedMessage);
  const wantsSavingsPlan = isSavingsPlanRequest(normalizedMessage);
  const amount = findLatestAmount(userMessages);
  const monthlySavingsAmount = findLatestMonthlyAmount(userMessages);
  const durationMonths = findLatestDurationMonths(userMessages);
  const annualRate = findLatestAnnualRate(userMessages);
  const riskProfile = findLatestRiskProfile(userMessages);
  let topic = findLatestTopic(userMessages);

  if (!topic && wantsAllocationPlan && (amount || durationMonths || riskProfile)) {
    topic = 'investment';
  }

  if (!topic && wantsSavingsPlan && (monthlySavingsAmount || amount)) {
    topic = 'savings';
  }

  return {
    topic: topic,
    amount: amount,
    monthlySavingsAmount: monthlySavingsAmount,
    durationMonths: durationMonths,
    annualRate: annualRate,
    riskProfile: riskProfile,
    isFollowUp: isAdviceFollowUp(normalizedMessage),
    wantsAllocationPlan: wantsAllocationPlan,
    wantsSavingsPlan: wantsSavingsPlan,
  };
}

function findLatestTopic(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeForMatch(messages[index]);

    if (matchesAny(normalized, ['invest', 'placement', 'rendement', 'bourse', 'crypto'])) {
      return 'investment';
    }
    if (matchesAny(normalized, ['credit', 'pret', 'mensualite', 'remboursement', 'emprunt'])) {
      return 'credit';
    }
    if (matchesAny(normalized, ['retraite', 'patrimoine', 'long terme'])) {
      return 'retirement';
    }
    if (matchesAny(normalized, ['epargne', 'budget', 'econom', 'tresorerie'])) {
      return 'savings';
    }
  }

  return null;
}

function findLatestAmount(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = String(messages[index] || '').replace(/\u00a0/g, ' ');
    const match = text.match(/(\d[\d\s.,]{2,})(?:\s*)(k|m)?\b/i);
    if (!match) {
      continue;
    }

    const numericPart = match[1].replace(/\s/g, '').replace(/,/g, '.');
    const parsed = Number.parseFloat(numericPart);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') {
      return parsed * 1000;
    }
    if (suffix === 'm') {
      return parsed * 1000000;
    }
    return parsed;
  }

  return null;
}

function findLatestMonthlyAmount(messages) {
  const monthlyPattern = /(\d[\d\s.,]{2,})(?:\s*)(k|m)?\s*(?:\/|\bpar\b)\s*(?:mois|mensuel(?:le)?s?)\b/i;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = String(messages[index] || '').replace(/\u00a0/g, ' ');
    const match = text.match(monthlyPattern);
    if (!match) {
      continue;
    }

    const numericPart = match[1].replace(/\s/g, '').replace(/,/g, '.');
    const parsed = Number.parseFloat(numericPart);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') {
      return parsed * 1000;
    }
    if (suffix === 'm') {
      return parsed * 1000000;
    }
    return parsed;
  }

  return null;
}

function findLatestDurationMonths(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeForMatch(messages[index]);
    const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ans?|annees?|mois)\b/);
    if (!match) {
      continue;
    }

    const value = Number.parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(value)) {
      continue;
    }

    return match[2].startsWith('mois') ? Math.round(value) : Math.round(value * 12);
  }

  return null;
}

function findLatestRiskProfile(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeForMatch(messages[index]);
    if (matchesAny(normalized, ['prudent', 'faible risque', 'sans risque'])) {
      return 'prudent';
    }
    if (matchesAny(normalized, ['equilibre', 'modere', 'moderer'])) {
      return 'equilibre';
    }
    if (matchesAny(normalized, ['dynamique', 'agressif', 'volatil'])) {
      return 'dynamique';
    }
  }

  return null;
}

function findLatestAnnualRate(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeForMatch(messages[index]);
    const match =
      normalized.match(/taux\s+de\s+(\d+(?:[.,]\d+)?)\s*%/) ||
      normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) {
      continue;
    }

    const value = Number.parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function isAdviceFollowUp(normalizedMessage) {
  return matchesAny(normalizedMessage, [
    'tu me conseilles',
    'vous me conseillez',
    'que faire',
    'je fais quoi',
    'tu proposes',
    'vous proposez',
    'tu ferais quoi',
    'que me proposes',
    'quelle option',
  ]);
}

function isAllocationRequest(normalizedMessage) {
  return matchesAny(normalizedMessage, [
    'allocation',
    'allocations',
    'repartition',
    'repartitions',
    'portefeuille type',
    'portefeuilles types',
    '3 allocations',
    'trois allocations',
    '3 options',
    'trois options',
  ]);
}

function isSavingsPlanRequest(normalizedMessage) {
  return matchesAny(normalizedMessage, [
    'plan simple',
    'propose moi un plan',
    'proposez moi un plan',
    '3 etapes',
    'trois etapes',
    'par etapes',
    'methode simple',
    'revenu mensuel',
  ]);
}

function getAllocationProfiles(durationMonths) {
  if (durationMonths <= 24) {
    return [
      {
        name: 'Prudente',
        mix: [
          ['supports liquides / faible risque', 70],
          ['fonds defensifs / obligataires', 25],
          ['poche croissance', 5],
        ],
      },
      {
        name: 'Équilibrée',
        mix: [
          ['supports liquides / faible risque', 55],
          ['fonds defensifs / diversifies', 35],
          ['poche croissance', 10],
        ],
      },
      {
        name: 'Dynamique',
        mix: [
          ['supports liquides / faible risque', 40],
          ['fonds diversifies', 40],
          ['poche croissance', 20],
        ],
      },
    ];
  }

  if (durationMonths <= 60) {
    return [
      {
        name: 'Prudente',
        mix: [
          ['supports liquides / faible risque', 50],
          ['fonds defensifs / obligataires', 35],
          ['poche croissance', 15],
        ],
      },
      {
        name: 'Équilibrée',
        mix: [
          ['supports liquides / faible risque', 35],
          ['fonds diversifies', 40],
          ['actions / croissance', 25],
        ],
      },
      {
        name: 'Dynamique',
        mix: [
          ['supports liquides / faible risque', 20],
          ['fonds diversifies', 35],
          ['actions / croissance', 45],
        ],
      },
    ];
  }

  return [
    {
      name: 'Prudente',
      mix: [
        ['supports liquides / faible risque', 35],
        ['fonds defensifs / obligataires', 40],
        ['actions / croissance', 25],
      ],
    },
    {
      name: 'Équilibrée',
      mix: [
        ['supports liquides / faible risque', 20],
        ['fonds diversifies', 40],
        ['actions / croissance', 40],
      ],
    },
    {
      name: 'Dynamique',
      mix: [
        ['supports liquides / faible risque', 10],
        ['fonds diversifies', 30],
        ['actions / croissance', 60],
      ],
    },
  ];
}

function formatAllocationBreakdown(amount, mix) {
  const values = mix.map(function (entry, index) {
    if (index === mix.length - 1) {
      const allocatedSoFar = mix
        .slice(0, -1)
        .reduce(function (sum, item) {
          return sum + Math.round((amount * item[1]) / 100);
        }, 0);
      return amount - allocatedSoFar;
    }
    return Math.round((amount * entry[1]) / 100);
  });

  return mix
    .map(function (entry, index) {
      return `${entry[1]} % ${entry[0]} (${formatAmount(values[index])})`;
    })
    .join(', ');
}

function matchesAny(text, needles) {
  return needles.some(function (needle) {
    return text.includes(needle);
  });
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatAmount(value) {
  return NUMBER_FORMATTER.format(Number(value));
}

function formatDuration(durationMonths) {
  if (!durationMonths) {
    return 'cet horizon';
  }

  if (durationMonths % 12 === 0) {
    const years = durationMonths / 12;
    return years === 1 ? '1 an' : `${years} ans`;
  }

  return `${durationMonths} mois`;
}

function isNetworkLikeError(error) {
  const message = String((error && error.message) || '');
  return (
    (error && error.name) === 'TypeError' ||
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
      .map(function (item) {
        return item && item.msg;
      })
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
