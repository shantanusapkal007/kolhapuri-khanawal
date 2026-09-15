"use client";

import React, { useState } from "react";
import {
  Printer,
  X,
  CheckCircle2,
  RefreshCw,
  FileText,
  Sliders,
  Smartphone,
  Wifi,
  Usb,
  Bluetooth,
  AlertTriangle,
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
    store.updatePrinterSettings({
      ...store.printerSettings,
      paperWidth,
      autoPrintKotOnOrder: autoPrintKot,
    });
    setStatusMessage("प्रिंटर प्राधान्ये जतन केली! (Saved!)");
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1200);
  };

  const handleTestPrint = async () => {
    setIsPrintingTest(true);
    setStatusMessage(null);
    try {
      const devices = globalPrinterManager.getActiveDevices(store.printerSettings);
      const kotDevice: PrinterDevice = devices.find((d) => d.isDefaultKotPrinter) || devices[0] || {
        id: "waiter-system-dev",
        name: "Waiter Print Spooler",
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
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-5 duration-300 text-stone-900 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-900 flex items-center justify-center border border-amber-500/20">
              <Printer className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">वेटर प्रिंटर सेटिंग्ज (Printer Settings)</h3>
              <span className="text-[11px] text-stone-500 font-semibold">Thermal KOT & Bill Configuration</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100"
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

        {/* Paper Width Picker */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wider text-stone-500">
            Thermal Roll Size (कागदाचा आकार)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaperWidth("80mm")}
              className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between ${
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
              className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between ${
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
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
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

        {/* Supported Interfaces Strip */}
        <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60 text-xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
            Connected Devices & Channels:
          </span>
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-stone-700">
            <span className="px-2 py-1 bg-white rounded-lg border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Smartphone className="w-3 h-3 text-red-600" />
              <span>Browser Dialog</span>
            </span>
            <span className="px-2 py-1 bg-white rounded-lg border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Bluetooth className="w-3 h-3 text-blue-600" />
              <span>Bluetooth Thermal</span>
            </span>
            <span className="px-2 py-1 bg-white rounded-lg border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Usb className="w-3 h-3 text-emerald-600" />
              <span>WebUSB</span>
            </span>
            <span className="px-2 py-1 bg-white rounded-lg border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Wifi className="w-3 h-3 text-purple-600" />
              <span>Network IP (9100)</span>
            </span>
          </div>
        </div>

        {/* Test Print Button */}
        <button
          type="button"
          onClick={handleTestPrint}
          disabled={isPrintingTest}
          className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all touch-manipulation"
        >
          <FileText className="w-3.5 h-3.5 text-stone-600" />
          <span>{isPrintingTest ? "Dispatching..." : "प्रिंट चाचणी पावती (Test Print Slip)"}</span>
        </button>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation"
          >
            Save Preferences (जतन करा)
          </button>
        </div>
      </div>
    </div>
  );
}
