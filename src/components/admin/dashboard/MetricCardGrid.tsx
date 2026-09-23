import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import CounterAnimation from '../../ui/CounterAnimation';
import InfoTooltip from '../../ui/InfoTooltip';
import type { BreakdownItem } from '../../../services/MetricsService';

export interface MetricBreakdownSection {
  title: string;
  items: BreakdownItem[];
  totalLabel?: string;
  formatValue?: (value: number) => string;
  showTotal?: boolean;
}

export interface MetricCardDef {
  key: string;
  title: string;
  value: string;
  change: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  accent: string;
  explanation?: string;
  sections?: MetricBreakdownSection[];
}

interface MetricCardGridProps {
  cards: MetricCardDef[];
  columns: number;
  loading?: boolean;
}

const GRID_COLUMNS: Record<number, string> = {
  4: 'xl:grid-cols-4',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-6',
  7: 'xl:grid-cols-7',
  8: 'xl:grid-cols-8',
};

const withItems = (sections?: MetricBreakdownSection[]): MetricBreakdownSection[] =>
  (sections ?? []).filter(section => Array.isArray(section.items) && section.items.length > 0);

const PANEL_WIDTH = 256;
const PANEL_MARGIN = 8;

const MetricCardGrid = ({ cards, columns, loading = false }: MetricCardGridProps) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const close = useCallback(() => {
    setExpandedCard(null);
    setPanel(null);
  }, []);

  const positionPanel = useCallback((key: string) => {
    const anchor = cardRefs.current[key];
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - PANEL_MARGIN * 2);

    let left = rect.right - width;
    if (left < PANEL_MARGIN) left = rect.left;
    left = Math.max(PANEL_MARGIN, Math.min(left, vw - width - PANEL_MARGIN));

    const below = vh - rect.bottom - PANEL_MARGIN * 2;
    const above = rect.top - PANEL_MARGIN * 2;
    const openUpwards = below < 200 && above > below;
    const maxHeight = Math.max(160, Math.min(vh * 0.7, openUpwards ? above : below));
    const top = openUpwards ? Math.max(PANEL_MARGIN, rect.top - maxHeight - 4) : rect.bottom + 4;

    setPanel({ top, left, width, maxHeight });
  }, []);

  const toggle = useCallback((key: string) => {
    if (expandedCard === key) {
      close();
      return;
    }
    setExpandedCard(key);
    positionPanel(key);
  }, [expandedCard, close, positionPanel]);

  useEffect(() => {
    if (!expandedCard) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideGrid = gridRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideGrid && !insidePanel) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const reposition = () => positionPanel(expandedCard);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [expandedCard, close, positionPanel]);

  useEffect(() => {
    if (!expandedCard) return;
    const card = cards.find(c => c.key === expandedCard);
    if (!card || withItems(card.sections).length === 0) close();
  }, [cards, expandedCard, close]);

  const columnClass = GRID_COLUMNS[columns] ?? GRID_COLUMNS[6];

  return (
    <div ref={gridRef} className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${columnClass} gap-3`}>
      {cards.map(card => {
        const Icon = card.icon;
        const sections = withItems(card.sections);
        const canExpand = sections.length > 0;
        const isExpanded = expandedCard === card.key;

        return (
          <div key={card.key} className="relative">
            <div
              ref={el => { cardRefs.current[card.key] = el; }}
              role={canExpand ? 'button' : undefined}
              tabIndex={canExpand ? 0 : undefined}
              onClick={() => canExpand && toggle(card.key)}
              onKeyDown={event => {
                if (!canExpand || event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggle(card.key);
                }
              }}
              className={`bg-white rounded-xl border shadow-sm p-3.5 h-full min-h-[116px] flex flex-col transition-all ${
                canExpand ? 'cursor-pointer select-none' : ''
              } ${isExpanded ? 'border-gray-300 shadow-md' : 'border-gray-100 hover:shadow-md'}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className={`p-1.5 rounded-lg shrink-0 ${card.accent}`}>
                  <Icon size={15} />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {canExpand && (
                    <ChevronDown
                      size={13}
                      className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-180 text-gray-500' : ''}`}
                    />
                  )}
                  {card.explanation && (
                    <span onClick={event => event.stopPropagation()}>
                      <InfoTooltip
                        content={card.explanation}
                        size={12}
                        widthClass="w-72"
                        iconClassName="text-gray-300 hover:text-gray-500"
                      />
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] font-semibold text-gray-700 mt-2 leading-tight" title={card.title}>
                {card.title}
              </p>

              {loading ? (
                <div className="animate-pulse space-y-1.5 mt-1.5">
                  <div className="h-6 bg-gray-200 rounded w-14" />
                  <div className="h-2.5 bg-gray-200 rounded w-20" />
                </div>
              ) : (
                <>
                  <CounterAnimation value={card.value} className="text-xl font-bold text-gray-900 leading-tight" />
                  <p className="text-[10px] text-gray-400 leading-snug mt-1">{card.change}</p>
                </>
              )}
            </div>

            {isExpanded && canExpand && panel && typeof document !== 'undefined' && createPortal(
              <div
                ref={panelRef}
                style={{ position: 'fixed', top: panel.top, left: panel.left, width: panel.width, maxHeight: panel.maxHeight, zIndex: 60 }}
                className="bg-white rounded-xl border border-gray-200 shadow-xl p-3 overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">{card.title} Breakdown</span>
                  <button
                    type="button"
                    onClick={close}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Close breakdown"
                  >
                    <X size={12} />
                  </button>
                </div>
                {card.explanation && (
                  <p className="text-[11px] text-gray-500 leading-relaxed mb-2 pb-2 border-b border-gray-100">
                    {card.explanation}
                  </p>
                )}
                {sections.map((section, sectionIndex) => {
                  const format = section.formatValue ?? ((value: number) => value.toLocaleString());
                  const sectionTotal = section.items.reduce((sum, item) => sum + item.count, 0);
                  return (
                    <div
                      key={section.title}
                      className={`space-y-1.5 ${sectionIndex < sections.length - 1 ? 'mb-2 pb-2 border-b border-gray-100' : ''}`}
                    >
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        {section.title}
                      </span>
                      {section.items.map(item => (
                        <div key={`${section.title}-${item.label}`}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 truncate mr-2">{item.label}</span>
                            <span className="text-gray-800 font-medium shrink-0">
                              {format(item.count)} <span className="text-gray-400">({item.percentage}%)</span>
                            </span>
                          </div>
                          {Array.isArray(item.items) && item.items.length > 0 && (
                            <div className="mt-1 ml-2 pl-2 border-l border-gray-100 space-y-1">
                              {item.items.map(sub => (
                                <div key={`${section.title}-${item.label}-${sub.label}`} className="flex items-center justify-between text-[11px]">
                                  <span className="text-gray-500 truncate mr-2">{sub.label}</span>
                                  <span className="text-gray-600 shrink-0">
                                    {format(sub.count)} <span className="text-gray-400">({sub.percentage}%)</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {section.items.length > 1 && section.showTotal !== false && (
                        <div className="pt-1.5 mt-1.5 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
                          <span className="text-gray-700">{section.totalLabel ?? 'Total'}</span>
                          <span className="text-gray-900">{format(sectionTotal)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>,
              document.body,
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MetricCardGrid;
