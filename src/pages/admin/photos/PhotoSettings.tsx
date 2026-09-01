import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCcw,
  RotateCcw,
  Save,
  Send,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import EmailInput from '../../../components/ui/EmailInput';
import type { PhotoChannel, PhotoMessageTemplateRecord, PhotoSettingsResponse } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const POSITION_LABELS: Record<string, string> = {
  top_left: 'Top left',
  top_right: 'Top right',
  bottom_left: 'Bottom left',
  bottom_right: 'Bottom right',
};

const BACKGROUND_LABELS: Record<string, string> = {
  none: 'Plain text',
  solid: 'Dark panel behind the date',
  shadow: 'Drop shadow behind the date',
};

const KIND_LABELS: Record<string, string> = {
  immediate: 'Immediate waiver delivery',
  next_day: '9:00 AM next-day delivery',
  kiosk: 'Kiosk delivery',
};

const ChannelTest = ({
  channel,
  locationId,
  label,
  placeholder,
  inputType,
}: {
  channel: PhotoChannel;
  locationId: number | null;
  label: string;
  placeholder: string;
  inputType: 'email' | 'tel';
}) => {
  const [destination, setDestination] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const send = async () => {
    if (sending || !locationId || destination.trim() === '') return;
    setSending(true);
    setResult(null);
    try {
      setResult(await photoService.sendTestMessage(locationId, channel, destination.trim()));
    } finally {
      setSending(false);
    }
  };

  const inputId = `photo-channel-test-${channel}`;

  return (
    <div className="mt-3 border-t border-white/60 pt-3">
      <label htmlFor={inputId} className="block text-xs font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        {inputType === 'email' ? (
          <EmailInput
            id={inputId}
            value={destination}
            placeholder={placeholder}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            wrapperClassName="flex-1 min-w-0"
            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        ) : (
          <input
            id={inputId}
            type={inputType}
            value={destination}
            placeholder={placeholder}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        )}
        <button
          type="button"
          onClick={send}
          disabled={sending || destination.trim() === '' || !locationId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-sm ${result.success ? 'text-green-800' : 'text-red-700'}`} aria-live="polite">
          {result.message}
        </p>
      )}
    </div>
  );
};

const PhotoSettings = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [data, setData] = useState<PhotoSettingsResponse | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [templates, setTemplates] = useState<PhotoMessageTemplateRecord[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [openTemplate, setOpenTemplate] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState<Record<number, PhotoMessageTemplateRecord>>({});

  const load = useCallback(async () => {
    if (!effectiveLocationId) return;
    setLoading(true);
    try {
      const [settings, templateData] = await Promise.all([
        photoService.getSettings(effectiveLocationId),
        photoService.getTemplates(),
      ]);
      setData(settings);
      setForm({
        kiosk_enabled: settings.setting.kiosk_enabled,
        slideshow_enabled: settings.setting.slideshow_enabled,
        kiosk_countdown_seconds: settings.setting.kiosk_countdown_seconds,
        slideshow_duration_seconds: settings.setting.slideshow_duration_seconds,
        retention_days: settings.setting.retention_days,
        date_format: settings.setting.date_format,
        date_position: settings.setting.date_position,
        date_font_size: settings.setting.date_font_size,
        date_margin: settings.setting.date_margin,
        date_background: settings.setting.date_background,
        failure_notify_email: settings.setting.failure_notify_email ?? '',
      });
      setTemplates(templateData.templates);
      setVariables(templateData.variables);
      setTemplateDraft(
        Object.fromEntries(templateData.templates.map((t) => [t.id, t])) as Record<number, PhotoMessageTemplateRecord>,
      );
    } catch (e) {
      setToast({ message: errorMessage(e, 'Could not load photo settings.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!effectiveLocationId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, location_id: effectiveLocationId };
      if (payload.failure_notify_email === '') payload.failure_notify_email = null;
      await photoService.updateSettings(payload);
      setToast({ message: 'Photo settings saved.', type: 'success' });
      await load();
    } catch (e) {
      setToast({ message: errorMessage(e, 'Those settings could not be saved.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [effectiveLocationId, form, load]);

  const rotate = useCallback(
    async (mode: 'kiosk' | 'slideshow') => {
      if (!effectiveLocationId) return;
      setSaving(true);
      try {
        await photoService.rotatePasscode(effectiveLocationId, mode);
        setToast({
          message: `New ${mode} passcode issued. Devices will need it again once their session expires.`,
          type: 'success',
        });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That passcode could not be changed.'), type: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [effectiveLocationId, load],
  );

  const copy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ message: `${label} copied.`, type: 'success' });
    } catch {
      setToast({ message: 'Copying is blocked in this browser — select the text instead.', type: 'info' });
    }
  }, []);

  const saveTemplate = useCallback(
    async (templateId: number) => {
      const draft = templateDraft[templateId];
      if (!draft) return;
      setSaving(true);
      try {
        await photoService.updateTemplate(templateId, {
          email_subject: draft.email_subject,
          email_body: draft.email_body,
          sms_body: draft.sms_body,
        });
        setToast({ message: 'Template saved.', type: 'success' });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That template could not be saved.'), type: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [load, templateDraft],
  );

  const resetTemplate = useCallback(
    async (templateId: number) => {
      setSaving(true);
      try {
        await photoService.resetTemplate(templateId);
        setToast({ message: 'Template restored to the default wording.', type: 'info' });
        await load();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That template could not be reset.'), type: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin
              ? 'Kiosk and slideshow passcodes, overlays and retention are all per location.'
              : 'Your account is not assigned to a location yet.'}
          </p>
        </div>
      </div>
    );
  }

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SettingsIcon className={`w-6 h-6 text-${themeColor}-700`} />
              Photo settings
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {data?.location.name}
              {data && ` · times are ${data.location.timezone}`}
            </p>
          </div>
          <div className="flex gap-2">
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void load()} loading={loading}>
              Refresh
            </StandardButton>
            <StandardButton size="sm" icon={Save} onClick={() => void save()} loading={saving}>
              Save settings
            </StandardButton>
          </div>
        </div>

        {data && (
          <div className="space-y-6">
            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Delivery channels</h2>
              <p className="text-sm text-gray-600 mb-4">
                Whether this site can actually send a photo link right now. Waivers that only carry an unavailable
                channel are shown as not contactable, so staff are pointed at the direct QR code instead.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className={`rounded-xl border p-4 ${
                    data.channels.email_available ? 'border-green-200 bg-green-50/60' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="flex items-center gap-2 font-medium text-gray-900">
                    <Mail className="w-4 h-4" />
                    Email
                    <span
                      className={`ml-auto text-xs rounded-full px-2 py-0.5 ${
                        data.channels.email_available ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {data.channels.email_available ? 'sending' : 'not sending'}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-gray-700">
                    Transport: <code className="text-xs bg-white/70 rounded px-1.5 py-0.5">{data.channels.email_transport}</code>
                  </p>
                  {data.channels.email_note && <p className="mt-2 text-sm text-amber-900">{data.channels.email_note}</p>}
                  <ChannelTest
                    channel="email"
                    locationId={effectiveLocationId}
                    label="Send a test email to"
                    placeholder="you@example.com"
                    inputType="email"
                  />
                </div>

                <div
                  className={`rounded-xl border p-4 ${
                    data.channels.sms_available ? 'border-green-200 bg-green-50/60' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="flex items-center gap-2 font-medium text-gray-900">
                    <MessageSquare className="w-4 h-4" />
                    SMS
                    <span
                      className={`ml-auto text-xs rounded-full px-2 py-0.5 ${
                        data.channels.sms_available ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {data.channels.sms_available ? 'sending' : 'not sending'}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-gray-700">Provider: Twilio</p>
                  {data.channels.sms_note && <p className="mt-2 text-sm text-amber-900">{data.channels.sms_note}</p>}
                  <ChannelTest
                    channel="sms"
                    locationId={effectiveLocationId}
                    label="Send a test text to"
                    placeholder="(810) 555-0134"
                    inputType="tel"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="flex items-center gap-2 font-medium text-gray-900">
                  <LinkIcon className="w-4 h-4" />
                  Photo link address
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Every message links here:{' '}
                  <code className="text-xs bg-white rounded px-1.5 py-0.5">{data.channels.photo_link_base || 'not set'}</code>
                </p>
                {data.channels.photo_link_note ? (
                  <p className="mt-2 text-sm text-amber-900">{data.channels.photo_link_note}</p>
                ) : (
                  <p className="mt-2 text-sm text-gray-600">
                    This is the address visitors reach, so the links you send will open for them.
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Kiosk behaviour</h2>
              <p className="text-sm text-gray-600 mb-4">
                How long the visitor gets between pressing Capture and the shutter firing.
              </p>

              <div className="max-w-xs">
                <label htmlFor="ps-countdown" className="block text-sm text-gray-700 mb-1">
                  Capture countdown
                </label>
                <select
                  id="ps-countdown"
                  value={Number(form.kiosk_countdown_seconds ?? 10)}
                  onChange={(e) => setForm((prev) => ({ ...prev, kiosk_countdown_seconds: Number(e.target.value) }))}
                  className={fieldCls}
                >
                  {data.options.countdown_options.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds === 0 ? 'No countdown — capture straight away' : `${seconds} seconds`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {Number(form.kiosk_countdown_seconds ?? 10) === 0
                    ? 'The photo is taken the moment the visitor presses Capture.'
                    : 'The inactivity timer pauses while the countdown is running.'}
                </p>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Device URLs and passcodes</h2>
              <p className="text-sm text-gray-600 mb-4">
                Kiosk and slideshow are device functions, not accounts. A device with the URL and passcode can do only
                that one job and never reaches customers, waivers, reports or settings.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(['kiosk', 'slideshow'] as const).map((mode) => {
                  const url = mode === 'kiosk' ? data.setting.kiosk_url : data.setting.slideshow_url;
                  const code = mode === 'kiosk' ? data.setting.kiosk_passcode : data.setting.slideshow_passcode;
                  const enabledKey = mode === 'kiosk' ? 'kiosk_enabled' : 'slideshow_enabled';

                  return (
                    <div key={mode} className="rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-gray-900 capitalize">{mode} mode</p>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(form[enabledKey])}
                            onChange={(e) => setForm((prev) => ({ ...prev, [enabledKey]: e.target.checked }))}
                            className={`h-4 w-4 accent-${themeColor}-700`}
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs">
                            {url}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copy(url, `${mode} URL`)}
                            aria-label={`Copy ${mode} URL`}
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Lock className="w-3.5 h-3.5" />
                            Passcode
                          </span>
                          <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 tracking-[0.2em]">
                            {code}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copy(code, 'Passcode')}
                            aria-label="Copy passcode"
                            className="p-1.5 rounded hover:bg-gray-100"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void rotate(mode)}
                        disabled={saving}
                        className="mt-3 text-sm text-gray-600 underline disabled:opacity-40"
                      >
                        Issue a new passcode
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Capture date on the photo</h2>
              <p className="text-sm text-gray-600 mb-4">
                The date is a separate layer drawn above the uploaded overlay. It shows the capture date only — never a
                time, and never the delivery date.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ps-format" className="block text-sm text-gray-700 mb-1">
                    Date format
                  </label>
                  <select
                    id="ps-format"
                    value={String(form.date_format ?? '')}
                    onChange={(e) => setForm((prev) => ({ ...prev, date_format: e.target.value }))}
                    className={fieldCls}
                  >
                    {data.options.date_formats.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.preview}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ps-position" className="block text-sm text-gray-700 mb-1">
                    Position
                  </label>
                  <select
                    id="ps-position"
                    value={String(form.date_position ?? '')}
                    onChange={(e) => setForm((prev) => ({ ...prev, date_position: e.target.value }))}
                    className={fieldCls}
                  >
                    {data.options.date_positions.map((position) => (
                      <option key={position} value={position}>
                        {POSITION_LABELS[position] ?? position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ps-size" className="block text-sm text-gray-700 mb-1">
                    Text size
                  </label>
                  <input
                    id="ps-size"
                    type="number"
                    min={16}
                    max={80}
                    value={Number(form.date_font_size ?? 34)}
                    onChange={(e) => setForm((prev) => ({ ...prev, date_font_size: Number(e.target.value) }))}
                    className={fieldCls}
                  />
                </div>

                <div>
                  <label htmlFor="ps-margin" className="block text-sm text-gray-700 mb-1">
                    Margin from the edge
                  </label>
                  <input
                    id="ps-margin"
                    type="number"
                    min={8}
                    max={120}
                    value={Number(form.date_margin ?? 28)}
                    onChange={(e) => setForm((prev) => ({ ...prev, date_margin: Number(e.target.value) }))}
                    className={fieldCls}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="ps-bg" className="block text-sm text-gray-700 mb-1">
                    Readability
                  </label>
                  <select
                    id="ps-bg"
                    value={String(form.date_background ?? '')}
                    onChange={(e) => setForm((prev) => ({ ...prev, date_background: e.target.value }))}
                    className={fieldCls}
                  >
                    {data.options.date_backgrounds.map((background) => (
                      <option key={background} value={background}>
                        {BACKGROUND_LABELS[background] ?? background}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Slideshow, retention and alerts</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ps-duration" className="block text-sm text-gray-700 mb-1">
                    Seconds per slide
                  </label>
                  <select
                    id="ps-duration"
                    value={Number(form.slideshow_duration_seconds ?? 8)}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, slideshow_duration_seconds: Number(e.target.value) }))
                    }
                    className={fieldCls}
                  >
                    {data.options.slideshow_durations.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds} seconds
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ps-retention" className="block text-sm text-gray-700 mb-1">
                    Backend retention (days)
                  </label>
                  <input
                    id="ps-retention"
                    type="number"
                    min={1}
                    max={730}
                    value={Number(form.retention_days ?? 90)}
                    onChange={(e) => setForm((prev) => ({ ...prev, retention_days: Number(e.target.value) }))}
                    className={fieldCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Photos are removed from the photo library after this many days.</p>
                </div>

                <div>
                  <label htmlFor="ps-alert" className="block text-sm text-gray-700 mb-1">
                    Failure alert email
                  </label>
                  <EmailInput
                    id="ps-alert"
                    value={String(form.failure_notify_email ?? '')}
                    onChange={(e) => setForm((prev) => ({ ...prev, failure_notify_email: e.target.value }))}
                    placeholder="manager@example.com"
                    className={fieldCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Delivery failures, kiosk errors, offline displays and overlay conflicts.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Message templates</h2>
              <p className="text-sm text-gray-600 mb-4">
                Separate email and SMS wording for each delivery kind. Available variables:{' '}
                {variables.map((v) => `{{${v}}}`).join(', ')}
              </p>

              <div className="space-y-3">
                {templates.map((template) => {
                  const draft = templateDraft[template.id] ?? template;
                  const open = openTemplate === template.id;

                  return (
                    <div key={template.id} className="rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => setOpenTemplate(open ? null : template.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <span className="font-medium text-gray-900">{KIND_LABELS[template.kind] ?? template.kind}</span>
                        <span className="text-sm text-gray-500">{open ? 'Close' : 'Edit'}</span>
                      </button>

                      {open && (
                        <div className="px-4 pb-4 space-y-3">
                          <div>
                            <label htmlFor={`tpl-subject-${template.id}`} className="block text-sm text-gray-700 mb-1">
                              Email subject
                            </label>
                            <input
                              id={`tpl-subject-${template.id}`}
                              value={draft.email_subject}
                              onChange={(e) =>
                                setTemplateDraft((prev) => ({
                                  ...prev,
                                  [template.id]: { ...draft, email_subject: e.target.value },
                                }))
                              }
                              className={fieldCls}
                            />
                          </div>

                          <div>
                            <label htmlFor={`tpl-body-${template.id}`} className="block text-sm text-gray-700 mb-1">
                              Email body
                            </label>
                            <textarea
                              id={`tpl-body-${template.id}`}
                              rows={6}
                              value={draft.email_body}
                              onChange={(e) =>
                                setTemplateDraft((prev) => ({
                                  ...prev,
                                  [template.id]: { ...draft, email_body: e.target.value },
                                }))
                              }
                              className={`${fieldCls} font-mono text-xs`}
                            />
                          </div>

                          <div>
                            <label htmlFor={`tpl-sms-${template.id}`} className="block text-sm text-gray-700 mb-1">
                              SMS body
                            </label>
                            <textarea
                              id={`tpl-sms-${template.id}`}
                              rows={3}
                              value={draft.sms_body}
                              onChange={(e) =>
                                setTemplateDraft((prev) => ({
                                  ...prev,
                                  [template.id]: { ...draft, sms_body: e.target.value },
                                }))
                              }
                              className={fieldCls}
                            />
                            <p className="mt-1 text-xs text-gray-500">{draft.sms_body.length} characters</p>
                          </div>

                          <div className="flex gap-2">
                            <StandardButton size="sm" icon={Save} onClick={() => void saveTemplate(template.id)} loading={saving}>
                              Save template
                            </StandardButton>
                            <StandardButton
                              size="sm"
                              variant="secondary"
                              icon={RotateCcw}
                              onClick={() => void resetTemplate(template.id)}
                            >
                              Restore default
                            </StandardButton>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Fixed rules</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {[
                  ['Staff session size', `up to ${data.locked.staff_max_photos} photos`],
                  ['Kiosk session size', `${data.locked.kiosk_max_photos} photo`],
                  ['Kiosk inactivity reset', `${data.locked.kiosk_idle_seconds} seconds on every page`],
                  ['QR validity', `${data.locked.qr_valid_hours} hours`],
                  ['Customer photo page', `${data.locked.access_valid_days} days`],
                  ['Operating day starts', `${data.locked.operating_day_cutoff_hour}:00 AM location time`],
                  ['Scheduled delivery', `${data.locked.next_day_delivery_hour}:00 AM the next day`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-gray-200/60 py-1">
                    <dt className="text-gray-600">{label}</dt>
                    <dd className="text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoSettings;
