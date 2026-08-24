import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

export interface PurchaseInfoFact {
  label: string;
  value: string;
}

export interface PurchaseInfoLine {
  key: string;
  name: string;
  quantity: number;
  when?: string | null;
  amount?: number | null;
  addOns?: { name: string; quantity: number }[];
}

const CollapsibleText = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  const long = text.length > 180;

  return (
    <div>
      <p className={`text-sm text-gray-600 leading-relaxed ${!open && long ? 'line-clamp-3' : ''}`}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-800 hover:text-blue-900"
        >
          {open ? 'See less' : 'See more'}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
    </div>
  );
};

/**
 * What the guest is actually buying, spelled out: the description, what is included,
 * the details that decide whether it suits them, and — for a multi-item order — every
 * line. Long lists stay collapsed so the panel reads as a summary first and a full
 * record second.
 */
const PurchaseInfoPanel = ({
  description,
  bullets = [],
  facts = [],
  lines = [],
  linesTitle = 'Items in this order',
  total,
}: {
  description?: string | null;
  bullets?: string[];
  facts?: PurchaseInfoFact[];
  lines?: PurchaseInfoLine[];
  linesTitle?: string;
  total?: number | null;
}) => {
  const [showAllLines, setShowAllLines] = useState(false);
  const [showAllBullets, setShowAllBullets] = useState(false);

  const visibleLines = showAllLines ? lines : lines.slice(0, 2);
  const visibleBullets = showAllBullets ? bullets : bullets.slice(0, 4);

  const hasAnything = description || bullets.length > 0 || facts.length > 0 || lines.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
      <div className="flex items-center gap-1.5">
        <Info className="h-4 w-4 text-blue-800" />
        <h4 className="text-sm font-bold text-gray-900">What you're purchasing</h4>
      </div>

      {description && <CollapsibleText text={description} />}

      {bullets.length > 0 && (
        <div className="space-y-1.5">
          {visibleBullets.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-xs text-gray-600 leading-relaxed">{item}</span>
            </div>
          ))}
          {bullets.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllBullets(v => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 hover:text-blue-900"
            >
              {showAllBullets ? 'See less' : `See all ${bullets.length} details`}
              {showAllBullets ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      )}

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {facts.map(fact => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">{fact.label}</dt>
              <dd className="text-xs font-semibold text-gray-800 break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {lines.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">{linesTitle}</span>
            <span className="text-[11px] text-gray-500 tabular-nums">{lines.length} item{lines.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {visibleLines.map(line => (
              <div key={line.key} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {line.quantity}× {line.name}
                    </p>
                    {line.when && <p className="text-[11px] text-gray-500">{line.when}</p>}
                    {(line.addOns ?? []).length > 0 && (
                      <p className="text-[11px] text-gray-500">
                        + {(line.addOns ?? []).map(a => `${a.quantity}× ${a.name}`).join(', ')}
                      </p>
                    )}
                  </div>
                  {line.amount != null && (
                    <span className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
                      ${line.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {lines.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllLines(v => !v)}
              className="w-full px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50 border-t border-gray-100 inline-flex items-center justify-center gap-1"
            >
              {showAllLines ? 'See less' : `See all ${lines.length} items`}
              {showAllLines ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {total != null && (
            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between border-t border-gray-100">
              <span className="text-xs font-bold text-gray-900">Order total</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">${total.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchaseInfoPanel;
