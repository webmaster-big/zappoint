import { useCallback, useEffect, useState } from 'react';
import { MapPin, ArrowRight, Check, X, Clock, AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { getStoredUser } from '../../../utils/storage';
import { formatDateLong, formatDateTimeET } from '../../../utils/timeFormat';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import locationChangeRequestService, {
  type LocationChangeRequest,
  type LocationChangeRequestStatus,
  type ConflictInfo,
} from '../../../services/LocationChangeRequestService';

const STATUS_TABS: Array<{ key: LocationChangeRequestStatus | 'all'; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const statusPill: Record<LocationChangeRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const bookingLabel = (r: LocationChangeRequest): string => {
  const ref = r.booking?.reference_number || `#${r.booking_id}`;
  const cust = r.booking?.customer
    ? [r.booking.customer.first_name, r.booking.customer.last_name].filter(Boolean).join(' ')
    : r.booking?.guest_name || '';
  return cust ? `${ref} · ${cust}` : ref;
};

const LocationChangeRequests = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const userLocationId: number | null = currentUser?.location_id ?? null;

  const [requests, setRequests] = useState<LocationChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LocationChangeRequestStatus | 'all'>('pending');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<Record<number, ConflictInfo[]>>({});
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await locationChangeRequestService.list(tab === 'all' ? undefined : tab);
      setRequests(res.success ? res.data : []);
    } catch {
      setRequests([]);
      setToast({ message: 'Failed to load requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const canReview = (r: LocationChangeRequest): boolean =>
    r.status === 'pending' && (isCompanyAdmin || (userLocationId !== null && userLocationId === r.to_location_id));

  const doApprove = async (r: LocationChangeRequest, force: boolean) => {
    setBusyId(r.id);
    try {
      const res = await locationChangeRequestService.approve(r.id, force ? { force: true } : {});
      if (res.success) {
        setConflicts((c) => {
          const next = { ...c };
          delete next[r.id];
          return next;
        });
        setToast({ message: 'Location change approved', type: 'success' });
        load();
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { conflicts?: ConflictInfo[]; message?: string } } };
      if (e?.response?.status === 409) {
        setConflicts((c) => ({ ...c, [r.id]: e.response?.data?.conflicts || [] }));
      } else {
        setToast({ message: e?.response?.data?.message || 'Failed to approve', type: 'error' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (r: LocationChangeRequest) => {
    if (!rejectReason.trim()) return;
    setBusyId(r.id);
    try {
      const res = await locationChangeRequestService.reject(r.id, rejectReason.trim());
      if (res.success) {
        setToast({ message: 'Request rejected', type: 'success' });
        setRejectingId(null);
        setRejectReason('');
        load();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setToast({ message: e?.response?.data?.message || 'Failed to reject', type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className={`w-6 h-6 text-${fullColor}`} /> Location Change Requests
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review requests to move bookings between locations. Approving validates scheduling conflicts at the destination.
        </p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? `border-${fullColor} text-${themeColor}-700` : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className={`w-8 h-8 animate-spin text-${fullColor}`} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Inbox className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No {tab === 'all' ? '' : tab} location change requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{bookingLabel(r)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusPill[r.status]}`}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  {r.booking?.package?.name && <p className="text-xs text-gray-500 mt-0.5">{r.booking.package.name}</p>}
                </div>
                {r.booking?.booking_date && (
                  <div className="text-xs text-gray-500 text-right shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatDateLong(r.booking.booking_date)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 text-sm">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {r.from_location?.name || `Location #${r.from_location_id}`}
                </span>
                <ArrowRight className={`w-4 h-4 text-${fullColor}`} />
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-${themeColor}-50 text-${themeColor}-700 font-medium`}>
                  <MapPin className="w-3.5 h-3.5" /> {r.to_location?.name || `Location #${r.to_location_id}`}
                  {r.room?.name ? ` · ${r.room.name}` : ''}
                </span>
              </div>

              {r.reason && <p className="text-sm text-gray-600 mt-2"><span className="text-gray-400">Reason:</span> {r.reason}</p>}

              <div className="text-xs text-gray-400 mt-2">
                Requested by {r.requester?.name || 'staff'} · {formatDateTimeET(r.created_at)}
              </div>

              {r.status === 'rejected' && r.review_notes && (
                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-2.5 text-sm">
                  <span className="font-medium text-red-700">Rejected:</span> <span className="text-red-600">{r.review_notes}</span>
                  {r.reviewer?.name && <span className="text-xs text-gray-400 block mt-0.5">by {r.reviewer.name} · {formatDateTimeET(r.reviewed_at)}</span>}
                </div>
              )}
              {r.status === 'approved' && r.reviewer?.name && (
                <div className="text-xs text-green-600 mt-2">Approved by {r.reviewer.name} · {formatDateTimeET(r.reviewed_at)}</div>
              )}

              {conflicts[r.id] && conflicts[r.id].length > 0 && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-semibold text-red-700">Scheduling conflict at destination</p>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {conflicts[r.id].map((c, i) => (
                      <li key={i} className="text-xs text-red-600">{c.message}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-600 mt-1">You can approve anyway to override.</p>
                </div>
              )}

              {canReview(r) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {rejectingId === r.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (required)"
                        rows={2}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-transparent`}
                      />
                      <div className="flex gap-2 justify-end">
                        <StandardButton variant="secondary" size="sm" onClick={() => { setRejectingId(null); setRejectReason(''); }} disabled={busyId === r.id}>
                          Cancel
                        </StandardButton>
                        <StandardButton variant="danger" size="sm" onClick={() => doReject(r)} disabled={busyId === r.id || !rejectReason.trim()} loading={busyId === r.id}>
                          Confirm Reject
                        </StandardButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end">
                      <StandardButton variant="secondary" size="sm" icon={X} onClick={() => { setRejectingId(r.id); setRejectReason(''); }} disabled={busyId === r.id}>
                        Reject
                      </StandardButton>
                      {conflicts[r.id] && conflicts[r.id].length > 0 ? (
                        <StandardButton variant="danger" size="sm" icon={Check} onClick={() => doApprove(r, true)} disabled={busyId === r.id} loading={busyId === r.id}>
                          Approve anyway
                        </StandardButton>
                      ) : (
                        <StandardButton variant="primary" size="sm" icon={Check} onClick={() => doApprove(r, false)} disabled={busyId === r.id} loading={busyId === r.id}>
                          Approve
                        </StandardButton>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default LocationChangeRequests;
