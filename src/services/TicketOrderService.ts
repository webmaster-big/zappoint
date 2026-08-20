import axios from 'axios';
import { API_BASE_URL, getStoredUser } from '../utils/storage';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

export type CartItemType = 'attraction' | 'event';

export interface CartAddOn {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  key: string;
  type: CartItemType;
  id: number;
  name: string;
  image?: string | null;
  locationId: number;
  locationName?: string;
  unitPrice: number;
  quantity: number;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  addOns?: CartAddOn[];
}

export interface AppliedDiscount {
  special_pricing_id?: number;
  name?: string;
  discount_name?: string;
  description?: string | null;
  discount_label?: string;
  discount_type?: string;
  discount_amount?: number;
}

export interface AppliedFee {
  fee_name?: string;
  fee_amount?: number;
  fee_application_type?: string;
}

export interface LineAddOn {
  id?: number;
  add_on_id?: number;
  name: string;
  quantity: number;
  price_at_purchase: number;
  line_total?: number;
}

export interface QuoteLine {
  type: CartItemType;
  position: number;
  entity_id: number;
  entity_name: string;
  location_id: number;
  quantity: number;
  unit_price: number;
  unit_price_after_discount: number;
  subtotal: number;
  add_ons: LineAddOn[];
  add_ons_total: number;
  discount_amount: number;
  applied_discounts: AppliedDiscount[];
  fee_total: number;
  applied_fees: AppliedFee[];
  total_amount: number;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export interface CartQuote {
  location_id: number;
  lines: QuoteLine[];
  subtotal: number;
  discount_amount: number;
  fee_total: number;
  total_amount: number;
  item_count: number;
  ticket_count: number;
}

export interface OrderLine {
  id: number;
  type: CartItemType;
  position: number;
  name: string;
  entity_id: number;
  quantity: number;
  unit_price?: number | null;
  unit_price_after_discount?: number | null;
  total_amount: number;
  amount_paid: number;
  discount_amount: number;
  applied_discounts?: AppliedDiscount[];
  applied_fees?: AppliedFee[];
  add_ons?: LineAddOn[];
  status: string;
  checked_in_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  reference_number?: string | null;
}

export interface TicketOrder {
  id: number;
  reference_number: string;
  status: string;
  location_id: number;
  location_name?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  purchase_date?: string | null;
  item_count: number;
  ticket_count: number;
  subtotal: number;
  discount_amount: number;
  fee_total: number;
  total_amount: number;
  amount_paid: number;
  remaining_balance: number;
  payment_method?: string | null;
  transaction_id?: string | null;
  notes?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  lines: OrderLine[];
}

export interface CheckoutPayload {
  customer_id?: number | null;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  guest_address?: string;
  guest_city?: string;
  guest_state?: string;
  guest_zip?: string;
  guest_country?: string;
  sms_consent?: boolean;
  payment_method?: string;
  notes?: string;
}

const toApiItems = (items: CartItem[]) =>
  items.map(item => ({
    type: item.type,
    id: item.id,
    quantity: item.quantity,
    scheduled_date: item.scheduledDate ?? null,
    scheduled_time: item.scheduledTime ?? null,
    add_ons: (item.addOns ?? []).map(a => ({ id: a.id, quantity: a.quantity })),
  }));

const messageFrom = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    if (data?.message) return data.message;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    if (first) return first;
  }
  return fallback;
};

const authHeaders = () => {
  const token = getStoredUser()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface OrderListFilters {
  location_id?: number | null;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}

export interface OrderListResult {
  orders: TicketOrder[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export const lastQrTokens: Record<number, string> = {};

const ticketOrderService = {
  async list(filters: OrderListFilters = {}): Promise<OrderListResult> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    );
    try {
      const { data } = await api.get('/ticket-orders', { params, headers: authHeaders() });
      return { orders: (data.data ?? []) as TicketOrder[], meta: data.meta };
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not load orders.'));
    }
  },

  async get(id: number): Promise<TicketOrder> {
    try {
      const { data } = await api.get(`/ticket-orders/${id}`, { headers: authHeaders() });
      return data.data as TicketOrder;
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not load that order.'));
    }
  },

  async storeQrCode(id: number, qrCodeDataUri: string): Promise<void> {
    try {
      await api.post(`/ticket-orders/${id}/qrcode`, { qr_code: qrCodeDataUri, qr_token: lastQrTokens[id] }, { headers: authHeaders() });
    } catch {
      return;
    }
  },

  async cancel(id: number): Promise<TicketOrder> {
    try {
      const { data } = await api.post(`/ticket-orders/${id}/cancel`, {}, { headers: authHeaders() });
      return data.data as TicketOrder;
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not cancel that order.'));
    }
  },

  async checkIn(id: number, lineIds?: number[]): Promise<{ checked_in: number; skipped: Array<{ id: number; reason: string }>; order: TicketOrder }> {
    try {
      const { data } = await api.post(`/ticket-orders/${id}/check-in`,
        lineIds && lineIds.length ? { line_ids: lineIds } : {},
        { headers: authHeaders() });
      return data.data;
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not check that order in.'));
    }
  },

  async rollback(id: number): Promise<void> {
    try {
      await api.delete(`/ticket-orders/${id}/rollback`);
    } catch {
      /* the order stays pending for staff to clear; never mask the payment error */
    }
  },

  async quote(items: CartItem[]): Promise<CartQuote> {
    try {
      const { data } = await api.post('/ticket-orders/quote', { items: toApiItems(items) });
      return data.data as CartQuote;
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not price your cart just now.'));
    }
  },

  async checkout(items: CartItem[], payload: CheckoutPayload): Promise<TicketOrder> {
    try {
      const { data } = await api.post('/ticket-orders', { items: toApiItems(items), ...payload }, { headers: authHeaders() });
      const order = data.data as TicketOrder;
      if (data.qr_token) lastQrTokens[order.id] = data.qr_token as string;
      return order;
    } catch (error) {
      throw new Error(messageFrom(error, 'We could not place your order just now.'));
    }
  },
};

export default ticketOrderService;
