import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartSelection = {
  groupId: string;
  groupTitle: string;
  choiceId: string;
  choiceName: string;
  price: number;
  imageUrl?: string;
  imageUrls?: string[];
};

export type ShopCartItem = {
  key: string;
  product: any;
  quantity: number;
  selections: CartSelection[];
  unitPrice: number;
  imageUrl?: string;
};

type ShopCartValue = {
  items: ShopCartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<ShopCartItem, "key">) => void;
  updateQuantity: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "havestory-shop-cart-v1";
const ShopCartContext = createContext<ShopCartValue | null>(null);

function itemKey(productId: unknown, selections: CartSelection[]) {
  const optionKey = selections.map(item => `${item.groupId}:${item.choiceId}`).join("|");
  return `${String(productId)}::${optionKey}`;
}

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShopCartItem[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage is optional */ }
  }, [items]);

  const value = useMemo<ShopCartValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem: incoming => setItems(current => {
      const key = itemKey(incoming.product.id, incoming.selections);
      const existing = current.find(item => item.key === key);
      if (existing) {
        return current.map(item => item.key === key
          ? { ...item, quantity: item.quantity + incoming.quantity, unitPrice: incoming.unitPrice, imageUrl: incoming.imageUrl }
          : item);
      }
      return [...current, { ...incoming, key }];
    }),
    updateQuantity: (key, delta) => setItems(current => current
      .map(item => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)),
    removeItem: key => setItems(current => current.filter(item => item.key !== key)),
    clear: () => setItems([]),
  }), [items]);

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const value = useContext(ShopCartContext);
  if (!value) throw new Error("useShopCart must be used inside ShopCartProvider");
  return value;
}
