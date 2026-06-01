import { Info, HelpCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: ReactNode;
  icon?: 'info' | 'help';
  size?: number;
  widthClass?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  iconClassName?: string;
}

const InfoTooltip = ({
  content,
  icon = 'info',
  size = 14,
  widthClass = 'w-64',
  side = 'top',
  className = '',
  iconClassName = 'text-gray-400 hover:text-gray-600',
}: InfoTooltipProps) => {
  const Icon = icon === 'help' ? HelpCircle : Info;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' }>({
    top: 0,
    left: 0,
    placement: side,
  });

  const requestOpen = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const requestClose = () => {
    setShown(false);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, 150);
  };

  useEffect(() => {
    if (!open) return;

    const compute = () => {
      const t = triggerRef.current;
      const tip = tooltipRef.current;
      if (!t || !tip) return;
      const tr = t.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 8;
      const margin = 8;

      let placement = side;
      if (placement === 'top' && tr.top - th - gap < margin) placement = 'bottom';
      else if (placement === 'bottom' && tr.bottom + th + gap > vh - margin) placement = 'top';
      if (placement === 'left' && tr.left - tw - gap < margin) placement = 'right';
      else if (placement === 'right' && tr.right + tw + gap > vw - margin) placement = 'left';

      let top = 0;
      let left = 0;
      if (placement === 'top') {
        top = tr.top - th - gap;
        left = tr.left + tr.width / 2 - tw / 2;
      } else if (placement === 'bottom') {
        top = tr.bottom + gap;
        left = tr.left + tr.width / 2 - tw / 2;
      } else if (placement === 'left') {
        top = tr.top + tr.height / 2 - th / 2;
        left = tr.left - tw - gap;
      } else {
        top = tr.top + tr.height / 2 - th / 2;
        left = tr.right + gap;
      }

      left = Math.max(margin, Math.min(left, vw - tw - margin));
      top = Math.max(margin, Math.min(top, vh - th - margin));

      setPos({ top, left, placement });
    };

    const id = requestAnimationFrame(() => {
      compute();
      requestAnimationFrame(() => setShown(true));
    });
    const onScroll = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, side]);

  const arrowClass = (() => {
    switch (pos.placement) {
      case 'top':
        return 'left-1/2 -translate-x-1/2 top-full border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900';
      case 'bottom':
        return 'left-1/2 -translate-x-1/2 bottom-full border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900';
      case 'left':
        return 'top-1/2 -translate-y-1/2 left-full border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-gray-900';
      case 'right':
        return 'top-1/2 -translate-y-1/2 right-full border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-gray-900';
    }
  })();

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        aria-label="More info"
        onMouseEnter={requestOpen}
        onMouseLeave={requestClose}
        onFocus={requestOpen}
        onBlur={requestClose}
        onClick={(e) => {
          e.preventDefault();
          if (open) requestClose();
          else requestOpen();
        }}
        className={`inline-flex items-center justify-center cursor-help focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 rounded-full ${iconClassName}`}
      >
        <Icon size={size} />
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 99999,
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.97)',
              transition: 'opacity 150ms ease-out, transform 150ms ease-out',
            }}
            className={`${widthClass} px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl leading-relaxed text-left pointer-events-none`}
          >
            {content}
            <span className={`absolute w-0 h-0 ${arrowClass}`} />
          </div>,
          document.body,
        )}
    </span>
  );
};

export default InfoTooltip;
