import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Code2, CheckSquare, Square, Eye, Tablet } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import type { WaiverTemplate, WaiverTemplatePayload, ActivityType, AvailableActivities } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';

type ClauseKey =
  | 'minor_section_enabled' | 'dob_required' | 'relationship_required'
  | 'photo_video_release_enabled' | 'medical_ack_enabled' | 'property_damage_enabled'
  | 'group_leader_clause_enabled' | 'electronic_consent_enabled';

const clauseFields: Array<{ key: ClauseKey; label: string; hint?: string }> = [
  { key: 'minor_section_enabled', label: 'Minor section', hint: 'Allow adding children to this waiver' },
  { key: 'dob_required', label: 'Require minor date of birth' },
  { key: 'relationship_required', label: 'Require minor relationship' },
  { key: 'photo_video_release_enabled', label: 'Photo / video release clause' },
  { key: 'medical_ack_enabled', label: 'Medical acknowledgment clause' },
  { key: 'property_damage_enabled', label: 'Property damage clause' },
  { key: 'group_leader_clause_enabled', label: 'Group leader clause' },
  { key: 'electronic_consent_enabled', label: 'Electronic signature consent', hint: 'Require explicit e-signature consent' },
];

const assignmentTypes: Array<{ type: ActivityType; label: string; column: keyof WaiverTemplatePayload }> = [
  { type: 'package', label: 'Packages', column: 'assigned_package_ids' },
  { type: 'attraction', label: 'Attractions', column: 'assigned_attraction_ids' },
  { type: 'event', label: 'Events', column: 'assigned_event_ids' },
];

// Friendly groupings for the merge-tag picker (mirrors the email-notification editor).
const TOKEN_GROUPS: Array<{ name: string; keys: string[] }> = [
  { name: 'Company', keys: ['business_legal_name', 'company_name', 'company_email', 'company_phone'] },
  { name: 'Location', keys: ['location_name', 'location_address'] },
  { name: 'Activity & date', keys: ['activity_name', 'booking_date', 'visit_date'] },
  { name: 'Guardian / signer', keys: ['full_name', 'adult_first_name', 'adult_last_name', 'adult_email', 'adult_phone', 'relationship'] },
  { name: 'General', keys: ['current_date', 'current_year'] },
];

const defaultForm: WaiverTemplatePayload = {
  title: '',
  internal_description: '',
  status: 'draft',
  is_default: false,
  body_text: '',
  validity_duration_days: null,
  max_minors: 10,
  duplicate_rule: 'manager_only',
  reminder_eligible: true,
  assigned_package_ids: [],
  assigned_attraction_ids: [],
  assigned_event_ids: [],
  minor_section_enabled: true,
  dob_required: false,
  relationship_required: false,
  photo_video_release_enabled: false,
  medical_ack_enabled: false,
  property_damage_enabled: false,
  group_leader_clause_enabled: false,
  electronic_consent_enabled: true,
  marketing_consent_enabled: false,
  marketing_consent_text: '',
  marketing_helper_text: '',
};

const WaiverBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { themeColor, fullColor } = useThemeColor();

  const [form, setForm] = useState<WaiverTemplatePayload>(defaultForm);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<Record<ActivityType, AvailableActivities['available']>>({ package: [], attraction: [], event: [], party_type: [] });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof WaiverTemplatePayload>(key: K, value: WaiverTemplatePayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // load content tokens + available activities (exclusivity-aware)
  const loadActivities = useCallback(async (exceptId?: number) => {
    const results = await Promise.all(
      assignmentTypes.map((a) => waiverService.availableActivities(a.type, exceptId).catch(() => null)),
    );
    setActivities((prev) => {
      const next = { ...prev };
      assignmentTypes.forEach((a, i) => {
        const r = results[i];
        if (r?.success) next[a.type] = r.data.available;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    waiverService.contentTokens().then((r) => r.success && setTokens(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const exceptId = id ? Number(id) : undefined;
    if (isEdit && id) {
      (async () => {
        try {
          const res = await waiverService.getTemplate(Number(id));
          if (res.success) {
            const t = res.data as WaiverTemplate;
            setForm({
              title: t.title,
              internal_description: t.internal_description ?? '',
              status: t.status,
              is_default: t.is_default,
              body_text: t.body_text,
              validity_duration_days: t.validity_duration_days,
              max_minors: t.max_minors,
              duplicate_rule: t.duplicate_rule,
              reminder_eligible: t.reminder_eligible,
              assigned_package_ids: t.assigned_package_ids ?? [],
              assigned_attraction_ids: t.assigned_attraction_ids ?? [],
              assigned_event_ids: t.assigned_event_ids ?? [],
              minor_section_enabled: t.minor_section_enabled,
              dob_required: t.dob_required,
              relationship_required: t.relationship_required,
              photo_video_release_enabled: t.photo_video_release_enabled,
              medical_ack_enabled: t.medical_ack_enabled,
              property_damage_enabled: t.property_damage_enabled,
              group_leader_clause_enabled: t.group_leader_clause_enabled,
              electronic_consent_enabled: t.electronic_consent_enabled,
              marketing_consent_enabled: t.marketing_consent_enabled,
              marketing_consent_text: t.marketing_consent_text ?? '',
              marketing_helper_text: t.marketing_helper_text ?? '',
            });
          }
        } catch {
          setToast({ message: 'Failed to load template', type: 'error' });
        } finally {
          setLoading(false);
        }
      })();
    }
    loadActivities(exceptId);
  }, [id, isEdit, loadActivities]);

  const insertToken = (token: string) => {
    const el = bodyRef.current;
    const body = form.body_text ?? '';
    if (!el) {
      set('body_text', body + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    set('body_text', next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const toggleAssignment = (column: keyof WaiverTemplatePayload, itemId: number) => {
    const current = (form[column] as number[] | undefined) ?? [];
    const next = current.includes(itemId) ? current.filter((x) => x !== itemId) : [...current, itemId];
    set(column, next as WaiverTemplatePayload[typeof column]);
  };

  const renderPreview = (): string => {
    let body = form.body_text ?? '';
    Object.keys(tokens).forEach((key) => {
      const label = tokens[key] || key.replace(/_/g, ' ');
      body = body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), `[${label}]`);
    });
    return body;
  };

  const save = async () => {
    if (!form.title?.trim()) { setToast({ message: 'Title is required', type: 'error' }); return; }
    if (!form.body_text?.trim()) { setToast({ message: 'Waiver text is required', type: 'error' }); return; }
    setSaving(true);
    try {
      if (isEdit && id) {
        await waiverService.updateTemplate(Number(id), form);
        setToast({ message: 'Template saved', type: 'success' });
      } else {
        const res = await waiverService.createTemplate(form);
        setToast({ message: 'Template created', type: 'success' });
        if (res.success) {
          navigate(`/waivers/templates/${res.data.id}/edit`, { replace: true });
        }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const conflict = e.response?.data?.errors ? Object.keys(e.response.data.errors)[0] : null;
      setToast({ message: e.response?.data?.message || (conflict ? 'Some activities are already assigned elsewhere.' : 'Failed to save template'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`} /></div>;
  }

  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`;
  const card = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';

  return (
    <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/waivers/templates')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Waiver Template' : 'New Waiver Template'}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Editing the legal text creates a new version automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <StandardButton
              variant="secondary"
              icon={Tablet}
              onClick={() => window.open(`/waiver/kiosk/${id}${form.status === 'active' ? '' : '?preview=1'}`, '_blank', 'noopener')}
            >
              {form.status === 'active' ? 'Launch Kiosk' : 'Test Kiosk'}
            </StandardButton>
          )}
          <StandardButton variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</StandardButton>
        </div>
      </div>

      <div className="space-y-5">
        {/* Basics */}
        <div className={card}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title *</label>
              <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} className={fieldCls} placeholder="e.g. General Liability Waiver" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Internal description <span className="text-gray-400 font-normal">(staff only)</span></label>
              <input type="text" value={form.internal_description ?? ''} onChange={(e) => set('internal_description', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as WaiverTemplatePayload['status'])} className={fieldCls}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!form.is_default} onChange={(e) => set('is_default', e.target.checked)} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
                Use as default (catch-all) waiver
              </label>
            </div>
          </div>
        </div>

        {/* Legal body */}
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Waiver Text *</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Write the legal text, then click a field on the right to drop it in — it fills in automatically when the waiver is signed.</p>
            </div>
            <button type="button" onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:underline shrink-0"><Eye className="w-3.5 h-3.5" /> {preview ? 'Edit' : 'Preview'}</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {preview ? (
                <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap min-h-[20rem] bg-gray-50/40">{renderPreview() || <span className="text-gray-400">Nothing to preview yet.</span>}</div>
              ) : (
                <textarea ref={bodyRef} value={form.body_text} onChange={(e) => set('body_text', e.target.value)} rows={18} className={`${fieldCls} font-mono leading-relaxed`} placeholder="Enter the full legal waiver text. Use the fields on the right to insert auto-filled details." />
              )}
            </div>
            <div className="lg:col-span-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Code2 className={`w-4 h-4 text-${fullColor}`} />
                <span className="text-xs font-bold text-gray-900">Insert a field</span>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 max-h-[22rem] overflow-y-auto bg-gray-50/40 space-y-3">
                {Object.keys(tokens).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Loading fields…</p>
                ) : (
                  TOKEN_GROUPS.map((g) => {
                    const items = g.keys.filter((k) => k in tokens);
                    if (items.length === 0) return null;
                    return (
                      <div key={g.name}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{g.name}</p>
                        <div className="space-y-1">
                          {items.map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => insertToken(`{{${k}}}`)}
                              className="w-full text-left px-2 py-1.5 rounded border border-transparent hover:border-gray-200 hover:bg-white transition"
                            >
                              <span className="block text-sm text-gray-800">{tokens[k]}</span>
                              <span className={`block text-[11px] font-mono text-${fullColor}`}>{`{{${k}}}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Rules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Validity (days)</label>
              <input type="number" min={1} value={form.validity_duration_days ?? ''} onChange={(e) => set('validity_duration_days', e.target.value ? Number(e.target.value) : null)} className={fieldCls} placeholder="No expiry" />
            </div>
            <div>
              <label className={labelCls}>Max minors</label>
              <input type="number" min={0} max={50} value={form.max_minors ?? 0} onChange={(e) => set('max_minors', Number(e.target.value))} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Duplicate rule</label>
              <select value={form.duplicate_rule} onChange={(e) => set('duplicate_rule', e.target.value as WaiverTemplatePayload['duplicate_rule'])} className={fieldCls}>
                <option value="none">Block duplicates</option>
                <option value="manager_only">Manager-assigned only</option>
                <option value="allow">Allow duplicates</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-4">
            <input type="checkbox" checked={!!form.reminder_eligible} onChange={(e) => set('reminder_eligible', e.target.checked)} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
            Send a 24-hour reminder if incomplete
          </label>
        </div>

        {/* Clauses */}
        <div className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Clauses & Fields</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            {clauseFields.map((c) => (
              <label key={c.key} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={!!form[c.key]} onChange={(e) => set(c.key, e.target.checked)} className={`mt-0.5 h-4 w-4 text-${fullColor} rounded border-gray-300`} />
                <span className="text-sm text-gray-700">{c.label}{c.hint && <span className="block text-[11px] text-gray-400">{c.hint}</span>}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Marketing */}
        <div className={card}>
          <label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer mb-3">
            <input type="checkbox" checked={!!form.marketing_consent_enabled} onChange={(e) => set('marketing_consent_enabled', e.target.checked)} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
            Marketing consent opt-in
          </label>
          {form.marketing_consent_enabled && (
            <div className="space-y-3 pl-6">
              <div>
                <label className={labelCls}>Consent text</label>
                <input type="text" value={form.marketing_consent_text ?? ''} onChange={(e) => set('marketing_consent_text', e.target.value)} className={fieldCls} placeholder="Keep me updated on events, coupons, and offers." />
              </div>
              <div>
                <label className={labelCls}>Helper text <span className="text-gray-400 font-normal">(fine print)</span></label>
                <input type="text" value={form.marketing_helper_text ?? ''} onChange={(e) => set('marketing_helper_text', e.target.value)} className={fieldCls} />
              </div>
              <p className="text-[11px] text-gray-400">The box is always unchecked by default — guests must opt in.</p>
            </div>
          )}
        </div>

        {/* Assignment (exclusivity-aware) */}
        <div className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-1">Assign to activities</h2>
          <p className="text-xs text-gray-400 mb-4">Activities already assigned to another template don't appear here — each can belong to only one waiver.</p>
          <div className="space-y-5">
            {assignmentTypes.map((a) => {
              const list = activities[a.type] || [];
              const selected = (form[a.column] as number[] | undefined) ?? [];
              return (
                <div key={a.type}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">{a.label}</label>
                    {selected.length > 0 && <span className={`text-xs font-medium text-${fullColor}`}>{selected.length} selected</span>}
                  </div>
                  {list.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg border border-gray-200">No available {a.label.toLowerCase()}.</div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
                      {list.map((item) => {
                        const checked = selected.includes(item.id);
                        return (
                          <button key={item.id} type="button" onClick={() => toggleAssignment(a.column, item.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${checked ? `bg-${themeColor}-50` : ''}`}>
                            {checked ? <CheckSquare className={`w-4 h-4 text-${fullColor}`} /> : <Square className="w-4 h-4 text-gray-400" />}
                            <span className="min-w-0">
                              <span className="block text-sm text-gray-900">{item.name}</span>
                              {item.location_name && <span className="block text-[11px] text-gray-400">{item.location_name}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pb-8">
          <StandardButton variant="secondary" onClick={() => navigate('/waivers/templates')}>Cancel</StandardButton>
          <StandardButton variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</StandardButton>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default WaiverBuilder;
