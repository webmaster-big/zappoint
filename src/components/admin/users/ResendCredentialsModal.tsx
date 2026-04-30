import { useEffect, useState } from 'react';
import {
  X,
  Copy,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { userService } from '../../../services/UserService';
import type { ResendCredentialsData, StaffAccountResult } from '../../../services/UserService';

interface ResendCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: number; first_name?: string; last_name?: string; email: string } | null;
}

/**
 * Resend / rotate staff credentials.
 *
 * Implements POST /api/users/{user}/resend-credentials (Section 5).
 * The new password REPLACES the old one whether the email succeeds or
 * not, so we always show a confirm step before submitting.
 */
const ResendCredentialsModal = ({ isOpen, onClose, user }: ResendCredentialsModalProps) => {
  const { themeColor } = useThemeColor();

  const [mode, setMode] = useState<'generate' | 'custom'>('generate');
  const [customPassword, setCustomPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [returnPassword, setReturnPassword] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StaffAccountResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('generate');
    setCustomPassword('');
    setSendEmail(true);
    setReturnPassword(true);
    setConfirmed(false);
    setSubmitting(false);
    setError(null);
    setResult(null);
    setShowPassword(false);
    setCopied(false);
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'custom' && customPassword.length < 8) {
      setError('Custom password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ResendCredentialsData = {
        password_mode: mode,
        send_email: sendEmail,
        return_password: returnPassword,
        login_url: `${window.location.origin}/admin`,
      };
      if (mode === 'custom') payload.password = customPassword;

      const res = await userService.resendCredentials(user.id, payload);
      if (!res.success || !res.data) {
        setError(res.message || 'Failed to reset credentials.');
        return;
      }
      setResult(res.data as StaffAccountResult);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      const status = e.response?.status;
      const apiMsg = e.response?.data?.message;
      if (status === 403) {
        setError(apiMsg || 'You do not have permission to reset this user\u2019s credentials.');
      } else {
        setError(apiMsg || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!result?.generated_password) return;
    try {
      await navigator.clipboard.writeText(result.generated_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <KeyRound className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {result ? 'Credentials reset' : 'Resend credentials'}
              </h3>
              <p className="text-xs text-gray-500 truncate max-w-[220px]">{fullName}</p>
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

        {result ? (
          <div className="px-6 py-4 space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Password rotated successfully.</p>
                {result.email_sent ? (
                  <p className="text-green-700 mt-0.5">New credentials emailed to {user.email}.</p>
                ) : (
                  <p className="text-green-700 mt-0.5">
                    Email could not be delivered — share the password manually.
                  </p>
                )}
              </div>
            </div>

            {!result.email_sent && result.email_error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 break-all">{result.email_error}</p>
              </div>
            )}

            {result.generated_password && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New password</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm flex items-center justify-between">
                    <span>{showPassword ? result.generated_password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}</span>
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
                  This password will not be shown again.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <StandardButton onClick={onClose} variant="primary" size="md">
                Done
              </StandardButton>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                This will <strong>replace</strong> {fullName}’s current password. Their existing
                login will stop working immediately.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="resend_mode"
                    checked={mode === 'generate'}
                    onChange={() => setMode('generate')}
                    disabled={submitting}
                    className={`text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Generate a strong password
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="resend_mode"
                    checked={mode === 'custom'}
                    onChange={() => setMode('custom')}
                    disabled={submitting}
                    className={`text-${themeColor}-600 focus:ring-${themeColor}-500`}
                  />
                  Set a custom password
                </label>
                {mode === 'custom' && (
                  <input
                    type="text"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    disabled={submitting}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 disabled:bg-gray-100 mt-2`}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={submitting}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Email new credentials to the user
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnPassword}
                  onChange={(e) => setReturnPassword(e.target.checked)}
                  disabled={submitting}
                  className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                />
                Show me the password after reset
              </label>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer pt-2 border-t border-gray-200">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={submitting}
                className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500 mt-0.5`}
              />
              <span>I understand this will replace the user’s password.</span>
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
                disabled={submitting || !confirmed}
                variant="primary"
                size="md"
                icon={submitting ? RefreshCw : KeyRound}
                loading={submitting}
                fullWidth
              >
                {submitting ? 'Resetting...' : 'Reset & email'}
              </StandardButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResendCredentialsModal;
