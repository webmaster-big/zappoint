import type { WaiverFormContext } from '../../types/waiver.types';
import { convertTo12Hour, parseLocalDate } from '../../utils/timeFormat';

const formatGameDate = (date?: string | null): string => {
  if (!date) return '';
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const EscapeRoomGameBanner = ({ escapeRoom }: { escapeRoom: WaiverFormContext['escape_room'] }) => {
  if (!escapeRoom) return null;

  const gameDate = formatGameDate(escapeRoom.date);
  const gameTime = escapeRoom.time_label || (escapeRoom.time ? convertTo12Hour(escapeRoom.time) : '');
  const gameWhen = [gameDate, gameTime].filter(Boolean).join(' at ');

  return (
    <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-5 py-4 text-center">
      <p className="text-sm font-semibold text-blue-900">
        {escapeRoom.room_name ? `Escape room: ${escapeRoom.room_name}` : 'Escape room'}
      </p>
      {gameWhen && <p className="text-sm text-blue-900/80 mt-0.5">{gameWhen}</p>}
      <p className="text-xs text-blue-900/80 mt-2">
        After your game, we&apos;ll email your group photo to the email address you enter below.
      </p>
    </div>
  );
};

export default EscapeRoomGameBanner;
