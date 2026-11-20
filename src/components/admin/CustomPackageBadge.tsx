import { CUSTOM_BADGE_TEXT } from '../../utils/customBooking';

interface CustomPackageBadgeProps {
  size?: 'xs' | 'sm';
  className?: string;
}

const CustomPackageBadge = ({ size = 'xs', className = '' }: CustomPackageBadgeProps) => (
  <span
    className={`inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded font-medium amber-tone bg-amber-100 text-amber-800 ${size === 'sm' ? 'text-xs' : 'text-[11px]'} ${className}`.trim()}
  >
    {CUSTOM_BADGE_TEXT}
  </span>
);

export default CustomPackageBadge;
