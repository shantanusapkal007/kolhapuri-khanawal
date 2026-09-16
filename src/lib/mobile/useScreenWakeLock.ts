"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useScreenWakeLock
 * Keeps the mobile / tablet screen awake during kitchen order display (KDS)
 * or active waiter service sessions, preventing the screen from dimming or sleeping.
 *
 * @param enabled - whether screen wake lock should be kept active
 */
export function useScreenWakeLock(enabled: boolean = true): {
  isSupported: boolean;
  isActive: boolean;
  requestLock: () => Promise<void>;
  releaseLock: () => Promise<void>;
} {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      setIsSupported(true);
    }
  }, []);

  const requestLock = async () => {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) return;
    try {
      sentinelRef.current = await (navigator as any).wakeLock.request("screen");
      setIsActive(true);

      sentinelRef.current.addEventListener("release", () => {
        setIsActive(false);
      });
    } catch {
      setIsActive(false);
    }
  };

  const releaseLock = async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {}
      sentinelRef.current = null;
      setIsActive(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      releaseLock();
      return;
    }

    requestLock();

    // Auto re-acquire when tab/app returns from background
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabled) {
        requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [enabled]);

  return { isSupported, isActive, requestLock, releaseLock };
}
