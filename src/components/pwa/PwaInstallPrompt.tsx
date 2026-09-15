"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X, Smartphone, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user already dismissed in this session
    if (sessionStorage.getItem("khanawal_pwa_dismissed") === "true") {
      setIsDismissed(true);
    }

    // Check if already in standalone / installed mode
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(standaloneCheck);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Listen for Android/Desktop native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("khanawal_pwa_dismissed", "true");
  };

  // Do not display if already installed standalone, or user dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  // Show banner if deferredPrompt is available OR if on iOS Safari
  const shouldShow = deferredPrompt !== null || isIos;

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom-Right Install Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/40 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-start justify-between gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 p-0.5 shrink-0 shadow-md">
            <img
              src="/icons/icon-192x192.png"
              alt="Kolhapuri Khanawal Logo"
              className="w-full h-full object-cover rounded-[10px]"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-amber-300 truncate">खानावळ POS App</span>
              <span className="text-[9px] font-extrabold bg-red-600/90 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                Native PWA
              </span>
            </div>
            <p className="text-[11px] text-stone-300 font-medium leading-tight mt-0.5">
              {isIos ? "iPhone वर 1-टॅपमध्ये ॲप इंस्टॉल करा" : "Install on your mobile phone for 1-tap orders"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-stone-800 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all touch-manipulation"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>{isIos ? "Install on iPhone / iPad" : "Install App (ॲप घ्या)"}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[11px] font-bold text-stone-400 hover:text-stone-200 px-2 py-2"
          >
            Later
          </button>
        </div>
      </div>

      {/* iOS Safari Step-by-Step Install Guide Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-stone-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-6 duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-700 p-0.5 text-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">Install on iPhone / iPad</h3>
                  <span className="text-[11px] text-stone-500 font-semibold">Safari Browser Setup Guide</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs text-stone-700">
              <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                Apple requires installing Web Apps directly through Safari:
              </p>

              {/* Step 1 */}
              <div className="flex items-start gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  1
                </div>
                <div className="flex-1">
                  <span className="font-extrabold text-stone-900 block text-xs">
                    Tap the Share Button (शेअर बटण)
                  </span>
                  <span className="text-[11px] text-stone-500 font-medium">
                    At the bottom bar in Safari, tap the{" "}
                    <strong className="text-blue-600 inline-flex items-center gap-0.5">
                      Share <Share className="w-3 h-3 inline" />
                    </strong>{" "}
                    icon.
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
                <div className="w-7 h-7 rounded-xl bg-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  2
                </div>
                <div className="flex-1">
                  <span className="font-extrabold text-stone-900 block text-xs">
                    Select "Add to Home Screen"
                  </span>
                  <span className="text-[11px] text-stone-500 font-medium">
                    Scroll down the menu list and tap{" "}
                    <strong className="text-stone-900 inline-flex items-center gap-0.5">
                      "Add to Home Screen" <PlusSquare className="w-3 h-3 inline text-emerald-600" />
                    </strong>.
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  3
                </div>
                <div className="flex-1">
                  <span className="font-extrabold text-stone-900 block text-xs">Tap "Add" in Top-Right</span>
                  <span className="text-[11px] text-stone-500 font-medium">
                    Tap <strong>Add</strong> in the top-right corner. The <strong>खानावळ POS</strong> icon will now appear on your home screen like a native App!
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white font-black text-xs py-2.5 rounded-xl shadow-xs active:scale-95 transition-all"
              >
                Got It (समजले)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
