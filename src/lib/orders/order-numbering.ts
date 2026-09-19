/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Business Day & Daily Order/Parcel Sequential Numbering Engine
 *
 * Operational Rules:
 * 1. Business Day starts at 10:00 AM (10:00 AM IST).
 * 2. Orders between 10:00 AM today and 09:59:59 AM tomorrow belong to today's shift.
 * 3. At 10:00 AM next morning, counters reset to 1 for both Dine-In and Parcel.
 * 4. Dine-in orders are sequentially numbered: ORDER #1, ORDER #2, ORDER #3...
 * 5. Parcel (takeaway) orders have their own sequential counter: PARCEL ORDER #1, PARCEL ORDER #2...
 */

import { Kot } from "@/types/orders";

/**
 * Calculates the restaurant operational business date key (YYYY-MM-DD).
 * The business day starts at 10:00 AM (10:00 IST).
 * All orders between 10:00 AM today and 09:59:59 AM tomorrow belong to today's business day.
 * At 10:00 AM next morning, the business day rolls over and sequence numbers reset to 1.
 */
export function getBusinessDateKey(dateInput?: string | Date): string {
  const date =
    typeof dateInput === "string" || typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput || new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  let y = parseInt(map.year, 10);
  let m = parseInt(map.month, 10);
  let day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);

  // If before 10:00 AM, it belongs to the previous calendar day's business shift
  if (hour < 10) {
    const prev = new Date(Date.UTC(y, m - 1, day - 1));
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }

  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface ResolvedKotOrderNumber {
  orderNumber: number;
  isTakeaway: boolean;
  orderTitle: string; // e.g. "ORDER #1" or "PARCEL ORDER #1"
  marathiOrderTitle: string; // e.g. "ऑर्डर क्र. 1" or "पार्सल ऑर्डर क्र. 1"
  headerLine: string; // e.g. "ORDER #1 - TABLE NO. 1" or "ORDER - PARCEL #1"
  marathiHeaderLine: string; // e.g. "ऑर्डर #1 — टेबल नं. 1" or "ऑर्डर - पार्सल #1"
}

/**
 * Resolves the sequential order number for a KOT.
 * - For Dine-in: returns the sequential dine-in order number of the day (e.g. 1, 2, 3...)
 * - For Takeaway/Parcel: returns the sequential parcel number of the day (e.g. 1, 2, 3...)
 */
export function resolveKotOrderNumber(kot: Kot): ResolvedKotOrderNumber {
  const isTakeaway = Boolean(kot.isTakeaway);
  let num = 1;

  if (isTakeaway) {
    if (typeof kot.dailyParcelNumber === "number" && kot.dailyParcelNumber > 0) {
      num = kot.dailyParcelNumber;
    } else {
      const match = kot.partyCode?.match(/PARCEL-(\d+)/i);
      if (match) {
        num = parseInt(match[1], 10);
      }
    }
    return {
      orderNumber: num,
      isTakeaway: true,
      orderTitle: `PARCEL ORDER #${num}`,
      marathiOrderTitle: `पार्सल ऑर्डर क्र. ${num}`,
      headerLine: `ORDER - PARCEL #${num}`,
      marathiHeaderLine: `ऑर्डर - पार्सल #${num}`,
    };
  } else {
    if (typeof kot.dailyOrderNumber === "number" && kot.dailyOrderNumber > 0) {
      num = kot.dailyOrderNumber;
    }
    return {
      orderNumber: num,
      isTakeaway: false,
      orderTitle: `ORDER #${num}`,
      marathiOrderTitle: `ऑर्डर क्र. ${num}`,
      headerLine: `ORDER #${num} - TABLE NO. ${kot.tableNumber}`,
      marathiHeaderLine: `ऑर्डर #${num} — ऑर्डर - टेबल नं. ${kot.tableNumber}`,
    };
  }
}
