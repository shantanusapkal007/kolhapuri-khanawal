"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Khanawal PWA Service Worker active with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("Khanawal PWA Service Worker registration skipped:", err);
        });
    }

    // 2. Network connection listeners
    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top duration-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode Active — Orders & KOTs will auto-sync when WiFi reconnects</span>
        </div>
      )}

      {/* Back Online Reconnect Toast */}
      {showOnlineToast && (
        <div className="fixed top-2 right-4 z-50 bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Wifi className="w-3.5 h-3.5" />
          <span>Connected back online!</span>
        </div>
      )}
    </>
  );
}
