import React from 'react';
import { membershipStatusBadgeClass, membershipStatusLabel } from '../../utils/membershipFormat';

type BadgeSize = 'sm' | 'md';

interface MembershipStatusBadgeProps {
  status: string;
  size?: BadgeSize;
  className?: string;
}

const MembershipStatusBadge: React.FC<MembershipStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : 'px-4 py-2 text-sm';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${membershipStatusBadgeClass(status)} ${className}`}
    >
      {membershipStatusLabel(status)}
    </span>
  );
};

export default MembershipStatusBadge;
