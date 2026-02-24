// src/components/invitations/InvitationTracker.tsx

import { useState, useEffect } from 'react';
import type { Invitation, InvitationSummary } from '../../types/invitation.types';
import invitationService from '../../services/invitationService';

interface Props {
  bookingId: number;
  participants: number;
}

const InvitationTracker = ({ bookingId, participants }: Props) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [summary, setSummary] = useState<InvitationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

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
    } catch {
      alert('Failed to resend invitation');
    } finally {
      setResending(null);
    }
  };

  const handleDelete = async (invitationId: number) => {
    if (!confirm('Cancel this invitation?')) return;
    try {
      await invitationService.deleteInvitation(bookingId, invitationId);
      await loadInvitations();
    } catch {
      alert('Failed to cancel invitation');
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
      <div className="text-sm text-gray-500 py-2">Loading invitation data...</div>
    );
  }

  if (!summary || summary.total_invited === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 p-3 text-sm text-gray-500">
        No invitations sent yet. Click "Send Invitations" to invite your guests.
      </div>
    );
  }

  return (
    <div className="border border-gray-200">
      {/* Summary Header */}
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900 text-sm">Invitation Tracker</h4>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-800 hover:underline"
          >
            {expanded ? 'Hide Details' : 'View Details'}
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-blue-50 p-2">
            <div className="text-lg font-bold text-blue-800">{summary.total_invited}</div>
            <div className="text-xs text-gray-600">Invited</div>
          </div>
          <div className="bg-green-50 p-2">
            <div className="text-lg font-bold text-green-700">{summary.attending}</div>
            <div className="text-xs text-gray-600">Attending</div>
          </div>
          <div className="bg-red-50 p-2">
            <div className="text-lg font-bold text-red-700">{summary.declined}</div>
            <div className="text-xs text-gray-600">Declined</div>
          </div>
          <div className="bg-yellow-50 p-2">
            <div className="text-lg font-bold text-yellow-700">{summary.pending}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
        </div>

        {/* Capacity */}
        <div className="mt-2 text-xs text-gray-500">
          {summary.remaining_slots} invitation slot{summary.remaining_slots !== 1 ? 's' : ''} remaining out of {participants} total
        </div>
      </div>

      {/* Detailed List */}
      {expanded && (
        <div className="border-t border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Guest</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Sent Via</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Party Size</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invitations.map(inv => (
                <tr key={inv.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{inv.guest_name}</div>
                    <div className="text-xs text-gray-500">
                      {inv.guest_email && <span>{inv.guest_email}</span>}
                      {inv.guest_email && inv.guest_phone && <span> / </span>}
                      {inv.guest_phone && <span>{inv.guest_phone}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 capitalize">{inv.send_via === 'both' ? 'Email & Text' : inv.send_via}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 text-xs font-medium border capitalize ${getStatusBadge(inv.rsvp_status)}`}>
                      {inv.rsvp_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {inv.rsvp_guest_count ? `${inv.rsvp_guest_count} guest${inv.rsvp_guest_count !== 1 ? 's' : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {inv.rsvp_status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={resending === inv.id}
                          className="text-xs text-blue-700 hover:text-blue-900 disabled:opacity-50"
                        >
                          {resending === inv.id ? 'Sending...' : 'Resend'}
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {inv.rsvp_status !== 'pending' && inv.responded_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(inv.responded_at).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvitationTracker;
