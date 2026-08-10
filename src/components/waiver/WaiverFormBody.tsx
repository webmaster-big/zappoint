import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import type {
  WaiverFormContext,
  WaiverSubmission,
  WaiverMinor,
} from '../../types/waiver.types';
import WaiverFormTour from './tour/WaiverFormTour';
import WaiverSignaturePad from './WaiverSignaturePad';
import DateOfBirthSelect from './DateOfBirthSelect';
import RelationshipSelect from './RelationshipSelect';
import { getDeviceId } from '../../utils/deviceId';
import { ADULT_AGE, calculateAge, isFutureDate } from '../../utils/age';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-1';

interface MinorRow extends WaiverMinor {
  _key: number;
}

interface Props {
  context: WaiverFormContext;
  noAutofill?: boolean;
  disableBrowserAutofill?: boolean;
  submitting: boolean;
  error?: string | null;
  onSubmit: (data: WaiverSubmission) => void | Promise<void>;
}

let minorKeySeq = 1;

const WaiverFormBody = ({ context, noAutofill = false, disableBrowserAutofill = false, submitting, error, onSubmit }: Props) => {
  const tpl = context.template;
  const prefill = noAutofill ? undefined : context.prefill;

  const [adultFirstName, setAdultFirstName] = useState(prefill?.adult_first_name ?? '');
  const [adultLastName, setAdultLastName] = useState(prefill?.adult_last_name ?? '');
  const [adultEmail, setAdultEmail] = useState(prefill?.adult_email ?? '');
  const [adultPhone, setAdultPhone] = useState(prefill?.adult_phone ?? '');
  const [adultDob, setAdultDob] = useState(prefill?.adult_dob ?? '');
  const [typedLegalName, setTypedLegalName] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [electronicConsent, setElectronicConsent] = useState(false);
  const [photoVideoConsent, setPhotoVideoConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [minors, setMinors] = useState<MinorRow[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const autoCompleteOff = noAutofill || disableBrowserAutofill ? 'off' : undefined;

  const formRef = useRef<HTMLFormElement>(null);
  const revealErrors = useRef(false);
  const openedAt = useRef(Date.now());
  const electronicTouched = useRef(false);
  const signatureLogged = useRef(false);
  const auditTrail = useRef<Array<{ event: string; at: string; meta?: Record<string, unknown> }>>([]);
  const gps = useRef<{ lat?: number; lng?: number; acc?: number }>({});

  const logAudit = (event: string, meta?: Record<string, unknown>) => {
    if (auditTrail.current.length >= 180) return;
    auditTrail.current.push({ event, at: new Date().toISOString(), ...(meta ? { meta } : {}) });
  };

  const highlightPoints = (tpl?.highlight_points ?? '')
    .split('\n')
    .map((line) => line.replace(/^[\s•*-]+/, '').trim())
    .filter(Boolean);

  useEffect(() => {
    logAudit('form_opened');
    if (context.settings?.gps_capture_enabled && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gps.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
          logAudit('gps_captured');
        },
        () => logAudit('gps_declined'),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealErrors.current) return;
    revealErrors.current = false;
    const target = formRef.current?.querySelector('.border-red-300, .text-red-600');
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [formErrors]);

  const addMinor = () => {
    if (tpl && minors.length >= tpl.max_minors) return;
    setMinors((prev) => [
      ...prev,
      { _key: minorKeySeq++, first_name: '', last_name: '', date_of_birth: '', relationship: '' },
    ]);
  };

  const removeMinor = (key: number) => setMinors((prev) => prev.filter((m) => m._key !== key));

  const updateMinor = (key: number, field: keyof WaiverMinor, value: string) =>
    setMinors((prev) => prev.map((m) => (m._key === key ? { ...m, [field]: value } : m)));

  const signerAge = calculateAge(adultDob);
  const signerIsMinor = signerAge !== null && signerAge < ADULT_AGE;

  const minorIsAdult = (dob?: string | null): boolean => {
    const age = calculateAge(dob);
    return age !== null && age >= ADULT_AGE;
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!adultFirstName.trim()) errs.adultFirstName = 'Required';
    if (!adultLastName.trim()) errs.adultLastName = 'Required';
    if (!adultEmail.trim()) errs.adultEmail = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adultEmail)) errs.adultEmail = 'Invalid email';
    if (!adultPhone.trim()) errs.adultPhone = 'Required';
    if (!adultDob) errs.adultDob = 'Required';
    else if (isFutureDate(adultDob)) errs.adultDob = 'Please check this date — it cannot be in the future';
    else if (signerIsMinor) errs.adultDob = `The person signing must be ${ADULT_AGE} or older`;
    if (!typedLegalName.trim()) errs.typedLegalName = 'Please type your full legal name';
    if (!agreementAccepted) errs.agreement = 'You must agree to the waiver to continue';
    if (tpl?.electronic_consent_enabled && !electronicConsent)
      errs.electronicConsent = 'Electronic consent is required';

    minors.forEach((m, i) => {
      if (!m.first_name.trim()) errs[`minor_${i}_first`] = 'Required';
      if (!m.last_name.trim()) errs[`minor_${i}_last`] = 'Required';
      if (!m.date_of_birth) errs[`minor_${i}_dob`] = 'Required';
      else if (isFutureDate(m.date_of_birth)) errs[`minor_${i}_dob`] = 'Cannot be in the future';
      if (!m.relationship?.trim()) errs[`minor_${i}_rel`] = 'Required';
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      revealErrors.current = true;
      return;
    }
    logAudit('submitted');
    const readSeconds = Math.max(0, Math.round((Date.now() - openedAt.current) / 1000));
    const payload: WaiverSubmission = {
      adult_first_name: adultFirstName.trim(),
      adult_last_name: adultLastName.trim(),
      adult_email: adultEmail.trim(),
      adult_phone: adultPhone.trim(),
      adult_dob: adultDob,
      typed_legal_name: typedLegalName.trim(),
      signature_image: signatureImage || undefined,
      agreement_accepted: agreementAccepted,
      electronic_consent_accepted: tpl?.electronic_consent_enabled ? electronicConsent : undefined,
      photo_video_consent: tpl?.photo_video_release_enabled ? photoVideoConsent : undefined,
      marketing_consent: tpl?.marketing_consent_enabled ? marketingConsent : undefined,
      device_id: getDeviceId(),
      read_seconds: readSeconds,
      gps_latitude: gps.current.lat,
      gps_longitude: gps.current.lng,
      gps_accuracy: gps.current.acc,
      audit_trail: auditTrail.current,
      minors: minors.length
        ? minors.map((m) => ({
            first_name: m.first_name.trim(),
            last_name: m.last_name.trim(),
            date_of_birth: m.date_of_birth || undefined,
            relationship: m.relationship?.trim() || undefined,
          }))
        : undefined,
      selected_date: context.selected_date,
    };
    onSubmit(payload);
  };

  return (
    <>
    <WaiverFormTour />
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" autoComplete={autoCompleteOff}>
      {highlightPoints.length > 0 && (
        <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-5 py-4">
          <h2 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Please note</h2>
          <ul className="space-y-1.5">
            {highlightPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-900/90 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legal body */}
      {context.body && (
        <div data-tour="wf-legal-body" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">{tpl?.title || 'Waiver Agreement'}</h2>
            {tpl?.version != null && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                v{tpl.version}
              </span>
            )}
          </div>
          <div className="max-h-[42vh] overflow-y-auto">
            <div
              className="px-5 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(context.body) }}
            />
            {tpl?.photo_video_release_enabled && tpl?.photo_video_release_text && (
              <div className="px-5 py-4 border-t border-gray-100">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Photo &amp; Video Release</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                  {tpl.photo_video_release_text}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700">{error}</div>
      )}

      {/* Adult / signer */}
      <div data-tour="wf-adult-section" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Your Information</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div data-tour="wf-adult-names">
            <label className={labelClass}>First Name *</label>
            <input
              type="text"
              value={adultFirstName}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultFirstName(e.target.value)}
              className={`${inputClass} ${formErrors.adultFirstName ? 'border-red-300' : ''}`}
            />
            {formErrors.adultFirstName && <p className="text-[11px] text-red-600 mt-1">{formErrors.adultFirstName}</p>}
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input
              type="text"
              value={adultLastName}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultLastName(e.target.value)}
              className={`${inputClass} ${formErrors.adultLastName ? 'border-red-300' : ''}`}
            />
            {formErrors.adultLastName && <p className="text-[11px] text-red-600 mt-1">{formErrors.adultLastName}</p>}
          </div>
          <div data-tour="wf-adult-contact">
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              value={adultEmail}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultEmail(e.target.value)}
              className={`${inputClass} ${formErrors.adultEmail ? 'border-red-300' : ''}`}
            />
            {formErrors.adultEmail && <p className="text-[11px] text-red-600 mt-1">{formErrors.adultEmail}</p>}
          </div>
          <div>
            <label className={labelClass}>Phone *</label>
            <input
              type="tel"
              value={adultPhone}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultPhone(e.target.value)}
              className={`${inputClass} ${formErrors.adultPhone ? 'border-red-300' : ''}`}
            />
            {formErrors.adultPhone && <p className="text-[11px] text-red-600 mt-1">{formErrors.adultPhone}</p>}
          </div>
          <div data-tour="wf-adult-dob">
            <label className={labelClass}>Date of Birth *</label>
            <DateOfBirthSelect
              value={adultDob}
              onChange={(v) => {
                setAdultDob(v);
                setFormErrors((prev) => {
                  if (!prev.adultDob) return prev;
                  const next = { ...prev };
                  delete next.adultDob;
                  return next;
                });
              }}
              error={!!formErrors.adultDob}
            />
            {formErrors.adultDob && <p className="text-[11px] text-red-600 mt-1">{formErrors.adultDob}</p>}
          </div>
        </div>
        {signerIsMinor && (
          <div className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <h3 className="text-xs font-bold text-amber-900">A parent or guardian needs to sign for you</h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              Thanks for getting started! Because you are under {ADULT_AGE}, we are not able to accept your signature on
              this waiver. Please ask a parent or legal guardian to fill this out — they enter their own details above
              {tpl?.minor_section_enabled ? ', then add you in the Minors section below' : ''}. Sorry for the extra step,
              and see you soon!
            </p>
          </div>
        )}
      </div>

      {/* Minors */}
      {tpl?.minor_section_enabled && (
        <div data-tour="wf-minors-section" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Minors</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Add any children you are signing for (up to {tpl.max_minors}).
              </p>
            </div>
            <button
              type="button"
              onClick={addMinor}
              disabled={minors.length >= tpl.max_minors}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold rounded-lg hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add Minor
            </button>
          </div>
          <div className="p-5 space-y-4">
            {minors.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No minors added.</p>
            )}
            {minors.map((m, i) => (
              <div key={m._key} className="border border-gray-100 rounded-lg p-4 bg-gray-50/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-600">Minor {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMinor(m._key)}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First Name *</label>
                    <input
                      type="text"
                      value={m.first_name}
                      autoComplete={autoCompleteOff}
                      onChange={(e) => updateMinor(m._key, 'first_name', e.target.value)}
                      className={`${inputClass} ${formErrors[`minor_${i}_first`] ? 'border-red-300' : ''}`}
                    />
                    {formErrors[`minor_${i}_first`] && (
                      <p className="text-[11px] text-red-600 mt-1">{formErrors[`minor_${i}_first`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Last Name *</label>
                    <input
                      type="text"
                      value={m.last_name}
                      autoComplete={autoCompleteOff}
                      onChange={(e) => updateMinor(m._key, 'last_name', e.target.value)}
                      className={`${inputClass} ${formErrors[`minor_${i}_last`] ? 'border-red-300' : ''}`}
                    />
                    {formErrors[`minor_${i}_last`] && (
                      <p className="text-[11px] text-red-600 mt-1">{formErrors[`minor_${i}_last`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Date of Birth *</label>
                    <DateOfBirthSelect
                      value={m.date_of_birth ?? ''}
                      onChange={(v) => updateMinor(m._key, 'date_of_birth', v)}
                      error={!!formErrors[`minor_${i}_dob`]}
                    />
                    {formErrors[`minor_${i}_dob`] && (
                      <p className="text-[11px] text-red-600 mt-1">{formErrors[`minor_${i}_dob`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Relationship *</label>
                    <RelationshipSelect
                      value={m.relationship ?? ''}
                      direction="minor_to_signer"
                      autoComplete={autoCompleteOff}
                      onChange={(v) => updateMinor(m._key, 'relationship', v)}
                      error={!!formErrors[`minor_${i}_rel`]}
                    />
                    {formErrors[`minor_${i}_rel`] && (
                      <p className="text-[11px] text-red-600 mt-1">{formErrors[`minor_${i}_rel`]}</p>
                    )}
                  </div>
                </div>
                {minorIsAdult(m.date_of_birth) && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                    This date of birth is {ADULT_AGE} or older, so they will need to sign their own waiver rather than be
                    added here. Please double-check the date.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consents + signature */}
      <div data-tour="wf-consent-section" className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Acknowledgment & Consent</h2>
        </div>
        <div className="p-5 space-y-4">
          {tpl?.photo_video_release_enabled && (
            <label data-tour="wf-photo-consent" className="flex items-start gap-2.5 cursor-pointer border border-gray-100 rounded-lg px-3.5 py-3 bg-gray-50/40">
              <input
                type="checkbox"
                checked={photoVideoConsent}
                onChange={(e) => {
                  setPhotoVideoConsent(e.target.checked);
                  logAudit(e.target.checked ? 'photo_consent_checked' : 'photo_consent_unchecked');
                }}
                className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-gray-700 leading-relaxed">
                I agree to the Photo &amp; Video Release described in the waiver above.
              </span>
            </label>
          )}

          {tpl?.marketing_consent_enabled && (
            <div data-tour="wf-marketing-consent" className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2 border-b border-gray-100 bg-gray-50/60">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Stay in Touch</span>
              </div>
              <div className="px-3.5 py-2.5 max-h-20 overflow-y-auto text-xs text-gray-600 leading-relaxed">
                {tpl.marketing_consent_text || 'Keep me updated on future events, coupons, and special offers.'}
                {tpl.marketing_helper_text && (
                  <span className="block text-[11px] text-gray-400 mt-1">{tpl.marketing_helper_text}</span>
                )}
              </div>
              <label className="flex items-center gap-2.5 px-3.5 py-2.5 border-t border-gray-100 cursor-pointer bg-gray-50/40">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => {
                    setMarketingConsent(e.target.checked);
                    logAudit(e.target.checked ? 'marketing_consent_checked' : 'marketing_consent_unchecked');
                  }}
                  className="h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-gray-700">Yes, keep me updated.</span>
              </label>
            </div>
          )}

          <div data-tour="wf-legal-name" className="pt-1">
            <label className={labelClass}>Type your full legal name *</label>
            <input
              type="text"
              value={typedLegalName}
              autoComplete={autoCompleteOff}
              onChange={(e) => {
                const value = e.target.value;
                setTypedLegalName(value);
                if (value.trim() && !electronicTouched.current) {
                  setElectronicConsent(true);
                  logAudit('electronic_consent_auto_checked');
                }
              }}
              placeholder="Full legal name"
              className={`${inputClass} ${formErrors.typedLegalName ? 'border-red-300' : ''}`}
            />
            {formErrors.typedLegalName && (
              <p className="text-[11px] text-red-600 mt-1">{formErrors.typedLegalName}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Typing your name serves as your electronic signature for this agreement.
            </p>
          </div>

          <div data-tour="wf-signature">
            <WaiverSignaturePad
              onChange={(dataUrl) => {
                setSignatureImage(dataUrl);
                if (dataUrl) {
                  if (!signatureLogged.current) {
                    signatureLogged.current = true;
                    logAudit('signature_drawn');
                  }
                } else {
                  signatureLogged.current = false;
                }
              }}
            />
          </div>

          {tpl?.electronic_consent_enabled && (
            <label data-tour="wf-electronic-consent" className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={electronicConsent}
                onChange={(e) => {
                  electronicTouched.current = true;
                  setElectronicConsent(e.target.checked);
                  logAudit(e.target.checked ? 'electronic_consent_checked' : 'electronic_consent_unchecked');
                }}
                className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree that my electronic signature is the legal equivalent of my handwritten signature. *
              </span>
            </label>
          )}
          {formErrors.electronicConsent && (
            <p className="text-[11px] text-red-600 -mt-2">{formErrors.electronicConsent}</p>
          )}

          <label data-tour="wf-agreement" className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-gray-100 mt-1">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => {
                setAgreementAccepted(e.target.checked);
                logAudit(e.target.checked ? 'agreement_accepted' : 'agreement_unaccepted');
              }}
              className="mt-3 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 font-medium leading-relaxed mt-2.5">
              I have read, understand, and agree to the terms of this waiver. *
            </span>
          </label>
          {formErrors.agreement && <p className="text-[11px] text-red-600 -mt-2">{formErrors.agreement}</p>}
        </div>
      </div>

      <button
        data-tour="wf-submit"
        type="submit"
        disabled={submitting || signerIsMinor}
        className="w-full py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {signerIsMinor ? (
          'A parent or guardian must sign'
        ) : submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting...
          </span>
        ) : (
          'Sign & Submit Waiver'
        )}
      </button>
    </form>
    </>
  );
};

export default WaiverFormBody;
