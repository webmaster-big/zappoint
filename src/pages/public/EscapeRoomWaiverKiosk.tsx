import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { KioskAd, WaiverSubmission } from '../../types/waiver.types';
import type {
  EscapeRoomFormContext,
  EscapeRoomGuestRoom,
  EscapeRoomGuestTime,
  EscapeRoomKioskContext,
} from '../../types/escapeRoom.types';
import escapeRoomService from '../../services/EscapeRoomService';
import WaiverFormBody from '../../components/waiver/WaiverFormBody';
import { WaiverShell, WaiverLoading } from '../../components/waiver/WaiverStates';
import WaiverSuccessModal from '../../components/waiver/WaiverSuccessModal';
import StaffReturnControl from '../../components/waiver/StaffReturnControl';
import RoomPreviewImage from '../../components/waiver/RoomPreviewImage';
import { parseLocalDate } from '../../utils/timeFormat';

const SUCCESS_HOLD_SECONDS = 25;
const RETRY_SECONDS = 30;
const ROOM_LIST_REFRESH_SECONDS = 300;
const PREVIEW_CHECK_SECONDS = 4;
const PREVIEW_CHECKS = 3;

type Phase = 'room' | 'time' | 'form';

const STEPS: Array<{ key: Phase; label: string }> = [
  { key: 'room', label: 'Room' },
  { key: 'time', label: 'Time' },
  { key: 'form', label: 'Waiver' },
];

const errorMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { message?: string } } };
  return e.response?.data?.message || fallback;
};

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

const dayLabel = (key: string): string =>
  parseLocalDate(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const openTimes = (times: EscapeRoomGuestTime[], keep?: string | null): EscapeRoomGuestTime[] =>
  times.filter((t) => !t.just_finished || (!!keep && t.time === keep));

const holdFor = (ad: KioskAd | null | undefined): number => (ad ? Math.max(SUCCESS_HOLD_SECONDS, 2 + ad.display_seconds) : SUCCESS_HOLD_SECONDS);

const refusedField = (err: unknown, field: string): boolean => {
  const e = err as { response?: { data?: { errors?: Record<string, unknown> } } };
  return !!e.response?.data?.errors?.[field];
};

const TimeGrid = ({ times, onPick }: { times: EscapeRoomGuestTime[]; onPick: (time: EscapeRoomGuestTime) => void }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    {times.map((t) => (
      <button
        key={t.time}
        type="button"
        onClick={() => onPick(t)}
        className="rounded-xl border-2 border-gray-200 bg-white px-3 py-4 text-center hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
      >
        <span className="block text-lg font-bold text-gray-900 tabular-nums">{t.label}</span>
        {t.in_progress && <span className="block text-[11px] font-semibold text-amber-700 mt-0.5">Started</span>}
      </button>
    ))}
  </div>
);

const EscapeRoomWaiverKiosk = () => {
  const { locationId: locationParam } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const staffLaunched = searchParams.get('staff') === '1';
  const kioskMode = staffLaunched || searchParams.get('kiosk') === '1';
  const locationId = Number(locationParam) || 0;
  const rawLinkDate = searchParams.get('date');
  const linkDate = rawLinkDate && DATE_PARAM.test(rawLinkDate) ? rawLinkDate : null;
  const linkRoom = searchParams.get('room');
  const linkTime = searchParams.get('time');
  const linkSig = searchParams.get('sig');
  const gameLink = useMemo(
    () =>
      linkDate
        ? {
            date: linkDate,
            ...(linkRoom ? { room: linkRoom } : {}),
            ...(linkTime ? { time: linkTime } : {}),
            ...(linkSig ? { sig: linkSig } : {}),
          }
        : null,
    [linkDate, linkRoom, linkTime, linkSig],
  );

  const [kiosk, setKiosk] = useState<EscapeRoomKioskContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkBroken, setLinkBroken] = useState(false);
  const [phase, setPhase] = useState<Phase>('room');
  const [room, setRoom] = useState<EscapeRoomGuestRoom | null>(null);
  const currentRoom = room;
  const [time, setTime] = useState<EscapeRoomGuestTime | null>(null);
  const [form, setForm] = useState<EscapeRoomFormContext | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [completedName, setCompletedName] = useState<string | undefined>(undefined);
  const [completedAd, setCompletedAd] = useState<KioskAd | null>(null);
  const [completedWaiverId, setCompletedWaiverId] = useState<number | null>(null);
  const [completedWaiverRef, setCompletedWaiverRef] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [linkSpent, setLinkSpent] = useState(false);
  const [previewChecks, setPreviewChecks] = useState(0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSequence = useRef(0);
  const stepSequence = useRef(0);
  const hasLoaded = useRef(false);

  const timeoutSeconds = kiosk?.settings?.inactivity_timeout_seconds ?? 120;

  const loadKiosk = useCallback(async (): Promise<EscapeRoomKioskContext | null> => {
    if (!locationId) {
      setLinkBroken(true);
      setError("This check-in link isn't right. Please scan the QR code at the escape-room desk again, or ask a team member.");
      setLoading(false);
      return null;
    }
    const sequence = ++loadSequence.current;
    try {
      const data = await escapeRoomService.getKiosk(locationId, gameLink);
      if (sequence !== loadSequence.current) return null;
      hasLoaded.current = true;
      setKiosk(data);
      setError(null);
      return data;
    } catch (err: unknown) {
      if (sequence === loadSequence.current && !hasLoaded.current) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setLinkBroken(status === 404);
        setError(
          status === 404
            ? "This check-in link isn't right. Please scan the QR code at the escape-room desk again, or ask a team member."
            : errorMessage(err, 'Escape-room check-in is not available right now.'),
        );
      }
      return null;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [locationId, gameLink]);

  useEffect(() => {
    loadKiosk();
  }, [loadKiosk]);

  const activeLink = kiosk && gameLink && kiosk.date === gameLink.date ? gameLink : null;
  const pinnedGame = !!kiosk && (!!kiosk.ahead || (!!kiosk.today && kiosk.date !== kiosk.today));
  const linkedTime = (roomId: number): string | null =>
    activeLink && (!kioskMode || !linkSpent) && Number(activeLink.room) === roomId ? activeLink.time ?? null : null;

  useEffect(() => {
    if (!error || hasLoaded.current || linkBroken) return;
    const timer = setInterval(() => {
      loadKiosk();
    }, RETRY_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [error, linkBroken, loadKiosk]);

  const pendingPreviews = kiosk ? kiosk.rooms.filter((r) => r.image_pending).length : 0;
  const chosenRoomPending = !!(room && kiosk?.rooms.find((r) => r.id === room.id)?.image_pending);
  const previewsGaveUp = previewChecks >= PREVIEW_CHECKS;

  useEffect(() => {
    if (pendingPreviews === 0) {
      setPreviewChecks(0);
      return;
    }
    if ((phase !== 'room' && !chosenRoomPending) || previewChecks >= PREVIEW_CHECKS) return;
    const timer = setTimeout(() => {
      void loadKiosk().finally(() => setPreviewChecks((count) => count + 1));
    }, PREVIEW_CHECK_SECONDS * (previewChecks + 1) * 1000);
    return () => clearTimeout(timer);
  }, [pendingPreviews, chosenRoomPending, previewChecks, phase, loadKiosk]);

  useEffect(() => {
    if (phase !== 'room' || loading || error || justCompleted) return;
    const timer = setInterval(() => {
      loadKiosk();
    }, ROOM_LIST_REFRESH_SECONDS * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadKiosk();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, loading, error, justCompleted, loadKiosk]);

  const resetAll = useCallback(() => {
    if (completeTimer.current) {
      clearTimeout(completeTimer.current);
      completeTimer.current = null;
    }
    stepSequence.current++;
    setLinkSpent(true);
    setFormKey((k) => k + 1);
    setPhase('room');
    setRoom(null);
    setTime(null);
    setForm(null);
    setFormLoading(false);
    setNotice(null);
    setSubmitError(null);
    setJustCompleted(false);
    setCompletedName(undefined);
    setCompletedAd(null);
    setCompletedWaiverId(null);
    setCompletedWaiverRef(null);
    window.scrollTo({ top: 0 });
    loadKiosk();
  }, [loadKiosk]);

  useEffect(() => {
    if (loading || error || justCompleted || submitting || formLoading || (!kioskMode && !!linkSig)) return;
    const arm = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(resetAll, timeoutSeconds * 1000);
    };
    const events: Array<keyof DocumentEventMap> = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'wheel', 'scroll', 'focusin'];
    events.forEach((e) => document.addEventListener(e, arm, true));
    arm();
    return () => {
      events.forEach((e) => document.removeEventListener(e, arm, true));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [kioskMode, linkSig, loading, error, justCompleted, submitting, formLoading, timeoutSeconds, resetAll]);

  useEffect(
    () => () => {
      if (completeTimer.current) clearTimeout(completeTimer.current);
    },
    [],
  );

  const startNextPlayer = () => {
    if (!room || !time || !form) {
      resetAll();
      return;
    }
    if (completeTimer.current) {
      clearTimeout(completeTimer.current);
      completeTimer.current = null;
    }
    setFormKey((k) => k + 1);
    setPhase('form');
    setNotice(null);
    setSubmitError(null);
    setJustCompleted(false);
    setCompletedName(undefined);
    setCompletedAd(null);
    setCompletedWaiverId(null);
    setCompletedWaiverRef(null);
    window.scrollTo({ top: 0 });
  };

  const refreshRoomTimes = async (current: EscapeRoomGuestRoom) => {
    const sequence = stepSequence.current;
    try {
      const data = await escapeRoomService.getRoomForm(locationId, current.id, activeLink);
      if (sequence !== stepSequence.current) return;
      setRoom((r) => (r && r.id === current.id ? { ...r, times: data.times } : r));
    } catch {
      return;
    }
  };

  const chooseRoom = async (picked: EscapeRoomGuestRoom) => {
    const sequence = ++stepSequence.current;
    setNotice(null);
    setRoom(picked);
    setTime(null);
    setForm(null);
    setFormLoading(false);
    setPhase('time');
    window.scrollTo({ top: 0 });
    const fresh = await loadKiosk();
    if (sequence !== stepSequence.current || !fresh) return;
    const updated = fresh.rooms.find((r) => r.id === picked.id);
    if (!updated) {
      setRoom(null);
      setPhase('room');
      setNotice('That room is not available right now. Please choose another room.');
    } else {
      setRoom(updated);
    }
  };

  const chooseTime = async (picked: EscapeRoomGuestTime, forRoom?: EscapeRoomGuestRoom) => {
    const room = forRoom ?? currentRoom;
    if (!room) return;
    setNotice(null);
    setSubmitError(null);
    setTime(picked);
    setPhase('form');

    if (form && form.room.id === room.id) {
      return;
    }

    const sequence = ++stepSequence.current;
    setFormLoading(true);
    window.scrollTo({ top: 0 });
    try {
      const data = await escapeRoomService.getRoomForm(locationId, room.id, activeLink);
      if (sequence !== stepSequence.current) return;
      setRoom((r) => (r && r.id === room.id ? { ...r, times: data.times } : r));
      if (!data.times.some((t) => t.time === picked.time)) {
        setTime(null);
        setNotice('That time is no longer available. Please choose another time.');
      }
      setForm(data);
      setFormKey((k) => k + 1);
    } catch (err: unknown) {
      if (sequence !== stepSequence.current) return;
      setTime(null);
      setPhase('time');
      setNotice(errorMessage(err, 'We could not load your waiver. Please tap your time again. If this keeps happening, please see the front desk.'));
    } finally {
      if (sequence === stepSequence.current) setFormLoading(false);
    }
  };

  const preselect = useRef<{ room: number; time: string | null } | null>(
    Number(searchParams.get('room')) > 0 ? { room: Number(searchParams.get('room')), time: searchParams.get('time') } : null,
  );
  const chooseTimeRef = useRef(chooseTime);
  chooseTimeRef.current = chooseTime;

  const linkChecked = useRef(false);

  useEffect(() => {
    if (!kiosk || linkChecked.current) return;
    linkChecked.current = true;
    if (!linkDate || linkDate === kiosk.date) return;
    preselect.current = null;
    setNotice(
      linkDate < kiosk.date
        ? `That link was for a game on ${dayLabel(linkDate)}. If you are playing today, choose your room and time below.`
        : 'That game could not be opened. Please choose your room and time below, or see the front desk.',
    );
  }, [kiosk, linkDate]);

  useEffect(() => {
    const wanted = preselect.current;
    if (!kiosk || !wanted || !linkChecked.current) return;
    preselect.current = null;
    const picked = kiosk.rooms.find((candidate) => candidate.id === wanted.room);
    if (!picked) {
      setNotice('That game is not taking check-ins right now. Please choose your room.');
      return;
    }
    setRoom(picked);
    setPhase('time');
    const slot = wanted.time ? picked.times.find((candidate) => candidate.time === wanted.time) : undefined;
    if (slot) {
      void chooseTimeRef.current(slot, picked);
    } else if (wanted.time) {
      setNotice(
        kiosk.ahead
          ? 'We could not find a booking for that room and time. Please check your booking email, or see the front desk.'
          : 'That game time is no longer open. Please choose your time.',
      );
    }
  }, [kiosk]);

  const backToRooms = () => {
    stepSequence.current++;
    setRoom(null);
    setTime(null);
    setForm(null);
    setFormLoading(false);
    setNotice(null);
    setPhase('room');
    loadKiosk();
  };

  const changeTime = () => {
    setTime(null);
    setNotice(null);
    setSubmitError(null);
    if (room) refreshRoomTimes(room);
  };

  const handleSubmit = async (data: WaiverSubmission) => {
    if (justCompleted || submitting) return;
    if (!room) {
      backToRooms();
      return;
    }
    if (!time) {
      setSubmitError('Choose your game time at the top of the page first.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await escapeRoomService.submit(locationId, room.id, time.time, data, {
        sessionDate: time.date,
        templateId: form?.template?.id,
        templateVersion: form?.template?.version,
        gameSignature: kiosk?.ahead ? activeLink?.sig ?? null : null,
      });
      setCompletedName(data.adult_first_name);
      setCompletedAd(result.ad ?? null);
      setCompletedWaiverId(result.id ?? null);
      setCompletedWaiverRef(result.reference_number ?? null);
      setJustCompleted(true);
      const holdSeconds = holdFor(result.ad);
      completeTimer.current = setTimeout(resetAll, (holdSeconds + 90) * 1000);
    } catch (err: unknown) {
      if (refusedField(err, 'waiver_template_version')) {
        const message = errorMessage(err, 'This waiver was updated while you were filling it in. Please read it again before signing.');
        try {
          const fresh = await escapeRoomService.getRoomForm(locationId, room.id, activeLink);
          setRoom((r) => (r && r.id === room.id ? { ...r, times: fresh.times } : r));
          setForm(fresh);
          setFormKey((k) => k + 1);
          if (!fresh.times.some((t) => t.time === time.time)) setTime(null);
        } catch {
          backToRooms();
        }
        setNotice(message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (refusedField(err, 'package_id')) {
        backToRooms();
        setNotice(errorMessage(err, 'That room is not available right now. Please choose another room.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (refusedField(err, 'session_time')) {
        setTime(null);
        setNotice(errorMessage(err, 'That time is no longer available. Please choose another time.'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        refreshRoomTimes(room);
      } else {
        setSubmitError(errorMessage(err, 'Your waiver could not be submitted. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <WaiverLoading label="Loading escape-room check-in..." />;

  if (error || !kiosk) {
    return (
      <WaiverShell title="Escape Room Check-In" subtitle="Check-in is not available right now">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 text-center space-y-4">
          <p className="text-sm text-gray-700">{error ?? 'Escape-room check-in is not available right now.'}</p>
          {!linkBroken && (
            <>
              <p className="text-xs text-gray-500">
                This page tries again by itself every {RETRY_SECONDS} seconds. If this keeps happening, please see the front desk.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadKiosk();
                }}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </WaiverShell>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === phase);
  const hasRooms = kiosk.rooms.length > 0;
  const shownRoom = room ? kiosk.rooms.find((r) => r.id === room.id) ?? room : null;
  const noGamesText = kiosk.ahead
    ? 'There are no booked games in this room that day. Please check your booking email, or see the front desk.'
    : 'There are no more games in this room today. Please see the front desk.';

  return (
    <WaiverShell title="Escape Room Check-In" subtitle={`${kiosk.location.name} · ${kiosk.date_label.replace(/ (\d+)$/, '\u00a0$1')}`}>
      {staffLaunched && <StaffReturnControl />}

      {kiosk.ahead && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-900 text-center" role="status">
          You are signing ahead for your booked game on <strong>{kiosk.date_label.replace(/ (\d+)$/, '\u00a0$1')}</strong>.{' '}
          <a href={`/waiver/escape-room/${locationId}${kioskMode ? '?staff=1' : ''}`} className="font-semibold underline underline-offset-2">
            Playing today instead?
          </a>
        </div>
      )}

      {hasRooms && (
      <ol className="flex items-center justify-center gap-2 sm:gap-4" aria-label="Check-in steps">
        {STEPS.map((step, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  current ? 'bg-blue-700 text-white' : done ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'
                }`}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <Check className="w-4 h-4" aria-label="Done" /> : index + 1}
              </span>
              <span className={`text-sm font-semibold ${current ? 'text-gray-900' : 'text-gray-500'}`}>{step.label}</span>
              {index < STEPS.length - 1 && <span className="hidden sm:block w-8 h-px bg-gray-300" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      )}

      {notice && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 text-center" role="status">
          {notice}
        </div>
      )}

      {phase === 'room' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-7 space-y-4">
          {hasRooms ? (
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Which room are you playing?</h2>
              <p className="text-sm text-gray-500 mt-1">Choose your escape room to get started.</p>
            </div>
          ) : (
            <div className="text-center py-6 space-y-2">
              <h2 className="text-lg font-bold text-gray-900">Escape-room check-in isn&apos;t open here right now</h2>
              <p className="text-sm text-gray-600">No escape rooms at this location are taking check-ins. Please see the front desk.</p>
            </div>
          )}
          {hasRooms && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {kiosk.rooms.map((r) => {
                const available = openTimes(r.times, linkedTime(r.id));
                const hasTimes = available.length > 0;
                const upcoming = available.filter((t) => !t.just_finished).length;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => chooseRoom(r)}
                    disabled={!hasTimes}
                    className="flex sm:flex-col text-left rounded-xl border-2 border-gray-200 overflow-hidden hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
                  >
                    <RoomPreviewImage
                      image={r.image}
                      preview={r.image_preview}
                      waiting={!!r.image_pending && !previewsGaveUp}
                      className="w-28 min-h-[5.25rem] shrink-0 sm:w-full sm:min-h-0 sm:aspect-[16/9]"
                    />
                    <span className="block min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-4">
                      <span className="block text-base font-bold text-gray-900 break-words">{r.name}</span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {kiosk.ahead
                          ? hasTimes
                            ? `${r.duration_minutes} min · ${available.length} booked ${available.length === 1 ? 'game' : 'games'} that day`
                            : 'No booked games that day'
                          : upcoming > 0
                            ? `${r.duration_minutes} min · ${upcoming} ${upcoming === 1 ? 'game' : 'games'} left today`
                            : hasTimes
                              ? `${r.duration_minutes} min · Your game`
                              : 'No more games today'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {phase === 'time' && room && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-7 space-y-4">
          <div className="text-center">
            <RoomPreviewImage
              image={shownRoom?.image}
              preview={shownRoom?.image_preview}
              waiting={!!shownRoom?.image_pending && !previewsGaveUp}
              className="mx-auto mb-3 w-28 aspect-[4/3] rounded-lg"
              iconClassName="w-6 h-6"
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{room.name}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-1">What time is your game?</h2>
            <p className="text-sm text-gray-500 mt-1">Choose the start time on your booking.</p>
          </div>
          {openTimes(room.times, linkedTime(room.id)).length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">{noGamesText}</p>
          ) : (
            <TimeGrid times={openTimes(room.times, linkedTime(room.id))} onPick={chooseTime} />
          )}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={backToRooms}
              className="inline-flex items-center min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Choose a different room
            </button>
          </div>
        </div>
      )}

      {phase === 'form' && room && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <RoomPreviewImage
                  image={shownRoom?.image}
                  preview={shownRoom?.image_preview}
                  waiting={!!shownRoom?.image_pending && !previewsGaveUp}
                  className="w-16 aspect-[4/3] shrink-0 rounded-md"
                  iconClassName="w-5 h-5"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Your game</p>
                  <p className="text-sm font-bold text-gray-900">
                    {room.name} · {time ? time.label : 'choose your time'}
                    {kiosk.ahead && time ? ` · ${kiosk.date_label.replace(/ (\d+)$/, '\u00a0$1')}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {time && (
                  <button
                    type="button"
                    onClick={changeTime}
                    className="inline-flex items-center min-h-[44px] px-4 rounded-lg border border-blue-200 bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Change time
                  </button>
                )}
                <button
                  type="button"
                  onClick={backToRooms}
                  className="inline-flex items-center min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Change room
                </button>
              </div>
            </div>
            <p className="text-xs text-blue-900">After your game, we&apos;ll email your group photo to the email address you enter below.</p>
            {!time &&
              (openTimes(room.times, linkedTime(room.id)).length === 0 ? (
                <p className="text-sm text-gray-700">{noGamesText}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">Choose your game time. What you typed below is kept.</p>
                  <TimeGrid times={openTimes(room.times, linkedTime(room.id))} onPick={chooseTime} />
                </div>
              ))}
          </div>
          {formLoading || !form ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-10 text-center">
              <div className="w-7 h-7 border-[3px] border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading your waiver...</p>
            </div>
          ) : (
            <WaiverFormBody
              key={formKey}
              context={form}
              noAutofill={kioskMode}
              submitting={submitting}
              error={submitError}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}

      {justCompleted && (
        <WaiverSuccessModal
          signerFirstName={completedName}
          locationId={locationId}
          autoCloseSeconds={holdFor(completedAd)}
          onStartNext={startNextPlayer}
          onAutoClose={resetAll}
          ad={completedAd}
          waiverId={completedWaiverId}
          waiverReference={completedWaiverRef}
          nextLabel={room && time ? `Sign for another player on ${room.name} ·\u00a0${time.label.replace(/ /g, '\u00a0')}` : 'Sign for another player'}
          secondaryLabel={pinnedGame ? undefined : 'Sign for a different room or time'}
          onSecondary={resetAll}
          closingText="Returning to the room list"
          note="Your group photo will be emailed to you after the game."
        />
      )}
    </WaiverShell>
  );
};

export default EscapeRoomWaiverKiosk;
