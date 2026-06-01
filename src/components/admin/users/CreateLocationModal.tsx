import { useEffect, useState } from 'react';
import { X, Building2, RefreshCw, CheckCircle } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { locationService } from '../../../services/LocationService';
import type { CreateLocationData, Location } from '../../../services/LocationService';

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (location: Location) => void;
  elevated?: boolean;
}

const initialForm: CreateLocationData = {
  name: '',
  address: '',
  city: '',
  state: 'MI',
  zip_code: '',
  phone: '',
  email: '',
  is_active: true,
};

const CreateLocationModal = ({ isOpen, onClose, onCreated, elevated = false }: CreateLocationModalProps) => {
  const { themeColor } = useThemeColor();
  const [form, setForm] = useState<CreateLocationData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState<Location | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialForm);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
  }, [isOpen]);

  const update = <K extends keyof CreateLocationData>(key: K, value: CreateLocationData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setFieldErrors({});

    if (!form.name.trim()) {
      setError('Location name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateLocationData = { name: form.name.trim() };
      if (form.address?.trim()) payload.address = form.address.trim();
      if (form.city?.trim()) payload.city = form.city.trim();
      if (form.state?.trim()) payload.state = form.state.trim();
      if (form.zip_code?.trim()) payload.zip_code = form.zip_code.trim();
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (form.email?.trim()) payload.email = form.email.trim();
      payload.is_active = form.is_active ?? true;

      const res = await locationService.createLocation(payload);
      if (!res.success || !res.data) {
        setError(res.message || 'Failed to create location.');
        return;
      }
      setSuccess(res.data);
      onCreated?.(res.data);
    } catch (err: unknown) {
      const e = err as {
        response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
      };
      const status = e.response?.status;
      const data = e.response?.data;
      if (status === 422 && data?.errors) {
        setFieldErrors(data.errors);
        setError(data.message || 'Please correct the highlighted fields.');
      } else if (status === 403) {
        setError(data?.message || 'You do not have permission to create locations.');
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center ${elevated ? 'z-[60]' : 'z-50'} p-4 animate-backdrop-fade`}
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <Building2 className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {success ? 'Location created' : 'Create Location'}
              </h3>
              {!success && (
                <p className="text-xs text-gray-500">Add a new location for staff assignment.</p>
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

        {success ? (
          <div className="px-6 py-4 space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">{success.name} was added.</p>
                <p className="text-green-700 mt-0.5">
                  You can now create staff accounts assigned to this location.
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <StandardButton onClick={onClose} variant="primary" size="md">
                Done
              </StandardButton>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                disabled={submitting}
                placeholder="e.g. Brighton"
                className={`w-full px-3 py-2 border ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => update('address', e.target.value)}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={form.city || ''}
                  onChange={(e) => update('city', e.target.value)}
                  disabled={submitting}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={form.state || ''}
                  onChange={(e) => update('state', e.target.value)}
                  disabled={submitting}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP code</label>
                <input
                  type="text"
                  value={form.zip_code || ''}
                  onChange={(e) => update('zip_code', e.target.value)}
                  disabled={submitting}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
                />
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => update('email', e.target.value)}
                disabled={submitting}
                placeholder="contact@location.com"
                className={`w-full px-3 py-2 border ${fieldErrors.email ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
              {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-2 border-t border-gray-200">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => update('is_active', e.target.checked)}
                disabled={submitting}
                className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
              />
              Active
            </label>

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
                disabled={submitting}
                variant="primary"
                size="md"
                icon={submitting ? RefreshCw : Building2}
                loading={submitting}
                fullWidth
              >
                {submitting ? 'Creating...' : 'Create location'}
              </StandardButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateLocationModal;
