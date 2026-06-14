const LOCAL_API_BASE = 'http://127.0.0.1:8000';

function normalizeBase(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function isLoopbackApiBase(value) {
  return /:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizeBase(value));
}

export function hasConfiguredApiBase() {
  return Boolean(normalizeBase(import.meta.env.VITE_SIKA_API_BASE));
}

export function isRunningLocally() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function isStaticMode() {
  const configuredBase = normalizeBase(import.meta.env.VITE_SIKA_API_BASE);

  if (!configuredBase) {
    return !isRunningLocally();
  }

  return !isRunningLocally() && isLoopbackApiBase(configuredBase);
}

export function getApiBase() {
  const configuredBase = normalizeBase(import.meta.env.VITE_SIKA_API_BASE);
  if (configuredBase) {
    if (!isRunningLocally() && isLoopbackApiBase(configuredBase)) {
      return '';
    }

    return configuredBase;
  }

  if (isRunningLocally()) {
    return LOCAL_API_BASE;
  }

  return '';
}
