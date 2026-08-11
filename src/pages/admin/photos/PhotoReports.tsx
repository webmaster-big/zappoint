import { useCallback, useEffect, useState } from 'react';
import { BarChart3, RefreshCcw } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import photoService from '../../../services/PhotoService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import type { PhotoAuditEntry, PhotoOverlayConflict } from '../../../types/photo.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const REPORTS: Array<{ value: string; label: string }> = [
  { value: 'activity', label: 'Photo activity' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'qr', label: 'QR codes' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'slideshow', label: 'Slideshow' },
  { value: 'library', label: 'Daily library' },
  { value: 'overlay', label: 'Overlays' },
  { value: 'audit', label: 'Audit log' },
];

const HIDDEN_KEYS = ['type', 'from', 'to', 'business_timezone'];

const titleize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

type ReportPayload = Record<string, unknown>;

const PhotoReports = () => {
  const { themeColor } = useThemeColor();
  const { effectiveLocationId } = useLocationScope();

  const [type, setType] = useState('activity');
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [result, setResult] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { from, to };
      if (effectiveLocationId) params.location_id = effectiveLocationId;
      setResult(await photoService.getReport(type, params));
    } catch (e) {
      setToast({ message: errorMessage(e, 'That report could not be run.'), type: 'error' });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveLocationId, from, to, type]);

  useEffect(() => {
    void run();
  }, [run]);

  const fieldCls = `border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  const numericEntries = Object.entries(result ?? {}).filter(
    ([key, value]) => !HIDDEN_KEYS.includes(key) && (typeof value === 'number' || typeof value === 'string'),
  );

  const auditEntries = (result?.entries as PhotoAuditEntry[] | undefined) ?? [];
  const byDay = (result?.by_day as Array<{ operating_day: string; photos: number; downloads: number }> | undefined) ?? [];
  const conflicts = (result?.conflicts as PhotoOverlayConflict[] | undefined) ?? [];

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className={`w-6 h-6 text-${themeColor}-700`} />
              Photo reports
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Date filters are read in Michigan time
              {result?.business_timezone ? ` (${String(result.business_timezone)})` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className={fieldCls}>
              {REPORTS.map((report) => (
                <option key={report.value} value={report.value}>
                  {report.label}
                </option>
              ))}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldCls} aria-label="From date" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} aria-label="To date" />
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={() => void run()} loading={loading}>
              Run
            </StandardButton>
          </div>
        </div>

        {numericEntries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {numericEntries.map(([key, value]) => (
              <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">{titleize(key)}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {byDay.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Photos by operating day</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Operating day</th>
                    <th className="px-4 py-3">Photos</th>
                    <th className="px-4 py-3">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byDay.map((row) => (
                    <tr key={row.operating_day}>
                      <td className="px-4 py-2 text-gray-900">{row.operating_day}</td>
                      <td className="px-4 py-2 tabular-nums text-gray-700">{row.photos}</td>
                      <td className="px-4 py-2 tabular-nums text-gray-700">{row.downloads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-amber-900 mb-2">Overlay schedule conflicts</h2>
            <ul className="space-y-1 text-sm text-amber-900">
              {conflicts.map((conflict, i) => (
                <li key={`${conflict.overlay_id}-${conflict.conflicts_with_id}-${i}`}>
                  &ldquo;{conflict.overlay_name}&rdquo; overlaps &ldquo;{conflict.conflicts_with_name}&rdquo;
                  {conflict.location_id ? ` (location ${conflict.location_id})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {type === 'audit' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Audit log</h2>
              <p className="text-sm text-gray-600 mt-1">
                Every capture, delivery, download, staff resend, hide and passcode change.
              </p>
            </div>

            {auditEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">Nothing recorded in this range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Who</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Detail</th>
                      <th className="px-4 py-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                          {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{entry.user_name}</td>
                        <td className="px-4 py-2">
                          <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{entry.action}</code>
                        </td>
                        <td className="px-4 py-2 text-gray-700">{entry.description}</td>
                        <td className="px-4 py-2 text-gray-600">{entry.location_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && !result && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-500">
            No data for this report.
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoReports;
