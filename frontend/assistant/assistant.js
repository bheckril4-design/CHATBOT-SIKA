const API_BASE = (window.SIKA_API_BASE || window.location.origin).replace(/\/$/, '');
const STORAGE_KEY = 'sika_assistant_user_id';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 16;
const ALLOW_LOCAL_FALLBACK =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  /localhost|127\.0\.0\.1/.test(API_BASE);
const SPEECH_LANGUAGE_MAP = {
  fr: 'fr-FR',
  fon: 'fr-FR',
  mina: 'fr-FR',
};

const state = {
  history: [],
  isListening: false,
  voicePlaybackEnabled: false,
};

const userId = loadOrCreateUserId();
const messagesEl = document.getElementById('assistant-messages');
const formEl = document.getElementById('assistant-form');
const inputEl = document.getElementById('assistant-input');
const languageEl = document.getElementById('assistant-language');
const statusEl = document.getElementById('assistant-status');
const micButton = document.getElementById('assistant-mic');
const speakerButton = document.getElementById('assistant-speaker');
const recognitionRef = { current: null };
const speechSupport = {
  input:
    typeof window !== 'undefined' &&
    typeof (window.SpeechRecognition || window.webkitSpeechRecognition) === 'function',
  output: typeof window !== 'undefined' && 'speechSynthesis' in window,
};
let shouldSpeakNextReply = false;
let lastSpokenMessageKey = '';

addMessage('assistant', welcomeByLanguage(languageEl.value));
updateVoiceButtons();

formEl.addEventListener('submit', async function (event) {
  event.preventDefault();
  await sendMessage(inputEl.value);
});

languageEl.addEventListener('change', function () {
  addMessage('assistant', welcomeByLanguage(languageEl.value));
});

micButton.addEventListener('click', function () {
  handleVoiceInput();
});

speakerButton.addEventListener('click', function () {
  toggleVoicePlayback();
});

window.addEventListener('beforeunload', function () {
  recognitionRef.current?.stop?.();
  window.speechSynthesis?.cancel?.();
});

async function sendMessage(rawMessage, options) {
  const config = options || {};
  const message = String(rawMessage || '').trim();
  if (!message) {
    return;
  }

  if (config.fromVoice && speechSupport.output) {
    shouldSpeakNextReply = true;
    state.voicePlaybackEnabled = true;
    updateVoiceButtons();
  }

  inputEl.value = '';
  addMessage('user', message);
  setStatus('SIKA réfléchit...');

  const controller = new AbortController();
  const timeoutId = window.setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const recentHistory = state.history
      .filter(function (item) {
        return item.role === 'assistant' || item.role === 'user';
      })
      .slice(-MAX_CONTEXT_MESSAGES - 1, -1);

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
        addMessage('assistant', buildLocalAssistantReply(message));
        setStatus('Mode local actif. Cette page utilise un moteur de secours local.');
        return;
      }

      throw new Error(extractApiError(payload) || `Erreur API ${response.status}`);
    }

    if (!payload?.answer) {
      if (ALLOW_LOCAL_FALLBACK) {
        addMessage('assistant', buildLocalAssistantReply(message));
        setStatus('Mode local actif. Cette page utilise un moteur de secours local.');
        return;
      }

      throw new Error("L'API SIKA a renvoyé une réponse vide.");
    }

    addMessage('assistant', payload.answer);
    if (payload.source === 'demo') {
      setStatus(
        'Mode gratuit actif. Cette page répond sans OpenAI avec le moteur pédagogique de SIKA.'
      );
    } else {
      setStatus('');
    }
  } catch (error) {
    if (ALLOW_LOCAL_FALLBACK && (error.name === 'AbortError' || isNetworkLikeError(error))) {
      addMessage('assistant', buildLocalAssistantReply(message));
      setStatus('Mode local actif. Cette page utilise un moteur de secours local.');
    } else if (error.name === 'AbortError') {
      addMessage('assistant', "L'assistant SIKA a mis trop de temps à répondre. Merci de réessayer.");
      setStatus('');
    } else if (isNetworkLikeError(error)) {
      addMessage(
        'assistant',
        "Impossible de joindre l'API SIKA pour le moment. Merci de reessayer dans quelques instants."
      );
      setStatus('');
    } else {
      addMessage('assistant', error.message || "Une erreur s'est produite.");
      setStatus('');
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (statusEl.textContent === 'SIKA réfléchit...') {
      setStatus('');
    }
  }
}

function handleVoiceInput() {
  if (!speechSupport.input) {
    addMessage(
      'assistant',
      'La dictée vocale dépend du navigateur. Elle fonctionne surtout dans Chrome ou Edge récents.'
    );
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (state.isListening) {
    recognitionRef.current?.stop?.();
    return;
  }

  const recognition = new Recognition();
  recognitionRef.current = recognition;
  recognition.lang = SPEECH_LANGUAGE_MAP[languageEl.value] || 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = function () {
    state.isListening = true;
    updateVoiceButtons();
  };

  recognition.onend = function () {
    state.isListening = false;
    updateVoiceButtons();
  };

  recognition.onerror = function (event) {
    state.isListening = false;
    updateVoiceButtons();
    addMessage(
      'assistant',
      event.error === 'not-allowed'
        ? "Le navigateur a refusé l'accès au micro. Autorisez le micro puis réessayez."
        : "La dictée vocale n'a pas abouti. Réessayez dans un endroit plus calme."
    );
  };

  recognition.onresult = async function (event) {
    const transcript = Array.from(event.results || [])
      .map(function (result) {
        return result[0]?.transcript || '';
      })
      .join(' ')
      .trim();

    if (!transcript) {
      return;
    }

    inputEl.value = transcript;
    await sendMessage(transcript, { fromVoice: true });
  };

  recognition.start();
}

function toggleVoicePlayback() {
  if (!speechSupport.output) {
    addMessage(
      'assistant',
      'La lecture vocale dépend du navigateur. Si elle est absente ici, essayez Chrome, Edge ou Safari récent.'
    );
    return;
  }

  state.voicePlaybackEnabled = !state.voicePlaybackEnabled;
  updateVoiceButtons();

  if (!state.voicePlaybackEnabled) {
    window.speechSynthesis?.cancel?.();
    return;
  }

  const lastAssistantMessage = [...state.history].reverse().find(function (item) {
    return item.role === 'assistant';
  });

  if (lastAssistantMessage) {
    shouldSpeakNextReply = false;
    speakAssistantReply(lastAssistantMessage.content);
  }
}

function maybeSpeakAssistantReply(text) {
  if (!speechSupport.output) {
    return;
  }

  const messageKey = `${state.history.length}:${text}`;
  if (messageKey === lastSpokenMessageKey) {
    return;
  }

  if (!state.voicePlaybackEnabled && !shouldSpeakNextReply) {
    return;
  }

  lastSpokenMessageKey = messageKey;
  shouldSpeakNextReply = false;
  speakAssistantReply(text);
}

function speakAssistantReply(text) {
  if (!speechSupport.output) {
    return;
  }

  const cleanedText = String(text || '').trim();
  if (!cleanedText) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  utterance.lang = SPEECH_LANGUAGE_MAP[languageEl.value] || 'fr-FR';
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function updateVoiceButtons() {
  micButton.textContent = state.isListening
    ? 'Écoute...'
    : speechSupport.input
      ? 'Dicter'
      : 'Micro indisponible';

  speakerButton.textContent = !speechSupport.output
    ? 'Voix indisponible'
    : state.voicePlaybackEnabled
      ? 'Lecture activée'
      : 'Lecture vocale';
}

function addMessage(role, content) {
  const bubble = document.createElement('article');
  bubble.className = `assistant-bubble assistant-bubble-${role}`;
  bubble.textContent = content;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  state.history.push({ role, content });
  state.history = state.history.slice(-MAX_HISTORY_MESSAGES);

  if (role === 'assistant') {
    maybeSpeakAssistantReply(content);
  }
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

function welcomeByLanguage(language) {
  if (language === 'fon') {
    return 'Bonjour. SIKA wa bo hlan. Bi question to we.';
  }
  if (language === 'mina') {
    return 'Bonjour. Nye SIKA. Bi finance nya me nyuie na miagblon.';
  }
  return 'Bonjour. Je suis SIKA, votre assistant financier. Posez votre question en toute simplicité.';
}

function buildLocalAssistantReply(message) {
  const normalized = normalizeForMatch(message);

  if (matchesAny(normalized, ['bonjour', 'salut', 'bonsoir', 'hello'])) {
    return (
      "Bonjour. Vous pouvez me parler naturellement. Par exemple : j'ai 25 000 aujourd'hui et 200 000 par mois, comment m'organiser ?"
    );
  }

  if (matchesAny(normalized, ['epargne', 'epargner', 'budget'])) {
    return (
      "Pour bien démarrer, commencez par automatiser un montant réaliste, construire une réserve de sécurité, puis séparer l'argent des projets proches de l'argent à investir plus longtemps."
    );
  }

  if (matchesAny(normalized, ['invest', 'placement', 'rendement'])) {
    return (
      "Pour investir utilement, j'ai surtout besoin du montant, de l'horizon et de votre tolérance au risque. Donnez-les-moi en une phrase naturelle et je vous oriente."
    );
  }

  if (matchesAny(normalized, ['credit', 'pret', 'mensualite'])) {
    return (
      "Avant de prendre un crédit, regardez surtout la mensualité supportable, le coût total et la marge de sécurité qui reste après vos charges fixes."
    );
  }

  return (
    "Je peux vous aider sur l'épargne, le budget, le crédit, la retraite et les bases de l'investissement. Donnez-moi simplement votre objectif, les montants en jeu et votre horizon."
  );
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
