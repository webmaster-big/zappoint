import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreVertical } from 'lucide-react';

export interface RegistrationRowMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  hidden?: boolean;
  returnFocus?: boolean;
}

interface RegistrationRowMenuProps {
  label: string;
  items: RegistrationRowMenuItem[];
}

const RegistrationRowMenu = ({ label, items }: RegistrationRowMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visible = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const onDocument = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onDocument);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocument);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div
      className="relative flex-shrink-0"
      ref={ref}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-[200px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                  if (item.returnFocus) triggerRef.current?.focus();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span className="text-left">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RegistrationRowMenu;
