import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { buildIcs, downloadIcs, type CalendarEventInput } from '../../utils/calendarInvite';

interface Props {
  event: CalendarEventInput;
  filename: string;
  className?: string;
  label?: string;
}

const AddToCalendarButton = ({ event, filename, className, label = 'Add to Calendar' }: Props) => {
  const [added, setAdded] = useState(false);

  const ics = buildIcs(event);
  if (!ics) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadIcs(filename, ics);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Save this visit to your calendar"
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition'
      }
    >
      {added ? <Check className="w-3.5 h-3.5" /> : <CalendarPlus className="w-3.5 h-3.5" />}
      {added ? 'Saved' : label}
    </button>
  );
};

export default AddToCalendarButton;
