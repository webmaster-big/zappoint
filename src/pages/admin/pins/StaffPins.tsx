import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Lock, Monitor, RefreshCw, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useLocationScope } from '../../../contexts/LocationContext';
import { getDeviceId } from '../../../utils/deviceId';
import { getStoredTerminal, setStoredTerminal, clearStoredTerminal } from '../../../utils/staffTerminal';
import {
  getRoster,
  issuePin,
  clearPin,
  unlockPin,
  listTerminals,
  enrollTerminal,
  updateTerminal,
  revokeTerminal,
} from '../../../services/StaffPinService';
import type { RosterEntry, TerminalRecord } from '../../../services/StaffPinService';

const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Administrator',
  location_manager: 'Location manager',
  attendant: 'Attendant',
};

const PIN_LENGTH = 6;

const StaffPins: React.FC = () => {
  const { effectiveLocationId, locations } = useLocationScope();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [terminals, setTerminals] = useState<TerminalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pinTarget, setPinTarget] = useState<RosterEntry | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [terminalLabel, setTerminalLabel] = useState('Front desk');
  const [idleDrafts, setIdleDrafts] = useState<Record<number, string>>({});

  const thisDevice = useMemo(() => getStoredTerminal(), []);
  const deviceId = useMemo(() => getDeviceId(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staff, devices] = await Promise.all([getRoster(), listTerminals()]);
      setRoster(staff);
      setTerminals(devices);
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBanner({ tone: 'bad', text: message || 'Could not load PIN settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    setSaving(true);
    setBanner(null);
    try {
      await fn();
      setBanner({ tone: 'ok', text: okText });
      await load();
      return true;
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setBanner({ tone: 'bad', text: message || 'That did not work.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitPin = async () => {
    if (!pinTarget) return;
    if (!/^\d{6}$/.test(pinValue)) {
      setBanner({ tone: 'bad', text: `The PIN must be ${PIN_LENGTH} digits.` });
      return;
    }
    const ok = await act(() => issuePin(pinTarget.id, pinValue), `PIN set for ${pinTarget.name}.`);
    if (ok) {
      setPinTarget(null);
      setPinValue('');
    }
  };

  const enrollThisDevice = async () => {
    const locationId = effectiveLocationId ?? locations[0]?.id;
    if (!locationId) {
      setBanner({ tone: 'bad', text: 'Choose a location before setting this device up.' });
      return;
    }
    await act(async () => {
      const result = await enrollTerminal({ label: terminalLabel, locationId });
      setStoredTerminal({
        deviceId,
        token: result.token,
        label: result.terminal.label,
        locationId: result.terminal.location_id,
      });
    }, 'This device is now a shared terminal.');
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Employee PINs &amp; shared terminals</h1>
        <p className="mt-1 text-sm text-gray-600">
          Staff tap a PIN to identify themselves on a shared machine. Everything they do is recorded under their
          own name, and the terminal returns to the PIN screen when it is left alone.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">This device</h2>
        </div>

        {thisDevice ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-4">
            <div>
              <p className="font-medium text-gray-900">{thisDevice.label}</p>
              <p className="text-sm text-gray-600">Set up as a shared terminal. It will lock when left idle.</p>
            </div>
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={() => {
                clearStoredTerminal();
                window.location.reload();
              }}
            >
              Stop using this device as a terminal
            </StandardButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="terminal-label">
                Name this terminal
              </label>
              <input
                id="terminal-label"
                value={terminalLabel}
                onChange={(event) => setTerminalLabel(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                placeholder="Front desk"
              />
            </div>
            <StandardButton onClick={enrollThisDevice} loading={saving} icon={ShieldCheck}>
              Set this device up
            </StandardButton>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Only devices set up here ever lock. A personal laptop or phone is left alone.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Employee PINs</h2>
          </div>
          <StandardButton variant="ghost" size="sm" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </StandardButton>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">PIN</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roster.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{entry.name}</p>
                      <p className="text-xs text-gray-500">{entry.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{ROLE_LABELS[entry.role] ?? entry.role}</td>
                    <td className="py-3 pr-4">
                      {entry.locked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : entry.has_pin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Set
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Not set</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <StandardButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPinTarget(entry);
                            setPinValue('');
                          }}
                        >
                          {entry.has_pin ? 'Reset PIN' : 'Set PIN'}
                        </StandardButton>
                        {entry.locked && (
                          <StandardButton
                            size="sm"
                            variant="secondary"
                            icon={Unlock}
                            onClick={() => void act(() => unlockPin(entry.id), `${entry.name} can use their PIN again.`)}
                          >
                            Unlock
                          </StandardButton>
                        )}
                        {entry.has_pin && (
                          <StandardButton
                            size="sm"
                            variant="danger"
                            icon={Trash2}
                            onClick={() => void act(() => clearPin(entry.id), `PIN removed for ${entry.name}.`)}
                          >
                            Remove
                          </StandardButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                      No staff to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Automatic logout</h2>
        </div>

        {terminals.length === 0 ? (
          <p className="text-sm text-gray-500">No shared terminals have been set up yet.</p>
        ) : (
          <div className="space-y-3">
            {[...terminals]
              .sort((a, b) => Number(b.device_id === deviceId) - Number(a.device_id === deviceId))
              .map((terminal) => (
              <div key={terminal.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 p-4">
                <div className="min-w-[160px] flex-1">
                  <p className="flex items-center gap-2 font-medium text-gray-900">
                    {terminal.label}
                    {terminal.device_id === deviceId && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{terminal.location?.name ?? `Location ${terminal.location_id}`}</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor={`idle-${terminal.id}`}>
                    Lock after (seconds)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`idle-${terminal.id}`}
                      type="number"
                      min={15}
                      max={3600}
                      value={idleDrafts[terminal.id] ?? String(terminal.idle_seconds ?? 60)}
                      disabled={terminal.idle_disabled}
                      onChange={(event) =>
                        setIdleDrafts((drafts) => ({ ...drafts, [terminal.id]: event.target.value }))
                      }
                      className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    <StandardButton
                      size="sm"
                      variant="secondary"
                      disabled={terminal.idle_disabled}
                      onClick={() =>
                        void act(async () => {
                          const next = Number(idleDrafts[terminal.id] ?? terminal.idle_seconds ?? 60);
                          await updateTerminal(terminal.id, { idle_seconds: next });
                          setIdleDrafts((drafts) => {
                            const copy = { ...drafts };
                            delete copy[terminal.id];
                            return copy;
                          });
                        }, 'Automatic logout time saved.')
                      }
                    >
                      Save
                    </StandardButton>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={terminal.idle_disabled}
                    onChange={(event) =>
                      void act(
                        () => updateTerminal(terminal.id, { idle_disabled: event.target.checked }),
                        event.target.checked ? 'Automatic logout turned off.' : 'Automatic logout turned on.'
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Turn automatic logout off
                </label>

                <StandardButton
                  size="sm"
                  variant="danger"
                  onClick={() => void act(() => revokeTerminal(terminal.id), `${terminal.label} removed.`)}
                >
                  Remove
                </StandardButton>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">
          Turning automatic logout off applies to attendants. A manager or administrator signed in with a PIN is
          always returned to the PIN screen, so their access cannot be left open behind them.
        </p>
      </section>

      {pinTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={() => setPinTarget(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">
              {pinTarget.has_pin ? 'Reset' : 'Set'} PIN for {pinTarget.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Choose {PIN_LENGTH} digits. Nobody can read it back afterwards, so write it down for them now.
            </p>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={pinValue}
              onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.5em] focus:border-gray-500 focus:outline-none"
              placeholder="••••••"
            />
            <div className="mt-5 flex justify-end gap-2">
              <StandardButton variant="secondary" onClick={() => setPinTarget(null)}>
                Cancel
              </StandardButton>
              <StandardButton onClick={() => void submitPin()} loading={saving}>
                Save PIN
              </StandardButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPins;
