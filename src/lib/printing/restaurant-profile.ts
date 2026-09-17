/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Active Restaurant Identity & Profile Provider
 */

export const RESTAURANT_NAME = "कोल्हापुरी खानावळ";
export const RESTAURANT_NAME_EN = "KOLHAPURI KHANAWAL";
export const RESTAURANT_ADDRESS = "Lalit Estate, Baner, Pune, Maharashtra 411045";
export const RESTAURANT_PHONE = "+91 91753 86576";
export const RESTAURANT_GSTIN = "27AAAAA0000A1Z5";
export const RESTAURANT_FSSAI = "11026999000123";
export const RESTAURANT_UPI_ID = "Q338740118@ybl";
export const RESTAURANT_UPI_MERCHANT_NAME = "Kolapuri khanawal";
export const RESTAURANT_UPI_TERMINAL = "Terminal 1-Q338740118";

export interface ActiveRestaurantProfile {
  nameMr: string;
  nameEn: string;
  tagline: string;
  address: string;
  phone: string;
  secondaryPhone?: string;
  gstin: string;
  fssai: string;
  upiId: string;
  upiMerchantName: string;
  upiTerminal?: string;
}

export function getActiveRestaurantProfile(): ActiveRestaurantProfile {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kk_restaurant_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile) {
          const rawAddress = parsed.profile.address?.trim() || "";
          const isOldAddress =
            !rawAddress ||
            rawAddress.includes("Shahupuri") ||
            rawAddress.includes("CSMT") ||
            rawAddress.includes("Shahu Complex");
          const address = isOldAddress ? RESTAURANT_ADDRESS : rawAddress;

          const rawPhone = (parsed.profile.primaryPhone || parsed.profile.phone || "").trim();
          const isOldPhone = !rawPhone || rawPhone.includes("98230 12345");
          const phone = isOldPhone ? RESTAURANT_PHONE : rawPhone;

          const rawUpiId = parsed.profile.upiId?.trim() || "";
          const isOldUpiId =
            !rawUpiId ||
            rawUpiId.includes("okaxis") ||
            rawUpiId.includes("okhdfcbank");
          const upiId = isOldUpiId ? RESTAURANT_UPI_ID : rawUpiId;

          const rawUpiName = parsed.profile.upiMerchantName?.trim() || "";
          const upiMerchantName =
            !rawUpiName || rawUpiName.includes("Baner")
              ? RESTAURANT_UPI_MERCHANT_NAME
              : rawUpiName;

          return {
            nameMr: parsed.profile.nameMr?.trim() || RESTAURANT_NAME,
            nameEn: parsed.profile.nameEn?.trim() || RESTAURANT_NAME_EN,
            tagline: parsed.profile.tagline?.trim() || "",
            address,
            phone,
            secondaryPhone: parsed.profile.secondaryPhone?.trim() || "",
            gstin:
              parsed.profile.gstin !== undefined
                ? parsed.profile.gstin.trim()
                : RESTAURANT_GSTIN,
            fssai:
              parsed.profile.fssai !== undefined
                ? parsed.profile.fssai.trim()
                : RESTAURANT_FSSAI,
            upiId,
            upiMerchantName,
            upiTerminal: RESTAURANT_UPI_TERMINAL,
          };
        }
      }
    } catch {}
  }
  return {
    nameMr: RESTAURANT_NAME,
    nameEn: RESTAURANT_NAME_EN,
    tagline: "",
    address: RESTAURANT_ADDRESS,
    phone: RESTAURANT_PHONE,
    secondaryPhone: "",
    gstin: RESTAURANT_GSTIN,
    fssai: RESTAURANT_FSSAI,
    upiId: RESTAURANT_UPI_ID,
    upiMerchantName: RESTAURANT_UPI_MERCHANT_NAME,
    upiTerminal: RESTAURANT_UPI_TERMINAL,
  };
}
