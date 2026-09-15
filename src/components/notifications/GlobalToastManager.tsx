"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, ChefHat, Sparkles, Receipt, Boxes, AlertTriangle, ArrowRight } from "lucide-react";
import { RestaurantNotification } from "@/types/domain";

export function GlobalToastManager() {
  const [activeToasts, setActiveToasts] = useState<RestaurantNotification[]>([]);

  useEffect(() => {
    const handleNewNotif = (event: Event) => {
      const customEvent = event as CustomEvent<RestaurantNotification>;
      if (!customEvent.detail) return;
      const notif = customEvent.detail;

      // Add to toast stack
      setActiveToasts((prev) => [notif, ...prev.slice(0, 2)]);

      // Auto dismiss after 4.5s
      setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== notif.id));
      }, 4500);
    };

    window.addEventListener("khanawal-notification", handleNewNotif);
    return () => window.removeEventListener("khanawal-notification", handleNewNotif);
  }, []);

  if (activeToasts.length === 0) return null;

  const getIcon = (category: RestaurantNotification["category"]) => {
    switch (category) {
      case "KITCHEN":
        return <ChefHat className="w-4 h-4 text-amber-400" />;
      case "SERVICE":
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case "BILLING":
        return <Receipt className="w-4 h-4 text-amber-300" />;
      case "INVENTORY":
        return <Boxes className="w-4 h-4 text-amber-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed top-16 right-3 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border text-xs text-white transition-all transform animate-in slide-in-from-top-4 duration-200 ${
            toast.urgency === "CRITICAL"
              ? "bg-stone-900 border-red-500/60 shadow-red-900/20 ring-1 ring-red-500/30"
              : toast.urgency === "HIGH"
              ? "bg-stone-900 border-amber-500/60 shadow-amber-900/20"
              : "bg-stone-900 border-stone-700"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-stone-800 border border-stone-700">
                {getIcon(toast.category)}
              </div>
              <div>
                <span className="font-black text-amber-200 text-xs">{toast.title}</span>
                <span className="ml-2 text-[9px] uppercase tracking-wider font-bold text-stone-400">
                  {toast.category}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-stone-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-stone-300 mt-1.5 text-[11px] leading-relaxed">{toast.message}</p>

          {toast.actionUrl && (
            <div className="mt-2 pt-2 border-t border-stone-800 flex justify-end">
              <Link
                href={toast.actionUrl}
                onClick={() => setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 hover:text-amber-200 transition-colors"
              >
                <span>{toast.actionLabel || "View"}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
