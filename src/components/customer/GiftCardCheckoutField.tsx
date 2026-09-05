import { useState } from 'react';
import { Gift, X } from 'lucide-react';
import giftCardService from '../../services/GiftCardService';

export interface AppliedGiftCard {
  code: string;
  discount_amount: number;
}

interface Props {
  locationId: number | null | undefined;
  items: { type: 'package' | 'attraction' | 'event'; id: number }[];
  subtotal: number;
  applied: AppliedGiftCard | null;
  onApplied: (value: AppliedGiftCard | null) => void;
  disabled?: boolean;
}

const GiftCardCheckoutField = ({ locationId, items, subtotal, applied, onApplied, disabled }: Props) => {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    const value = code.trim();
    if (!value || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await giftCardService.validateCode(value, {
        location_id: locationId ?? undefined,
        subtotal: Math.max(0, subtotal),
        items,
      });
      if (res.success && res.data.is_valid) {
        onApplied({ code: value.toUpperCase(), discount_amount: Number(res.data.discount_amount || 0) });
        setCode('');
      } else {
        onApplied(null);
        setError(res.message || 'That gift card is not valid for this order.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      onApplied(null);
      setError(
        err.response?.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : err.response?.data?.message || 'Could not check that code. Please try again.',
      );
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Gift size={15} className="text-emerald-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800 truncate">Gift card {applied.code}</p>
            <p className="text-xs text-emerald-700">
              −${Math.min(applied.discount_amount, Math.max(0, subtotal)).toFixed(2)} applied at checkout
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onApplied(null)}
          className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-100 transition flex-shrink-0"
          aria-label="Remove gift card"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          disabled={disabled || checking}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Gift card code"
          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono tracking-wide"
        />
        <button
          type="button"
          onClick={apply}
          disabled={disabled || checking || !code.trim()}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
        >
          {checking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
};

export default GiftCardCheckoutField;
