// Reusable component for displaying applied fees on bookings

import type { AppliedFee } from '../utils/fees';

interface AppliedFeesDisplayProps {
  appliedFees: AppliedFee[] | null;
  compact?: boolean;  // For table cells / inline usage
  className?: string;
}

export function AppliedFeesDisplay({ appliedFees, compact = false, className = '' }: AppliedFeesDisplayProps) {
  if (!appliedFees || appliedFees.length === 0) return null;

  if (compact) {
    return (
      <span
        className={`text-xs text-gray-400 cursor-help ${className}`}
        title={appliedFees
          .map(f => `${f.fee_name}: $${f.fee_amount.toFixed(2)} (${f.fee_application_type})`)
          .join('\n')}
      >
        ({appliedFees.length} fee{appliedFees.length !== 1 ? 's' : ''})
      </span>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-sm font-medium text-gray-700">Applied Fees</p>
      {appliedFees.map((fee, idx) => (
        <div key={idx} className="flex justify-between text-sm">
          <span className="text-gray-600">
            {fee.fee_name}
            <span className="ml-1 text-xs text-gray-400">({fee.fee_application_type})</span>
          </span>
          <span className={fee.fee_application_type === 'additive' ? 'text-red-600' : 'text-gray-500'}>
            {fee.fee_application_type === 'additive' ? '+' : ''}${fee.fee_amount.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default AppliedFeesDisplay;
