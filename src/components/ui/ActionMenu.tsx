import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hidden?: boolean;
  /** Optional divider rendered above this item. */
  dividerBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  label?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  className?: string;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  label = 'More',
  icon: TriggerIcon = MoreHorizontal,
  size = 'md',
  align = 'right',
  className = '',
}) => {
  const { themeColor } = useThemeColor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleItems = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center justify-center font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${themeColor}-500 ${sizeClasses}`}
      >
        <TriggerIcon className={`${iconSize} ${label ? 'mr-2' : ''}`} />
        {label}
        <ChevronDown className={`${iconSize} ml-1.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 min-w-[200px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={`${item.label}-${idx}`}>
                {item.dividerBefore && idx > 0 && <div className="my-1 h-px bg-gray-100" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                  <span className="text-left">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionMenu;
