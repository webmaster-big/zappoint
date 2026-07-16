import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import Toast from '../../../components/ui/Toast';
import Pagination from '../../../components/ui/Pagination';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_DELETION_LOG_STEPS } from '../../../components/waiver/tour/tourSteps';

interface DeletionLogRow {
  id: number;
  waiver_id: number;
  reason?: string | null;
  created_at?: string;
  deleter?: { first_name?: string; last_name?: string };
  snapshot?: { adult_name?: string; selected_date?: string; status?: string };
}

const WaiverDeletionLog = () => {
  const navigate = useNavigate();
  const { fullColor } = useThemeColor();
  const [logs, setLogs] = useState<DeletionLogRow[]>([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await waiverService.deletionLog({ per_page: 25, page });
      if (res?.success) {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination);
      }
    } catch {
      setToast({ message: 'Failed to load deletion log — you may not have permission.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen px-6 py-8">
      <WaiverPageTour steps={WAIVER_DELETION_LOG_STEPS} storageKey="tour_waiver_deletion_log" />
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div data-tour="deletion-log-heading">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Waiver Deletion Log</h1>
          <p className="text-gray-600 mt-1">An audit trail of every deleted waiver.</p>
        </div>
      </div>

      <div data-tour="deletion-log-table" className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Waiver', 'Guest', 'Visit date', 'Reason', 'Deleted by', 'When'].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor} mx-auto`} /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No deletions logged.</p></td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">#{l.waiver_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{l.snapshot?.adult_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{l.snapshot?.selected_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{l.reason || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{[l.deleter?.first_name, l.deleter?.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <Pagination currentPage={pagination.current_page} totalPages={pagination.last_page} onPageChange={setPage} totalItems={pagination.total} showingFrom={pagination.from} showingTo={pagination.to} />
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default WaiverDeletionLog;
