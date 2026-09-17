import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { verifyOverridePin } from '../../../services/OverridePinService';

interface OverlapOverrideDialogProps {
  conflicts: string[];
  onlineSlotsLost: string[];
  locationId: number | null;
  onCancel: () => void;
  onConfirm: () => void;
  onApproved: (token: string, approvedBy: string) => void;
}

/** Shows what the booking runs into and takes a manager's PIN before it can be saved. */
const OverlapOverrideDialog: React.FC<OverlapOverrideDialogProps> = ({
  conflicts,
  onlineSlotsLost,
  locationId,
  onCancel,
  onConfirm,
  onApproved,
}) => {
  // a manager is only needed for a real overlap; taking the last online slot is staff's own call
  const needsManager = conflicts.length > 0;
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!locationId) {
      setError('This booking has no location yet, so it cannot be approved.');
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const approval = await verifyOverridePin(pin, locationId, conflicts.join(' '));
      onApproved(approval.token, approval.approved_by);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'That PIN could not be checked. Try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <AlertCircle className={`mt-0.5 h-6 w-6 shrink-0 ${needsManager ? 'text-rose-500' : 'text-amber-500'}`} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {needsManager ? 'This booking overlaps something already in the space' : 'Check this before you save'}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {needsManager
                  ? 'A manager has to approve it before it can be saved.'
                  : 'Nothing is double-booked, but this changes what customers can still book.'}
              </p>
            </div>
          </div>

          {conflicts.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {conflicts.map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          {onlineSlotsLost.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                {onlineSlotsLost.length === 1 ? 'One online start time goes away' : `${onlineSlotsLost.length} online start times go away`}
              </p>
              <p className="mt-1">
                This holds the last free space through {onlineSlotsLost.join(', ')}, so customers will no longer be
                able to book {onlineSlotsLost.length === 1 ? 'it' : 'them'} online.
              </p>
            </div>
          )}

          {!needsManager && (
            <div className="mt-5 flex justify-end gap-2">
              <StandardButton variant="secondary" size="md" onClick={onCancel}>
                Cancel
              </StandardButton>
              <StandardButton variant="primary" size="md" onClick={onConfirm}>
                Save the booking
              </StandardButton>
            </div>
          )}

          {needsManager && (
          <>
          <label className="block text-sm font-medium text-gray-700" htmlFor="override-pin">
            Manager override PIN
          </label>
          <input
            id="override-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={event => {
              if (event.key === 'Enter' && pin.length >= 4 && !checking) void submit();
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-lg tracking-[0.4em] focus:border-gray-500 focus:outline-none"
            placeholder="••••"
          />

          {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <StandardButton variant="secondary" size="md" onClick={onCancel} disabled={checking}>
              Cancel
            </StandardButton>
            <StandardButton
              variant="primary"
              size="md"
              onClick={() => void submit()}
              disabled={pin.length < 4 || checking}
            >
              {checking ? 'Checking…' : 'Approve and save'}
            </StandardButton>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverlapOverrideDialog;
