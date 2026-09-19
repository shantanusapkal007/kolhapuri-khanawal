/**
 * Draft Cart Management for Ultra-Fast POS Operations
 * Preserves un-sent cart items per party ID across table switching,
 * floor navigation, and browser reloads.
 */

import { MenuItem, BreadOption } from "@/types/orders";

export interface CartItem {
  menuItem: MenuItem;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  breadOption?: BreadOption;
  breadCounts?: Partial<Record<BreadOption, number>>;
  notes?: string;
  customNote?: string;
  spiceLevel?: "MILD" | "MEDIUM" | "SPICY" | "THECHA_EXTRA_SPICY";
}

const STORAGE_KEY = "kk_draft_carts_v1";

// In-memory cache for ultra-low latency reads
let memoryCache: Record<string, CartItem[]> = {};
let isHydrated = false;

function hydrate(): void {
  if (isHydrated || typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not hydrate draft carts from localStorage", e);
  } finally {
    isHydrated = true;
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    window.dispatchEvent(new CustomEvent("kk-draft-carts-changed"));
  } catch (e) {
    console.warn("Could not persist draft carts to localStorage", e);
  }
}

/**
 * Retrieves the draft cart items for a specific dining party.
 */
export function getDraftCart(partyId: string): CartItem[] {
  hydrate();
  return memoryCache[partyId] ? [...memoryCache[partyId]] : [];
}

/**
 * Saves or updates the draft cart for a party.
 */
export function saveDraftCart(partyId: string, cart: CartItem[]): void {
  hydrate();
  if (!cart || cart.length === 0) {
    delete memoryCache[partyId];
  } else {
    memoryCache[partyId] = cart;
  }
  persist();
}

/**
 * Clears the draft cart for a party once KOT is sent or cart is cleared.
 */
export function clearDraftCart(partyId: string): void {
  hydrate();
  if (memoryCache[partyId]) {
    delete memoryCache[partyId];
    persist();
  }
}

/**
 * Returns a map of partyId -> count of draft items in cart.
 * Used for showing draft badges on the floor map.
 */
export function getAllDraftCartCounts(): Record<string, number> {
  hydrate();
  const result: Record<string, number> = {};
  for (const [partyId, items] of Object.entries(memoryCache)) {
    const totalQty = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (totalQty > 0) {
      result[partyId] = totalQty;
    }
  }
  return result;
}
