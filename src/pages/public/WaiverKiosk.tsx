import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { WaiverFormContext, WaiverSubmission } from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import { WaiverShell, WaiverLoading, WaiverError } from '../../components/waiver/WaiverStates';

/**
 * Kiosk / iPad mode: /waiver/kiosk/:id — a blank form for an active template, no autofill.
 * After submit it auto-resets to a fresh form; an inactivity timer resets a partially
 * filled form so the next walk-in never sees the previous person's entries.
 */
const WaiverKiosk = () => {
  const { id } = useParams<{ id: string }>();
  const templateId = Number(id);

  const [context, setContext] = useState<WaiverFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  // remounts WaiverFormBody to clear all field state on reset
  const [formKey, setFormKey] = useState(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeoutSeconds = context?.settings?.inactivity_timeout_seconds ?? 120;

  const load = useCallback(async () => {
    if (!templateId) {
      setError('Invalid kiosk link.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const ctx = await waiverService.getKioskForm(templateId);
      setContext(ctx);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'This waiver is not available.');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setFormKey((k) => k + 1);
    setSubmitError(null);
    setJustCompleted(false);
  }, []);

  // Inactivity reset — any interaction restarts the countdown.
  useEffect(() => {
    if (loading || error || justCompleted) return;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(resetForm, timeoutSeconds * 1000);
    };
    const events: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((e) => document.addEventListener(e, arm));
    arm();
    return () => {
      events.forEach((e) => document.removeEventListener(e, arm));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [loading, error, justCompleted, timeoutSeconds, resetForm]);

  useEffect(
    () => () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
    },
    [],
  );

  const handleSubmit = async (data: WaiverSubmission) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await waiverService.kioskSubmit(templateId, data);
      setJustCompleted(true);
      // Auto-return to a fresh form for the next guest.
      completeTimer.current = setTimeout(resetForm, 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e.response?.data?.message || 'Failed to submit waiver. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <WaiverLoading label="Loading waiver..." />;
  if (error) return <WaiverError message={error} />;
  if (!context) return null;

  if (justCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full rounded-xl border border-gray-100 shadow-sm overflow-hidden text-center">
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white p-8">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-3 border border-white/15">
              <svg className="w-7 h-7 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'white' }}>
              Thank You!
            </h1>
            <p className="text-blue-200 text-sm mt-1">Your waiver has been recorded.</p>
          </div>
          <div className="p-6">
            <p className="text-gray-500 text-sm mb-4">Returning to a new waiver…</p>
            <button
              onClick={resetForm}
              className="w-full py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
            >
              Start Next Waiver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WaiverShell title={context.template?.title || 'Waiver'} subtitle="Please complete the waiver below to continue">
      <WaiverFormBody
        key={formKey}
        context={context}
        noAutofill
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
      />
    </WaiverShell>
  );
};

export default WaiverKiosk;
