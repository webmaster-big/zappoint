import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { BulkChaperoneView } from '../../types/waiver.types';
import waiverService from '../../services/waiverService';
import { WaiverLoading, WaiverError } from '../../components/waiver/WaiverStates';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

interface NewRow {
  name: string;
  email: string;
  phone: string;
}

const emptyRow = (): NewRow => ({ name: '', email: '', phone: '' });

const statusStyles: Record<string, string> = {
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  sent: 'bg-blue-50 text-blue-700 border-blue-100',
  not_sent: 'bg-gray-50 text-gray-500 border-gray-200',
  not_complete: 'bg-amber-50 text-amber-700 border-amber-100',
  failed: 'bg-red-50 text-red-700 border-red-100',
};

const statusLabel: Record<string, string> = {
  complete: 'Complete',
  sent: 'Sent',
  not_sent: 'Not sent',
  not_complete: 'Incomplete',
  failed: 'Failed',
};

/**
 * Public chaperone management page: /waiver/bulk/:manageToken.
 * The chaperone adds parent/guardian contacts (manually or by pasting a list),
 * sends waiver invites, and tracks each recipient's complete / not-complete status.
 */
const WaiverBulk = () => {
  const { manageToken } = useParams<{ manageToken: string }>();
  const [view, setView] = useState<BulkChaperoneView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [rows, setRows] = useState<NewRow[]>([emptyRow()]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    if (!manageToken) return;
    try {
      const data = await waiverService.getBulk(manageToken);
      setView(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'This invite link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [manageToken]);

  useEffect(() => {
    reload();
  }, [reload]);

  const flash = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4000);
  };

  const updateRow = (i: number, field: keyof NewRow, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // Parse pasted lines: "Name, email, phone" / "email" / "email phone" per line.
  const parsePaste = (text: string): NewRow[] => {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
        const row = emptyRow();
        parts.forEach((p) => {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) row.email = p;
          else if (/^[+\d][\d\s()-]{6,}$/.test(p)) row.phone = p;
          else if (!row.name) row.name = p;
        });
        return row;
      })
      .filter((r) => r.email || r.phone);
  };

  const handleAddRecipients = async () => {
    if (!manageToken) return;
    const collected = pasteMode ? parsePaste(pasteText) : rows;
    const cleaned = collected
      .map((r) => ({
        name: r.name.trim() || undefined,
        email: r.email.trim() || undefined,
        phone: r.phone.trim() || undefined,
      }))
      .filter((r) => r.email || r.phone);

    if (cleaned.length === 0) {
      flash('error', 'Add at least one contact with an email or phone.');
      return;
    }

    setSaving(true);
    try {
      const res = await waiverService.addBulkRecipients(manageToken, cleaned);
      flash('success', res.message || `${cleaned.length} contact(s) added.`);
      setRows([emptyRow()]);
      setPasteText('');
      await reload();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      flash('error', e.response?.data?.message || 'Failed to add contacts.');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!manageToken) return;
    setSending(true);
    try {
      const res = await waiverService.sendBulk(manageToken);
      flash('success', res.message || 'Invites sent.');
      await reload();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      flash('error', e.response?.data?.message || 'Failed to send invites.');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (recipientId: number) => {
    if (!manageToken) return;
    setResendingId(recipientId);
    try {
      await waiverService.resendBulkRecipient(manageToken, recipientId);
      flash('success', 'Invite resent.');
      await reload();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      flash('error', e.response?.data?.message || 'Failed to resend invite.');
    } finally {
      setResendingId(null);
    }
  };

  if (loading) return <WaiverLoading label="Loading invite..." />;
  if (error) return <WaiverError message={error} />;
  if (!view) return null;

  const pending = view.summary.total - view.summary.complete;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-violet-700 text-white rounded-xl shadow-sm p-7 text-center">
          <p className="text-blue-200/80 text-xs font-semibold uppercase tracking-wider mb-2">Group Waivers</p>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'white' }}>
            {view.chaperone_name}
          </h1>
          <p className="text-blue-200 text-sm">
            Invite each parent or guardian to complete their child's waiver for {view.selected_date}.
          </p>
        </div>

        {banner && (
          <div
            className={`rounded-lg px-4 py-2.5 text-xs font-medium ${
              banner.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid grid-cols-3 gap-3 text-center">
          {[
            ['Invited', view.summary.total, 'text-gray-900'],
            ['Complete', view.summary.complete, 'text-emerald-600'],
            ['Pending', pending, 'text-amber-600'],
          ].map(([label, value, color]) => (
            <div key={label as string}>
              <p className={`text-2xl font-bold ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Add contacts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Add Parents / Guardians</h2>
            <button
              type="button"
              onClick={() => setPasteMode((v) => !v)}
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 transition"
            >
              {pasteMode ? 'Enter manually' : 'Paste a list'}
            </button>
          </div>
          <div className="p-5 space-y-3">
            {pasteMode ? (
              <div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={6}
                  className={inputClass}
                  placeholder={'One per line:\nJane Doe, jane@email.com, 555-123-4567\nbob@email.com\n555-987-6543'}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  One contact per line. Separate name, email and phone with commas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRow(i, 'name', e.target.value)}
                      className={inputClass}
                      placeholder="Name"
                    />
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateRow(i, 'email', e.target.value)}
                      className={inputClass}
                      placeholder="Email"
                    />
                    <input
                      type="tel"
                      value={row.phone}
                      onChange={(e) => updateRow(i, 'phone', e.target.value)}
                      className={inputClass}
                      placeholder="Phone"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={rows.length === 1}
                      className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-30 px-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRow}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 transition"
                >
                  + Add another
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddRecipients}
              disabled={saving}
              className="w-full py-2.5 bg-blue-50 text-blue-700 border border-blue-100 text-sm font-semibold rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Contacts'}
            </button>
          </div>
        </div>

        {/* Recipients list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Recipients</h2>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || view.summary.total === 0}
              className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send Invites'}
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {view.recipients.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No contacts added yet.</p>
            )}
            {view.recipients.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name || 'Unnamed contact'}</p>
                  {r.resent_count > 0 && (
                    <p className="text-[11px] text-gray-400">Resent {r.resent_count}×</p>
                  )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      statusStyles[r.status] || statusStyles.not_sent
                    }`}
                  >
                    {statusLabel[r.status] || r.status}
                  </span>
                  {!r.complete && (
                    <button
                      type="button"
                      onClick={() => handleResend(r.id)}
                      disabled={resendingId === r.id}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 transition disabled:opacity-50"
                    >
                      {resendingId === r.id ? '…' : 'Resend'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 pb-2">Powered by ZapZone</div>
      </div>
    </div>
  );
};

export default WaiverBulk;
