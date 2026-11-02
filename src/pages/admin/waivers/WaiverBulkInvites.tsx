import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Users, X, Link2, RefreshCcw, ListChecks, Share2 } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import waiverService from '../../../services/waiverService';
import type { WaiverTemplate } from '../../../types/waiver.types';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import EmailInput from '../../../components/ui/EmailInput';
import WaiverPageTour from '../../../components/waiver/tour/WaiverPageTour';
import { WAIVER_BULK_STEPS } from '../../../components/waiver/tour/tourSteps';
import { formatDateLong } from '../../../utils/timeFormat';
import { fetchAllPages } from '../../../utils/fetchAllPages';
import { formatPhoneForDisplay } from '../../../utils/bookingSearch';

interface BulkInvite {
  id: number;
  chaperone_name: string;
  chaperone_email?: string | null;
  chaperone_phone?: string | null;
  selected_date: string;
  manage_token: string;
  allow_shareable_link: boolean;
  shareable_token?: string | null;
  status: string;
  template?: { id: number; title: string };
  location?: { id: number; name: string };
  recipients_count?: number;
  complete_count?: number;
  failed_count?: number;
}

interface InviteRecipient {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  resent_count: number;
  last_sent_at: string | null;
}

const recipientStatus: Record<string, { label: string; cls: string }> = {
  complete: { label: 'Signed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  sent: { label: 'Invite sent', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  not_sent: { label: 'Not sent yet', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  not_complete: { label: 'Not signed', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  failed: { label: 'Not delivered', cls: 'bg-white text-red-700 border-red-300' },
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const WaiverBulkInvites = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const [invites, setInvites] = useState<BulkInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<BulkInvite | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setInvites(await fetchAllPages<BulkInvite>(async (page) => {
        const res = await waiverService.listBulkInvites({ sort_by: 'created_at', sort_order: 'desc', per_page: 100, page });
        return { items: res?.data?.bulk_invites || [], lastPage: res?.data?.pagination?.last_page ?? 1 };
      }));
    } catch {
      setToast({ message: 'Failed to load group invites', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyLink = (path: string, copiedMessage: string) => {
    const url = `${window.location.origin}${path}`;
    if (!navigator.clipboard) {
      setToast({ message: url, type: 'info' });
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => setToast({ message: copiedMessage, type: 'success' }),
      () => setToast({ message: url, type: 'info' }),
    );
  };

  const resend = async (id: number) => {
    try {
      await waiverService.resendBulkInvite(id);
      setToast({ message: 'Chaperone invite resent', type: 'success' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setToast({ message: e.response?.data?.message || 'Could not resend', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <WaiverPageTour steps={WAIVER_BULK_STEPS} storageKey="tour_waiver_bulk" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/waivers')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div data-tour="bulk-heading">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Group Waiver Invites</h1>
            <p className="text-gray-600 mt-1">Invite a chaperone or group leader to collect each parent's waiver.</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <StandardButton variant="secondary" size="md" icon={RefreshCcw} onClick={load}>{''}</StandardButton>
          <span data-tour="bulk-new-btn">
            <StandardButton variant="primary" size="md" icon={Plus} onClick={() => setShowCreate(true)}>New Invite</StandardButton>
          </span>
        </div>
      </div>

      <div data-tour="bulk-table" className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Chaperone', 'Template', 'Date', 'Signed', 'Group link', ''].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${fullColor} mx-auto`} /></td></tr>
              ) : invites.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><Users className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No group invites yet.</p></td></tr>
              ) : (
                invites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{inv.chaperone_name}</div>
                      <div className="text-xs text-gray-400">{inv.chaperone_email || inv.chaperone_phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.template?.title || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateLong(inv.selected_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{inv.complete_count ?? 0}</span> of {inv.recipients_count ?? 0}
                      {(inv.failed_count ?? 0) > 0 && (
                        <div className="text-xs text-red-600">{inv.failed_count} not delivered</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.allow_shareable_link && inv.shareable_token ? (
                        <button onClick={() => copyLink(`/waiver/group/${inv.shareable_token}`, 'Group link copied')} className={`inline-flex items-center gap-1 text-xs font-medium text-${themeColor}-600 hover:underline`} title="Copy the link the group uses to sign">
                          <Share2 className="w-3.5 h-3.5" /> Copy
                        </button>
                      ) : inv.allow_shareable_link ? (
                        <span className="text-xs text-emerald-600 font-medium">Enabled</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div data-tour="bulk-row-actions" className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(inv)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="See who has signed"><ListChecks className="w-4 h-4" /></button>
                        <button onClick={() => copyLink(`/waiver/bulk/${inv.manage_token}`, 'Chaperone link copied')} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Copy chaperone link"><Link2 className="w-4 h-4" /></button>
                        <button onClick={() => resend(inv.id)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Resend to chaperone"><Send className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateInviteModal
          themeColor={themeColor}
          fullColor={fullColor}
          onClose={() => setShowCreate(false)}
          onSaved={(message, notified) => { setShowCreate(false); load(); setToast({ message, type: notified ? 'success' : 'info' }); }}
        />
      )}
      {viewing && <InviteRecipientsModal invite={viewing} onClose={() => setViewing(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const InviteRecipientsModal = ({ invite, onClose }: { invite: BulkInvite; onClose: () => void }) => {
  const [recipients, setRecipients] = useState<InviteRecipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    waiverService.getBulkInvite(invite.id)
      .then((r) => setRecipients((r?.data?.recipients as InviteRecipient[]) || []))
      .catch(() => setError('Could not load this group.'));
  }, [invite.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const signed = recipients?.filter((r) => r.status === 'complete').length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="invite-recipients-title" className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="invite-recipients-title" className="text-lg font-bold text-gray-900 truncate">{invite.chaperone_name}'s group</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDateLong(invite.selected_date)}
              {recipients && ` · ${signed} of ${recipients.length} signed`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" autoFocus className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto">
          {error ? (
            <p className="px-6 py-8 text-sm text-red-600 text-center">{error}</p>
          ) : recipients === null ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">Loading…</p>
          ) : recipients.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">The chaperone hasn't added anyone yet.</p>
          ) : (
            recipients.map((r) => {
              const status = recipientStatus[r.status] || { label: r.status, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
              return (
                <div key={r.id} className="px-6 py-3 flex items-center justify-between gap-3 border-t border-gray-100 first:border-t-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name || 'No name given'}</p>
                    <p className="text-xs text-gray-400 truncate">{[r.email, formatPhoneForDisplay(r.phone) || r.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const CreateInviteModal = ({ onClose, onSaved, themeColor, fullColor }: { onClose: () => void; onSaved: (message: string, notified: boolean) => void; themeColor: string; fullColor: string }) => {
  const [templates, setTemplates] = useState<WaiverTemplate[]>([]);
  const [form, setForm] = useState({ waiver_template_id: 0, selected_date: todayStr(), chaperone_name: '', chaperone_email: '', chaperone_phone: '', allow_shareable_link: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    waiverService.listTemplates({ status: 'active', per_page: 100 }).then((r) => r.success && setTemplates(((r.data.waiver_templates as WaiverTemplate[]) || []).filter((t) => t.kind !== 'escape_room'))).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.waiver_template_id) { setError('Choose a template'); return; }
    if (!form.chaperone_name.trim()) { setError('Chaperone name is required'); return; }
    if (!form.chaperone_email && !form.chaperone_phone) { setError('Add a chaperone email or phone'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await waiverService.createBulkInvite({
        waiver_template_id: form.waiver_template_id,
        selected_date: form.selected_date,
        chaperone_name: form.chaperone_name.trim(),
        chaperone_email: form.chaperone_email || undefined,
        chaperone_phone: form.chaperone_phone || undefined,
        allow_shareable_link: form.allow_shareable_link,
      });
      onSaved(res?.message || 'Group invite created', res?.data?.chaperone_notified !== false);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2.response?.data?.message || 'Failed to create invite');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">New Group Invite</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template *</label>
            <select value={form.waiver_template_id} onChange={(e) => setForm((f) => ({ ...f, waiver_template_id: Number(e.target.value) }))} className={fieldCls}>
              <option value={0}>Select a template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Visit date *</label>
            <input type="date" value={form.selected_date} onChange={(e) => setForm((f) => ({ ...f, selected_date: e.target.value }))} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Chaperone name *</label>
            <input type="text" value={form.chaperone_name} onChange={(e) => setForm((f) => ({ ...f, chaperone_name: e.target.value }))} className={fieldCls} placeholder="e.g. Coach Carter" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <EmailInput value={form.chaperone_email} onChange={(e) => setForm((f) => ({ ...f, chaperone_email: e.target.value }))} className={fieldCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="tel" value={form.chaperone_phone} onChange={(e) => setForm((f) => ({ ...f, chaperone_phone: e.target.value }))} className={fieldCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.allow_shareable_link} onChange={(e) => setForm((f) => ({ ...f, allow_shareable_link: e.target.checked }))} className={`h-4 w-4 text-${fullColor} rounded border-gray-300`} />
            Give the chaperone one group link to share, so people can sign without being added first
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <StandardButton type="button" variant="secondary" onClick={onClose}>Cancel</StandardButton>
            <StandardButton type="submit" variant="primary" disabled={saving}>{saving ? 'Creating…' : 'Create & Notify'}</StandardButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WaiverBulkInvites;
