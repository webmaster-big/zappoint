export const safeReturnPath = (raw: string | null | undefined, fallback: string): string => {
  if (!raw || !raw.startsWith('/')) return fallback;
  for (const character of raw) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127 || character === '\\') return fallback;
  }
  try {
    const url = new URL(raw, window.location.origin);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return url.origin === window.location.origin && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
  } catch {
    return fallback;
  }
};
