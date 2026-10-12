import type { CartItem, OrderLine, TicketOrder } from '../services/TicketOrderService';

interface OrderableCart {
  items: CartItem[];
  removeItem: (key: string) => void;
  clear: () => void;
}

const day = (value?: string | null): string => (value ?? '').slice(0, 10);

const time = (value?: string | null): string => (value ?? '').slice(0, 5);

const closeness = (line: OrderLine, item: CartItem): number =>
  (day(line.scheduled_date) === day(item.scheduledDate) ? 4 : 0)
  + (item.scheduledTime && time(line.scheduled_time) === time(item.scheduledTime) ? 2 : 0)
  + (line.quantity === item.quantity ? 1 : 0);

let checkoutPageHeld = false;

export const holdCheckoutPage = (held: boolean): void => {
  checkoutPageHeld = held;
};

export const checkoutPageIsHeld = (): boolean => checkoutPageHeld;

export const removeOrderedItems = (cart: OrderableCart, order: TicketOrder): number => {
  const remaining = [...cart.items];
  const ordered: string[] = [];

  order.lines.forEach((line) => {
    let best = -1;
    remaining.forEach((item, index) => {
      if (item.type !== line.type || item.id !== line.entity_id) return;
      if (best < 0 || closeness(line, item) > closeness(line, remaining[best])) best = index;
    });
    if (best >= 0) {
      ordered.push(remaining[best].key);
      remaining.splice(best, 1);
    }
  });

  holdCheckoutPage(true);

  if (remaining.length === 0) {
    cart.clear();
    return 0;
  }

  ordered.forEach((key) => cart.removeItem(key));
  return remaining.length;
};
