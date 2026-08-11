import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, ImageOff } from 'lucide-react';
import photoService from '../../services/PhotoService';

const PhotoQrLanding = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'expired' | 'unknown'>('loading');

  useEffect(() => {
    if (!qrToken) {
      setState('unknown');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const resolution = await photoService.resolveQr(qrToken);
        if (cancelled) return;
        navigate(`/photos/${resolution.access_token}`, { replace: true });
      } catch (e) {
        if (cancelled) return;
        const status = (e as { response?: { status?: number } })?.response?.status;
        setState(status === 410 ? 'expired' : 'unknown');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, qrToken]);

  return (
    <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {state === 'loading' && (
          <>
            <div className="h-10 w-10 mx-auto rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
            <p className="mt-5 text-zinc-400">Opening your photos…</p>
          </>
        )}

        {state === 'expired' && (
          <>
            <Clock className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <h1 className="text-2xl font-bold mb-2">This QR code has expired</h1>
            <p className="text-zinc-400">
              QR codes stay active for 12 hours. Ask a team member at the counter and they can send your photos again.
            </p>
          </>
        )}

        {state === 'unknown' && (
          <>
            <ImageOff className="w-12 h-12 mx-auto text-zinc-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">We could not find that code</h1>
            <p className="text-zinc-400">Check the code and scan it again, or ask a team member for help.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoQrLanding;
