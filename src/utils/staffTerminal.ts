import { getDeviceId } from './deviceId';

const TERMINAL_KEY = 'zapzone_terminal';

export interface StoredTerminal {
  deviceId: string;
  token: string;
  label: string;
  locationId: number | null;
}

export const getStoredTerminal = (): StoredTerminal | null => {
  try {
    const raw = localStorage.getItem(TERMINAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTerminal;
    if (!parsed?.token || !parsed?.deviceId) return null;
    if (parsed.deviceId !== getDeviceId()) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setStoredTerminal = (terminal: StoredTerminal): void => {
  try {
    localStorage.setItem(TERMINAL_KEY, JSON.stringify(terminal));
  } catch {
    /* private browsing or full storage: the device simply stays unenrolled */
  }
};

export const clearStoredTerminal = (): void => {
  try {
    localStorage.removeItem(TERMINAL_KEY);
  } catch {
    /* ignore */
  }
};

export const isSharedTerminal = (): boolean => getStoredTerminal() !== null;

export const terminalHeaders = (): Record<string, string> => {
  const terminal = getStoredTerminal();
  return terminal ? { 'X-Staff-Terminal': terminal.token } : {};
};
