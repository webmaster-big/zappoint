import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { WaiverFormContext, WaiverSubmission } from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import { WaiverShell, WaiverLoading, WaiverError } from '../../components/waiver/WaiverStates';
import WaiverSuccessModal from '../../components/waiver/WaiverSuccessModal';

// long enough for a guest to actually read the confirmation and scan the QR
const SUCCESS_HOLD_SECONDS = 25;

const WaiverKiosk = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const templateId = Number(id);
  const locationParam = searchParams.get('location_id');
  const locationId = locationParam ? Number(locationParam) : null;

  const [context, setContext] = useState<WaiverFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [completed, setCompleted] = useState<WaiverSubmission | null>(null);
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
      const ctx = preview
        ? await waiverService.getKioskPreview(templateId)
        : await waiverService.getKioskForm(templateId, locationId);
      setContext(ctx);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'This waiver is not available.');
    } finally {
      setLoading(false);
    }
  }, [templateId, preview, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setFormKey((k) => k + 1);
    setSubmitError(null);
    setJustCompleted(false);
    setCompleted(null);
  }, []);

  // Inactivity reset — any interaction restarts the countdown.
  useEffect(() => {
    if (loading || error || justCompleted) return;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(resetForm, timeoutSeconds * 1000);
    };
    const events: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'wheel'];
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
    if (preview) {
      setSubmitError('Preview mode — activate this template to accept real waivers.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setCompleted(data);
    try {
      await waiverService.kioskSubmit(templateId, data, locationId);
      setJustCompleted(true);
      completeTimer.current = setTimeout(resetForm, SUCCESS_HOLD_SECONDS * 1000);
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

  return (
    <WaiverShell title={context.template?.title || 'Waiver'} subtitle="Please complete the waiver below to continue">
      {preview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-800">Preview mode</p>
          <p className="text-xs text-amber-700 mt-0.5">This is a test view. Submitting is disabled until the template is active.</p>
        </div>
      )}
      <WaiverFormBody
        key={formKey}
        context={context}
        noAutofill
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
      />
      {justCompleted && (
        <WaiverSuccessModal
          signerFirstName={completed?.adult_first_name}
          locationId={locationId}
          autoCloseSeconds={SUCCESS_HOLD_SECONDS}
          onStartNext={resetForm}
        />
      )}
    </WaiverShell>
  );
};

export default WaiverKiosk;
