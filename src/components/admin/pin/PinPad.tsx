import { useCallback, useEffect, useState } from 'react';
import { Delete } from 'lucide-react';

interface PinPadProps {
  length: number;
  onSubmit: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const PinPad: React.FC<PinPadProps> = ({ length, onSubmit, busy = false, error, onClearError }) => {
  const [pin, setPin] = useState('');

  const press = useCallback(
    (digit: string) => {
      if (busy) return;
      onClearError?.();
      setPin((current) => (current.length >= length ? current : current + digit));
    },
    [busy, length, onClearError]
  );

  const back = useCallback(() => {
    if (busy) return;
    onClearError?.();
    setPin((current) => current.slice(0, -1));
  }, [busy, onClearError]);

  useEffect(() => {
    if (pin.length === length && !busy) {
      onSubmit(pin);
      setPin('');
    }
  }, [pin, length, busy, onSubmit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        press(event.key);
      } else if (event.key === 'Backspace') {
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, back]);

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-center gap-3">
        {Array.from({ length }).map((_, index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              index < pin.length ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 text-center text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            disabled={busy}
            className="rounded-xl bg-gray-100 py-4 text-2xl font-semibold text-gray-900 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
          >
            {key}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => press('0')}
          disabled={busy}
          className="rounded-xl bg-gray-100 py-4 text-2xl font-semibold text-gray-900 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={back}
          disabled={busy}
          aria-label="Delete last digit"
          className="flex items-center justify-center rounded-xl bg-gray-100 py-4 text-gray-700 transition-colors hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default PinPad;
