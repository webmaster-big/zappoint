import React from 'react';
import { Info } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import type { FeeBreakdown } from '../../types/FeeSupport.types';

interface PriceBreakdownProps {
  breakdown: FeeBreakdown;
  className?: string;
  compact?: boolean;
}

// Displays a full price breakdown including all applicable fees.
// Works for both packages and attractions.
const PriceBreakdownDisplay: React.FC<PriceBreakdownProps> = ({ breakdown, className = '', compact = false }) => {
  const { themeColor } = useThemeColor();

  if (!breakdown || breakdown.fees.length === 0) return null;

  if (compact) {
    return (
      <div className={`text-xs space-y-0.5 ${className}`}>
        {breakdown.fees.map((fee) => (
          <div key={fee.fee_support_id} className="flex items-center justify-between text-gray-500">
            <span className="flex items-center gap-1">
              {fee.fee_name} ({fee.fee_label})
              {fee.fee_application_type === 'inclusive' && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">Included</span>
              )}
            </span>
            <span>{fee.fee_application_type === 'additive' ? '+' : ''}${fee.fee_amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-gray-50 p-3 space-y-2 ${className}`}>
      {/* Base Price */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">Base Price</span>
        <span className="font-medium text-gray-900">${breakdown.displayed_base_price.toFixed(2)}</span>
      </div>

      {/* Fee Items */}
      {breakdown.fees.map((fee) => (
        <div key={fee.fee_support_id} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-600">
            {fee.fee_name}
            <span className="text-xs text-gray-400">({fee.fee_label})</span>
            {fee.fee_application_type === 'inclusive' && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-${themeColor}-50 text-${themeColor}-600`}>
                <Info className="w-2.5 h-2.5" />
                Included
              </span>
            )}
          </span>
          <span className="text-gray-700">
            {fee.fee_application_type === 'additive' ? '+ ' : ''}${fee.fee_amount.toFixed(2)}
          </span>
        </div>
      ))}

      {/* Divider */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-base font-bold text-gray-900">${breakdown.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default PriceBreakdownDisplay;
