import { useState } from 'react';
import DOMPurify from 'dompurify';
import type {
  WaiverFormContext,
  WaiverSubmission,
  WaiverMinor,
} from '../../types/waiver.types';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-1';

interface MinorRow extends WaiverMinor {
  _key: number;
}

interface Props {
  context: WaiverFormContext;
  /** When true, never seed fields from prefill (kiosk / shared device). */
  noAutofill?: boolean;
  submitting: boolean;
  error?: string | null;
  /** Submit handler — resolves when the API call settles. */
  onSubmit: (data: WaiverSubmission) => void | Promise<void>;
}

let minorKeySeq = 1;

/**
 * Shared waiver completion form: renders the frozen legal body plus the adult,
 * minor, consent and typed-name fields. Used by both the token-addressed customer
 * page and the kiosk page (which passes noAutofill).
 */
const WaiverFormBody = ({ context, noAutofill = false, submitting, error, onSubmit }: Props) => {
  const tpl = context.template;
  const prefill = noAutofill ? undefined : context.prefill;

  const [adultFirstName, setAdultFirstName] = useState(prefill?.adult_first_name ?? '');
  const [adultLastName, setAdultLastName] = useState(prefill?.adult_last_name ?? '');
  const [adultEmail, setAdultEmail] = useState(prefill?.adult_email ?? '');
  const [adultPhone, setAdultPhone] = useState(prefill?.adult_phone ?? '');
  const [adultDob, setAdultDob] = useState(prefill?.adult_dob ?? '');
  const [typedLegalName, setTypedLegalName] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [electronicConsent, setElectronicConsent] = useState(false);
  const [photoVideoConsent, setPhotoVideoConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false); // unchecked by default
  const [minors, setMinors] = useState<MinorRow[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const autoCompleteOff = noAutofill ? 'off' : undefined;

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!adultFirstName.trim()) errs.adultFirstName = 'Required';
    if (!adultLastName.trim()) errs.adultLastName = 'Required';
    if (adultEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adultEmail)) errs.adultEmail = 'Invalid email';
    if (!typedLegalName.trim()) errs.typedLegalName = 'Please type your full legal name';
    if (!agreementAccepted) errs.agreement = 'You must agree to the waiver to continue';
    if (tpl?.electronic_consent_enabled && !electronicConsent)
      errs.electronicConsent = 'Electronic consent is required';

    minors.forEach((m, i) => {
      if (!m.first_name.trim()) errs[`minor_${i}_first`] = 'Required';
      if (!m.last_name.trim()) errs[`minor_${i}_last`] = 'Required';
      if (tpl?.dob_required && !m.date_of_birth) errs[`minor_${i}_dob`] = 'Required';
      if (tpl?.relationship_required && !m.relationship?.trim()) errs[`minor_${i}_rel`] = 'Required';
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: WaiverSubmission = {
      adult_first_name: adultFirstName.trim(),
      adult_last_name: adultLastName.trim(),
      adult_email: adultEmail.trim() || undefined,
      adult_phone: adultPhone.trim() || undefined,
      adult_dob: adultDob || undefined,
      typed_legal_name: typedLegalName.trim(),
      agreement_accepted: agreementAccepted,
      electronic_consent_accepted: tpl?.electronic_consent_enabled ? electronicConsent : undefined,
      photo_video_consent: tpl?.photo_video_release_enabled ? photoVideoConsent : undefined,
      marketing_consent: tpl?.marketing_consent_enabled ? marketingConsent : undefined,
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
    <form onSubmit={handleSubmit} className="space-y-5" autoComplete={autoCompleteOff}>
      {/* Legal body */}
      {context.body && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">{tpl?.title || 'Waiver Agreement'}</h2>
            {tpl?.version != null && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                v{tpl.version}
              </span>
            )}
          </div>
          <div
            className="px-5 py-4 max-h-[42vh] overflow-y-auto text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(context.body) }}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700">{error}</div>
      )}

      {/* Adult / signer */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Your Information</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
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
          <div>
            <label className={labelClass}>
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
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
            <label className={labelClass}>
              Phone <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={adultPhone}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultPhone(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Date of Birth <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={adultDob}
              autoComplete={autoCompleteOff}
              onChange={(e) => setAdultDob(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Minors */}
      {tpl?.minor_section_enabled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
                  </div>
                  <div>
                    <label className={labelClass}>
                      Date of Birth {tpl.dob_required ? '*' : <span className="text-gray-400 font-normal">(optional)</span>}
                    </label>
                    <input
                      type="date"
                      value={m.date_of_birth ?? ''}
                      autoComplete={autoCompleteOff}
                      onChange={(e) => updateMinor(m._key, 'date_of_birth', e.target.value)}
                      className={`${inputClass} ${formErrors[`minor_${i}_dob`] ? 'border-red-300' : ''}`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Relationship {tpl.relationship_required ? '*' : <span className="text-gray-400 font-normal">(optional)</span>}
                    </label>
                    <input
                      type="text"
                      value={m.relationship ?? ''}
                      autoComplete={autoCompleteOff}
                      placeholder="e.g. son, daughter"
                      onChange={(e) => updateMinor(m._key, 'relationship', e.target.value)}
                      className={`${inputClass} ${formErrors[`minor_${i}_rel`] ? 'border-red-300' : ''}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consents + signature */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Acknowledgment & Consent</h2>
        </div>
        <div className="p-5 space-y-4">
          {tpl?.photo_video_release_enabled && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={photoVideoConsent}
                onChange={(e) => setPhotoVideoConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I consent to the use of photos and video taken during this visit for promotional purposes.
              </span>
            </label>
          )}

          {tpl?.marketing_consent_enabled && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  {tpl.marketing_consent_text || 'Keep me updated on future events, coupons, and special offers.'}
                  {tpl.marketing_helper_text && (
                    <span className="block text-[11px] text-gray-400 mt-1">{tpl.marketing_helper_text}</span>
                  )}
                </span>
              </label>
            </div>
          )}

          <div className="pt-1">
            <label className={labelClass}>Type your full legal name *</label>
            <input
              type="text"
              value={typedLegalName}
              autoComplete={autoCompleteOff}
              onChange={(e) => setTypedLegalName(e.target.value)}
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

          {tpl?.electronic_consent_enabled && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={electronicConsent}
                onChange={(e) => setElectronicConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree that my electronic signature is the legal equivalent of my handwritten signature.
              </span>
            </label>
          )}
          {formErrors.electronicConsent && (
            <p className="text-[11px] text-red-600 -mt-2">{formErrors.electronicConsent}</p>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-gray-100 mt-1">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => setAgreementAccepted(e.target.checked)}
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
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting...
          </span>
        ) : (
          'Sign & Submit Waiver'
        )}
      </button>
    </form>
  );
};

export default WaiverFormBody;
