import { useThemeColor } from '../../hooks/useThemeColor';

export interface CategoryTabOption {
  value: string;
  label: string;
  count: number;
}

interface CategoryTabsProps {
  options: CategoryTabOption[];
  value: string;
  onChange: (value: string) => void;
  totalCount: number;
  allLabel?: string;
  label?: string;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  options,
  value,
  onChange,
  totalCount,
  allLabel = 'All',
  label = 'Category',
}) => {
  const { fullColor } = useThemeColor();

  if (options.length === 0) return null;

  const tabs: CategoryTabOption[] = [{ value: 'all', label: allLabel, count: totalCount }, ...options];

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="hidden sm:inline text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 w-max pb-1">
          {tabs.map(tab => {
            const isActive = tab.value === value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onChange(tab.value)}
                aria-pressed={isActive}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap capitalize transition-colors ${
                  isActive
                    ? `bg-${fullColor} text-white shadow-sm`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 font-normal ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryTabs;
