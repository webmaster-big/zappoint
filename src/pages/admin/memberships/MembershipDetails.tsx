import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pause,
  XCircle,
  Camera,
  MessageSquarePlus,
  RefreshCcw,
  CreditCard,
  ClipboardList,
  History,
  RotateCcw,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  DollarSign,
  Ticket,
  CalendarPlus,
  Trash2,
} from 'lucide-react';
import membershipService from '../../../services/MembershipService';
import { membershipCache } from '../../../services/MembershipCacheService';
import type { Membership, MembershipPayment, MembershipBenefitRedemption } from '../../../types/Membership.types';
import { getImageUrl, getStoredUser } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import MembershipStatusBadge from '../../../components/membership/MembershipStatusBadge';
import { SkeletonDetailCard } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatMembershipDate, formatMembershipPrice } from '../../../utils/membershipFormat';

const describeRedemptionValue = (r: MembershipBenefitRedemption): string => {
  const v = Number(r.value_applied);
  switch (r.value_mode) {
    case 'percent': return `${v}% off`;
    case 'fixed':   return `$${v.toFixed(2)} off`;
    case 'free':    return 'Free (100% off)';
    case 'count':   return 'Pass used';
    case 'flag':    return 'Access granted';
    default:        return '';
  }
};

const AUDIT_LABELS: Record<string, string> = {
  activated:             'Membership Activated',
  check_in:              'Check-In',
  check_in_denied:       'Check-In Denied',
  photo_update:          'Photo Updated',
  status_change:         'Status Changed',
  freeze:                'Membership Frozen',
  unfreeze:              'Membership Unfrozen',
  canceled:              'Membership Canceled',
  term_reset:            'Term Reset',
  payment_received:      'Payment Received',
  payment_failed:        'Payment Failed',
  payment_method_update: 'Payment Method Updated',
  manual_override:       'Manual Override',
  pass_redeemed:         'Pass Redeemed',
};

const auditLabel = (action: string) =>
  AUDIT_LABELS[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const auditColor = (action: string): string => {
  if (['check_in_denied', 'canceled', 'payment_failed'].includes(action)) return 'bg-red-100 text-red-700';
  if (['activated', 'unfreeze'].includes(action)) return 'bg-green-100 text-green-700';
  if (action === 'check_in' || action === 'manual_override') return 'bg-blue-100 text-blue-700';
  if (action.startsWith('payment')) return 'bg-purple-100 text-purple-700';
  if (['freeze', 'status_change'].includes(action)) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-700';
};

const auditActor = (a: import('../../../types/Membership.types').MembershipAuditLog): string => {
  if (a.actor_type === 'staff' && a.user) return `${a.user.first_name} ${a.user.last_name}`;
  if (a.actor_type === 'customer') return 'Customer';
  if (a.actor_type === 'system') return 'System';
  return a.actor_type ?? 'Unknown';
};

const MembershipDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { themeColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  // Pre-fill from the list cache so the page shows content immediately;
  // a fresh network fetch happens in the background.
  const cachedM = id ? membershipCache.getMembershipFromCache(Number(id)) : null;
  const [m, setM] = useState<Membership | null>(cachedM);
  const [loading, setLoading] = useState(cachedM === null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [pmLabel, setPmLabel] = useState('');
  const { toast, showSuccess, showError, clear } = useToast();

  const [refundTarget, setRefundTarget] = useState<MembershipPayment | null>(null);
  const [voidTarget, setVoidTarget] = useState<MembershipPayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [voidNote, setVoidNote] = useState('');
  const [paymentActing, setPaymentActing] = useState(false);

  const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';
  const inputCls = `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`;

  const applyUpdate = (updated: Membership) => {
    setM(updated);
    setPmLabel(updated.payment_method_label ?? '');
    void membershipCache.updateMembershipInCache(updated);
  };

  const load = async () => {
    // Only show full loading state if we have nothing from cache
    if (!m) setLoading(true);
    else setIsSyncing(true);
    try {
      const data = await membershipService.getMembership(Number(id));
      setM(data);
      setPmLabel(data.payment_method_label ?? '');
    } catch (e: unknown) {
      showError(e, 'Failed to load membership');
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const freeze = async () => {
    if (!m) return;
    const until = window.prompt('Freeze until (YYYY-MM-DD)');
    if (!until) return;
    setActing('freeze');
    try { applyUpdate(await membershipService.freezeMembership(m.id, until)); showSuccess('Frozen'); }
    catch (e: unknown) { showError(e, 'Freeze failed'); }
    finally { setActing(null); }
  };

  const cancel = async (mode: 'immediate' | 'end_of_term') => {
    if (!m || !window.confirm(`Cancel (${mode})?`)) return;
    setActing('cancel');
    try { applyUpdate(await membershipService.cancelMembership(m.id, mode)); showSuccess('Canceled'); }
    catch (e: unknown) { showError(e, 'Cancel failed'); }
    finally { setActing(null); }
  };

  const extend = async () => {
    if (!m) return;
    const current = m.current_term_end ? m.current_term_end.slice(0, 10) : '';
    const newDate = window.prompt('Extend membership until (YYYY-MM-DD)', current);
    if (!newDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { showError(null, 'Enter a valid date (YYYY-MM-DD)'); return; }
    const note = window.prompt('Reason / note (optional)') || undefined;
    setActing('extend');
    try { applyUpdate(await membershipService.extendMembership(m.id, newDate, note)); showSuccess('Membership extended'); }
    catch (e: unknown) { showError(e, 'Extend failed'); }
    finally { setActing(null); }
  };

  const remove = async () => {
    if (!m) return;
    if (!window.confirm('Permanently delete this canceled membership? This cannot be undone.')) return;
    setActing('delete');
    try {
      await membershipService.deleteMembership(m.id);
      void membershipCache.invalidate('list');
      showSuccess('Membership deleted');
      navigate('/memberships');
    }
    catch (e: unknown) { showError(e, 'Delete failed'); }
    finally { setActing(null); }
  };

  const changeStatus = async (status: string) => {
    if (!m) return;
    setActing('status');
    try { applyUpdate(await membershipService.updateMembershipStatus(m.id, status)); showSuccess('Status updated'); }
    catch (e: unknown) { showError(e, 'Status update failed'); }
    finally { setActing(null); }
  };

  const uploadPhoto = async (file: File) => {
    if (!m) return;
    setActing('photo');
    try { applyUpdate(await membershipService.uploadMembershipPhoto(m.id, file)); showSuccess('Photo uploaded'); }
    catch (e: unknown) { showError(e, 'Upload failed'); }
    finally { setActing(null); }
  };

  const addNote = async () => {
    if (!m || !noteText.trim()) return;
    setActing('note');
    try {
      await membershipService.addMembershipNote(m.id, noteText.trim());
      setNoteText('');
      showSuccess('Note added');
      applyUpdate(await membershipService.getMembership(m.id));
    }
    catch (e: unknown) { showError(e, 'Note failed'); }
    finally { setActing(null); }
  };

  const updatePm = async () => {
    if (!m || !pmLabel.trim()) return;
    setActing('pm');
    try {
      applyUpdate(await membershipService.updatePaymentMethod(m.id, { payment_method_label: pmLabel.trim() }));
      showSuccess('Payment method label updated');
    } catch (e: unknown) { showError(e, 'Update failed'); }
    finally { setActing(null); }
  };

  const retry = async () => {
    if (!m) return;
    setActing('retry');
    try {
      await membershipService.retryPayment(m.id);
      showSuccess('Retry attempted');
      applyUpdate(await membershipService.getMembership(m.id));
    }
    catch (e: unknown) { showError(e, 'Retry failed'); }
    finally { setActing(null); }
  };

  const handleRefundOpen = (p: MembershipPayment) => {
    setRefundTarget(p);
    setRefundAmount(String(p.amount));
    setRefundNote('');
  };

  const handleRefundSubmit = async () => {
    if (!m || !refundTarget) return;
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0 || amt > refundTarget.amount) return;
    setPaymentActing(true);
    try {
      await membershipService.refundMembershipPayment(m.id, refundTarget.id, amt, refundNote || undefined);
      showSuccess('Refund recorded');
      setRefundTarget(null);
      applyUpdate(await membershipService.getMembership(m.id));
    } catch (e: unknown) {
      showError(e, 'Refund failed');
    } finally {
      setPaymentActing(false);
    }
  };

  const handleVoidSubmit = async () => {
    if (!m || !voidTarget) return;
    setPaymentActing(true);
    try {
      await membershipService.voidMembershipPayment(m.id, voidTarget.id, voidNote || undefined);
      showSuccess('Payment voided');
      setVoidTarget(null);
      applyUpdate(await membershipService.getMembership(m.id));
    } catch (e: unknown) {
      showError(e, 'Void failed');
    } finally {
      setPaymentActing(false);
    }
  };

  if (loading) return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <SkeletonDetailCard />
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
  if (!m) return <div className="px-6 py-8 text-gray-600">Membership not found.</div>;


  const paymentStatusBadge = (status: MembershipPayment['status']) => {
    const cfg: Record<string, string> = {
      succeeded: 'bg-green-100 text-green-700 border-green-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      refunded: 'bg-purple-100 text-purple-700 border-purple-200',
      voided: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const icons: Record<string, React.ReactNode> = {
      succeeded: <CheckCircle2 size={11} />,
      failed: <AlertTriangle size={11} />,
      pending: <Clock size={11} />,
      refunded: <RotateCcw size={11} />,
      voided: <Ban size={11} />,
    };
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
        {icons[status]} {status}
      </span>
    );
  };

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}
      {isSyncing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-blue-100">
          <div className="h-full w-1/3 bg-blue-400 animate-pulse" />
        </div>
      )}

      <div className="mb-6">
        <StandardButton variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/memberships')}>
          Back to Memberships
        </StandardButton>
      </div>

      <div className={`${cardCls} flex items-start gap-6 flex-wrap mb-6`}>
        {m.photo_path ? (
          <img src={getImageUrl(m.photo_path)} alt="member" className="w-28 h-28 rounded-xl object-cover border border-gray-100" />
        ) : (
          <div className="w-28 h-28 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
            <Camera />
          </div>
        )}
        <div className="flex-1 min-w-[240px]">
          {(() => {
            const guardianName = `${m.customer?.first_name ?? ''} ${m.customer?.last_name ?? ''}`.trim();
            const holder = m.holder_name?.trim();
            // The pass holder (authorized user) is the headline; the account is
            // owned by the guardian/customer shown beneath.
            const headline = holder || guardianName || 'Member';
            const showGuardian = !!holder && !!guardianName;
            return (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pass Holder</p>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  {headline}
                  <InfoTooltip
                    widthClass="w-80"
                    content={
                      <>
                        <p className="font-semibold mb-1">Member Detail Page</p>
                        <p>Full lifecycle view for a single membership: current status, plan terms, visit history, payment ledger, staff notes, and audit log.</p>
                        <p className="mt-1">The headline is the <b>pass holder</b> (the authorized user who checks in). The <b>account / guardian</b> below owns billing and login.</p>
                      </>
                    }
                  />
                </h1>
                <p className="text-gray-600 mt-1">
                  {showGuardian && (
                    <span className="text-gray-500">Account / Guardian: <span className="text-gray-700 font-medium">{guardianName}</span> · </span>
                  )}
                  {m.customer?.email || <span className="text-gray-400">no email on file</span>}
                </p>
              </>
            );
          })()}
          <div className="mt-3 flex flex-wrap gap-2 text-sm items-center">
            <MembershipStatusBadge status={m.status} size="md" />
            <InfoTooltip
              widthClass="w-72"
              content={
                <>
                  <p><b>active</b> · paid & in good standing</p>
                  <p><b>pending</b> · awaiting first payment</p>
                  <p><b>past_due</b> · last charge failed, in grace period</p>
                  <p><b>frozen</b> · paused by staff, no charges</p>
                  <p><b>suspended</b> · disabled due to non-payment</p>
                  <p><b>canceled</b> · ended (immediate or end-of-term)</p>
                  <p><b>expired</b> · term ended without renewal</p>
                </>
              }
            />
            <span className="text-gray-700 font-medium">{m.plan?.name}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600 capitalize">{m.plan?.billing_interval?.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === 'past_due' && (
            <div className="inline-flex items-center gap-1">
              <StandardButton variant="secondary" size="sm" icon={RefreshCcw} loading={acting === 'retry'} onClick={retry}>
                Retry Payment
              </StandardButton>
              <InfoTooltip content="Manually re-attempts the failed renewal charge using the saved payment method." />
            </div>
          )}
          {m.status === 'active' && (
            <div className="inline-flex items-center gap-1">
              <StandardButton variant="secondary" size="sm" icon={Pause} loading={acting === 'freeze'} onClick={freeze}>
                Freeze
              </StandardButton>
              <InfoTooltip content="Pause billing and access until a chosen date. No charges fire while frozen." />
            </div>
          )}
          {m.status === 'frozen' && (
            <div className="inline-flex items-center gap-1">
              <StandardButton variant="secondary" size="sm" loading={acting === 'status'} onClick={() => changeStatus('active')}>
                Unfreeze
              </StandardButton>
              <InfoTooltip content="Resume the membership now. Billing schedule continues from the original cycle dates." />
            </div>
          )}
          {m.status === 'suspended' && (
            <div className="inline-flex items-center gap-1">
              <StandardButton variant="secondary" size="sm" loading={acting === 'status'} onClick={() => changeStatus('active')}>
                Reactivate
              </StandardButton>
              <InfoTooltip content="Re-enable a suspended membership. Make sure the payment issue is resolved first." />
            </div>
          )}
          {!['canceled', 'expired'].includes(m.status) && (
            <>
              <div className="inline-flex items-center gap-1">
                <StandardButton variant="danger" size="sm" icon={XCircle} loading={acting === 'cancel'} onClick={() => cancel('end_of_term')}>
                  Cancel (End of Term)
                </StandardButton>
                <InfoTooltip content="Stops auto-renewal but member keeps access until the current paid term ends." />
              </div>
              <div className="inline-flex items-center gap-1">
                <StandardButton variant="danger" size="sm" icon={XCircle} loading={acting === 'cancel'} onClick={() => cancel('immediate')}>
                  Cancel Immediately
                </StandardButton>
                <InfoTooltip content="Ends access right now. No refund is issued automatically — handle separately if needed." />
              </div>
            </>
          )}
          <div className="inline-flex items-center gap-1">
            <StandardButton variant="secondary" size="sm" icon={CalendarPlus} loading={acting === 'extend'} onClick={extend}>
              Extend
            </StandardButton>
            <InfoTooltip content="Manually set a new term end date. Extends access beyond the plan's season end or revives an expired/past-due membership." />
          </div>
          {isCompanyAdmin && m.status === 'canceled' && (
            <div className="inline-flex items-center gap-1">
              <StandardButton variant="danger" size="sm" icon={Trash2} loading={acting === 'delete'} onClick={remove}>
                Delete
              </StandardButton>
              <InfoTooltip content="Permanently remove this canceled membership. Admins only and cannot be undone." />
            </div>
          )}
          <label
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg cursor-pointer ${acting === 'photo' ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Camera className="w-3 h-3" /> Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && uploadPhoto(e.target.files[0])} />
          </label>
          <InfoTooltip content="Upload or replace the member's verification photo used at check-in." />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className={cardCls}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardList className={`w-4 h-4 text-${themeColor}-600`} /> Plan & Term
            <InfoTooltip content="Plan configuration plus the dates and visit counters for the member's current billing term." />
          </h3>
          <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500">Plan</dt><dd className="text-gray-900 font-medium">{m.plan?.name}</dd>
            <dt className="text-gray-500 flex items-center gap-1">Started <InfoTooltip content="The very first activation date of this membership." size={11} /></dt><dd className="text-gray-700">{formatMembershipDate(m.started_at)}</dd>
            <dt className="text-gray-500 flex items-center gap-1">Term <InfoTooltip content="Current paid period. Visit allowances and renewal trigger on these dates." size={11} /></dt><dd className="text-gray-700">{formatMembershipDate(m.current_term_start)} → {formatMembershipDate(m.current_term_end)}</dd>
            <dt className="text-gray-500 flex items-center gap-1">Visits used <InfoTooltip content="Number of check-ins counted against this term's allowance." size={11} /></dt><dd className="text-gray-700">{m.visits_used_this_term}</dd>
            <dt className="text-gray-500 flex items-center gap-1">Visits remaining <InfoTooltip content="Calculated as included visits minus used. Infinity for unlimited plans." size={11} /></dt><dd className="text-gray-700">{m.visits_remaining ?? '∞'}</dd>
            <dt className="text-gray-500 flex items-center gap-1">Home location <InfoTooltip content="Primary location for this member. Used by plans with single-location access." size={11} /></dt><dd className="text-gray-700">{m.home_location?.name || '—'}</dd>
            <dt className="text-gray-500 flex items-center gap-1">QR token <InfoTooltip content="Server-generated unique token rendered as a QR code in the customer app. Used by the check-in scanner." size={11} /></dt><dd className="text-gray-700 font-mono text-xs break-all">{m.qr_token}</dd>
          </dl>
        </div>

        <div className={cardCls}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History className={`w-4 h-4 text-${themeColor}-600`} /> Recent Visits
            <InfoTooltip content="Last 20 check-ins for this membership, including manual staff overrides." />
          </h3>
          {(m.visits || []).length === 0 ? (
            <p className="text-sm text-gray-500">No visits yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 max-h-60 overflow-auto">
              {(m.visits || []).slice(0, 20).map((v) => (
                <li key={v.id} className="flex justify-between gap-2 py-2">
                  <div>
                    <span className="text-gray-700">{new Date(v.visited_at).toLocaleString()}</span>
                    {v.denial_reason && <p className="text-xs text-red-500 mt-0.5">{v.denial_reason}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium ${
                      v.result === 'allowed' ? 'text-green-600'
                      : v.result === 'override' ? 'text-blue-600'
                      : 'text-red-500'
                    }`}>{v.result}</span>
                    <span className="text-xs text-gray-400 block">
                      {v.location?.name ?? (v.location_id ? `Loc #${v.location_id}` : '')}
                      {v.staff ? ` · ${v.staff.first_name}` : ''}
                      {!v.counted_against_usage ? ' · not counted' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardCls}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className={`w-4 h-4 text-${themeColor}-600`} /> Payments
            <InfoTooltip content="Every charge attempt for this membership — successful, refunded, failed, or voided. Use the action buttons to refund settled charges or void pending ones." />
          </h3>
          {(m.membership_payments || []).length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(m.membership_payments || []).map((p) => (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {paymentStatusBadge(p.status)}
                        <span className="text-sm font-semibold text-gray-900">{formatMembershipPrice(p.amount)}</span>
                        {p.retry_attempt ? (
                          <span className="text-[11px] text-gray-400">retry #{p.retry_attempt}</span>
                        ) : null}
                      </div>
                      {p.description && (
                        <p className="text-xs text-gray-600 mb-0.5">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {p.charged_at
                            ? new Date(p.charged_at).toLocaleString()
                            : p.failed_at
                            ? new Date(p.failed_at).toLocaleString()
                            : '—'}
                        </span>
                        {p.transaction_id && (
                          <span className="text-[11px] font-mono text-gray-400 truncate max-w-[140px]" title={p.transaction_id}>
                            txn: {p.transaction_id}
                          </span>
                        )}
                        {p.failure_reason && p.status === 'failed' && (
                          <span className="text-[11px] text-red-500 truncate max-w-[180px]" title={p.failure_reason}>
                            {p.failure_reason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {p.status === 'succeeded' && (
                        <button
                          onClick={() => handleRefundOpen(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 transition"
                          title="Refund this settled payment"
                        >
                          <RotateCcw size={11} /> Refund
                        </button>
                      )}
                      {p.status === 'pending' && (
                        <button
                          onClick={() => { setVoidTarget(p); setVoidNote(''); }}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition"
                          title="Void this unsettled payment (also cancels the membership)"
                        >
                          <Ban size={11} /> Void
                        </button>
                      )}
                      {p.status === 'failed' && (
                        <button
                          onClick={retry}
                          disabled={acting === 'retry'}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50"
                          title="Retry failed payment"
                        >
                          <RefreshCcw size={11} className={acting === 'retry' ? 'animate-spin' : ''} />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardCls}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquarePlus className={`w-4 h-4 text-${themeColor}-600`} /> Staff Notes
            <InfoTooltip content="Internal-only notes visible to staff. Useful for incidents, payment arrangements, or special handling." />
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className={inputCls}
            />
            <StandardButton variant="primary" size="sm" loading={acting === 'note'} onClick={addNote}>
              Add
            </StandardButton>
          </div>
          {(m.notes || []).length === 0 ? (
            <p className="text-sm text-gray-500">No notes.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 max-h-60 overflow-auto">
              {(m.notes || []).map((n) => (
                <li key={n.id} className="py-2">
                  <p className="text-gray-800">{n.content}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardCls}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className={`w-4 h-4 text-${themeColor}-600`} /> Payment Method
            <InfoTooltip content="Update the display label for the saved payment method on file. This is informational — it does not charge the card." />
          </h3>
          <p className="text-xs text-gray-500 mb-2">Current: <span className="text-gray-700 font-medium">{m.payment_method_label || '— none on file'}</span></p>
          <div className="flex gap-2">
            <input
              value={pmLabel}
              onChange={(e) => setPmLabel(e.target.value)}
              placeholder="e.g. Visa *4242"
              className={inputCls}
            />
            <StandardButton variant="primary" size="sm" loading={acting === 'pm'} onClick={updatePm}>
              Save
            </StandardButton>
          </div>
        </div>

        <div className={`${cardCls} md:col-span-2`}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <History className={`w-4 h-4 text-${themeColor}-600`} /> Audit Log
            <InfoTooltip content="System-generated trail of every status change, freeze, cancel, payment event and override — useful for disputes and compliance." />
          </h3>
          {(m.audit_logs || []).length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 max-h-72 overflow-auto">
              {(m.audit_logs || []).map((a) => (
                <li key={a.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-xs px-2 py-0.5 rounded ${auditColor(a.action)}`}>
                        {auditLabel(a.action)}
                      </span>
                      <span className="text-xs text-gray-500">
                        by <span className="text-gray-700 font-medium">{auditActor(a)}</span>
                      </span>
                      {!!a.after?.result && (
                        <span className="text-xs text-gray-400">· {String(a.after.result)}</span>
                      )}
                      {!!a.after?.status && (
                        <span className="text-xs text-gray-400">· {String(a.after.status)}</span>
                      )}
                    </div>
                    {a.note && (
                      <p className="text-xs text-gray-500 italic">“{a.note}”</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardCls} md:col-span-2`}>
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Ticket className={`w-4 h-4 text-${themeColor}-600`} /> Benefit Redemptions
            <InfoTooltip content="Pass and discount redemptions applied to this membership. Shows the last 100 non-reversed redemptions." />
          </h3>
          {(m.benefit_redemptions || []).length === 0 ? (
            <p className="text-sm text-gray-500">No benefit redemptions yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 max-h-72 overflow-auto">
              {(m.benefit_redemptions || []).map((r) => (
                <li key={r.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-xs px-2 py-0.5 rounded bg-${themeColor}-50 text-${themeColor}-700`}>
                        {r.benefit?.label || r.benefit_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs text-gray-500">{describeRedemptionValue(r)}</span>
                      {r.staff && (
                        <span className="text-xs text-gray-400">· {r.staff.first_name} {r.staff.last_name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(r.created_at!).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100">
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Refund Payment</h3>
                  <p className="text-xs text-gray-500">Original: {formatMembershipPrice(refundTarget.amount)}</p>
                </div>
              </div>
              <button onClick={() => setRefundTarget(null)} className="text-gray-400 hover:text-gray-600 transition" disabled={paymentActing}>
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Refund Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <DollarSign size={14} />
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={refundTarget.amount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className={`${inputCls} pl-8`}
                    placeholder={String(refundTarget.amount)}
                  />
                </div>
                {parseFloat(refundAmount) > refundTarget.amount && (
                  <p className="text-xs text-red-500 mt-1">Cannot exceed original amount.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Internal Note <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={2}
                  placeholder="Reason for refund…"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setRefundTarget(null)}
                disabled={paymentActing}
                className="flex-1 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRefundSubmit()}
                disabled={paymentActing || !refundAmount || parseFloat(refundAmount) <= 0 || parseFloat(refundAmount) > refundTarget.amount}
                className={`flex-1 text-sm font-medium px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {paymentActing ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                {paymentActing ? 'Processing…' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100">
                  <Ban className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Void Payment</h3>
                  <p className="text-xs text-gray-500">{formatMembershipPrice(voidTarget.amount)} · {voidTarget.status}</p>
                </div>
              </div>
              <button onClick={() => setVoidTarget(null)} className="text-gray-400 hover:text-gray-600 transition" disabled={paymentActing}>
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3 items-start p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-semibold">Void is for unsettled (pending) payments only.</p>
                  <p>This will void the transaction with the payment gateway and <span className="font-semibold">immediately cancel the membership</span>. This cannot be undone.</p>
                  <p className="text-red-600">For settled (succeeded) payments, use <span className="font-semibold">Refund</span> instead.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Internal Note <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={voidNote}
                  onChange={(e) => setVoidNote(e.target.value)}
                  rows={2}
                  placeholder="Reason for voiding…"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setVoidTarget(null)}
                disabled={paymentActing}
                className="flex-1 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleVoidSubmit()}
                disabled={paymentActing}
                className="flex-1 text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {paymentActing ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <Ban size={14} />
                )}
                {paymentActing ? 'Processing…' : 'Void Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipDetails;
