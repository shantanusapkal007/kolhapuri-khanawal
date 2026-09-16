"use client";

import React, { useState } from "react";
import {
  Printer,
  X,
  CheckCircle2,
  FileText,
  Smartphone,
  Wifi,
  Zap,
  Check,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import { globalPrinterManager } from "@/lib/printing/printer-connection-manager";
import { generatePrinterTestHtml } from "@/lib/printing/thermal-printer";
import { PrinterDevice } from "@/types/billing";

interface WaiterPrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaiterPrinterSettingsModal({ isOpen, onClose }: WaiterPrinterSettingsModalProps) {
  const store = globalRestaurantStore;

  const initialMode = (): "SYSTEM" | "RAWBT" | "NETWORK" => {
    const devices = store.printerSettings.devices || [];
    const kotDev = devices.find((d) => d.isDefaultKotPrinter && d.isEnabled) || devices[0];
    if (kotDev?.connectionType === "RAWBT") return "RAWBT";
    if (kotDev?.connectionType === "NETWORK") return "NETWORK";
    return "SYSTEM";
  };

  const initialIp = (): string => {
    const devices = store.printerSettings.devices || [];
    const netDev = devices.find((d) => d.connectionType === "NETWORK");
    return netDev?.ipAddress || "192.168.1.50";
  };

  const [printMode, setPrintMode] = useState<"SYSTEM" | "RAWBT" | "NETWORK">(initialMode);
  const [wifiIp, setWifiIp] = useState<string>(initialIp);
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">(
    store.printerSettings?.paperWidth || "80mm"
  );
  const [autoPrintKot, setAutoPrintKot] = useState<boolean>(
    store.printerSettings?.autoPrintKotOnOrder ?? true
  );
  const [isPrintingTest, setIsPrintingTest] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSettings = () => {
    let activeDev: PrinterDevice;
    if (printMode === "SYSTEM") {
      activeDev = globalPrinterManager.activateAndroidSystemPrint(paperWidth);
    } else if (printMode === "RAWBT") {
      activeDev = globalPrinterManager.activateAndroidRawBtPrint(paperWidth);
    } else {
      activeDev = globalPrinterManager.activateWifiNetworkPrint(wifiIp || "192.168.1.50", paperWidth);
    }

    const currentDevices = store.printerSettings.devices || [];
    const updatedDevices = [
      activeDev,
      ...currentDevices
        .filter((d) => d.id !== activeDev.id)
        .map((d) => ({ ...d, isDefaultReceiptPrinter: false, isDefaultKotPrinter: false })),
    ];

    store.updatePrinterSettings({
      paperWidth,
      autoPrintKotOnOrder: autoPrintKot,
      devices: updatedDevices,
    });

    setStatusMessage("प्रिंटर प्राधान्ये जतन केली! (Preferences Saved!)");
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1200);
  };

  const handleTestPrint = async () => {
    setIsPrintingTest(true);
    setStatusMessage(null);
    try {
      let kotDevice: PrinterDevice;
      if (printMode === "SYSTEM") {
        kotDevice = {
          id: "waiter-system-dev",
          name: "📱 Android System Print",
          connectionType: "BROWSER_SYSTEM",
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: false,
        };
      } else if (printMode === "RAWBT") {
        kotDevice = {
          id: "waiter-rawbt-dev",
          name: "⚡ RawBT Bluetooth Print",
          connectionType: "RAWBT",
          rawbtMethod: "INTENT",
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: true,
        };
      } else {
        kotDevice = {
          id: "waiter-wifi-dev",
          name: `Wi-Fi (${wifiIp})`,
          connectionType: "NETWORK",
          ipAddress: wifiIp.trim() || "192.168.1.50",
          port: 9100,
          paperWidth,
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: true,
        };
      }

      const res = await globalPrinterManager.printDirectDeviceTestSlip(
        kotDevice,
        generatePrinterTestHtml
      );
      setStatusMessage(res.message || "✅ टेस्ट पावती पाठवली (Test slip sent!)");
    } catch (err: any) {
      setStatusMessage(`Notice: ${err?.message || "Print dialog opened"}`);
    } finally {
      setIsPrintingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-5 duration-300 text-stone-900 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-900 flex items-center justify-center border border-amber-500/20">
              <Printer className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">वेटर प्रिंटर सेटिंग्ज (Printer Settings)</h3>
              <span className="text-[11px] text-stone-500 font-semibold">Android Mobile & Thermal KOT</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Print Mode Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-stone-500 flex items-center justify-between">
            <span>प्रिंट पद्धत (Print Mode)</span>
            <span className="text-amber-700 font-bold lowercase text-[10px]">1-क्लिक निवडा</span>
          </label>

          <div className="space-y-2">
            {/* Mode 1: Android System Print */}
            <button
              type="button"
              onClick={() => setPrintMode("SYSTEM")}
              className={`w-full p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between cursor-pointer ${
                printMode === "SYSTEM"
                  ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 font-black shadow-xs"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs block font-black">📱 Android सिस्टीम प्रिंट (सर्वात सोपे)</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    कोणतेही ॲप नको • फोनच्या ब्लूटूथवरून थेट प्रिंट
                  </span>
                </div>
              </div>
              {printMode === "SYSTEM" && <Check className="w-4 h-4 text-amber-600 stroke-[3]" />}
            </button>

            {/* Mode 2: RawBT Bluetooth */}
            <button
              type="button"
              onClick={() => setPrintMode("RAWBT")}
              className={`w-full p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between cursor-pointer ${
                printMode === "RAWBT"
                  ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 font-black shadow-xs"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-800 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs block font-black">⚡ RawBT ब्लूटूथ (सुपरफास्ट)</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    0.1 सेकंदात थेट प्रिंट • RawBT ॲप आवश्यक
                  </span>
                </div>
              </div>
              {printMode === "RAWBT" && <Check className="w-4 h-4 text-amber-600 stroke-[3]" />}
            </button>

            {/* Mode 3: Hotel Wi-Fi */}
            <button
              type="button"
              onClick={() => setPrintMode("NETWORK")}
              className={`w-full p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between cursor-pointer ${
                printMode === "NETWORK"
                  ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 font-black shadow-xs"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-800 flex items-center justify-center shrink-0">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs block font-black">🌐 हॉटेल वाय-फाय प्रिंटर (POSIFLOW)</span>
                  <span className="text-[10px] text-stone-500 font-normal">
                    राउटर LAN IP वरून सर्व फोनसाठी
                  </span>
                </div>
              </div>
              {printMode === "NETWORK" && <Check className="w-4 h-4 text-amber-600 stroke-[3]" />}
            </button>
          </div>

          {printMode === "NETWORK" && (
            <div className="pt-2">
              <label className="text-[10px] font-bold text-stone-500 block mb-1">
                प्रिंटरचा वाय-फाय IP Address:
              </label>
              <input
                type="text"
                value={wifiIp}
                onChange={(e) => setWifiIp(e.target.value)}
                placeholder="192.168.1.50"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {printMode === "RAWBT" && (
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between text-xs text-orange-950">
              <span className="text-[11px] font-medium">RawBT ॲप नसेल तर Play Store वरून घ्या:</span>
              <a
                href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-orange-600 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-xs"
              >
                <span>Play Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Paper Width Picker */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-stone-500">
            Thermal Roll Size (कागदाचा आकार)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between cursor-pointer ${
                paperWidth === "80mm"
                  ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 font-black"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold"
              }`}
            >
              <div>
                <span className="text-xs block">80mm Standard</span>
                <span className="text-[10px] text-stone-400 font-normal">3-inch Large POS</span>
              </div>
              {paperWidth === "80mm" && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
            </button>

            <button
              type="button"
              onClick={() => setPaperWidth("58mm")}
              className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between cursor-pointer ${
                paperWidth === "58mm"
                  ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 font-black"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold"
              }`}
            >
              <div>
                <span className="text-xs block">58mm Compact</span>
                <span className="text-[10px] text-stone-400 font-normal">2-inch Handheld</span>
              </div>
              {paperWidth === "58mm" && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
            </button>
          </div>
        </div>

        {/* Auto-Print KOT Toggle */}
        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-stone-900 block">
              Auto-Print KOT on Order Send
            </span>
            <span className="text-[10px] text-stone-500 font-medium">
              किचनला ऑर्डर पाठवल्यावर आपोआप पावती प्रिंट करा
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAutoPrintKot(!autoPrintKot)}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
              autoPrintKot ? "bg-emerald-600" : "bg-stone-300"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                autoPrintKot ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Helpful Android Tip */}
        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
            <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Android फोन ब्लूटूथ टीप:</span>
          </div>
          <p className="text-[10px] text-stone-600 leading-relaxed">
            फोनच्या <strong>Settings ➔ Bluetooth</strong> मध्ये जाऊन प्रिंटर पेअर करा (पिन: <strong>0000</strong> किंवा <strong>1234</strong>). त्यानंतर &apos;Android सिस्टीम प्रिंट&apos; निवडून जतन करा.
          </p>
        </div>

        {/* Test Print Button */}
        <button
          type="button"
          onClick={handleTestPrint}
          disabled={isPrintingTest}
          className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all touch-manipulation cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-stone-600" />
          <span>{isPrintingTest ? "पावती पाठवत आहे..." : "📄 प्रिंट चाचणी पावती (Test Print Slip)"}</span>
        </button>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation cursor-pointer"
          >
            Save Preferences (जतन करा)
          </button>
        </div>
      </div>
    </div>
  );
}
