import { useEffect, useState } from 'react';
import { X, Pencil, RefreshCw } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import EmailInput from '../../ui/EmailInput';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { userService } from '../../../services/UserService';
import Toast from '../../ui/Toast';
import ManagerLocationsPicker from './ManagerLocationsPicker';
import type { ManageAccountsAccount } from '../../../types/ManageAccounts.types';

interface AccountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ManageAccountsAccount | null;
  onSaved: (updated: ManageAccountsAccount) => void;
  locations?: Array<{ id: number; name: string }>;
  canManageLocations?: boolean;
}

interface EditForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  shift: string;
  status: 'active' | 'inactive';
  home_location_id: number | null;
  extra_location_ids: number[];
}

const DEPARTMENTS = [
  'Guest Services',
  'Entertainment',
  'Food & Beverage',
  'Maintenance',
  'Security',
  'Administration',
];

const SHIFTS = ['Morning', 'Afternoon', 'Evening', 'Night', 'Flexible'];

const AccountEditModal = ({ isOpen, onClose, account, onSaved, locations = [], canManageLocations = false }: AccountEditModalProps) => {
  const { themeColor } = useThemeColor();

  const [form, setForm] = useState<EditForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    shift: '',
    status: 'active',
    home_location_id: null,
    extra_location_ids: [],
  });
  const editsLocations = canManageLocations && account?.userType === 'manager';
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!isOpen || !account) return;
    setForm({
      first_name: account.firstName,
      last_name: account.lastName,
      email: account.email,
      phone: account.phone,
      position: account.position,
      department: account.department,
      shift: account.shift ?? '',
      status: account.status,
      home_location_id: account.locationId ?? null,
      extra_location_ids: (account.workLocationIds ?? []).filter((id) => id !== account.locationId),
    });
    setFieldErrors({});
    setToast(null);
  }, [isOpen, account]);

  const update = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.first_name.trim()) return 'First name is required.';
    if (!form.last_name.trim()) return 'Last name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (editsLocations && !form.home_location_id) return 'Choose a home location for this manager.';
    return null;
  };

  const extraLocationIds = form.extra_location_ids.filter((id) => id !== form.home_location_id);

  const handleSubmit = async () => {
    const localErr = validate();
    if (localErr) {
      showToast(localErr, 'error');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      const res = await userService.updateUser(Number(account!.id), {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        department: form.department,
        shift: form.shift,
        status: form.status,
        ...(editsLocations && form.home_location_id
          ? { location_id: form.home_location_id, location_ids: [form.home_location_id, ...extraLocationIds] }
          : {}),
      } as unknown as Parameters<typeof userService.updateUser>[1]);

      if (!res.success || !res.data) {
        showToast(res.message || 'Failed to save changes.', 'error');
        return;
      }

      const nameOf = (id: number | null) => locations.find((l) => l.id === id)?.name;

      showToast('Changes saved successfully.', 'success');
      onSaved({
        ...account!,
        firstName: form.first_name.trim(),
        lastName: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        department: form.department,
        shift: form.shift,
        status: form.status,
        ...(editsLocations
          ? {
            location: nameOf(form.home_location_id) ?? account!.location,
            locationId: form.home_location_id,
            workLocationIds: extraLocationIds,
            workLocationNames: extraLocationIds.map((id) => nameOf(id)).filter((name): name is string => Boolean(name)),
          }
          : {}),
      });

      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      const e = err as {
        response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const status = e.response?.status;
      const data = e.response?.data;
      if (status === 422 && data?.errors) {
        setFieldErrors(data.errors);
        showToast(data.message || 'Please correct the highlighted fields.', 'error');
      } else if (status === 403) {
        showToast(data?.message || 'You do not have permission to edit this account.', 'error');
      } else {
        showToast(data?.message || 'Something went wrong. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !account) return null;

  const inputClass = (field: string) =>
    `w-full px-3 py-2 border ${fieldErrors[field] ? 'border-red-400' : 'border-gray-300'} rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Pencil className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Edit Account</h3>
              <p className="text-xs text-gray-500">
                {account.firstName} {account.lastName} · {account.employeeId}
              </p>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            disabled={submitting}
            variant="ghost"
            size="sm"
            icon={X}
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => update('first_name', e.target.value)}
                disabled={submitting}
                className={inputClass('first_name')}
              />
              {fieldErrors.first_name && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.first_name[0]}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => update('last_name', e.target.value)}
                disabled={submitting}
                className={inputClass('last_name')}
              />
              {fieldErrors.last_name && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.last_name[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <EmailInput
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              disabled={submitting}
              className={inputClass('email')}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              disabled={submitting}
              className={inputClass('phone')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => update('position', e.target.value)}
              disabled={submitting}
              className={inputClass('position')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                disabled={submitting}
                className={inputClass('department')}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
              <select
                value={form.shift}
                onChange={(e) => update('shift', e.target.value)}
                disabled={submitting}
                className={inputClass('shift')}
              >
                <option value="">— Select —</option>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as 'active' | 'inactive')}
              disabled={submitting}
              className={inputClass('status')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {editsLocations && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home location *</label>
                <select
                  value={form.home_location_id ?? ''}
                  onChange={(e) => {
                    const home = e.target.value ? Number(e.target.value) : null;
                    setForm((prev) => ({
                      ...prev,
                      home_location_id: home,
                      extra_location_ids: prev.extra_location_ids.filter((id) => id !== home),
                    }));
                  }}
                  disabled={submitting}
                  className={inputClass('location_id')}
                >
                  <option value="">Select a location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Where this manager starts each time they sign in.</p>
                {fieldErrors.location_id && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.location_id[0]}</p>
                )}
              </div>
              <ManagerLocationsPicker
                locations={locations}
                homeLocationId={form.home_location_id}
                selectedIds={extraLocationIds}
                onChange={(ids) => update('extra_location_ids', ids)}
                themeColor={themeColor}
                disabled={submitting}
                error={fieldErrors.location_ids?.[0]}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <StandardButton
            onClick={onClose}
            disabled={submitting}
            variant="secondary"
            size="md"
            fullWidth
          >
            Cancel
          </StandardButton>
          <StandardButton
            onClick={handleSubmit}
            disabled={submitting}
            variant="primary"
            size="md"
            icon={submitting ? RefreshCw : Pencil}
            loading={submitting}
            fullWidth
          >
            {submitting ? 'Saving...' : 'Save changes'}
          </StandardButton>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default AccountEditModal;
