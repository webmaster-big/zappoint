
import type { FeeBreakdown } from '../types/FeeSupport.types';

export interface AppliedFee {
  fee_name: string;
  fee_amount: number;
  fee_application_type: 'additive' | 'inclusive';
}

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

export function getAdditiveFeeTotal(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees
    .filter(f => f.fee_application_type === 'additive')
    .reduce((sum, f) => sum + f.fee_amount, 0);
}

export function getInclusiveFeeTotal(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees
    .filter(f => f.fee_application_type === 'inclusive')
    .reduce((sum, f) => sum + f.fee_amount, 0);
}

export function getTotalFeeAmount(appliedFees: AppliedFee[] | null): number {
  if (!appliedFees) return 0;
  return appliedFees.reduce((sum, f) => sum + f.fee_amount, 0);
}

export function formatAppliedFees(appliedFees: AppliedFee[] | null): string {
  if (!appliedFees || appliedFees.length === 0) return 'None';
  return appliedFees
    .map(f => `${f.fee_name}: $${f.fee_amount.toFixed(2)} (${f.fee_application_type})`)
    .join(', ');
}
