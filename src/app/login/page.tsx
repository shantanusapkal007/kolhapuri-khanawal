"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  User,
  KeyRound,
  Sparkles,
  Utensils,
  ChefHat,
  Receipt,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { WaiterCredential } from "@/types/domain";

export default function LoginPage() {
  const router = useRouter();
  const store = globalRestaurantStore;

  const [activeTab, setActiveTab] = useState<"WAITER" | "ADMIN">("WAITER");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiters, setWaiters] = useState<WaiterCredential[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<WaiterCredential | null>(null);
  const [activeUser, setActiveUser] = useState(store.currentUser);

  const [manualWaiterInput, setManualWaiterInput] = useState(false);

  const refreshWaiters = () => {
    store.waiterCredentials = store.getStoredWaiterCredentials();
    const activeWaiters = store.waiterCredentials.filter((w) => w.isActive);
    setWaiters(activeWaiters);
    if (activeWaiters.length > 0 && !selectedWaiter) {
      setSelectedWaiter(activeWaiters[0]);
      setUsername(activeWaiters[0].username);
    }
    setActiveUser(store.currentUser);
  };

  useEffect(() => {
    refreshWaiters();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "admin" || params.get("role") === "admin") {
        setActiveTab("ADMIN");
        setUsername("admin");
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "kk_waiter_credentials") {
        refreshWaiters();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleKeypadPress = (num: string) => {
    setError(null);
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleKeypadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPin("");
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    let inputUser = activeTab === "WAITER" ? (selectedWaiter ? selectedWaiter.username : username) : username;

    // If user entered a 4-digit PIN on keypad without selecting a user, use direct PIN login
    if (!inputUser && pin && pin.length >= 4) {
      inputUser = pin;
    }

    if (!inputUser && !pin) {
      setError("Please select staff or enter 4-digit PIN");
      return;
    }

    const payloadUser = inputUser || pin;
    const payloadPin = pin || inputUser;

    try {
      // 1. Authoritative Server-Side Authentication
      const apiRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: payloadUser, pin: payloadPin }),
      });

      const apiData = await apiRes.json().catch(() => null);

      if (apiRes.ok && apiData?.success && apiData?.user) {
        if (apiData.token) {
          try {
            localStorage.setItem("auth_session_token", apiData.token);
          } catch {}
        }
        store.setCurrentUserRole(apiData.user.role);
        store.currentUser.name = apiData.user.name;
        store.currentUser.role = apiData.user.role;

        const targetUrl =
          apiData.user.role === "WAITER"
            ? "/waiter"
            : apiData.user.role === "KITCHEN"
            ? "/kitchen"
            : apiData.user.role === "CASHIER"
            ? "/billing"
            : "/dashboard";

        window.location.href = targetUrl;
        return;
      } else if (apiData?.error) {
        setError(apiData.error);
        return;
      }
    } catch {
      // Fallback for offline PWA operation
    }

    // 2. Offline PWA fallback
    const res = store.loginUser(payloadUser, payloadPin);

    if (res.success && res.user) {
      const targetUrl =
        res.user.role === "WAITER"
          ? "/waiter"
          : res.user.role === "KITCHEN"
          ? "/kitchen"
          : res.user.role === "CASHIER"
          ? "/billing"
          : "/dashboard";

      window.location.href = targetUrl;
    } else {
      setError(res.error || "Invalid username or PIN");
    }
  };

  const handleQuickDemoLogin = async (roleName: string, roleUser: string, rolePin: string) => {
    setUsername(roleUser);
    setPin(rolePin);
    setError(null);

    try {
      const apiRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: roleUser, pin: rolePin }),
      });
      const apiData = await apiRes.json().catch(() => null);
      if (apiRes.ok && apiData?.success && apiData?.user) {
        if (apiData.token) {
          try {
            localStorage.setItem("auth_session_token", apiData.token);
          } catch {}
        }
        store.setCurrentUserRole(apiData.user.role);
        store.currentUser.name = apiData.user.name;
        store.currentUser.role = apiData.user.role;

        const targetUrl =
          apiData.user.role === "WAITER"
            ? "/waiter"
            : apiData.user.role === "KITCHEN"
            ? "/kitchen"
            : apiData.user.role === "CASHIER"
            ? "/billing"
            : "/dashboard";

        window.location.href = targetUrl;
        return;
      }
    } catch {}

    const res = store.loginUser(roleUser, rolePin);
    if (res.success && res.user) {
      const targetUrl =
        res.user.role === "WAITER"
          ? "/waiter"
          : res.user.role === "KITCHEN"
          ? "/kitchen"
          : res.user.role === "CASHIER"
          ? "/billing"
          : "/dashboard";

      window.location.href = targetUrl;
    } else {
      setError(res.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4 sm:p-6 bg-radial from-slate-900 via-stone-950 to-black text-white selection:bg-red-700">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-600 via-red-700 to-amber-700 p-0.5 shadow-2xl shadow-red-700/30">
            <div className="w-full h-full bg-stone-950 rounded-[22px] flex items-center justify-center">
              <span className="text-3xl sm:text-4xl">👑</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              RESTAURANT OS TERMINAL
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              कोल्हापुरी खानावळ
            </h1>
            <p className="text-xs text-stone-400 font-medium">
              Kolhapuri Khanawal — Authentication Portal
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-stone-900/80 p-1 rounded-2xl border border-stone-800 flex gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab("WAITER");
              setError(null);
              setPin("");
              if (selectedWaiter) setUsername(selectedWaiter.username);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all touch-manipulation ${
              activeTab === "WAITER"
                ? "bg-gradient-to-r from-red-700 to-red-600 text-white shadow-md shadow-red-700/30"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>वेटर लॉगिन (Waiter)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("ADMIN");
              setError(null);
              setPin("");
              setUsername("admin");
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all touch-manipulation ${
              activeTab === "ADMIN"
                ? "bg-gradient-to-r from-amber-600 to-amber-700 text-stone-950 shadow-md shadow-amber-600/30"
                : "text-stone-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>व्यवस्थापक / Admin</span>
          </button>
        </div>

        {/* Login Card */}
        <div className="bg-stone-900/90 border border-stone-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
          {activeUser && activeUser.isActive && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <div className="font-bold text-emerald-300">
                    सक्रिय सत्र: {activeUser.name}
                  </div>
                  <div className="text-[10px] text-emerald-400/80 font-mono">
                    Role: {activeUser.role}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (activeUser.role === "WAITER") router.push("/waiter");
                    else if (activeUser.role === "KITCHEN") router.push("/kitchen");
                    else if (activeUser.role === "CASHIER") router.push("/billing");
                    else router.push("/dashboard");
                  }}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                >
                  चालू ठेवा →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    store.logout();
                    setActiveUser(store.currentUser);
                  }}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                  बाहेर पडा
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-center gap-2.5 text-xs text-red-200 font-bold animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "WAITER" ? (
            /* WAITER QUICK PIN / SELECTOR FORM */
            <div className="space-y-4">
              {/* Waiter Account Picker or Manual Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-400">
                    {manualWaiterInput ? "Staff Username / नाव" : "Select Waiter Staff (वेटर निवडा)"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setManualWaiterInput(!manualWaiterInput);
                      if (manualWaiterInput && waiters.length > 0) {
                        setSelectedWaiter(waiters[0]);
                        setUsername(waiters[0].username);
                      } else {
                        setSelectedWaiter(null);
                        setUsername("");
                      }
                      setPin("");
                      setError(null);
                    }}
                    className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    {manualWaiterInput ? "← Select from list" : "Type username →"}
                  </button>
                </div>

                {manualWaiterInput ? (
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. sachin, rahul, waiter3"
                      className="w-full bg-stone-950/80 border border-stone-800 rounded-2xl pl-10 pr-3 py-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {waiters.map((w) => (
                      <div
                        key={w.id}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                          selectedWaiter?.id === w.id
                            ? "bg-red-950/70 border-red-500/80 text-white ring-2 ring-red-500/30"
                            : "bg-stone-950/60 border-stone-800 text-stone-300 hover:border-stone-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWaiter(w);
                            setUsername(w.username);
                            setPin("");
                            setError(null);
                          }}
                          className="text-left w-full cursor-pointer flex items-center justify-between"
                        >
                          <div className="truncate">
                            <span className="text-xs font-black block truncate">{w.name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-stone-400 font-mono block">@{w.username}</span>
                              <span className="text-[9px] text-amber-400 font-mono font-bold bg-amber-400/10 px-1 rounded">PIN: {w.pin}</span>
                            </div>
                          </div>
                          {selectedWaiter?.id === w.id && (
                            <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 ml-1" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickDemoLogin(w.name, w.username, w.pin)}
                          className="w-full py-1 px-1.5 bg-stone-800/80 hover:bg-stone-700 active:bg-stone-600 text-amber-300 rounded-lg text-[10px] font-bold font-mono flex items-center justify-center gap-1 border border-stone-700/50 cursor-pointer active:scale-95 touch-manipulation"
                        >
                          <span>⚡ 1-टॅप लॉगिन ({w.pin})</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {waiters.length === 0 && !manualWaiterInput && (
                  <div className="p-3 bg-stone-950/60 border border-stone-800 rounded-xl text-center text-xs text-stone-400">
                    No waiter credentials found. Use Admin login to create waiter accounts in Settings or click &quot;Type username&quot;.
                  </div>
                )}
              </div>

              {/* PIN Display Dots */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-400 block mb-1.5 text-center">
                  Enter 4-Digit Waiter PIN (पिन टाका)
                </label>
                <div className="flex items-center justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-11 h-12 rounded-xl border flex items-center justify-center font-mono text-xl font-black transition-all ${
                        pin.length > idx
                          ? "bg-red-600/30 border-red-500 text-white shadow-lg shadow-red-600/20"
                          : "bg-stone-950/80 border-stone-800 text-stone-600"
                      }`}
                    >
                      {pin.length > idx ? (showPin ? pin[idx] : "•") : ""}
                    </div>
                  ))}
                </div>
              </div>

              {/* Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleKeypadPress(n)}
                    className="h-12 rounded-2xl bg-stone-800/70 hover:bg-stone-700 active:bg-stone-600 text-white font-mono text-lg font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-12 rounded-2xl bg-stone-950/80 text-stone-400 hover:text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all touch-manipulation"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="h-12 rounded-2xl bg-stone-800/70 hover:bg-stone-700 active:bg-stone-600 text-white font-mono text-lg font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-12 rounded-2xl bg-stone-950/80 text-stone-400 hover:text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all touch-manipulation"
                >
                  ⌫
                </button>
              </div>

              {/* Login Button */}
              <button
                type="button"
                onClick={() => handleLoginSubmit()}
                disabled={pin.length < 4 && !selectedWaiter}
                className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all touch-manipulation ${
                  pin.length >= 4 || selectedWaiter
                    ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-700/30 cursor-pointer"
                    : "bg-stone-800 text-stone-500 cursor-not-allowed"
                }`}
              >
                <span>Login as {selectedWaiter?.name || (pin.length === 4 ? `PIN ${pin}` : "Waiter")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ADMIN / MANAGEMENT LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-400 block mb-1">
                  Username / पद
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-stone-950/80 border border-stone-800 rounded-2xl pl-10 pr-3 py-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-400 block mb-1">
                  Password / पासवर्ड
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                  <input
                    type={showPin ? "text" : "password"}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter password (admin123 or 1234)"
                    className="w-full bg-stone-950/80 border border-stone-800 rounded-2xl pl-10 pr-10 py-3 text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-3.5 text-stone-500 hover:text-stone-300 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-stone-400 mt-1.5 flex items-center gap-1">
                  <span>Default Admin:</span>
                  <span className="text-amber-400 font-bold">admin</span>
                  <span className="text-stone-600">•</span>
                  <span>Pass:</span>
                  <span className="text-amber-400 font-mono font-bold">admin123</span>
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all touch-manipulation cursor-pointer"
              >
                <span>Authorize & Enter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Global Quick Access Shortcuts (Always visible on mobile & desktop) */}
          <div className="pt-3 border-t border-stone-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                ⚡ 1-टॅप जलद लॉगिन (Quick 1-Tap Access):
              </span>
              <span className="text-[10px] text-stone-500 font-mono">Any Role</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Rahul", "rahul", "1111")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-red-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">🍽️ Rahul (Waiter)</span>
                <span className="text-amber-400 font-mono text-[10px] shrink-0 ml-1">1111</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Nitin", "nitin", "2222")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-red-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">🍽️ Nitin (Waiter)</span>
                <span className="text-amber-400 font-mono text-[10px] shrink-0 ml-1">2222</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Cashier", "cashier", "1234")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-emerald-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">🧾 Cashier</span>
                <span className="text-emerald-400 font-mono text-[10px] shrink-0 ml-1">1234</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Kitchen", "chef", "1234")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">👨‍🍳 Kitchen KDS</span>
                <span className="text-amber-400 font-mono text-[10px] shrink-0 ml-1">1234</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Admin", "admin", "admin123")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-red-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">👑 Owner / Admin</span>
                <span className="text-amber-400 font-mono text-[10px] shrink-0 ml-1">admin123</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("Manager", "manager", "1234")}
                className="p-2 bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-purple-500/50 rounded-xl text-left flex items-center justify-between text-stone-200 active:scale-95 cursor-pointer touch-manipulation"
              >
                <span className="truncate">👔 Manager</span>
                <span className="text-purple-400 font-mono text-[10px] shrink-0 ml-1">1234</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-stone-500">
          <span>Kolhapuri Khanawal OS v1.0 • PWA Standalone Ready</span>
        </div>
      </div>
    </div>
  );
}
