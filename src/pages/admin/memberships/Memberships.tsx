import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronRight,
  Users,
  CheckCircle2,
  AlertTriangle,
  Snowflake,
  CreditCard,
  RefreshCcw,
  Plus,
  X,
  CalendarCheck,
  BarChart3,
} from 'lucide-react';
import axios from 'axios';
import membershipService from '../../../services/MembershipService';
import { membershipCache } from '../../../services/MembershipCacheService';
import locationService from '../../../services/LocationService';
import type { Location } from '../../../services/LocationService';
import type { Membership, MembershipPlan, MembershipStatus } from '../../../types/Membership.types';
import { loadAcceptJS, tokenizeCard } from '../../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../../services/SettingsService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import MembershipStatusBadge from '../../../components/membership/MembershipStatusBadge';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import { SkeletonTableRow, SkeletonStatCard } from '../../../components/ui/Skeleton';
import { formatMembershipDate } from '../../../utils/membershipFormat';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { API_BASE_URL } from '../../../utils/storage';

const STATUSES: { value: MembershipStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
];


interface CustomerSearchResult {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

interface AddMemberModalProps {
  onClose: () => void;
  onCreated: () => void;
  themeColor: string;
}

function AddMemberModal({ onClose, onCreated, themeColor }: AddMemberModalProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { toast: modalToast, showSuccess, showError: showModalError, clear: clearToast } = useToast();

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [didSearch, setDidSearch] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Pass holder (authorized user) — distinct from the account/guardian above.
  // Optional: defaults to the account holder's name on the back end if left blank.
  const [holderName, setHolderName] = useState('');

  const [planId, setPlanId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  // Payment handling for in-person sales (task 1).
  const [paymentMethod, setPaymentMethod] = useState<'charge' | 'external' | 'comp'>('charge');
  const isComped = paymentMethod === 'comp';
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [cardCode, setCardCode] = useState('');
  const [gatewayReady, setGatewayReady] = useState(false);
  const [gatewayError, setGatewayError] = useState('');
  const [anetLoginId, setAnetLoginId] = useState('');
  const [anetClientKey, setAnetClientKey] = useState('');

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId) || null, [plans, planId]);
  const planPrice = selectedPlan ? Number(selectedPlan.price) : 0;

  useEffect(() => {
    membershipService.listPlans().then(setPlans).catch(() => {});
    locationService.getLocations().then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  // When charging a card in person, load the Authorize.Net Accept.js config for the
  // chosen location so the card can be tokenized client-side (PCI-safe).
  useEffect(() => {
    if (paymentMethod !== 'charge' || planPrice <= 0) {
      setGatewayReady(false);
      setGatewayError('');
      return;
    }
    const locId = locationId || selectedPlan?.location?.id || null;
    if (!locId) {
      setGatewayReady(false);
      setGatewayError('Select a home location to charge a card.');
      return;
    }
    let cancelled = false;
    setGatewayReady(false);
    setGatewayError('');
    (async () => {
      try {
        const res = await getAuthorizeNetPublicKey(Number(locId));
        if (cancelled) return;
        if (res?.api_login_id) {
          setAnetLoginId(res.api_login_id);
          setAnetClientKey(res.client_key || res.api_login_id);
          await loadAcceptJS((res.environment as 'sandbox' | 'production') || 'sandbox');
          if (!cancelled) setGatewayReady(true);
        } else {
          setGatewayError('No payment gateway configured for this location.');
        }
      } catch {
        if (!cancelled) setGatewayError('Could not load the payment gateway for this location.');
      }
    })();
    return () => { cancelled = true; };
  }, [paymentMethod, planPrice, locationId, selectedPlan]);

  const searchCustomers = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setCustomerResults([]); setDidSearch(false); return; }
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/customers/search`, { params: { q } });
      const results: CustomerSearchResult[] = res.data?.data ?? [];
      setCustomerResults(results);
      setDidSearch(true);
      if (results.length === 0) {
        setShowNewForm(true);
        if (q.includes('@')) setNewEmail(q.trim());
      }
    } catch {
      setCustomerResults([]);
      setDidSearch(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleQueryChange = (v: string) => {
    setCustomerQuery(v);
    setSelectedCustomer(null);
    setShowNewForm(false);
    setDidSearch(false);
    setNewEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(v), 350);
  };

  const selectCustomer = (c: CustomerSearchResult) => {
    setSelectedCustomer(c);
    setCustomerQuery('');
    setCustomerResults([]);
    setShowNewForm(false);
    setDidSearch(false);
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!planId) { setFormError('Select a membership plan.'); return; }

    const payload: Record<string, unknown> = {
      membership_plan_id: planId,
      home_location_id: locationId || null,
      is_comped: isComped,
      terms_accepted: true,
      recurring_billing_authorized: paymentMethod === 'charge' && !isComped,
      payment_type: planPrice > 0 ? paymentMethod : 'none',
    };

    if (holderName.trim()) {
      payload.holder_name = holderName.trim();
    }

    if (selectedCustomer) {
      payload.customer_id = selectedCustomer.id;
    } else if (showNewForm) {
      if (!firstName.trim() || !lastName.trim()) {
        setFormError('First name and last name are required.');
        return;
      }
      if (newEmail.trim() && !newEmail.includes('@')) {
        setFormError('Please enter a valid email address, or leave it blank.');
        return;
      }
      if (paymentMethod === 'charge' && planPrice > 0 && !newEmail.trim()) {
        setFormError('An email is required when charging a card.');
        return;
      }
      payload.first_name = firstName.trim();
      payload.last_name  = lastName.trim();
      payload.email      = newEmail.trim() || undefined;
      payload.phone      = phone.trim() || undefined;
    } else {
      setFormError('Search for a customer or create a new one.');
      return;
    }

    setSaving(true);
    try {
      // Charge the card in person: tokenize via Accept.js so raw PAN never hits our server.
      if (paymentMethod === 'charge' && planPrice > 0) {
        if (!gatewayReady) {
          setFormError(gatewayError || 'Payment gateway is not ready. Try again in a moment.');
          setSaving(false);
          return;
        }
        if (!cardNumber.trim() || !cardExpMonth.trim() || !cardExpYear.trim() || !cardCode.trim()) {
          setFormError('Enter the full card details to charge the card.');
          setSaving(false);
          return;
        }
        try {
          const opaque = await tokenizeCard(
            {
              cardNumber: cardNumber.replace(/\s+/g, ''),
              month: cardExpMonth.padStart(2, '0'),
              year: cardExpYear.length === 2 ? `20${cardExpYear}` : cardExpYear,
              cardCode: cardCode.trim(),
            },
            anetLoginId,
            anetClientKey,
          );
          payload.opaque_data = opaque;
          payload.amount = planPrice;
        } catch (err: unknown) {
          setFormError(err instanceof Error ? err.message : 'Card could not be processed.');
          setSaving(false);
          return;
        }
      }

      const hasEmail = !!(selectedCustomer?.email || (showNewForm && newEmail.trim()));
      await membershipService.createMembership(payload);
      showSuccess(hasEmail ? 'Membership created! Activation email sent.' : 'Membership created.');
      setTimeout(() => { onCreated(); onClose(); }, 1200);
    } catch (e: unknown) {
      showModalError(e, 'Failed to create membership');
    } finally {
      setSaving(false);
    }
  };

  const ic = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600 outline-none`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {modalToast && <Toast message={modalToast.message} type={modalToast.type} onClose={clearToast} />}

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Customer</label>

            {selectedCustomer ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-${themeColor}-50 border-${themeColor}-200 text-sm`}>
                <CheckCircle2 size={14} className={`text-${themeColor}-600 shrink-0`} />
                <span className="font-medium text-gray-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                <span className="text-gray-500 text-xs">{selectedCustomer.email}</span>
                <button
                  className="ml-auto text-gray-400 hover:text-gray-600"
                  onClick={() => { setSelectedCustomer(null); setCustomerQuery(''); setShowNewForm(false); setDidSearch(false); }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={customerQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className={ic}
                  autoFocus
                />
                {searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
                )}
              </div>
            )}

            {customerResults.length > 0 && !selectedCustomer && (
              <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 shadow-md max-h-36 overflow-y-auto text-sm">
                {customerResults.map((c) => (
                  <li
                    key={c.id}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                    <span className="text-gray-400 text-xs">{c.email}</span>
                  </li>
                ))}
              </ul>
            )}

            {didSearch && customerResults.length === 0 && !selectedCustomer && (
              <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-medium mb-1">No existing account found.</p>
                {!showNewForm ? (
                  <button
                    className={`text-xs font-medium text-${themeColor}-700 hover:underline`}
                    onClick={() => setShowNewForm(true)}
                  >
                    + Create a new customer account
                  </button>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">First Name *</label>
                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={ic} placeholder="Jane" autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Last Name *</label>
                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={ic} placeholder="Doe" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={ic} placeholder="jane@example.com" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={ic} placeholder="+1 555 000 0000" />
                    </div>
                    <p className="text-xs text-gray-400">
                      {newEmail.trim()
                        ? 'Login credentials are emailed automatically. The customer can reset the password from the login page.'
                        : 'No email — this is a walk-in pass with no online account. Add an email later to enable customer login.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Pass Holder Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className={ic}
              placeholder="Name shown on the pass — e.g. the child or authorized user"
            />
            <p className="mt-1 text-xs text-gray-400">Leave blank to use the account holder's name.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan *</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : '')} className={ic}>
                <option value="">Select…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Home Location</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')} className={ic}>
                <option value="">Any</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Payment {planPrice > 0 && <span className="text-gray-500 font-normal">— ${planPrice.toFixed(2)}</span>}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'charge', label: 'Charge card' },
                { key: 'external', label: 'Cash / external' },
                { key: 'comp', label: 'Comp (free)' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPaymentMethod(opt.key)}
                  className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    paymentMethod === opt.key
                      ? `bg-${themeColor}-600 text-white border-${themeColor}-600`
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'comp' && (
              <p className="mt-2 text-xs text-gray-500">Complimentary membership — no charge will be made.</p>
            )}
            {paymentMethod === 'external' && (
              <p className="mt-2 text-xs text-gray-500">
                {planPrice > 0
                  ? `Records a $${planPrice.toFixed(2)} payment taken outside the system (cash or external terminal).`
                  : 'No charge — this plan is free.'}
              </p>
            )}
            {paymentMethod === 'charge' && planPrice <= 0 && (
              <p className="mt-2 text-xs text-gray-500">This plan is free — no card needed.</p>
            )}

            {paymentMethod === 'charge' && planPrice > 0 && (
              <div className="mt-3 space-y-2">
                {gatewayError && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{gatewayError}</p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="Card number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className={ic}
                  disabled={!gatewayReady}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM"
                    maxLength={2}
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, ''))}
                    className={ic}
                    disabled={!gatewayReady}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY"
                    maxLength={4}
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, ''))}
                    className={ic}
                    disabled={!gatewayReady}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    maxLength={4}
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value.replace(/\D/g, ''))}
                    className={ic}
                    disabled={!gatewayReady}
                  />
                </div>
                {!gatewayReady && !gatewayError && (
                  <p className="text-xs text-gray-400">Loading secure payment field…</p>
                )}
              </div>
            )}
          </div>

          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</StandardButton>
          <StandardButton variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Membership'}
          </StandardButton>
        </div>
      </div>
    </div>
  );
}

const Memberships = () => {
  const navigate = useNavigate();
  const { themeColor } = useThemeColor();
  // Initialise instantly from the in-memory cache so the page renders content
  // on the very first frame — no blank screen between navigations.
  const [items, setItems] = useState<Membership[]>(
    () => membershipCache.getListSync()?.data ?? []
  );
  const [loading, setLoading] = useState(
    () => (membershipCache.getListSync() === null)
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MembershipStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast, showError, clear } = useToast();

  const load = async (forceRefresh = false) => {
    if (!forceRefresh && items.length === 0) setLoading(true);
    try {
      if (status === 'all' && !search) {
        const res = await membershipCache.getList({}, forceRefresh);
        setItems(res.data);
      } else {
        const res = await membershipService.listMemberships({
          status: status === 'all' ? undefined : status,
          search: search || undefined,
        });
        setItems(res.data);
      }
    } catch (e: unknown) {
      showError(e, 'Failed to load memberships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const off = membershipCache.onUpdate((detail) => {
      if (detail.source === 'syncing') { setIsSyncing(true); return; }
      if (detail.source === 'synced') { setIsSyncing(false); return; }
      if (status === 'all' && !search && (detail.key === 'list' || detail.key === 'all')) {
        membershipCache.getListSync() && setItems(membershipCache.getListSync()!.data);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((m) => {
      const name = `${m.customer?.first_name || ''} ${m.customer?.last_name || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        m.holder_name?.toLowerCase().includes(q) ||
        m.customer?.email?.toLowerCase().includes(q) ||
        m.qr_token.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const metrics = useMemo(() => {
    const total = items.length;
    const active = items.filter((m) => m.status === 'active').length;
    const pastDue = items.filter((m) => m.status === 'past_due').length;
    const frozen = items.filter((m) => m.status === 'frozen').length;
    return [
      { title: 'Total', value: total, icon: Users, accent: 'blue', tooltip: 'All memberships ever created — includes active, canceled, expired and pending.' },
      { title: 'Active', value: active, icon: CheckCircle2, accent: 'green', tooltip: 'Memberships in good standing — paid, valid term, can check in and book.' },
      { title: 'Past Due', value: pastDue, icon: AlertTriangle, accent: 'orange', tooltip: 'Renewal payment failed. Member is in grace period; the system will auto-retry per the plan settings.' },
      { title: 'Frozen', value: frozen, icon: Snowflake, accent: 'blue', tooltip: 'Member paused their membership. Billing is paused and check-ins are blocked until the freeze ends.' },
    ];
  }, [items]);

  return (
    <div className="px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      {showAddModal && (
        <AddMemberModal
          themeColor={themeColor}
          onClose={() => setShowAddModal(false)}
          onCreated={() => load(true)}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Memberships
            <InfoTooltip widthClass="w-72" content="All customer memberships across every plan. Click a row to view full member details, payment history and audit log." />
          </h1>
          <p className="text-gray-600 mt-1">View and manage all member subscriptions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          <ActionMenu
            items={[
              { label: 'Plans', icon: CreditCard, onClick: () => navigate('/memberships/plans') },
              { label: 'Check-In', icon: CalendarCheck, onClick: () => navigate('/memberships/check-in') },
              { label: 'Reports', icon: BarChart3, onClick: () => navigate('/memberships/reports') },
            ]}
          />
          <StandardButton variant="primary" size="md" icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Member
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
          : metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-${m.accent}-100 text-${m.accent}-600`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-base font-semibold text-gray-800">{m.title}</span>
                    <InfoTooltip content={m.tooltip} className="ml-auto" />
                  </div>
                  <div className="flex items-end gap-2 mt-2">
                    <CounterAnimation value={m.value} className="text-2xl font-bold text-gray-900" />
                  </div>
                </div>
              );
            })}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or QR token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </StandardButton>
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => load(true)} title="Refresh">
              {''}
            </StandardButton>
          </div>
        </div>
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MembershipStatus | 'all')}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isSyncing && (
          <div className="h-0.5 bg-blue-100">
            <div className="h-full w-1/4 bg-blue-400 animate-pulse rounded-r-full" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Plan
                    <InfoTooltip content="The membership tier the customer subscribed to. Determines price, included visits and benefits." size={12} />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Status
                    <InfoTooltip widthClass="w-64" content={<><b>active</b> · paid & valid<br/><b>pending</b> · awaiting first payment<br/><b>past_due</b> · payment failed, in grace<br/><b>frozen</b> · paused by member<br/><b>suspended</b> · blocked by staff/system<br/><b>canceled / expired</b> · inactive</>} size={12} />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Started
                    <InfoTooltip content="Date the membership was first activated." size={12} />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Renews
                    <InfoTooltip content="End of the current paid term. The next recurring charge fires on this date." size={12} />
                  </span>
                </th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} cols={6} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No memberships found.</td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/memberships/${m.id}`)}
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {m.holder_name?.trim() || `${m.customer?.first_name ?? ''} ${m.customer?.last_name ?? ''}`.trim()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m.holder_name?.trim() && (
                          <span>{m.customer?.first_name} {m.customer?.last_name} · </span>
                        )}
                        {m.customer?.email || 'no email'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-700">{m.plan?.name || `#${m.membership_plan_id}`}</td>
                    <td className="px-4 py-4"><MembershipStatusBadge status={m.status} /></td>
                    <td className="px-4 py-4 text-gray-600">{formatMembershipDate(m.started_at)}</td>
                    <td className="px-4 py-4 text-gray-600">{formatMembershipDate(m.current_term_end)}</td>
                    <td className="px-4 py-4 text-right"><ChevronRight size={16} className="inline text-gray-400" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Memberships;
