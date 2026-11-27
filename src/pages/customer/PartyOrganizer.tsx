import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Gift, MapPin, PartyPopper } from 'lucide-react';
import partyOrganizerService, {
  partyErrorMessage,
  partyErrorStatus,
  type PartyGuest,
  type PartyOrganizerView,
} from '../../services/PartyOrganizerService';
import customerService from '../../services/CustomerService';
import { membershipCache } from '../../services/MembershipCacheService';
import EmailInput from '../../components/ui/EmailInput';
import { convertTo12Hour, formatDateLong } from '../../utils/timeFormat';
import { formatPhoneForDisplay } from '../../utils/bookingSearch';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GUEST_COLUMNS = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]';

interface GuestRow {
  name: string;
  email: string;
  phone: string;
}

const emptyRow = (): GuestRow => ({ name: '', email: '', phone: '' });

const invitationStyles: Record<string, string> = {
  'Invite sent': 'bg-white text-blue-700 border-blue-300',
  'Not sent yet': 'bg-white text-gray-600 border-gray-300',
  'Not delivered': 'bg-white text-red-700 border-red-300',
};

const waiverStyles: Record<string, string> = {
  Signed: 'bg-white text-emerald-700 border-emerald-300',
  'Not signed yet': 'bg-white text-amber-700 border-amber-300',
};

const storedCustomerToken = (): string | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    return stored ? JSON.parse(stored)?.token || null : null;
  } catch {
    return null;
  }
};

const PartyOrganizer = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const linkKey = searchParams.get('k');
  const id = Number(bookingId);
  const returnPath = `${location.pathname}${location.search}`;

  const [view, setView] = useState<PartyOrganizerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rows, setRows] = useState<GuestRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<GuestRow>(emptyRow());
  const [savingEdit, setSavingEdit] = useState(false);
  const [switching, setSwitching] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendToSignIn = useCallback(() => {
    localStorage.removeItem('zapzone_customer');
    window.location.assign(`/customer/login?next=${encodeURIComponent(returnPath)}`);
  }, [returnPath]);

  const reload = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setLoadError({ message: 'This party link is not complete. Open the link in your booking confirmation email.' });
      setLoading(false);
      return;
    }
    try {
      setView(await partyOrganizerService.get(id, linkKey));
      setLoadError(null);
    } catch (err) {
      if (partyErrorStatus(err) === 401) {
        sendToSignIn();
        return;
      }
      setLoadError({
        status: partyErrorStatus(err),
        message: partyErrorMessage(err, 'We could not load this party. Please try again, or open the link in your booking confirmation email.'),
      });
    } finally {
      setLoading(false);
    }
  }, [id, linkKey, sendToSignIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const flash = (type: 'success' | 'error', text: string) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ type, text });
    bannerTimer.current = setTimeout(() => setBanner(null), text.length > 90 ? 10000 : 5000);
  };

  const actionFailed = (err: unknown, fallback: string) => {
    if (partyErrorStatus(err) === 401) {
      sendToSignIn();
      return;
    }
    flash('error', partyErrorMessage(err, fallback));
  };

  const updateRow = (index: number, field: keyof GuestRow, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleAddGuests = async () => {
    const filled = rows
      .map((row) => ({ name: row.name.trim(), email: row.email.trim(), phone: row.phone.trim() }))
      .filter((row) => row.name || row.email || row.phone);

    if (filled.length === 0) {
      flash('error', 'Add at least one guest with an email address or a mobile number.');
      return;
    }
    if (filled.some((row) => !row.email && !row.phone)) {
      flash('error', 'Add an email address or a mobile number for each guest.');
      return;
    }
    if (filled.some((row) => row.email && !EMAIL_PATTERN.test(row.email))) {
      flash('error', 'One of the email addresses is not complete. Check it and try again.');
      return;
    }

    setSaving(true);
    try {
      const result = await partyOrganizerService.addGuests(
        id,
        filled.map((row) => ({ name: row.name || undefined, email: row.email || undefined, phone: row.phone || undefined })),
        linkKey,
      );
      flash(result.needsAttention ? 'error' : 'success', result.message || 'Guests added.');
      setRows([emptyRow()]);
      await reload();
    } catch (err) {
      actionFailed(err, 'We could not add these guests. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (guest: PartyGuest) => {
    setResendingId(guest.id);
    try {
      const result = await partyOrganizerService.resend(id, guest.id, linkKey);
      flash('success', result.message || 'Invite sent.');
    } catch (err) {
      actionFailed(err, 'We could not send this invite. Please try again.');
    } finally {
      setResendingId(null);
      await reload();
    }
  };

  const startEdit = (guest: PartyGuest) => {
    setEditingId(guest.id);
    setEditRow({ name: guest.name || '', email: guest.email || '', phone: formatPhoneForDisplay(guest.phone) || guest.phone || '' });
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const name = editRow.name.trim();
    const email = editRow.email.trim();
    const phone = editRow.phone.trim();
    if (!email && !phone) {
      flash('error', 'Add an email address or a mobile number.');
      return;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      flash('error', 'This email address is not complete. Check it and try again.');
      return;
    }
    setSavingEdit(true);
    try {
      const result = await partyOrganizerService.update(id, editingId, { name, email, phone }, linkKey);
      flash(result.success ? 'success' : 'error', result.message || 'Saved.');
      setEditingId(null);
      await reload();
    } catch (err) {
      actionFailed(err, 'We could not save these details. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const switchAccount = async () => {
    setSwitching(true);
    const token = storedCustomerToken();
    if (token) await customerService.logout(token).catch(() => undefined);
    await membershipCache.invalidate().catch(() => undefined);
    sendToSignIn();
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Loading your party">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="min-h-[60vh] px-4 py-16">
        <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
          <PartyPopper className="w-8 h-8 text-blue-700 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Party invitations and waivers</h1>
          <p className="text-sm text-gray-600" data-testid="party-error">
            {loadError?.message ?? 'We could not load this party. Please try again.'}
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            {loadError?.status === 403 && (
              <button
                type="button"
                onClick={switchAccount}
                disabled={switching}
                className="px-4 py-2 whitespace-nowrap bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
              >
                {switching ? 'Signing out…' : 'Sign in with a different account'}
              </button>
            )}
            <Link
              to="/customer/reservations"
              className="px-4 py-2 whitespace-nowrap bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
            >
              Go to My Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { booking, guests, summary } = view;
  const canChange = !booking.cancelled;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-6 md:py-8 overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/10 rounded-lg border border-white/10">
              <PartyPopper className="w-3.5 h-3.5" />
            </div>
            <span className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest">Party</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'white' }}>
            Party invitations and waivers
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-100">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateLong(booking.booking_date)}
            </span>
            {booking.booking_time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {convertTo12Hour(booking.booking_time)}
              </span>
            )}
            {booking.location_name && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {booking.location_name}
              </span>
            )}
            {booking.guest_of_honor_name && (
              <span className="inline-flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5" />
                Guest of honor: {booking.guest_of_honor_name}
              </span>
            )}
          </div>
          <p className="text-blue-200/70 text-xs mt-2">
            {booking.package_name ? `${booking.package_name} · ` : ''}Booking {booking.reference_number}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {banner && (
          <div
            role="status"
            data-testid="party-banner"
            className={`rounded-lg px-4 py-2.5 text-sm font-medium bg-white border ${
              banner.type === 'success' ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'
            }`}
          >
            {banner.text}
          </div>
        )}

        {booking.cancelled && (
          <div className="rounded-lg px-4 py-2.5 text-sm bg-white border border-red-300 text-red-700">
            This booking was cancelled, so no more invitations can be sent.
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid grid-cols-3 gap-3 text-center">
          {([
            ['Added', summary.added, 'text-gray-900'],
            ['Signed', summary.signed, 'text-emerald-600'],
            ['Not signed yet', summary.not_signed, 'text-amber-600'],
          ] as const).map(([label, value, color]) => (
            <div key={label}>
              <p className={`text-2xl font-bold ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {summary.not_delivered > 0 && canChange && (
          <div className="rounded-lg px-4 py-2.5 text-sm bg-white border border-red-300 text-red-700">
            {summary.not_delivered === 1 ? '1 invite could not be delivered.' : `${summary.not_delivered} invites could not be delivered.`} Use Edit next to their name to fix the email address or mobile number.
          </div>
        )}

        {canChange && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Invite guests</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Add each adult, or the parent or guardian of each child. Everyone you add gets an invitation with their waiver link right away.
              </p>
            </div>
            <div className="p-5 space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(index, 'name', e.target.value)}
                    className={inputClass}
                    placeholder="Name"
                    aria-label={`Guest ${index + 1} name`}
                  />
                  <EmailInput
                    value={row.email}
                    onChange={(e) => updateRow(index, 'email', e.target.value)}
                    className={inputClass}
                    placeholder="Email"
                    aria-label={`Guest ${index + 1} email`}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={row.phone}
                    onChange={(e) => updateRow(index, 'phone', e.target.value)}
                    className={inputClass}
                    placeholder="Mobile number (US/Canada)"
                    aria-label={`Guest ${index + 1} mobile number`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                    className={`${rows.length === 1 ? 'hidden sm:block sm:invisible' : ''} justify-self-start text-xs font-semibold text-red-600 hover:text-red-700 transition px-2 py-1`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition"
              >
                + Add another guest
              </button>
              <button
                type="button"
                onClick={handleAddGuests}
                disabled={saving}
                className="w-full py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
              >
                {saving ? 'Adding & sending…' : 'Add & Send Invites'}
              </button>
              <p className="text-[11px] text-gray-500 text-center">Texts go to US and Canadian mobile numbers only.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5">
            <h2 className="text-sm font-bold text-gray-900">Your party guests</h2>
          </div>
          {guests.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8 border-t border-gray-100">No guests added yet.</p>
          ) : (
            <div>
              <div className={`hidden sm:grid ${GUEST_COLUMNS} gap-4 px-5 py-2 border-t border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-500`}>
                <span>Guest</span>
                <span>Invitation status</span>
                <span>Waiver status</span>
                <span className="sr-only">Actions</span>
              </div>
              {guests.map((guest) => (
                <div key={guest.id} className="px-5 py-3 border-t border-gray-100" data-guest-id={guest.id}>
                  <div className={`grid grid-cols-1 ${GUEST_COLUMNS} gap-2 sm:gap-4 sm:items-center`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{guest.name || 'No name given'}</p>
                      {!guest.signed && (guest.email || guest.phone) && (
                        <p className="text-xs text-gray-500 truncate">
                          {[guest.email, formatPhoneForDisplay(guest.phone) || guest.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {guest.not_delivered && canChange ? (
                        <p className="text-xs text-red-600">Use Edit to fix their email address or mobile number.</p>
                      ) : (
                        guest.resent_count > 0 && <p className="text-xs text-gray-400">Resent {guest.resent_count}×</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="sm:hidden w-28 shrink-0 text-xs text-gray-500">Invitation status</span>
                      <span
                        data-testid="invitation-status"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${invitationStyles[guest.invitation_status] ?? invitationStyles['Not sent yet']}`}
                      >
                        {guest.invitation_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="sm:hidden w-28 shrink-0 text-xs text-gray-500">Waiver status</span>
                      <span
                        data-testid="waiver-status"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${waiverStyles[guest.waiver_status] ?? waiverStyles['Not signed yet']}`}
                      >
                        {guest.waiver_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      {!guest.signed && canChange && (
                        <>
                          <button
                            type="button"
                            onClick={() => (editingId === guest.id ? setEditingId(null) : startEdit(guest))}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResend(guest)}
                            disabled={resendingId === guest.id}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition disabled:opacity-50"
                          >
                            {resendingId === guest.id ? 'Sending…' : guest.invitation_status === 'Not sent yet' ? 'Send' : 'Resend'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === guest.id && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={editRow.name}
                        onChange={(e) => setEditRow((prev) => ({ ...prev, name: e.target.value }))}
                        className={inputClass}
                        placeholder="Name"
                        aria-label="Name"
                      />
                      <EmailInput
                        value={editRow.email}
                        onChange={(e) => setEditRow((prev) => ({ ...prev, email: e.target.value }))}
                        className={inputClass}
                        placeholder="Email"
                        aria-label="Email"
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        value={editRow.phone}
                        onChange={(e) => setEditRow((prev) => ({ ...prev, phone: e.target.value }))}
                        className={inputClass}
                        placeholder="Mobile number (US/Canada)"
                        aria-label="Mobile number"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                          className="flex-1 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
                        >
                          {savingEdit ? 'Saving…' : 'Save & Send'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartyOrganizer;
