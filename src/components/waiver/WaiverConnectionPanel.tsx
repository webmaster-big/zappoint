import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Clock, Link2, FileText, Tablet, UserCheck, Loader2 } from 'lucide-react';
import { useThemeColor } from '../../hooks/useThemeColor';
import waiverService from '../../services/waiverService';
import type { ConnectedWaiver, EntityWaiverSummary } from '../../types/waiver.types';

interface Props {
  type: 'booking' | 'attraction_purchase' | 'event_purchase' | 'customer';
  id: number;
  title?: string;
  compact?: boolean;
  checkInActions?: boolean;
}

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  expired: 'bg-gray-50 text-gray-500 border-gray-200',
  replaced: 'bg-gray-50 text-gray-500 border-gray-200',
  deleted: 'bg-red-50 text-red-700 border-red-100',
};

const statusLabel: Record<string, string> = {
  completed: 'Signed',
  pending: 'Not signed',
  expired: 'Expired',
  replaced: 'Replaced',
  deleted: 'Deleted',
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const WaiverConnectionPanel = ({ type, id, title = 'Waivers', compact = false, checkInActions = true }: Props) => {
  const { themeColor, fullColor } = useThemeColor();
  const [waivers, setWaivers] = useState<ConnectedWaiver[]>([]);
  const [summary, setSummary] = useState<EntityWaiverSummary>({ total: 0, completed: 0, pending: 0, checked_in: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canKiosk = type !== 'customer';

  const launchKiosk = async () => {
    if (!canKiosk) return;
    setLaunching(true);
    try {
      const res = await waiverService.createKioskSession(type as 'booking' | 'attraction_purchase' | 'event_purchase', id);
      if (res.success && res.data.kiosk_url) {
        window.open(res.data.kiosk_url, '_blank', 'noopener');
      }
    } catch {
      /* ignore */
    } finally {
      setLaunching(false);
    }
  };

  const load = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    try {
      const r = await waiverService.entityWaivers(type, id);
      if (r.success) {
        setWaivers(r.data.waivers || []);
        setSummary(r.data.summary || { total: 0, completed: 0, pending: 0, checked_in: 0 });
      }
    } catch {
      setWaivers([]);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = (w: ConnectedWaiver) => {
    if (!w.signing_url) return;
    navigator.clipboard?.writeText(w.signing_url).then(() => {
      setCopied(w.id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  const checkIn = async (w: ConnectedWaiver) => {
    setBusyId(w.id);
    setActionError(null);
    try {
      await waiverService.checkIn(w.id);
      await load(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setActionError(e.response?.data?.message || 'Failed to check in waiver');
    } finally {
      setBusyId(null);
    }
  };

  const checkInAll = async () => {
    setBusyId('all');
    setActionError(null);
    try {
      await waiverService.checkInAll(type, id);
      await load(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setActionError(e.response?.data?.message || 'Failed to check in waivers');
    } finally {
      setBusyId(null);
    }
  };

  const checkableCount = waivers.filter((w) => w.status === 'completed' && !w.checked_in_at).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3"><ShieldCheck className={`w-4 h-4 text-${fullColor}`} /><h3 className="text-sm font-bold text-gray-900">{title}</h3></div>
        <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor} mx-auto my-2`} />
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2"><ShieldCheck className={`w-4 h-4 text-${fullColor}`} /><h3 className="text-sm font-bold text-gray-900">{title}</h3></div>
          {canKiosk && (
            <button type="button" onClick={launchKiosk} disabled={launching} className={`inline-flex items-center gap-1 text-[11px] font-semibold text-${fullColor} hover:bg-${themeColor}-50 px-2 py-1 rounded transition disabled:opacity-50`}>
              <Tablet className="w-3 h-3" />{launching ? '…' : 'Prefilled kiosk'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">No waiver connected to this {type.replace('_', ' ')}.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 text-${fullColor}`} />
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><ShieldCheck className="w-3 h-3" />{summary.completed} signed</span>
          {summary.pending > 0 && <span className="inline-flex items-center gap-1 text-amber-600 font-medium"><Clock className="w-3 h-3" />{summary.pending} pending</span>}
          {checkInActions && (summary.checked_in ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><UserCheck className="w-3 h-3" />{summary.checked_in} checked in</span>
          )}
          {canKiosk && (
            <button type="button" onClick={launchKiosk} disabled={launching} className={`inline-flex items-center gap-1 font-semibold text-${fullColor} hover:bg-${themeColor}-50 px-2 py-1 rounded transition disabled:opacity-50`}>
              <Tablet className="w-3 h-3" />{launching ? '…' : 'Kiosk'}
            </button>
          )}
          {checkInActions && checkableCount > 1 && (
            <button
              type="button"
              onClick={checkInAll}
              disabled={busyId !== null}
              className="inline-flex items-center gap-1 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
            >
              {busyId === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              Check In All ({checkableCount})
            </button>
          )}
        </div>
      </div>
      {actionError && <div className="mb-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 text-[11px] text-red-700">{actionError}</div>}
      <div className="divide-y divide-gray-50">
        {waivers.map((w) => (
          <div key={w.id} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 truncate">{w.adult_name || 'Unnamed'}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusStyles[w.status] || statusStyles.pending}`}>{statusLabel[w.status] || w.status}</span>
                {checkInActions && (
                  w.checked_in_at ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
                      <UserCheck className="w-2.5 h-2.5" />Checked In
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">Not Checked In</span>
                  )
                )}
              </div>
              {!compact && (
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {w.template ? `${w.template} · ` : ''}{w.selected_date}
                  {w.minors.length > 0 && <span> · Minors: {w.minors.join(', ')}</span>}
                  {w.submitted_at && <span> · Signed {formatDateTime(w.submitted_at)}</span>}
                  {w.checked_in_at && <span> · Checked in {formatDateTime(w.checked_in_at)}</span>}
                </div>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {w.status === 'pending' && w.signing_url && (
                <button
                  type="button"
                  onClick={() => copyLink(w)}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold text-${fullColor} hover:bg-${themeColor}-50 px-2 py-1 rounded transition`}
                  title="Copy waiver link"
                >
                  {copied === w.id ? <><FileText className="w-3 h-3" />Copied</> : <><Link2 className="w-3 h-3" />Copy link</>}
                </button>
              )}
              {checkInActions && w.status === 'completed' && !w.checked_in_at && (
                <button
                  type="button"
                  onClick={() => checkIn(w)}
                  disabled={busyId !== null}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 px-2 py-1 rounded-lg transition disabled:opacity-50"
                  title="Check in this waiver"
                >
                  {busyId === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                  Check In
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WaiverConnectionPanel;
