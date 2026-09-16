/**
 * Mobile Haptic Tactile Feedback Utility
 * Provides instant tactile confirmation for fast-paced order punching, KOT sending, and button taps on Android devices.
 */

export type HapticType = "tap" | "success" | "warning" | "error" | "heavy";

export function triggerHaptic(type: HapticType = "tap"): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (type) {
      case "tap":
        // Crisp 20ms pulse for item additions & key taps
        navigator.vibrate(20);
        break;
      case "success":
        // Quick double pulse for KOT dispatched, Bill paid
        navigator.vibrate([35, 40, 45]);
        break;
      case "warning":
        // Alert pulse for out of stock, validation warning
        navigator.vibrate([60, 40, 60]);
        break;
      case "error":
        // Distinct buzzing pulse for errors / cancellations
        navigator.vibrate([100, 50, 100]);
        break;
      case "heavy":
        navigator.vibrate(60);
        break;
    }
  } catch {
    // Silent fallback on devices with vibration disabled or permissions restricted
  }
}
