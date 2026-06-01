import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, CreditCard, MapPin, Building2, Lock, Sparkles, DollarSign, Eye, EyeOff, KeyRound } from 'lucide-react';
import membershipService from '../../../services/MembershipService';
import { membershipCache } from '../../../services/MembershipCacheService';
import locationService from '../../../services/LocationService';
import { connectAuthorizeNetAccount } from '../../../services/SettingsService';
import type { MembershipPlan, CreateMembershipPlanData } from '../../../types/Membership.types';
import type { Location } from '../../../services/LocationService';
import Toast from '../../../components/ui/Toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import StandardButton from '../../../components/ui/StandardButton';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import PlanBenefitsManager from '../../../components/membership/PlanBenefitsManager';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatMembershipPrice } from '../../../utils/membershipFormat';
import { getStoredUser } from '../../../utils/storage';

const emptyForm: CreateMembershipPlanData = {
  name: '',
  description: '',
  price: 0,
  billing_interval: 'monthly',
  term_length_months: 1,
  usage_type: 'unlimited',
  unlimited_uses: true,
  unlimited_visits: true,
  included_visits_per_term: null,
  max_visits_per_day: null,
  punch_card_total: null,
  location_access_mode: 'single',
  location_id: null,
  approved_location_ids: [],
  billing_location_id: null,
  grace_period_days: 7,
  failed_payment_retry_days: 3,
  cancellation_mode: 'end_of_term',
  trial_days: 0,
  requires_photo: true,
  is_family_or_group: false,
  max_family_size: null,
  is_active: true,
};

const MembershipPlans = () => {
  const { themeColor } = useThemeColor();
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';
  const isLocationManager = user?.role === 'location_manager';
  const canManagePlans = isCompanyAdmin || isLocationManager;

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState<CreateMembershipPlanData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [benefitsPlan, setBenefitsPlan] = useState<MembershipPlan | null>(null);
  const { toast, showSuccess, showError, clear } = useToast();

  // Authorize.Net add-account modal
  const emptyAuthForm = { location_id: null as number | null, api_login_id: '', transaction_key: '', public_client_key: '', environment: 'sandbox' as 'sandbox' | 'production' };
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [savingAuth, setSavingAuth] = useState(false);
  const [showTxKey, setShowTxKey] = useState(false);
  const [showPubKey, setShowPubKey] = useState(false);

  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;
  const labelCls = 'block text-xs font-medium text-gray-800 mb-1';

  const TipLabel = ({ children, tip }: { children: React.ReactNode; tip: React.ReactNode }) => (
    <label className={`${labelCls} flex items-center gap-1`}>
      {children}
      <InfoTooltip content={tip} />
    </label>
  );

  const load = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const list = await membershipCache.getPlans(forceRefresh);
      setPlans(list);
    } catch (e: unknown) {
      showError(e, 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    locationService.getLocations().then((r) => setLocations(r.data)).catch(() => {});
    const off = membershipCache.onUpdate((detail) => {
      if (detail.key === 'plans' || detail.key === 'all') load();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditing(null);
    const base = { ...emptyForm };
    if (isLocationManager) {
      base.location_access_mode = 'single';
      base.location_id = locations.find((l) => l.name === user?.location_name)?.id ?? null;
    }
    setForm(base);
    setShowForm(true);
  };

  const startEdit = (p: MembershipPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: Number(p.price),
      billing_interval: p.billing_interval,
      term_length_months: p.term_length_months ?? null,
      usage_type: p.usage_type,
      unlimited_uses: p.unlimited_uses,
      unlimited_visits: p.unlimited_visits,
      included_visits_per_term: p.included_visits_per_term ?? null,
      max_visits_per_day: p.max_visits_per_day ?? null,
      punch_card_total: p.punch_card_total ?? null,
      location_access_mode: p.location_access_mode,
      location_id: p.location?.id ?? null,
      approved_location_ids: p.approved_locations?.map((l) => l.id) || [],
      billing_location_id: p.billing_location_id ?? null,
      grace_period_days: p.grace_period_days,
      failed_payment_retry_days: p.failed_payment_retry_days,
      cancellation_mode: p.cancellation_mode,
      trial_days: p.trial_days ?? 0,
      requires_photo: p.requires_photo,
      is_family_or_group: p.is_family_or_group,
      max_family_size: p.max_family_size ?? null,
      is_active: p.is_active,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: CreateMembershipPlanData = { ...form };
      if (editing) {
        await membershipService.updatePlan(editing.id, payload);
        showSuccess('Plan updated');
      } else {
        await membershipService.createPlan(payload);
        showSuccess('Plan created');
      }
      setShowForm(false);
      await membershipCache.invalidate('plans');
      await membershipCache.invalidate('publicPlans');
      load(true);
    } catch (e: unknown) {
      showError(e, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: MembershipPlan) => {
    try {
      await membershipService.togglePlanStatus(p.id);
      await membershipCache.invalidate('plans');
      await membershipCache.invalidate('publicPlans');
      load(true);
    } catch (e: unknown) {
      showError(e, 'Toggle failed');
    }
  };

  const remove = async (p: MembershipPlan) => {
    if (!window.confirm(`Delete plan "${p.name}"?`)) return;
    try {
      await membershipService.deletePlan(p.id);
      showSuccess('Plan deleted');
      await membershipCache.invalidate('plans');
      await membershipCache.invalidate('publicPlans');
      load(true);
    } catch (e: unknown) {
      showError(e, 'Delete failed');
    }
  };

  const saveAuth = async () => {
    if (!authForm.location_id) { showError(null, 'Select a location for this account'); return; }
    if (!authForm.api_login_id.trim() || !authForm.transaction_key.trim() || !authForm.public_client_key.trim()) {
      showError(null, 'All credential fields are required'); return;
    }
    setSavingAuth(true);
    try {
      const res = await connectAuthorizeNetAccount({
        api_login_id: authForm.api_login_id.trim(),
        transaction_key: authForm.transaction_key.trim(),
        public_client_key: authForm.public_client_key.trim(),
        environment: authForm.environment,
        location_id: authForm.location_id,
      });
      if (res.success) {
        showSuccess('Authorize.Net account connected');
        // Auto-select the location as billing location for this plan
        setForm((prev) => ({ ...prev, billing_location_id: authForm.location_id }));
        setAuthForm(emptyAuthForm);
        setShowAuthModal(false);
        // Refresh location list in case new location was indirectly added
        locationService.getLocations().then((r) => setLocations(r.data)).catch(() => {});
      } else {
        showError(null, (res as any).message ?? 'Failed to connect account');
      }
    } catch (e: unknown) {
      showError(e, 'Failed to connect Authorize.Net account');
    } finally {
      setSavingAuth(false);
    }
  };

  return (
    <div className="px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Membership Plans
            <InfoTooltip
              widthClass="w-80"
              content="Create and manage the membership tiers customers can subscribe to. Each plan defines its own price, billing cadence, included visits and access rules."
            />
          </h1>
          <p className="text-gray-600 mt-1">Pricing, billing cadence, and access rules</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          {canManagePlans && (
            <StandardButton variant="primary" size="md" icon={Plus} onClick={startCreate}>
              New Plan
            </StandardButton>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><LoadingSpinner size="medium" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Name <InfoTooltip content="Plan name shown to customers." size={11} /></span></th>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Price <InfoTooltip content="Amount charged per billing cycle." size={11} /></span></th>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Interval <InfoTooltip content="How often the member is auto-charged. 'One-time' means no recurring charge." size={11} /></span></th>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Usage <InfoTooltip widthClass="w-60" content={<><b>Unlimited</b> · no caps<br/><b>Limited visits</b> · fixed per term<br/><b>Punch card</b> · fixed total visits, no reset</>} size={11} /></span></th>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Access <InfoTooltip widthClass="w-60" content={<><b>Single</b> · only home location<br/><b>Multi</b> · approved locations only<br/><b>All</b> · every location</>} size={11} /></span></th>
                  <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1">Status <InfoTooltip content="Inactive plans stay in admin but cannot be purchased by new customers." size={11} /></span></th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      <div className="inline-flex flex-col items-center gap-2">
                        <div className={`p-3 rounded-full bg-${themeColor}-50`}>
                          <CreditCard className={`w-6 h-6 text-${themeColor}-600`} />
                        </div>
                        No plans yet. Click <span className="font-medium">New Plan</span> to create one.
                      </div>
                    </td>
                  </tr>
                ) : (
                  plans.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-4 text-gray-700">{formatMembershipPrice(p.price)}</td>
                      <td className="px-4 py-4 capitalize text-gray-600">{p.billing_interval.replace('_', ' ')}</td>
                      <td className="px-4 py-4 capitalize text-gray-600">{p.usage_type.replace('_', ' ')}</td>
                      <td className="px-4 py-4 capitalize text-gray-600">{p.location_access_mode}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggle(p)}
                          className="inline-flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900"
                        >
                          {p.is_active ? (
                            <ToggleRight className="w-5 h-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                          <span className={p.is_active ? 'text-green-700' : 'text-gray-500'}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {canManagePlans ? (
                          <div className="inline-flex items-center gap-2">
                            <StandardButton variant="secondary" size="sm" icon={Sparkles} onClick={() => setBenefitsPlan(p)}>
                              Benefits
                            </StandardButton>
                            <StandardButton variant="secondary" size="sm" icon={Edit2} onClick={() => startEdit(p)}>
                              Edit
                            </StandardButton>
                            <StandardButton variant="danger" size="sm" icon={Trash2} onClick={() => remove(p)}>
                              Delete
                            </StandardButton>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">View only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className={`px-5 py-5 bg-${themeColor}-50 border-b border-gray-100 flex items-center justify-between`}>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Plan' : 'New Plan'}</h2>
                <p className="text-xs text-gray-600 mt-0.5">Configure pricing, usage limits, and access rules.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-white/60 text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 overflow-y-auto grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <TipLabel tip="Public name shown to customers and on receipts (e.g. 'Gold Unlimited', 'Family Annual').">Name</TipLabel>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <TipLabel tip="Short marketing blurb shown on the customer purchase page below the price.">Description</TipLabel>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div>
                <TipLabel tip="Amount charged each billing cycle. Set to 0 for a comped/free plan.">Price (USD)</TipLabel>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <TipLabel tip={<>How often the member is auto-charged.<br/><b>One-time</b> means no recurring charge — the membership ends when the term expires.</>}>Billing Interval</TipLabel>
                <select
                  value={form.billing_interval}
                  onChange={(e) => setForm({ ...form, billing_interval: e.target.value as CreateMembershipPlanData['billing_interval'] })}
                  className={inputCls}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
              <div>
                <TipLabel tip="Free trial period in days. During the trial, members have full access but are not charged. Set to 0 to charge immediately at signup.">Trial Period (days)</TipLabel>
                <input
                  type="number"
                  min={0}
                  value={form.trial_days ?? 0}
                  onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <div>
                <TipLabel tip="Length of each paid term in months. Determines when visit allowances reset and when the membership renews/expires.">Term Length (months)</TipLabel>
                <input
                  type="number"
                  value={form.term_length_months ?? ''}
                  onChange={(e) => setForm({ ...form, term_length_months: e.target.value ? parseInt(e.target.value) : null })}
                  className={inputCls}
                />
              </div>
              <div>
                <TipLabel tip={<><b>Unlimited</b> · no caps<br/><b>Limited Visits</b> · fixed visits per term, resets each cycle<br/><b>Punch Card</b> · fixed total visits, no reset, expires when used up</>}>Usage Type</TipLabel>
                <select
                  value={form.usage_type}
                  onChange={(e) => {
                    const ut = e.target.value as CreateMembershipPlanData['usage_type'];
                    setForm({
                      ...form,
                      usage_type: ut,
                      unlimited_visits: ut === 'unlimited',
                      unlimited_uses: ut === 'unlimited',
                      included_visits_per_term: ut === 'limited_visits' ? form.included_visits_per_term : null,
                      punch_card_total: ut === 'punch_card' ? form.punch_card_total : null,
                      max_visits_per_day: ut === 'unlimited' ? null : form.max_visits_per_day,
                    });
                  }}
                  className={inputCls}
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="limited_visits">Limited Visits per Term</option>
                  <option value="punch_card">Punch Card</option>
                </select>
              </div>
              {form.usage_type === 'limited_visits' && (
                <div>
                  <TipLabel tip="Number of visits included each billing cycle. Resets at the start of each term.">Visits per Term</TipLabel>
                  <input
                    type="number"
                    value={form.included_visits_per_term ?? ''}
                    onChange={(e) => setForm({ ...form, included_visits_per_term: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  />
                </div>
              )}
              {form.usage_type !== 'unlimited' && (
                <div>
                  <TipLabel tip="Cap on check-ins per calendar day. Leave blank for no daily limit. Prevents members from burning through visits in a single day.">Max Visits per Day</TipLabel>
                  <input
                    type="number"
                    value={form.max_visits_per_day ?? ''}
                    onChange={(e) => setForm({ ...form, max_visits_per_day: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  />
                </div>
              )}
              {form.usage_type === 'punch_card' && (
                <div>
                  <TipLabel tip="Total visits a punch-card member receives at purchase. The membership ends when these are used up.">Punch Card Total</TipLabel>
                  <input
                    type="number"
                    value={form.punch_card_total ?? ''}
                    onChange={(e) => setForm({ ...form, punch_card_total: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <TipLabel tip={<><b>Single</b> · one specific location<br/><b>Multi</b> · specific approved locations<br/><b>All</b> · every location in the company</>}>Location Access</TipLabel>
                {isLocationManager ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                    <Lock size={13} className="text-gray-400 flex-shrink-0" />
                    Single Home Location
                    <span className="ml-auto text-xs text-gray-400">(your location only)</span>
                  </div>
                ) : (
                  <select
                    value={form.location_access_mode}
                    onChange={(e) => setForm({ ...form, location_access_mode: e.target.value as CreateMembershipPlanData['location_access_mode'], location_id: null, approved_location_ids: [] })}
                    className={inputCls}
                  >
                    <option value="single">Single Home Location</option>
                    <option value="multi">Multi-Location</option>
                    <option value="all">All Company Locations</option>
                  </select>
                )}
              </div>

              {form.location_access_mode === 'single' && (
                <div>
                  <TipLabel tip="The specific location this plan is valid at. Members must pick this location as their home when purchasing.">Plan Location</TipLabel>
                  {isLocationManager ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800">
                      <MapPin size={13} className={`text-${themeColor}-500 flex-shrink-0`} />
                      {locations.find((l) => l.id === form.location_id)?.name || <span className="text-gray-400 italic text-xs">No location assigned to your account</span>}
                    </div>
                  ) : (
                    <select
                      value={form.location_id ?? ''}
                      onChange={(e) => setForm({ ...form, location_id: e.target.value ? Number(e.target.value) : null })}
                      className={inputCls}
                    >
                      <option value="">Select a location…</option>
                      {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {form.location_access_mode === 'multi' && (
                <div>
                  <TipLabel tip="Check each location that members on this plan may use. Members can check in at any of these locations.">
                    Approved Locations
                    <InfoTooltip content="These are the specific locations included with this plan." size={11} />
                  </TipLabel>
                  <div className="grid grid-cols-2 gap-1.5 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    {locations.map((loc) => {
                      const selected = (form.approved_location_ids || []).includes(loc.id);
                      return (
                        <label key={loc.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition ${selected ? `bg-white ring-1 ring-${themeColor}-400 text-${themeColor}-800 font-medium` : 'hover:bg-white text-gray-700'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            className={`accent-${themeColor}-600`}
                            onChange={(e) => {
                              const prev = form.approved_location_ids || [];
                              setForm({
                                ...form,
                                approved_location_ids: e.target.checked
                                  ? [...prev, loc.id]
                                  : prev.filter((id) => id !== loc.id),
                              });
                            }}
                          />
                          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                          {loc.name}
                        </label>
                      );
                    })}
                  </div>
                  {(form.approved_location_ids || []).length === 0 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <Building2 size={11} /> Select at least one location for multi-access plans.
                    </p>
                  )}
                </div>
              )}

              {form.location_access_mode === 'all' && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800 font-medium flex items-center gap-1">
                    <Building2 size={12} /> Valid at all locations:
                  </p>
                  <p className="text-xs text-green-700 mt-1">{locations.map((l) => l.name).join(' · ')}</p>
                </div>
              )}
              {isCompanyAdmin && form.location_access_mode === 'single' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-medium flex items-center gap-1.5">
                    <DollarSign size={12} /> Billing: Auto
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Payments will use the Authorize.Net account registered to{' '}
                    <strong>{locations.find((l) => l.id === form.location_id)?.name ?? 'the selected location'}</strong>.
                    {' '}
                    <button
                      type="button"
                      onClick={() => { setAuthForm({ ...emptyAuthForm, location_id: form.location_id ?? null }); setShowAuthModal(true); }}
                      className="underline hover:no-underline inline-flex items-center gap-0.5"
                    >
                      <KeyRound size={10} /> Add / update credentials
                    </button>
                  </p>
                </div>
              )}
              {isCompanyAdmin && form.location_access_mode !== 'single' && (
                <div>
                  <TipLabel tip="Choose which location's Authorize.Net account handles ALL membership charges for this plan. Leave blank to charge through each member's home location. Use 'Add new account' to register credentials for a new location.">
                    <DollarSign size={12} className="inline" /> Billing Location (Authorize.Net)
                  </TipLabel>
                  <select
                    value={form.billing_location_id ?? ''}
                    onChange={(e) => setForm({ ...form, billing_location_id: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  >
                    <option value="">Each member's home location (default)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setAuthForm({ ...emptyAuthForm, location_id: form.billing_location_id ?? null }); setShowAuthModal(true); }}
                    className={`mt-1.5 text-xs text-${themeColor}-600 hover:text-${themeColor}-800 font-medium flex items-center gap-1 underline underline-offset-2`}
                  >
                    <KeyRound size={11} /> Add new Authorize.Net account
                  </button>
                </div>
              )}
              <div>
                <TipLabel tip={<><b>Immediate</b> · access ends instantly on cancel<br/><b>End of Term</b> · keeps access until paid term ends<br/><b>Staff Only</b> · customer cannot self-cancel; must contact staff</>}>Cancellation Mode</TipLabel>
                <select
                  value={form.cancellation_mode}
                  onChange={(e) => setForm({ ...form, cancellation_mode: e.target.value as CreateMembershipPlanData['cancellation_mode'] })}
                  className={inputCls}
                >
                  <option value="immediate">Immediate</option>
                  <option value="end_of_term">End of Term</option>
                  <option value="staff_only">Staff Only</option>
                </select>
              </div>
              {form.billing_interval !== 'one_time' && (
                <div>
                  <TipLabel tip="Days after a failed renewal payment before the membership is suspended. Member stays 'past_due' with full access during this window.">Grace Period (days)</TipLabel>
                  <input
                    type="number"
                    value={form.grace_period_days ?? 0}
                    onChange={(e) => setForm({ ...form, grace_period_days: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              )}
              {form.billing_interval !== 'one_time' && (
                <div>
                  <TipLabel tip="How many days between automatic charge retries after a failed payment. Set to 0 to disable auto-retry (staff must trigger manually).">Retry Failed Payment (days)</TipLabel>
                  <input
                    type="number"
                    value={form.failed_payment_retry_days ?? 0}
                    onChange={(e) => setForm({ ...form, failed_payment_retry_days: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
              )}
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.requires_photo}
                  onChange={(e) => setForm({ ...form, requires_photo: e.target.checked })}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Requires member photo
                <InfoTooltip content="If on, staff must capture a member photo at the first check-in for fraud prevention." />
              </label>
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.is_family_or_group}
                  onChange={(e) => setForm({ ...form, is_family_or_group: e.target.checked, max_family_size: e.target.checked ? form.max_family_size : null })}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Family / Group plan
                <InfoTooltip content="Allows multiple linked members (e.g. parents + kids) under a single membership." />
              </label>
              {form.is_family_or_group && (
                <div className="col-span-2">
                  <TipLabel tip="Maximum number of people that can be linked to this family/group membership.">Max Family Size</TipLabel>
                  <input
                    type="number"
                    min={2}
                    value={form.max_family_size ?? ''}
                    onChange={(e) => setForm({ ...form, max_family_size: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  />
                </div>
              )}
              <label className="text-sm text-gray-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Active
                <InfoTooltip content="Inactive plans stay listed in admin but cannot be purchased by new customers." />
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50">
              <StandardButton variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </StandardButton>
              <StandardButton variant="primary" onClick={save} loading={saving}>
                Save
              </StandardButton>
            </div>
          </div>
        </div>
      )}
      {benefitsPlan && (
        <PlanBenefitsManager
          plan={benefitsPlan}
          canManage={canManagePlans}
          onClose={() => setBenefitsPlan(null)}
        />
      )}

      {/* Add Authorize.Net Account Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => { setShowAuthModal(false); setShowTxKey(false); setShowPubKey(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className={`text-${themeColor}-600`} />
                <h3 className="text-base font-semibold text-gray-900">Add Authorize.Net Account</h3>
              </div>
              <button onClick={() => { setShowAuthModal(false); setShowTxKey(false); setShowPubKey(false); }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <p className="text-xs text-gray-500">
                Enter the Authorize.Net credentials for a location. After saving, that location will be available as a billing location for membership plans.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Location <span className="text-red-500">*</span></label>
                <select
                  value={authForm.location_id ?? ''}
                  onChange={(e) => setAuthForm({ ...authForm, location_id: e.target.value ? parseInt(e.target.value) : null })}
                  className={inputCls}
                >
                  <option value="">Select a location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">API Login ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. 5Jd2Kn..."
                  value={authForm.api_login_id}
                  onChange={(e) => setAuthForm({ ...authForm, api_login_id: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Transaction Key <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showTxKey ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Transaction key"
                    value={authForm.transaction_key}
                    onChange={(e) => setAuthForm({ ...authForm, transaction_key: e.target.value })}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowTxKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showTxKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Public Client Key <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPubKey ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Public client key (for Accept.js)"
                    value={authForm.public_client_key}
                    onChange={(e) => setAuthForm({ ...authForm, public_client_key: e.target.value })}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPubKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPubKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Environment</label>
                <select
                  value={authForm.environment}
                  onChange={(e) => setAuthForm({ ...authForm, environment: e.target.value as 'sandbox' | 'production' })}
                  className={inputCls}
                >
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production (live)</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end bg-gray-50">
              <StandardButton variant="secondary" onClick={() => { setShowAuthModal(false); setShowTxKey(false); setShowPubKey(false); }} disabled={savingAuth}>
                Cancel
              </StandardButton>
              <StandardButton variant="primary" onClick={saveAuth} loading={savingAuth}>
                Save Account
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPlans;
