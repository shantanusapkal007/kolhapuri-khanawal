/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Active Restaurant Identity & Profile Provider
 */

export const RESTAURANT_NAME = "कोल्हापुरी खानावळ";
export const RESTAURANT_NAME_EN = "KOLHAPURI KHANAWAL";
export const RESTAURANT_ADDRESS = "CSMT Road, Shahupuri, Kolhapur - 416001";
export const RESTAURANT_PHONE = "+91 98230 12345";
export const RESTAURANT_GSTIN = "27AAAAA0000A1Z5";
export const RESTAURANT_FSSAI = "11026999000123";
export const RESTAURANT_UPI_ID = "kolhapurikhanawal@okaxis";

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
}

export function getActiveRestaurantProfile(): ActiveRestaurantProfile {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("kk_restaurant_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile) {
          return {
            nameMr: parsed.profile.nameMr?.trim() || RESTAURANT_NAME,
            nameEn: parsed.profile.nameEn?.trim() || RESTAURANT_NAME_EN,
            tagline: parsed.profile.tagline?.trim() || "",
            address:
              parsed.profile.address !== undefined
                ? parsed.profile.address.trim()
                : RESTAURANT_ADDRESS,
            phone:
              parsed.profile.primaryPhone !== undefined
                ? parsed.profile.primaryPhone.trim()
                : (parsed.profile.phone !== undefined ? parsed.profile.phone.trim() : RESTAURANT_PHONE),
            secondaryPhone: parsed.profile.secondaryPhone?.trim() || "",
            gstin:
              parsed.profile.gstin !== undefined
                ? parsed.profile.gstin.trim()
                : RESTAURANT_GSTIN,
            fssai:
              parsed.profile.fssai !== undefined
                ? parsed.profile.fssai.trim()
                : RESTAURANT_FSSAI,
            upiId:
              parsed.profile.upiId !== undefined
                ? parsed.profile.upiId.trim()
                : RESTAURANT_UPI_ID,
            upiMerchantName: parsed.profile.upiMerchantName?.trim() || "",
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
    upiMerchantName: "",
  };
}
