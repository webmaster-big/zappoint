import type { LucideIcon } from 'lucide-react';
import CounterAnimation from '../../ui/CounterAnimation';

interface RegistrationMetricTileProps {
  icon: LucideIcon;
  label: string;
  value: number | null;
  hint: string;
  accent: string;
}

const RegistrationMetricTile = ({ icon: Icon, label, value, hint, accent }: RegistrationMetricTileProps) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-lg flex-shrink-0 ${accent}`}>
        <Icon size={20} />
      </div>
      <span className="text-sm sm:text-base font-semibold text-gray-800 leading-tight">{label}</span>
    </div>
    <div className="mt-1">
      {value === null ? (
        <span className="text-2xl font-bold text-gray-300">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Not available</span>
        </span>
      ) : (
        <CounterAnimation value={value} className="text-2xl font-bold text-gray-900" />
      )}
    </div>
    <p className="text-xs text-gray-400">{hint}</p>
  </div>
);

export default RegistrationMetricTile;
