import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, FileText, Power, ArrowLeft, RefreshCcw, Tablet, Trash2, RotateCcw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import type { WaiverTemplate, TemplateStatus } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import KioskSessionModal from '../../../components/waiver/KioskSessionModal';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_TEMPLATES_STEPS } from '../../../components/waiver/tour/tourSteps';

const statusStyles: Record<TemplateStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  draft: 'bg-amber-50 text-amber-700 border-amber-100',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
  archived: 'bg-gray-50 text-gray-400 border-gray-200',
};

interface ConfirmModalProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const ConfirmDeleteModal = ({ title, onCancel, onConfirm, loading }: ConfirmModalProps) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Delete template?</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">"{title}"</span> will be moved to the deleted templates section. You can restore it later.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <StandardButton variant="secondary" size="sm" onClick={onCancel} disabled={loading}>Cancel</StandardButton>
        <StandardButton variant="danger" size="sm" icon={Trash2} onClick={onConfirm} disabled={loading}>{loading ? 'Deleting…' : 'Delete'}</StandardButton>
      </div>
    </div>
  </div>
);

const ConfirmForceDeleteModal = ({ title, onCancel, onConfirm, loading }: ConfirmModalProps) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Permanently delete?</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">"{title}"</span> will be permanently removed. This cannot be undone.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <StandardButton variant="secondary" size="sm" onClick={onCancel} disabled={loading}>Cancel</StandardButton>
        <StandardButton variant="danger" size="sm" icon={AlertTriangle} onClick={onConfirm} disabled={loading}>{loading ? 'Deleting…' : 'Delete permanently'}</StandardButton>
      </div>
    </div>
  </div>
);

const WaiverTemplates = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [kioskTarget, setKioskTarget] = useState<WaiverTemplate | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WaiverTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showTrashed, setShowTrashed] = useState(false);
  const [trashedTemplates, setTrashedTemplates] = useState<WaiverTemplate[]>([]);
  const [trashedLoading, setTrashedLoading] = useState(false);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<WaiverTemplate | null>(null);
  const [forceDeleting, setForceDeleting] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

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

  const loadTrashed = useCallback(async () => {
    try {
      setTrashedLoading(true);
      const res = await waiverService.listTrashedTemplates();
      if (res.success) setTrashedTemplates((res.data.waiver_templates as WaiverTemplate[]) || []);
    } catch {
      setToast({ message: 'Failed to load deleted templates', type: 'error' });
    } finally {
      setTrashedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showTrashed) loadTrashed();
  }, [showTrashed, loadTrashed]);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await waiverService.deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setToast({ message: 'Template deleted', type: 'success' });
      setDeleteTarget(null);
      if (showTrashed) loadTrashed();
    } catch {
      setToast({ message: 'Failed to delete template', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (t: WaiverTemplate) => {
    setRestoring(t.id);
    try {
      await waiverService.restoreTemplate(t.id);
      setTrashedTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setToast({ message: 'Template restored', type: 'success' });
      load();
    } catch {
      setToast({ message: 'Failed to restore template', type: 'error' });
    } finally {
      setRestoring(null);
    }
  };

  const handleForceDelete = async () => {
    if (!forceDeleteTarget) return;
    setForceDeleting(true);
    try {
      await waiverService.forceDeleteTemplate(forceDeleteTarget.id);
      setTrashedTemplates((prev) => prev.filter((x) => x.id !== forceDeleteTarget.id));
      setToast({ message: 'Template permanently deleted', type: 'success' });
      setForceDeleteTarget(null);
    } catch {
      setToast({ message: 'Failed to permanently delete template', type: 'error' });
    } finally {
      setForceDeleting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <WaiverPageTour steps={WAIVER_TEMPLATES_STEPS} storageKey="tour_waiver_templates" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div data-tour="templates-heading">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Waiver Templates</h1>
            <p className="text-gray-600 mt-1">Build legal waivers and assign them to packages, attractions, and events.</p>
          </div>
        </div>
        <span data-tour="templates-new-btn">
          <StandardButton variant="primary" size="md" icon={Plus} onClick={() => navigate('/waivers/templates/create')}>New Template</StandardButton>
        </span>
      </div>

      <div data-tour="templates-search" className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
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
            <thead data-tour="templates-table" className="bg-gray-50 border-b border-gray-100">
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
                        <div data-tour="templates-row-actions" className="flex items-center justify-end gap-1">
                          <button onClick={() => setKioskTarget(t)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title={t.status === 'active' ? 'Launch kiosk mode (new tab)' : 'Test kiosk (preview, new tab)'}><Tablet className="w-4 h-4" /></button>
                          <button onClick={() => cycleStatus(t)} className={`p-2 rounded-lg transition-colors ${t.status === 'active' ? `text-${fullColor} hover:bg-${themeColor}-50` : 'text-gray-400 hover:bg-gray-100'}`} title={t.status === 'active' ? 'Deactivate' : 'Activate'}><Power className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/waivers/templates/${t.id}/edit`)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteTarget(t)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      <div className="mt-4">
        <button
          data-tour="templates-deleted-section"
          onClick={() => setShowTrashed((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors px-1 py-1"
        >
          {showTrashed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Trash2 className="w-4 h-4" />
          Deleted templates
        </button>

        {showTrashed && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-2">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Title', 'Status', 'Version', 'Deleted', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trashedLoading ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto" /></td></tr>
                  ) : trashedTemplates.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No deleted templates.</td></tr>
                  ) : (
                    trashedTemplates.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors opacity-75">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-600">{t.title}</span>
                          {t.internal_description && <div className="text-xs text-gray-400 truncate max-w-xs">{t.internal_description}</div>}
                        </td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusStyles[t.status]}`}>{t.status}</span></td>
                        <td className="px-4 py-3 text-sm text-gray-500">v{t.current_version}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{t.deleted_at ? new Date(t.deleted_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleRestore(t)}
                              disabled={restoring === t.id}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {restoring === t.id ? 'Restoring…' : 'Restore'}
                            </button>
                            <button
                              onClick={() => setForceDeleteTarget(t)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete permanently
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {kioskTarget && (
        <KioskSessionModal
          templateId={kioskTarget.id}
          isPreview={kioskTarget.status !== 'active'}
          assignedPackageIds={kioskTarget.assigned_package_ids}
          assignedAttractionIds={kioskTarget.assigned_attraction_ids}
          assignedEventIds={kioskTarget.assigned_event_ids}
          onClose={() => setKioskTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {forceDeleteTarget && (
        <ConfirmForceDeleteModal
          title={forceDeleteTarget.title}
          onCancel={() => setForceDeleteTarget(null)}
          onConfirm={handleForceDelete}
          loading={forceDeleting}
        />
      )}
    </div>
  );
};

export default WaiverTemplates;
