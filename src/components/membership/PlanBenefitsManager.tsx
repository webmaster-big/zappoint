import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Edit2, Save, Tag, Sparkles } from 'lucide-react';
import membershipService from '../../services/MembershipService';
import packageService from '../../services/PackageService';
import attractionService from '../../services/AttractionService';
import eventService from '../../services/EventService';
import addOnService from '../../services/AddOnService';
import locationService from '../../services/LocationService';
import { categoryService } from '../../services/CategoryService';
import type {
  MembershipPlan,
  MembershipPlanBenefit,
  CreateMembershipPlanBenefitData,
  MembershipBenefitType,
  MembershipBenefitScopeType,
  MembershipBenefitValueMode,
  MembershipBenefitPeriod,
} from '../../types/Membership.types';
import StandardButton from '../ui/StandardButton';
import LoadingSpinner from '../ui/LoadingSpinner';
import InfoTooltip from '../ui/InfoTooltip';
import Toast from '../ui/Toast';
import { useToast } from '../../hooks/useToast';
import { useThemeColor } from '../../hooks/useThemeColor';

interface Props {
  plan: MembershipPlan;
  onClose: () => void;
  canManage: boolean;
}

const BENEFIT_TYPES: { value: MembershipBenefitType; label: string }[] = [
  { value: 'package_discount', label: 'Package discount' },
  { value: 'attraction_discount', label: 'Attraction discount' },
  { value: 'event_discount', label: 'Event discount' },
  { value: 'addon_discount', label: 'Add-on discount' },
  { value: 'free_entry_pass', label: 'Free entry pass' },
  { value: 'guest_pass', label: 'Guest pass' },
  { value: 'priority_booking', label: 'Priority booking' },
  { value: 'member_only_access', label: 'Member-only access' },
  { value: 'birthday_reward', label: 'Birthday reward' },
];

const SCOPE_TYPES: { value: MembershipBenefitScopeType; label: string }[] = [
  { value: 'any', label: 'Any (all items)' },
  { value: 'package', label: 'Specific package' },
  { value: 'attraction', label: 'Specific attraction' },
  { value: 'event', label: 'Specific event' },
  { value: 'addon', label: 'Specific add-on' },
  { value: 'category', label: 'Category' },
  { value: 'location', label: 'Location' },
];

// Which scope types make sense for each benefit type. Mirrors the backend SCOPE_MATRIX
// so the UI cannot build nonsensical combinations (e.g. a package discount scoped to an attraction).
const SCOPE_MATRIX: Record<MembershipBenefitType, MembershipBenefitScopeType[]> = {
  package_discount: ['any', 'package', 'category'],
  attraction_discount: ['any', 'attraction', 'category'],
  event_discount: ['any', 'event', 'category'],
  addon_discount: ['any', 'addon'],
  free_entry_pass: ['any', 'attraction'],
  guest_pass: ['any', 'attraction'],
  priority_booking: ['any'],
  member_only_access: ['any', 'location'],
  birthday_reward: ['any'],
};

// Contextual label for the "any" scope, based on the selected benefit type.
const ANY_LABEL: Partial<Record<MembershipBenefitType, string>> = {
  package_discount: 'All packages',
  attraction_discount: 'All attractions',
  event_discount: 'All events',
  addon_discount: 'All add-ons',
  free_entry_pass: 'All attractions',
  guest_pass: 'All attractions',
  member_only_access: 'All locations',
};

const allowedScopesFor = (bt: MembershipBenefitType): MembershipBenefitScopeType[] =>
  SCOPE_MATRIX[bt] ?? ['any'];

type ScopeOption = { id: number; name: string; locationName?: string | null };
type ScopeTargetType = 'package' | 'attraction' | 'event' | 'addon' | 'location';

const VALUE_MODES: { value: MembershipBenefitValueMode; label: string }[] = [
  { value: 'percent', label: 'Percent off (%)' },
  { value: 'fixed', label: 'Fixed amount off ($)' },
  { value: 'free', label: 'Free (100% off)' },
  { value: 'count', label: 'Number of passes' },
  { value: 'flag', label: 'Access only (no value)' },
];

// Which value modes make sense for each benefit type. Mirrors the backend VALUE_MODE_MATRIX.
// Discounts reduce price; passes grant a count; access benefits are simple flags.
const VALUE_MODE_MATRIX: Record<MembershipBenefitType, MembershipBenefitValueMode[]> = {
  package_discount: ['percent', 'fixed', 'free'],
  attraction_discount: ['percent', 'fixed', 'free'],
  event_discount: ['percent', 'fixed', 'free'],
  addon_discount: ['percent', 'fixed', 'free'],
  free_entry_pass: ['count'],
  guest_pass: ['count'],
  priority_booking: ['flag'],
  member_only_access: ['flag'],
  birthday_reward: ['free', 'percent', 'fixed', 'count'],
};

const allowedValueModesFor = (bt: MembershipBenefitType): MembershipBenefitValueMode[] =>
  VALUE_MODE_MATRIX[bt] ?? ['percent'];

const defaultValueFor = (mode: MembershipBenefitValueMode): number => {
  switch (mode) {
    case 'percent': return 10;
    case 'fixed':   return 5;
    case 'count':   return 1;
    default:        return 0; // free / flag carry no numeric value
  }
};

// A benefit that grants a fixed number of redeemable passes. For these the count IS
// the cap, so there is no separate "max redemptions" field.
const isCountValueMode = (mode: MembershipBenefitValueMode) => mode === 'count';
// Access-only benefits (priority booking, member-only access) carry no value at all.
const isFlagValueMode = (mode: MembershipBenefitValueMode) => mode === 'flag';

// Period is the window a redemption cap resets over. Only relevant when a cap is set.
const PERIODS: { value: MembershipBenefitPeriod; label: string }[] = [
  { value: 'per_day', label: 'Per day (resets daily)' },
  { value: 'per_visit', label: 'Per visit' },
  { value: 'per_term', label: 'Per billing term (resets each renewal)' },
  { value: 'once', label: 'Once (never resets)' },
  { value: 'lifetime', label: 'Lifetime (never resets)' },
];

// Legacy period values may exist in older records; map onto valid values if needed.
const normalizePeriod = (p?: string | null): MembershipBenefitPeriod => {
  if (p === 'per_day' || p === 'per_term' || p === 'per_visit' || p === 'lifetime' || p === 'once') return p;
  return 'per_term';
};

const emptyForm: CreateMembershipPlanBenefitData = {
  benefit_type: 'package_discount',
  label: '',
  scope_type: 'any',
  scope_id: null,
  scope_ids: null,
  scope_category: null,
  value_mode: 'percent',
  value: 10,
  period: 'per_term',
  max_redemptions: null,
  priority: 0,
  is_stackable: false,
  is_active: true,
  requires_manual_redemption: false,
};

function describeBenefit(b: MembershipPlanBenefit): string {
  const v = Number(b.value);
  switch (b.value_mode) {
    case 'percent':
      return `${v}% off`;
    case 'fixed':
      return `$${v.toFixed(2)} off`;
    case 'free':
      return 'Free (100% off)';
    case 'count':
      return `${v} pass${v === 1 ? '' : 'es'} / ${normalizePeriod(b.period).replace('_', ' ')}`;
    case 'flag':
      return 'Access grant';
    default:
      return '';
  }
}

const PlanBenefitsManager = ({ plan, onClose, canManage }: Props) => {
  const { themeColor } = useThemeColor();
  const { toast, showSuccess, showError, clear } = useToast();
  const [benefits, setBenefits] = useState<MembershipPlanBenefit[]>([]);
  const [inheritedBenefits, setInheritedBenefits] = useState<MembershipPlanBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateMembershipPlanBenefitData>(emptyForm);

  const [scopeOptions, setScopeOptions] = useState<Record<ScopeTargetType, ScopeOption[]>>({
    package: [],
    attraction: [],
    event: [],
    addon: [],
    location: [],
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;
  const labelCls = 'block text-xs font-medium text-gray-800 mb-1';

  const load = async () => {
    setLoading(true);
    try {
      const [list, inherited] = await Promise.all([
        membershipService.listPlanBenefits(plan.id),
        plan.inherits_plan_id
          ? membershipService.listPlanBenefits(plan.inherits_plan_id)
          : Promise.resolve([] as MembershipPlanBenefit[]),
      ]);
      setBenefits(list);
      setInheritedBenefits(inherited);
    } catch (e: unknown) {
      showError(e, 'Failed to load benefits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const norm = (arr: unknown, nameKey = 'name'): ScopeOption[] =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => {
          const o = x as Record<string, unknown>;
          const loc = o.location as Record<string, unknown> | null | undefined;
          return {
            id: Number(o.id),
            name: String(o[nameKey] ?? `#${o.id}`),
            locationName: loc ? String(loc.name ?? '') : null,
          };
        })
        .filter((o) => Number.isFinite(o.id));

    (async () => {
      setOptionsLoading(true);
      const [pk, at, ev, ad, lo, ca] = await Promise.allSettled([
        packageService.getPackages({ per_page: 500 }),
        attractionService.getAttractions({ per_page: 500 }),
        eventService.getEvents(),
        addOnService.getAddOns({ per_page: 500 }),
        locationService.getLocations(),
        categoryService.getCategories(),
      ]);
      if (!active) return;

      const packages = pk.status === 'fulfilled' ? norm(pk.value?.data?.packages) : [];
      const attractions = at.status === 'fulfilled' ? norm(at.value?.data?.attractions) : [];
      const events = ev.status === 'fulfilled' ? norm(ev.value?.data) : [];
      const addons = ad.status === 'fulfilled' ? norm(ad.value?.data?.add_ons) : [];
      const locations = lo.status === 'fulfilled' ? norm(lo.value?.data) : [];

      let cats: string[] = [];
      if (ca.status === 'fulfilled') {
        const raw = ca.value as unknown;
        const obj = raw as Record<string, unknown>;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(obj?.data)
          ? (obj.data as unknown[])
          : [];
        cats = list
          .map((c) => String((c as Record<string, unknown>)?.name ?? c))
          .filter((n) => n && n !== 'undefined');
      }
      setScopeOptions({ package: packages, attraction: attractions, event: events, addon: addons, location: locations });
      setCategories(Array.from(new Set(cats)));
      setOptionsLoading(false);
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (b: MembershipPlanBenefit) => {
    setEditingId(b.id);
    setForm({
      benefit_type: b.benefit_type,
      label: b.label ?? '',
      scope_type: b.scope_type,
      scope_id: b.scope_id ?? null,
      scope_ids: b.scope_ids && b.scope_ids.length > 0
        ? b.scope_ids
        : (b.scope_id != null ? [b.scope_id] : null),
      scope_category: b.scope_category ?? null,
      value_mode: b.value_mode,
      value: Number(b.value),
      period: normalizePeriod(b.period),
      max_redemptions: b.max_redemptions ?? null,
      priority: b.priority,
      is_stackable: b.is_stackable,
      is_active: b.is_active,
      requires_manual_redemption: b.requires_manual_redemption ?? false,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await membershipService.updatePlanBenefit(plan.id, editingId, form);
        showSuccess('Benefit updated');
      } else {
        await membershipService.createPlanBenefit(plan.id, form);
        showSuccess('Benefit added');
      }
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      showError(e, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: MembershipPlanBenefit) => {
    if (!window.confirm(`Delete this ${b.benefit_type.replace('_', ' ')} benefit?`)) return;
    try {
      await membershipService.deletePlanBenefit(plan.id, b.id);
      showSuccess('Benefit deleted');
      await load();
    } catch (e: unknown) {
      showError(e, 'Delete failed');
    }
  };

  // When the benefit type changes, realign value mode and scope to what's valid for it.
  const onBenefitTypeChange = (bt: MembershipBenefitType) => {
    const allowedScopes = allowedScopesFor(bt);
    const allowedModes = allowedValueModesFor(bt);
    setForm((prev) => {
      const keepScope = allowedScopes.includes(prev.scope_type) ? prev.scope_type : 'any';
      const scopeChanged = keepScope !== prev.scope_type;
      const keepMode = allowedModes.includes(prev.value_mode) ? prev.value_mode : allowedModes[0];
      const modeChanged = keepMode !== prev.value_mode;
      return {
        ...prev,
        benefit_type: bt,
        value_mode: keepMode,
        value: modeChanged ? defaultValueFor(keepMode) : prev.value,
        // max redemptions only applies to discounts; passes use their count as the cap.
        max_redemptions: isCountValueMode(keepMode) || isFlagValueMode(keepMode) ? null : prev.max_redemptions,
        scope_type: keepScope,
        scope_id: scopeChanged ? null : prev.scope_id,
        scope_ids: scopeChanged ? null : prev.scope_ids,
        scope_category: scopeChanged ? null : prev.scope_category,
      };
    });
  };

  const onValueModeChange = (mode: MembershipBenefitValueMode) => {
    setForm((prev) => ({
      ...prev,
      value_mode: mode,
      value: defaultValueFor(mode),
      // count = self-capping passes; flag = no value -> no separate redemption cap.
      max_redemptions: isCountValueMode(mode) || isFlagValueMode(mode) ? null : prev.max_redemptions,
    }));
  };

  const onScopeTypeChange = (st: MembershipBenefitScopeType) => {
    setForm((prev) => ({ ...prev, scope_type: st, scope_id: null, scope_ids: null, scope_category: null }));
  };

  const toggleScopeTarget = (id: number) => {
    setForm((prev) => {
      const current = prev.scope_ids ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...prev, scope_ids: next.length > 0 ? next : null, scope_id: null };
    });
  };

  const scopeTargetLabel = (b: MembershipPlanBenefit): string => {
    if (b.scope_type === 'category') return b.scope_category ? `category: ${b.scope_category}` : 'category';
    if (b.scope_type === 'any') return ANY_LABEL[b.benefit_type] ?? 'all items';
    const targetType = b.scope_type as ScopeTargetType;
    const opts = scopeOptions[targetType];
    const ids = b.scope_ids && b.scope_ids.length > 0 ? b.scope_ids : (b.scope_id != null ? [b.scope_id] : []);
    if (ids.length === 0) return `all ${b.scope_type}s`;
    const names = ids.map((id) => opts?.find((o) => o.id === id)?.name ?? `#${id}`);
    const shown = names.slice(0, 2).join(', ');
    const extra = names.length > 2 ? ` +${names.length - 2}` : '';
    return `${b.scope_type}: ${shown}${extra}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className={`px-5 py-5 bg-${themeColor}-50 border-b border-gray-100 flex items-center justify-between`}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className={`w-5 h-5 text-${themeColor}-600`} />
              Enforceable Benefits — {plan.name}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              These rules are applied automatically at checkout and check-in (server-enforced).
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/60 text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center"><LoadingSpinner size="medium" /></div>
          ) : benefits.length === 0 && inheritedBenefits.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <div className={`inline-flex p-3 rounded-full bg-${themeColor}-50 mb-2`}>
                <Tag className={`w-6 h-6 text-${themeColor}-600`} />
              </div>
              <p>No enforceable benefits yet.</p>
              <p className="text-xs mt-1">Add one to automate discounts or passes for this plan.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inheritedBenefits.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Inherited from {plan.inherits_plan_id ? `Plan #${plan.inherits_plan_id}` : 'parent plan'} (read-only)
                  </p>
                  {inheritedBenefits.map((b) => (
                    <div
                      key={`inh-${b.id}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 opacity-80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {b.benefit_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {describeBenefit(b)}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">scope: {scopeTargetLabel(b)}</span>
                          {!b.is_active && <span className="text-[10px] uppercase text-red-400">inactive</span>}
                        </div>
                        {b.label && <p className="text-xs text-gray-400 mt-0.5 truncate">{b.label}</p>}
                      </div>
                    </div>
                  ))}
                  {benefits.length > 0 && (
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-3 mb-1">
                      This plan's own benefits
                    </p>
                  )}
                </>
              )}
              {benefits.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                    b.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {b.benefit_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-${themeColor}-50 text-${themeColor}-700`}>
                        {describeBenefit(b)}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        scope: {scopeTargetLabel(b)}
                      </span>
                      {b.is_stackable && <span className="text-[10px] uppercase text-gray-400">stackable</span>}
                      {b.requires_manual_redemption && <span className="text-[10px] uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">manual</span>}
                      {!b.is_active && <span className="text-[10px] uppercase text-red-400">inactive</span>}
                    </div>
                    {b.label && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.label}</p>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(b)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Edit">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => remove(b)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showForm && canManage && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {editingId ? 'Edit benefit' : 'New benefit'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Benefit type</label>
                  <select
                    value={form.benefit_type}
                    onChange={(e) => onBenefitTypeChange(e.target.value as MembershipBenefitType)}
                    className={inputCls}
                  >
                    {BENEFIT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`${labelCls} flex items-center gap-1`}>
                    Value mode <InfoTooltip content="How this benefit's value is applied. Options are limited to what fits the benefit type: discounts reduce price, passes grant a count, access benefits are flags." />
                  </label>
                  <select
                    value={form.value_mode}
                    onChange={(e) => onValueModeChange(e.target.value as MembershipBenefitValueMode)}
                    className={inputCls}
                  >
                    {VALUE_MODES.filter((m) => allowedValueModesFor(form.benefit_type).includes(m.value)).map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {(form.value_mode === 'percent' || form.value_mode === 'fixed' || form.value_mode === 'count') && (
                  <div>
                    <label className={`${labelCls} flex items-center gap-1`}>
                      {form.value_mode === 'percent' ? 'Percent off' : form.value_mode === 'fixed' ? 'Amount off ($)' : 'Number of passes'}
                      {form.value_mode === 'count' && (
                        <InfoTooltip content="How many passes the member gets each reset period. This count is itself the usage cap — there's no separate redemption limit." />
                      )}
                    </label>
                    <input
                      type="number"
                      step={form.value_mode === 'count' ? 1 : 0.01}
                      min={form.value_mode === 'count' ? 1 : 0}
                      value={form.value ?? ''}
                      onChange={(e) => setForm({ ...form, value: e.target.value ? parseFloat(e.target.value) : 0 })}
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className={`${labelCls} flex items-center gap-1`}>
                    Applies to
                    <InfoTooltip content="Which items this benefit covers. Options are limited to what makes sense for the selected benefit type." />
                  </label>
                  <select
                    value={form.scope_type}
                    onChange={(e) => onScopeTypeChange(e.target.value as MembershipBenefitScopeType)}
                    className={inputCls}
                  >
                    {SCOPE_TYPES.filter((s) => allowedScopesFor(form.benefit_type).includes(s.value)).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.value === 'any' ? (ANY_LABEL[form.benefit_type] ?? s.label) : s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {['package', 'attraction', 'event', 'addon', 'location'].includes(form.scope_type) && (
                  <div className="col-span-2">
                    <label className={`${labelCls} flex items-center gap-1`}>
                      Target {form.scope_type}s
                      <InfoTooltip content={`Tick one or more ${form.scope_type}s this benefit applies to. Select none to apply to every ${form.scope_type}.`} />
                    </label>
                    {optionsLoading ? (
                      <div className="text-xs text-gray-500 py-2">Loading {form.scope_type}s…</div>
                    ) : (scopeOptions[form.scope_type as ScopeTargetType]?.length ?? 0) === 0 ? (
                      <div className="text-xs text-gray-500 py-2">No {form.scope_type}s available.</div>
                    ) : (
                      <>
                        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                          {scopeOptions[form.scope_type as ScopeTargetType]?.map((o) => {
                            const checked = (form.scope_ids ?? []).includes(o.id);
                            return (
                              <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleScopeTarget(o.id)}
                                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                                />
                                <span className="truncate flex-1">{o.name}</span>
                                {o.locationName && (
                                  <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">— {o.locationName}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {(form.scope_ids?.length ?? 0) === 0
                            ? `Applies to all ${form.scope_type}s`
                            : `${form.scope_ids!.length} ${form.scope_type}${form.scope_ids!.length === 1 ? '' : 's'} selected`}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {form.scope_type === 'category' && (
                  <div>
                    <label className={labelCls}>Category</label>
                    {categories.length > 0 ? (
                      <select
                        value={form.scope_category ?? ''}
                        onChange={(e) => setForm({ ...form, scope_category: e.target.value || null })}
                        className={inputCls}
                      >
                        <option value="">Select a category…</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.scope_category ?? ''}
                        onChange={(e) => setForm({ ...form, scope_category: e.target.value || null })}
                        className={inputCls}
                        placeholder="Category name"
                      />
                    )}
                  </div>
                )}

                {(form.value_mode === 'percent' || form.value_mode === 'fixed' || form.value_mode === 'free') && (
                  <div>
                    <label className={`${labelCls} flex items-center gap-1`}>
                      Max redemptions <InfoTooltip content="Cap on how many times this discount can be used. Leave empty for unlimited — the reset window only matters when a cap is set." />
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_redemptions ?? ''}
                      onChange={(e) => setForm({ ...form, max_redemptions: e.target.value ? parseInt(e.target.value) : null })}
                      className={inputCls}
                      placeholder="Unlimited"
                    />
                  </div>
                )}

                {(form.value_mode === 'count' || (form.max_redemptions != null && form.max_redemptions > 0)) && (
                  <div>
                    <label className={`${labelCls} flex items-center gap-1`}>
                      Resets <InfoTooltip content={form.value_mode === 'count' ? 'How often the pass count refills back to full.' : 'How often the redemption cap above resets back to full.'} />
                    </label>
                    <select
                      value={normalizePeriod(form.period)}
                      onChange={(e) => setForm({ ...form, period: e.target.value as MembershipBenefitPeriod })}
                      className={inputCls}
                    >
                      {PERIODS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={`${labelCls} flex items-center gap-1`}>
                    Priority <InfoTooltip content="Higher priority benefits are applied first when multiple match a line." />
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.priority ?? 0}
                    onChange={(e) => setForm({ ...form, priority: e.target.value ? parseInt(e.target.value) : 0 })}
                    className={inputCls}
                  />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Label (optional)</label>
                  <input
                    value={form.label ?? ''}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. Member 15% off all packages"
                  />
                </div>

                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.is_stackable}
                    onChange={(e) => setForm({ ...form, is_stackable: e.target.checked })}
                    className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Stackable with other benefits
                  <InfoTooltip content="If off, this benefit will not combine with other discounts on the same line." />
                </label>

                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.requires_manual_redemption}
                    onChange={(e) => setForm({ ...form, requires_manual_redemption: e.target.checked })}
                    className={`rounded border-gray-300 text-amber-600 focus:ring-amber-500`}
                  />
                  Manual redemption only
                  <InfoTooltip content="When enabled, this benefit is NOT auto-applied at checkout. Staff must redeem it manually. Use for birthday rewards, special staff discounts, etc." />
                </label>

                <label className="text-sm text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <StandardButton variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </StandardButton>
                <StandardButton variant="primary" size="sm" icon={Save} onClick={save} loading={saving}>
                  {editingId ? 'Update' : 'Add'} benefit
                </StandardButton>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-between bg-gray-50">
          <div>
            {canManage && !showForm && (
              <StandardButton variant="primary" size="sm" icon={Plus} onClick={startCreate}>
                Add benefit
              </StandardButton>
            )}
          </div>
          <StandardButton variant="secondary" size="sm" onClick={onClose}>
            Done
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default PlanBenefitsManager;
