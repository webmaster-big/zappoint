import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem } from '../services/TicketOrderService';

const STORAGE_KEY = 'zapzone_cart';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  ticketCount: number;
  estimatedTotal: number;
  locationId: number | null;
  addItem: (item: Omit<CartItem, 'key'>) => { ok: boolean; message?: string };
  updateQuantity: (key: string, quantity: number) => void;
  updateItem: (key: string, patch: Partial<Pick<CartItem, 'scheduledDate' | 'scheduledTime' | 'addOns'>>) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const keyFor = (item: Omit<CartItem, 'key'>) =>
  [item.type, item.id, item.scheduledDate ?? '', item.scheduledTime ?? ''].join('|');

const readStored = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        typeof i?.key === 'string' &&
        (i.type === 'attraction' || i.type === 'event') &&
        typeof i.id === 'number' &&
        typeof i.quantity === 'number' &&
        i.quantity > 0,
    );
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(readStored);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* a full or blocked storage must never break checkout */
    }
  }, [items]);

  const locationId = items.length > 0 ? items[0].locationId : null;

  const addItem = useCallback((incoming: Omit<CartItem, 'key'>) => {
    if (incoming.quantity < 1) {
      return { ok: false, message: 'Choose at least one ticket.' };
    }

    let result: { ok: boolean; message?: string } = { ok: true };

    setItems(current => {
      if (current.length > 0 && current[0].locationId !== incoming.locationId) {
        result = {
          ok: false,
          message: `Your cart already has items from ${current[0].locationName ?? 'another location'}. Check out or empty it first.`,
        };
        return current;
      }

      const key = keyFor(incoming);
      const existing = current.findIndex(i => i.key === key);

      if (existing >= 0) {
        const next = [...current];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + incoming.quantity };
        return next;
      }

      return [...current, { ...incoming, key }];
    });

    return result;
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems(current =>
      quantity < 1
        ? current.filter(i => i.key !== key)
        : current.map(i => (i.key === key ? { ...i, quantity } : i)),
    );
  }, []);

  const updateItem = useCallback(
    (key: string, patch: Partial<Pick<CartItem, 'scheduledDate' | 'scheduledTime' | 'addOns'>>) => {
      setItems(current => current.map(i => (i.key === key ? { ...i, ...patch } : i)));
    },
    [],
  );

  const removeItem = useCallback((key: string) => {
    setItems(current => current.filter(i => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const ticketCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const estimatedTotal = items.reduce((sum, i) => {
      const addOns = (i.addOns ?? []).reduce((s, a) => s + a.price * a.quantity, 0);
      return sum + i.unitPrice * i.quantity + addOns;
    }, 0);

    return {
      items,
      itemCount: items.length,
      ticketCount,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      locationId,
      addItem,
      updateQuantity,
      updateItem,
      removeItem,
      clear,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
    };
  }, [items, locationId, addItem, updateQuantity, updateItem, removeItem, clear, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/** Null outside a CartProvider — for pages that mount on routes both inside and outside it. */
export const useCartSafe = (): CartContextValue | null => {
  return useContext(CartContext) ?? null;
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside a CartProvider');
  }
  return context;
};
