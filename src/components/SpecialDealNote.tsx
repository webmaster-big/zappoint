import { Tag } from 'lucide-react';
import type { SpecialDeal } from '../types/SpecialPricing.types';
import { specialDealHeadline } from '../utils/discounts';

interface SpecialDealNoteProps {
  deals: SpecialDeal[];
  selectedDate?: string | null;
  applied: boolean;
  unit?: 'ticket' | 'person' | 'booking';
  checkFailed?: boolean;
  onRetry?: () => void;
  className?: string;
}

const SpecialDealNote = ({ deals, selectedDate, applied, unit = 'ticket', checkFailed = false, onRetry, className = '' }: SpecialDealNoteProps) => {
  if (deals.length === 0) return null;

  return (
    <div className={`rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ${className}`}>
      {deals.map((deal) => (
        <p key={deal.special_pricing_id} className="flex items-start gap-2">
          <Tag className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
          <span>
            <span className="font-semibold">{deal.name}:</span> {specialDealHeadline(deal, unit)}.
          </span>
        </p>
      ))}
      {checkFailed ? (
        <p className="mt-1 pl-6 text-xs font-medium text-amber-800">
          We couldn't check the special price for this visit.
          {onRetry && (
            <button type="button" onClick={onRetry} className="ml-1 font-semibold underline">
              Try again
            </button>
          )}
        </p>
      ) : (
        <p className="mt-1 pl-6 text-xs text-emerald-800">
          {applied
            ? 'Your visit date gets the special price.'
            : selectedDate
              ? 'The special is based on the day you visit, not the day you buy. Pick a special day to save.'
              : 'The special is based on the day you visit, not the day you buy — pick a special day to save.'}
        </p>
      )}
    </div>
  );
};

export default SpecialDealNote;
