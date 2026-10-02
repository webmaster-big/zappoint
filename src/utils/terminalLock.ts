type Listener = (locked: boolean) => void;

let locked = false;
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
