// src/components/invitations/InvitationTracker.tsx

import { useState, useEffect } from 'react';
import type { Invitation, InvitationSummary } from '../../types/invitation.types';
import invitationService from '../../services/invitationService';

interface Props {
  bookingId: number;
  participants: number;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const InvitationTracker = ({ bookingId, participants, onToast }: Props) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [summary, setSummary] = useState<InvitationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const res = await invitationService.getInvitations(bookingId);
      setInvitations(res.invitations);
      setSummary(res.summary);
    } catch {
      // No invitations yet — that's fine
      setInvitations([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const handleResend = async (invitationId: number) => {
    setResending(invitationId);
    try {
      await invitationService.resendInvitation(bookingId, invitationId);
      await loadInvitations();
      onToast?.('Invitation resent successfully', 'success');
    } catch {
      onToast?.('Failed to resend invitation', 'error');
    } finally {
      setResending(null);
    }
  };

  const handleDelete = async (invitationId: number) => {
    try {
      await invitationService.deleteInvitation(bookingId, invitationId);
      setConfirmDeleteId(null);
      await loadInvitations();
      onToast?.('Invitation cancelled', 'success');
    } catch {
      onToast?.('Failed to cancel invitation', 'error');
      setConfirmDeleteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'attending':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
        <span className="block w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Loading invitations…
      </div>
    );
  }

  if (!summary || summary.total_invited === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-500 text-center">
        No invitations sent yet. Click &quot;Invitations&quot; to invite your guests.
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Summary Header */}
      <div className="p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900 text-sm">Invitation Tracker</h4>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-700 hover:text-blue-800 font-medium transition"
          >
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-blue-50 rounded-lg p-2.5">
            <div className="text-lg font-bold text-blue-800">{summary.total_invited}</div>
            <div className="text-[11px] text-gray-500 font-medium">Invited</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2.5">
            <div className="text-lg font-bold text-emerald-700">{summary.attending}</div>
            <div className="text-[11px] text-gray-500 font-medium">Attending</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2.5">
            <div className="text-lg font-bold text-red-600">{summary.declined}</div>
            <div className="text-[11px] text-gray-500 font-medium">Declined</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2.5">
            <div className="text-lg font-bold text-amber-600">{summary.pending}</div>
            <div className="text-[11px] text-gray-500 font-medium">Pending</div>
          </div>
        </div>

        {/* Capacity */}
        <div className="mt-2.5 text-xs text-gray-400">
          {summary.remaining_slots} slot{summary.remaining_slots !== 1 ? 's' : ''} remaining of {participants} total
        </div>
      </div>

      {/* Detailed List */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {invitations.map(inv => (
              <div key={inv.id} className="px-4 py-3 hover:bg-gray-50/50 transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{inv.guest_name}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${getStatusBadge(inv.rsvp_status)}`}>
                        {inv.rsvp_status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 flex flex-wrap items-center gap-x-2">
                      {inv.guest_email && <span>{inv.guest_email}</span>}
                      {inv.guest_phone && <span>{inv.guest_phone}</span>}
                      <span className="capitalize">{inv.send_via === 'both' ? 'Email & Text' : inv.send_via}</span>
                      {inv.rsvp_guest_count ? <span>{inv.rsvp_guest_count} guest{inv.rsvp_guest_count !== 1 ? 's' : ''}</span> : null}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {inv.rsvp_status === 'pending' && confirmDeleteId !== inv.id && (
                      <>
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={resending === inv.id}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          {resending === inv.id ? (
                            <span className="flex items-center gap-1"><span className="block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Sending</span>
                          ) : 'Resend'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(inv.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {confirmDeleteId === inv.id && (
                      <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2.5 py-1">
                        <span className="text-[11px] text-red-700 font-medium">Cancel invite?</span>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-[11px] font-bold text-red-700 hover:text-red-900 transition"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] font-bold text-gray-500 hover:text-gray-700 transition"
                        >
                          No
                        </button>
                      </div>
                    )}
                    {inv.rsvp_status !== 'pending' && inv.responded_at && (
                      <span className="text-[11px] text-gray-400">
                        {new Date(inv.responded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationTracker;
