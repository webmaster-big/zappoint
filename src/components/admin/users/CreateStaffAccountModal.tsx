import { useCallback, useEffect, useState } from 'react';
import {
  X,
  UserPlus,
  Mail,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { userService } from '../../../services/UserService';
import { locationService } from '../../../services/LocationService';
import type {
  CreateStaffAccountData,
  StaffAccountResult,
} from '../../../services/UserService';
import { getStoredUser } from '../../../utils/storage';
import CreateLocationModal from './CreateLocationModal';
import Toast from '../../ui/Toast';

interface CreateStaffAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful create so the parent can refetch its user list. */
  onCreated?: (result: StaffAccountResult) => void;
}

type Role = 'location_manager' | 'attendant' | 'company_admin';

const initialForm: CreateStaffAccountData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: 'attendant',
  location_id: null,
  password_mode: 'generate',
  password: '',
  send_email: true,
  return_password: true,
};

/**
 * Create Staff Account modal.
 *
 * Implements the FE side of POST /api/users/staff (Section 4 of
 * BACKEND_PROMPT_DIRECT_ACCOUNT_PROVISIONING.md). The backend forces
 * `company_id` from the bearer token, so we never send it. We DO send
 * `location_id` for location_manager / attendant — the dropdown is
 * sourced from /api/locations which is already auto-scoped to the
 * caller's company.
 */
const CreateStaffAccountModal = ({ isOpen, onClose, onCreated }: CreateStaffAccountModalProps) => {
  const { themeColor } = useThemeColor();
  const currentUser = getStoredUser();

  const [form, setForm] = useState<CreateStaffAccountData>(initialForm);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState<StaffAccountResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Only company_admin can create new locations.
  const canCreateLocation = currentUser?.role === 'company_admin';
  // Location managers are restricted to their own location/store.
  const isLocationManager = currentUser?.role === 'location_manager';
  const lockedLocationId = isLocationManager ? (currentUser?.location_id ?? null) : null;

  const fetchLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const res = await locationService.getLocations({ per_page: 100 });
      if (res.success && Array.isArray(res.data)) {
        setLocations(res.data.map((l) => ({ id: l.id, name: l.name })));
      }
    } catch {
      // Non-fatal; the user can still try a role that doesn't need location_id.
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // Reset everything when the modal opens, fetch locations.
  useEffect(() => {
    if (!isOpen) return;
    // Pre-select the location manager's own location so they can't pick another store.
    setForm({
      ...initialForm,
      location_id: lockedLocationId ?? initialForm.location_id,
    });
    setFieldErrors({});
    setSuccess(null);
    setShowPassword(false);
    setCopied(false);
    setToast(null);
    void fetchLocations();
  }, [isOpen, fetchLocations, lockedLocationId]);

  const update = <K extends keyof CreateStaffAccountData>(key: K, value: CreateStaffAccountData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const requiresLocation = form.role === 'location_manager' || form.role === 'attendant';

  const validateLocally = (): string | null => {
    if (!form.first_name.trim()) return 'First name is required.';
    if (!form.last_name.trim()) return 'Last name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (requiresLocation && !form.location_id) return 'Please select a location for this role.';
    if (form.password_mode === 'custom') {
      if (!form.password || form.password.length < 8) return 'Custom password must be at least 8 characters.';
    }
    return null;
  };

  const handleSubmit = async () => {
    setFieldErrors({});
    const localErr = validateLocally();
    if (localErr) {
      showToast(localErr, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateStaffAccountData = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        role: form.role,
        send_email: form.send_email,
        return_password: form.return_password,
        password_mode: form.password_mode,
      };
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (requiresLocation) payload.location_id = form.location_id ?? undefined;
      if (form.password_mode === 'custom') payload.password = form.password;
      // Frontend default base for the email's "Log in" button.
      payload.login_url = `${window.location.origin}/admin`;

      const res = await userService.createStaff(payload);
      if (!res.success || !res.data) {
        showToast(res.message || 'Failed to create account.', 'error');
        return;
      }
      setSuccess(res.data);
      showToast(
        `Account created for ${res.data.user.first_name} ${res.data.user.last_name}.`,
        'success',
      );
      onCreated?.(res.data);
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
        showToast(data?.message || 'You do not have permission to create staff accounts.', 'error');
      } else {
        showToast(data?.message || 'Something went wrong. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!success?.generated_password) return;
    try {
      await navigator.clipboard.writeText(success.generated_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  if (!isOpen) return null;

  // Hide Company Admin role unless current user is themselves a company_admin.
  const canCreatePeerAdmin = currentUser?.role === 'company_admin';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <UserPlus className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {success ? 'Account created' : 'Create Staff Account'}
              </h3>
              {!success && (
                <p className="text-xs text-gray-500">Credentials will be emailed to the new user.</p>
              )}
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

        {/* SUCCESS VIEW ----------------------------------------------------- */}
        {success ? (
          <div className="px-6 py-4 space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">
                  {success.user.first_name} {success.user.last_name} was created.
                </p>
                {success.email_sent ? (
                  <p className="text-green-700 mt-0.5">
                    Credentials emailed to {success.user.email}.
                  </p>
                ) : (
                  <p className="text-green-700 mt-0.5">Account created (email delivery pending).</p>
                )}
              </div>
            </div>

            {!success.email_sent && success.email_error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Email could not be delivered.</p>
                  <p className="text-amber-700 mt-0.5 break-all">{success.email_error}</p>
                  <p className="text-amber-700 mt-1">
                    Use “Resend credentials” from the user list to retry.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Login email</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {success.user.email}
                </div>
              </div>

              {success.generated_password && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Temporary password</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-900 flex items-center justify-between">
                      <span>{showPassword ? success.generated_password : '••••••••••••'}</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="text-gray-500 hover:text-gray-700 ml-2"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <StandardButton
                      onClick={handleCopyPassword}
                      variant="secondary"
                      size="md"
                      icon={copied ? CheckCircle : Copy}
                      title={copied ? 'Copied' : 'Copy password'}
                    />
                  </div>
                  <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    This password will not be shown again. Share it securely.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <StandardButton onClick={onClose} variant="primary" size="md">
                Done
              </StandardButton>
            </div>
          </div>
        ) : (
          /* FORM VIEW ----------------------------------------------------- */
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => update('first_name', e.target.value)}
                  disabled={submitting}
                  className={`w-full px-3 py-2 border ${fieldErrors.first_name ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
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
                  className={`w-full px-3 py-2 border ${fieldErrors.last_name ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                />
                {fieldErrors.last_name && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.last_name[0]}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  disabled={submitting}
                  className={`w-full pl-9 pr-3 py-2 border ${fieldErrors.email ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                />
              </div>
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => update('phone', e.target.value)}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  update('role', role);
                  // Clear location when switching to a role that doesn't need one.
                  if (role === 'company_admin') update('location_id', null);
                }}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              >
                <option value="attendant">Attendant</option>
                <option value="location_manager">Location Manager</option>
                {canCreatePeerAdmin && <option value="company_admin">Company Admin</option>}
              </select>
            </div>

            {requiresLocation && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Location *</label>
                  {canCreateLocation && (
                    <button
                      type="button"
                      onClick={() => setShowCreateLocation(true)}
                      disabled={submitting}
                      className={`inline-flex items-center gap-1 text-xs font-medium text-${themeColor}-600 hover:text-${themeColor}-700 disabled:opacity-50`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New location
                    </button>
                  )}
                </div>
                <select
                  value={form.location_id ?? ''}
                  onChange={(e) =>
                    update('location_id', e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={submitting || loadingLocations || isLocationManager}
                  className={`w-full px-3 py-2 border ${fieldErrors.location_id ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                >
                  <option value="">
                    {loadingLocations ? 'Loading locations...' : 'Select a location'}
                  </option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {isLocationManager && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can only create accounts for your assigned location.
                  </p>
                )}
                {fieldErrors.location_id && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.location_id[0]}</p>
                )}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="password_mode"
                    checked={form.password_mode === 'generate'}
                    onChange={() => update('password_mode', 'generate')}
                    disabled={submitting}
                    className={`text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Generate a strong password (recommended)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="password_mode"
                    checked={form.password_mode === 'custom'}
                    onChange={() => update('password_mode', 'custom')}
                    disabled={submitting}
                    className={`text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Set a custom password
                </label>
                {form.password_mode === 'custom' && (
                  <input
                    type="text"
                    value={form.password || ''}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Min 8 characters"
                    disabled={submitting}
                    className={`w-full px-3 py-2 border ${fieldErrors.password ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 mt-2`}
                  />
                )}
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password[0]}</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.send_email}
                  onChange={(e) => update('send_email', e.target.checked)}
                  disabled={submitting}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Email credentials to the new user
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.return_password}
                  onChange={(e) => update('return_password', e.target.checked)}
                  disabled={submitting}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Show me the password after creation
              </label>
            </div>

            <div className="flex gap-3 pt-2">
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
                disabled={submitting || loadingLocations || Boolean(requiresLocation && !form.location_id)}
                variant="primary"
                size="md"
                icon={submitting ? RefreshCw : UserPlus}
                loading={submitting}
                fullWidth
              >
                {submitting ? 'Creating...' : 'Create account'}
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Nested CreateLocation modal (company_admin only). After creating a
          new location we refetch the list and auto-select the new one. */}
      {canCreateLocation && (
        <CreateLocationModal
          isOpen={showCreateLocation}
          onClose={() => setShowCreateLocation(false)}
          elevated
          onCreated={async (loc) => {
            await fetchLocations();
            update('location_id', loc.id);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default CreateStaffAccountModal;
