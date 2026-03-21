export function openExternalUrl(url) {
  const externalWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (externalWindow) {
    externalWindow.opener = null;
  }
}
