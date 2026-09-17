/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 0: Menu, Orders, Order Items, KOT & Kitchen Station Types
 */

export type KotStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

export type KitchenStationCode =
  | "MAIN_KITCHEN"
  | "THALI_SECTION"
  | "TANDOOR_BHAKRI"
  | "FRY_SECTION"
  | "BEVERAGE_DESSERT";

export interface KitchenStation {
  id: string;
  code: KitchenStationCode;
  name: string;
  printerIp?: string;
  displayColor: string;
  isActive: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  localName?: string; // e.g. "थाळी विशेष", "भाकरी आणि चपाती"
  code: string;
  displayOrder: number;
  iconName?: string;
  isActive: boolean;
}

export type FoodType = "VEG" | "NON_VEG";

export interface MenuItemVariant {
  name: string; // e.g. "Half", "Full"
  price: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  localName?: string; // e.g. "कोल्हापुरी स्पेशल चिकन थाळी", "तांबडा रस्सा वाटी"
  code: string;
  description?: string;
  sellingPrice: number;
  price?: number; // convenience alias matching POS DB structure
  costPrice?: number;
  isVeg: boolean;
  foodType?: FoodType;
  variants?: MenuItemVariant[];
  isThali: boolean;
  stationCode: KitchenStationCode;
  taxCategoryId: string;
  gstRate?: number; // e.g. 5
  portionAvailability: number; // calculated from theoretical ingredients
  stockStatus: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE";
  isAvailable?: boolean; // convenience boolean matching POS DB structure
  isDailySpecial: boolean;
  preparationTimeMinutes: number;
  displayOrder: number;
  sortOrder?: number; // POS DB sort order
  isActive: boolean;
  image?: string;
  modifiers?: MenuItemModifier[];
}

export interface MenuItemModifier {
  id: string;
  menuItemId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "ORD-2026-000001"
  partyId: string;
  partyCode: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  status: "OPEN" | "KOT_SENT" | "BILLED" | "CANCELLED";
  idempotencyKey: string;
  items: OrderItem[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export type BreadOption = "CHAPATI" | "JWARI_BHAKRI" | "BAJRI_BHAKRI" | "ROTI";

export interface BreadOptionConfig {
  id: BreadOption;
  name: string;
  localName: string;
  shortCode: string;
  emoji: string;
}

export const BREAD_OPTIONS: BreadOptionConfig[] = [
  { id: "JWARI_BHAKRI", name: "Jwari Bhakri", localName: "ज्वारी भाकरी", shortCode: "ज्वारी", emoji: "🌾" },
  { id: "BAJRI_BHAKRI", name: "Bajri Bhakri", localName: "बाजरी भाकरी", shortCode: "बाजरी", emoji: "🌾" },
  { id: "CHAPATI", name: "Chapati", localName: "चपाती / पोळी", shortCode: "चपाती", emoji: "🫓" },
  { id: "ROTI", name: "Roti", localName: "रोटी", shortCode: "रोटी", emoji: "🍞" },
];

export const BREAD_OPTION_LABELS: Record<BreadOption, { en: string; mr: string; full: string }> = {
  JWARI_BHAKRI: { en: "Jwari Bhakri", mr: "ज्वारी भाकरी", full: "ज्वारी भाकरी (Jwari Bhakri)" },
  BAJRI_BHAKRI: { en: "Bajri Bhakri", mr: "बाजरी भाकरी", full: "बाजरी भाकरी (Bajri Bhakri)" },
  CHAPATI: { en: "Chapati", mr: "चपाती", full: "चपाती (Chapati)" },
  ROTI: { en: "Roti", mr: "रोटी", full: "रोटी (Roti)" },
};

export function isThaliItem(item: { id?: string; categoryId?: string; name: string; isThali?: boolean }): boolean {
  if (item.isThali) return true;
  const catId = (item.categoryId || "").toLowerCase();
  if (catId.includes("thali")) return true;
  const name = item.name.toLowerCase();
  if (name.includes("thali")) return true;
  return false;
}

/**
 * Checks if an item should prompt for bread options (Jwari Bhakri, Bajri Bhakri, Chapati, Roti).
 * Per restaurant policy: ONLY Thalis include bread options.
 * Main course dishes (Handi, Sukka, Rassa, Curry, Masala, etc.) are a la carte,
 * so breads are ordered as separate items and do NOT prompt for bread options.
 */
export function isThaliOrMainCourseItem(item: { id?: string; categoryId?: string; name: string; isThali?: boolean }): boolean {
  return isThaliItem(item);
}

export interface OrderItem {
  id: string;
  orderId: string;
  partyId: string;
  menuItemId: string;
  menuItemName: string;
  variantName?: string; // e.g. "Half", "Full"
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  seatNumber?: number; // Optional seat tagging: 1..N
  spiceLevel?: "MILD" | "MEDIUM" | "SPICY" | "THECHA_EXTRA_SPICY";
  breadOption?: BreadOption;
  notes?: string;
  kotId?: string;
  kotNumber?: string;
  kotStatus: KotStatus;
  isCancelled: boolean;
  cancelledAt?: string;
  cancelledReason?: string;
}

export interface Kot {
  id: string;
  kotNumber: string; // e.g. "KOT-2026-000001"
  versionSuffix?: string; // e.g. "", "-A", "-B"
  orderId: string;
  partyId: string;
  partyCode: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  stationCode: KitchenStationCode;
  guestCount: number;
  status: KotStatus;
  items: KotItem[];
  notes?: string;
  elapsedSeconds: number;
  urgencyLevel: "NORMAL" | "MEDIUM" | "URGENT"; // <5min, 5-12min, >12min
  kotSequenceNumber?: number; // 1, 2, 3...
  isAddOn?: boolean; // true if this is an add-on order for an existing table
  isTakeaway?: boolean; // true if parcel order
  customerName?: string;
  createdAt: string;
  acknowledgedAt?: string;
  readyAt?: string;
  servedAt?: string;
}

export interface KotItem {
  id: string;
  kotId: string;
  orderItemId: string;
  menuItemId: string;
  menuItemName: string;
  variantName?: string; // e.g. "Half", "Full"
  quantity: number;
  seatNumber?: number;
  spiceLevel?: string;
  breadOption?: BreadOption;
  notes?: string;
  status: KotStatus;
}

export interface KotEvent {
  id: string;
  kotId: string;
  kotNumber: string;
  eventType:
    | "CREATED"
    | "ACKNOWLEDGED"
    | "STARTED_PREPARATION"
    | "MARKED_READY"
    | "SERVED"
    | "MODIFIED"
    | "ITEM_CANCELLED";
  performedBy: string;
  performedByName: string;
  role: string;
  reason?: string;
  deltaSummary?: string;
  timestamp: string;
}
