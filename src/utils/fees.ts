// Applied Fees utilities for booking fee snapshots

import type { FeeBreakdown } from '../types/FeeSupport.types';

/**
 * Represents a fee snapshot stored on a booking record.
 * Captures the exact fees applied at the time of booking.
 */
export interface AppliedFee {
  fee_name: string;
  fee_amount: number;
  fee_application_type: 'additive' | 'inclusive';
}

/**
 * Build an applied_fees array from the fee breakdown returned by the fee support API.
 * This creates a snapshot of the fees at the time of booking.
 */
export function buildAppliedFees(feeBreakdown: FeeBreakdown | null): AppliedFee[] {
  if (!feeBreakdown || !feeBreakdown.fees || feeBreakdown.fees.length === 0) {
    return [];
  }

  return feeBreakdown.fees.map((fee) => ({
    fee_name: fee.fee_name,
    fee_amount: fee.fee_amount,
    fee_application_type: fee.fee_application_type,
  }));
}

/**
 * Calculate the total of additive fees only.
 * Inclusive fees are already part of the base price and should NOT be added.
 */
export function getAdditiveFeeTotal(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees
    .filter(f => f.fee_application_type === 'additive')
    .reduce((sum, f) => sum + f.fee_amount, 0);
}

/**
 * Calculate the total of inclusive fees (for display breakdown purposes).
 */
export function getInclusiveFeeTotal(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees
    .filter(f => f.fee_application_type === 'inclusive')
    .reduce((sum, f) => sum + f.fee_amount, 0);
}

/**
 * Get the total fee amount (additive + inclusive).
 */
export function getTotalFeeAmount(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees.reduce((sum, f) => sum + f.fee_amount, 0);
}

/**
 * Format applied fees for display as a comma-separated string.
 */
export function formatAppliedFees(appliedFees: AppliedFee[] | null): string {
  if (!appliedFees || appliedFees.length === 0) return 'None';
  return appliedFees
    .map(f => `${f.fee_name}: $${f.fee_amount.toFixed(2)} (${f.fee_application_type})`)
    .join(', ');
}
