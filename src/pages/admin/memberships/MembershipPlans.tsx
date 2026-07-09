import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, CreditCard, MapPin, Building2, Lock, Sparkles, DollarSign, Download, Eye, EyeOff, KeyRound } from 'lucide-react';
import membershipService from '../../../services/MembershipService';
import { membershipCache } from '../../../services/MembershipCacheService';
import locationService from '../../../services/LocationService';
import { connectAuthorizeNetAccount, getAllAuthorizeNetAccounts } from '../../../services/SettingsService';
import type { MembershipPlan, CreateMembershipPlanData } from '../../../types/Membership.types';
import type { Location } from '../../../services/LocationService';
import type { SettingsAuthorizeNetAccount } from '../../../types/settings.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import PlanBenefitsManager from '../../../components/membership/PlanBenefitsManager';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatMembershipPrice } from '../../../utils/membershipFormat';
import { getStoredUser } from '../../../utils/storage';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const emptyForm: CreateMembershipPlanData = {
  name: '',
  description: '',
  price: 0,
  billing_interval: 'monthly',
  term_length_months: 1,
  season_start_date: null,
  season_end_date: null,
  usage_type: 'unlimited',
  unlimited_uses: true,
  unlimited_visits: true,
  included_visits_per_term: null,
  max_visits_per_day: null,
  punch_card_total: null,
  location_access_mode: 'single',
  location_id: null,
  approved_location_ids: [],
  billing_account_id: null,
  grace_period_days: 7,
  failed_payment_retry_days: 3,
  cancellation_mode: 'end_of_term',
  trial_days: 0,
  requires_photo: true,
  is_family_or_group: false,
  max_family_size: null,
  is_active: true,
};

const formatDateOnly = (value?: string | null): string => {
  if (!value) return '—';
  return new Date(value.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const planLocationNames = (p: MembershipPlan): string => {
  if (p.location_access_mode === 'all') return 'All locations';
  if (p.location_access_mode === 'multi') {
    const names = (p.approved_locations || []).map((l) => l.name);
    return names.length ? names.join(', ') : '—';
  }
  return p.location?.name || '—';
};

const MembershipPlans = () => {
  const { themeColor } = useThemeColor();
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';
  const isLocationManager = user?.role === 'location_manager';
  const canManagePlans = isCompanyAdmin || isLocationManager;

  const [plans, setPlans] = useState<MembershipPlan[]>(
    () => membershipCache.getPlansSync() ?? []
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(
    () => (membershipCache.getPlansSync() === null)
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [form, setForm] = useState<CreateMembershipPlanData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [benefitsPlan, setBenefitsPlan] = useState<MembershipPlan | null>(null);
  const { toast, showSuccess, showError, clear } = useToast();

  const emptyAuthForm = { location_id: null as number | null, label: '', api_login_id: '', transaction_key: '', public_client_key: '', environment: 'sandbox' as 'sandbox' | 'production' };
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [savingAuth, setSavingAuth] = useState(false);
  const [showTxKey, setShowTxKey] = useState(false);
  const [showPubKey, setShowPubKey] = useState(false);
  const [authAccounts, setAuthAccounts] = useState<SettingsAuthorizeNetAccount[]>([]);

  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;
  const labelCls = 'block text-xs font-medium text-gray-800 mb-1';

  const TipLabel = ({ children, tip }: { children: React.ReactNode; tip: React.ReactNode }) => (
    <label className={`${labelCls} flex items-center gap-1`}>
      {children}
      <InfoTooltip content={tip} />
    </label>
  );

  const load = async (forceRefresh = false) => {
    if (!forceRefresh && plans.length === 0) setLoading(true);
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
    getAllAuthorizeNetAccounts().then((r) => setAuthAccounts(r.data)).catch(() => {});
    const off = membershipCache.onUpdate((detail) => {
      if (detail.source === 'syncing') { setIsSyncing(true); return; }
      if (detail.source === 'synced') { setIsSyncing(false); return; }
      if (detail.key === 'plans' || detail.key === 'all') load();
    });
    return off;
  }, []);

  const startCreate = () => {
    setEditing(null);
    const base = { ...emptyForm };
    if (isLocationManager) {
      base.location_access_mode = 'single';
      base.location_id = user?.location_id ?? null;
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
      season_start_date: p.season_start_date ? p.season_start_date.slice(0, 10) : null,
      season_end_date: p.season_end_date ? p.season_end_date.slice(0, 10) : null,
      usage_type: p.usage_type,
      unlimited_uses: p.unlimited_uses,
      unlimited_visits: p.unlimited_visits,
      included_visits_per_term: p.included_visits_per_term ?? null,
      max_visits_per_day: p.max_visits_per_day ?? null,
      punch_card_total: p.punch_card_total ?? null,
      location_access_mode: p.location_access_mode,
      location_id: p.location?.id ?? null,
      approved_location_ids: p.approved_locations?.map((l) => l.id) || [],
      billing_account_id: p.billing_account_id ?? null,
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
        location_id: authForm.location_id ?? null,
        label: authForm.location_id ? undefined : (authForm.label.trim() || 'Centralized Account'),
      });
      if (res.success) {
        showSuccess('Authorize.Net account connected');
        const newAccountId = (res as any).data?.id ?? null;
        if (newAccountId) setForm((prev) => ({ ...prev, billing_account_id: newAccountId }));
        setAuthForm(emptyAuthForm);
        setShowAuthModal(false);
        getAllAuthorizeNetAccounts().then((r) => setAuthAccounts(r.data)).catch(() => {});
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

  const billingAccountLabel = (p: MembershipPlan): string => {
    if (!p.billing_account_id) return 'Home location default';
    const acc = authAccounts.find((a) => a.id === p.billing_account_id);
    if (acc) return `${acc.label ?? acc.location?.name ?? `Account #${acc.id}`} (${acc.environment})`;
    if (p.billing_account) return `${p.billing_account.label ?? `Account #${p.billing_account.id}`} (${p.billing_account.environment})`;
    return `Account #${p.billing_account_id}`;
  };

  const columns: AdminColumn<MembershipPlan>[] = [
    {
      key: 'id',
      label: 'Plan #',
      group: 'Identifiers',
      sortable: true,
      sortValue: (p) => p.id,
      exportValue: (p) => p.id,
      defaultVisible: false,
      render: (p) => <span className="text-sm text-gray-900">#{p.id}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      group: 'Identifiers',
      sortable: true,
      sortValue: (p) => p.name.toLowerCase(),
      exportValue: (p) => p.name,
      render: (p) => <span className="font-medium text-gray-900">{p.name}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      group: 'Pricing',
      sortable: true,
      sortValue: (p) => Number(p.price),
      exportValue: (p) => Number(p.price).toFixed(2),
      render: (p) => <span className="whitespace-nowrap text-gray-700">{formatMembershipPrice(p.price)}</span>,
    },
    {
      key: 'interval',
      label: 'Interval',
      group: 'Pricing',
      sortable: true,
      sortValue: (p) => p.billing_interval,
      exportValue: (p) => p.billing_interval.replace(/_/g, ' '),
      render: (p) => <span className="capitalize whitespace-nowrap text-gray-600">{p.billing_interval.replace('_', ' ')}</span>,
    },
    {
      key: 'trial',
      label: 'Trial',
      group: 'Pricing',
      sortable: true,
      sortValue: (p) => p.trial_days ?? 0,
      exportValue: (p) => p.trial_days ?? 0,
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{(p.trial_days ?? 0) > 0 ? `${p.trial_days} days` : '—'}</span>,
    },
    {
      key: 'term',
      label: 'Term (months)',
      group: 'Pricing',
      sortable: true,
      sortValue: (p) => p.term_length_months ?? 0,
      exportValue: (p) => p.term_length_months ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.term_length_months ?? '—'}</span>,
    },
    {
      key: 'usage',
      label: 'Usage',
      group: 'Usage',
      sortable: true,
      sortValue: (p) => p.usage_type,
      exportValue: (p) => p.usage_type.replace(/_/g, ' '),
      render: (p) => <span className="capitalize whitespace-nowrap text-gray-600">{p.usage_type.replace('_', ' ')}</span>,
    },
    {
      key: 'visitsPerTerm',
      label: 'Visits/Term',
      group: 'Usage',
      sortable: true,
      sortValue: (p) => p.included_visits_per_term ?? 0,
      exportValue: (p) => p.included_visits_per_term ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.included_visits_per_term ?? '—'}</span>,
    },
    {
      key: 'maxPerDay',
      label: 'Max Visits/Day',
      group: 'Usage',
      sortable: true,
      sortValue: (p) => p.max_visits_per_day ?? 0,
      exportValue: (p) => p.max_visits_per_day ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.max_visits_per_day ?? '—'}</span>,
    },
    {
      key: 'punchTotal',
      label: 'Punch Card Total',
      group: 'Usage',
      sortable: true,
      sortValue: (p) => p.punch_card_total ?? 0,
      exportValue: (p) => p.punch_card_total ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.punch_card_total ?? '—'}</span>,
    },
    {
      key: 'access',
      label: 'Access',
      group: 'Access',
      sortable: true,
      sortValue: (p) => p.location_access_mode,
      exportValue: (p) => p.location_access_mode,
      render: (p) => <span className="capitalize whitespace-nowrap text-gray-600">{p.location_access_mode}</span>,
    },
    {
      key: 'locations',
      label: 'Locations',
      group: 'Access',
      sortable: true,
      sortValue: (p) => planLocationNames(p).toLowerCase(),
      exportValue: (p) => planLocationNames(p),
      defaultVisible: false,
      render: (p) => (
        <span className="text-gray-600" title={planLocationNames(p)}>
          {p.location_access_mode === 'multi' ? `${(p.approved_locations || []).length} locations` : planLocationNames(p)}
        </span>
      ),
    },
    {
      key: 'family',
      label: 'Family/Group',
      group: 'Access',
      sortable: true,
      sortValue: (p) => (p.is_family_or_group ? 'Yes' : 'No'),
      exportValue: (p) => (p.is_family_or_group ? 'Yes' : 'No'),
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.is_family_or_group ? 'Yes' : 'No'}</span>,
    },
    {
      key: 'maxFamily',
      label: 'Max Family Size',
      group: 'Access',
      sortable: true,
      sortValue: (p) => p.max_family_size ?? 0,
      exportValue: (p) => p.max_family_size ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.max_family_size ?? '—'}</span>,
    },
    {
      key: 'billingAccount',
      label: 'Billing Account',
      group: 'Billing',
      sortable: true,
      sortValue: (p) => billingAccountLabel(p).toLowerCase(),
      exportValue: (p) => billingAccountLabel(p),
      defaultVisible: false,
      render: (p) => <span className="text-gray-600 whitespace-nowrap">{billingAccountLabel(p)}</span>,
    },
    {
      key: 'cancellation',
      label: 'Cancellation',
      group: 'Billing',
      sortable: true,
      sortValue: (p) => p.cancellation_mode,
      exportValue: (p) => p.cancellation_mode.replace(/_/g, ' '),
      defaultVisible: false,
      render: (p) => <span className="capitalize whitespace-nowrap text-gray-600">{p.cancellation_mode.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'grace',
      label: 'Grace Period (days)',
      group: 'Billing',
      sortable: true,
      sortValue: (p) => p.grace_period_days ?? 0,
      exportValue: (p) => p.grace_period_days ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.grace_period_days ?? '—'}</span>,
    },
    {
      key: 'retry',
      label: 'Payment Retry (days)',
      group: 'Billing',
      sortable: true,
      sortValue: (p) => p.failed_payment_retry_days ?? 0,
      exportValue: (p) => p.failed_payment_retry_days ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-600">{p.failed_payment_retry_days ?? '—'}</span>,
    },
    {
      key: 'seasonStart',
      label: 'Season Start',
      group: 'Dates',
      sortable: true,
      sortValue: (p) => p.season_start_date?.slice(0, 10) ?? '',
      exportValue: (p) => p.season_start_date?.slice(0, 10) ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-500">{formatDateOnly(p.season_start_date)}</span>,
    },
    {
      key: 'seasonEnd',
      label: 'Season End',
      group: 'Dates',
      sortable: true,
      sortValue: (p) => p.season_end_date?.slice(0, 10) ?? '',
      exportValue: (p) => p.season_end_date?.slice(0, 10) ?? '',
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-500">{formatDateOnly(p.season_end_date)}</span>,
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: (p) => new Date(p.created_at || 0).getTime(),
      exportValue: (p) => (p.created_at ? new Date(p.created_at).toLocaleString() : ''),
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-500">{formatDateTime(p.created_at)}</span>,
    },
    {
      key: 'updated',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: (p) => new Date(p.updated_at || 0).getTime(),
      exportValue: (p) => (p.updated_at ? new Date(p.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      render: (p) => <span className="whitespace-nowrap text-gray-500">{formatDateTime(p.updated_at)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: (p) => (p.is_active ? 'Active' : 'Inactive'),
      exportValue: (p) => (p.is_active ? 'Active' : 'Inactive'),
      render: (p) => (
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
      ),
    },
  ];

  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: String(l.id), label: l.name })),
    [locations]
  );

  const billingAccountOptions = useMemo(
    () => [
      { value: 'default', label: 'Home location default' },
      ...authAccounts.map((acc) => ({
        value: String(acc.id),
        label: `${acc.label ?? acc.location?.name ?? `Account #${acc.id}`} (${acc.environment})`,
      })),
    ],
    [authAccounts]
  );

  const filterDefs: AdminFilterDef<MembershipPlan>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (p, value) => (value === 'active' ? p.is_active : !p.is_active),
    },
    {
      type: 'select',
      key: 'interval',
      label: 'Billing Interval',
      allLabel: 'All Intervals',
      options: [
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'annual', label: 'Annual' },
        { value: 'one_time', label: 'One-time' },
        { value: 'custom', label: 'Custom' },
      ],
      predicate: (p, value) => p.billing_interval === value,
    },
    {
      type: 'select',
      key: 'usage',
      label: 'Usage Type',
      allLabel: 'All Usage Types',
      options: [
        { value: 'unlimited', label: 'Unlimited' },
        { value: 'limited_visits', label: 'Limited Visits' },
        { value: 'punch_card', label: 'Punch Card' },
      ],
      predicate: (p, value) => p.usage_type === value,
    },
    {
      type: 'select',
      key: 'access',
      label: 'Access Mode',
      allLabel: 'All Access Modes',
      options: [
        { value: 'single', label: 'Single Home Location' },
        { value: 'multi', label: 'Multi-Location' },
        { value: 'all', label: 'All Locations' },
      ],
      predicate: (p, value) => p.location_access_mode === value,
    },
    {
      type: 'select',
      key: 'location',
      label: 'Location',
      allLabel: 'All Locations',
      options: locationOptions,
      predicate: (p, value) => {
        const id = Number(value);
        if (p.location_access_mode === 'all') return true;
        if (p.location?.id === id) return true;
        return (p.approved_locations || []).some((l) => l.id === id);
      },
    },
    {
      type: 'select',
      key: 'billingAccount',
      label: 'Billing Account',
      allLabel: 'All Billing Accounts',
      options: billingAccountOptions,
      predicate: (p, value) =>
        value === 'default' ? !p.billing_account_id : String(p.billing_account_id ?? '') === value,
    },
    {
      type: 'select',
      key: 'family',
      label: 'Plan Type',
      allLabel: 'All Plan Types',
      options: [
        { value: 'yes', label: 'Family / Group' },
        { value: 'no', label: 'Individual' },
      ],
      predicate: (p, value) => (value === 'yes' ? p.is_family_or_group : !p.is_family_or_group),
    },
    {
      type: 'select',
      key: 'trial',
      label: 'Trial',
      allLabel: 'All Plans',
      options: [
        { value: 'yes', label: 'Has Trial' },
        { value: 'no', label: 'No Trial' },
      ],
      predicate: (p, value) =>
        value === 'yes' ? (p.trial_days ?? 0) > 0 : (p.trial_days ?? 0) === 0,
    },
    {
      type: 'select',
      key: 'schedule',
      label: 'Schedule',
      allLabel: 'All Schedules',
      options: [
        { value: 'seasonal', label: 'Seasonal' },
        { value: 'rolling', label: 'Rolling' },
      ],
      predicate: (p, value) => {
        const seasonal = !!(p.season_start_date || p.season_end_date);
        return value === 'seasonal' ? seasonal : !seasonal;
      },
    },
    {
      type: 'numberrange',
      key: 'price',
      label: 'Price ($)',
      getValue: (p) => Number(p.price),
    },
    {
      type: 'daterange',
      key: 'created',
      label: 'Created Date',
      getDate: (p) => p.created_at,
    },
  ], [locationOptions, billingAccountOptions]);

  const table = useAdminTable<MembershipPlan>({
    data: plans,
    columns,
    getRowId: (p) => String(p.id),
    storageKey: 'membership_plans',
    filterDefs,
    searchFields: (p) => [
      p.id,
      p.name,
      p.description,
      p.tier,
      Number(p.price),
      p.billing_interval,
      p.usage_type,
      p.location_access_mode,
      p.location?.name,
      (p.approved_locations || []).map((l) => l.name).join(' '),
      billingAccountLabel(p),
      p.cancellation_mode,
      p.is_active ? 'active' : 'inactive',
    ],
    defaultSort: (a, b) => a.name.localeCompare(b.name),
    itemsPerPage: 10,
  });

  const exportCsv = (rows: MembershipPlan[]) => {
    exportTableCsv({
      filename: `membership-plans-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows,
      extraColumns: [
        { label: 'Description', value: (p) => p.description || '' },
        { label: 'Tier', value: (p) => p.tier || '' },
        { label: 'Slug', value: (p) => p.slug || '' },
        { label: 'Home Location', value: (p) => p.location?.name || '' },
        { label: 'Approved Locations', value: (p) => (p.approved_locations || []).map((l) => l.name).join('; ') },
        { label: 'Unlimited Visits', value: (p) => (p.unlimited_visits ? 'Yes' : 'No') },
        { label: 'Unlimited Uses', value: (p) => (p.unlimited_uses ? 'Yes' : 'No') },
        { label: 'Requires Photo', value: (p) => (p.requires_photo ? 'Yes' : 'No') },
        { label: 'Discount %', value: (p) => p.discount_percent ?? '' },
        { label: 'Billing Account ID', value: (p) => p.billing_account_id ?? '' },
        { label: 'Company ID', value: (p) => p.company_id },
      ],
    });
  };

  const bulkSetActive = async (active: boolean) => {
    const targets = plans.filter(
      (p) => table.selectedIds.includes(String(p.id)) && p.is_active !== active
    );
    if (targets.length === 0) {
      table.clearSelection();
      return;
    }
    try {
      await Promise.all(targets.map((p) => membershipService.togglePlanStatus(p.id)));
      showSuccess(`${targets.length} plan(s) ${active ? 'activated' : 'deactivated'}`);
      table.clearSelection();
      await membershipCache.invalidate('plans');
      await membershipCache.invalidate('publicPlans');
      load(true);
    } catch (e: unknown) {
      showError(e, 'Bulk update failed');
    }
  };

  const exportSelected = () => {
    exportCsv(plans.filter((p) => table.selectedIds.includes(String(p.id))));
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
          <StandardButton variant="secondary" size="md" icon={Download} onClick={() => exportCsv(table.filteredRows)}>
            Export CSV
          </StandardButton>
          {canManagePlans && (
            <StandardButton variant="primary" size="md" icon={Plus} onClick={startCreate}>
              New Plan
            </StandardButton>
          )}
        </div>
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search plans..."
        onRefresh={() => load(true)}
        actions={
          <span className="inline-flex items-center px-1">
            <InfoTooltip
              widthClass="w-64"
              content={<><b>Usage</b><br/><b>Unlimited</b> · no caps<br/><b>Limited visits</b> · fixed per term<br/><b>Punch card</b> · fixed total visits, no reset<br/><br/><b>Access</b><br/><b>Single</b> · only home location<br/><b>Multi</b> · approved locations only<br/><b>All</b> · every location<br/><br/><b>Status</b><br/>Inactive plans stay in admin but cannot be purchased by new customers.</>}
            />
          </span>
        }
      />

      <BulkActionsBar table={table} itemLabel="plan(s)">
        {canManagePlans && (
          <>
            <StandardButton variant="secondary" size="sm" icon={ToggleRight} onClick={() => bulkSetActive(true)}>
              Activate
            </StandardButton>
            <StandardButton variant="secondary" size="sm" icon={ToggleLeft} onClick={() => bulkSetActive(false)}>
              Deactivate
            </StandardButton>
          </>
        )}
        <StandardButton variant="secondary" size="sm" icon={Download} onClick={exportSelected}>
          Export Selected
        </StandardButton>
      </BulkActionsBar>

      {isSyncing && (
        <div className="h-0.5 bg-blue-100 mb-1 rounded overflow-hidden">
          <div className="h-full w-1/4 bg-blue-400 animate-pulse rounded-r-full" />
        </div>
      )}

      <AdminDataTable
        table={table}
        loading={loading}
        selectable
        itemLabel="plans"
        emptyState={
          <div className="inline-flex flex-col items-center gap-2">
            <div className={`p-3 rounded-full bg-${themeColor}-50`}>
              <CreditCard className={`w-6 h-6 text-${themeColor}-600`} />
            </div>
            {plans.length === 0 ? (
              <span>No plans yet. Click <span className="font-medium">New Plan</span> to create one.</span>
            ) : (
              <span>No plans match your search or filters.</span>
            )}
          </div>
        }
        renderActions={(p) =>
          canManagePlans ? (
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
          )
        }
      />

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
                <TipLabel tip="Optional. The date this fixed-season plan begins. Leave blank for rolling memberships.">Season Start Date</TipLabel>
                <input
                  type="date"
                  value={form.season_start_date ?? ''}
                  onChange={(e) => setForm({ ...form, season_start_date: e.target.value || null })}
                  className={inputCls}
                />
              </div>
              <div>
                <TipLabel tip="Optional. When set, every membership on this plan expires on this date (e.g. a season pass ending Sept 7). Staff can still extend individual members past this date.">Season End Date</TipLabel>
                <input
                  type="date"
                  value={form.season_end_date ?? ''}
                  min={form.season_start_date ?? undefined}
                  onChange={(e) => setForm({ ...form, season_end_date: e.target.value || null })}
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
                  <TipLabel tip="Choose which Authorize.Net account handles ALL membership charges for this plan. Leave blank to charge through each member's home location's account. Click 'Add new account' to register a centralized or new location account.">
                    <DollarSign size={12} className="inline" /> Billing Account (Authorize.Net)
                  </TipLabel>
                  <select
                    value={form.billing_account_id ?? ''}
                    onChange={(e) => setForm({ ...form, billing_account_id: e.target.value ? parseInt(e.target.value) : null })}
                    className={inputCls}
                  >
                    <option value="">Each member's home location (default)</option>
                    {authAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.label ?? acc.location?.name ?? `Account #${acc.id}`}
                        {' '}({acc.environment})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setAuthForm({ ...emptyAuthForm }); setShowAuthModal(true); }}
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
                Enter Authorize.Net credentials. Select a location to tie this account to a specific location, or leave the location blank to create a centralized (company-level) account.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Location <span className="text-gray-400">(optional)</span></label>
                <select
                  value={authForm.location_id ?? ''}
                  onChange={(e) => setAuthForm({ ...authForm, location_id: e.target.value ? parseInt(e.target.value) : null })}
                  className={inputCls}
                >
                  <option value="">No location — centralized account</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {!authForm.location_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-800 mb-1">Account Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Company Membership Gateway"
                    value={authForm.label}
                    onChange={(e) => setAuthForm({ ...authForm, label: e.target.value })}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1">A friendly name so you can identify this centralized account.</p>
                </div>
              )}

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
