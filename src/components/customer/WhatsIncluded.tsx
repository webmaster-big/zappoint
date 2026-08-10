import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export type WhatsIncludedTone = 'inclusions' | 'details';

interface WhatsIncludedProps {
  items: string[];
  tone?: WhatsIncludedTone;
  title?: string;
  maxVisible?: number;
  className?: string;
}

const TONES = {
  inclusions: {
    title: "What's Included",
    box: 'border-blue-100 bg-blue-50/60',
    label: 'text-blue-800',
    action: 'text-blue-700 active:text-blue-900',
  },
  details: {
    title: 'Details',
    box: 'border-gray-200 bg-gray-50',
    label: 'text-gray-600',
    action: 'text-gray-700 active:text-gray-900',
  },
} as const;

const WhatsIncluded = ({
  items,
  tone = 'inclusions',
  title,
  maxVisible = 4,
  className = '',
}: WhatsIncludedProps) => {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const style = TONES[tone];
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hiddenCount = items.length - visible.length;

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${style.box} ${className}`}>
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${style.label}`}>
        {title ?? style.title}
      </p>
      <ul className="space-y-1.5">
        {visible.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-gray-700">
            {tone === 'inclusions' ? (
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
            ) : (
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
            )}
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${style.action}`}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default WhatsIncluded;
