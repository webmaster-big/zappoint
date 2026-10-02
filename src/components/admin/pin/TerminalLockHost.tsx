import { useCallback, useEffect, useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import PinPad from './PinPad';
import { useIdleTimer } from '../../../hooks/useIdleTimer';
import { getStoredTerminal, clearStoredTerminal } from '../../../utils/staffTerminal';
import { setTerminalLocked } from '../../../utils/terminalLock';
import { setStoredUser, getStoredUser } from '../../../utils/storage';
import { getTerminalContext, unlockWithPin, lockTerminal } from '../../../services/StaffPinService';
import type { TerminalContext } from '../../../services/StaffPinService';

const DEFAULT_PIN_LENGTH = 6;

const TerminalLockHost: React.FC = () => {
  const [terminal] = useState(() => getStoredTerminal());
  const [context, setContext] = useState<TerminalContext | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleSeconds, setIdleSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!terminal) return;
    let cancelled = false;
    getTerminalContext()
      .then((next) => {
        if (cancelled) return;
        if (!next.registered) {
          clearStoredTerminal();
          return;
        }
        setContext(next);
        setIdleSeconds(next.idle_disabled ? null : next.idle_seconds ?? null);
      })
      .catch(() => {
        /* offline or server down: leave the terminal unlocked rather than stranding the desk */
      });
    return () => {
      cancelled = true;
    };
  }, [terminal]);

  const lock = useCallback(() => {
    if (locked) return;
    setLocked(true);
    setTerminalLocked(true);
    void lockTerminal('idle').catch(() => {
      /* the overlay is up regardless; the token dies on the server or at expiry */
    });
  }, [locked]);

  useIdleTimer({
    seconds: idleSeconds,
    onIdle: lock,
    enabled: Boolean(terminal && context?.registered && !locked),
  });

  const submit = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const session = await unlockWithPin(pin);
      const merged = {
        ...(session.user as Record<string, unknown>),
        role: session.data.effective_role,
        token: session.token,
      };
      setStoredUser(merged, false);
      setIdleSeconds(session.data.idle_disabled ? null : session.data.idle_seconds ?? null);
      setLocked(false);
      setTerminalLocked(false);
      window.dispatchEvent(new Event('zapzone_profile_updated'));
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'That PIN was not recognised.');
    } finally {
      setBusy(false);
    }
  }, []);

  if (!terminal || !context?.registered || !locked) return null;

  const pinLength = context.pin_length ?? DEFAULT_PIN_LENGTH;
  const signedInAs = getStoredUser();

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-gray-900/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Lock className="h-6 w-6 text-gray-700" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{context.label || 'Shared terminal'}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter your PIN to carry on{signedInAs?.first_name ? `. ${signedInAs.first_name}'s work is still open underneath.` : '.'}
          </p>
        </div>

        <PinPad
          length={pinLength}
          onSubmit={submit}
          busy={busy}
          error={error}
          onClearError={() => setError(null)}
        />

        <button
          type="button"
          onClick={() => {
            setTerminalLocked(false);
            try {
              localStorage.removeItem('zapzone_user');
            } catch {
              /* ignore */
            }
            window.location.assign('/admin');
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <LogIn className="h-4 w-4" />
          Sign in with email and password instead
        </button>
      </div>
    </div>
  );
};

export default TerminalLockHost;
