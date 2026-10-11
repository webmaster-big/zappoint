import type { CartItem, TicketOrder } from '../services/TicketOrderService';

interface OrderableCart {
  items: CartItem[];
  removeItem: (key: string) => void;
  clear: () => void;
}

const sameTime = (a?: string | null, b?: string | null): boolean => (a ?? '').slice(0, 5) === (b ?? '').slice(0, 5);

export const removeOrderedItems = (cart: OrderableCart, order: TicketOrder): number => {
  const unmatched = [...order.lines];
  const ordered = cart.items.filter((item) => {
    const index = unmatched.findIndex((line) => line.type === item.type
      && line.entity_id === item.id
      && line.quantity === item.quantity
      && (line.scheduled_date ?? '') === (item.scheduledDate ?? '')
      && sameTime(line.scheduled_time, item.scheduledTime));
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  });

  if (ordered.length === 0) {
    cart.clear();
    return 0;
  }

  ordered.forEach((item) => cart.removeItem(item.key));
  return cart.items.length - ordered.length;
};
