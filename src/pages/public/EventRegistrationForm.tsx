import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Lock, MapPin, RefreshCw } from 'lucide-react';
import EmailInput from '../../components/ui/EmailInput';
import eventRegistrationService from '../../services/EventRegistrationService';
import type { RegistrationFormPage } from '../../types/eventRegistration.types';
import {
  COUNTRY_CODE_NEEDED,
  PHONE_NOT_RECOGNISED,
  digitsOnly,
  formatPhoneForDisplay,
  isCompletePhone,
  localPhoneDigits,
  needsCountryCode,
  phoneForSubmit,
} from '../../utils/bookingSearch';
import { cleanEmailAddress, isValidEmailAddress, suggestEmails } from '../../utils/emailDomains';
import { newCheckoutKey } from '../../utils/checkoutKey';
import { getImageUrl, getStoredUser } from '../../utils/storage';
import { formatDateLong } from '../../utils/timeFormat';
import { locationDisplayName } from '../../utils/locationName';
import { requestErrorMessage } from '../../utils/requestError';
import { DEFAULT_LOGO_SRC } from '../../utils/logo';
import { useLocationBrand } from '../../hooks/useLocationBrand';
import { celebrate } from '../../utils/celebrate';

type Stage = 'loading' | 'not_found' | 'failed' | 'busy' | 'ready' | 'closed' | 'submitted';

type FieldKey = 'name' | 'phone' | 'email';

type FieldErrors = Partial<Record<FieldKey, string>>;

interface Values {
  name: string;
  phone: string;
  email: string;
}

interface Confirmation {
  firstName: string;
  eventName: string;
  message: string | null;
  preview: boolean;
}

interface FailureBody {
  code?: string;
  reason?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

const IDLE_RESET_MS = 90_000;
const SUCCESS_RESET_MS = 8_000;
const KIOSK_RECHECK_MS = 60_000;
const PRIMARY_BUTTON = 'w-full min-h-[52px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-base font-semibold transition';
const FIELD_ORDER: FieldKey[] = ['name', 'phone', 'email'];
const BUSY_SUBMIT = 'Lots of people are registering right now. Please wait a few seconds and tap Register again.';
const UNCONFIRMED = "We couldn't confirm your registration. Tap Register again without changing anything — you won't be registered twice.";

const normalisedName = (value: string): string =>
  value.replace(/(?:(?![\t\n\x0B\f\r])[\p{Cc}\p{Cf}])+/gu, '').replace(/[\t\n\x0B\f\r\p{Z}]+/gu, ' ').trim();

const phoneTooLong = (value: string): boolean => {
  const raw = value.trim();
  if (/^\+\s*0/.test(raw)) return true;
  return digitsOnly(raw).replace(/^0+/, '').length > 15;
};

const validate = (values: Values): FieldErrors => {
  const errors: FieldErrors = {};
  const name = normalisedName(values.name);
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length < 2) errors.name = 'Please enter your full name.';
  else if (!/\p{L}/u.test(name)) errors.name = 'Please enter your name using letters.';

  const phone = values.phone.trim();
  if (!phone) errors.phone = 'Please enter your phone number.';
  else if (needsCountryCode(phone)) errors.phone = COUNTRY_CODE_NEEDED;
  else if (!isCompletePhone(phone) || phoneTooLong(phone)) errors.phone = PHONE_NOT_RECOGNISED;

  const email = cleanEmailAddress(values.email);
  if (!email) errors.email = 'Please enter your email address.';
  else if (!isValidEmailAddress(email)) errors.email = 'Please enter a valid email address, like name@example.com.';

  return errors;
};

const fingerprintOf = (values: Values): string =>
  JSON.stringify({
    n: normalisedName(values.name).toLowerCase(),
    e: cleanEmailAddress(values.email),
    p: localPhoneDigits(values.phone),
  });

const randomFieldName = (round: number): string => `f${round}${Math.random().toString(36).slice(2, 10)}`;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-600!">
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  ) : null;

const StatusCard = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
    <h1 className="text-2xl font-bold text-gray-900 break-words">{title}</h1>
    {children}
  </div>
);

const EventRegistrationForm = () => {
  const params = useParams<{ code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const code = (params.code ?? '').toLowerCase();
  const kioskRequested = searchParams.get('kiosk') === '1';
  const previewRequested = searchParams.get('preview') === '1';
  const [staffSession] = useState(() => Boolean(getStoredUser()?.token));
  const preview = previewRequested && staffSession;

  const [stage, setStage] = useState<Stage>('loading');
  const [page, setPage] = useState<RegistrationFormPage | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [staffBlocked, setStaffBlocked] = useState(() => kioskRequested && Boolean(getStoredUser()?.token));
  const [values, setValues] = useState<Values>({ name: '', phone: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [keptEmail, setKeptEmail] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [focusNameNext, setFocusNameNext] = useState(false);

  const kiosk = kioskRequested && !staffBlocked;
  const submittingRef = useRef(false);
  const generationRef = useRef(0);
  const keysRef = useRef(new Map<string, string>());
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const brand = useLocationBrand(page?.location_logo_path, page?.location_name);

  const fieldNames = useMemo(
    () => (kiosk
      ? { name: randomFieldName(formKey), phone: randomFieldName(formKey), email: randomFieldName(formKey) }
      : { name: 'name', phone: 'phone', email: 'email' }),
    [kiosk, formKey],
  );

  useEffect(() => {
    let cancelled = false;
    setStage('loading');
    eventRegistrationService
      .getForm(code)
      .then((form) => {
        if (cancelled) return;
        setPage(form);
        setImageFailed(false);
        setStage(form.status === 'open' || (preview && form.status === 'closed') ? 'ready' : 'closed');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = isAxiosError(error) ? error.response?.status : undefined;
        setStage(status === 404 ? 'not_found' : status === 429 ? 'busy' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [code, attempt, preview]);

  useEffect(() => {
    setLogoFailed(false);
  }, [brand.logoPath]);

  useEffect(() => {
    if (!kiosk || stage !== 'closed' || page?.status !== 'closed') return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      eventRegistrationService
        .getForm(code)
        .then((form) => {
          if (cancelled || form.status !== 'open') return;
          setPage(form);
          setStage('ready');
        })
        .catch(() => undefined);
    }, KIOSK_RECHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [kiosk, stage, page?.status, code]);

  useEffect(() => {
    if (page) document.title = `${page.name} | Register`;
  }, [page]);

  useEffect(() => {
    if (stage === 'submitted') doneRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (!emailSuggestion) return;
    suggestionRef.current?.scrollIntoView({ block: 'center' });
    suggestionRef.current?.focus();
  }, [emailSuggestion]);

  useEffect(() => {
    if (focusNameNext && stage === 'ready') {
      nameRef.current?.focus();
      setFocusNameNext(false);
    }
  }, [focusNameNext, stage]);

  const resetForNextGuest = useCallback(() => {
    generationRef.current += 1;
    submittingRef.current = false;
    keysRef.current.clear();
    setSubmitting(false);
    setValues({ name: '', phone: '', email: '' });
    setFieldErrors({});
    setFormError(null);
    setEmailSuggestion(null);
    setKeptEmail(null);
    setConfirmation(null);
    setFormKey((key) => key + 1);
    setStage((current) => (current === 'submitted' ? 'ready' : current));
  }, []);

  useEffect(() => {
    if (!kiosk) return undefined;
    let timer = window.setTimeout(resetForNextGuest, IDLE_RESET_MS);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(resetForNextGuest, IDLE_RESET_MS);
    };
    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((name) => document.addEventListener(name, restart, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => document.removeEventListener(name, restart));
    };
  }, [kiosk, resetForNextGuest]);

  useEffect(() => {
    if (!kiosk || stage !== 'submitted') return undefined;
    const timer = window.setTimeout(resetForNextGuest, SUCCESS_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [kiosk, stage, resetForNextGuest]);

  const setField = (field: FieldKey, value: string) => {
    if (submittingRef.current) return;
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setFormError(null);
    if (field === 'email') setEmailSuggestion(null);
  };

  const focusField = (field: FieldKey) => {
    const target = field === 'name' ? nameRef.current : field === 'phone' ? phoneRef.current : emailRef.current;
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
  };

  const keyFor = (fingerprint: string): string => {
    const known = keysRef.current.get(fingerprint);
    if (known) return known;
    const fresh = newCheckoutKey();
    keysRef.current.set(fingerprint, fresh);
    return fresh;
  };

  const send = async (current: Values) => {
    if (!page || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);

    const generation = generationRef.current;
    const name = normalisedName(current.name);
    const snapshot: Confirmation = {
      firstName: name.split(' ')[0] ?? name,
      eventName: page.name,
      message: page.confirmation_message,
      preview,
    };

    const finish = () => {
      if (generation !== generationRef.current) return;
      submittingRef.current = false;
      setSubmitting(false);
    };

    if (preview) {
      setConfirmation(snapshot);
      setStage('submitted');
      finish();
      return;
    }

    const fingerprint = fingerprintOf(current);
    const payload = {
      name,
      phone: phoneForSubmit(current.phone),
      email: current.email.trim(),
    };

    for (let round = 0; round < 2; round += 1) {
      try {
        const result = await eventRegistrationService.submit(code, { ...payload, submission_key: keyFor(fingerprint) });
        if (generation !== generationRef.current) return;
        keysRef.current.clear();
        setConfirmation({ ...snapshot, eventName: result.event_name, message: result.confirmation_message });
        setStage('submitted');
        finish();
        celebrate();
        return;
      } catch (error: unknown) {
        if (generation !== generationRef.current) return;
        const response = isAxiosError<FailureBody>(error) ? error.response : undefined;
        const body = response?.data;

        if (response?.status === 422 && body?.errors?.submission_key && round === 0) {
          keysRef.current.delete(fingerprint);
          continue;
        }

        if (response?.status === 422 && body?.code === 'REGISTRATION_CLOSED') {
          setPage((currentPage) => (currentPage ? { ...currentPage, status: body.reason === 'past' ? 'past' : 'closed' } : currentPage));
          setStage('closed');
          setAttempt((value) => value + 1);
        } else if (response?.status === 422 && body?.errors) {
          const mapped: FieldErrors = {};
          FIELD_ORDER.forEach((field) => {
            const messages = body.errors?.[field];
            if (messages?.[0]) mapped[field] = messages[0];
          });
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped);
            const first = FIELD_ORDER.find((field) => mapped[field]);
            if (first) window.setTimeout(() => focusField(first), 0);
          } else {
            setFormError(body.message ?? 'Please check your details and try again.');
          }
        } else if (response?.status === 404) {
          setStage('not_found');
        } else if (response?.status === 429) {
          setFormError(BUSY_SUBMIT);
        } else if (!response || [502, 503, 504].includes(response.status)) {
          setFormError(UNCONFIRMED);
        } else {
          setFormError(requestErrorMessage(error, 'Something went wrong. Please try again.'));
        }
        finish();
        return;
      }
    }
    finish();
  };

  const attemptSubmit = (current: Values, emailConfirmed: boolean) => {
    if (submittingRef.current) return;
    const errors = validate(current);
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      setFieldErrors(errors);
      focusField(first);
      return;
    }

    const cleaned = cleanEmailAddress(current.email);
    if (!emailConfirmed && keptEmail !== cleaned) {
      const suggestion = suggestEmails(cleaned)[0];
      if (suggestion && suggestion.email !== cleaned) {
        setEmailSuggestion(suggestion.email);
        return;
      }
    }

    setEmailSuggestion(null);
    void send(current);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    attemptSubmit(values, false);
  };

  const applySuggestion = () => {
    if (!emailSuggestion) return;
    const next = { ...values, email: emailSuggestion };
    setValues(next);
    setEmailSuggestion(null);
    attemptSubmit(next, true);
  };

  const keepTypedEmail = () => {
    setKeptEmail(cleanEmailAddress(values.email));
    setEmailSuggestion(null);
    attemptSubmit(values, true);
  };

  const nextOnEnter = (target: 'phone' | 'email') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    (target === 'phone' ? phoneRef.current : emailRef.current)?.focus();
  };

  const registerAnother = () => {
    if (kiosk) {
      resetForNextGuest();
      return;
    }
    generationRef.current += 1;
    keysRef.current.clear();
    setValues((current) => ({ ...current, name: '' }));
    setFieldErrors({});
    setFormError(null);
    setEmailSuggestion(null);
    setConfirmation(null);
    setStage('ready');
    setFocusNameNext(true);
  };

  const signOutForKiosk = async () => {
    await import('../../utils/cacheGuard')
      .then(({ purgeAllZapzoneCaches }) => purgeAllZapzoneCaches())
      .catch(() => undefined);
    localStorage.removeItem('zapzone_user');
    setStaffBlocked(false);
  };

  const leavePreview = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('preview');
    setSearchParams(next, { replace: true });
  };

  const leaveKioskMode = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('kiosk');
    setSearchParams(next, { replace: true });
    setStaffBlocked(false);
  };

  const withModeFlags = (url: string): string => {
    const target = new URL(url, window.location.origin);
    if (kioskRequested) target.searchParams.set('kiosk', '1');
    if (preview) target.searchParams.set('preview', '1');
    return target.toString();
  };

  const venue = page?.location_name ? locationDisplayName(page.location_name) : null;
  const headerImage = page?.header_image_path && !imageFailed ? getImageUrl(page.header_image_path) : '';
  const logoSrc = !logoFailed && brand.logoPath ? getImageUrl(brand.logoPath) : DEFAULT_LOGO_SRC;
  const autoComplete = (token: string) => (kiosk ? 'off' : token);
  const posterWidth = page?.header_image_width ?? null;
  const posterHeight = page?.header_image_height ?? null;
  const posterRatio = posterWidth && posterHeight ? posterWidth / posterHeight : null;
  const tallPoster = posterRatio !== null && posterRatio < 1.2;
  const posterStyle = posterRatio === null
    ? undefined
    : ({ aspectRatio: `${posterWidth} / ${posterHeight}`, '--poster-ratio': posterRatio } as CSSProperties);
  const posterSize = posterRatio === null
    ? 'sm:w-auto sm:max-w-full'
    : 'sm:w-[min(100%,calc(36vh*var(--poster-ratio)))] split:w-[min(100%,calc(86vh*var(--poster-ratio)))]';
  const previewNote = preview ? (
    <>
      Preview — registrations are not saved.
      {page?.status === 'closed' ? ' This form is closed to guests right now.' : ''}
    </>
  ) : null;

  const inputClass = (field: FieldKey) =>
    `w-full min-h-12 rounded-lg border bg-gray-50/50 px-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition read-only:bg-gray-50 ${
      fieldErrors[field] ? 'border-red-500!' : 'border-gray-200'
    }`;

  const factChip = 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium text-gray-700';
  const factIcon = 'h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0';
  const eventFacts = (centered = false) => (page ? (
    <div className={`flex flex-wrap gap-1.5 sm:gap-2 ${centered ? 'justify-center' : ''}`}>
      <span className={factChip}>
        <CalendarDays className={factIcon} aria-hidden="true" />
        <span>{page.starts_on ? `${formatDateLong(page.starts_on)} – ${formatDateLong(page.event_date)}` : formatDateLong(page.event_date)}</span>
      </span>
      {venue && (
        <span className={factChip}>
          <MapPin className={factIcon} aria-hidden="true" />
          <span className="break-words">{venue}</span>
        </span>
      )}
    </div>
  ) : null);

  const renderBody = () => {
    if (previewRequested && !staffSession) {
      return (
        <StatusCard title="This is a staff preview link">
          <p className="text-sm text-gray-600">
            Registrations made from a preview link are not saved. Use the form&apos;s regular link to register.
          </p>
          <button type="button" onClick={leavePreview} className={PRIMARY_BUTTON}>
            Open the registration form
          </button>
        </StatusCard>
      );
    }

    if (staffBlocked) {
      return (
        <StatusCard title="Start the sign-up kiosk?">
          <p className="text-sm text-gray-600">
            This browser is signed in to ZapZone staff tools. Guests using this device could open them from here.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => void signOutForKiosk()}
              className={PRIMARY_BUTTON}
            >
              Sign out and start kiosk
            </button>
            <button
              type="button"
              onClick={leaveKioskMode}
              className="w-full min-h-[52px] rounded-lg border border-gray-300 bg-white text-gray-800 text-base font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </StatusCard>
      );
    }

    if (stage === 'loading') {
      return (
        <div className="flex flex-col items-center py-16 text-gray-500" role="status">
          <Loader2 className="h-7 w-7 animate-spin mb-3" aria-hidden="true" />
          <p className="text-sm">Loading the registration form…</p>
        </div>
      );
    }

    if (stage === 'not_found') {
      return (
        <StatusCard title="We couldn't find this registration form">
          <p className="text-sm text-gray-600" role="alert">Check the link, or scan the QR code again.</p>
        </StatusCard>
      );
    }

    if (stage === 'failed' || stage === 'busy') {
      return (
        <StatusCard title={stage === 'busy' ? 'Lots of people are opening this form' : "We couldn't load this form"}>
          <p className="text-sm text-gray-600">
            {stage === 'busy' ? 'Tap Try again in a few seconds.' : 'Check your connection and try again in a moment.'}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className={`${PRIMARY_BUTTON} inline-flex items-center justify-center gap-2`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </StatusCard>
      );
    }

    if (!page) return null;

    if (stage === 'closed') {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">Registration closed</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 break-words">{page.name}</h1>
          {eventFacts()}
          <p className="text-base text-gray-700 break-words" role="alert">
            {page.status === 'past'
              ? 'This event has already taken place, so registration is closed.'
              : `Registration for ${page.name} is closed.`}
          </p>
          {page.next_edition && (
            <a
              href={withModeFlags(page.next_edition.url)}
              className={`${PRIMARY_BUTTON} inline-flex items-center justify-center px-4 text-center break-words`}
            >
              Register for {page.next_edition.name}
            </a>
          )}
        </div>
      );
    }

    if (stage === 'submitted' && confirmation) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden="true" />
          </div>
          <h1 ref={doneRef} tabIndex={-1} className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 focus:outline-none">
            You&apos;re registered!
          </h1>
          <p className="text-base text-gray-700 break-words">
            {kiosk ? `You're on the list for ${confirmation.eventName}.` : `${confirmation.firstName}, you're on the list for ${confirmation.eventName}.`}
          </p>
          {confirmation.message && <p className="text-base text-gray-700 whitespace-pre-line break-words">{confirmation.message}</p>}
          {confirmation.preview && (
            <p className="text-sm font-medium text-amber-800">Preview only — nothing was saved.</p>
          )}
          {eventFacts(true)}
          <button
            type="button"
            onClick={registerAnother}
            className="w-full min-h-[52px] rounded-lg border border-blue-700 bg-white text-blue-800 text-base font-semibold hover:bg-blue-50 transition"
          >
            Register another person
          </button>
          {kiosk && <p className="text-xs text-gray-500">This screen clears itself in a few seconds.</p>}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-7 space-y-2.5 sm:space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 break-words">{page.name}</h1>
          {eventFacts()}
          {page.description && <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line break-words">{page.description}</p>}
        </div>

        <form
          key={formKey}
          noValidate
          onSubmit={handleSubmit}
          className="border-t border-gray-100 p-4 sm:p-7 space-y-4 sm:space-y-5"
          aria-label={`Register for ${page.name}`}
        >
          <div>
            <label htmlFor={`${fieldNames.name}-input`} className="block text-xs font-semibold text-gray-700 mb-1">
              Full name
            </label>
            <input
              ref={nameRef}
              id={`${fieldNames.name}-input`}
              name={fieldNames.name}
              type="text"
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              onKeyDown={nextOnEnter('phone')}
              autoComplete={autoComplete('name')}
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={120}
              readOnly={submitting}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? 'registration-name-error' : undefined}
              className={inputClass('name')}
              placeholder="First and last name"
            />
            <FieldError id="registration-name-error" message={fieldErrors.name} />
          </div>

          <div>
            <label htmlFor={`${fieldNames.phone}-input`} className="block text-xs font-semibold text-gray-700 mb-1">
              Phone number
            </label>
            <input
              ref={phoneRef}
              id={`${fieldNames.phone}-input`}
              name={fieldNames.phone}
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(event) => setField('phone', event.target.value)}
              onBlur={() => setValues((current) => ({ ...current, phone: formatPhoneForDisplay(current.phone) || current.phone }))}
              onKeyDown={nextOnEnter('email')}
              autoComplete={autoComplete('tel')}
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={40}
              readOnly={submitting}
              aria-invalid={fieldErrors.phone ? true : undefined}
              aria-describedby={fieldErrors.phone ? 'registration-phone-error' : undefined}
              className={inputClass('phone')}
              placeholder="(555) 123-4567"
            />
            <FieldError id="registration-phone-error" message={fieldErrors.phone} />
          </div>

          <div>
            <label htmlFor={`${fieldNames.email}-input`} className="block text-xs font-semibold text-gray-700 mb-1">
              Email address
            </label>
            <EmailInput
              inputRef={emailRef}
              id={`${fieldNames.email}-input`}
              name={fieldNames.email}
              value={values.email}
              onChange={(event) => setField('email', event.target.value)}
              autoComplete={autoComplete('email')}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={190}
              readOnly={submitting}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'registration-email-error' : undefined}
              className={inputClass('email')}
              placeholder="you@example.com"
            />
            <FieldError id="registration-email-error" message={fieldErrors.email} />
            {emailSuggestion && (
              <div ref={suggestionRef} tabIndex={-1} className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2 focus:outline-none" role="alert">
                <p className="text-sm text-amber-900">
                  Did you mean <span className="font-semibold break-all">{emailSuggestion}</span>?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="flex-1 min-h-12 rounded-lg border border-amber-400 bg-white text-amber-900 text-base font-semibold px-3 break-all hover:bg-amber-100 transition"
                  >
                    Use {emailSuggestion}
                  </button>
                  <button
                    type="button"
                    onClick={keepTypedEmail}
                    className="flex-1 min-h-12 rounded-lg border border-amber-400 bg-white text-amber-900 text-base font-semibold px-3 break-all hover:bg-amber-100 transition"
                  >
                    Keep {cleanEmailAddress(values.email)}
                  </button>
                </div>
              </div>
            )}
          </div>

          {formError && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700!" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`${PRIMARY_BUTTON} inline-flex items-center justify-center gap-2 disabled:opacity-70`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Registering…
              </>
            ) : (
              'Register'
            )}
          </button>
          <p className="text-center text-xs sm:text-sm text-gray-500">One form per person. After you register you can add someone else.</p>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-gray-50" data-poster={headerImage && tallPoster ? 'tall' : undefined}>
      {previewNote && (
        <div className={`bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium text-amber-900 ${headerImage ? 'split:hidden' : ''}`} role="note">
          {previewNote}
        </div>
      )}

      <div className={headerImage ? 'split:grid split:min-h-dvh split:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]' : ''}>
        {headerImage ? (
          <div className="relative overflow-hidden bg-gray-900 split:sticky split:top-0 split:h-dvh">
            <div
              aria-hidden="true"
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-70 blur-2xl"
              style={{ backgroundImage: `url(${JSON.stringify(headerImage)})` }}
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gray-950/40" />
            <div className="relative flex h-full items-center justify-center sm:p-8 split:p-12">
              <img
                src={headerImage}
                width={posterWidth ?? undefined}
                height={posterHeight ?? undefined}
                alt=""
                decoding="async"
                style={posterStyle}
                className={`block h-auto w-full max-h-[40vh] object-contain sm:max-h-[36vh] sm:rounded-2xl sm:shadow-2xl split:max-h-[86vh] ${posterSize}`}
                onError={() => setImageFailed(true)}
              />
            </div>
          </div>
        ) : (
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-md sm:max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
              <img
                src={logoSrc}
                alt={venue ?? locationDisplayName(brand.name)}
                className="h-10 w-auto object-contain"
                onError={() => setLogoFailed(true)}
              />
            </div>
          </div>
        )}

        <main className={headerImage ? 'split:flex split:items-center split:justify-center' : ''}>
          <div className="mx-auto w-full max-w-md sm:max-w-lg px-4 py-4 sm:py-8 space-y-4">
            {previewNote && headerImage && (
              <div className="hidden split:block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900" role="note">
                {previewNote}
              </div>
            )}
            {renderBody()}
            <p className="pt-2 text-center text-xs text-gray-400">Powered by ZapZone</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EventRegistrationForm;
