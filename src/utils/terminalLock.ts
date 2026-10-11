import { getStoredTerminal } from './staffTerminal';

type Listener = (locked: boolean) => void;

const SHARED_LOCK_KEY = 'zapzone_terminal_locked';
const SHARED_IDLE_KEY = 'zapzone_terminal_idle';

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

let locked = readStorage(SHARED_LOCK_KEY) !== null && getStoredTerminal() !== null;
const listeners = new Set<Listener>();

export const isTerminalLocked = (): boolean => locked;

export const setTerminalLocked = (next: boolean): void => {
  if (locked === next) return;
  locked = next;
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      /* a bad listener must never wedge the lock */
    }
  });
};

export const subscribeTerminalLock = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const shareTerminalLock = (next: boolean): void => {
  try {
    if (next) {
      localStorage.setItem(SHARED_LOCK_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(SHARED_LOCK_KEY);
    }
  } catch {
    return;
  }
};

export const isTerminalLockShared = (): boolean => readStorage(SHARED_LOCK_KEY) !== null;

export const subscribeSharedTerminalLock = (listener: Listener): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SHARED_LOCK_KEY) {
      listener(event.newValue !== null);
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
};

export const shareTerminalIdle = (seconds: number | null): void => {
  try {
    localStorage.setItem(SHARED_IDLE_KEY, JSON.stringify(seconds));
  } catch {
    return;
  }
};

export const sharedTerminalIdle = (): number | null | undefined => {
  const raw = readStorage(SHARED_IDLE_KEY);
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'number' && value > 0 ? value : null;
  } catch {
    return undefined;
  }
};

export const clearSharedTerminalState = (): void => {
  try {
    localStorage.removeItem(SHARED_LOCK_KEY);
    localStorage.removeItem(SHARED_IDLE_KEY);
  } catch {
    return;
  }
};
