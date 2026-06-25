import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, RefreshCcw, X, Send, RotateCcw, Power, Pencil, AlertTriangle } from 'lucide-react';
import {
  getSmsNotifications,
  getSmsOptions,
  updateSmsNotification,
  toggleSmsNotification,
  resetSmsNotification,
  sendTestSms,
  seedSmsDefaults,
  smsSegments,
  type SmsNotification,
  type SmsOptions,
} from '../../../services/SmsNotificationService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';

const SEGMENT_LABEL: Record<string, string> = {
  package: 'Parties',
  attraction: 'Attractions',
  event: 'Events',
  all: 'All Segments',
};

const COMMON_FIELDS = [
  '{{company_name}}', '{{customer_first_name}}', '{{customer_name}}', '{{location_name}}', '{{location_phone}}',
  '{{booking_reference}}', '{{booking_date}}', '{{booking_time}}', '{{booking_balance}}', '{{package_name}}',
  '{{attraction_name}}', '{{purchase_reference}}', '{{purchase_date}}', '{{purchase_quantity}}',
  '{{event_name}}', '{{event_reference}}', '{{event_date}}', '{{event_time}}', '{{payment_amount}}', '{{payment_reference}}',
];

const SmsNotifications = () => {
  const { themeColor } = useThemeColor();
  const { toast, showSuccess, showError, clear } = useToast();
  const [items, setItems] = useState<SmsNotification[]>([]);
  const [options, setOptions] = useState<SmsOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SmsNotification | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, opts] = await Promise.all([getSmsNotifications(), getSmsOptions()]);
      setItems(list.data.data);
      setOptions(opts.data);
    } catch (e) {
      showError(e, 'Failed to load SMS notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const triggerLabel = (t: string): string => {
    if (!options) return t;
    for (const group of Object.values(options.trigger_types)) {
      if (group[t]) return group[t];
    }
    return t;
  };

  const grouped = useMemo(() => {
    const groups: Record<string, SmsNotification[]> = {};
    for (const n of items) {
      const key = n.entity_type;
      (groups[key] ||= []).push(n);
    }
    return groups;
  }, [items]);

  const handleToggle = async (n: SmsNotification) => {
    try {
      const res = await toggleSmsNotification(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_active: res.data.is_active } : x)));
    } catch (e) {
      showError(e, 'Failed to toggle');
    }
  };

  const handleSync = async () => {
    try {
      await seedSmsDefaults();
      showSuccess('Default SMS templates synced');
      load();
    } catch (e) {
      showError(e, 'Sync failed');
    }
  };

  return (
    <div className="px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            SMS Notifications
            <InfoTooltip widthClass="w-80" content="Text-message templates that fire automatically alongside the matching email for every booking, attraction and event across its lifecycle. Edit the wording; merge fields like {{customer_first_name}} are filled in when sent." />
          </h1>
          <p className="text-gray-600 mt-1">Automated text messages for parties, attractions, and events</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          <StandardButton variant="secondary" size="md" icon={RefreshCcw} onClick={handleSync}>
            Sync Defaults
          </StandardButton>
        </div>
      </div>

      {options && !options.sms_configured && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">SMS sending is not configured yet.</p>
            <p>Templates can be edited now, but messages will only be delivered once <code>TWILIO_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_FROM_NUMBER</code> are set on the server.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No SMS templates yet.</p>
          <StandardButton variant="primary" size="md" icon={RefreshCcw} onClick={handleSync}>Sync Default Templates</StandardButton>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([segment, list]) => (
            <div key={segment}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{SEGMENT_LABEL[segment] ?? segment}</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
                {list.map((n) => {
                  const body = n.effective_body ?? n.body ?? n.default_body ?? '';
                  const segs = smsSegments(body);
                  return (
                    <div key={n.id} className="flex items-center gap-4 p-4">
                      <div className={`p-2 rounded-lg bg-${themeColor}-100 text-${themeColor}-600 flex-shrink-0`}>
                        <MessageSquare size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{n.name}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{triggerLabel(n.trigger_type)}</span>
                          {n.is_body_customized && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Customized</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{body}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {[...body].length} chars · {segs} SMS segment{segs === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleToggle(n)}
                          title={n.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${n.is_active ? `bg-${themeColor}-100 text-${themeColor}-700 hover:bg-${themeColor}-200` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          <Power className="w-3 h-3" /> {n.is_active ? 'Active' : 'Off'}
                        </button>
                        <StandardButton variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(n)}>Edit</StandardButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && options && (
        <EditModal
          notification={editing}
          smsConfigured={options.sms_configured}
          recipientTypes={options.recipient_types}
          themeColor={themeColor}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
            showSuccess('SMS template saved');
          }}
          onError={(e) => showError(e, 'Save failed')}
          onTestResult={(msg, ok) => (ok ? showSuccess(msg) : showError(null, msg))}
        />
      )}
    </div>
  );
};

interface EditModalProps {
  notification: SmsNotification;
  smsConfigured: boolean;
  recipientTypes: Record<string, string>;
  themeColor: string;
  onClose: () => void;
  onSaved: (n: SmsNotification) => void;
  onError: (e: unknown) => void;
  onTestResult: (msg: string, ok: boolean) => void;
}

function EditModal({ notification, smsConfigured, recipientTypes, themeColor, onClose, onSaved, onError, onTestResult }: EditModalProps) {
  const [body, setBody] = useState(notification.effective_body ?? notification.body ?? notification.default_body ?? '');
  const [recipients, setRecipients] = useState<string[]>(notification.recipient_types ?? []);
  const [active, setActive] = useState(notification.is_active);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  const segs = smsSegments(body);
  const chars = [...body].length;
  const isCustomized = notification.is_default && body !== (notification.default_body ?? '');

  const toggleRecipient = (key: string) => {
    setRecipients((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  const insertField = (field: string) => setBody((b) => `${b}${field}`);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSmsNotification(notification.id, {
        body,
        recipient_types: recipients,
        is_active: active,
      });
      onSaved({ ...res.data, effective_body: res.data.body ?? res.data.default_body ?? body });
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await resetSmsNotification(notification.id);
      setBody(res.data.default_body ?? '');
      onSaved({ ...res.data, effective_body: res.data.default_body ?? '' });
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      const res = await sendTestSms(notification.id, testPhone.trim());
      onTestResult(res.message || (res.success ? 'Test SMS sent' : 'Failed'), res.success);
    } catch {
      onTestResult('Failed to send test SMS', false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{notification.name}</h3>
            <p className="text-xs text-gray-500">{notification.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={segs > 2 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                {chars} chars · {segs} segment{segs === 1 ? '' : 's'}{segs > 1 ? ' (multi-part — costs more)' : ''}
              </span>
              {isCustomized && (
                <button onClick={reset} disabled={saving} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700">
                  <RotateCcw size={11} /> Reset to default
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Insert merge field</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {COMMON_FIELDS.map((f) => (
                <button
                  key={f}
                  onClick={() => insertField(f)}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 font-mono"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(recipientTypes).map(([key, label]) => (
                <label key={key} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${recipients.includes(key) ? `border-${themeColor}-400 bg-${themeColor}-50 text-${themeColor}-700` : 'border-gray-200 text-gray-600'}`}>
                  <input type="checkbox" checked={recipients.includes(key)} onChange={() => toggleRecipient(key)} className="hidden" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className={`rounded text-${themeColor}-600`} />
            Active
          </label>

          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Send a test</label>
            <div className="flex gap-2">
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder={smsConfigured ? '+1 555 010 2030' : 'SMS not configured'}
                disabled={!smsConfigured}
                className={`flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:ring-2 focus:ring-${themeColor}-500 outline-none`}
              />
              <StandardButton variant="secondary" size="md" icon={Send} loading={testing} disabled={!smsConfigured || !testPhone.trim()} onClick={test}>
                Test
              </StandardButton>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <StandardButton variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</StandardButton>
          <StandardButton variant="primary" size="md" loading={saving} onClick={save}>Save</StandardButton>
        </div>
      </div>
    </div>
  );
}

export default SmsNotifications;
