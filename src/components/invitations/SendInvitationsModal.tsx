// src/components/invitations/SendInvitationsModal.tsx

import { useState, useEffect } from 'react';
import type { Booking } from '../../services/bookingService';
import type { InvitationGuest, InvitationPreviewResponse } from '../../types/invitation.types';
import invitationService from '../../services/invitationService';
import { convertTo12Hour } from '../../utils/timeFormat';

interface Props {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface GuestRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  send_via: 'email' | 'text' | 'both';
  errors: { name?: string; email?: string; phone?: string };
}

const createEmptyRow = (): GuestRow => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
  phone: '',
  send_via: 'email',
  errors: {},
});

const SendInvitationsModal = ({ booking, onClose, onSuccess, onToast }: Props) => {
  const [guests, setGuests] = useState<GuestRow[]>([createEmptyRow()]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const maxGuests = booking.participants;

  // Load existing invitation count
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const res = await invitationService.getInvitations(booking.id);
        setExistingCount(res.summary.total_invited);
      } catch {
        // First time — no invitations yet
        setExistingCount(0);
      }
    };
    loadExisting();
  }, [booking.id]);

  const remainingSlots = maxGuests - existingCount;

  const updateGuest = (id: string, field: keyof GuestRow, value: string) => {
    setGuests(prev =>
      prev.map(g => (g.id === id ? { ...g, [field]: value, errors: { ...g.errors, [field]: undefined } } : g))
    );
  };

  const addGuestRow = () => {
    if (guests.length < remainingSlots) {
      setGuests(prev => [...prev, createEmptyRow()]);
    }
  };

  const removeGuestRow = (id: string) => {
    if (guests.length > 1) {
      setGuests(prev => prev.filter(g => g.id !== id));
    }
  };

  const validateGuests = (): boolean => {
    let valid = true;
    const updated = guests.map(g => {
      const errors: GuestRow['errors'] = {};

      if (!g.name.trim()) {
        errors.name = 'Name is required';
        valid = false;
      }

      if (g.send_via === 'email' || g.send_via === 'both') {
        if (!g.email.trim()) {
          errors.email = 'Email is required for email invitations';
          valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) {
          errors.email = 'Invalid email address';
          valid = false;
        }
      }

      if (g.send_via === 'text' || g.send_via === 'both') {
        if (!g.phone.trim()) {
          errors.phone = 'Phone is required for text invitations';
          valid = false;
        }
      }

      return { ...g, errors };
    });

    setGuests(updated);
    return valid;
  };

  const handleSend = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!validateGuests()) return;

    if (guests.length > remainingSlots) {
      setError(`You can only send ${remainingSlots} more invitation(s). You have ${guests.length} guests entered.`);
      return;
    }

    setSending(true);
    try {
      const payload: InvitationGuest[] = guests.map(g => ({
        name: g.name.trim(),
        email: g.email.trim() || null,
        phone: g.phone.trim() || null,
        send_via: g.send_via,
      }));

      const res = await invitationService.sendInvitations(booking.id, { guests: payload });

      setSuccessMessage(res.message);
      onToast?.(res.message || `${guests.length} invitation${guests.length !== 1 ? 's' : ''} sent!`, 'success');
      onSuccess();
      // Close after brief delay so user sees success message
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to send invitations';
      setError(errMsg);
      onToast?.(errMsg, 'error');
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await invitationService.getPreview(booking.id);
      setPreview(res);
      setShowPreview(true);
    } catch {
      setError('Failed to load preview');
      onToast?.('Failed to load preview', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const pkg = booking.package as any;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-900 via-blue-800 to-violet-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'white' }}>Send Party Invitations</h3>
              <p className="text-sm text-blue-200/70 mt-0.5">
                {pkg?.name} — {booking.booking_date} at {convertTo12Hour(booking.booking_time)}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition text-white">
              ✕
            </button>
          </div>
        </div>

        {/* Capacity Bar */}
        <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Invitation Capacity</span>
            <span className="text-sm text-gray-500">
              {existingCount} sent / {maxGuests} total
              {remainingSlots > 0 && (
                <span className="text-emerald-600 font-medium ml-2">({remainingSlots} remaining)</span>
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-700 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(((existingCount + guests.length) / maxGuests) * 100, 100)}%` }}
            />
          </div>
          {existingCount + guests.length > maxGuests && (
            <p className="text-xs text-red-600 mt-1">
              Warning: You are trying to invite more guests than your booking allows.
            </p>
          )}
        </div>

        {/* Guest Entry Rows */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          {guests.map((guest, index) => (
            <div key={guest.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Guest #{index + 1}</span>
                {guests.length > 1 && (
                  <button
                    onClick={() => removeGuestRow(guest.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    type="text"
                    value={guest.name}
                    onChange={e => updateGuest(guest.id, 'name', e.target.value)}
                    placeholder="Guest name"
                    className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      guest.errors.name ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {guest.errors.name && (
                    <p className="text-xs text-red-600 mt-1">{guest.errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email {guest.send_via !== 'text' ? '*' : ''}
                  </label>
                  <input
                    type="email"
                    value={guest.email}
                    onChange={e => updateGuest(guest.id, 'email', e.target.value)}
                    placeholder="email@example.com"
                    className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      guest.errors.email ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {guest.errors.email && (
                    <p className="text-xs text-red-600 mt-1">{guest.errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone {guest.send_via !== 'email' ? '*' : ''}
                  </label>
                  <input
                    type="tel"
                    value={guest.phone}
                    onChange={e => updateGuest(guest.id, 'phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      guest.errors.phone ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {guest.errors.phone && (
                    <p className="text-xs text-red-600 mt-1">{guest.errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Send Via */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Send via</label>
                <div className="flex gap-4">
                  {(['email', 'text', 'both'] as const).map(method => (
                    <label key={method} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`send_via_${guest.id}`}
                        value={method}
                        checked={guest.send_via === method}
                        onChange={() => updateGuest(guest.id, 'send_via', method)}
                        className="text-blue-700 focus:ring-blue-700"
                      />
                      <span className="text-sm text-gray-700 capitalize">{method === 'both' ? 'Email & Text' : method}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Add Guest Button */}
          {guests.length < remainingSlots && (
            <button
              onClick={addGuestRow}
              className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-700 transition"
            >
              + Add Another Guest
            </button>
          )}

          {/* Package Invitation Note */}
          {pkg?.invitation_file && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              <span className="font-medium">Note:</span> This package has a designed invitation file that will be
              attached to email invitations automatically.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handlePreview}
            disabled={loadingPreview}
            className="px-4 py-2 text-sm border border-blue-200 text-blue-700 font-medium rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
          >
            {loadingPreview ? 'Loading...' : 'Preview Invitation'}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || guests.length === 0 || remainingSlots <= 0}
            className="flex-1 px-4 py-2 text-sm bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sending…
              </span>
            ) : `Send ${guests.length} Invitation${guests.length !== 1 ? 's' : ''}`}
          </button>
        </div>

        {/* Preview Modal (nested) */}
        {showPreview && preview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={() => setShowPreview(false)}>
            <div className="bg-white max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-base font-semibold text-gray-900">Invitation Preview</h4>
                <button onClick={() => setShowPreview(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Email Preview */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Email Preview</h5>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-sm border-b border-gray-100">
                      <strong>Subject:</strong> {preview.subject}
                    </div>
                    <div
                      className="p-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  </div>
                  {preview.has_invitation_file && (
                    <p className="text-xs text-gray-500 mt-1">
                      A party invitation file will be attached to emails.
                    </p>
                  )}
                </div>

                {/* Invitation Download Link */}
                {preview.has_invitation_download_link && (
                  <p className="text-xs text-gray-500">
                    The RSVP page will include a "Download Party Invitation" button.
                  </p>
                )}
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-full px-4 py-2 text-sm bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendInvitationsModal;
