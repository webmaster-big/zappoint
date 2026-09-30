import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Mail,
  MapPin,
  MonitorPlay,
  Printer,
  QrCode,
  RefreshCw,
  Send,
  Timer,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import { usePhotoCamera } from '../../../hooks/usePhotoCamera';
import photoService from '../../../services/PhotoService';
import escapeRoomService from '../../../services/EscapeRoomService';
import bookingService from '../../../services/bookingService';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import CalendarDatePicker from '../../../components/admin/calendar/CalendarDatePicker';
import { dateKey, michiganToday, parseLocalDate } from '../../../utils/timeFormat';
import { getStoredUser } from '../../../utils/storage';
import { followUpEmailName, formatFollowUpTime as followUpTime } from '../../../utils/visitFollowUpNotice';
import visitFollowUpService from '../../../services/VisitFollowUpService';
import type { PhotoRecord, PhotoSessionRecord } from '../../../types/photo.types';
import type {
  EscapeRoomDay,
  EscapeRoomExcludedReason,
  EscapeRoomPlayer,
  EscapeRoomSessionDetail,
  EscapeRoomSlot,
  EscapeRoomSlotStatus,
} from '../../../types/escapeRoom.types';

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const STATUS_LABELS: Record<EscapeRoomSlotStatus, string> = {
  waiting: 'Waiting for players',
  signing: 'Players signing',
  photo_ready: 'Photo taken',
  sent: 'Sent',
  send_problem: 'Sent',
  finished: 'Result only',
};

const STATUS_STYLES: Record<EscapeRoomSlotStatus, string> = {
  waiting: 'bg-gray-100 text-gray-600',
  signing: 'bg-amber-100 text-amber-800',
  photo_ready: 'bg-blue-100 text-blue-800',
  sent: 'bg-emerald-100 text-emerald-800',
  send_problem: 'bg-red-100 text-red-700',
  finished: 'bg-slate-200 text-slate-700',
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  'checked-in': 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const BUSY_ONLY_KEY = 'escape_rooms_busy_only';

const readBusyOnly = (): boolean => {
  try {
    return localStorage.getItem(BUSY_ONLY_KEY) === '1';
  } catch {
    return false;
  }
};

const formatSeconds = (total: number): string => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

const slotHasActivity = (slot: EscapeRoomSlot): boolean =>
  slot.bookings.length > 0 || slot.signed > 0 || slot.photos > 0 || slot.completed;

const printQrSign = (title: string, note: string, url: string, image: string) => {
  const win = window.open('', '_blank', 'width=640,height=820');
  if (!win) return false;
  const doc = win.document;
  doc.title = title;
  const body = doc.body;
  body.style.cssText = 'font-family: Arial, Helvetica, sans-serif; text-align: center; padding: 40px; color: #111827;';
  const heading = doc.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'font-size: 30px; margin: 0 0 12px;';
  const text = doc.createElement('p');
  text.textContent = note;
  text.style.cssText = 'font-size: 18px; margin: 0 0 24px;';
  const img = doc.createElement('img');
  img.src = image;
  img.alt = 'QR code';
  img.style.cssText = 'width: 340px; height: 340px;';
  const link = doc.createElement('p');
  link.textContent = url;
  link.style.cssText = 'font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 16px;';
  body.append(heading, text, img, link);
  img.onload = () => {
    win.focus();
    win.print();
  };
  return true;
};

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

const EXCLUDED_LABELS: Record<EscapeRoomExcludedReason, string> = {
  booking_cancelled: 'Their booking was cancelled',
  booking_moved: 'Their booking is now for a different time',
  booking_removed: 'Their booking was deleted',
  other_location: 'Signed at another location',
};


const longDate = (key: string): string =>
  parseLocalDate(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const shiftDate = (key: string, days: number): string => {
  const date = parseLocalDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};

const EscapeRoomSessions = () => {
  const { themeColor, fullColor } = useThemeColor();
  const { effectiveLocationId, isCompanyAdmin } = useLocationScope();

  const [searchParams] = useSearchParams();
  const linkedDate = searchParams.get('date');
  const [date, setDate] = useState(() => (linkedDate && DATE_PARAM.test(linkedDate) ? linkedDate : dateKey(michiganToday())));
  const pendingSession = useRef<number | null>(Number(searchParams.get('session')) || null);
  const pendingSlot = useRef<{ room: number; time: string } | null>(
    !searchParams.get('session') && Number(searchParams.get('room')) > 0 && searchParams.get('time')
      ? { room: Number(searchParams.get('room')), time: String(searchParams.get('time')) }
      : null,
  );
  const role = getStoredUser()?.role ?? '';
  const canManageSetup = ['company_admin', 'admin', 'location_manager'].includes(role);
  const [day, setDay] = useState<EscapeRoomDay | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EscapeRoomSessionDetail | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [consent, setConsent] = useState(false);
  const [escaped, setEscaped] = useState(true);
  const [finishMinutes, setFinishMinutes] = useState('');
  const [finishSeconds, setFinishSeconds] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveRoomId, setMoveRoomId] = useState<number | null>(null);
  const [moveTime, setMoveTime] = useState('');
  const [qrMode, setQrMode] = useState<'checkin' | 'game' | 'photo' | null>(null);
  const [resendId, setResendId] = useState<number | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [removingPhotoId, setRemovingPhotoId] = useState<number | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correctEscaped, setCorrectEscaped] = useState(true);
  const [correctMinutes, setCorrectMinutes] = useState('');
  const [correctSeconds, setCorrectSeconds] = useState('');
  const [entryMode, setEntryMode] = useState<'used' | 'left'>('used');
  const [recordingOnly, setRecordingOnly] = useState(false);
  const [emailPlayersOnly, setEmailPlayersOnly] = useState(true);
  const [busyOnly, setBusyOnly] = useState(readBusyOnly);
  const [confirmResendAll, setConfirmResendAll] = useState(false);
  const [slideshowConfirmId, setSlideshowConfirmId] = useState<number | null>(null);
  const [slideshowNote, setSlideshowNote] = useState<string | null>(null);

  const camera = usePhotoCamera({ facingMode: 'environment' });
  const { start: startCamera, stop: stopCamera, capture: capturePhoto } = camera;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const daySequence = useRef(0);
  const followToday = useRef(!(linkedDate && DATE_PARAM.test(linkedDate)));
  const scrollToDetail = useRef(false);
  const detailPanel = useRef<HTMLDivElement | null>(null);
  const secondsInput = useRef<HTMLInputElement | null>(null);
  const qrWrap = useRef<HTMLDivElement | null>(null);
  const openSequence = useRef(0);
  const refreshSequence = useRef(0);
  const scopeKey = `${effectiveLocationId ?? 'none'}|${date}`;
  const liveScope = useRef(scopeKey);
  liveScope.current = scopeKey;
  const activeGameId = useRef<number | null>(null);
  activeGameId.current = detail?.id ?? null;

  const photoSession = detail?.photo_session ?? null;
  const photos = useMemo(() => photoSession?.photos ?? [], [photoSession]);
  const readyPhotos = useMemo(() => photos.filter((photo) => photo.processing_status === 'ready'), [photos]);
  const maxPhotos = photoSession?.max_photos ?? 3;
  const atCap = photos.length >= maxPhotos;

  const loadDay = useCallback(async () => {
    if (!effectiveLocationId) return;
    const sequence = ++daySequence.current;
    setDayLoading(true);
    try {
      const data = await escapeRoomService.getDay(effectiveLocationId, date);
      if (sequence !== daySequence.current) return;
      if (followToday.current && data.date !== data.today) {
        setDate(data.today);
        return;
      }
      setDay(data);
      setDayError(null);
    } catch (e) {
      if (sequence === daySequence.current) setDayError(errorMessage(e, 'The escape-room games could not be loaded.'));
    } finally {
      if (sequence === daySequence.current) setDayLoading(false);
    }
  }, [date, effectiveLocationId]);

  const resetDetailInputs = useCallback(() => {
    setConsent(false);
    setEscaped(true);
    setFinishMinutes('');
    setFinishSeconds('');
    setConfirming(false);
    setMovingId(null);
    setRemovingId(null);
    setResendId(null);
    setResendEmail('');
    setRemovingPhotoId(null);
    setCorrecting(false);
    setQrMode(null);
    setEntryMode('used');
    setRecordingOnly(false);
    setConfirmResendAll(false);
    setSlideshowConfirmId(null);
    setSlideshowNote(null);
  }, []);

  useEffect(() => {
    setDay(null);
    setDetail(null);
    resetDetailInputs();
    stopCamera();
    void loadDay();
  }, [loadDay, resetDetailInputs, stopCamera]);

  useEffect(() => {
    if (!day?.is_today) return;
    const timer = setInterval(() => void loadDay(), 60000);
    return () => clearInterval(timer);
  }, [day?.is_today, loadDay]);

  const refreshDetail = useCallback(async (sessionId: number) => {
    const sequence = ++refreshSequence.current;
    const scope = liveScope.current;
    try {
      const data = await escapeRoomService.getSession(sessionId);
      if (sequence === refreshSequence.current && scope === liveScope.current && activeGameId.current === sessionId) setDetail(data);
    } catch {
      return;
    }
  }, []);

  const openGameId = detail?.id ?? null;

  useEffect(() => {
    if (openGameId === null || !scrollToDetail.current) return;
    scrollToDetail.current = false;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      detailPanel.current?.scrollIntoView({ block: 'start' });
    } else {
      detailPanel.current?.scrollTo({ top: 0 });
    }
  }, [openGameId]);

  useEffect(() => {
    if (openGameId === null) return;
    const timer = setInterval(() => void refreshDetail(openGameId), 30000);
    return () => clearInterval(timer);
  }, [openGameId, refreshDetail]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (camera.state === 'live' && (!detail || detail.completed || !detail.photo_session)) stopCamera();
  }, [camera.state, detail, stopCamera]);

  const applyDetail = useCallback(
    (data: EscapeRoomSessionDetail) => {
      void loadDay();
      if (activeGameId.current !== data.id) return;
      refreshSequence.current++;
      setDetail(data);
    },
    [loadDay],
  );

  const openSlot = useCallback(
    async (roomId: number, slot: EscapeRoomSlot) => {
      if (!effectiveLocationId) return;
      stopCamera();
      resetDetailInputs();
      setOpeningKey(slot.key);
      const sequence = ++openSequence.current;
      const scope = liveScope.current;
      try {
        const data = slot.session_id
          ? await escapeRoomService.getSession(slot.session_id)
          : await escapeRoomService.openSession(effectiveLocationId, roomId, date, slot.time);
        if (sequence !== openSequence.current || scope !== liveScope.current) return;
        refreshSequence.current++;
        activeGameId.current = data.id;
        scrollToDetail.current = true;
        setDetail(data);
        if (!slot.session_id) void loadDay();
      } catch (e) {
        setToast({ message: errorMessage(e, 'That game could not be opened.'), type: 'error' });
      } finally {
        setOpeningKey(null);
      }
    },
    [date, effectiveLocationId, loadDay, resetDetailInputs, stopCamera],
  );

  useEffect(() => {
    const wanted = pendingSlot.current;
    if (!day || !wanted) return;
    pendingSlot.current = null;
    const room = day.rooms.find((candidate) => candidate.id === wanted.room);
    const slot = room?.slots.find((candidate) => candidate.time === wanted.time);
    if (room && slot) {
      void openSlot(room.id, slot);
    } else {
      setToast({ message: 'That game is not on this day any more.', type: 'info' });
    }
  }, [day, openSlot]);

  useEffect(() => {
    const target = pendingSession.current;
    if (!day || target === null) return;
    pendingSession.current = null;
    for (const room of day.rooms) {
      const slot = room.slots.find((candidate) => candidate.session_id === target);
      if (slot) {
        void openSlot(room.id, slot);
        return;
      }
    }
    escapeRoomService
      .getSession(target)
      .then((game) => {
        setToast({
          message:
            game.location_id !== day.location.id
              ? `That game is at ${game.location_name ?? 'another location'}. Pick that location in the sidebar to open it.`
              : 'That game is not on this day any more.',
          type: 'info',
        });
      })
      .catch(() => setToast({ message: 'That game could not be found.', type: 'error' }));
  }, [day, openSlot]);

  const closeDetail = () => {
    stopCamera();
    openSequence.current++;
    refreshSequence.current++;
    activeGameId.current = null;
    setDetail(null);
    resetDetailInputs();
  };

  const withPhotoSession = (gameId: number, updated: PhotoSessionRecord) => {
    setDetail((current) =>
      current && current.id === gameId && current.photo_session?.id === updated.id ? { ...current, photo_session: updated } : current,
    );
    if (activeGameId.current === gameId) void refreshDetail(gameId);
  };

  const startPhoto = async () => {
    if (!detail || !consent) return;
    setBusy(true);
    try {
      applyDetail(await escapeRoomService.startPhoto(detail.id));
      await startCamera();
    } catch (e) {
      setToast({ message: errorMessage(e, 'The group photo could not be started.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    if (!detail || !photoSession || atCap) return;
    const gameId = detail.id;
    const dataUrl = capturePhoto();
    if (!dataUrl) {
      setToast({ message: 'The camera did not return an image. Try again.', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      withPhotoSession(gameId, await photoService.addCapturedPhoto(photoSession.id, dataUrl));
      void loadDay();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That photo could not be added.'), type: 'error' });
      if (activeGameId.current === gameId) void refreshDetail(gameId);
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!detail || !photoSession) return;
    const gameId = detail.id;
    setBusy(true);
    try {
      withPhotoSession(gameId, await photoService.uploadPhoto(photoSession.id, file));
      void loadDay();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That file could not be uploaded.'), type: 'error' });
      if (activeGameId.current === gameId) void refreshDetail(gameId);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removePhoto = async (photoId: number) => {
    if (!detail || !photoSession) return;
    const gameId = detail.id;
    setBusy(true);
    try {
      withPhotoSession(gameId, await photoService.removePhoto(photoSession.id, photoId));
      void loadDay();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That photo could not be removed.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const movePhoto = async (photoId: number, direction: -1 | 1) => {
    if (!detail || !photoSession) return;
    const gameId = detail.id;
    const order = photos.map((photo) => photo.id);
    const index = order.indexOf(photoId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setBusy(true);
    try {
      withPhotoSession(gameId, await photoService.reorderPhotos(photoSession.id, order));
    } catch (e) {
      setToast({ message: errorMessage(e, 'The photos could not be reordered.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const minutesValue = finishMinutes.trim() === '' ? null : Number(finishMinutes);
  const secondsValue = finishSeconds.trim() === '' ? 0 : Number(finishSeconds);
  const finishEntered = finishMinutes.trim() !== '' || finishSeconds.trim() !== '';
  const roomMinutes = detail?.room.duration_minutes ?? null;
  const countingDown = entryMode === 'left' && roomMinutes !== null;
  const typedValid =
    minutesValue !== null &&
    Number.isInteger(minutesValue) &&
    Number.isInteger(secondsValue) &&
    minutesValue >= 0 &&
    minutesValue <= 599 &&
    secondsValue >= 0 &&
    secondsValue <= 59;
  const typedSeconds = typedValid && minutesValue !== null ? minutesValue * 60 + secondsValue : 0;
  const usedSeconds = countingDown && roomMinutes !== null ? roomMinutes * 60 - typedSeconds : typedSeconds;
  const finishTimeValid = !escaped || (typedValid && usedSeconds > 0 && (countingDown ? typedSeconds > 0 || finishEntered : typedSeconds > 0));
  const finishLabel = typedValid && usedSeconds > 0 ? formatSeconds(usedSeconds) : '';
  const finishLongerThanRoom = escaped && finishTimeValid && roomMinutes !== null && usedSeconds > roomMinutes * 60;
  const finishVeryFast = escaped && finishTimeValid && roomMinutes !== null && usedSeconds < roomMinutes * 15;

  const pickDate = (next: string) => {
    followToday.current = day ? next === day.today : false;
    setDate(next);
  };

  const typeMinutes = (raw: string) => {
    if (raw.includes(':')) {
      const [minutesPart, secondsPart = ''] = raw.split(':');
      setFinishMinutes(minutesPart.replace(/\D/g, '').slice(0, 3));
      setFinishSeconds(secondsPart.replace(/\D/g, '').slice(0, 2));
      secondsInput.current?.focus();
      return;
    }
    setFinishMinutes(raw.replace(/\D/g, '').slice(0, 3));
  };
  const recipientPlayers = detail ? detail.players.filter((player) => player.has_email && !player.sent) : [];
  const recipients = recipientPlayers.length;
  const noEmailPlayers = detail ? detail.players.filter((player) => !player.has_email && !player.sent) : [];
  const declinedRelease = detail ? detail.players.filter((player) => player.photo_release === false).length : 0;
  const resendTargets = detail
    ? detail.players.filter((player) => player.sent && (player.has_email || player.delivery?.status === 'sent') && !player.delivery?.is_duplicate)
    : [];
  const followUp = detail?.follow_up;
  const thanksEmail = followUp?.thanks_email;
  const reviewEmail = followUp?.review_email;
  const thanksName = followUpEmailName(thanksEmail?.name, 'Thanks for Playing');
  const thanksOn = thanksEmail?.active !== false;
  const reviewOn = reviewEmail?.active === true;
  const thanksPromo = thanksEmail?.promo && !thanksEmail.promo.problem ? thanksEmail.promo : null;
  const promoProblem = thanksOn ? thanksEmail?.promo?.problem ?? null : null;
  const reviewHours = reviewEmail?.active ? reviewEmail.hours ?? 24 : null;
  const canEmailPlayers = detail?.can_email_players ?? (thanksOn || reviewOn);
  const isTodayGame = detail ? detail.session_date === dateKey(michiganToday()) : false;
  const gameDayLabel = detail ? parseLocalDate(detail.session_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const emailSettingsPath = thanksEmail?.id ? `/admin/email/notifications/edit/${thanksEmail.id}` : '/admin/email/notifications';
  const players = (count: number) => `${count} ${count === 1 ? 'player' : 'players'}`;

  const recordWithoutPhoto = async () => {
    if (!detail) return;
    setBusy(true);
    const emailing = emailPlayersOnly && canEmailPlayers && recipients > 0;
    try {
      const data = await escapeRoomService.complete(detail.id, escaped, escaped ? finishLabel : null, true, emailing);
      stopCamera();
      setRecordingOnly(false);
      applyDetail(data);
      const thanked = data.players.filter((player) => player.thanks_email?.status === 'sent').length;
      const notDelivered = data.players.filter((player) => player.thanks_email?.status === 'failed').length;
      const reviewsWaiting = data.players.filter((player) => player.review?.status === 'scheduled').length;
      const parts = [
        thanked > 0 ? `the ${thanksName} email went to ${players(thanked)}` : '',
        notDelivered > 0 ? `${notDelivered} ${notDelivered === 1 ? 'email has' : 'emails have'} not gone through yet` : '',
        reviewsWaiting > 0 ? `${reviewsWaiting} review ${reviewsWaiting === 1 ? 'request is' : 'requests are'} scheduled` : '',
      ].filter(Boolean);
      setToast({
        message: parts.length > 0 ? `Result recorded; ${parts.join(', ')}.` : 'Result recorded. No email was sent.',
        type: notDelivered > 0 ? 'info' : 'success',
      });
    } catch (e) {
      setRecordingOnly(false);
      setToast({ message: errorMessage(e, 'The result could not be recorded.'), type: 'error' });
      void refreshDetail(detail.id);
    } finally {
      setBusy(false);
    }
  };

  const checkInBooking = async (reference: string) => {
    if (!detail) return;
    const gameId = detail.id;
    setBusy(true);
    try {
      await bookingService.checkInBooking(reference);
      setToast({ message: `Checked in booking ${reference}.`, type: 'success' });
      void refreshDetail(gameId);
      void loadDay();
    } catch (e) {
      setToast({ message: errorMessage(e, 'That booking could not be checked in.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const resendToEveryone = async () => {
    if (!detail) return;
    const gameId = detail.id;
    setBusy(true);
    setConfirmResendAll(false);
    let sent = 0;
    let retrying = 0;
    const refused: string[] = [];
    let stopped: string | null = null;
    let latest: EscapeRoomSessionDetail | null = null;
    for (const player of resendTargets) {
      try {
        latest = await escapeRoomService.resendToPlayer(gameId, player.waiver_id, null);
        const row = latest.players.find((candidate) => candidate.waiver_id === player.waiver_id);
        if (row?.delivery?.status === 'sent') sent++;
        else retrying++;
      } catch (e) {
        const response = (e as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } })?.response;
        if ((response?.status === 422 && response.data?.errors?.email) || response?.status === 404) {
          refused.push(player.name || 'a player');
          continue;
        }
        stopped = errorMessage(e, 'The photo could not be sent.');
        break;
      }
    }
    if (latest) applyDetail(latest);
    else void refreshDetail(gameId);
    const parts = [
      sent > 0 ? `Sent the group photo again to ${sent} ${sent === 1 ? 'player' : 'players'}.` : '',
      retrying > 0 ? `${retrying} ${retrying === 1 ? 'email has' : 'emails have'} not gone through yet and will be retried automatically.` : '',
      refused.length > 0 ? `Not sent to ${refused.join(', ')}: no valid address, or no longer in this game. Use Resend next to them if needed.` : '',
      stopped ? `Stopped: ${stopped}` : '',
    ].filter(Boolean);
    setToast({
      message: parts.join(' ') || 'Nothing was sent.',
      type: stopped ? 'error' : retrying > 0 || refused.length > 0 ? 'info' : 'success',
    });
    setBusy(false);
  };

  const setSlideshow = async (photo: PhotoRecord, include: boolean, confirmRelease = false) => {
    if (!detail) return;
    const gameId = detail.id;
    setBusy(true);
    setSlideshowNote(null);
    try {
      const message = await photoService.setPhotoOnSlideshow(photo.id, include, confirmRelease);
      setSlideshowConfirmId(null);
      setToast({ message, type: 'success' });
      void refreshDetail(gameId);
    } catch (e) {
      const response = (e as { response?: { status?: number; data?: { message?: string } } })?.response;
      if (response?.status === 409) {
        setSlideshowConfirmId(photo.id);
        setSlideshowNote(response.data?.message ?? 'Some players were not asked about a photo release.');
      } else {
        setToast({ message: errorMessage(e, 'That change could not be saved.'), type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = (name: string) => {
    const canvas = qrWrap.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'escape-room'}-qr.png`;
    link.click();
  };

  const printQr = (title: string, note: string, url: string) => {
    const canvas = qrWrap.current?.querySelector('canvas');
    if (!canvas) return;
    if (!printQrSign(title, note, url, canvas.toDataURL('image/png'))) {
      setToast({ message: 'The print window was blocked. Allow pop-ups for this site, or use Download QR.', type: 'info' });
    }
  };

  const toggleBusyOnly = () => {
    const next = !busyOnly;
    setBusyOnly(next);
    try {
      localStorage.setItem(BUSY_ONLY_KEY, next ? '1' : '0');
    } catch {
      return;
    }
  };

  const complete = async () => {
    if (!detail) return;
    if (!isTodayGame && !window.confirm(`This game was played on ${gameDayLabel}. Complete it and email the players now?`)) {
      return;
    }
    setBusy(true);
    try {
      const data = await escapeRoomService.complete(detail.id, escaped, escaped ? finishLabel : null);
      stopCamera();
      setConfirming(false);
      applyDetail(data);
      const notYet = data.counts.retrying + data.counts.failed;
      setToast({
        message:
          notYet === 0
            ? `Emailed the ${thanksName} email with the group photo to ${players(data.counts.emailed)}.`
            : data.counts.emailed === 0
              ? `The photo has not gone through yet for ${players(notYet)}. See below.`
              : `Emailed the ${thanksName} email with the group photo to ${players(data.counts.emailed)}. ${notYet} ${notYet === 1 ? 'email has' : 'emails have'} not gone through yet; see below.`,
        type: notYet === 0 ? 'success' : 'info',
      });
    } catch (e) {
      setConfirming(false);
      setToast({ message: errorMessage(e, 'The photo could not be sent.'), type: 'error' });
      void refreshDetail(detail.id);
    } finally {
      setBusy(false);
    }
  };

  const followUpAction = async (rowId: number, action: 'send' | 'cancel') => {
    if (!detail) return;
    const gameId = detail.id;
    setBusy(true);
    try {
      if (action === 'send') {
        const result = await visitFollowUpService.sendNow(rowId);
        setToast({ message: result.message || 'Email sent.', type: 'success' });
      } else {
        await visitFollowUpService.cancel(rowId);
        setToast({ message: 'The email will not be sent.', type: 'success' });
      }
    } catch (e) {
      setToast({ message: errorMessage(e, 'That did not work. Please try again.'), type: 'error' });
    } finally {
      setBusy(false);
      void refreshDetail(gameId);
    }
  };

  const sendToNew = async () => {
    if (!detail) return;
    if (detail.completed_without_photo) {
      if (
        !isTodayGame
        && !window.confirm(
          thanksOn
            ? `This game was played on ${gameDayLabel}. Email ${players(detail.counts.new_players)} about it now?`
            : `This game was played on ${gameDayLabel}. Schedule review requests for ${players(detail.counts.new_players)}?`
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        const data = await escapeRoomService.sendToNewPlayers(detail.id);
        applyDetail(data);
        const count = (list: EscapeRoomPlayer[], test: (player: EscapeRoomPlayer) => boolean) => list.filter(test).length;
        const isSent = (player: EscapeRoomPlayer) => player.thanks_email?.status === 'sent';
        const isFailed = (player: EscapeRoomPlayer) => player.thanks_email?.status === 'failed';
        const isWaiting = (player: EscapeRoomPlayer) => player.review?.status === 'scheduled';
        const thanked = Math.max(0, count(data.players, isSent) - count(detail.players, isSent));
        const notDelivered = Math.max(0, count(data.players, isFailed) - count(detail.players, isFailed));
        const reviewsWaiting = Math.max(0, count(data.players, isWaiting) - count(detail.players, isWaiting));
        const parts = [
          thanked > 0 ? `the ${thanksName} email went to ${players(thanked)}` : '',
          notDelivered > 0 ? `${notDelivered} ${notDelivered === 1 ? 'email has' : 'emails have'} not gone through yet` : '',
          reviewsWaiting > 0 ? `${reviewsWaiting} review ${reviewsWaiting === 1 ? 'request is' : 'requests are'} scheduled` : '',
        ].filter(Boolean);
        setToast({
          message: parts.length > 0
            ? `${parts.join(', ').replace(/^./, (first) => first.toUpperCase())}.`
            : 'No email was sent. See each player below.',
          type: notDelivered > 0 || parts.length === 0 ? 'info' : 'success',
        });
      } catch (e) {
        setToast({ message: errorMessage(e, 'The players could not be emailed.'), type: 'error' });
        void refreshDetail(detail.id);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const before = detail.counts.sent;
      const notYetBefore = detail.counts.retrying + detail.counts.failed + detail.counts.stuck;
      const data = await escapeRoomService.sendToNewPlayers(detail.id);
      applyDetail(data);
      const more = Math.max(0, data.counts.sent - before);
      const notYet = Math.max(0, data.counts.retrying + data.counts.failed + data.counts.stuck - notYetBefore);
      setToast({
        message:
          notYet > 0
            ? `${more > 0 ? `Emailed ${more} more ${more === 1 ? 'player' : 'players'}. ` : ''}${notYet} ${notYet === 1 ? 'email has' : 'emails have'} not gone through yet; see below.`
            : more > 0
              ? `Emailed the group photo to ${more} more ${more === 1 ? 'player' : 'players'}.`
              : 'Everyone in this game now has the photo.',
        type: notYet > 0 ? 'info' : 'success',
      });
    } catch (e) {
      setToast({ message: errorMessage(e, 'The photo could not be sent.'), type: 'error' });
      void refreshDetail(detail.id);
    } finally {
      setBusy(false);
    }
  };

  const beginMove = (player: EscapeRoomPlayer) => {
    setMovingId(player.waiver_id);
    setMoveRoomId(detail?.room.id ?? null);
    setMoveTime('');
  };

  const moveRoom = day?.rooms.find((room) => room.id === moveRoomId) ?? null;
  const moveTimes = (moveRoom?.slots ?? []).filter(
    (slot) => !(moveRoom?.id === detail?.room.id && slot.time === detail?.session_time),
  );

  const confirmMove = async () => {
    if (!detail || movingId === null || !moveRoomId || !moveTime) return;
    setBusy(true);
    try {
      const target = moveTimes.find((slot) => slot.time === moveTime);
      applyDetail(await escapeRoomService.movePlayer(detail.id, movingId, moveRoomId, moveTime));
      setMovingId(null);
      setToast({
        message: target?.completed
          ? 'Moved the player. That game was already sent: open it and press Send to new players to email them.'
          : 'Moved the player to the other game.',
        type: target?.completed ? 'info' : 'success',
      });
    } catch (e) {
      setToast({ message: errorMessage(e, 'That player could not be moved.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removePlayer = async (player: EscapeRoomPlayer) => {
    if (!detail) return;
    setBusy(true);
    try {
      applyDetail(await escapeRoomService.removePlayer(detail.id, player.waiver_id));
      setRemovingId(null);
      setToast({ message: `Removed ${player.name || 'the player'} from this game.`, type: 'success' });
    } catch (e) {
      setToast({ message: errorMessage(e, 'That player could not be removed.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const resend = async (player: EscapeRoomPlayer) => {
    if (!detail) return;
    const typed = resendEmail.trim();
    setBusy(true);
    try {
      const data = await escapeRoomService.resendToPlayer(detail.id, player.waiver_id, typed || null);
      applyDetail(data);
      setResendId(null);
      setResendEmail('');
      const updated = data.players.find((row) => row.waiver_id === player.waiver_id);
      setToast({
        message:
          updated?.delivery?.status === 'sent'
            ? typed
              ? `Sent the group photo to ${typed}.`
              : `Sent the group photo to ${player.name || 'the player'} again.`
            : 'The photo has not gone through yet. It will be retried automatically.',
        type: updated?.delivery?.status === 'sent' ? 'success' : 'info',
      });
    } catch (e) {
      setToast({ message: errorMessage(e, 'The photo could not be sent.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const correctMinutesValue = correctMinutes.trim() === '' ? null : Number(correctMinutes);
  const correctSecondsValue = correctSeconds.trim() === '' ? 0 : Number(correctSeconds);
  const correctValid =
    !correctEscaped ||
    (correctMinutesValue !== null &&
      Number.isInteger(correctMinutesValue) &&
      Number.isInteger(correctSecondsValue) &&
      correctMinutesValue >= 0 &&
      correctMinutesValue <= 599 &&
      correctSecondsValue >= 0 &&
      correctSecondsValue <= 59 &&
      correctMinutesValue * 60 + correctSecondsValue > 0);

  const beginCorrect = () => {
    if (!detail) return;
    const [minutes = '', seconds = ''] = detail.escaped === false ? [] : (detail.completion_label ?? '').split(':');
    setCorrectEscaped(detail.escaped !== false);
    setCorrectMinutes(minutes);
    setCorrectSeconds(seconds);
    setCorrecting(true);
  };

  const saveCorrection = async () => {
    if (!detail || !correctValid) return;
    setBusy(true);
    try {
      const label = correctMinutesValue !== null ? `${correctMinutesValue}:${String(correctSecondsValue).padStart(2, '0')}` : null;
      applyDetail(await escapeRoomService.correctResult(detail.id, correctEscaped, correctEscaped ? label : null));
      setCorrecting(false);
      setToast({
        message: detail.can_resend
          ? "Recorded result corrected. Emails already sent can't be changed; use Resend to send players the corrected time."
          : "Recorded result corrected. Emails already sent can't be changed.",
        type: 'success',
      });
    } catch (e) {
      setToast({ message: errorMessage(e, 'The result could not be corrected.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copyPhotoLink = async () => {
    if (!detail?.photo_link) return;
    try {
      await navigator.clipboard.writeText(detail.photo_link);
      setToast({ message: 'Photo link copied.', type: 'success' });
    } catch {
      setToast({ message: 'Copying is blocked in this browser. Use Show photo QR instead.', type: 'info' });
    }
  };

  const linkBooking = async (player: EscapeRoomPlayer, value: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      applyDetail(await escapeRoomService.linkBooking(detail.id, player.waiver_id, value ? Number(value) : null));
    } catch (e) {
      setToast({ message: errorMessage(e, 'That booking could not be linked.'), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!effectiveLocationId) {
    return (
      <div className="min-h-screen px-6 py-8">
        <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-8">
          <MapPin className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Choose a location first</h1>
          <p className="text-gray-600 text-sm">
            {isCompanyAdmin
              ? 'Pick a location in the sidebar. Escape-room games are listed per location.'
              : 'Your account is not assigned to a location yet. Ask a manager to set one.'}
          </p>
        </div>
      </div>
    );
  }

  const kioskUrl = day?.kiosk_url ?? detail?.kiosk_url ?? null;
  const roomsWithoutWaiver = (day?.rooms ?? []).filter((room) => !room.has_waiver);
  const allSlots = (day?.rooms ?? []).flatMap((room) => room.slots);
  const notSentCount = allSlots.filter((slot) => slot.is_past && !slot.completed && (slot.signed > 0 || slot.photos > 0)).length;
  const sendProblemCount = allSlots.filter((slot) => slot.status === 'send_problem').length;
  const photoWaitingCount = allSlots.filter((slot) => slot.status === 'photo_ready' && !slot.is_past).length;
  const unsentEarlier = day?.is_today ? day.unsent_earlier ?? [] : [];

  const openEarlierGame = (game: { session_id: number; date: string }) => {
    pendingSession.current = game.session_id;
    followToday.current = false;
    if (game.date === date) {
      void loadDay();
    } else {
      setDate(game.date);
    }
  };

  const renderPlayer = (player: EscapeRoomPlayer, excluded = false) => (
    <li key={player.waiver_id} className="py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {player.name || 'Unnamed signer'}
            {player.minors > 0 && (
              <span className="ml-2 text-xs font-medium text-gray-500">
                + {player.minors} {player.minors === 1 ? 'minor' : 'minors'}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {player.has_email ? player.email_masked : 'No email on this waiver'}
            </span>
            {player.booking_reference && <span>Booking {player.booking_reference}</span>}
            {player.reference_number && <span>{player.reference_number}</span>}
          </p>
          {excluded && player.excluded_reason && (
            <p className="text-xs text-amber-700 mt-0.5">
              {EXCLUDED_LABELS[player.excluded_reason]}. They will not be sent this photo.
              {player.is_sign_in && player.excluded_reason !== 'other_location' && !player.sent && ' If they played this game, set Booking to Not linked to include them.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {player.photo_release === false && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Declined photo release</span>
          )}
          {player.sent && player.delivery && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                player.delivery.status === 'sent'
                  ? 'bg-emerald-100 text-emerald-800'
                  : player.delivery.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
              title={player.delivery.error ?? undefined}
            >
              {player.delivery.is_duplicate
                ? 'Same email as another player'
                : player.delivery.status === 'sent'
                  ? 'Photo sent'
                  : player.delivery.status === 'failed'
                    ? player.delivery.gave_up
                      ? 'Could not be delivered'
                      : 'Send failed, retrying'
                    : 'Sending'}
            </span>
          )}
          {!excluded && player.thanks_email && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                player.thanks_email.status === 'sent'
                  ? 'bg-emerald-100 text-emerald-800'
                  : player.thanks_email.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
              title={player.thanks_email.error ?? undefined}
            >
              {player.thanks_email.status === 'sent'
                ? 'Thank-you sent'
                : player.thanks_email.status === 'failed'
                  ? 'Thank-you not delivered'
                  : player.thanks_email.status === 'scheduled' || player.thanks_email.status === 'sending'
                    ? 'Thank-you sending'
                    : 'Thank-you not sent'}
            </span>
          )}
          {!excluded && player.thanks_email && ['failed', 'skipped', 'canceled'].includes(player.thanks_email.status)
            && (player.thanks_email.reason !== 'left_game' || Number(player.thanks_email.waiver_id) === Number(player.waiver_id)) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => player.thanks_email && void followUpAction(player.thanks_email.id, 'send')}
              className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-40"
            >
              Send thank-you again
            </button>
          )}
          {!excluded && player.review && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                player.review.rating !== null
                  ? 'bg-amber-100 text-amber-800'
                  : player.review.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-50 text-blue-800'
              }`}
              title={player.review.comment ?? player.review.error ?? undefined}
            >
              {player.review.rating !== null
                ? `Rated ${player.review.rating}/5`
                : player.review.status === 'scheduled'
                  ? `Review request ${followUpTime(player.review.due_at)}`
                  : player.review.status === 'sent'
                    ? 'Review request sent'
                    : player.review.status === 'failed'
                      ? 'Review request not delivered'
                      : 'No review request'}
            </span>
          )}
          {!excluded && player.review && player.review.rating === null && player.review.status === 'scheduled' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => player.review && void followUpAction(player.review.id, 'send')}
                className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-40"
              >
                Send review now
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => player.review && void followUpAction(player.review.id, 'cancel')}
                className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-40"
              >
                Don&apos;t ask for a review
              </button>
            </>
          )}
          {!excluded && player.review && player.review.rating === null
            && (player.review.status === 'failed'
              || (player.review.status === 'canceled' && player.review.reason === 'left_game' && Number(player.review.waiver_id) === Number(player.waiver_id))) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => player.review && void followUpAction(player.review.id, 'send')}
              className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-40"
            >
              {player.review.status === 'failed' ? 'Send review again' : 'Send review now'}
            </button>
          )}
          {player.sent && !excluded && detail?.can_resend && !player.delivery?.is_duplicate && (
            <button
              type="button"
              onClick={() => {
                setResendId(resendId === player.waiver_id ? null : player.waiver_id);
                setResendEmail('');
              }}
              className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900"
            >
              Resend
            </button>
          )}
          {!player.sent && (
            <>
              {(player.is_sign_in || !player.booking_id) && (
                <button
                  type="button"
                  onClick={() => beginMove(player)}
                  className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900"
                >
                  Wrong game? Move
                </button>
              )}
              {(player.is_sign_in || !player.booking_id) && (
                <button
                  type="button"
                  onClick={() => setRemovingId(player.waiver_id)}
                  className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {resendId === player.waiver_id && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600 flex flex-col gap-1 flex-1 min-w-[200px]">
            Send to
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder={player.delivery?.status === 'sent' || player.email_masked ? 'Leave empty for the last address it went to' : 'Email address'}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            />
          </label>
          <StandardButton size="sm" onClick={() => void resend(player)} disabled={busy || (!player.has_email && player.delivery?.status !== 'sent' && resendEmail.trim() === '')} loading={busy} icon={Send}>
            Send photo
          </StandardButton>
          <StandardButton size="sm" variant="ghost" onClick={() => setResendId(null)}>
            Cancel
          </StandardButton>
          <p className="basis-full text-xs text-gray-500">Leave it empty to send to the last address the photo went to (or the waiver's address). The waiver itself is not changed.</p>
        </div>
      )}

      {removingId === player.waiver_id && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-900 flex-1 min-w-0">
            Remove {player.name || 'this player'} from this game? They will not be sent this game's photo or follow-up emails. Their signed waiver is kept.
          </p>
          <StandardButton size="sm" variant="danger" onClick={() => void removePlayer(player)} disabled={busy} loading={busy}>
            Remove
          </StandardButton>
          <StandardButton size="sm" variant="ghost" onClick={() => setRemovingId(null)}>
            Keep
          </StandardButton>
        </div>
      )}

      {detail && !player.sent && player.is_sign_in && (detail.bookings.length > 0 || player.booking_id !== null) && (
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Booking
          <select
            value={player.booking_id ?? ''}
            onChange={(e) => void linkBooking(player, e.target.value)}
            disabled={busy}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white"
          >
            <option value="">Not linked</option>
            {player.booking_id !== null && !detail.bookings.some((booking) => booking.id === player.booking_id) && (
              <option value={player.booking_id} disabled>
                {player.booking_reference ?? 'Earlier booking'} (cancelled or moved)
              </option>
            )}
            {detail.bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.name} · {booking.reference_number}
              </option>
            ))}
          </select>
        </label>
      )}

      {movingId === player.waiver_id && day && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Room
            <select
              value={moveRoomId ?? ''}
              onChange={(e) => {
                setMoveRoomId(Number(e.target.value) || null);
                setMoveTime('');
              }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              {day.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Time
            <select
              value={moveTime}
              onChange={(e) => setMoveTime(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Choose a time</option>
              {moveTimes.map((slot) => (
                <option key={slot.time} value={slot.time}>
                  {slot.time_label}
                  {slot.completed ? ' (sent)' : slot.is_past ? ' (finished)' : ''}
                </option>
              ))}
            </select>
          </label>
          <StandardButton size="sm" onClick={() => void confirmMove()} disabled={!moveTime || busy} loading={busy}>
            Move player
          </StandardButton>
          <StandardButton size="sm" variant="ghost" onClick={() => setMovingId(null)}>
            Cancel
          </StandardButton>
        </div>
      )}
    </li>
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DoorOpen className={`w-6 h-6 text-${themeColor}-700`} />
              Escape Rooms
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {day?.location.name ?? 'Loading'} · {longDate(date)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => pickDate(shiftDate(date, -1))}
              aria-label="Previous day"
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>
            <CalendarDatePicker
              value={parseLocalDate(date)}
              onChange={(picked) => pickDate(dateKey(picked))}
              label=""
              highlight="day"
              themeColor={themeColor}
              fullColor={fullColor}
              align="right"
              buttonClassName="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
            />
            <button
              type="button"
              onClick={() => pickDate(shiftDate(date, 1))}
              aria-label="Next day"
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
            {day && !day.is_today && (
              <StandardButton size="sm" variant="secondary" onClick={() => pickDate(day.today)}>
                Today
              </StandardButton>
            )}
            <StandardButton size="sm" variant="secondary" icon={RefreshCw} onClick={() => void loadDay()} disabled={dayLoading}>
              Refresh
            </StandardButton>
            {kioskUrl && (
              <StandardButton size="sm" icon={QrCode} onClick={() => setQrMode('checkin')}>
                Guest check-in
              </StandardButton>
            )}
          </div>
        </div>

        {day && !day.email_available && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            Email is not switched on for this site yet, so escape-room photos cannot be sent. You can still take the photo now and send it once email is on.
          </p>
        )}
        {roomsWithoutWaiver.length > 0 && (
          <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              No escape-room waiver covers {roomsWithoutWaiver.map((room) => room.name).join(', ')} yet, so guests cannot check in to{' '}
              {roomsWithoutWaiver.length === 1 ? 'it' : 'them'}.{' '}
              {canManageSetup ? (
                <Link to="/waivers/templates/create?kind=escape_room" className="font-semibold underline underline-offset-2">
                  Create an escape-room waiver
                </Link>
              ) : (
                'Ask a manager to create an escape-room waiver.'
              )}
            </span>
          </p>
        )}
        {dayError && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{dayError}</p>
        )}
        {unsentEarlier.length > 0 && (
          <div className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {unsentEarlier.length === 1 ? 'A game from an earlier day was' : `${unsentEarlier.length} games from earlier days were`} never sent or finished
            </p>
            <ul className="mt-1 space-y-1">
              {unsentEarlier.map((game) => (
                <li key={game.session_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {parseLocalDate(game.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {game.room_name ?? 'Escape room'} · {game.time_label}
                    {' · '}
                    {game.players} {game.players === 1 ? 'player' : 'players'} signed{game.has_photo ? ', photo started' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEarlierGame(game)}
                    className="inline-flex items-center min-h-[36px] font-semibold underline underline-offset-2"
                  >
                    Open game
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {day && (notSentCount > 0 || sendProblemCount > 0 || photoWaitingCount > 0 || day.rooms.some((room) => room.slots.length > 0)) && (
          <div className={`mb-4 flex-wrap items-center gap-2 ${detail ? 'hidden lg:flex' : 'flex'}`}>
            {notSentCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                {notSentCount} {notSentCount === 1 ? 'game' : 'games'} not sent yet
              </span>
            )}
            {sendProblemCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                {sendProblemCount} {sendProblemCount === 1 ? 'game has' : 'games have'} emails that did not go through
              </span>
            )}
            {photoWaitingCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                {photoWaitingCount} {photoWaitingCount === 1 ? 'photo' : 'photos'} waiting to be sent
              </span>
            )}
            <label className="ml-auto inline-flex items-center gap-2 min-h-[36px] text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={busyOnly} onChange={toggleBusyOnly} className={`h-4 w-4 shrink-0 accent-${themeColor}-700`} />
              Only games with bookings or players
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={detail ? 'hidden lg:block lg:col-span-2 space-y-4' : 'lg:col-span-5 space-y-4'}>
            {!day && dayLoading && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">Loading games...</div>
            )}
            {day && day.rooms.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <DoorOpen className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-semibold text-gray-900">No escape rooms at this location yet</p>
                <p className="text-sm text-gray-600 mt-1">
                  {canManageSetup ? (
                    <>
                      Turn on "This package is an escape room" in{' '}
                      <Link to="/packages" className={`font-semibold text-${themeColor}-700 underline underline-offset-2`}>
                        Packages
                      </Link>{' '}
                      for each room, then create an escape-room waiver.
                    </>
                  ) : (
                    'Ask a manager to switch on the escape rooms for this location.'
                  )}
                </p>
              </div>
            )}
            {day?.rooms.map((room) => {
              const shownSlots = busyOnly
                ? room.slots.filter((slot) => slotHasActivity(slot) || (detail?.room.id === room.id && detail?.session_time === slot.time))
                : room.slots;
              return (
              <section key={room.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <header className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-gray-900">{room.name}</h2>
                  <span className="text-xs text-gray-500">
                    {room.duration_minutes} min{!room.is_active && ' · inactive'}
                  </span>
                </header>
                {room.slots.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500">No games scheduled on this day.</p>
                ) : shownSlots.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500">
                    No bookings or players yet.{' '}
                    <button type="button" onClick={toggleBusyOnly} className={`font-semibold text-${themeColor}-700 underline underline-offset-2`}>
                      Show all times
                    </button>
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {shownSlots.map((slot) => {
                      const selected = detail?.room.id === room.id && detail?.session_time === slot.time;
                      const pastUnsent = slot.is_past && !slot.completed && (slot.signed > 0 || slot.photos > 0);
                      const pastEmpty = slot.is_past && !slot.completed && slot.signed === 0 && slot.photos === 0;
                      const openSlotEmpty = !slot.is_past && slot.status === 'waiting' && slot.bookings.length === 0;
                      const badgeText = pastUnsent
                        ? 'Not sent yet'
                        : pastEmpty
                          ? slot.bookings.length > 0
                            ? 'Nobody signed'
                            : 'No players'
                          : openSlotEmpty
                            ? 'Open'
                            : `${STATUS_LABELS[slot.status]}${slot.completed && slot.completion_label ? ` · ${slot.completion_label}` : ''}${
                                slot.status === 'send_problem' && slot.not_delivered ? ` · ${slot.not_delivered} not delivered` : ''
                              }`;
                      const badgeStyle = pastUnsent
                        ? 'bg-red-100 text-red-700'
                        : pastEmpty
                          ? 'bg-gray-100 text-gray-500'
                          : openSlotEmpty
                            ? 'bg-gray-50 text-gray-500'
                            : STATUS_STYLES[slot.status];
                      return (
                        <li key={slot.key}>
                          <button
                            type="button"
                            onClick={() => void openSlot(room.id, slot)}
                            disabled={openingKey !== null || busy}
                            className={`w-full text-left px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-gray-50 transition ${
                              selected ? `bg-${themeColor}-50` : ''
                            } ${pastEmpty ? 'opacity-60' : ''}`}
                          >
                            <span className="w-20 text-sm font-bold text-gray-900 tabular-nums">
                              {slot.time_label}
                              {slot.in_progress && (slot.bookings.length > 0 || slot.signed > 0) && (
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Playing now</span>
                              )}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>{badgeText}</span>
                            <span className="basis-full sm:basis-auto sm:flex-1 order-last sm:order-none min-w-0 text-xs text-gray-600 sm:truncate">
                              {slot.bookings.length > 0
                                ? slot.bookings.map((booking) => `${booking.name} (${booking.participants})`).join(', ')
                                : 'No booking'}
                            </span>
                            <span className="text-xs text-gray-700 inline-flex items-center gap-1 tabular-nums">
                              <Users className="w-3.5 h-3.5" />
                              {slot.signed} signed
                              {slot.unsigned > 0 && <span className="text-amber-700">· {slot.unsigned} not signed</span>}
                            </span>
                            {openingKey === slot.key && <span className="text-xs text-gray-400">Opening...</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              );
            })}
          </div>

          {detail && (
            <div ref={detailPanel} className="lg:col-span-3 space-y-4 scroll-mt-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <button
                type="button"
                onClick={closeDetail}
                className={`lg:hidden inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-${themeColor}-700`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back to all games
              </button>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{longDate(detail.session_date)}</p>
                    <h2 className="text-xl font-bold text-gray-900">
                      {detail.room.name} · {detail.session_time_label}
                    </h2>
                    {detail.bookings.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {detail.bookings.map((booking) => (
                          <li key={booking.id} className="text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link to={`/bookings/${booking.id}`} className={`font-semibold text-${themeColor}-700 underline underline-offset-2`}>
                              {booking.name}
                            </Link>
                            <span>
                              {booking.reference_number} · {booking.participants} booked
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                            </span>
                            {booking.status === 'confirmed' && day?.is_today && (
                              <button
                                type="button"
                                onClick={() => void checkInBooking(booking.reference_number)}
                                disabled={busy}
                                className="inline-flex items-center min-h-[36px] px-2 text-xs font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900 disabled:opacity-50"
                              >
                                Check in booking
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600 mt-1">No booking at this time.</p>
                    )}
                  </div>
                  <button type="button" onClick={closeDetail} aria-label="Close game" className="p-1.5 rounded hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {detail.completed && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-emerald-900">
                      <p className="font-semibold">
                        Completed · {detail.escaped === false ? 'Did not escape' : `Finish time ${detail.completion_label}`}
                      </p>
                      <p>
                        {detail.completed_without_photo
                          ? detail.players.some((player) => player.thanks_email?.status === 'sent')
                            ? `Recorded without a group photo; the ${thanksName} email went to ${players(detail.players.filter((player) => player.thanks_email?.status === 'sent').length)}`
                            : detail.players.some((player) => player.review)
                              ? 'Recorded without a group photo; the players get a review request later'
                              : 'Recorded without a group photo, so no email was sent'
                          : `Photo emailed to ${detail.counts.emailed} ${detail.counts.emailed === 1 ? 'player' : 'players'}`}
                        {detail.completed_by_name && ` · completed by ${detail.completed_by_name}`}
                        {detail.completed_at && ` at ${new Date(detail.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}.
                      </p>
                      {detail.completed_without_photo && (detail.counts.thanks_failed ?? 0) > 0 && (
                        <p className="text-red-700">
                          {detail.counts.thanks_failed} {detail.counts.thanks_failed === 1 ? 'thank-you email has' : 'thank-you emails have'} not gone through. Use Send thank-you again next to the player.
                        </p>
                      )}
                      {detail.counts.retrying > 0 && (
                        <p className="text-amber-800">
                          {detail.counts.retrying} {detail.counts.retrying === 1 ? 'email has' : 'emails have'} not gone through yet and will be retried automatically.
                        </p>
                      )}
                      {detail.counts.failed > 0 && (
                        <p className="text-red-700">
                          {detail.counts.failed} {detail.counts.failed === 1 ? 'email could' : 'emails could'} not be delivered after several tries.{detail.can_resend ? ' Use Resend next to the player to send it to a corrected address.' : ''}
                        </p>
                      )}
                      {detail.counts.sending > 0 && detail.counts.stuck === 0 && (
                        <p>{detail.counts.sending} still sending.</p>
                      )}
                      {followUp?.reviews && followUp.reviews.scheduled + followUp.reviews.sent + followUp.reviews.rated > 0 && (
                        <p className="text-emerald-800">
                          Review requests: {followUp.reviews.scheduled > 0 && `${followUp.reviews.scheduled} waiting${followUp.reviews.next_due_at ? ` (next ${followUpTime(followUp.reviews.next_due_at)})` : ''}`}
                          {followUp.reviews.scheduled > 0 && followUp.reviews.sent > 0 && ' · '}
                          {followUp.reviews.sent > 0 && `${followUp.reviews.sent} sent`}
                          {followUp.reviews.rated > 0 && ` · ${followUp.reviews.rated} rated${followUp.reviews.average_rating !== null ? `, average ${followUp.reviews.average_rating}/5` : ''}`}
                          .
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {detail.completed && detail.counts.stuck > 0 && (
                  <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {detail.counts.stuck} {detail.counts.stuck === 1 ? 'email did' : 'emails did'} not finish sending. Press the send button below to try again.
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Players ({detail.counts.players})</h3>
                  {kioskUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const room = day?.rooms.find((candidate) => candidate.id === detail.room.id);
                        const slot = room?.slots.find((candidate) => candidate.time === detail.session_time);
                        const guestsCanPick = Boolean(day?.is_today && room?.is_active && room?.has_waiver && slot?.check_in_open && !detail.completed_without_photo);
                        setQrMode(guestsCanPick ? 'game' : 'checkin');
                      }}
                      className={`text-xs font-semibold text-${themeColor}-700 inline-flex items-center gap-1`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Show check-in QR
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Everyone who signed the waiver for this room and time. Only these players can receive this game's photo.
                </p>
                {detail.players.length === 0 ? (
                  <p className="text-sm text-gray-500 py-3">Nobody has signed for this game yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">{detail.players.map((player) => renderPlayer(player))}</ul>
                )}
                {detail.counts.unsigned > 0 && (
                  <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {detail.counts.unsigned} waiver {detail.counts.unsigned === 1 ? 'link' : 'links'} from the booking {detail.counts.unsigned === 1 ? 'has' : 'have'} not been signed yet.
                  </p>
                )}
                {detail.excluded_players.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Left out of this game</h4>
                    <ul className="divide-y divide-gray-100">{detail.excluded_players.map((player) => renderPlayer(player, true))}</ul>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Camera className={`w-4 h-4 text-${themeColor}-700`} />
                  Group photo
                </h3>
                {!photoSession ? (
                  detail.completed ? (
                    <p className="text-sm text-gray-500">No photo was taken for this game.</p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        The room's overlay and today's date are added to the photo automatically.
                      </p>
                      {declinedRelease > 0 && (
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          {declinedRelease} {declinedRelease === 1 ? 'player' : 'players'} declined the photo release on their waiver. Ask them before taking the group photo.
                        </p>
                      )}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className={`mt-1 h-5 w-5 shrink-0 accent-${themeColor}-700`}
                        />
                        <span className="text-sm text-gray-800">I asked the group and they agreed to have their photo taken.</span>
                      </label>
                      <StandardButton onClick={() => void startPhoto()} disabled={!consent || busy} loading={busy} icon={Camera}>
                        Start group photo
                      </StandardButton>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {!detail.completed && (
                      <>
                        <div className="bg-black rounded-xl overflow-hidden aspect-[4/3] relative">
                          <video ref={camera.videoRef} playsInline muted className="w-full h-full object-cover" />
                          {camera.state !== 'live' && (
                            <div className="absolute inset-0 bg-gray-900/95 text-white flex items-center justify-center p-6 text-center">
                              <div>
                                {camera.state === 'denied' || camera.state === 'unavailable' || camera.state === 'lost' ? (
                                  <>
                                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                                    <p className="font-semibold mb-1">Camera unavailable</p>
                                    <p className="text-sm text-gray-300 max-w-xs">{camera.error}</p>
                                    <p className="text-sm text-gray-300 mt-2">You can still upload a photo from this device.</p>
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                    <p className="text-sm text-gray-300">Turn on the camera, or upload a photo.</p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {camera.state === 'live' ? (
                            <StandardButton onClick={() => void takePhoto()} disabled={atCap || busy} icon={Camera}>
                              Take photo
                            </StandardButton>
                          ) : (
                            <StandardButton onClick={() => void startCamera()} disabled={atCap || busy} icon={Camera}>
                              Turn on camera
                            </StandardButton>
                          )}
                          <StandardButton variant="secondary" onClick={() => fileInput.current?.click()} disabled={atCap || busy} icon={Upload}>
                            Upload from device
                          </StandardButton>
                          <input
                            ref={fileInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadPhoto(file);
                            }}
                          />
                        </div>
                        {atCap && (
                          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            {maxPhotos} photos is the most one game can hold. Remove one to swap it out.
                          </p>
                        )}
                      </>
                    )}

                    {photos.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">No photos yet</p>
                      </div>
                    ) : (
                      <ul className="grid grid-cols-3 gap-3">
                        {photos.map((photo, index) => (
                          <li key={photo.id} className="space-y-1">
                            {photo.thumbnail_url ? (
                              <img
                                src={photo.thumbnail_url}
                                alt={`Group photo ${index + 1}`}
                                className={`w-full aspect-square rounded-lg object-cover bg-gray-100 ${removingPhotoId === photo.id ? 'ring-2 ring-red-500' : ''}`}
                              />
                            ) : (
                              <div className="w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            {photo.processing_status === 'failed' && <p className="text-xs text-red-600">Processing failed</p>}
                            {detail.completed && detail.photo_link && photo.processing_status === 'ready' && detail.slideshow?.enabled && (
                              photo.slideshow_eligible && (photo.shows_in_slideshow || photo.slideshow_approval_status === 'pending') ? (
                                <div className="text-center">
                                  <p className="text-[11px] font-semibold text-emerald-700">
                                    {photo.shows_in_slideshow ? 'On the venue slideshow' : 'Waiting for slideshow approval'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => void setSlideshow(photo, false)}
                                    disabled={busy}
                                    className="inline-flex items-center min-h-[36px] px-1 text-[11px] font-semibold text-gray-600 underline underline-offset-2 disabled:opacity-50"
                                  >
                                    Take off slideshow
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void setSlideshow(photo, true)}
                                  disabled={busy || (detail.slideshow?.declined ?? 0) > 0}
                                  title={(detail.slideshow?.declined ?? 0) > 0 ? 'A player declined the photo release' : undefined}
                                  className={`w-full inline-flex items-center justify-center gap-1 min-h-[36px] px-1 text-[11px] font-semibold text-${themeColor}-700 underline underline-offset-2 disabled:opacity-40 disabled:no-underline`}
                                >
                                  <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
                                  Add to venue slideshow
                                </button>
                              )
                            )}
                            {!detail.completed && (
                              <div className="flex flex-wrap items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => void movePhoto(photo.id, -1)}
                                  disabled={index === 0 || busy}
                                  aria-label="Move earlier"
                                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void movePhoto(photo.id, 1)}
                                  disabled={index === photos.length - 1 || busy}
                                  aria-label="Move later"
                                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                >
                                  <ArrowRight className="w-4 h-4 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemovingPhotoId(photo.id)}
                                  disabled={busy}
                                  aria-label="Remove photo"
                                  className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {removingPhotoId !== null && !detail.completed && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-red-900 flex-1 min-w-0">
                          Remove photo {Math.max(1, photos.findIndex((photo) => photo.id === removingPhotoId) + 1)}? This cannot be undone.
                        </p>
                        <StandardButton
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const target = removingPhotoId;
                            setRemovingPhotoId(null);
                            void removePhoto(target);
                          }}
                          disabled={busy}
                        >
                          Remove photo
                        </StandardButton>
                        <StandardButton size="sm" variant="ghost" onClick={() => setRemovingPhotoId(null)}>
                          Keep
                        </StandardButton>
                      </div>
                    )}

                    {detail.completed && detail.photo_link && detail.slideshow && (
                      detail.slideshow.declined > 0 ? (
                        <p className="text-xs text-amber-800">
                          {detail.slideshow.declined} {detail.slideshow.declined === 1 ? 'player' : 'players'} declined the photo release, so this game's photo can't go on the venue slideshow.
                        </p>
                      ) : !detail.slideshow.enabled ? (
                        <p className="text-xs text-gray-500">The venue slideshow is switched off for this location, so it has no Add button here.</p>
                      ) : (
                        <p className="text-xs text-gray-500">Photos stay off the venue slideshow unless you add them.</p>
                      )
                    )}

                    {slideshowConfirmId !== null && slideshowNote && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-amber-900 flex-1 min-w-0">{slideshowNote}</p>
                        <StandardButton
                          size="sm"
                          onClick={() => {
                            const target = photos.find((photo) => photo.id === slideshowConfirmId);
                            if (target) void setSlideshow(target, true, true);
                          }}
                          disabled={busy}
                        >
                          The group agreed, show it
                        </StandardButton>
                        <StandardButton
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSlideshowConfirmId(null);
                            setSlideshowNote(null);
                          }}
                        >
                          Keep it off
                        </StandardButton>
                      </div>
                    )}

                    {readyPhotos.length > 0 && readyPhotos[0].delivery_url && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          {detail.completed ? 'What players got' : 'What players will get'}
                          {readyPhotos.length > 1 && ` (all ${readyPhotos.length} photos are sent; the first is shown here)`}
                        </p>
                        <img
                          src={readyPhotos[0].delivery_url}
                          alt="Branded preview"
                          className="w-full rounded-lg border border-gray-200 bg-gray-100 object-contain"
                          style={readyPhotos[0].width && readyPhotos[0].height ? { aspectRatio: `${readyPhotos[0].width} / ${readyPhotos[0].height}` } : undefined}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!detail.completed ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Timer className={`w-4 h-4 text-${themeColor}-700`} />
                    Finish time
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="escape-result"
                        checked={escaped}
                        onChange={() => setEscaped(true)}
                        className={`h-4 w-4 accent-${themeColor}-700`}
                      />
                      They escaped
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="escape-result"
                        checked={!escaped}
                        onChange={() => setEscaped(false)}
                        className={`h-4 w-4 accent-${themeColor}-700`}
                      />
                      They didn't escape
                    </label>
                  </div>
                  {escaped && (
                    <fieldset>
                      <legend className="text-sm font-medium text-gray-800">{countingDown ? 'Time left on the clock' : 'How long they took'}</legend>
                      {roomMinutes !== null && (
                        <div className="mt-1 mb-1 inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs font-semibold" role="group" aria-label="What you are entering">
                          <button
                            type="button"
                            onClick={() => setEntryMode('used')}
                            aria-pressed={!countingDown}
                            className={`min-h-[36px] px-3 ${!countingDown ? `bg-${themeColor}-700 text-white` : 'bg-white text-gray-700'}`}
                          >
                            Time used
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryMode('left')}
                            aria-pressed={countingDown}
                            className={`min-h-[36px] px-3 border-l border-gray-300 ${countingDown ? `bg-${themeColor}-700 text-white` : 'bg-white text-gray-700'}`}
                          >
                            Time left on clock
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        {countingDown
                          ? `Type what the clock showed when they got out. The time used is worked out from the room's ${roomMinutes} minutes.`
                          : 'Time used, not time left on the clock.'}
                        {!countingDown && roomMinutes && roomMinutes * 60 > 768
                          ? ` In a ${roomMinutes}-minute room with 12:48 left, enter ${Math.floor((roomMinutes * 60 - 768) / 60)}:${String((roomMinutes * 60 - 768) % 60).padStart(2, '0')}, or switch to Time left on clock.`
                          : ''}
                      </p>
                      <div className="mt-1 flex items-end gap-2">
                        <label className="flex flex-col text-xs text-gray-500">
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label="Minutes"
                            value={finishMinutes}
                            onChange={(e) => typeMinutes(e.target.value)}
                            placeholder="mm"
                            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold tabular-nums text-center"
                          />
                          <span className="mt-1 text-center">minutes</span>
                        </label>
                        <span className="pb-7 text-lg font-semibold text-gray-700">:</span>
                        <label className="flex flex-col text-xs text-gray-500">
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label="Seconds"
                            ref={secondsInput}
                            value={finishSeconds}
                            onChange={(e) => setFinishSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                            placeholder="ss"
                            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold tabular-nums text-center"
                          />
                          <span className="mt-1 text-center">seconds</span>
                        </label>
                      </div>
                      {finishEntered && !finishTimeValid && (
                        <span className="block text-xs text-red-600 mt-1">
                          {countingDown && typedValid ? `The time left must be less than the room's ${roomMinutes} minutes.` : 'Enter minutes, and seconds from 0 to 59.'}
                        </span>
                      )}
                      {countingDown && finishTimeValid && finishLabel && (
                        <span className="block text-sm text-gray-800 mt-1">
                          They took <strong className="tabular-nums">{finishLabel}</strong>.
                        </span>
                      )}
                      {finishVeryFast && (
                        <span className="block text-xs text-amber-700 mt-1">
                          That is under a quarter of this room's {roomMinutes} minutes.{' '}
                          {countingDown ? 'Check you typed the time left on the clock, not the time used.' : 'Check it is the time used, not the time left.'}
                        </span>
                      )}
                      {finishLongerThanRoom && (
                        <span className="block text-xs text-amber-700 mt-1">
                          That is longer than this room's {roomMinutes} minutes. Check the time before sending.
                        </span>
                      )}
                    </fieldset>
                  )}

                  {(detail.blockers.length > 0 || (escaped && !finishEntered)) && (
                    <ul className="text-sm text-gray-600 space-y-1">
                      {[...detail.blockers, ...(escaped && !finishEntered ? ["Enter how long the group took, or choose They didn't escape."] : [])].map((blocker) => (
                        <li key={blocker} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  )}

                  {followUp?.available && (
                    <p className="text-xs text-gray-500">
                      {thanksOn ? (
                        <>
                          Players get the{' '}
                          <Link to={emailSettingsPath} className="underline">
                            {thanksName}
                          </Link>{' '}
                          email with the photo and finish time
                          {thanksPromo ? `, plus promo code ${thanksPromo.code} (${thanksPromo.offer})` : ''}.
                          {reviewHours !== null ? ` A review request follows about ${reviewHours} ${reviewHours === 1 ? 'hour' : 'hours'} later.` : ''}
                          {promoProblem ? ` ${promoProblem}` : ''}
                        </>
                      ) : (
                        <>
                          The{' '}
                          <Link to={emailSettingsPath} className="underline">
                            {thanksName}
                          </Link>{' '}
                          email is switched off in Email Notifications, so the photo cannot be emailed.
                        </>
                      )}
                    </p>
                  )}

                  {confirming ? (
                    <div className={`border border-${themeColor}-700 rounded-xl p-4 space-y-3`}>
                      <p className="text-sm text-gray-900">
                        Send the {thanksName} email with the group photo to {players(recipients)} in {detail.room.name} at{' '}
                        {detail.session_time_label}
                        {escaped ? ` with a finish time of ${finishLabel}` : ", marked as didn't escape"}? This can only be done once.
                      </p>
                      {(thanksPromo || reviewHours !== null) && (
                        <p className="text-sm text-gray-600">
                          {thanksPromo ? `It includes promo code ${thanksPromo.code} (${thanksPromo.offer}) for their next visit.` : ''}
                          {thanksPromo && reviewHours !== null ? ' ' : ''}
                          {reviewHours !== null ? `Each player gets a review request about ${reviewHours} ${reviewHours === 1 ? 'hour' : 'hours'} later.` : ''}
                        </p>
                      )}
                      <ul className="text-sm text-gray-700 space-y-0.5">
                        {recipientPlayers.map((player) => (
                          <li key={player.waiver_id} className="flex flex-wrap gap-x-2">
                            <span className="font-medium text-gray-900">{player.name || 'Unnamed signer'}</span>
                            <span className="text-gray-500">{player.email_masked}</span>
                          </li>
                        ))}
                      </ul>
                      {noEmailPlayers.length > 0 && (
                        <p className="text-sm text-amber-800">
                          No email on the waiver, so no photo: {noEmailPlayers.map((player) => player.name || 'Unnamed signer').join(', ')}.
                        </p>
                      )}
                      {(detail.players_booked ?? 0) > (detail.counts.people ?? detail.counts.players) && (
                        <p className="text-sm text-amber-800">
                          Booked for {detail.players_booked} people. Signed waivers cover {detail.counts.people ?? detail.counts.players}. The others won't get the photo unless they sign first.
                        </p>
                      )}
                      {finishLongerThanRoom && (
                        <p className="text-sm text-amber-800">
                          {finishLabel} is longer than this room's {roomMinutes} minutes. Make sure it is right.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <StandardButton onClick={() => void complete()} loading={busy} disabled={busy || !finishTimeValid} icon={Send}>
                          Yes, complete and send
                        </StandardButton>
                        <StandardButton variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                          Not yet
                        </StandardButton>
                      </div>
                    </div>
                  ) : recordingOnly ? (
                    <div className="border border-gray-300 rounded-xl p-4 space-y-3">
                      <p className="text-sm text-gray-900">
                        Record {detail.room.name} at {detail.session_time_label}
                        {escaped ? ` with a finish time of ${finishLabel}` : " as didn't escape"} without a photo? A photo can't be added to this game later.
                      </p>
                      {canEmailPlayers && recipients > 0 ? (
                        <>
                          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={emailPlayersOnly}
                              onChange={(event) => setEmailPlayersOnly(event.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300"
                            />
                            <span>
                              {thanksOn
                                ? `Email ${players(recipients)} the ${thanksName} email without a photo${thanksPromo ? `, with promo code ${thanksPromo.code}` : ''}${reviewHours !== null ? ', and the review request later' : ''}.`
                                : `Send ${players(recipients)} a review request about ${reviewHours ?? 24} ${(reviewHours ?? 24) === 1 ? 'hour' : 'hours'} from now. The ${thanksName} email is switched off.`}
                            </span>
                          </label>
                          {!isTodayGame && (
                            <p className="text-xs text-amber-800">This game was on an earlier day, so the players are emailed now about a past visit. Leave the box unticked to record the result only.</p>
                          )}
                          <p className="text-xs text-gray-500">You can also email the players later from this game.</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">No email is sent.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <StandardButton variant="secondary" onClick={() => void recordWithoutPhoto()} loading={busy} disabled={busy || !finishTimeValid}>
                          Yes, record result only
                        </StandardButton>
                        <StandardButton variant="ghost" onClick={() => setRecordingOnly(false)} disabled={busy}>
                          Not yet
                        </StandardButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <StandardButton
                        onClick={() => setConfirming(true)}
                        disabled={!detail.can_complete || busy || !finishTimeValid}
                        icon={Send}
                      >
                        Complete &amp; Send
                      </StandardButton>
                      {detail.can_complete_without_photo && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmailPlayersOnly(isTodayGame);
                            setRecordingOnly(true);
                          }}
                          disabled={busy || !finishTimeValid || (escaped && !finishEntered)}
                          className="inline-flex items-center min-h-[40px] text-sm font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 disabled:opacity-40"
                        >
                          Group didn't want a photo? Record the result only
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  {detail.send_blocker && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      {detail.send_blocker}
                    </p>
                  )}
                  {!detail.send_blocker && (detail.counts.new_players > 0 || detail.counts.stuck > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-gray-800">
                        {[
                          detail.counts.new_players > 0
                            ? detail.completed_without_photo
                              ? `${detail.counts.new_players} ${detail.counts.new_players === 1 ? 'player has' : 'players have'} not been emailed${isTodayGame ? '' : ` (this game was on ${gameDayLabel})`}`
                              : `${detail.counts.new_players} ${detail.counts.new_players === 1 ? 'player has' : 'players have'} signed since the photo was sent`
                            : '',
                          detail.counts.stuck > 0 ? `${detail.counts.stuck} ${detail.counts.stuck === 1 ? 'email did' : 'emails did'} not finish sending` : '',
                        ]
                          .filter(Boolean)
                          .join(', and ')}
                        .
                      </p>
                      <StandardButton onClick={() => void sendToNew()} disabled={!detail.can_send_new || busy} loading={busy} icon={Send}>
                        {detail.completed_without_photo
                          ? thanksOn
                            ? `Email ${players(detail.counts.new_players)}`
                            : 'Schedule review requests'
                          : detail.counts.new_players > 0 && detail.counts.stuck > 0
                            ? 'Send now'
                            : detail.counts.new_players > 0
                              ? 'Send to new players'
                              : 'Try sending again'}
                      </StandardButton>
                    </div>
                  )}
                  {detail.photo_link && (
                    <div className="flex flex-wrap gap-2">
                      <StandardButton size="sm" variant="secondary" icon={QrCode} onClick={() => setQrMode('photo')}>
                        Show photo QR
                      </StandardButton>
                      <StandardButton size="sm" variant="secondary" icon={Copy} onClick={() => void copyPhotoLink()}>
                        Copy photo link
                      </StandardButton>
                      {detail.can_resend && resendTargets.length > 1 && !confirmResendAll && (
                        <StandardButton size="sm" variant="secondary" icon={Send} onClick={() => setConfirmResendAll(true)} disabled={busy}>
                          Resend to everyone
                        </StandardButton>
                      )}
                    </div>
                  )}
                  {confirmResendAll && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-800 flex-1 min-w-0">
                        Email the group photo again to all {resendTargets.length} players who got it{detail.escaped === false ? '' : `, with the finish time ${detail.completion_label}`}?
                      </p>
                      <StandardButton size="sm" onClick={() => void resendToEveryone()} loading={busy} disabled={busy} icon={Send}>
                        Send again
                      </StandardButton>
                      <StandardButton size="sm" variant="ghost" onClick={() => setConfirmResendAll(false)} disabled={busy}>
                        Cancel
                      </StandardButton>
                    </div>
                  )}
                  {correcting ? (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-900">Correct the recorded result</p>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                          <input type="radio" name="correct-result" checked={correctEscaped} onChange={() => setCorrectEscaped(true)} className={`h-4 w-4 accent-${themeColor}-700`} />
                          They escaped
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                          <input type="radio" name="correct-result" checked={!correctEscaped} onChange={() => setCorrectEscaped(false)} className={`h-4 w-4 accent-${themeColor}-700`} />
                          They didn't escape
                        </label>
                      </div>
                      {correctEscaped && (
                        <div className="flex items-end gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label="Corrected minutes"
                            value={correctMinutes}
                            onChange={(e) => setCorrectMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
                            placeholder="mm"
                            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold tabular-nums text-center"
                          />
                          <span className="pb-2 text-lg font-semibold text-gray-700">:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label="Corrected seconds"
                            value={correctSeconds}
                            onChange={(e) => setCorrectSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                            placeholder="ss"
                            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold tabular-nums text-center"
                          />
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        This fixes the record only. Emails already sent can't be changed{detail.can_resend ? '; use Resend to send the corrected time' : ''}.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <StandardButton size="sm" onClick={() => void saveCorrection()} disabled={busy || !correctValid} loading={busy}>
                          Save result
                        </StandardButton>
                        <StandardButton size="sm" variant="ghost" onClick={() => setCorrecting(false)}>
                          Cancel
                        </StandardButton>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={beginCorrect}
                      className="text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900"
                    >
                      Correct the recorded result
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {qrMode && (qrMode === 'photo' ? detail?.photo_link : kioskUrl) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex justify-end">
              <button type="button" onClick={() => setQrMode(null)} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {qrMode === 'photo' && detail?.photo_link ? (
              <>
                <h2 className="text-lg font-bold text-gray-900">Group photo page</h2>
                <p className="text-sm text-gray-600">
                  Players can scan this to open and download {detail.room.name}'s group photo on their own phones.
                </p>
                <div className="flex justify-center" ref={qrWrap}>
                  <QRCodeCanvas value={detail.photo_link} size={220} includeMargin />
                </div>
                <p className="text-xs text-gray-500 break-all select-all">{detail.photo_link}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <StandardButton size="sm" variant="secondary" icon={Download} onClick={() => downloadQr(`${detail.room.name ?? 'escape-room'}-photo`)}>
                    Download QR
                  </StandardButton>
                </div>
              </>
            ) : (
              (() => {
                const target =
                  qrMode === 'game' && detail ? `${kioskUrl}?room=${detail.room.id}&time=${detail.session_time}&date=${detail.session_date}` : kioskUrl ?? '';
                return (
                  <>
                    <h2 className="text-lg font-bold text-gray-900">
                      {qrMode === 'game' && detail ? `Check in to ${detail.room.name} · ${detail.session_time_label}` : 'Escape-room check-in'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {qrMode === 'game'
                        ? 'Players scan this to sign for this game on their own phones. The room and time are already picked.'
                        : 'Players scan this to choose their room and time and sign on their own phones.'}
                    </p>
                    <p className="text-xs text-gray-500">
                      For the venue tablet, use Open on this device. That version clears itself between guests.
                    </p>
                    <div className="flex justify-center" ref={qrWrap}>
                      <QRCodeCanvas value={target} size={220} includeMargin />
                    </div>
                    <p className="text-xs text-gray-500 break-all select-all">{target}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <StandardButton
                        size="sm"
                        variant="secondary"
                        icon={Download}
                        onClick={() => downloadQr(qrMode === 'game' && detail ? `${detail.room.name ?? 'escape-room'}-${detail.session_time}` : 'escape-room-check-in')}
                      >
                        Download QR
                      </StandardButton>
                      <StandardButton
                        size="sm"
                        variant="secondary"
                        icon={Printer}
                        onClick={() =>
                          printQr(
                            qrMode === 'game' && detail ? `${detail.room.name} · ${detail.session_time_label}` : 'Escape Room Check-In',
                            qrMode === 'game'
                              ? 'Scan to sign your waiver for this game.'
                              : 'Scan to choose your room and time and sign your waiver. Your group photo is emailed after the game.',
                            target,
                          )
                        }
                      >
                        Print sign
                      </StandardButton>
                    </div>
                    <a
                      href={`${target}${target.includes('?') ? '&' : '?'}staff=1`}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1 text-sm font-semibold text-${themeColor}-700`}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open on this device
                    </a>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EscapeRoomSessions;
