const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

export const REQUEST_TIMEOUT_MS = 15000;
export const MAX_MESSAGES = 50;
export const MAX_CONTEXT_MESSAGES = 16;

export const welcomeByLanguage = {
  fr: 'Bonjour. Je suis SIKA, votre assistant financier. Posez votre question en toute simplicité.',
  fon: 'Bonjour. SIKA wa bo hlan. Bi question to we.',
  mina: 'Bonjour. Nye SIKA. Bi finance nya me nyuie na miagblon.',
};

export const voiceComingSoonMessage =
  "Le mode vocal sera activé dans la prochaine phase. Pour l'instant, utilisez le chat texte.";

export function appendMessage(messages, nextMessage) {
  return [...messages, nextMessage].slice(-MAX_MESSAGES);
}

export function getOrCreateUserId(storageKey = 'sika_web_user_id') {
  const existingId = window.localStorage.getItem(storageKey);
  if (existingId) {
    return existingId;
  }

  const createdId = `sika-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(storageKey, createdId);
  return createdId;
}

export async function requestAssistantReply({
  apiBase,
  message,
  language,
  userId,
  history,
  signal,
}) {
  const allowLocalFallback = shouldAllowLocalFallback(apiBase);

  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        message,
        language,
        user_id: userId,
        history,
      }),
    });

    const payload = await safeParseJson(response);

    if (!response.ok) {
      if (allowLocalFallback && response.status >= 500) {
        return {
          answer: buildLocalAssistantReply({ message, language, history }),
          source: 'local',
        };
      }

      throw new Error(extractApiError(payload) || `Erreur API ${response.status}`);
    }

    if (!payload?.answer) {
      if (!allowLocalFallback) {
        throw new Error("L'API SIKA a renvoyé une réponse vide.");
      }

      return {
        answer: buildLocalAssistantReply({ message, language, history }),
        source: 'local',
      };
    }

    return {
      answer: payload.answer,
      source: payload.source || 'api',
    };
  } catch (error) {
    if (allowLocalFallback && (error.name === 'AbortError' || isNetworkLikeError(error))) {
      return {
        answer: buildLocalAssistantReply({ message, language, history }),
        source: 'local',
      };
    }

    if (error.name === 'AbortError') {
      throw new Error("L'assistant SIKA a mis trop de temps à répondre. Réessayez dans quelques instants.");
    }

    if (isNetworkLikeError(error)) {
      throw new Error("Impossible de joindre l'API SIKA pour le moment. Réessayez dans quelques instants.");
    }

    throw error;
  }
}

function shouldAllowLocalFallback(apiBase) {
  const normalizedApiBase = String(apiBase || '');
  const runningLocally =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    import.meta.env.DEV ||
    runningLocally ||
    /localhost|127\.0\.0\.1/.test(normalizedApiBase)
  );
}

export function buildLocalAssistantReply({ message, language, history = [] }) {
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
  if (
    context.wantsSavingsPlan ||
    (context.isAffirmativeFollowUp &&
      (context.monthlySavingsAmount != null || context.amount != null))
  ) {
    return buildSavingsPlanReply(context);
  }

  if (context.monthlySavingsAmount) {
    const reserveShare = Math.round(context.monthlySavingsAmount * 0.4);
    const projectShare = Math.round(context.monthlySavingsAmount * 0.3);
    return (
      `Avec ${formatAmount(context.monthlySavingsAmount)} par mois, vous pouvez déjà construire quelque chose de solide. ` +
      `Je commencerais par mettre environ ${formatAmount(reserveShare)} de côté pour la réserve de sécurité et ${formatAmount(projectShare)} pour vos projets à court ou moyen terme. ` +
      "Le reste peut servir à prendre doucement l'habitude d'investir de façon régulière. " +
      "Si vous voulez, je peux maintenant vous transformer ça en plan simple en 3 étapes."
    );
  }

  if (context.amount) {
    return (
      `Avec ${formatAmount(context.amount)} au départ, je ne chercherais pas tout de suite la performance. ` +
      "Je commencerais par protéger une partie en réserve disponible, puis j'installerais une épargne mensuelle simple et régulière. " +
      "Si vous voulez, donnez-moi votre revenu mensuel et je vous propose une répartition concrète."
    );
  }

  return (
    "Pour bien démarrer, il n'est pas nécessaire de viser gros tout de suite. " +
    "Le plus utile est de mettre en place une épargne automatique réaliste, de construire une réserve de sécurité, puis d'augmenter progressivement l'effort quand le budget le permet. " +
    "Si vous me donnez votre revenu mensuel, je peux vous proposer une méthode simple et concrète."
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
      `Avec un horizon de ${formatDuration(context.durationMonths)}, je regarderais surtout ` +
      "la mensualité supportable, le coût total du crédit et votre marge de sécurité après charges fixes. " +
      "Si vous me donnez le montant emprunté et le taux, je peux vous dire tout de suite si la structure semble prudente."
    );
  }

  return (
    "Avant d'accepter un crédit, vérifiez trois points : mensualité supportable, coût total et marge de sécurité restante après dépenses fixes. " +
    "Si vous voulez, donnez-moi juste montant, taux et durée, et je vous réponds plus concrètement."
  );
}

function buildRetirementReply(context) {
  if (context.durationMonths) {
    return (
      `Sur ${formatDuration(context.durationMonths)}, l'important est d'utiliser une hypothèse de rendement prudente ` +
      "et de tester plusieurs scénarios, pas seulement le plus optimiste. " +
      "Si vous avez déjà un capital et un effort mensuel cible, je peux vous proposer une projection prudente, équilibrée et ambitieuse."
    );
  }

  return (
    "Pour un objectif long terme, partez d'un horizon clair, d'un capital de départ, d'un versement régulier " +
    "et d'une hypothèse prudente de rendement. " +
    "Si vous me donnez votre âge, l'âge cible et l'effort mensuel envisagé, je peux structurer la suite."
  );
}

function buildInvestmentReply(context) {
  if (
    (context.wantsAllocationPlan || context.isAffirmativeFollowUp) &&
    context.amount &&
    context.durationMonths
  ) {
    return buildAllocationPlans(context);
  }

  const amountPart = context.amount ? `Avec ${formatAmount(context.amount)}` : 'Avec ce capital';
  const monthlyPart = context.monthlySavingsAmount
    ? formatAmount(context.monthlySavingsAmount)
    : null;
  const horizonPart = context.durationMonths ? ` sur ${formatDuration(context.durationMonths)}` : '';
  const riskPart = context.riskProfile ? `, dans un profil ${context.riskProfile}` : '';

  if (context.amount && context.monthlySavingsAmount) {
    if (context.durationMonths) {
      return (
        `Avec ${formatAmount(context.amount)} déjà disponibles et ${monthlyPart} par mois${horizonPart}${riskPart}, vous avez déjà une bonne base. ` +
        "Je structurerais cela en 3 poches : une réserve disponible, une poche projets pour ce qui peut arriver dans les 12 à 24 prochains mois, puis une poche investissement diversifiée pour le moyen terme. " +
        `Sur les nouveaux versements, vous pouvez garder une petite partie des ${monthlyPart} pour la trésorerie et investir progressivement le reste pour lisser le risque. ` +
        "Si vous voulez, je peux maintenant vous proposer 3 allocations types et vous dire comment répartir aussi les nouveaux versements mensuels."
      );
    }

    return (
      `Avec ${formatAmount(context.amount)} aujourd'hui et ${monthlyPart} par mois, je commencerais par séparer votre effort en deux : épargne de sécurité d'un côté, investissement progressif de l'autre. ` +
      "Conservez d'abord une poche disponible pour les imprévus et les projets proches, puis investissez progressivement une partie fixe chaque mois pour lisser le risque. " +
      "Pour la partie investissement, dites-moi simplement votre horizon et si vous voulez quelque chose de prudent, équilibré ou plus dynamique, et je vous propose une répartition concrète."
    );
  }

  if (context.durationMonths && context.durationMonths <= 24) {
    return (
      `${amountPart}${horizonPart}${riskPart}, je serais plutôt prudent : ` +
      "sur un horizon aussi court, la priorité est la protection du capital et la disponibilité. " +
      "Je n'exposerais pas l'ensemble à des actifs trop volatils. " +
      "En pratique, gardez l'essentiel sur un support court terme ou faible risque, et seulement une petite part plus dynamique si une baisse temporaire reste acceptable. " +
      "Si vous voulez, je peux vous proposer tout de suite une répartition prudente, équilibrée ou dynamique pour ce cas."
    );
  }

  if (context.durationMonths && context.durationMonths <= 60) {
    return (
      `${amountPart}${horizonPart}${riskPart}, vous pouvez envisager une approche équilibrée : ` +
      "une base défensive pour stabiliser le capital, puis une poche de croissance mesurée pour chercher davantage de performance. " +
      "L'idée n'est pas de tout mettre sur un seul actif, mais de diversifier selon votre tolérance au risque. " +
      "Si vous voulez, je peux vous proposer 3 allocations types adaptées à cet horizon."
    );
  }

  if (context.durationMonths && context.durationMonths > 60) {
    return (
      `${amountPart}${horizonPart}${riskPart}, vous avez davantage de marge pour accepter des fluctuations temporaires, ` +
      "à condition de garder une réserve liquide à part. " +
      "Dans ce cas, une diversification plus dynamique peut se discuter, mais toujours sans promesse de rendement. " +
      "Si vous voulez, je peux vous proposer un cadre prudent pour investir progressivement."
    );
  }

  if (context.isFollowUp && context.amount) {
    return (
      `${amountPart}, je peux déjà vous orienter, mais le point décisif est votre horizon de placement. ` +
      "Sur moins de 2 ans, je serais prudent. Sur 3 à 5 ans, une approche équilibrée devient plus défendable. " +
      "Répondez-moi simplement avec votre durée et votre profil de risque : prudent, équilibré ou dynamique."
    );
  }

  return (
    "Je peux vous orienter utilement sur un investissement, mais il me manque encore trois repères : le montant, la durée visée et votre niveau de prudence face au risque. " +
    "Vous pouvez me le dire naturellement, par exemple : j'ai 25 000 à placer sur 5 ans, profil équilibré."
  );
}

function buildAllocationPlans(context) {
  const profiles = getAllocationProfiles(context.durationMonths);
  const lines = profiles.map((profile, index) => {
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
    ? ` Si votre objectif implicite est proche de ${context.annualRate} % par an, l'option 2 ou 3 peut se discuter sans garantie de résultat.`
    : '';
  const monthlyExtension = context.monthlySavingsAmount
    ? ` Si vous versez aussi ${formatAmount(context.monthlySavingsAmount)} par mois, vous pouvez reprendre la même logique de répartition sur les nouveaux versements.`
    : '';

  return (
    `Voici 3 allocations types adaptées à ${formatDuration(context.durationMonths)} pour ${formatAmount(context.amount)} :\n` +
    `${lines.join('\n')}\n` +
    `${recommendation}${targetRate}${monthlyExtension}`
  );
}

function buildGeneralReply(context) {
  if (context.isGreetingOnly) {
    return (
      "Bonjour. Dites-moi simplement ce que vous voulez faire : mieux épargner, investir progressivement, comprendre un crédit ou préparer un objectif comme la retraite. " +
      "Vous pouvez parler naturellement, par exemple : j'ai 25 000 aujourd'hui et 200 000 par mois, comment m'organiser ?"
    );
  }

  if (context.isFollowUp && context.topic) {
    return (
      "Je peux aller plus loin, mais j'ai besoin d'un détail concret pour sortir du générique. " +
      "Donnez-moi en une phrase votre montant, votre horizon et votre objectif principal, et je vous fais une réponse directement exploitable."
    );
  }

  return (
    "Je peux vous aider sur l'épargne, le budget, le crédit, la retraite et les bases de l'investissement. " +
    "Pour que ma réponse soit vraiment utile, dites-moi simplement votre objectif, les montants en jeu et votre horizon. Je m'adapte ensuite."
  );
}

function extractConversationContext(history, message) {
  const userMessages = [
    ...history.filter((item) => item.role === 'user').map((item) => item.content),
    message,
  ];
  const assistantMessages = history
    .filter((item) => item.role === 'assistant')
    .map((item) => item.content);
  const currentNormalized = normalizeForMatch(message);
  const assistantNormalized = assistantMessages
    .map((item) => normalizeForMatch(item))
    .join(' || ');
  const wantsAllocationPlan = isAllocationRequest(currentNormalized);
  const wantsSavingsPlan = isSavingsPlanRequest(currentNormalized);
  const isAffirmativeFollowUp = isAffirmativeFollowUpMessage(currentNormalized);
  const isGreetingOnly = isGreetingOnlyMessage(currentNormalized);
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

  if (!topic && isAffirmativeFollowUp) {
    if (
      matchesAny(assistantNormalized, [
        'allocation',
        'allocations',
        'repartition',
        'portefeuille',
        'profil',
      ])
    ) {
      topic = 'investment';
    } else if (
      matchesAny(assistantNormalized, [
        'plan simple',
        'epargne',
        'reserve de securite',
        'revenu mensuel',
      ])
    ) {
      topic = 'savings';
    }
  }

  return {
    currentMessage: message,
    topic,
    amount,
    monthlySavingsAmount,
    durationMonths,
    annualRate,
    riskProfile,
    isFollowUp: isAdviceFollowUp(currentNormalized),
    isAffirmativeFollowUp,
    isGreetingOnly,
    wantsAllocationPlan,
    wantsSavingsPlan,
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
      return parsed * 1_000_000;
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
      return parsed * 1_000_000;
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

function isAffirmativeFollowUpMessage(normalizedMessage) {
  return matchesAny(normalizedMessage, [
    "d'accord",
    'ok',
    'okay',
    'oui',
    'vas-y',
    'vas y',
    'allons-y',
    'allons y',
    'je veux bien',
    'ca marche',
    'tres bien',
    'parfait',
  ]);
}

function isGreetingOnlyMessage(normalizedMessage) {
  const stripped = normalizedMessage.trim();
  return ['bonjour', 'bonsoir', 'salut', 'hello', 'bjr', 'coucou'].includes(stripped);
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
  const values = mix.map(([, percentage], index) => {
    if (index === mix.length - 1) {
      const allocatedSoFar = mix
        .slice(0, -1)
        .reduce((sum, [, pct]) => sum + Math.round((amount * pct) / 100), 0);
      return amount - allocatedSoFar;
    }
    return Math.round((amount * percentage) / 100);
  });

  return mix
    .map(([label, percentage], index) => `${percentage} % ${label} (${formatAmount(values[index])})`)
    .join(', ');
}

function matchesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
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
  const message = String(error?.message || '');
  return (
    error?.name === 'TypeError' ||
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
