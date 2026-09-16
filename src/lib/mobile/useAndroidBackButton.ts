"use client";

import { useEffect, useRef } from "react";

/**
 * useAndroidBackButton
 * Intercepts Android hardware/gesture back button navigation so that open
 * bottom sheets, modals, or slide-over menus are dismissed first instead
 * of exiting the app or navigating away.
 *
 * @param isOpen - whether the modal/drawer/sheet is currently visible
 * @param onDismiss - callback to close the modal/drawer/sheet
 */
export function useAndroidBackButton(isOpen: boolean, onDismiss: () => void): void {
  const isPushedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isOpen) {
      // Push temporary state so back button triggers popstate rather than exiting
      window.history.pushState({ modalBackTrap: true, timestamp: Date.now() }, "");
      isPushedRef.current = true;

      const handlePopState = (event: PopStateEvent) => {
        if (isPushedRef.current) {
          isPushedRef.current = false;
          onDismissRef.current();
        }
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        // If modal was dismissed via close button or submit instead of back button,
        // step back to remove the dummy history entry
        if (isPushedRef.current) {
          isPushedRef.current = false;
          window.history.back();
        }
      };
    }
  }, [isOpen]);
}
