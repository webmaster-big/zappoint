import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Ticket, User, Calendar, Tag, Receipt, Percent, DollarSign, Bell, BellOff, Save, Plus, Minus, MapPin } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import ScheduleCalendar from '../../../components/ui/ScheduleCalendar';
import PriceBreakdownDisplay from '../../../components/ui/PriceBreakdownDisplay';
import Toast from '../../../components/ui/Toast';
import EmailInput from '../../../components/ui/EmailInput';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { attractionPurchaseService, type AttractionPurchase, type UpdatePurchaseData } from '../../../services/AttractionPurchaseService';
import { attractionPurchaseCacheService } from '../../../services/AttractionPurchaseCacheService';
import { metricsCacheService } from '../../../services/MetricsCacheService';
import { attractionService, type Attraction } from '../../../services/AttractionService';
import { dayOffService, type DayOff } from '../../../services/DayOffService';
import { getStoredUser } from '../../../utils/storage';
import { generatePurchaseQRCode } from '../../../utils/qrcode';
import type { AppliedFee } from '../../../utils/fees';
import type { AppliedDiscount } from '../../../utils/discounts';
import { clampAddOnQuantity, getAddOnMinQuantity } from '../../../utils/addOnQuantity';
import type { FeeBreakdown } from '../../../types/FeeSupport.types';
import { generateTimeSlots } from '../../../utils/timeSlots';

type AttractionStatus = 'pending' | 'confirmed' | 'checked-in' | 'cancelled' | 'refunded';
type AttractionPaymentMethod = 'card' | 'in-store' | 'paylater' | 'authorize.net';

const dayNumberToName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
  'checked-in': { color: 'bg-green-100 text-green-800', label: 'Checked In' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
  refunded: { color: 'bg-purple-100 text-purple-800', label: 'Refunded' },
};

const EditPurchase: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');

  const getPaymentsPath = () => {
    const user = getStoredUser();
    if (user?.role === 'location_manager') return '/manager/payments';
    if (user?.role === 'company_admin') return '/admin/payments';
    return '/payments';
  };
  const getBackPath = () => {
    switch (from) {
      case 'notifications': return '/notifications';
      case 'dashboard': return -1 as any;
      case 'payments': return getPaymentsPath();
      case 'details': return `/attractions/purchases/${id}`;
      case 'order': return originalPurchase?.ticket_order_id != null ? `/orders/${originalPurchase.ticket_order_id}` : '/orders';
      default: return '/attractions/purchases';
    }
  };
  const getBackLabel = () => {
    switch (from) {
      case 'notifications': return 'Notifications';
      case 'dashboard': return 'Dashboard';
      case 'payments': return 'Payments';
      case 'details': return 'Purchase Details';
      default: return 'Purchases';
    }
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [originalPurchase, setOriginalPurchase] = useState<AttractionPurchase | null>(null);
  const isOrderLine = originalPurchase?.ticket_order_id != null;
  const [originalScheduledDate, setOriginalScheduledDate] = useState<string>('');
  const [originalScheduledTime, setOriginalScheduledTime] = useState<string>('');
  const [attractions, setAttractions] = useState<Attraction[]>([]);

  const [attractionId, setAttractionId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [status, setStatus] = useState<AttractionStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState<AttractionPaymentMethod>('in-store');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  const [selectedAddOns, setSelectedAddOns] = useState<{ [id: number]: number }>({});
  const [appliedFees, setAppliedFees] = useState<AppliedFee[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [sendNotification, setSendNotification] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const response = await attractionPurchaseService.getPurchase(Number(id));
        const purchase = response.data;
        if (!purchase) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOriginalPurchase(purchase);
        setAttractionId(purchase.attraction_id);
        setQuantity(purchase.quantity || 1);
        setGuestName(purchase.guest_name || '');
        setGuestEmail(purchase.guest_email || '');
        setGuestPhone(purchase.guest_phone || '');
        setStatus(purchase.status as AttractionStatus);
        setPaymentMethod((purchase.payment_method || 'in-store') as AttractionPaymentMethod);
        setAmountPaid(Number((purchase as any).amount_paid ?? 0));
        setNotes(purchase.notes || '');

        const savedDate = purchase.scheduled_date ? purchase.scheduled_date.split('T')[0] : '';
        const savedTime = purchase.scheduled_time || '';
        setScheduledDate(savedDate);
        setScheduledTime(savedTime);
        setOriginalScheduledDate(savedDate);
        setOriginalScheduledTime(savedTime);

        const initialAddOns: { [id: number]: number } = {};
        (purchase.add_ons || []).forEach((a) => {
          const qty = Number(a.pivot?.quantity ?? 0);
          if (a.id && qty > 0) initialAddOns[a.id] = qty;
        });
        setSelectedAddOns(initialAddOns);

        if (purchase.applied_fees && Array.isArray(purchase.applied_fees)) {
          setAppliedFees(purchase.applied_fees);
        }
        if (purchase.applied_discounts && Array.isArray(purchase.applied_discounts)) {
          setAppliedDiscounts(purchase.applied_discounts);
        }
        setDiscountAmount(Number((purchase as any).discount_amount ?? 0));

        setLoading(false);

        const locationId = purchase.location_id ?? purchase.attraction?.location_id;
        if (locationId) {
          try {
            const attractionsResponse = await attractionService.getAttractions({ location_id: locationId, is_active: true, per_page: 100, user_id: getStoredUser()?.id });
            const list = attractionsResponse.data?.attractions || [];
            const hasCurrent = list.some((a) => a.id === purchase.attraction_id);
            if (!hasCurrent && purchase.attraction) {
              list.push({
                id: purchase.attraction.id,
                location_id: purchase.attraction.location_id ?? locationId,
                name: purchase.attraction.name,
                description: '',
                price: Number(purchase.attraction.price) || 0,
                pricing_type: purchase.attraction.pricing_type || 'flat',
                max_capacity: 0,
                category: purchase.attraction.category || '',
                is_active: true,
                created_at: '',
                updated_at: '',
              } as Attraction);
            }
            setAttractions(list);
          } catch {
          }
        }
      } catch {
        setNotFound(true);
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const selectedAttraction = useMemo(
    () => attractions.find((a) => a.id === attractionId) || null,
    [attractions, attractionId]
  );

  const locationId = originalPurchase?.location_id ?? originalPurchase?.attraction?.location_id ?? null;

  const frozenAddOnPrices = useMemo(() => {
    const map: { [id: number]: number } = {};
    (originalPurchase?.add_ons || []).forEach((a) => {
      if (a.id != null && a.pivot?.price_at_purchase != null) {
        map[a.id] = Number(a.pivot.price_at_purchase);
      }
    });
    return map;
  }, [originalPurchase]);

  const availableAddOns = useMemo(() => {
    const list: any[] = Array.isArray(selectedAttraction?.add_ons) ? [...(selectedAttraction!.add_ons as any[])] : [];
    const ids = new Set(list.map((a: any) => a.id));
    (originalPurchase?.add_ons || []).forEach((a) => {
      if (!ids.has(a.id)) {
        list.push({ id: a.id, name: a.name, price: Number(a.price ?? a.pivot?.price_at_purchase ?? 0) });
        ids.add(a.id);
      }
    });
    return list;
  }, [selectedAttraction, originalPurchase]);

  const getAddOnUnitPrice = useCallback((addonId: number, addOn: any) => {
    if (Object.prototype.hasOwnProperty.call(frozenAddOnPrices, addonId)) {
      return frozenAddOnPrices[addonId];
    }
    return Number(addOn?.price) || 0;
  }, [frozenAddOnPrices]);

  const handleAddOnChange = (addOnId: number, change: number) => {
    const addOn = availableAddOns.find((a: any) => a.id === addOnId);
    if (!addOn) return;
    setSelectedAddOns((prev) => {
      const current = prev[addOnId] || 0;
      const next = clampAddOnQuantity(addOn, null, current, current + change);
      if (next <= 0) {
        const { [addOnId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addOnId]: next };
    });
  };

  const addOnsChanged = useMemo(() => {
    const originalMap: { [id: number]: number } = {};
    (originalPurchase?.add_ons || []).forEach((a) => {
      const qty = Number(a.pivot?.quantity ?? 0);
      if (a.id && qty > 0) originalMap[a.id] = qty;
    });
    const norm = (m: { [id: number]: number }) =>
      Object.entries(m).filter(([, q]) => q > 0).map(([k, q]) => `${k}:${q}`).sort().join(',');
    return norm(originalMap) !== norm(selectedAddOns);
  }, [originalPurchase, selectedAddOns]);

  const baseSubtotal = selectedAttraction ? Number(selectedAttraction.price) * quantity : 0;
  const addOnsTotal = useMemo(() => {
    return Object.entries(selectedAddOns).reduce((sum, [addId, qty]) => {
      const addOn = availableAddOns.find((a: any) => a.id === Number(addId));
      if (!addOn) return sum;
      return sum + getAddOnUnitPrice(Number(addId), addOn) * qty;
    }, 0);
  }, [selectedAddOns, availableAddOns, getAddOnUnitPrice]);
  const additiveFeeTotal = appliedFees.filter((f) => f.fee_application_type === 'additive').reduce((s, f) => s + Number(f.fee_amount || 0), 0);
  const discountCeiling = Math.max(0, baseSubtotal + addOnsTotal + additiveFeeTotal);
  const displayTotal = Math.max(0, baseSubtotal + addOnsTotal + additiveFeeTotal - discountAmount);
  const balance = displayTotal - amountPaid;

  const feeBreakdownForDisplay = useMemo<FeeBreakdown | null>(() => {
    if (appliedFees.length === 0) return null;
    const base = baseSubtotal + addOnsTotal;
    return {
      original_base_price: base,
      displayed_base_price: base,
      fees: appliedFees.map((f, i) => ({
        fee_support_id: i,
        fee_name: f.fee_name || 'Fee',
        fee_label: f.fee_application_type === 'inclusive' ? 'Included' : 'Fee',
        fee_calculation_type: 'fixed' as const,
        fee_application_type: f.fee_application_type,
        fee_amount: Number(f.fee_amount || 0),
        displayed_base_price: base,
        total: base + Number(f.fee_amount || 0),
      })),
      total: displayTotal,
    };
  }, [appliedFees, baseSubtotal, addOnsTotal, displayTotal]);

  const getAttractionAvailability = useCallback((): Array<{ days: string[]; start_time: string; end_time: string }> => {
    if (!selectedAttraction) return [];
    const raw = selectedAttraction.availability as unknown;
    if (Array.isArray(raw)) return raw as Array<{ days: string[]; start_time: string; end_time: string }>;
    if (typeof raw === 'object' && raw !== null) {
      const enabledDays = Object.entries(raw as Record<string, unknown>).filter(([, v]) => v).map(([d]) => d.toLowerCase());
      if (enabledDays.length === 0) return [];
      return [{ days: enabledDays, start_time: '09:00', end_time: '17:00' }];
    }
    return [];
  }, [selectedAttraction]);

  const scheduleAvailability = useMemo(() => {
    const base = getAttractionAvailability();
    if (!originalScheduledDate) return base;
    const savedWeekday = dayNumberToName[new Date(originalScheduledDate + 'T00:00:00').getDay()];
    const covered = base.some((s) => s.days.map((d) => d.toLowerCase()).includes(savedWeekday));
    if (covered) return base;
    return [...base, { days: [savedWeekday], start_time: '00:00', end_time: '23:59' }];
  }, [getAttractionAvailability, originalScheduledDate]);

  useEffect(() => {
    const fetchDayOffs = async () => {
      if (!locationId || !attractionId) {
        setDayOffDates(new Set());
        return;
      }
      try {
        const response = await dayOffService.getDayOffsByLocation(locationId);
        if (response.success && response.data) {
          const blocked = new Set<string>();
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          response.data.forEach((dayOff: DayOff) => {
            const isLocationWide = !dayOff.package_ids?.length && !dayOff.room_ids?.length && !dayOff.attraction_ids?.length && !dayOff.event_ids?.length;
            const appliesToAttraction = !!dayOff.attraction_ids?.includes(attractionId);
            if (!isLocationWide && !appliesToAttraction) return;
            const normalizedDate = dayOff.date.split('T')[0];
            const offDate = new Date(normalizedDate + 'T00:00:00');
            const hasTimeRestriction = dayOff.time_start || dayOff.time_end;
            if (hasTimeRestriction) return;
            if (dayOff.is_recurring) {
              const currYear = new Date(now.getFullYear(), offDate.getMonth(), offDate.getDate());
              const nextYear = new Date(now.getFullYear() + 1, offDate.getMonth(), offDate.getDate());
              if (currYear >= now) blocked.add(`${currYear.getFullYear()}-${(currYear.getMonth() + 1).toString().padStart(2, '0')}-${currYear.getDate().toString().padStart(2, '0')}`);
              blocked.add(`${nextYear.getFullYear()}-${(nextYear.getMonth() + 1).toString().padStart(2, '0')}-${nextYear.getDate().toString().padStart(2, '0')}`);
            } else {
              if (offDate >= now) blocked.add(normalizedDate);
            }
          });
          setDayOffDates(blocked);
        }
      } catch {
      }
    };
    fetchDayOffs();
  }, [locationId, attractionId]);

  const effectiveDayOffDates = useMemo(() => {
    const set = new Set(dayOffDates);
    if (originalScheduledDate) set.delete(originalScheduledDate);
    return set;
  }, [dayOffDates, originalScheduledDate]);

  useEffect(() => {
    if (!scheduledDate || !selectedAttraction) {
      setAvailableTimeSlots([]);
      return;
    }
    const date = new Date(scheduledDate + 'T00:00:00');
    const dayName = dayNumberToName[date.getDay()];
    const availability = getAttractionAvailability();
    const daySlot = availability.find((slot) => slot.days.map((d) => d.toLowerCase()).includes(dayName));
    let slots = daySlot ? generateTimeSlots(daySlot.start_time, daySlot.end_time, 60) : [];
    if (scheduledDate === originalScheduledDate && originalScheduledTime && !slots.includes(originalScheduledTime)) {
      slots = [...slots, originalScheduledTime].sort();
    }
    setAvailableTimeSlots(slots);
  }, [scheduledDate, selectedAttraction, getAttractionAvailability, originalScheduledDate, originalScheduledTime]);

  const buildAdditionalAddons = () => {
    return Object.entries(selectedAddOns)
      .filter(([, qty]) => qty > 0)
      .map(([addId, qty]) => {
        const addOn = availableAddOns.find((a: any) => a.id === Number(addId));
        if (!addOn) return null;
        return { addon_id: Number(addId), quantity: qty, price_at_purchase: getAddOnUnitPrice(Number(addId), addOn) };
      })
      .filter((item): item is { addon_id: number; quantity: number; price_at_purchase: number } => item !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalPurchase) return;
    if (!scheduledDate || !scheduledTime) {
      setToast({ message: 'Please select a visit date and time.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const data: UpdatePurchaseData = isOrderLine
        ? {
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            notes: notes || undefined,
          }
        : {
            attraction_id: attractionId ?? undefined,
            guest_name: guestName || undefined,
            guest_email: guestEmail || undefined,
            guest_phone: guestPhone || undefined,
            quantity,
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            status,
            payment_method: paymentMethod,
            amount_paid: amountPaid,
            notes: notes || undefined,
            applied_fees: appliedFees.length > 0 ? appliedFees : null,
            applied_discounts: appliedDiscounts.length > 0 ? appliedDiscounts : null,
            discount_amount: discountAmount,
            total_amount: displayTotal,
            ...(addOnsChanged && { additional_addons: buildAdditionalAddons() }),
          };

      const response = await attractionPurchaseService.updatePurchase(originalPurchase.id, data);

      if (response.success) {
        void attractionPurchaseCacheService.clearCache();
        void metricsCacheService.clearAllCaches();

        if (sendNotification) {
          try {
            const qr = await generatePurchaseQRCode(originalPurchase.id);
            await attractionPurchaseService.sendReceipt(originalPurchase.id, qr, true);
          } catch {
          }
        }

        setToast({ message: 'Purchase updated successfully!', type: 'success' });
        setTimeout(() => navigate(getBackPath()), 1200);
      } else {
        setToast({ message: 'Failed to update purchase. Please try again.', type: 'error' });
        setSubmitting(false);
      }
    } catch {
      setToast({ message: 'Error updating purchase. Please try again.', type: 'error' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Purchase Not Found</h1>
          <p className="text-gray-500 text-sm mb-4">The purchase you're looking for doesn't exist.</p>
          <StandardButton variant="primary" size="sm" onClick={() => navigate(getBackPath())}>
            Back to {getBackLabel()}
          </StandardButton>
        </div>
      </div>
    );
  }

  const pill = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };

  return (
    <div className="w-full mx-auto sm:px-4 md:mt-8 pb-6 flex flex-col md:flex-row gap-8 md:gap-12">
      <div className="flex-1 mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(getBackPath())}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">Edit Purchase</h2>
              <p className="text-sm text-gray-500 mt-1">
                Purchase ID: <span className="font-medium text-gray-700">#{originalPurchase?.id}</span>
              </p>
            </div>
            <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${pill.color}`}>
              {pill.label}
            </span>
          </div>

          {originalPurchase?.ticket_order_id != null && (
            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
              <span className="font-bold">Part of bulk order</span>
              {originalPurchase.line_position != null && <> — line {originalPurchase.line_position}</>}.
              {' '}Only the visit schedule and notes can be changed here; tickets, pricing, customer and status are managed on the order.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Ticket className={`w-5 h-5 text-${themeColor}-600`} /> Attraction
              </h3>
              <div className="space-y-3">
                <select
                  value={attractionId ?? ''}
                  onChange={(e) => setAttractionId(Number(e.target.value))}
                  className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                >
                  <option value="">Select an attraction</option>
                  {attractions.map((attr) => (
                    <option key={attr.id} value={attr.id}>
                      {attr.name} - ${Number(attr.price).toFixed(2)}
                    </option>
                  ))}
                </select>
                {selectedAttraction && (
                  <div className={`bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3`}>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Selected:</span> {selectedAttraction.name} • ${Number(selectedAttraction.price).toFixed(2)}
                    </p>
                    {originalPurchase?.attraction?.location?.name && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {originalPurchase.attraction.location.name}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Quantity</label>
                  <div className="flex items-center gap-2">
                    <StandardButton type="button" variant="secondary" size="sm" icon={Minus} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                      {''}
                    </StandardButton>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="w-16 text-center font-bold text-base text-gray-900 border border-gray-300 rounded px-1 py-1.5"
                    />
                    <StandardButton type="button" variant="primary" size="sm" icon={Plus} onClick={() => setQuantity(quantity + 1)}>
                      {''}
                    </StandardButton>
                    {selectedAttraction && (
                      <span className="ml-2 text-sm text-gray-500">
                        ${Number(selectedAttraction.price).toFixed(2)} × {quantity} = <span className="font-semibold text-gray-800">${baseSubtotal.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <User className={`w-5 h-5 text-${themeColor}-600`} /> Customer Information
              </h3>
              <div className="space-y-5">
                {originalPurchase?.customer_id && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-600">
                      Linked customer account <span className="font-medium text-gray-800">#{originalPurchase.customer_id}</span>
                      {originalPurchase.customer && (
                        <span className="text-gray-500"> — {originalPurchase.customer.first_name} {originalPurchase.customer.last_name}</span>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Full Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Email</label>
                    <EmailInput
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="customer@example.com"
                      suppressSuggestions={isOrderLine}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-2 text-base text-neutral-800">Phone</label>
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400`}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Calendar className={`w-5 h-5 text-${themeColor}-600`} /> Schedule
              </h3>
              {scheduleAvailability.length > 0 ? (
                <ScheduleCalendar
                  availability={scheduleAvailability}
                  dayOffDates={effectiveDayOffDates}
                  scheduledDate={scheduledDate}
                  scheduledTime={scheduledTime}
                  availableTimeSlots={availableTimeSlots}
                  onDateSelect={(dateStr) => { setScheduledDate(dateStr); setScheduledTime(''); }}
                  onTimeSelect={(time) => setScheduledTime(time)}
                  themeColor={themeColor}
                />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">No availability configured for this attraction.</p>
                </div>
              )}
            </div>

            {availableAddOns.length > 0 && (
              <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
                <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                  <Tag className={`w-5 h-5 text-${themeColor}-600`} /> Add-ons
                </h3>
                <p className="text-sm text-gray-500 mb-4">Add or adjust extras for this purchase. Changing add-ons updates the total.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableAddOns.map((addOn: any) => {
                    const qty = selectedAddOns[addOn.id] || 0;
                    const isSelected = qty > 0;
                    const maxQty = addOn.max_quantity ?? 99;
                    const minQty = getAddOnMinQuantity(addOn, null);
                    return (
                      <div
                        key={addOn.id}
                        className={`rounded-lg border p-3 transition-all ${isSelected ? `border-${themeColor}-500 bg-${themeColor}-50` : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-1">{addOn.name}</h4>
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className={`text-sm font-bold text-${themeColor}-600`}>${getAddOnUnitPrice(addOn.id, addOn).toFixed(2)}</span>
                          <span className="text-[10px] text-gray-500">/unit</span>
                        </div>
                        {minQty > 1 && <p className="text-[10px] text-gray-400 mb-1">Min {minQty}</p>}
                        <div className="flex items-center gap-1">
                          <StandardButton type="button" variant="secondary" size="sm" icon={Minus} onClick={() => handleAddOnChange(addOn.id, -1)} disabled={!isSelected}>
                            {''}
                          </StandardButton>
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            value={qty}
                            onChange={(e) => {
                              const next = clampAddOnQuantity(addOn, null, qty, parseInt(e.target.value) || 0);
                              if (next <= 0) {
                                setSelectedAddOns((prev) => {
                                  const { [addOn.id]: _removed, ...rest } = prev;
                                  return rest;
                                });
                              } else {
                                setSelectedAddOns((prev) => ({ ...prev, [addOn.id]: next }));
                              }
                            }}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            className="w-14 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded px-1 py-1"
                          />
                          <StandardButton type="button" variant="primary" size="sm" icon={Plus} onClick={() => handleAddOnChange(addOn.id, 1)} disabled={qty >= maxQty}>
                            {''}
                          </StandardButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Receipt className={`w-5 h-5 text-${themeColor}-600`} /> Fees
              </h3>
              <div className="space-y-3">
                {appliedFees.map((fee, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Fee #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setAppliedFees(appliedFees.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Fee name"
                      value={fee.fee_name}
                      onChange={(e) => {
                        const updated = [...appliedFees];
                        updated[index] = { ...updated[index], fee_name: e.target.value };
                        setAppliedFees(updated);
                      }}
                      className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={fee.fee_amount}
                          onChange={(e) => {
                            const updated = [...appliedFees];
                            updated[index] = { ...updated[index], fee_amount: parseFloat(e.target.value) || 0 };
                            setAppliedFees(updated);
                          }}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className={`w-full border border-gray-300 rounded pl-6 pr-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                        />
                      </div>
                      <select
                        value={fee.fee_application_type}
                        onChange={(e) => {
                          const updated = [...appliedFees];
                          updated[index] = { ...updated[index], fee_application_type: e.target.value as 'additive' | 'inclusive' };
                          setAppliedFees(updated);
                        }}
                        className={`border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      >
                        <option value="additive">Additive</option>
                        <option value="inclusive">Inclusive</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAppliedFees([...appliedFees, { fee_name: '', fee_amount: 0, fee_application_type: 'additive' }])}
                  className={`text-xs text-${fullColor} hover:underline`}
                >
                  + Add Fee
                </button>
              </div>
            </div>

            <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <Percent className={`w-5 h-5 text-${themeColor}-600`} /> Discounts
              </h3>
              <div className="space-y-3">
                {appliedDiscounts.map((discount, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Discount #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setAppliedDiscounts(appliedDiscounts.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-600 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Discount name"
                      value={discount.discount_name}
                      onChange={(e) => {
                        const updated = [...appliedDiscounts];
                        updated[index] = { ...updated[index], discount_name: e.target.value };
                        setAppliedDiscounts(updated);
                      }}
                      className={`w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={discount.discount_amount}
                          onChange={(e) => {
                            const updated = [...appliedDiscounts];
                            updated[index] = { ...updated[index], discount_amount: Math.max(0, parseFloat(e.target.value) || 0) };
                            setAppliedDiscounts(updated);
                          }}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className={`w-full border border-gray-300 rounded pl-6 pr-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                        />
                      </div>
                      <select
                        value={discount.discount_type}
                        onChange={(e) => {
                          const updated = [...appliedDiscounts];
                          updated[index] = { ...updated[index], discount_type: e.target.value as 'fixed' | 'percentage' };
                          setAppliedDiscounts(updated);
                        }}
                        className={`border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Orig $</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Original price"
                        value={discount.original_price}
                        onChange={(e) => {
                          const updated = [...appliedDiscounts];
                          updated[index] = { ...updated[index], original_price: parseFloat(e.target.value) || 0 };
                          setAppliedDiscounts(updated);
                        }}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className={`w-full border border-gray-300 rounded pl-16 pr-2 py-1.5 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAppliedDiscounts([...appliedDiscounts, { discount_name: '', discount_amount: 0, discount_type: 'fixed', original_price: baseSubtotal, special_pricing_id: null }])}
                  className={`text-xs text-${fullColor} hover:underline`}
                >
                  + Add Discount
                </button>
                <div>
                  <label className="block font-semibold mb-2 text-sm text-neutral-800">Discount Amount (applied to total)</label>
                  <div className="relative w-48">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Math.min(discountCeiling, Math.max(0, parseFloat(e.target.value) || 0)))}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className={`w-full border border-gray-300 rounded pl-6 pr-2 py-2 text-sm focus:ring-1 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={isOrderLine ? "pointer-events-none opacity-50 select-none" : undefined}>
              <h3 className="text-xl font-bold mb-4 text-neutral-900 flex items-center gap-2">
                <DollarSign className={`w-5 h-5 text-${themeColor}-600`} /> Status & Payment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttractionStatus)}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked In</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as AttractionPaymentMethod)}
                    className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                  >
                    <option value="in-store">In-Store</option>
                    <option value="authorize.net">Authorize.Net</option>
                    <option value="card">Card</option>
                    <option value="paylater">Pay Later</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-2 text-base text-neutral-800">Amount Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Math.min(displayTotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className={`w-full rounded-md border border-gray-200 pl-7 pr-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all`}
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  {balance > 0 ? (
                    <div className="w-full bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                      <p className="text-sm font-medium text-red-700">Balance Due: <span className="font-bold">${balance.toFixed(2)}</span></p>
                    </div>
                  ) : (
                    <div className="w-full bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <p className="text-sm font-medium text-green-700">Fully Paid</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900">Notes</h3>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full rounded-md border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 bg-white text-neutral-900 text-base transition-all placeholder:text-gray-400 resize-none`}
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 text-neutral-900">Email Notification</h3>
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {sendNotification ? (
                    <Bell size={18} className="text-green-600" />
                  ) : (
                    <BellOff size={18} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">
                    {sendNotification ? 'Customer will receive an updated receipt' : 'Silent update (no email)'}
                  </span>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setSendNotification(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-l-lg border transition-colors ${!sendNotification ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                  >
                    Don't Send
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendNotification(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-r-lg border-t border-r border-b transition-colors ${sendNotification ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                  >
                    Send Email
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <StandardButton variant="secondary" size="lg" onClick={() => navigate(getBackPath())} disabled={submitting}>
                Cancel
              </StandardButton>
              <StandardButton variant="primary" size="lg" icon={Save} type="submit" disabled={submitting} loading={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </StandardButton>
            </div>
          </form>
        </div>
      </div>

      <div className="w-full md:w-96 md:sticky md:top-8 md:self-start">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 md:p-8 shadow-none">
          <h2 className={`text-xl font-bold mb-4 text-${fullColor} pb-2`}>Order Summary</h2>

          <div className="space-y-4">
            {selectedAttraction && (
              <div className="pb-4 border-b border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Attraction</p>
                <p className="font-semibold text-gray-900">{selectedAttraction.name}</p>
                <p className="text-sm text-gray-600 mt-1">${Number(selectedAttraction.price).toFixed(2)} × {quantity}</p>
              </div>
            )}

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Customer</p>
              <p className="font-medium text-gray-900">{guestName || 'Walk-in Customer'}</p>
              <p className="text-sm text-gray-600">{guestEmail || 'No email'}</p>
              <p className="text-sm text-gray-600">{guestPhone || 'No phone'}</p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Scheduled</p>
              <p className="font-medium text-gray-900">
                {scheduledDate ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
              </p>
              <p className="text-sm text-gray-600">
                {scheduledTime ? new Date(`2000-01-01T${scheduledTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Not set'}
              </p>
            </div>

            <div className="pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${pill.color}`}>{pill.label}</span>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-3">Payment Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">${baseSubtotal.toFixed(2)}</span>
                </div>

                {Object.keys(selectedAddOns).length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Add-ons</p>
                    {Object.entries(selectedAddOns).map(([addId, qty]) => {
                      const addOn = availableAddOns.find((a: any) => a.id === Number(addId));
                      if (!addOn) return null;
                      const lineTotal = getAddOnUnitPrice(Number(addId), addOn) * qty;
                      return (
                        <div key={addId} className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOn.name} {qty > 1 && `×${qty}`}</span>
                          <span className="text-gray-900">${lineTotal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {feeBreakdownForDisplay && feeBreakdownForDisplay.fees.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <PriceBreakdownDisplay breakdown={feeBreakdownForDisplay} compact />
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm text-red-600">Discount</span>
                    <span className="font-medium text-red-600">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">Total Amount</span>
                  <span className="font-bold text-gray-900">${displayTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Amount Paid</span>
                  <span className="font-semibold text-green-600">${amountPaid.toFixed(2)}</span>
                </div>

                {balance > 0 ? (
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-red-700">Balance Due</span>
                    <span className="font-bold text-red-600">${balance.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-green-700">Payment Status</span>
                    <span className="font-bold text-green-600">Fully Paid</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default EditPurchase;
