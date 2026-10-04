export const newCheckoutKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
