(function () {
  const script =
    document.currentScript ||
    Array.from(document.scripts).find((item) =>
      item.src.includes('sika-chatbot.js')
    );

  if (!script) {
    return;
  }

  const scriptUrl = new URL(script.src, window.location.href);
  const assetBase = new URL('./', scriptUrl).href;
  const apiBase = (script.dataset.apiBase || scriptUrl.origin).replace(/\/$/, '');
  const defaultLanguage = script.dataset.defaultLanguage || 'fr';
  const title = script.dataset.title || 'SIKA';
  const requestTimeoutMs = 15000;
  const maxHistoryMessages = 50;
  const maxContextMessages = 16;
  const welcomeByLang = {
    fr: 'Bonjour. Je suis SIKA, votre assistant financier. Posez votre question en toute simplicit\u00e9.',
    fon: 'Bonjour. SIKA wa bo hlan. Bi question to we.',
    mina: 'Bonjour. Nye SIKA. Bi finance nya me nyuie na miagblon.',
  };

  initializeWhenReady();

  function initializeWhenReady() {
    if (document.getElementById('sika-chatbot-root')) {
      return;
    }

    if (document.body) {
      initialize();
      return;
    }

    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  }

  function initialize() {
    if (document.getElementById('sika-chatbot-root')) {
      return;
    }

    injectStylesheet();

    const state = {
      isOpen: false,
      isLoading: false,
      language: defaultLanguage,
      history: [],
      userId: loadOrCreateUserId(),
    };

    const root = document.createElement('div');
    root.id = 'sika-chatbot-root';
    document.body.appendChild(root);

    const launcher = document.createElement('button');
    launcher.className = 'sika-chatbot-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Ouvrir le chatbot SIKA');
    launcher.textContent = 'SI';

    const panel = document.createElement('section');
    panel.className = 'sika-chatbot-panel sika-hidden';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `
      <header class="sika-chatbot-header">
        <div class="sika-chatbot-topline">
          <div>
            <h2 class="sika-chatbot-title">${escapeHtml(title)}</h2>
            <p class="sika-chatbot-subtitle">Assistant financier texte. Voix et donn&eacute;es avanc&eacute;es en phase 2.</p>
          </div>
          <select class="sika-chatbot-lang" aria-label="Choisir la langue">
            <option value="fr">FR</option>
            <option value="fon">Fon</option>
            <option value="mina">Mina</option>
          </select>
        </div>
      </header>
      <div class="sika-chatbot-messages"></div>
      <div class="sika-chatbot-status"></div>
      <form class="sika-chatbot-composer">
        <textarea class="sika-chatbot-input" placeholder="Exemple : comment commencer &agrave; &eacute;pargner avec 25 000 XOF par mois ?" rows="2"></textarea>
        <button class="sika-chatbot-action sika-chatbot-action-mic" type="button" title="Le micro sera activ&eacute; en phase 2">Mic</button>
        <button class="sika-chatbot-action sika-chatbot-action-send" type="submit">Envoyer</button>
      </form>
      <div class="sika-chatbot-footnote">SIKA donne des informations &eacute;ducatives. Pour un conseil engageant, pr&eacute;voyez une validation humaine.</div>
    `;

    root.appendChild(panel);
    root.appendChild(launcher);

    const languageSelect = panel.querySelector('.sika-chatbot-lang');
    const messagesEl = panel.querySelector('.sika-chatbot-messages');
    const statusEl = panel.querySelector('.sika-chatbot-status');
    const inputEl = panel.querySelector('.sika-chatbot-input');
    const formEl = panel.querySelector('.sika-chatbot-composer');
    const micButton = panel.querySelector('.sika-chatbot-action-mic');

    languageSelect.value = state.language;
    addMessage('assistant', welcomeByLang[state.language] || welcomeByLang.fr);

    launcher.addEventListener('click', function () {
      state.isOpen = !state.isOpen;
      panel.classList.toggle('sika-hidden', !state.isOpen);
      if (state.isOpen) {
        inputEl.focus();
      }
    });

    languageSelect.addEventListener('change', function (event) {
      state.language = event.target.value;
      addMessage(
        'assistant',
        welcomeByLang[state.language] || welcomeByLang.fr
      );
    });

    micButton.addEventListener('click', function () {
      addMessage(
        'assistant',
        "Le micro sera activ\u00e9 dans la prochaine phase. Pour l'instant, \u00e9crivez votre question."
      );
    });

    formEl.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (state.isLoading) {
        return;
      }

      const message = inputEl.value.trim();
      if (!message) {
        return;
      }

      inputEl.value = '';
      addMessage('user', message);
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(function () {
        controller.abort();
      }, requestTimeoutMs);

      try {
        const response = await fetch(`${apiBase}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            message,
            language: state.language,
            user_id: state.userId,
            history: state.history.slice(-maxContextMessages),
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur API');
        }

        const data = await response.json();
        addMessage('assistant', data.answer);
      } catch (error) {
        addMessage(
          'assistant',
          error.name === 'AbortError'
            ? 'SIKA met trop de temps \u00e0 r\u00e9pondre. Merci de r\u00e9essayer dans quelques secondes.'
            : "Je n'arrive pas \u00e0 joindre l'API SIKA pour le moment. V\u00e9rifiez l'URL du backend et la configuration CORS."
        );
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    });

    function addMessage(role, content) {
      const bubble = document.createElement('article');
      bubble.className = `sika-chatbot-bubble sika-chatbot-bubble-${role}`;
      bubble.textContent = content;
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      state.history.push({ role, content });
      state.history = state.history.slice(-maxHistoryMessages);
    }

    function setLoading(active) {
      state.isLoading = active;
      statusEl.textContent = active ? 'SIKA r\u00e9fl\u00e9chit...' : '';
    }
  }

  function loadOrCreateUserId() {
    const key = 'sika_user_id';
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const created = `sika-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(key, created);
    return created;
  }

  function injectStylesheet() {
    if (document.querySelector('link[data-sika-chatbot="true"]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${assetBase}sika-chatbot.css`;
    link.dataset.sikaChatbot = 'true';
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
