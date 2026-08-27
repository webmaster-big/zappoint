import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Ticket,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useStorefrontLocations } from '../../hooks/useStorefrontLocations';
import ticketOrderService, { type CartQuote } from '../../services/TicketOrderService';
import { attractionService } from '../../services/AttractionService';
import dayOffService, { type DayOff } from '../../services/DayOffService';
import {
  normalizeAvailability,
  buildDayOffSets,
  slotsForDate,
  effectiveBlockedDates,
  type AvailabilitySlot,
} from '../../utils/attractionSchedule';
import { convertTo12Hour } from '../../utils/timeFormat';
import ScheduleCalendar from '../../components/ui/ScheduleCalendar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import SiteFooter from '../../components/customer/SiteFooter';

const money = (value: number) => `$${value.toFixed(2)}`;

const Cart = () => {
  const { items, ticketCount, updateQuantity, updateItem, removeItem, clear } = useCart();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [availabilityById, setAvailabilityById] = useState<Record<number, AvailabilitySlot[]>>({});
  const [dayOffs, setDayOffs] = useState<DayOff[]>([]);
  const [openScheduler, setOpenScheduler] = useState<string | null>(null);

  const attractionIds = useMemo(
    () => [...new Set(items.filter(i => i.type === 'attraction').map(i => i.id))],
    [items],
  );
  const cartLocationId = items[0]?.locationId ?? null;
  const { locations: storefrontLocations } = useStorefrontLocations();
  const backTo = useMemo(() => {
    const match = storefrontLocations.find(l => l.id === cartLocationId);
    return match?.slug ? `/${match.slug}` : '/';
  }, [storefrontLocations, cartLocationId]);

  useEffect(() => {
    let cancelled = false;
    attractionIds
      .filter(id => availabilityById[id] === undefined)
      .forEach(id => {
        attractionService
          .getAttraction(id)
          .then(res => {
            if (cancelled) return;
            const raw = (res.data as { availability?: unknown } | undefined)?.availability;
            setAvailabilityById(current => ({ ...current, [id]: normalizeAvailability(raw) }));
          })
          .catch(() => {
            if (!cancelled) setAvailabilityById(current => ({ ...current, [id]: [] }));
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attractionIds]);

  useEffect(() => {
    if (!cartLocationId) return;
    let cancelled = false;
    dayOffService
      .getDayOffsByLocation(cartLocationId)
      .then(res => {
        if (!cancelled && res.success && res.data) setDayOffs(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [cartLocationId]);

  const signature = useMemo(
    () => items.map(i => `${i.key}:${i.quantity}:${i.scheduledDate ?? ''}:${i.scheduledTime ?? ''}`).join(','),
    [items],
  );

  const refreshQuote = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    setQuoting(true);
    setQuoteError(null);
    try {
      setQuote(await ticketOrderService.quote(items));
    } catch (error) {
      setQuote(null);
      setQuoteError(error instanceof Error ? error.message : 'We could not price your cart.');
    } finally {
      setQuoting(false);
    }
  }, [items]);

  useEffect(() => {
    void refreshQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (items.length === 0) {
    return (
      <>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <ShoppingCart className="w-7 h-7 text-gray-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-500 mb-8">Add attractions or events from a location to buy several at once.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-6 py-3 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition-colors"
          >
            Choose a location
            <ChevronRight size={16} />
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const lineFor = (position: number) => quote?.lines.find(l => l.position === position);
  const missingSchedule = items.some(i => i.type === 'attraction' && (!i.scheduledDate || !i.scheduledTime));

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800 hover:text-blue-900 mb-2"
        >
          <ChevronLeft size={14} />
          Back to {items[0]?.locationName ?? 'locations'}
        </Link>
        <div className="flex items-end justify-between gap-3 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 rounded-xl">
                <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-blue-800" />
              </span>
              Your cart
            </h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1 ml-12">
              {items.length} {items.length === 1 ? 'item' : 'items'} · {ticketCount}{' '}
              {ticketCount === 1 ? 'ticket' : 'tickets'}
              {items[0]?.locationName ? ` · ${items[0].locationName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
          >
            Empty cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item, index) => {
              const priced = lineFor(index + 1);
              const availability = availabilityById[item.id];
              const sets = buildDayOffSets(dayOffs, item.id);
              const { blocked, partialDays } = effectiveBlockedDates(availability ?? [], sets);
              const timeSlots = item.scheduledDate
                ? slotsForDate(availability ?? [], item.scheduledDate, sets.partial)
                : [];
              const isOpen = openScheduler === item.key;
              const scheduled = Boolean(item.scheduledDate && item.scheduledTime);
              const prettyDate = item.scheduledDate
                ? new Date(item.scheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })
                : '';

              return (
                <div key={item.key} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <span className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
                      {item.type === 'attraction' ? (
                        <Ticket size={16} className="text-blue-800" />
                      ) : (
                        <Calendar size={16} className="text-blue-800" />
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 leading-snug">{item.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                      {priced && priced.applied_discounts.length > 0 && priced.applied_discounts.map((d, i) => (
                        <p key={i} className="text-xs font-semibold text-emerald-600 mt-0.5">
                          {d.name ?? 'Special pricing'}
                          {d.discount_label ? ` (${d.discount_label} off)` : ''}
                        </p>
                      ))}
                      {priced && (priced.add_ons ?? []).map((a, i) => (
                        <p key={`a${i}`} className="text-xs text-gray-600 mt-0.5">
                          + {a.quantity}× {a.name} · {money(a.line_total ?? a.price_at_purchase * a.quantity)}
                        </p>
                      ))}
                      {priced && priced.fee_total > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          + {money(priced.fee_total)} fees
                        </p>
                      )}
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-extrabold text-gray-900 tabular-nums leading-snug">
                        {priced ? money(priced.total_amount) : money(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-gray-400 whitespace-nowrap">
                        {item.quantity} × {money(priced ? priced.unit_price : item.unitPrice)}
                      </p>
                    </div>
                  </div>

                  {item.type === 'attraction' ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setOpenScheduler(isOpen ? null : item.key)}
                        aria-expanded={isOpen}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          scheduled
                            ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        <CalendarClock size={14} />
                        {scheduled
                          ? `${prettyDate} · ${convertTo12Hour(item.scheduledTime as string)}`
                          : 'Pick a visit day & time'}
                        <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen && (
                        <div className="mt-3 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                          {availability === undefined ? (
                            <div className="py-6 flex justify-center">
                              <LoadingSpinner size="small" />
                            </div>
                          ) : availability.length === 0 ? (
                            <p className="text-xs text-gray-500 py-2">
                              No schedule is published for this attraction — staff will confirm your time.
                            </p>
                          ) : (
                            <ScheduleCalendar
                              availability={availability}
                              dayOffDates={blocked}
                              partialDayOffDates={partialDays}
                              scheduledDate={item.scheduledDate ?? ''}
                              scheduledTime={item.scheduledTime ?? ''}
                              availableTimeSlots={timeSlots}
                              onDateSelect={dateStr =>
                                updateItem(item.key, { scheduledDate: dateStr, scheduledTime: null })
                              }
                              onTimeSelect={time => {
                                updateItem(item.key, { scheduledTime: time });
                                setOpenScheduler(null);
                              }}
                              themeColor="blue"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    item.scheduledDate && (
                      <p className="text-xs text-gray-500 mt-3">
                        Event date: <span className="font-semibold text-gray-700">{item.scheduledDate}</span>
                      </p>
                    )
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Fewer ${item.name}`}
                        disabled={item.quantity <= 1}
                        onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                        className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-9 text-center font-bold text-gray-900 tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`More ${item.name}`}
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.key)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="lg:col-span-1">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 md:p-6 lg:sticky lg:top-24">
              <h2 className="font-bold text-gray-900 mb-4">Order summary</h2>

              {quoting && (
                <div className="py-6 flex justify-center">
                  <LoadingSpinner size="small" />
                </div>
              )}

              {quoteError && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
              )}

              {quote && !quoting && (
                <dl className="space-y-2 text-sm mb-5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Subtotal</dt>
                    <dd className="text-gray-900 tabular-nums">{money(quote.subtotal)}</dd>
                  </div>
                  {quote.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-emerald-600">Discounts</dt>
                      <dd className="text-emerald-600 tabular-nums">−{money(quote.discount_amount)}</dd>
                    </div>
                  )}
                  {quote.fee_total > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Fees</dt>
                      <dd className="text-gray-900 tabular-nums">{money(quote.fee_total)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-gray-100">
                    <dt className="font-bold text-gray-900">Total</dt>
                    <dd className="text-xl font-extrabold text-gray-900 tabular-nums">{money(quote.total_amount)}</dd>
                  </div>
                </dl>
              )}

              <button
                type="button"
                onClick={() => navigate('/checkout')}
                disabled={quoting || !quote || missingSchedule}
                className="w-full px-5 py-3 font-semibold rounded-lg transition-all inline-flex items-center justify-center gap-2 bg-blue-800 hover:bg-blue-900 text-white shadow-md hover:shadow-lg disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Continue to checkout
                <ChevronRight size={16} />
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                {missingSchedule
                  ? 'Pick a visit day & time for each attraction to continue.'
                  : 'You pay on the next step. Prices are confirmed by the venue.'}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
};

export default Cart;
