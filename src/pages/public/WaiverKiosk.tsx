import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type {
  KioskActivity,
  KioskAd,
  WaiverFormContext,
  WaiverProfileRecord,
  WaiverReturningSelection,
  WaiverSubmission,
} from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import { WaiverShell, WaiverLoading, WaiverError } from '../../components/waiver/WaiverStates';
import WaiverReturningPanel, { WaiverReturningSummary } from '../../components/waiver/WaiverReturningPanel';
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

  const packageId = Number(searchParams.get('package_id')) || undefined;
  const attractionId = Number(searchParams.get('attraction_id')) || undefined;
  const eventId = Number(searchParams.get('event_id')) || undefined;
  const activity: KioskActivity | undefined =
    packageId || attractionId || eventId
      ? {
          ...(packageId ? { package_id: packageId } : {}),
          ...(attractionId ? { attraction_id: attractionId } : {}),
          ...(eventId ? { event_id: eventId } : {}),
        }
      : undefined;
  const activityKey = JSON.stringify(activity ?? null);

  const [context, setContext] = useState<WaiverFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [completed, setCompleted] = useState<WaiverSubmission | null>(null);
  const [completedAd, setCompletedAd] = useState<KioskAd | null>(null);
  const [completedWaiverId, setCompletedWaiverId] = useState<number | null>(null);
  const [phase, setPhase] = useState<'start' | 'lookup' | 'returning' | 'form'>('start');
  const [profile, setProfile] = useState<WaiverProfileRecord | null>(null);
  const [returning, setReturning] = useState<WaiverReturningSelection | null>(null);
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  // remounts WaiverFormBody to clear all field state on reset
  const [formKey, setFormKey] = useState(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeoutSeconds = context?.settings?.inactivity_timeout_seconds ?? 120;
  const returningEnabled = !!context?.settings?.returning_enabled;

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
        : await waiverService.getKioskForm(templateId, locationId, activity);
      setContext(ctx);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'This waiver is not available.');
    } finally {
      setLoading(false);
    }
  }, [templateId, preview, locationId, activityKey]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    if (completeTimer.current) {
      clearTimeout(completeTimer.current);
      completeTimer.current = null;
    }
    setFormKey((k) => k + 1);
    setSubmitError(null);
    setJustCompleted(false);
    setCompleted(null);
    setCompletedAd(null);
    setCompletedWaiverId(null);
    setProfile(null);
    setReturning(null);
    setLookupToken(null);
    setPhase('start');
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
    const payload: WaiverSubmission = returning
      ? { ...data, minors: returning.new_dependents.length ? returning.new_dependents : undefined }
      : data;
    setSubmitting(true);
    setSubmitError(null);
    setCompleted(payload);
    try {
      const res = await waiverService.kioskSubmit(
        templateId,
        payload,
        locationId,
        activity,
        returning
          ? {
              waiver_profile_id: returning.waiver_profile_id,
              lookup_token: lookupToken,
              selected_dependent_ids: returning.selected_dependent_ids,
            }
          : undefined,
      );
      const ad: KioskAd | null = res?.data?.ad ?? null;
      setCompletedAd(ad);
      setCompletedWaiverId(res?.data?.id ?? null);
      setJustCompleted(true);
      const holdSeconds = ad ? 2 + ad.display_seconds : SUCCESS_HOLD_SECONDS;
      completeTimer.current = setTimeout(resetForm, (holdSeconds + 90) * 1000);
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

  if (phase === 'start' && returningEnabled && !justCompleted) {
    return (
      <WaiverShell title={context.template?.title || 'Waiver'} subtitle="Welcome! Choose an option to begin">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 sm:px-10">
          <div className="max-w-md mx-auto space-y-4">
            <button
              onClick={() => setPhase('form')}
              className="w-full py-5 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
            >
              New Customer
            </button>
            <button
              onClick={() => setPhase('lookup')}
              className="w-full py-5 bg-white text-blue-700 text-lg font-semibold rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
            >
              Returning Customer
            </button>
          </div>
        </div>
      </WaiverShell>
    );
  }

  if ((phase === 'lookup' || phase === 'returning') && returningEnabled && !justCompleted) {
    return (
      <WaiverShell
        title={context.template?.title || 'Waiver'}
        subtitle={phase === 'lookup' ? 'Returning customer' : 'Please review your saved information'}
      >
        <WaiverReturningPanel
          key={profile?.id ?? 'lookup'}
          templateId={templateId}
          profile={profile}
          maxMinors={context.template?.max_minors ?? 0}
          dependentsEnabled={!!context.template?.minor_section_enabled && (context.template?.max_minors ?? 0) > 0}
          onFound={(found, token) => {
            setProfile(found);
            setLookupToken(token);
            setPhase('returning');
          }}
          onContinue={(selection) => {
            setReturning(selection);
            setPhase('form');
          }}
          onNewCustomer={() => {
            setProfile(null);
            setReturning(null);
            setPhase('form');
          }}
          onCancel={resetForm}
        />
      </WaiverShell>
    );
  }

  return (
    <WaiverShell title={context.template?.title || 'Waiver'} subtitle="Please complete the waiver below to continue">
      {preview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-800">Preview mode</p>
          <p className="text-xs text-amber-700 mt-0.5">This is a test view. Submitting is disabled until the template is active.</p>
        </div>
      )}
      {returning && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={resetForm}
            className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-700"
          >
            Start Over
          </button>
        </div>
      )}
      <WaiverFormBody
        key={formKey}
        context={context}
        noAutofill
        lockedAdult={
          profile && returning
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.has_email ? profile.email : null,
                phone: profile.phone,
              }
            : undefined
        }
        hideMinors={!!returning}
        participantsPanel={
          profile && returning ? <WaiverReturningSummary profile={profile} selection={returning} /> : undefined
        }
        submitLabel={returning ? 'Submit Waiver' : undefined}
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
      />
      {justCompleted && (
        <WaiverSuccessModal
          signerFirstName={completed?.adult_first_name}
          locationId={locationId}
          autoCloseSeconds={completedAd ? 2 + completedAd.display_seconds : SUCCESS_HOLD_SECONDS}
          onStartNext={resetForm}
          ad={completedAd}
          waiverId={completedWaiverId}
        />
      )}
    </WaiverShell>
  );
};

export default WaiverKiosk;
