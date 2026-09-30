import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, DoorOpen } from 'lucide-react';
import escapeRoomService from '../../../services/EscapeRoomService';
import { dateKey, michiganToday } from '../../../utils/timeFormat';
import type { EscapeRoomBookingGame } from '../../../types/escapeRoom.types';

const EscapeRoomBookingCard = ({ bookingId, themeColor, className = '' }: { bookingId: number; themeColor: string; className?: string }) => {
  const [game, setGame] = useState<EscapeRoomBookingGame | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    let alive = true;
    escapeRoomService
      .getBookingGame(bookingId)
      .then((data) => {
        if (alive) setGame(data);
      })
      .catch(() => {
        if (alive) setGame(null);
      });
    return () => {
      alive = false;
    };
  }, [bookingId]);

  if (!game) return null;

  const openLink = `/photos/escape-rooms?date=${game.date}${
    game.session_id ? `&session=${game.session_id}` : game.room_id ? `&room=${game.room_id}&time=${game.time}` : ''
  }`;
  const canShareLink = game.has_waiver && !game.completed && !game.booking_cancelled && game.date >= dateKey(michiganToday());
  const status = game.completed
    ? game.completed_without_photo
      ? `Result recorded, no photo · ${game.completion_label}`
      : `Photo sent to ${game.sent} ${game.sent === 1 ? 'player' : 'players'} · ${game.completion_label}`
    : game.photo_taken
      ? 'Group photo taken, not sent yet'
      : 'Photo not taken yet';
  const covered = game.people_covered ?? game.players_signed;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(game.kiosk_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setShowLink(true);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-${themeColor}-50`}>
            <DoorOpen className={`w-5 h-5 text-${themeColor}-700`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Escape-room game: {game.room_name} · {game.time_label}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              Signed waivers cover {covered} of {game.players_booked} {game.players_booked === 1 ? 'player' : 'players'} · {status}
            </p>
            {game.reviews && game.reviews.scheduled + game.reviews.sent + game.reviews.rated > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Review requests: {game.reviews.scheduled > 0 ? `${game.reviews.scheduled} waiting` : ''}
                {game.reviews.scheduled > 0 && game.reviews.sent > 0 ? ' · ' : ''}
                {game.reviews.sent > 0 ? `${game.reviews.sent} sent` : ''}
                {game.reviews.rated > 0
                  ? ` · ${game.reviews.rated} rated${game.reviews.average_rating !== null ? `, average ${game.reviews.average_rating}/5` : ''}`
                  : ''}
              </p>
            )}
            {!game.has_waiver && (
              <p className="text-xs text-amber-700 mt-1">No escape-room waiver covers this room yet, so players cannot check in to it.</p>
            )}
            {game.booking_cancelled && (
              <p className="text-xs text-amber-700 mt-1">This booking is cancelled, so its players are left out of the game's photo.</p>
            )}
            {game.shared_time && (
              <p className="text-xs text-gray-500 mt-1">Another booking shares this time. Everyone who signs for it is one group and gets the same photo.</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Each player signs their own waiver{canShareLink ? ' with the group check-in link, any time before the game' : ''}. The group photo goes to everyone who signed.
            </p>
            {showLink && <p className="text-xs text-gray-700 mt-1 break-all select-all">{game.kiosk_url}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canShareLink && (
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied' : 'Copy group check-in link'}
            </button>
          )}
          <Link
            to={openLink}
            className={`inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-lg bg-${themeColor}-700 text-xs font-semibold text-white hover:bg-${themeColor}-900`}
          >
            Open game
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EscapeRoomBookingCard;
