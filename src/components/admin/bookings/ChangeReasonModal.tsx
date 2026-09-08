import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import bookingService from '../../../services/bookingService';

const FALLBACK_PRESETS = [
  'Customer requested a change',
  'Customer requested cancellation',
  'Scheduling conflict',
  'Room or equipment unavailable',
  'Staff booking error corrected',
  'Weather or closure',
  'Customer no-show',
  'Price or discount adjustment',
  'Duplicate booking removed',
];

const MIN_LENGTH = 3;

let cachedPresets: string[] | null = null;

interface ChangeReasonModalProps {
  open: boolean;
  title?: string;
  summary?: string;
  confirmLabel?: string;
  destructive?: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  themeColor?: string;
  fullColor?: string;
}

const ChangeReasonModal: React.FC<ChangeReasonModalProps> = ({
  open,
  title = 'Reason for this change',
  summary,
  confirmLabel = 'Save change',
  destructive = false,
  submitting = false,
  onCancel,
  onConfirm,
  themeColor = 'blue',
  fullColor = 'blue-800',
}) => {
  const [presets, setPresets] = useState<string[]>(cachedPresets ?? FALLBACK_PRESETS);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setDetail('');
    setTouched(false);
    if (cachedPresets) return;
    bookingService
      .getChangeReasonOptions()
      .then(res => {
        const list = res?.data?.presets;
        if (Array.isArray(list) && list.length > 0) {
          cachedPresets = list;
          setPresets(list);
        }
      })
      .catch(() => {
        // Presets are a convenience; the free-text box alone still satisfies the requirement.
      });
  }, [open]);

  useEffect(() => {
    if (open && !selected) inputRef.current?.focus();
  }, [open, selected]);

  const reason = useMemo(() => {
    const extra = detail.trim();
    if (selected && extra) return `${selected} — ${extra}`;
    if (selected) return selected;
    return extra;
  }, [selected, detail]);

  const tooShort = reason.length > 0 && reason.length < MIN_LENGTH;
  const canSubmit = reason.length >= MIN_LENGTH && !submitting;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-reason-title"
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h3 id="change-reason-title" className="flex items-center gap-2 text-base font-semibold text-gray-900">
              {destructive && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
              {title}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Recorded permanently in this booking's change history. It cannot be edited or removed later.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancel"
            className="ml-3 shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {summary && (
            <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{summary}</div>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {presets.map(preset => {
              const on = selected === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(on ? null : preset)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    on
                      ? `border-${fullColor} bg-${fullColor} text-white`
                      : `border-gray-200 bg-white text-gray-700 hover:bg-${themeColor}-50`
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          <label htmlFor="change-reason-detail" className="mb-1 block text-xs font-medium text-gray-700">
            {selected ? 'Add any detail (optional)' : 'Reason'}
          </label>
          <textarea
            id="change-reason-detail"
            ref={inputRef}
            rows={3}
            value={detail}
            onChange={event => setDetail(event.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={selected ? 'e.g. moved to the 4pm slot at the guest’s request' : 'Describe why this change is being made'}
            className={`w-full resize-y rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 ${
              touched && !canSubmit && !submitting
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : `border-gray-200 focus:border-${fullColor} focus:ring-${fullColor}`
            }`}
          />

          {touched && reason.length === 0 && (
            <p className="mt-1.5 text-xs text-red-600">Pick a reason above or type one to continue.</p>
          )}
          {touched && tooShort && (
            <p className="mt-1.5 text-xs text-red-600">Please give a slightly more specific reason.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : `bg-${fullColor} hover:opacity-90`
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeReasonModal;
