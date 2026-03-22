import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Bot, ExternalLink, Globe2, Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  MAX_CONTEXT_MESSAGES,
  REQUEST_TIMEOUT_MS,
  appendMessage,
  getOrCreateUserId,
  requestAssistantReply,
  welcomeByLanguage,
} from '@/lib/assistant';
import { getApiBase } from '@/lib/api';

const API_BASE = getApiBase();
const SPEECH_LANGUAGE_MAP = {
  fr: 'fr-FR',
  fon: 'fr-FR',
  mina: 'fr-FR',
};

const AssistantConsole = ({ variant = 'page', showFullscreenLink = false }) => {
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastSpokenMessageIdRef = useRef(null);
  const shouldSpeakNextReplyRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceInputSupported, setIsVoiceInputSupported] = useState(false);
  const [isVoiceOutputSupported, setIsVoiceOutputSupported] = useState(false);
  const [isVoicePlaybackEnabled, setIsVoicePlaybackEnabled] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [messages, setMessages] = useState([
    {
      id: 'welcome-fr',
      role: 'assistant',
      content: welcomeByLanguage.fr,
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const userId = getOrCreateUserId(
    variant === 'page' ? 'sika_assistant_page_user_id' : 'sika_web_user_id'
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsVoiceInputSupported(typeof Recognition === 'function');
    setIsVoiceOutputSupported('speechSynthesis' in window);

    return () => {
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (!isVoiceOutputSupported) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return;
    }

    if (lastSpokenMessageIdRef.current === lastMessage.id) {
      return;
    }

    if (!isVoicePlaybackEnabled && !shouldSpeakNextReplyRef.current) {
      return;
    }

    speakAssistantReply(lastMessage.content, language);
    lastSpokenMessageIdRef.current = lastMessage.id;
    shouldSpeakNextReplyRef.current = false;
  }, [messages, language, isVoiceOutputSupported, isVoicePlaybackEnabled]);

  const handleLanguageChange = (event) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    setMessages((prev) =>
      appendMessage(prev, {
        id: `${Date.now()}-${nextLanguage}`,
        role: 'assistant',
        content: welcomeByLanguage[nextLanguage] || welcomeByLanguage.fr,
      })
    );
  };

  const speakAssistantReply = (text, currentLanguage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const cleanedText = String(text || '').trim();
    if (!cleanedText) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = SPEECH_LANGUAGE_MAP[currentLanguage] || 'fr-FR';
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (rawMessage, options = {}) => {
    const message = rawMessage.trim();
    if (!message || isLoading) {
      return;
    }

    if (options.fromVoice && isVoiceOutputSupported) {
      shouldSpeakNextReplyRef.current = true;
      setIsVoicePlaybackEnabled(true);
    }

    const history = messages.slice(-MAX_CONTEXT_MESSAGES).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    setMessages((prev) =>
      appendMessage(prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
      })
    );
    setInputValue('');
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const reply = await requestAssistantReply({
        apiBase: API_BASE,
        message,
        language,
        userId,
        history,
        signal: controller.signal,
      });

      setIsLocalMode(reply.source === 'local');
      setIsDemoMode(reply.source === 'demo');
      setMessages((prev) =>
        appendMessage(prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply.answer,
          source: reply.source,
        })
      );
    } catch (error) {
      setIsLocalMode(false);
      setIsDemoMode(false);
      setMessages((prev) =>
        appendMessage(prev, {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error.message || "Une erreur s'est produite.",
        })
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    await sendMessage(inputValue);
  };

  const handleVoiceInput = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition !== 'function') {
      setMessages((prev) =>
        appendMessage(prev, {
          id: `voice-unavailable-${Date.now()}`,
          role: 'assistant',
          content:
            "La dictée vocale dépend du navigateur. Elle fonctionne surtout dans Chrome ou Edge récents.",
        })
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = SPEECH_LANGUAGE_MAP[language] || 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const message =
        event.error === 'not-allowed'
          ? "Le navigateur a refusé l'accès au micro. Autorisez le micro puis réessayez."
          : "La dictée vocale n'a pas abouti. Réessayez dans un endroit plus calme.";

      setMessages((prev) =>
        appendMessage(prev, {
          id: `voice-error-${Date.now()}`,
          role: 'assistant',
          content: message,
        })
      );
    };

    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();

      if (!transcript) {
        return;
      }

      setInputValue(transcript);
      await sendMessage(transcript, { fromVoice: true });
    };

    recognition.start();
  };

  const toggleVoicePlayback = () => {
    if (!isVoiceOutputSupported) {
      setMessages((prev) =>
        appendMessage(prev, {
          id: `voice-output-unavailable-${Date.now()}`,
          role: 'assistant',
          content:
            "La lecture vocale dépend du navigateur. Si elle est absente ici, essayez Chrome, Edge ou Safari récent.",
        })
      );
      return;
    }

    setIsVoicePlaybackEnabled((prev) => {
      const nextValue = !prev;
      if (!nextValue) {
        window.speechSynthesis?.cancel?.();
      } else {
        lastSpokenMessageIdRef.current = messages[messages.length - 1]?.id || null;
      }
      return nextValue;
    });
  };

  const panelClassName =
    variant === 'page'
      ? 'flex min-h-[70vh] flex-col overflow-hidden rounded-[32px] border border-white/15 bg-slate-950/70 shadow-[0_30px_90px_rgba(2,10,18,0.35)]'
      : 'flex h-[620px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[26px] border border-white/15 bg-slate-950/90 shadow-2xl backdrop-blur-xl';

  const messageAreaClassName =
    variant === 'page'
      ? 'flex-1 overflow-y-auto px-6 py-6'
      : 'flex-1 overflow-y-auto px-4 py-4';

  return (
    <section className={panelClassName}>
      <header className="border-b border-white/10 bg-gradient-to-br from-cyan-400/10 via-transparent to-gold-400/10 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gold-400/15 p-2 text-gold-300">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">SIKA</h3>
              <p className="text-sm leading-5 text-white/65">
                Assistant financier intelligent
              </p>
            </div>
          </div>

          {showFullscreenLink && (
            <Link
              to="/assistant"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/25 hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Plein &eacute;cran
            </Link>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/45">
            <Globe2 className="h-3.5 w-3.5" />
            Langue
          </label>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-gold-400"
          >
            <option value="fr" className="text-slate-900">
              Fran&ccedil;ais
            </option>
            <option value="fon" className="text-slate-900">
              Fon
            </option>
            <option value="mina" className="text-slate-900">
              Mina
            </option>
          </select>
        </div>

        {isLocalMode && (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
            Mode local actif. En environnement local, SIKA utilise un moteur de secours si
            l&apos;API n&apos;est pas joignable.
          </div>
        )}

        {isDemoMode && !isLocalMode && (
          <div className="mt-4 rounded-2xl border border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-amber-50">
            Mode gratuit actif. SIKA répond ici avec un moteur pédagogique intégré, sans
            OpenAI, tout en conservant les calculateurs et les données marché du site.
          </div>
        )}
      </header>

      <div className={messageAreaClassName}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'assistant'
                    ? 'border border-white/10 bg-white/5 text-white/90'
                    : 'border border-cyan-100/70 bg-cyan-300 text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.22)]'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200">
                SIKA r&eacute;fl&eacute;chit...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="border-t border-white/10 bg-black/15 p-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/45">
          <span>Informations &eacute;ducatives, pas de promesse de rendement.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-white/55 transition hover:text-white/80"
              onClick={handleVoiceInput}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {isListening ? 'Écoute...' : 'Dicter'}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-white/55 transition hover:text-white/80"
              onClick={toggleVoicePlayback}
            >
              {isVoicePlaybackEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              {isVoicePlaybackEnabled ? 'Lecture activée' : 'Lecture vocale'}
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            rows={variant === 'page' ? 3 : 2}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Exemple : comment commencer &agrave; &eacute;pargner avec 25 000 XOF par mois ?"
            className="min-h-[56px] flex-1 resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-gold-400 focus:outline-none"
          />

          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="h-14 w-14 rounded-2xl bg-gradient-to-r from-gold-400 to-yellow-500 text-slate-950 hover:from-gold-500 hover:to-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </section>
  );
};

AssistantConsole.propTypes = {
  variant: PropTypes.oneOf(['page', 'widget']),
  showFullscreenLink: PropTypes.bool,
};

export default AssistantConsole;
