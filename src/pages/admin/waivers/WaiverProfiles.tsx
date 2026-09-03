import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import waiverService from '../../../services/waiverService';
import type {
  WaiverProfileHistoryEntry,
  WaiverProfileListFilters,
  WaiverProfileStaffDependent,
  WaiverProfileStaffRow,
  WaiverProfileStaffView,
} from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';

const PER_PAGE = 25;

const sourceLabels: Record<string, string> = {
  checkout: 'Checkout',
  confirmation_email: 'Email link',
  sms_link: 'SMS link',
  kiosk: 'Kiosk',
  staff_sent: 'Staff sent',
  bulk_invite: 'Group invite',
};

const errorMessage = (err: unknown, fallback: string): string => {
  const res = (err as { response?: { data?: { message?: string } } })?.response;
  return res?.data?.message || fallback;
};

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm text-gray-900 font-medium mt-0.5 break-words">{value ?? '—'}</div>
  </div>
);

const Section = ({ icon: Icon, title, action, children }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-gray-100">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

const ReviewBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
    <AlertTriangle className="w-3 h-3" />Needs review
  </span>
);

interface DependentDraft {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  relationship: string;
}

const emptyDependent: DependentDraft = { first_name: '', last_name: '', date_of_birth: '', relationship: '' };

const WaiverProfiles = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();

  const [rows, setRows] = useState<WaiverProfileStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const filters: WaiverProfileListFilters = { per_page: PER_PAGE, page };
      if (search) filters.search = search;
      if (reviewOnly) filters.needs_review = 1;

      const res = await waiverService.listProfiles(filters);
      if (!res.success) {
        setRows([]);
        return;
      }
      setRows(res.data || []);
      setLastPage(res.meta?.last_page ?? 1);
      setTotal(res.meta?.total ?? 0);
    } catch (err) {
      setRows([]);
      setToast({ message: errorMessage(err, 'Failed to load returning customers'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, reviewOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const reviewCount = useMemo(() => rows.filter((r) => r.needs_staff_review).length, [rows]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  }, []);

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Returning Customers</h1>
          <p className="text-gray-600 mt-1">
            Saved customer and dependent details behind the kiosk phone lookup. Guests cannot change these — you can.
          </p>
        </div>
        <StandardButton variant="secondary" size="md" icon={ArrowLeft} onClick={() => navigate('/waivers')}>
          Back to Waivers
        </StandardButton>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email or phone — any format"
              className={`w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:outline-none`}
              aria-label="Search returning customers"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewOnly}
              onChange={(e) => { setReviewOnly(e.target.checked); setPage(1); }}
              className={`h-4 w-4 text-${fullColor} rounded border-gray-300`}
            />
            Needs review only
          </label>
          <StandardButton variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</StandardButton>
          <p className="sm:ml-auto text-sm text-gray-600" aria-live="polite">
            {loading ? 'Counting…' : (
              <>
                <span className="font-semibold text-gray-900 tabular-nums">{total}</span>
                {' '}record{total === 1 ? '' : 's'}
                {reviewCount > 0 && <span className="text-amber-700">{` · ${reviewCount} on this page need review`}</span>}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/60">
              <tr>
                {['Customer', 'Phone', 'Dependents', 'Submissions', 'Last visit', 'Last location'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className={`w-6 h-6 mx-auto animate-spin text-${themeColor}-600`} />
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {search || reviewOnly
                        ? 'No returning customers match this search.'
                        : 'No returning customers yet. A record is created the first time someone signs a waiver.'}
                    </p>
                  </td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{row.full_name || `Record #${row.id}`}</span>
                      {row.needs_staff_review && <ReviewBadge />}
                    </div>
                    {row.email && <div className="text-xs text-gray-500 mt-0.5 break-all">{row.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{row.dependents_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{row.submissions_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {row.last_waiver_at ? formatDateTimeET(row.last_waiver_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.last_location_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-sm text-gray-500">Page {page} of {lastPage}</span>
            <div className="flex items-center gap-2">
              <StandardButton variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </StandardButton>
              <StandardButton variant="secondary" size="sm" icon={ChevronRight} iconPosition="right" disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>
                Next
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {openId !== null && (
        <ProfileDetailModal
          profileId={openId}
          themeColor={themeColor}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onNotify={notify}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const ProfileDetailModal = ({ profileId, themeColor, onClose, onChanged, onNotify }: {
  profileId: number;
  themeColor: string;
  onClose: () => void;
  onChanged: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}) => {
  const [view, setView] = useState<WaiverProfileStaffView | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', date_of_birth: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<DependentDraft>(emptyDependent);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DependentDraft>(emptyDependent);
  const [dependentBusy, setDependentBusy] = useState(false);
  const [dependentError, setDependentError] = useState<string | null>(null);

  const applyView = useCallback((next: WaiverProfileStaffView) => {
    setView(next);
    setForm({
      first_name: next.profile.first_name || '',
      last_name: next.profile.last_name || '',
      email: next.profile.email || '',
      date_of_birth: next.profile.date_of_birth || '',
      phone: next.profile.phone || '',
    });
  }, []);

  const reload = useCallback(async () => {
    const res = await waiverService.getProfile(profileId);
    if (res.success) applyView(res.data);
  }, [profileId, applyView]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    waiverService
      .getProfile(profileId)
      .then((res) => {
        if (cancelled || !res.success) return;
        applyView(res.data);
      })
      .catch((err) => {
        if (!cancelled) onNotify(errorMessage(err, 'Failed to load that customer record'), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [profileId, applyView, onNotify]);

  const saveProfile = async () => {
    setFormError(null);
    setSavingProfile(true);
    try {
      const res = await waiverService.updateProfile(profileId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone.trim(),
      });
      if (res.success) {
        applyView(res.data);
        onChanged();
        onNotify('Customer details saved', 'success');
      }
    } catch (err) {
      setFormError(errorMessage(err, 'Those details could not be saved'));
    } finally {
      setSavingProfile(false);
    }
  };

  const clearReview = async () => {
    setSavingProfile(true);
    try {
      const res = await waiverService.updateProfile(profileId, { needs_staff_review: false });
      if (res.success) {
        applyView(res.data);
        onChanged();
        onNotify('Record marked as resolved. The kiosk lookup will find it again.', 'success');
      }
    } catch (err) {
      onNotify(errorMessage(err, 'That flag could not be cleared'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const runDependentAction = async (action: () => Promise<{ success: boolean }>, message: string) => {
    setDependentError(null);
    setDependentBusy(true);
    try {
      const res = await action();
      if (res.success) {
        await reload();
        onChanged();
        onNotify(message, 'success');
        return true;
      }
      return false;
    } catch (err) {
      setDependentError(errorMessage(err, 'That dependent could not be saved'));
      return false;
    } finally {
      setDependentBusy(false);
    }
  };

  const addDependent = async () => {
    const ok = await runDependentAction(
      () => waiverService.addProfileDependent(profileId, {
        first_name: addDraft.first_name.trim(),
        last_name: addDraft.last_name.trim(),
        date_of_birth: addDraft.date_of_birth || null,
        relationship: addDraft.relationship.trim() || null,
      }),
      'Dependent added to the record',
    );
    if (ok) {
      setAddDraft(emptyDependent);
      setAddOpen(false);
    }
  };

  const saveDependent = async (dependent: WaiverProfileStaffDependent) => {
    const ok = await runDependentAction(
      () => waiverService.updateProfileDependent(dependent.id, {
        first_name: editDraft.first_name.trim(),
        last_name: editDraft.last_name.trim(),
        date_of_birth: editDraft.date_of_birth || null,
        relationship: editDraft.relationship.trim() || null,
      }),
      'Dependent updated',
    );
    if (ok) setEditingId(null);
  };

  const startEdit = (dependent: WaiverProfileStaffDependent) => {
    setDependentError(null);
    setEditingId(dependent.id);
    setEditDraft({
      first_name: dependent.first_name || '',
      last_name: dependent.last_name || '',
      date_of_birth: dependent.date_of_birth || '',
      relationship: dependent.relationship || '',
    });
  };

  const inputClass = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:outline-none`;
  const profile = view?.profile;
  const sharedPhone = view?.shared_phone_profiles ?? [];
  const canSave = form.first_name.trim() !== '' && form.last_name.trim() !== '' && form.phone.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {profile?.full_name || `Record #${profileId}`}
              </h2>
              {profile?.needs_staff_review && <ReviewBadge />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Customer record #{profileId}
              {profile?.submissions_count != null && ` · ${profile.submissions_count} waiver${profile.submissions_count === 1 ? '' : 's'} signed`}
              {profile?.created_at && ` · on file since ${formatDateLong(profile.created_at)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {loading && (
            <div className="py-12 flex justify-center">
              <Loader2 className={`w-6 h-6 animate-spin text-${themeColor}-600`} />
            </div>
          )}

          {!loading && !view && (
            <p className="py-12 text-center text-gray-500">That customer record could not be loaded.</p>
          )}

          {!loading && view && profile && (
            <>
              {(profile.needs_staff_review || sharedPhone.length > 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 text-sm text-amber-900">
                      <p className="font-semibold">This record needs a decision before the kiosk will use it.</p>
                      <p className="mt-1">
                        {sharedPhone.length > 0
                          ? 'More than one customer answers to this phone number, so the lookup cannot tell them apart. Give each person their own number, then clear the flag.'
                          : 'A waiver arrived on this number under a different name. Confirm the details below are the right person, then clear the flag.'}
                      </p>
                      {sharedPhone.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {sharedPhone.map((other) => (
                            <li key={other.id} className="text-xs">
                              <span className="font-semibold">{other.name || `Record #${other.id}`}</span>
                              {other.email ? ` · ${other.email}` : ''}
                              {` · ${other.submissions_count} signed`}
                              {other.last_waiver_at ? ` · last ${formatDateLong(other.last_waiver_at)}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                      {profile.needs_staff_review && (
                        <div className="mt-3">
                          <StandardButton variant="secondary" size="sm" disabled={savingProfile} onClick={clearReview}>
                            Clear the flag
                          </StandardButton>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Section icon={Users} title="Saved customer details">
                <p className="text-xs text-gray-500 mb-3">
                  The kiosk shows these read-only. Anything wrong has to be corrected here.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1" htmlFor="profile-first">First name</label>
                    <input id="profile-first" className={inputClass} value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1" htmlFor="profile-last">Last name</label>
                    <input id="profile-last" className={inputClass} value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1" htmlFor="profile-email">Email</label>
                    <input id="profile-email" type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1" htmlFor="profile-dob">Date of birth</label>
                    <input id="profile-dob" type="date" className={inputClass} value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1" htmlFor="profile-phone">Phone (lookup key)</label>
                    <input id="profile-phone" type="tel" inputMode="tel" className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">This is how the guest finds themselves at the kiosk.</p>
                  </div>
                  <div className="flex items-end">
                    <Field label="Last seen at" value={profile.last_location_name} />
                  </div>
                </div>
                {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
                <div className="mt-3 flex justify-end">
                  <StandardButton variant="primary" size="sm" disabled={savingProfile || !canSave} onClick={saveProfile}>
                    {savingProfile ? 'Saving…' : 'Save details'}
                  </StandardButton>
                </div>
              </Section>

              <Section
                icon={Users}
                title={`Saved dependents (${profile.dependents.filter((d) => d.is_active).length})`}
                action={
                  <StandardButton variant="secondary" size="sm" icon={UserPlus} onClick={() => { setDependentError(null); setAddOpen((v) => !v); }}>
                    Add dependent
                  </StandardButton>
                }
              >
                {addOpen && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={inputClass} placeholder="First name" value={addDraft.first_name} onChange={(e) => setAddDraft((d) => ({ ...d, first_name: e.target.value }))} aria-label="Dependent first name" />
                    <input className={inputClass} placeholder="Last name" value={addDraft.last_name} onChange={(e) => setAddDraft((d) => ({ ...d, last_name: e.target.value }))} aria-label="Dependent last name" />
                    <input className={inputClass} type="date" value={addDraft.date_of_birth} onChange={(e) => setAddDraft((d) => ({ ...d, date_of_birth: e.target.value }))} aria-label="Dependent date of birth" />
                    <input className={inputClass} placeholder="Relationship" value={addDraft.relationship} onChange={(e) => setAddDraft((d) => ({ ...d, relationship: e.target.value }))} aria-label="Dependent relationship" />
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <StandardButton variant="secondary" size="sm" onClick={() => { setAddOpen(false); setAddDraft(emptyDependent); }}>Cancel</StandardButton>
                      <StandardButton
                        variant="primary"
                        size="sm"
                        disabled={dependentBusy || !addDraft.first_name.trim() || !addDraft.last_name.trim()}
                        onClick={addDependent}
                      >
                        {dependentBusy ? 'Saving…' : 'Add'}
                      </StandardButton>
                    </div>
                  </div>
                )}

                {dependentError && <p className="mb-3 text-sm text-red-600">{dependentError}</p>}

                {profile.dependents.length === 0 ? (
                  <p className="text-sm text-gray-500">No dependents on this record yet.</p>
                ) : (
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {profile.dependents.map((dependent) => (
                      <div key={dependent.id} className="px-3 py-2.5">
                        {editingId === dependent.id ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input className={inputClass} value={editDraft.first_name} onChange={(e) => setEditDraft((d) => ({ ...d, first_name: e.target.value }))} aria-label="First name" />
                            <input className={inputClass} value={editDraft.last_name} onChange={(e) => setEditDraft((d) => ({ ...d, last_name: e.target.value }))} aria-label="Last name" />
                            <input className={inputClass} type="date" value={editDraft.date_of_birth} onChange={(e) => setEditDraft((d) => ({ ...d, date_of_birth: e.target.value }))} aria-label="Date of birth" />
                            <input className={inputClass} placeholder="Relationship" value={editDraft.relationship} onChange={(e) => setEditDraft((d) => ({ ...d, relationship: e.target.value }))} aria-label="Relationship" />
                            <div className="sm:col-span-2 flex justify-end gap-2">
                              <StandardButton variant="secondary" size="sm" onClick={() => setEditingId(null)}>Cancel</StandardButton>
                              <StandardButton
                                variant="primary"
                                size="sm"
                                disabled={dependentBusy || !editDraft.first_name.trim() || !editDraft.last_name.trim()}
                                onClick={() => saveDependent(dependent)}
                              >
                                {dependentBusy ? 'Saving…' : 'Save'}
                              </StandardButton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${dependent.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                  {dependent.full_name}
                                </span>
                                {!dependent.is_active && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Retired</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {[dependent.date_of_birth ? formatDateLong(dependent.date_of_birth) : null, dependent.relationship].filter(Boolean).join(' · ') || '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => startEdit(dependent)}
                                className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
                                title="Edit dependent"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {dependent.is_active ? (
                                <button
                                  onClick={() => runDependentAction(() => waiverService.retireProfileDependent(dependent.id), 'Dependent retired')}
                                  disabled={dependentBusy}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Retire — past waivers keep them"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => runDependentAction(() => waiverService.updateProfileDependent(dependent.id, { is_active: true }), 'Dependent restored')}
                                  disabled={dependentBusy}
                                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Bring back"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Retiring keeps the person on every waiver they were already on — it only takes them off the kiosk list.
                </p>
              </Section>

              <Section icon={History} title={`Submission history (${view.history.length})`}>
                {view.history.length === 0 ? (
                  <p className="text-sm text-gray-500">No submissions recorded against this record yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {view.history.map((entry) => (
                      <HistoryEntry key={entry.id} entry={entry} />
                    ))}
                  </ol>
                )}
              </Section>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <StandardButton variant="secondary" onClick={onClose}>Close</StandardButton>
        </div>
      </div>
    </div>
  );
};

const HistoryEntry = ({ entry }: { entry: WaiverProfileHistoryEntry }) => (
  <li className="border border-gray-100 rounded-lg overflow-hidden">
    <div className="px-3 py-2 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
      <div className="min-w-0">
        <span className="text-sm font-semibold text-gray-900">
          {entry.submitted_at ? formatDateTimeET(entry.submitted_at) : 'Not submitted'}
        </span>
        <span className="text-xs text-gray-500">{` · Waiver #${entry.id}`}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {entry.status !== 'completed' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
          </span>
        )}
        {entry.new_dependents_count > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {entry.new_dependents_count} new
          </span>
        )}
        {entry.has_signature && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-3 h-3" />Signed
          </span>
        )}
      </div>
    </div>
    <div className="px-3 py-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Field label="Waiver" value={entry.template_title} />
        <Field label="Version" value={entry.version != null ? `v${entry.version}` : null} />
        <Field label="Location" value={entry.location_name} />
        <Field label="Signed by" value={entry.typed_legal_name} />
        <Field label="Source" value={entry.source ? sourceLabels[entry.source] || entry.source : null} />
        <Field label="Checked in" value={entry.checked_in_at ? formatDateTimeET(entry.checked_in_at) : 'Not checked in'} />
      </div>
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide">
          Dependents included ({entry.dependents.length})
        </div>
        {entry.dependents.length === 0 ? (
          <div className="text-sm text-gray-500 mt-0.5">Primary guest only</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {entry.dependents.map((dependent) => (
              <span
                key={dependent.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dependent.was_new_this_visit ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-gray-100 text-gray-700'}`}
                title={dependent.was_new_this_visit ? 'Added to the record on this visit' : 'Already on the record'}
              >
                {dependent.name}
                {dependent.was_new_this_visit && <span className="font-semibold">new</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  </li>
);

export default WaiverProfiles;
