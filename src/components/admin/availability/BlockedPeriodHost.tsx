import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import BlockedPeriodList from './BlockedPeriodList';
import { registerBlockedPeriodHandler, type BlockedPeriodWarning } from '../../../utils/blockedPeriodPrompt';
import { getStoredUser } from '../../../utils/storage';

interface PendingPrompt {
  warning: BlockedPeriodWarning;
  resolve: (confirmed: boolean) => void;
}

const periodIds = (warning: BlockedPeriodWarning): number[] =>
  warning.periods.map(period => Number(period.id)).filter(id => Number.isFinite(id));

const coveredBy = (warning: BlockedPeriodWarning, answered: BlockedPeriodWarning): boolean => {
  const ids = periodIds(warning);
  const answeredIds = periodIds(answered);
  return ids.length > 0 && ids.every(id => answeredIds.includes(id));
};

const BlockedPeriodHost: React.FC = () => {
  const [queue, setQueue] = useState<PendingPrompt[]>([]);
  const [armed, setArmed] = useState(false);
  const queueRef = useRef<PendingPrompt[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const goBackRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const current = queue[0] ?? null;

  useEffect(() => {
    const unregister = registerBlockedPeriodHandler(
      warning =>
        new Promise<boolean>(resolve => {
          if (queueRef.current.length === 0 && document.activeElement instanceof HTMLElement) {
            returnFocusRef.current = document.activeElement;
          }
          queueRef.current = [...queueRef.current, { warning, resolve }];
          setQueue(queueRef.current);
        })
    );

    return () => {
      unregister();
      queueRef.current.forEach(prompt => prompt.resolve(false));
      queueRef.current = [];
      setQueue([]);
    };
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const [first, ...others] = queueRef.current;
    if (!first) return;
    const sameBlocks = others.filter(prompt => coveredBy(prompt.warning, first.warning));
    const rest = others.filter(prompt => !sameBlocks.includes(prompt));
    queueRef.current = rest;
    setQueue(rest);
    first.resolve(confirmed);
    sameBlocks.forEach(prompt => prompt.resolve(confirmed));
    if (rest.length === 0) {
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      window.setTimeout(() => {
        if (target && document.contains(target)) target.focus();
      }, 0);
    }
  }, []);

  useEffect(() => {
    setArmed(false);
    if (!current) return;
    const timer = window.setTimeout(() => setArmed(true), 400);
    return () => window.clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    goBackRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        settle(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [current, settle]);

  if (!current) return null;

  const { warning } = current;
  const showLocation = getStoredUser()?.role === 'company_admin';
  const alsoAnswers = queue.slice(1).filter(prompt => coveredBy(prompt.warning, warning)).length;
  const stillWaiting = queue.length - 1 - alsoAnswers;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="blocked-period-title"
        aria-describedby="blocked-period-help"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h3 id="blocked-period-title" className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              This time is blocked
            </h3>
            <p id="blocked-period-help" className="mt-1 text-xs text-gray-600">
              Guests cannot book it online. You can still book it, for example for the group it was blocked for. Your name is recorded on the block's history.
            </p>
            {alsoAnswers > 0 && (
              <p className="mt-1 text-xs font-medium text-amber-800">Your answer also applies to {alsoAnswers} other save{alsoAnswers === 1 ? '' : 's'} inside the same blocked period.</p>
            )}
            {stillWaiting > 0 && (
              <p className="mt-1 text-xs font-medium text-amber-800">{stillWaiting} more save{stillWaiting === 1 ? '' : 's'} will ask about a different blocked period next.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => settle(false)}
            aria-label="Go back"
            className="ml-3 shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {warning.periods.length > 0 ? (
            <BlockedPeriodList periods={warning.periods} showLocation={showLocation} />
          ) : (
            <p className="text-sm text-gray-700">{warning.message}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end">
          <button
            ref={goBackRef}
            type="button"
            onClick={() => settle(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            disabled={!armed}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Book anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockedPeriodHost;
