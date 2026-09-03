import { useState } from 'react';
import type {
  WaiverMinor,
  WaiverProfileRecord,
  WaiverProfileDependentRecord,
  WaiverReturningSelection,
} from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import DateOfBirthSelect from './DateOfBirthSelect';
import RelationshipSelect from './RelationshipSelect';
import { calculateAge, isFutureDate } from '../../utils/age';
import { formatDateLong } from '../../utils/timeFormat';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';
const labelClass = 'block text-xs font-semibold text-gray-700 mb-1';
const primaryButtonClass =
  'w-full py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryButtonClass =
  'w-full py-3 bg-white text-gray-600 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

interface DraftDependent extends WaiverMinor {
  _key: number;
}

let draftKeySeq = 1;

const describeDependent = (dependent: {
  age?: number | null;
  date_of_birth?: string | null;
  relationship?: string | null;
}): string => {
  const age = dependent.age ?? calculateAge(dependent.date_of_birth);
  const parts = [
    age !== null && age !== undefined ? `Age ${age}` : null,
    dependent.relationship || null,
  ].filter(Boolean);
  return parts.join(' · ');
};

const ReadOnlyRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value || '—'}</p>
  </div>
);

export const WaiverReturningSummary = ({
  profile,
  selection,
}: {
  profile: WaiverProfileRecord;
  selection: WaiverReturningSelection;
}) => {
  const saved = profile.dependents.filter((d) => selection.selected_dependent_ids.includes(d.id));
  const total = saved.length + selection.new_dependents.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Participating Today</h2>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {total > 0
            ? `${profile.first_name} ${profile.last_name} plus ${total} dependent${total === 1 ? '' : 's'}.`
            : `${profile.first_name} ${profile.last_name} only.`}
        </p>
      </div>
      <div className="p-5 space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/40 px-3.5 py-2.5">
          <span className="text-sm font-medium text-gray-900">
            {profile.first_name} {profile.last_name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Signer</span>
        </div>
        {saved.map((dependent) => (
          <div
            key={dependent.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/40 px-3.5 py-2.5"
          >
            <span className="text-sm text-gray-800">
              {dependent.first_name} {dependent.last_name}
            </span>
            <span className="text-[11px] text-gray-500">{describeDependent(dependent)}</span>
          </div>
        ))}
        {selection.new_dependents.map((dependent, i) => (
          <div
            key={`new-${i}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3.5 py-2.5"
          >
            <span className="text-sm text-gray-800">
              {dependent.first_name} {dependent.last_name}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">{describeDependent(dependent)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">New</span>
            </span>
          </div>
        ))}
        {total === 0 && (
          <p className="text-xs text-gray-400 text-center py-1">
            No dependents selected — this waiver covers the signer only.
          </p>
        )}
      </div>
    </div>
  );
};

interface Props {
  templateId: number;
  profile: WaiverProfileRecord | null;
  maxMinors: number;
  dependentsEnabled: boolean;
  onFound: (profile: WaiverProfileRecord) => void;
  onContinue: (selection: WaiverReturningSelection) => void;
  onNewCustomer: () => void;
  onCancel: () => void;
}

const WaiverReturningPanel = ({
  templateId,
  profile,
  maxMinors,
  dependentsEnabled,
  onFound,
  onContinue,
  onNewCustomer,
  onCancel,
}: Props) => {
  const [phone, setPhone] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'idle' | 'not_found' | 'needs_staff'>('idle');

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<DraftDependent[]>([]);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = phone.trim();
    if (!value) {
      setLookupError('Please enter your phone number.');
      return;
    }
    setLooking(true);
    setLookupError(null);
    setOutcome('idle');
    try {
      const result = await waiverService.kioskLookup(templateId, value);
      if (result.status === 'found' && result.profile) {
        onFound(result.profile);
        return;
      }
      setOutcome(result.status === 'needs_staff' ? 'needs_staff' : 'not_found');
    } catch (err: unknown) {
      const e2 = err as { response?: { status?: number; data?: { message?: string } } };
      setLookupError(
        e2.response?.status === 429
          ? 'Too many lookups from this kiosk. Please wait a moment or ask the front desk for help.'
          : e2.response?.data?.message || 'We could not check that number. Please try again.',
      );
    } finally {
      setLooking(false);
    }
  };

  const tryAgain = () => {
    setPhone('');
    setOutcome('idle');
    setLookupError(null);
  };

  const toggleDependent = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));

  const addDraft = () =>
    setDrafts((prev) => [
      ...prev,
      { _key: draftKeySeq++, first_name: '', last_name: '', date_of_birth: '', relationship: '' },
    ]);

  const removeDraft = (key: number) => setDrafts((prev) => prev.filter((d) => d._key !== key));

  const updateDraft = (key: number, field: keyof WaiverMinor, value: string) =>
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, [field]: value } : d)));

  const participantCount = selectedIds.length + drafts.length;
  const atCap = maxMinors > 0 && participantCount >= maxMinors;

  const handleContinue = () => {
    if (!profile) return;
    const errs: Record<string, string> = {};
    drafts.forEach((d, i) => {
      if (!d.first_name.trim()) errs[`d_${i}_first`] = 'Required';
      if (!d.last_name.trim()) errs[`d_${i}_last`] = 'Required';
      if (!d.date_of_birth) errs[`d_${i}_dob`] = 'Required';
      else if (isFutureDate(d.date_of_birth)) errs[`d_${i}_dob`] = 'Cannot be in the future';
      if (!d.relationship?.trim()) errs[`d_${i}_rel`] = 'Required';
    });
    setDraftErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onContinue({
      waiver_profile_id: profile.id,
      selected_dependent_ids: selectedIds,
      new_dependents: drafts.map((d) => ({
        first_name: d.first_name.trim(),
        last_name: d.last_name.trim(),
        date_of_birth: d.date_of_birth || undefined,
        relationship: d.relationship?.trim() || undefined,
      })),
    });
  };

  if (!profile) {
    if (outcome === 'needs_staff') {
      return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 sm:px-10">
          <div className="max-w-md mx-auto text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-900">Please see the front desk</p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              We need a Location Manager or Admin to help with this phone number before you can continue. They will get
              you signed in right away.
            </p>
            <div className="mt-6 space-y-3">
              <button type="button" onClick={tryAgain} className={primaryButtonClass}>
                Use a Different Number
              </button>
              <button type="button" onClick={onCancel} className={secondaryButtonClass}>
                Back to Start
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (outcome === 'not_found') {
      return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 sm:px-10">
          <div className="max-w-md mx-auto text-center">
            <p className="text-lg font-bold text-gray-900">No Record Found</p>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              We could not find a waiver on file for that phone number. Double-check the number, or continue as a new
              customer — it only takes a minute.
            </p>
            <div className="mt-6 space-y-3">
              <button type="button" onClick={tryAgain} className={primaryButtonClass}>
                Try Again
              </button>
              <button
                type="button"
                onClick={onNewCustomer}
                className="w-full py-4 bg-white text-blue-700 text-base font-semibold rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                New Customer
              </button>
              <button type="button" onClick={onCancel} className={secondaryButtonClass}>
                Back to Start
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 sm:px-10">
        <form onSubmit={handleLookup} className="max-w-md mx-auto" autoComplete="off">
          <h2 className="text-lg font-bold text-gray-900 text-center">Find My Information</h2>
          <p className="text-sm text-gray-500 mt-2 text-center leading-relaxed">
            Enter the phone number you used on your last waiver and we will pull up your saved information.
          </p>
          <div className="mt-6">
            <label className={labelClass}>Phone Number *</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              autoComplete="off"
              placeholder="(555) 123-4567"
              onChange={(e) => {
                setPhone(e.target.value);
                setLookupError(null);
              }}
              className={`${inputClass} py-3 text-base ${lookupError ? 'border-red-300' : ''}`}
            />
            {lookupError && <p className="text-[11px] text-red-600 mt-1">{lookupError}</p>}
          </div>
          <button type="submit" disabled={looking} className={`${primaryButtonClass} mt-5`}>
            {looking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Looking you up...
              </span>
            ) : (
              'Find My Information'
            )}
          </button>
          <button type="button" onClick={onCancel} className={`${secondaryButtonClass} mt-3`}>
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Your Information</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Welcome back, {profile.first_name}!</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyRow label="First Name" value={profile.first_name} />
          <ReadOnlyRow label="Last Name" value={profile.last_name} />
          <ReadOnlyRow label="Email" value={profile.email || ''} />
          <ReadOnlyRow label="Phone" value={profile.phone || ''} />
          <ReadOnlyRow label="Date of Birth" value={profile.date_of_birth ? formatDateLong(profile.date_of_birth) : ''} />
        </div>
        <div className="mx-5 mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-gray-600">
            Your saved information cannot be changed here. If anything above is wrong, please ask a Location Manager or
            Admin at the front desk to update it for you.
          </p>
        </div>
      </div>

      {dependentsEnabled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Who Is Participating Today?</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Check everyone joining you today. Anyone you leave unchecked stays on your record for next time.
              </p>
            </div>
            <button
              type="button"
              onClick={addDraft}
              disabled={atCap}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold rounded-lg hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              + Add New Dependent
            </button>
          </div>
          <div className="p-5 space-y-3">
            {profile.dependents.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                No dependents saved on your record. You can add one below, or continue signing for yourself.
              </p>
            )}
            {profile.dependents.map((dependent: WaiverProfileDependentRecord) => {
              const checked = selectedIds.includes(dependent.id);
              return (
                <label
                  key={dependent.id}
                  className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 cursor-pointer transition ${
                    checked ? 'border-blue-300 bg-blue-50/60' : 'border-gray-100 bg-gray-50/40 hover:border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && atCap}
                    onChange={() => toggleDependent(dependent.id)}
                    className="h-5 w-5 text-blue-700 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-40"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">
                      {dependent.first_name} {dependent.last_name}
                    </span>
                    <span className="block text-[11px] text-gray-500">{describeDependent(dependent) || 'Saved dependent'}</span>
                  </span>
                </label>
              );
            })}

            {drafts.map((draft, i) => (
              <div key={draft._key} className="border border-blue-100 rounded-lg p-4 bg-blue-50/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-blue-800">New Dependent {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft._key)}
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
                      value={draft.first_name}
                      autoComplete="off"
                      onChange={(e) => updateDraft(draft._key, 'first_name', e.target.value)}
                      className={`${inputClass} ${draftErrors[`d_${i}_first`] ? 'border-red-300' : ''}`}
                    />
                    {draftErrors[`d_${i}_first`] && (
                      <p className="text-[11px] text-red-600 mt-1">{draftErrors[`d_${i}_first`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Last Name *</label>
                    <input
                      type="text"
                      value={draft.last_name}
                      autoComplete="off"
                      onChange={(e) => updateDraft(draft._key, 'last_name', e.target.value)}
                      className={`${inputClass} ${draftErrors[`d_${i}_last`] ? 'border-red-300' : ''}`}
                    />
                    {draftErrors[`d_${i}_last`] && (
                      <p className="text-[11px] text-red-600 mt-1">{draftErrors[`d_${i}_last`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Date of Birth *</label>
                    <DateOfBirthSelect
                      value={draft.date_of_birth ?? ''}
                      onChange={(v) => updateDraft(draft._key, 'date_of_birth', v)}
                      error={!!draftErrors[`d_${i}_dob`]}
                    />
                    {draftErrors[`d_${i}_dob`] && (
                      <p className="text-[11px] text-red-600 mt-1">{draftErrors[`d_${i}_dob`]}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Relationship *</label>
                    <RelationshipSelect
                      value={draft.relationship ?? ''}
                      direction="minor_to_signer"
                      autoComplete="off"
                      onChange={(v) => updateDraft(draft._key, 'relationship', v)}
                      error={!!draftErrors[`d_${i}_rel`]}
                    />
                    {draftErrors[`d_${i}_rel`] && (
                      <p className="text-[11px] text-red-600 mt-1">{draftErrors[`d_${i}_rel`]}</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-blue-800/80">
                  We will save this dependent to your record so you can just check the box next visit.
                </p>
              </div>
            ))}

            {atCap && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This waiver covers up to {maxMinors} dependent{maxMinors === 1 ? '' : 's'} per signer. Please ask the
                front desk if you need to add more.
              </p>
            )}
          </div>
        </div>
      )}

      <button type="button" onClick={handleContinue} className={primaryButtonClass}>
        Continue
      </button>
      <button type="button" onClick={onCancel} className={secondaryButtonClass}>
        Start Over
      </button>
    </div>
  );
};

export default WaiverReturningPanel;
