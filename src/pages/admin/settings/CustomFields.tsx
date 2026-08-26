import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Plus, Pencil, Trash2, X } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Toast from '../../../components/ui/Toast';
import TargetingPicker, { type TargetingValue } from '../../../components/admin/TargetingPicker';
import customFieldService, {
  type CustomField,
  type CustomFieldAudience,
} from '../../../services/CustomFieldService';

const EMPTY_TARGETING: TargetingValue = {
  location_ids: null,
  package_ids: null,
  attraction_ids: null,
  event_ids: null,
};

const AUDIENCE_LABELS: Record<CustomFieldAudience, string> = {
  both: 'Customers and staff',
  customer: 'Customers only',
  admin: 'Staff only',
};

const describeTargets = (field: CustomField) => {
  const parts: string[] = [];
  const count = (ids?: number[] | null) => (ids && ids.length ? ids.length : 0);

  if (count(field.package_ids)) parts.push(`${count(field.package_ids)} package(s)`);
  if (count(field.attraction_ids)) parts.push(`${count(field.attraction_ids)} attraction(s)`);
  if (count(field.event_ids)) parts.push(`${count(field.event_ids)} event(s)`);

  const items = parts.length ? parts.join(' · ') : 'Everything';
  const where = count(field.location_ids) ? `${count(field.location_ids)} location(s)` : 'All locations';

  return `${items} — ${where}`;
};

/**
 * Checkboxes an admin can attach to whatever they sell. Named "custom fields" because
 * more input types will land here later; today the only type is a checkbox.
 */
const CustomFields = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [editing, setEditing] = useState<CustomField | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [helpText, setHelpText] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [audience, setAudience] = useState<CustomFieldAudience>('both');
  const [isActive, setIsActive] = useState(true);
  const [targeting, setTargeting] = useState<TargetingValue>(EMPTY_TARGETING);

  const load = async () => {
    setLoading(true);
    try {
      setFields(await customFieldService.list());
    } catch {
      setToast({ message: 'Could not load custom fields.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setHelpText('');
    setIsRequired(false);
    setAudience('both');
    setIsActive(true);
    setTargeting(EMPTY_TARGETING);
    setShowForm(true);
  };

  const openEdit = (field: CustomField) => {
    setEditing(field);
    setLabel(field.label);
    setHelpText(field.help_text ?? '');
    setIsRequired(field.is_required);
    setAudience(field.audience);
    setIsActive(field.is_active);
    setTargeting({
      location_ids: field.location_ids ?? null,
      package_ids: field.package_ids ?? null,
      attraction_ids: field.attraction_ids ?? null,
      event_ids: field.event_ids ?? null,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!label.trim()) {
      setToast({ message: 'Give the checkbox a label first.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: label.trim(),
        help_text: helpText.trim() || null,
        is_required: isRequired,
        audience,
        is_active: isActive,
        ...targeting,
      };

      if (editing) {
        await customFieldService.update(editing.id, payload);
      } else {
        await customFieldService.create(payload);
      }

      setToast({ message: editing ? 'Checkbox updated.' : 'Checkbox added.', type: 'success' });
      setShowForm(false);
      await load();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not save that checkbox.';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (field: CustomField) => {
    if (!window.confirm(`Remove "${field.label}"? Answers already collected are kept.`)) return;
    try {
      await customFieldService.remove(field.id);
      setToast({ message: 'Checkbox removed.', type: 'success' });
      await load();
    } catch {
      setToast({ message: 'Could not remove that checkbox.', type: 'error' });
    }
  };

  const active = useMemo(() => fields.filter(f => f.is_active).length, [fields]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-gray-600 text-sm mt-1">
            Extra checkboxes shown at checkout. Pick which packages, attractions or events ask them.
          </p>
        </div>
        <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreate}>
          Add checkbox
        </StandardButton>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {fields.length} field{fields.length === 1 ? '' : 's'}
          </span>
          <span className="text-xs text-gray-500">{active} active</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <div className="p-10 text-center">
            <CheckSquare className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No custom fields yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add a checkbox to ask something extra before a purchase completes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {fields.map(field => (
              <li key={field.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{field.label}</span>
                    {field.is_required && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Required
                      </span>
                    )}
                    {!field.is_active && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        Off
                      </span>
                    )}
                  </div>
                  {field.help_text && <p className="text-xs text-gray-500 mt-0.5">{field.help_text}</p>}
                  <p className="text-xs text-gray-500 mt-1">{describeTargets(field)}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{AUDIENCE_LABELS[field.audience]}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {field.can_manage === false ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded bg-gray-100 text-gray-500">
                      Company-wide
                    </span>
                  ) : (
                  <>
                  <button
                    type="button"
                    onClick={() => openEdit(field)}
                    aria-label={`Edit ${field.label}`}
                    className="p-2 rounded-lg text-blue-800 hover:bg-blue-50"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(field)}
                    aria-label={`Remove ${field.label}`}
                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                  </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit checkbox' : 'Add checkbox'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Checkbox label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  maxLength={255}
                  placeholder="I have read the safety rules"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Exactly what the guest or staff member reads.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Helper text</label>
                <input
                  type="text"
                  value={helpText}
                  onChange={e => setHelpText(e.target.value)}
                  maxLength={255}
                  placeholder="Optional line under the checkbox"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Who sees it</label>
                  <select
                    value={audience}
                    onChange={e => setAudience(e.target.value as CustomFieldAudience)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="both">Customers and staff</option>
                    <option value="customer">Customers only</option>
                    <option value="admin">Staff only</option>
                  </select>
                </div>
                <div className="flex flex-col justify-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={e => setIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">Must be ticked to continue</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-800">Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Where it appears</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Search, filter by venue, or select a whole list at once.
                </p>
                <TargetingPicker value={targeting} onChange={setTargeting} />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex flex-col sm:flex-row gap-2">
              <StandardButton variant="primary" size="md" onClick={save} disabled={saving} loading={saving} fullWidth>
                {editing ? 'Save changes' : 'Add checkbox'}
              </StandardButton>
              <StandardButton variant="secondary" size="md" onClick={() => setShowForm(false)} disabled={saving} fullWidth>
                Cancel
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomFields;
