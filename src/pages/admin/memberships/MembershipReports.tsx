import { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Users,
  DollarSign,
  Snowflake,
  XCircle,
  RefreshCcw,
  MapPin,
  Star,
  Activity,
} from 'lucide-react';
import membershipService from '../../../services/MembershipService';
import type { MembershipReportSummary } from '../../../types/Membership.types';
import Toast from '../../../components/ui/Toast';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import DateRangeCalendar from '../../../components/ui/DateRangeCalendar';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import { useToast } from '../../../hooks/useToast';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { formatMembershipPrice } from '../../../utils/membershipFormat';
import type { LucideIcon } from 'lucide-react';

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthAgoIso = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: string;
  tooltip: string;
}

const Stat = ({ icon: Icon, label, value, accent, tooltip }: StatProps) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]">
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-lg bg-${accent}-100 text-${accent}-600`}>
        <Icon size={20} />
      </div>
      <span className="text-base font-semibold text-gray-800">{label}</span>
      <InfoTooltip content={tooltip} className="ml-auto" />
    </div>
    <div className="flex items-end gap-2 mt-2">
      {typeof value === 'number' ? (
        <CounterAnimation value={value} className="text-2xl font-bold text-gray-900" />
      ) : (
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      )}
    </div>
  </div>
);

const MembershipReports = () => {
  const { themeColor } = useThemeColor();
  const [from, setFrom] = useState(monthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<MembershipReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, showError, clear } = useToast();

  const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';

  const load = async () => {
    setLoading(true);
    try {
      const res = await membershipService.reportSummary({ from, to });
      setData(res);
    } catch (e: unknown) {
      showError(e, 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Membership Reports
            <InfoTooltip
              widthClass="w-72"
              content={
                <>
                  <p className="font-semibold mb-1">What you're looking at</p>
                  <p>Snapshot of all memberships (Active / Past Due / Suspended / Frozen) plus revenue, new sign-ups, cancellations and engagement for the selected date range.</p>
                </>
              }
            />
          </h1>
          <p className="text-gray-600 mt-1">KPIs, revenue, and engagement for the selected range</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeCalendar
            startDate={from}
            endDate={to}
            onChange={(s, e) => { setFrom(s); setTo(e); }}
            themeColor={themeColor}
          />
          <StandardButton variant="primary" size="md" icon={RefreshCcw} onClick={load} loading={loading}>
            Apply
          </StandardButton>
        </div>
      </div>

      {loading || !data ? (
        <div className="py-20 flex justify-center"><LoadingSpinner size="medium" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat icon={Users} label="Active" value={data.counts.active} accent="blue"
              tooltip="Currently paying members in good standing. Their card is on file and the current term is active." />
            <Stat icon={AlertCircle} label="Past Due" value={data.counts.past_due} accent="orange"
              tooltip="Last renewal payment failed. Member is in grace period — auto-retry attempts are scheduled per the plan settings." />
            <Stat icon={XCircle} label="Suspended" value={data.counts.suspended} accent="red"
              tooltip="Grace period exhausted after failed payments. Access is blocked until payment is updated and a manual reactivation is performed." />
            <Stat icon={Snowflake} label="Frozen" value={data.counts.frozen} accent="blue"
              tooltip="Member-paused membership. Billing is paused and visits cannot be redeemed until the freeze-until date is reached." />
            <Stat icon={TrendingUp} label="New (range)" value={data.counts.new_in_range} accent="green"
              tooltip="Memberships purchased between the selected From and To dates." />
            <Stat icon={XCircle} label="Canceled (range)" value={data.counts.canceled_in_range} accent="red"
              tooltip="Memberships canceled between the selected dates (immediate cancellations + end-of-term effective dates falling in range)." />
            <Stat icon={DollarSign} label="MRR" value={formatMembershipPrice(data.mrr)} accent="green"
              tooltip="Monthly Recurring Revenue: sum of active membership prices normalized to a monthly cadence (annual plans / 12, etc.)." />
            <Stat icon={DollarSign} label="ARR" value={formatMembershipPrice(data.arr)} accent="green"
              tooltip="Annual Recurring Revenue: MRR × 12. Projection of yearly run-rate from current active members." />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className={cardCls}>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Star className={`w-4 h-4 text-${themeColor}-600`} /> Top Plans
                <InfoTooltip content="Plans ranked by total active members." className="ml-1" />
              </h3>
              {data.top_plans.length === 0 ? (
                <p className="text-sm text-gray-500">No data.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {data.top_plans.map((p) => (
                    <li key={p.plan_id} className="flex justify-between py-2">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="font-semibold text-gray-900">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={cardCls}>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className={`w-4 h-4 text-${themeColor}-600`} /> Visits by Location
                <InfoTooltip content="Total member check-ins per location within the selected date range." className="ml-1" />
              </h3>
              {data.visits_by_location.length === 0 ? (
                <p className="text-sm text-gray-500">No data.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {data.visits_by_location.map((v) => (
                    <li key={v.location_id} className="flex justify-between py-2">
                      <span className="text-gray-700">{v.location_name || `Location #${v.location_id}`}</span>
                      <span className="font-semibold text-gray-900">{v.visits}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={cardCls}>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" /> Revenue
                <InfoTooltip content="Sum of all successfully captured membership payments (initial purchases + renewals) in range. Refunds are not subtracted." className="ml-1" />
              </h3>
              <p className="text-xs text-gray-500 mb-1">
                {new Date(data.date_range.from).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                {' → '}
                {new Date(data.date_range.to).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-3xl font-bold text-green-700">{formatMembershipPrice(data.revenue_in_range)}</p>
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                {data.failed_payments} failed payments in range
                <InfoTooltip content="Payment attempts that returned a declined/error response from the gateway. These trigger past-due status and retry scheduling." />
              </p>
            </div>
            <div className={cardCls}>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Activity className={`w-4 h-4 text-${themeColor}-600`} /> Underused Memberships
                <InfoTooltip content="Active members with abnormally low visit counts for the current term — good candidates for retention outreach before they churn." className="ml-1" />
              </h3>
              {data.underused_sample.length === 0 ? (
                <p className="text-sm text-gray-500">No underused samples.</p>
              ) : (
                <ul className="text-sm divide-y divide-gray-100">
                  {data.underused_sample.map((u) => (
                    <li key={u.id} className="flex justify-between py-2">
                      <span className="text-gray-700">Membership #{u.id} (cust {u.customer_id})</span>
                      <span className="text-xs text-gray-500">{u.visits_used_this_term} visits</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MembershipReports;
