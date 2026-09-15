"use client";

import React, { useState } from "react";
import {
  Sliders,
  Store,
  Printer,
  Receipt,
  Utensils,
  Database,
  Check,
  Save,
  Download,
  RotateCcw,
  Zap,
  Lock,
  Sparkles,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Phone,
  FileText,
  UserCheck,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldAlert,
  LogIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  printTestTicket,
  triggerCashDrawerKick,
  printWaiterCredentialSlip,
} from "@/lib/printing/thermal-printer";
import { RestaurantSettings, WaiterCredential } from "@/types/domain";
import { PrinterSettingsModal } from "@/components/printing/PrinterSettingsModal";

type SettingsTab = "PROFILE" | "HARDWARE" | "WAITERS" | "BILLING" | "DINING" | "DATA";

export default function SettingsPage() {
  const router = useRouter();
  const store = globalRestaurantStore;
  const [activeTab, setActiveTab] = useState<SettingsTab>("PROFILE");
  const [settings, setSettings] = useState<RestaurantSettings>(store.settings);
  const [printerSettings, setPrinterSettings] = useState(store.printerSettings);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [drawerKicked, setDrawerKicked] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);

  // Waiter Credentials State
  const [waiters, setWaiters] = useState<WaiterCredential[]>(store.waiterCredentials);
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<WaiterCredential | null>(null);
  const [waiterForm, setWaiterForm] = useState({
    name: "",
    username: "",
    pin: "1234",
    phone: "",
    employeeId: "",
    isActive: true,
  });
  const [waiterFormError, setWaiterFormError] = useState<string | null>(null);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCreateWaiterModal = () => {
    setEditingWaiter(null);
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setWaiterForm({
      name: "",
      username: `waiter${store.waiterCredentials.length + 1}`,
      pin: randomPin,
      phone: "",
      employeeId: "",
      isActive: true,
    });
    setWaiterFormError(null);
    setIsWaiterModalOpen(true);
  };

  const handleOpenEditWaiterModal = (w: WaiterCredential) => {
    setEditingWaiter(w);
    setWaiterForm({
      name: w.name,
      username: w.username,
      pin: w.pin,
      phone: w.phone || "",
      employeeId: w.employeeId || "",
      isActive: w.isActive,
    });
    setWaiterFormError(null);
    setIsWaiterModalOpen(true);
  };

  const handleSaveWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    setWaiterFormError(null);

    if (!waiterForm.name.trim()) {
      setWaiterFormError("Please enter waiter's full name.");
      return;
    }
    if (!waiterForm.username.trim()) {
      setWaiterFormError("Please enter login username.");
      return;
    }
    if (!waiterForm.pin.trim() || waiterForm.pin.trim().length < 4) {
      setWaiterFormError("Security PIN must be at least 4 digits.");
      return;
    }

    try {
      if (editingWaiter) {
        store.updateWaiterCredential(editingWaiter.id, {
          name: waiterForm.name,
          username: waiterForm.username,
          pin: waiterForm.pin,
          phone: waiterForm.phone,
          employeeId: waiterForm.employeeId,
          isActive: waiterForm.isActive,
        });
        showToast(`Credentials updated for ${waiterForm.name}!`);
      } else {
        store.createWaiterCredential({
          name: waiterForm.name,
          username: waiterForm.username,
          pin: waiterForm.pin,
          phone: waiterForm.phone,
          employeeId: waiterForm.employeeId,
          isActive: waiterForm.isActive,
        });
        showToast(`Waiter ${waiterForm.name} created successfully!`);
      }
      setWaiters([...store.waiterCredentials]);
      setIsWaiterModalOpen(false);
    } catch (err: any) {
      setWaiterFormError(err.message || "Failed to save credential.");
    }
  };

  const handleDeleteWaiter = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove login access for ${name}?`)) {
      store.deleteWaiterCredential(id);
      setWaiters([...store.waiterCredentials]);
      showToast(`Removed access for ${name}.`);
    }
  };

  const handleToggleWaiterStatus = (w: WaiterCredential) => {
    store.updateWaiterCredential(w.id, { isActive: !w.isActive });
    setWaiters([...store.waiterCredentials]);
    showToast(`Waiter ${w.name} ${!w.isActive ? "Activated" : "Deactivated"}.`);
  };

  const handlePrintSlip = (w: WaiterCredential) => {
    printWaiterCredentialSlip(w, printerSettings.paperWidth || "80mm");
    showToast(`Printed credential pass for ${w.name}!`);
  };

  const handleTestLoginAsWaiter = (w: WaiterCredential) => {
    store.loginAsWaiter(w);
    showToast(`Switched active session to Waiter: ${w.name}. Redirecting to Floor Tables...`);
    setTimeout(() => {
      router.push("/waiter");
    }, 600);
  };

  const handleSaveAll = () => {
    store.updateRestaurantSettings(settings);
    store.updatePrinterSettings(printerSettings);
    setIsSaved(true);
    showToast("Settings saved and synchronized successfully!");
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestPrint = () => {
    printTestTicket(printerSettings);
    showToast("Diagnostic test ticket sent to thermal printer!");
  };

  const handleTestDrawer = () => {
    triggerCashDrawerKick();
    setDrawerKicked(true);
    showToast("Cash drawer kick pulse triggered!");
    setTimeout(() => setDrawerKicked(false), 2000);
  };

  const handleExportBackup = () => {
    const jsonStr = store.exportSystemBackup();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kolhapuri-khanawal-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("System backup downloaded successfully!");
  };

  const handleConfirmReset = () => {
    store.resetToSeedData();
    setSettings(store.settings);
    setPrinterSettings(store.printerSettings);
    setConfirmResetOpen(false);
    showToast("System reset to authentic 04/09-07/09 seed dataset (₹59,201)!");
  };

  const tabs: { id: SettingsTab; label: string; marathi: string; icon: React.ElementType }[] = [
    { id: "PROFILE", label: "Profile & Identity", marathi: "खानावळ माहिती", icon: Store },
    { id: "HARDWARE", label: "Thermal POS & Printers", marathi: "प्रिंटर व हार्डवेअर", icon: Printer },
    { id: "WAITERS", label: "Waiter Credentials", marathi: "वेटर क्रेडेंशियल्स", icon: UserCheck },
    { id: "BILLING", label: "Taxes & Billing Rules", marathi: "कर व बिलिंग नियम", icon: Receipt },
    { id: "DINING", label: "Dining & Shared Seating", marathi: "टेबल व मजला नियम", icon: Utensils },
    { id: "DATA", label: "Data Backup & Reset", marathi: "डेटा व बॅकअप", icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 bg-stone-900 text-amber-300 border border-amber-500/40 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E7E2DA] shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>प्रणाली सेटिंग्ज • System Settings & Operations Config</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 mt-1">
            Restaurant Operations Configuration
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium">
            Manage restaurant brand profile, 80mm/58mm thermal printers, tax rates, seating policies, and automated backups.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 active:scale-95 transition-all touch-manipulation"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">Download</span> Backup
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-5 py-2.5 text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-amber-200" />
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
                isActive
                  ? "bg-red-700 text-white shadow-xs font-black"
                  : "bg-white text-stone-700 border border-[#E7E2DA] hover:bg-[#FAF8F5]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-amber-200" : "text-stone-500"}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] hidden md:inline ${isActive ? "text-red-200" : "text-stone-400"}`}>
                ({tab.marathi})
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFILE & IDENTITY */}
      {activeTab === "PROFILE" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="premium-card p-5 sm:p-6 space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h3 className="text-sm sm:text-base font-black text-stone-900">
                  Restaurant Brand & Public Information
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  This identity appears on printed tax receipts, pre-bills, KOTs, and UPI soundbox QR codes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Restaurant Name (Marathi) *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.nameMr}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, nameMr: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Restaurant Name (English) *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.nameEn}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, nameEn: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={settings.profile.tagline}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: { ...settings.profile, tagline: e.target.value },
                    })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Physical Address (Printed on Bills) *
                </label>
                <textarea
                  rows={2}
                  value={settings.profile.address}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      profile: { ...settings.profile, address: e.target.value },
                    })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Primary Phone Number *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.primaryPhone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, primaryPhone: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Secondary Contact
                  </label>
                  <input
                    type="text"
                    value={settings.profile.secondaryPhone || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, secondaryPhone: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    GSTIN Registration Number *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.gstin}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, gstin: e.target.value.toUpperCase() },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    FSSAI License Number *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.fssai}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, fssai: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    UPI VPA ID (For Table Pre-Bill QR) *
                  </label>
                  <input
                    type="text"
                    value={settings.profile.upiId}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, upiId: e.target.value.toLowerCase() },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    UPI Merchant Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.profile.upiMerchantName}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        profile: { ...settings.profile, upiMerchantName: e.target.value },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-semibold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Thermal Receipt Header Preview */}
          <div className="lg:col-span-4 space-y-4">
            <div className="premium-card p-5 space-y-3">
              <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-red-700" />
                <span>Live Receipt Header Preview</span>
              </h4>
              <p className="text-[11px] text-stone-500">
                Shows exact layout generated on 80mm thermal receipt roll:
              </p>

              <div className="bg-stone-100 p-4 rounded-xl border border-stone-300 font-mono text-[11px] text-black text-center space-y-1 shadow-inner">
                <div className="font-bold text-xs">{settings.profile.nameMr}</div>
                <div className="font-bold text-xs">{settings.profile.nameEn}</div>
                <div className="text-[10px] text-stone-700">{settings.profile.address}</div>
                <div className="text-[10px] text-stone-700">Ph: {settings.profile.primaryPhone}</div>
                <div className="text-[9px] text-stone-600 border-t border-dashed border-stone-400 pt-1 mt-1">
                  GSTIN: {settings.profile.gstin} | FSSAI: {settings.profile.fssai}
                </div>
                <div className="text-[9px] text-stone-600">
                  UPI: {settings.profile.upiId}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THERMAL POS & HARDWARE */}
      {activeTab === "HARDWARE" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            {/* Paper Width & Automation */}
            <div className="premium-card p-5 sm:p-6 space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h3 className="text-sm sm:text-base font-black text-stone-900">
                  Thermal Paper Width Profile
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  Select standard desktop POS or compact mobile Bluetooth roll width.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrinterSettings({ ...printerSettings, paperWidth: "80mm" })}
                  className={`p-4 rounded-xl border text-left transition-all touch-manipulation active:scale-95 ${
                    printerSettings.paperWidth === "80mm"
                      ? "border-red-600 bg-red-50/70 text-red-950 font-bold shadow-2xs ring-2 ring-red-400/20"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <div className="text-sm font-black">80mm Standard POS</div>
                  <div className="text-[11px] text-stone-500 mt-1">48 columns, 3-inch rolls (Desktop counter)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterSettings({ ...printerSettings, paperWidth: "58mm" })}
                  className={`p-4 rounded-xl border text-left transition-all touch-manipulation active:scale-95 ${
                    printerSettings.paperWidth === "58mm"
                      ? "border-red-600 bg-red-50/70 text-red-950 font-bold shadow-2xs ring-2 ring-red-400/20"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <div className="text-sm font-black">58mm Compact POS</div>
                  <div className="text-[11px] text-stone-500 mt-1">32 columns, 2-inch rolls (Mobile Bluetooth)</div>
                </button>
              </div>

              {/* Hardware Automation Switches */}
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide">
                  Automation & Solenoid Triggers
                </h4>

                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Auto-print Kitchen Order Ticket (KOT) on order
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Dispatches thermal ticket to kitchen immediately upon waiter submit
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerSettings.autoPrintKotOnOrder}
                    onChange={(e) =>
                      setPrinterSettings({ ...printerSettings, autoPrintKotOnOrder: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Auto-print Customer Tax Invoice on payment
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Sends receipt to counter printer as soon as Cash/UPI is settled
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerSettings.autoPrintReceiptOnPayment}
                    onChange={(e) =>
                      setPrinterSettings({ ...printerSettings, autoPrintReceiptOnPayment: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Kick Cash Drawer Solenoid on Cash tender
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Sends ESC/POS pulse (p 0 50 250) to open mechanical cash drawer
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerSettings.autoKickCashDrawerOnCash}
                    onChange={(e) =>
                      setPrinterSettings({ ...printerSettings, autoKickCashDrawerOnCash: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Print Marathi Devanagari Restaurant Header
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Includes "कोल्हापुरी खानावळ" bold Unicode header on receipts
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerSettings.printMarathiHeader}
                    onChange={(e) =>
                      setPrinterSettings({ ...printerSettings, printMarathiHeader: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Diagnostic Tests Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="premium-card p-5 space-y-3">
              <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Hardware Diagnostics</span>
              </h4>
              <p className="text-[11px] text-stone-500">
                Verify printer communication and drawer latch operation directly from the browser:
              </p>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPrinterModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-800 text-white p-3 text-xs font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configure Multi-Device Fleet ({store.printerSettings.devices?.length || 5} Printers)</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 hover:bg-black text-amber-200 p-3 text-xs font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                >
                  <Printer className="w-4 h-4" />
                  <span>Broadcast Test Slip to All</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestDrawer}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 p-3 text-xs font-bold shadow-2xs active:scale-95 transition-all touch-manipulation"
                >
                  <Zap className={`w-4 h-4 ${drawerKicked ? "text-emerald-600 animate-bounce" : "text-amber-600"}`} />
                  <span>{drawerKicked ? "Pulse Fired!" : "Test Cash Drawer Pulse"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: WAITER CREDENTIALS & ACCESS CONTROL */}
      {activeTab === "WAITERS" && (
        <div className="space-y-6">
          {/* Security Overview Banner */}
          <div className="rounded-2xl p-5 bg-gradient-to-r from-amber-50 via-[#FAF7F2] to-white border border-amber-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100/90 text-amber-900 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
                <KeyRound className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-stone-900">
                    Waiter Logins & Terminal Security
                  </h3>
                  <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-full border border-red-200">
                    Strict Role Isolation
                  </span>
                </div>
                <p className="text-xs text-stone-600 font-medium leading-relaxed max-w-2xl">
                  Admin sets up dedicated credentials for dining floor staff. When logged in as a <strong>Waiter</strong>, the system restricts access to <strong>Dining Tables (`/waiter`) and Menu (`/menu`) only</strong>. Waiters are authorized to <strong>take orders, print KOTs, and print Bills</strong> — while all financial figures, reports, inventory, and settings are strictly locked.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateWaiterModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-4 py-2.5 text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all shrink-0 touch-manipulation"
            >
              <UserPlus className="w-4 h-4 text-amber-200" />
              <span>Create Waiter Credential</span>
            </button>
          </div>

          {/* Waiter Accounts Grid */}
          <div className="premium-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900">
                  Authorized Waiter Profiles ({waiters.length})
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  Staff authorized with direct floor PINs to operate tables, seat dining parties, and print receipts.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateWaiterModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Waiter</span>
              </button>
            </div>

            {waiters.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <KeyRound className="w-10 h-10 text-stone-400 mx-auto" />
                <p className="text-xs font-bold text-stone-800">No Waiter Credentials Configured</p>
                <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                  Click "Create Waiter Credential" above to generate a unique login code and 4-digit PIN for your service staff.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {waiters.map((w) => {
                  const isPinVisible = !!showPins[w.id];
                  const initials = w.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={w.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 shadow-2xs ${
                        w.isActive
                          ? "bg-[#FAF8F5] border-[#E7E2DA] hover:border-stone-400 hover:bg-white"
                          : "bg-stone-50 border-stone-200 opacity-60"
                      }`}
                    >
                      {/* Header Row: Avatar, Name, Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white font-black text-xs flex items-center justify-center border border-red-400/30 shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-sm text-stone-900 truncate">
                                {w.name}
                              </h4>
                              <span className="font-mono text-[10px] font-extrabold bg-stone-200 text-stone-800 px-1.5 py-0.5 rounded">
                                @{w.username}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium">
                              {w.phone ? `📱 ${w.phone}` : "No phone registered"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleWaiterStatus(w)}
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full border transition-all active:scale-95 shrink-0 ${
                            w.isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200"
                          }`}
                          title="Click to toggle active status"
                        >
                          {w.isActive ? "● Active" : "○ Inactive"}
                        </button>
                      </div>

                      {/* Credentials Display Box */}
                      <div className="bg-white border border-[#E7E2DA] rounded-xl p-3 flex items-center justify-between text-xs shadow-2xs">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
                            Security PIN
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-black text-sm text-stone-900 tracking-widest">
                              {isPinVisible ? w.pin : "••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setShowPins((prev) => ({ ...prev, [w.id]: !isPinVisible }))
                              }
                              className="text-stone-400 hover:text-stone-700 p-0.5"
                              title={isPinVisible ? "Hide PIN" : "Show PIN"}
                            >
                              {isPinVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
                            Allowed Scope
                          </span>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Tables, Menu, KOT, Bill
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-stone-200/80">
                        <button
                          type="button"
                          onClick={() => handleTestLoginAsWaiter(w)}
                          disabled={!w.isActive}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-40 text-white font-bold text-[11px] py-2 px-2.5 rounded-xl shadow-2xs active:scale-95 transition-all"
                          title="Switch active user session to this waiter and open table floor"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Test Waiter View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSlip(w)}
                          className="inline-flex items-center justify-center gap-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-[11px] py-2 px-3 rounded-xl shadow-2xs active:scale-95 transition-all"
                          title="Print 80mm/58mm thermal credential slip with username and PIN"
                        >
                          <Printer className="w-3.5 h-3.5 text-stone-600" />
                          <span>Slip</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditWaiterModal(w)}
                          className="inline-flex items-center justify-center gap-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-[11px] py-2 px-2.5 rounded-xl shadow-2xs active:scale-95 transition-all"
                          title="Edit waiter PIN or profile"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteWaiter(w.id, w.name)}
                          className="inline-flex items-center justify-center p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete credential"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TAXES & BILLING RULES */}
      {activeTab === "BILLING" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="premium-card p-5 sm:p-6 space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h3 className="text-sm sm:text-base font-black text-stone-900">
                  GST Tax & Parcel Packaging Surcharge
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  Tax engine and takeaway packaging calculation parameters.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    GST Rate (Standalone Restaurant) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={settings.billing.gstRatePercent}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          billing: { ...settings.billing, gstRatePercent: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">%</span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Split equally: CGST (2.5%) + SGST (2.5%)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Takeaway Packaging Charge Per Parcel *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      value={settings.billing.packagingChargePerThali}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          billing: { ...settings.billing, packagingChargePerThali: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">₹</span>
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Applied automatically to parcel containers & carry bags
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100">
                <label className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Enable Currency Round-Off to nearest ₹1
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Rounds 964.50 to 965.00 (+₹0.50) on tax invoices
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.billing.applyRoundOff}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        billing: { ...settings.billing, applyRoundOff: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>

              {/* Security PIN Authorization */}
              <div className="pt-4 border-t border-stone-100 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wide">
                    Manager Authorization PIN & Security
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Manager 4-Digit Security PIN *
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={settings.billing.managerPin}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          billing: { ...settings.billing, managerPin: e.target.value },
                        })
                      }
                      className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-stone-500 mt-1 block">
                      Required for discounts {">"}10% and negative stock overrides
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Maximum Discount Without PIN (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.billing.maxDiscountWithoutPinPercent}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            billing: {
                              ...settings.billing,
                              maxDiscountWithoutPinPercent: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DINING & SHARED SEATING */}
      {activeTab === "DINING" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="premium-card p-5 sm:p-6 space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h3 className="text-sm sm:text-base font-black text-stone-900">
                  Dining Hall Capacity & Shared Seating
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  Configure multi-customer shared seating and table recycling policies.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-black text-amber-950 block">
                      Enable Multi-Party Shared Table Seating (Party A, B, C)
                    </span>
                    <span className="text-[11px] text-amber-900/80">
                      Allows multiple independent diners to share the same physical 4-seater table with separate bills
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.dining.sharedSeatingEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dining: { ...settings.dining, sharedSeatingEnabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      Auto-Vacate Table When Final Bill is Settled
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Instantly marks table as Available once the last party completes payment
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.dining.autoVacateOnPayment}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dining: { ...settings.dining, autoVacateOnPayment: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Total Physical Dining Tables
                  </label>
                  <input
                    type="number"
                    disabled
                    value={settings.dining.totalTables}
                    className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-600 font-bold cursor-not-allowed"
                  />
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Tables 1 to 12 in Unified Main Hall
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Maximum Capacity Per Table
                  </label>
                  <input
                    type="number"
                    value={settings.dining.maxGuestsPerTable}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dining: { ...settings.dining, maxGuestsPerTable: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Standard 4-seater wooden benches
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATA BACKUP & RESET */}
      {activeTab === "DATA" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            {/* JSON Export */}
            <div className="premium-card p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 font-black text-stone-900 text-sm">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Full System Data Snapshot</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Export all recorded transactions, supplier balances, raw material ledgers, staff advances, and cash drawer reconciliations to a portable JSON file for off-site backup.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete JSON Backup</span>
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="premium-card p-5 sm:p-6 space-y-3 border-red-200 bg-red-50/20">
              <div className="flex items-center gap-2 font-black text-red-950 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                <span>Danger Zone — Reset Initial Seed Dataset</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Reloads the authentic seed dataset (04/09/2026 to 07/09/2026 transactions totaling ₹59,201) and restores initial par levels and drawer floats.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs active:scale-95 transition-all touch-manipulation"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset to Seed Data (₹59,201)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM SYSTEM RESET */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            <div className="bg-red-50 border-b border-red-200 p-4 text-red-950 flex items-center gap-2 font-black text-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span>Reset Operational Dataset?</span>
            </div>
            <div className="p-5 space-y-3 text-stone-600">
              <p>
                This will reset active tables and reload the verified 04/09 to 07/09 sample dataset with all 6 suppliers and ₹59,201 in purchases and expenses.
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="px-5 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs active:scale-95 transition-all"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT WAITER CREDENTIAL */}
      {isWaiterModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-sm font-black">
                    {editingWaiter ? "Edit Waiter Credential" : "Create Waiter Credential"}
                  </h3>
                  <p className="text-[10px] text-amber-100/90 font-medium">
                    वेटर लॉगिन व प्रवेश अधिकार • Restricted to Tables & Menu
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveWaiter} className="p-5 space-y-4">
              {waiterFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] font-bold flex items-center gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{waiterFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Full Name (नाव) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Shinde"
                  value={waiterForm.name}
                  onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Username / Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. rahul"
                    value={waiterForm.username}
                    onChange={(e) =>
                      setWaiterForm({
                        ...waiterForm,
                        username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                      })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3 py-2.5 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">
                      Security PIN *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setWaiterForm({
                          ...waiterForm,
                          pin: Math.floor(1000 + Math.random() * 9000).toString(),
                        })
                      }
                      className="text-[10px] text-red-600 hover:text-red-800 font-bold"
                    >
                      🎲 Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="4-digit PIN"
                    value={waiterForm.pin}
                    onChange={(e) => setWaiterForm({ ...waiterForm, pin: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3 py-2.5 text-xs text-stone-900 font-black tracking-widest focus:ring-2 focus:ring-red-500 focus:outline-none font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mobile Number (ऐच्छिक)
                </label>
                <input
                  type="text"
                  placeholder="+91 98227 00000"
                  value={waiterForm.phone}
                  onChange={(e) => setWaiterForm({ ...waiterForm, phone: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3.5 py-2 text-xs text-stone-900 font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Link to Staff Employee Roster
                </label>
                <select
                  value={waiterForm.employeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const emp = store.employees.find((x) => x.id === empId);
                    setWaiterForm({
                      ...waiterForm,
                      employeeId: empId,
                      name: emp ? emp.name : waiterForm.name,
                      phone: emp ? emp.phone : waiterForm.phone,
                    });
                  }}
                  className="w-full bg-[#FAF8F5] border border-[#E7E2DA] rounded-xl px-3 py-2 text-xs text-stone-900 font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="">-- Optional: Link to Existing Staff --</option>
                  {store.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - {emp.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="waiterActive"
                  checked={waiterForm.isActive}
                  onChange={(e) =>
                    setWaiterForm({ ...waiterForm, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <label htmlFor="waiterActive" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Active Credential (खाते सक्रिय ठेवा)
                </label>
              </div>

              {/* Permission Clarification Box */}
              <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-[11px] text-amber-950 font-medium space-y-1">
                <span className="font-black flex items-center gap-1 text-amber-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Strict RBAC Permission Policy
                </span>
                <p>
                  This waiter will only see <strong>Tables</strong> and <strong>Menu</strong>. They can print <strong>KOTs</strong> and <strong>Bills</strong> at the table. Financials, inventory, and settings will remain completely inaccessible.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsWaiterModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-black text-xs shadow-md shadow-red-700/20 active:scale-95 transition-all"
                >
                  {editingWaiter ? "Update Credential" : "Save Waiter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MULTI-DEVICE THERMAL PRINTER FLEET MANAGER */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => {
          setIsPrinterModalOpen(false);
          setPrinterSettings(store.printerSettings);
        }}
      />
    </div>
  );
}

