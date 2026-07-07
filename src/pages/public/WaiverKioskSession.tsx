import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { WaiverFormContext, WaiverSubmission } from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import { WaiverShell, WaiverLoading, WaiverError, WaiverCompleted, WaiverSuccess } from '../../components/waiver/WaiverStates';

const WaiverKioskSession = () => {
  const { token } = useParams<{ token: string }>();

  const [context, setContext] = useState<WaiverFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState<{ submitted_at?: string; message?: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutSeconds = context?.settings?.inactivity_timeout_seconds ?? 120;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const ctx = await waiverService.getForm(token);
      if (ctx.status === 'completed') {
        setAlreadyCompleted({ submitted_at: ctx.submitted_at, message: ctx.message });
      } else {
        setContext(ctx);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'This kiosk session is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setFormKey((k) => k + 1);
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (loading || error || done || alreadyCompleted) return;
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
  }, [loading, error, done, alreadyCompleted, timeoutSeconds, resetForm]);

  const handleSubmit = async (data: WaiverSubmission) => {
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await waiverService.submit(token, data);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setSubmitError(e.response?.data?.message || 'Failed to submit waiver. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <WaiverLoading label="Loading waiver..." />;
  if (error) return <WaiverError message={error} />;
  if (alreadyCompleted) return <WaiverCompleted submittedAt={alreadyCompleted.submitted_at} message={alreadyCompleted.message} />;
  if (done) return <WaiverSuccess />;
  if (!context) return null;

  return (
    <WaiverShell title={context.template?.title || 'Waiver'} subtitle="Please review and complete the waiver below">
      <WaiverFormBody
        key={formKey}
        context={context}
        disableBrowserAutofill
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
      />
    </WaiverShell>
  );
};

export default WaiverKioskSession;
