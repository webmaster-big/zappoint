import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { WaiverFormContext, WaiverSubmission } from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import {
  WaiverShell,
  WaiverLoading,
  WaiverError,
  WaiverCompleted,
  WaiverSuccess,
} from '../../components/waiver/WaiverStates';

/** Token-addressed customer waiver page: /waiver/:token (email / SMS / staff-sent link). */
const WaiverForm = () => {
  const { token } = useParams<{ token: string }>();
  const [context, setContext] = useState<WaiverFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState<{ submitted_at?: string; message?: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
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
        setError(e.response?.data?.message || 'This waiver link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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

  if (loading) return <WaiverLoading label="Loading your waiver..." />;
  if (error) return <WaiverError message={error} />;
  if (alreadyCompleted)
    return (
      <WaiverCompleted
        submittedAt={alreadyCompleted.submitted_at}
        message={alreadyCompleted.message}
      />
    );
  if (done) return <WaiverSuccess />;
  if (!context) return null;

  return (
    <WaiverShell title={context.template?.title || 'Sign Your Waiver'} subtitle="Please review and complete the waiver below">
      <WaiverFormBody
        context={context}
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
      />
    </WaiverShell>
  );
};

export default WaiverForm;
