import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, RefreshCcw } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_REPORTS_STEPS } from '../../../components/waiver/tour/tourSteps';

const REPORT_TYPES: Array<{ value: string; label: string; dated: boolean }> = [
  { value: 'completed-by-date', label: 'Completed by date', dated: true },
  { value: 'missing', label: 'Missing (incomplete)', dated: true },
  { value: 'bulk-completion', label: 'Group invite completion', dated: false },
  { value: 'by-event', label: 'By event', dated: true },
  { value: 'by-template', label: 'By template', dated: true },
  { value: 'by-source', label: 'By source', dated: true },
  { value: 'marketing-consent', label: 'Marketing consent', dated: true },
  { value: 'deleted', label: 'Deleted waivers', dated: false },
];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const WaiverReports = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [type, setType] = useState('completed-by-date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const current = REPORT_TYPES.find((r) => r.value === type)!;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (current.dated && startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await waiverService.report(type, params);
      setResult(res?.data ?? null);
    } catch {
      setToast({ message: 'Failed to run report', type: 'error' });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [type, startDate, endDate, current.dated]);

  useEffect(() => {
    run();
  }, [run]);

  const fieldCls = `border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`;

  return (
    <div className="min-h-screen px-6 py-8">
      <WaiverPageTour steps={WAIVER_REPORTS_STEPS} storageKey="tour_waiver_reports" />
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div data-tour="reports-heading">
          <h1 className="text-3xl font-bold text-gray-900">Waiver Reports</h1>
          <p className="text-gray-600 mt-1">Completion, sources, marketing consent, group invites, and deletions.</p>
        </div>
      </div>

      <div data-tour="reports-controls" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Report</label>
          <select value={type} onChange={(e) => { setType(e.target.value); setResult(null); }} className={fieldCls}>
            {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {current.dated && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} />
            </div>
            <StandardButton variant="secondary" size="sm" onClick={() => { setStartDate(todayStr()); setEndDate(todayStr()); }}>Today</StandardButton>
          </>
        )}
        <StandardButton variant="primary" size="sm" icon={RefreshCcw} onClick={run}>Run</StandardButton>
      </div>

      <div data-tour="reports-results" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor} mx-auto my-8`} />
        ) : (
          <ReportResult type={type} data={result} fullColor={fullColor} />
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const StatCards = ({ obj, fullColor }: { obj: Record<string, number>; fullColor: string }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
    {Object.entries(obj).map(([k, v]) => (
      <div key={k} className="border border-gray-100 rounded-lg p-4 text-center">
        <p className={`text-2xl font-bold text-${fullColor}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{typeof v === 'number' ? v : String(v)}</p>
        <p className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">{titleize(k)}</p>
      </div>
    ))}
  </div>
);

const SimpleTable = ({ rows, fullColor }: { rows: Array<Record<string, unknown>>; fullColor: string }) => {
  if (rows.length === 0) return <EmptyState fullColor={fullColor} />;
  const cols = Object.keys(rows[0]).filter((c) => c !== 'snapshot');
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{titleize(c)}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {cols.map((c) => <td key={c} className="px-3 py-2 text-sm text-gray-700">{row[c] == null ? '—' : String(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const EmptyState = ({ fullColor }: { fullColor: string }) => (
  <div className="text-center py-10">
    <BarChart3 className={`w-10 h-10 text-${fullColor} opacity-30 mx-auto mb-3`} />
    <p className="text-gray-500 text-sm">No data for this report / range.</p>
  </div>
);

const ReportResult = ({ type, data, fullColor }: { type: string; data: unknown; fullColor: string }) => {
  if (data == null) return <EmptyState fullColor={fullColor} />;

  if (Array.isArray(data)) {
    return <SimpleTable rows={data as Array<Record<string, unknown>>} fullColor={fullColor} />;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">{String(obj.count ?? (obj.items as unknown[]).length)} record(s)</p>
          <SimpleTable rows={obj.items as Array<Record<string, unknown>>} fullColor={fullColor} />
        </div>
      );
    }
    if (type === 'marketing-consent') {
      return <StatCards obj={obj as Record<string, number>} fullColor={fullColor} />;
    }
    return <StatCards obj={obj as Record<string, number>} fullColor={fullColor} />;
  }

  return <EmptyState fullColor={fullColor} />;
};

export default WaiverReports;
