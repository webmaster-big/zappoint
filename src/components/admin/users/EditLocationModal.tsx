import { useEffect, useState } from 'react';
import { X, Building2, Save, CheckCircle } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { locationService } from '../../../services/LocationService';
import type { Location, UpdateLocationData } from '../../../services/LocationService';

interface EditLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  onUpdated?: (location: Location) => void;
}

// Allows digits, spaces, dashes, plus, parens, dots — 7–20 chars total
const PHONE_RE = /^[\d\s\-\+\(\)\.]{7,20}$/;

const EditLocationModal = ({ isOpen, onClose, location, onUpdated }: EditLocationModalProps) => {
  const { themeColor } = useThemeColor();
  const [form, setForm] = useState<UpdateLocationData>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !location) return;
    setForm({
      name: location.name,
      address: location.address ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      zip_code: location.zip_code ?? '',
      phone: location.phone ?? '',
      email: location.email ?? '',
    });
    setError(null);
    setFieldErrors({});
    setSuccess(false);
  }, [isOpen, location]);

  const update = <K extends keyof UpdateLocationData>(key: K, value: UpdateLocationData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const errs: Record<string, string[]> = {};
    if (!form.name?.trim()) {
      errs.name = ['Location name is required.'];
    }
    if (form.phone?.trim() && !PHONE_RE.test(form.phone.trim())) {
      errs.phone = ['Invalid phone format. Example: (555) 123-4567'];
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please correct the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!location) return;
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: UpdateLocationData = {
        name: form.name?.trim(),
        address: form.address?.trim() ?? '',
        city: form.city?.trim() ?? '',
        state: form.state?.trim() ?? '',
        zip_code: form.zip_code?.trim() ?? '',
        phone: form.phone?.trim() ?? '',
        email: form.email?.trim() ?? '',
      };

      const res = await locationService.updateLocation(location.id, payload);
      if (!res.success || !res.data) {
        setError(res.message || 'Failed to update location.');
        return;
      }
      setSuccess(true);
      onUpdated?.(res.data);
      setTimeout(onClose, 1500);
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
        setError(data?.message || 'You do not have permission to edit this location.');
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !location) return null;

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
              <Building2 className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Edit Location</h3>
              <p className="text-xs text-gray-500">{location.name}</p>
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

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 font-medium">Location updated successfully.</p>
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={form.name ?? ''}
              onChange={(e) => update('name', e.target.value)}
              disabled={submitting}
              placeholder="e.g. Brighton | Zap Zone"
              className={`w-full px-3 py-2 border ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address ?? ''}
              onChange={(e) => update('address', e.target.value)}
              disabled={submitting}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={form.city ?? ''}
                onChange={(e) => update('city', e.target.value)}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={form.state ?? ''}
                onChange={(e) => update('state', e.target.value)}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
            </div>
          </div>

          {/* ZIP / Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                value={form.zip_code ?? ''}
                onChange={(e) => update('zip_code', e.target.value)}
                disabled={submitting}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                disabled={submitting}
                placeholder="(555) 123-4567"
                className={`w-full px-3 py-2 border ${fieldErrors.phone ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.phone[0]}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => update('email', e.target.value)}
              disabled={submitting}
              placeholder="contact@location.com"
              className={`w-full px-3 py-2 border ${fieldErrors.email ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
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
              disabled={submitting || success}
              variant="primary"
              size="md"
              icon={submitting ? undefined : Save}
              loading={submitting}
              fullWidth
            >
              {submitting ? 'Saving...' : 'Save changes'}
            </StandardButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditLocationModal;