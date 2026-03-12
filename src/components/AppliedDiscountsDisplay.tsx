// Reusable component for displaying applied discounts on bookings/purchases

import type { AppliedDiscount } from '../utils/discounts';

interface AppliedDiscountsDisplayProps {
  appliedDiscounts: AppliedDiscount[] | null;
  compact?: boolean;
  className?: string;
}

export function AppliedDiscountsDisplay({ appliedDiscounts, compact = false, className = '' }: AppliedDiscountsDisplayProps) {
  if (!appliedDiscounts || appliedDiscounts.length === 0) return null;

  if (compact) {
    return (
      <span
        className={`text-xs text-green-600 cursor-help ${className}`}
        title={appliedDiscounts
          .map(d => `${d.discount_name}: -$${d.discount_amount.toFixed(2)} (${d.discount_type})`)
          .join('\n')}
      >
        ({appliedDiscounts.length} discount{appliedDiscounts.length !== 1 ? 's' : ''})
      </span>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-sm font-medium text-gray-700">Applied Discounts</p>
      {appliedDiscounts.map((discount, idx) => (
        <div key={idx} className="flex justify-between text-sm">
          <span className="text-gray-600">
            {discount.discount_name}
            <span className="ml-1 text-xs text-gray-400">({discount.discount_type})</span>
          </span>
          <span className="text-green-600">
            -${discount.discount_amount.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default AppliedDiscountsDisplay;
