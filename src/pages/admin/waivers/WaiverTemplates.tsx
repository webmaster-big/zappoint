import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, FileText, Power, ArrowLeft, RefreshCcw, Tablet } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import type { WaiverTemplate, TemplateStatus } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';

const statusStyles: Record<TemplateStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  draft: 'bg-amber-50 text-amber-700 border-amber-100',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
  archived: 'bg-gray-50 text-gray-400 border-gray-200',
};

const WaiverTemplates = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await waiverService.listTemplates({ per_page: 100, search: search || undefined, status: statusFilter || undefined });
      if (res.success) setTemplates((res.data.waiver_templates as WaiverTemplate[]) || []);
    } catch {
      setToast({ message: 'Failed to load templates', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const cycleStatus = async (t: WaiverTemplate) => {
    const next: TemplateStatus = t.status === 'active' ? 'inactive' : 'active';
    try {
      await waiverService.setTemplateStatus(t.id, next);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
      setToast({ message: `Template ${next === 'active' ? 'activated' : 'deactivated'}`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Waiver Templates</h1>
            <p className="text-gray-600 mt-1">Build legal waivers and assign them to packages, attractions, and events.</p>
          </div>
        </div>
        <StandardButton variant="primary" size="md" icon={Plus} onClick={() => navigate('/waivers/templates/create')}>New Template</StandardButton>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-lg w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600`} />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
          <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={load}>{''}</StandardButton>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Title', 'Status', 'Version', 'Default', 'Assignments', 'Updated', ''].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor} mx-auto`} /></td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No templates yet.</p></td></tr>
              ) : (
                templates.map((t) => {
                  const assignments = (t.assigned_package_ids?.length || 0) + (t.assigned_attraction_ids?.length || 0) + (t.assigned_event_ids?.length || 0);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/waivers/templates/${t.id}/edit`)} className="text-sm font-medium text-gray-900 hover:underline text-left">{t.title}</button>
                        {t.internal_description && <div className="text-xs text-gray-400 truncate max-w-xs">{t.internal_description}</div>}
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyles[t.status]}`}>{t.status}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">v{t.current_version}</td>
                      <td className="px-4 py-3">{t.is_default ? <span className={`text-xs font-semibold text-${fullColor}`}>Default</span> : <span className="text-xs text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{assignments} item(s)</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => window.open(`/waiver/kiosk/${t.id}${t.status === 'active' ? '' : '?preview=1'}`, '_blank', 'noopener')} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title={t.status === 'active' ? 'Launch kiosk mode (new tab)' : 'Test kiosk (preview, new tab)'}><Tablet className="w-4 h-4" /></button>
                          <button onClick={() => cycleStatus(t)} className={`p-2 rounded-lg transition-colors ${t.status === 'active' ? `text-${fullColor} hover:bg-${themeColor}-50` : 'text-gray-400 hover:bg-gray-100'}`} title={t.status === 'active' ? 'Deactivate' : 'Activate'}><Power className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/waivers/templates/${t.id}/edit`)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Edit"><Pencil className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default WaiverTemplates;
