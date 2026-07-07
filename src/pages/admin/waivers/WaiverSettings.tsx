import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import type { WaiverSettings as WaiverSettingsType } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_SETTINGS_STEPS } from '../../../components/waiver/tour/tourSteps';

const WaiverSettings = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [settings, setSettings] = useState<WaiverSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    waiverService.getSettings()
      .then((r) => { if (r.success) setSettings(r.data); })
      .catch(() => setToast({ message: 'Failed to load settings', type: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof WaiverSettingsType>(key: K, value: WaiverSettingsType[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await waiverService.updateSettings(settings);
      if (res.success) {
        setSettings(res.data);
        setToast({ message: 'Settings saved', type: 'success' });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setToast({ message: e.response?.data?.message || 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="min-h-screen flex items-center justify-center"><div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`} /></div>;
  }

  const card = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`;

  const toggle = (key: keyof WaiverSettingsType, label: string, hint?: string) => (
    <label className="flex items-start gap-2.5 cursor-pointer py-1">
      <input type="checkbox" checked={!!settings[key]} onChange={(e) => set(key, e.target.checked as WaiverSettingsType[typeof key])} className={`mt-0.5 h-4 w-4 text-${fullColor} rounded border-gray-300`} />
      <span className="text-sm text-gray-700">{label}{hint && <span className="block text-[11px] text-gray-400">{hint}</span>}</span>
    </label>
  );

  const num = (key: keyof WaiverSettingsType, label: string, hint?: string, min = 0, max?: number) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="number" min={min} max={max} value={(settings[key] as number | null) ?? ''} onChange={(e) => set(key, (e.target.value === '' ? null : Number(e.target.value)) as WaiverSettingsType[typeof key])} className={fieldCls} />
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto">
      <WaiverPageTour steps={WAIVER_SETTINGS_STEPS} storageKey="tour_waiver_settings" />
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div data-tour="settings-heading">
            <h1 className="text-2xl font-bold text-gray-900">Waiver Settings</h1>
            <p className="text-gray-500 text-sm mt-0.5">Company-wide defaults for waivers.</p>
          </div>
        </div>
        <span data-tour="settings-save-btn"><StandardButton variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</StandardButton></span>
      </div>

      <div data-tour="settings-cards" className="space-y-5">
        <div data-tour="settings-validity-card" className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Validity & Duplicates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {num('default_validity_days', 'Default validity (days)', 'Blank = no expiry', 1)}
            {num('default_expiration_days', 'Default expiration (days)', undefined, 1)}
            <div>
              <label className={labelCls}>Default duplicate rule</label>
              <select value={settings.default_duplicate_rule} onChange={(e) => set('default_duplicate_rule', e.target.value as WaiverSettingsType['default_duplicate_rule'])} className={fieldCls}>
                <option value="none">Block duplicates</option>
                <option value="manager_only">Manager-assigned only</option>
                <option value="allow">Allow duplicates</option>
              </select>
            </div>
          </div>
          <div className="mt-2">
            {toggle('waivers_expire', 'Waivers expire after the validity period')}
            {toggle('require_new_on_text_change', 'Require a new waiver when the legal text changes')}
          </div>
        </div>

        <div data-tour="settings-reminders-card" className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Reminders & Confirmations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {num('reminder_window_hours', 'Reminder window (hours)', 'Send a reminder this long before the visit', 1, 168)}
          </div>
          <div className="mt-2">
            {toggle('always_include_link_in_confirmation', 'Always include the waiver link in confirmation email/SMS')}
          </div>
        </div>

        <div data-tour="settings-kiosk-card" className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Search & Kiosk</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {num('search_auto_refresh_seconds', 'Search auto-refresh (s)', '0 disables auto-refresh', 0, 600)}
            {num('kiosk_inactivity_timeout_seconds', 'Kiosk inactivity reset (s)', undefined, 10, 600)}
          </div>
          <div className="mt-2">
            {toggle('kiosk_disable_autofill', 'Disable autofill in kiosk mode', 'Recommended for shared iPads')}
          </div>
        </div>

        <div data-tour="settings-permissions-card" className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Permissions</h2>
          {toggle('admin_delete_enabled', 'Allow admins to delete waivers')}
          {toggle('manager_print_export_enabled', 'Allow managers to print & export')}
          {toggle('manager_can_build_templates', 'Allow managers to build templates')}
          {toggle('manager_can_view_deletion_log', 'Allow managers to view the deletion log')}
        </div>

        <div data-tour="settings-marketing-card" className={card}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">Marketing & CRM</h2>
          {toggle('marketing_consent_enabled', 'Enable marketing consent on waivers')}
          {toggle('crm_sync_only_when_consented', 'Only sync to CRM when the guest opts in')}
          {toggle('minor_marketing_disabled', "Never use minors' data for marketing")}
        </div>

        <div className="flex justify-end pb-8">
          <StandardButton variant="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</StandardButton>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default WaiverSettings;
