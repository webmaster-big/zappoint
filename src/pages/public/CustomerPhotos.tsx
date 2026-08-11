import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Download, ImageOff, Lock } from 'lucide-react';
import photoService from '../../services/PhotoService';
import type { CustomerPhotoPage } from '../../types/photo.types';

type FieldErrors = Partial<Record<'name' | 'email' | 'phone', string>>;

const CustomerPhotos = () => {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [page, setPage] = useState<CustomerPhotoPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'removed' | 'unknown'>('loading');
  const [gonePhotoMessage, setGonePhotoMessage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketing, setMarketing] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setState('unknown');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await photoService.getCustomerPage(accessToken);
        if (cancelled) return;
        setPage(data);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        const response = (e as { response?: { status?: number; data?: { state?: string; message?: string } } })?.response;

        if (response?.status === 410 && response.data?.state === 'photos_removed') {
          setGonePhotoMessage(response.data.message ?? null);
          setState('removed');
          return;
        }

        setState(response?.status === 410 ? 'expired' : 'unknown');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const validate = useCallback((): boolean => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = 'Please enter a valid email address.';
    if (email.trim().length === 0) next.email = 'Please enter your email address.';
    if (phone.replace(/\D/g, '').length < 10) next.phone = 'Please enter a valid mobile number.';
    if (phone.trim().length === 0) next.phone = 'Please enter your mobile number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [email, name, phone]);

  const submit = useCallback(async () => {
    if (!accessToken) return;
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = await photoService.submitCustomerContact(accessToken, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        marketing_consent: marketing,
      });
      setPage(data);
    } catch (e) {
      const response = (e as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } })
        ?.response;
      if (response?.status === 410) {
        setState('expired');
        return;
      }
      if (response?.data?.errors) {
        const mapped: FieldErrors = {};
        Object.entries(response.data.errors).forEach(([key, messages]) => {
          if (key === 'name' || key === 'email' || key === 'phone') mapped[key] = messages[0];
        });
        setErrors(mapped);
      }
      setFormError(response?.data?.message || 'Please check the details above and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, email, marketing, name, phone, validate]);

  const downloadAll = useCallback(() => {
    if (!accessToken || !page?.photos) return;
    page.photos.forEach((photo, index) => {
      window.setTimeout(() => {
        window.location.href = photoService.customerDownloadUrl(accessToken, photo.id);
      }, index * 700);
    });
  }, [accessToken, page]);

  if (state === 'loading') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <Clock className="w-12 h-12 mx-auto text-amber-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">This photo link has expired</h1>
          <p className="text-zinc-400">
            Photo pages stay open for 30 days. Ask a team member at the venue and they can send your photos again.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'removed') {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <ImageOff className="w-12 h-12 mx-auto text-zinc-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">These photos are no longer available</h1>
          <p className="text-zinc-400">
            {gonePhotoMessage ??
              'If you think this is a mistake, please contact the venue and they can help.'}
          </p>
        </div>
      </div>
    );
  }

  if (state === 'unknown' || !page) {
    return (
      <div className="min-h-dvh bg-zinc-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <ImageOff className="w-12 h-12 mx-auto text-zinc-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">We could not find those photos</h1>
          <p className="text-zinc-400">Check the link and try again, or ask a team member for help.</p>
        </div>
      </div>
    );
  }

  const fieldClass = (key: keyof FieldErrors) =>
    `w-full rounded-xl bg-zinc-900 border px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
      errors[key] ? 'border-red-500' : 'border-zinc-700'
    }`;

  return (
    <div className="min-h-dvh bg-zinc-950 text-white">
      <header className="px-6 py-6 max-w-3xl mx-auto">
        <img src="/Zap-Zone.png" alt="Zap Zone" className="h-10 w-auto object-contain" />
        {page.location_name && (
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">{page.location_name}</p>
        )}
      </header>

      <main className="px-6 pb-16 max-w-3xl mx-auto">
        {page.state === 'contact_required' ? (
          <div className="max-w-md">
            <div className="flex items-center gap-2 text-zinc-400 mb-3">
              <Lock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-[0.2em]">One quick step</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Where should we send your photo?</h1>
            <p className="text-zinc-400 mb-8 text-sm">
              Enter your details and your photo appears right away. We will also email and text you the link so you can
              find it later.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="cp-name" className="block text-sm text-zinc-300 mb-1">
                  Name
                </label>
                <input
                  id="cp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass('name')}
                  placeholder="Your name"
                  autoComplete="name"
                />
                {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="cp-email" className="block text-sm text-zinc-300 mb-1">
                  Email address
                </label>
                <input
                  id="cp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="cp-phone" className="block text-sm text-zinc-300 mb-1">
                  Mobile number
                </label>
                <input
                  id="cp-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClass('phone')}
                  placeholder="(734) 555-0142"
                  autoComplete="tel"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
              </div>

              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-yellow-400"
                />
                <span className="text-sm text-zinc-300">
                  Send me offers and news from {page.business_name || 'Zap Zone'}.
                </span>
              </label>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-400" role="alert">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-yellow-400 text-zinc-950 font-bold py-4 text-lg disabled:opacity-40"
            >
              {submitting ? 'Just a moment…' : 'Show my photo'}
            </button>

            <p className="mt-4 text-xs text-zinc-500">
              Your photo stays hidden until this form is complete. The link works until{' '}
              {page.expires_at ? new Date(page.expires_at).toLocaleDateString() : 'it expires'}.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {page.greeting_name ? `Here you go, ${page.greeting_name}` : 'Your photos are ready'}
            </h1>
            <p className="text-zinc-400 mb-2">
              Taken at {page.location_name} on {page.photo_date}.
            </p>
            <p className="text-sm text-zinc-500 mb-8">
              {page.asked_for_details
                ? `Saved to your email and phone. This page stays open until ${page.expires_on_label}.`
                : `Nothing was asked of you — this link came straight from the counter. It stays open until ${page.expires_on_label}.`}
            </p>

            {page.allow_download_all && (
              <button
                type="button"
                onClick={downloadAll}
                className="mb-6 inline-flex items-center gap-2 rounded-xl bg-yellow-400 text-zinc-950 font-bold px-6 py-3"
              >
                <Download className="w-5 h-5" />
                Download all {page.photos?.length} photos
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(page.photos ?? []).map((photo) => (
                <figure key={photo.id} className="rounded-2xl overflow-hidden bg-zinc-900">
                  <img src={photo.url} alt="Your Zap Zone photo" className="w-full block" />
                  <figcaption className="p-3">
                    <a
                      href={accessToken ? photoService.customerDownloadUrl(accessToken, photo.id) : '#'}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-400"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerPhotos;
