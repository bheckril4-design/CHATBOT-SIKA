const LOCAL_API_BASE = 'http://127.0.0.1:8000';

export function getApiBase() {
  const configuredBase = import.meta.env.VITE_SIKA_API_BASE;
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return LOCAL_API_BASE;
  }

  return origin.replace(/\/$/, '');
}
