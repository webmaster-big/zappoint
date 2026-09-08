import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Loader2, Phone, User, CalendarDays } from 'lucide-react';
import bookingService, { type Booking } from '../../../services/bookingService';
import { customerNameOf, customerPhoneOf, formatPhoneForDisplay } from '../../../utils/bookingSearch';
import { convertTo12Hour, parseLocalDate } from '../../../utils/timeFormat';

const MIN_TERM_LENGTH = 2;
const DEBOUNCE_MS = 350;
const RESULT_LIMIT = 20;

const STATUS_TONE: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  'checked-in': 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

interface CustomerSearchProps {
  locationId?: number | null;
  onSelect: (booking: Booking) => void;
  placeholder?: string;
  className?: string;
  themeColor?: string;
  fullColor?: string;
}

const CustomerSearch: React.FC<CustomerSearchProps> = ({
  locationId,
  onSelect,
  placeholder = 'Search customer name or phone',
  className,
  themeColor = 'blue',
  fullColor = 'blue-600',
}) => {
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [results, setResults] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTerm(term.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (debouncedTerm.length < MIN_TERM_LENGTH) {
      requestRef.current += 1;
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);

    bookingService
      .getBookings({
        search: debouncedTerm,
        per_page: RESULT_LIMIT,
        sort_by: 'booking_date',
        sort_order: 'desc',
        ...(locationId ? { location_id: locationId } : {}),
      })
      .then(response => {
        if (requestRef.current !== requestId) return;
        setResults(response?.data?.bookings ?? []);
      })
      .catch(() => {
        if (requestRef.current !== requestId) return;
        setResults([]);
        setError('Could not search bookings. Try again.');
      })
      .finally(() => {
        if (requestRef.current !== requestId) return;
        setLoading(false);
      });
  }, [debouncedTerm, locationId]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setTerm('');
    setDebouncedTerm('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const choose = useCallback(
    (booking: Booking) => {
      onSelect(booking);
      reset();
    },
    [onSelect, reset]
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(prev => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) choose(results[activeIndex]);
      else if (results.length === 1) choose(results[0]);
      else setActiveIndex(0);
    }
  };

  const showPanel = open && debouncedTerm.length >= MIN_TERM_LENGTH;

  const emptyMessage = useMemo(() => {
    if (loading) return null;
    if (error) return error;
    if (results.length === 0) return `No bookings match "${debouncedTerm}".`;
    return null;
  }, [loading, error, results.length, debouncedTerm]);

  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={term}
        onChange={event => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Search bookings by customer name or phone number"
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        autoComplete="off"
        className={`w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-8 text-sm text-gray-900 placeholder:text-gray-400 [&::-webkit-search-cancel-button]:appearance-none focus:border-${fullColor} focus:outline-none focus:ring-1 focus:ring-${fullColor}`}
      />
      {(loading || term) && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <button type="button" onClick={reset} aria-label="Clear search" className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {emptyMessage ? (
            <div className="px-3 py-4 text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            <ul role="listbox" ref={listRef}>
              {results.map((booking, index) => {
                const phone = customerPhoneOf(booking);
                const bookingDate = parseLocalDate(booking.booking_date);
                return (
                  <li key={booking.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(booking)}
                      className={`w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 ${
                        index === activeIndex ? `bg-${themeColor}-50` : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-gray-900">
                          <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{customerNameOf(booking)}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium capitalize ${
                            STATUS_TONE[booking.status] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-gray-400" />
                          {Number.isNaN(bookingDate.getTime())
                            ? booking.booking_date
                            : bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {booking.booking_time ? ` · ${convertTo12Hour(booking.booking_time)}` : ''}
                        </span>
                        {phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            {formatPhoneForDisplay(phone)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {booking.package?.name || 'No package'} · {booking.reference_number}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
