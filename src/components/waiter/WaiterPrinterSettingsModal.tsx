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
  RefreshCw,
  Radio,
  Search,
  ChevronDown,
  ChevronUp,
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
    return netDev?.ipAddress || "192.168.0.108";
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
  const [isScanningWifi, setIsScanningWifi] = useState<boolean>(false);
  const [isPingingWifi, setIsPingingWifi] = useState<boolean>(false);
  const [wifiPingStatus, setWifiPingStatus] = useState<{ online: boolean; message: string } | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

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

  const handleAutoScanNetwork = async () => {
    setIsScanningWifi(true);
    setWifiPingStatus(null);
    try {
      const candidates = [
        "192.168.1.100",
        "192.168.1.87",
        "192.168.1.50",
        "192.168.1.200",
        "192.168.0.100",
        "192.168.0.87",
        "192.168.29.100",
        "192.168.31.100",
      ];
      const found = await globalPrinterManager.scanNetworkPrinters(candidates);
      if (found.length > 0) {
        setWifiIp(found[0].ip);
        setWifiPingStatus({
          online: true,
          message: `प्रिंटर सापडला (${found[0].latencyMs ? `${found[0].latencyMs}ms` : "Active"})`,
        });
      } else {
        setWifiPingStatus({
          online: false,
          message: "वाय-फायवर प्रिंटर सापडला नाही. मॅन्युअली IP टाका किंवा FEED दाबून तपासा.",
        });
      }
    } catch {
      setWifiPingStatus({
        online: false,
        message: "स्कॅनिंग अयशस्वी",
      });
    } finally {
      setIsScanningWifi(false);
    }
  };

  const handlePingWifi = async () => {
    if (!wifiIp.trim()) return;
    setIsPingingWifi(true);
    try {
      const res = await fetch(
        `/api/print/network?ip=${encodeURIComponent(wifiIp.trim())}&port=9100&timeoutMs=2500`
      );
      const data = await res.json();
      if (data.online) {
        setWifiPingStatus({
          online: true,
          message: `ऑनलाइन (${data.latencyMs}ms) - Port 9100 तयार`,
        });
      } else {
        setWifiPingStatus({
          online: false,
          message: `ऑफलाइन: ${data.error || "Cannot connect"}`,
        });
      }
    } catch (err: any) {
      setWifiPingStatus({
        online: false,
        message: err?.message || "Ping error",
      });
    } finally {
      setIsPingingWifi(false);
    }
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

        {/* Main Dedicated Printer Card (POSIFLOW KPC307-UEWB) */}
        <div className="p-4 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 rounded-2xl text-white space-y-3.5 border border-stone-700 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white leading-tight">POSIFLOW KPC307-UEWB</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-mono mt-0.5">
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  <span>{wifiIp || "192.168.0.108"}:9100</span>
                  <span className="text-stone-400">• 80mm</span>
                </div>
              </div>
            </div>
            <span className="bg-emerald-500 text-stone-950 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-950 animate-pulse" />
              तयार (Ready)
            </span>
          </div>

          <div className="pt-2 border-t border-stone-700/80 flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isPrintingTest}
              className="flex-1 py-3 px-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Printer className={`w-4 h-4 ${isPrintingTest ? "animate-spin" : ""}`} />
              <span>{isPrintingTest ? "प्रिंट होत आहे..." : "📄 टेस्ट पावती प्रिंट करा"}</span>
            </button>
            <button
              type="button"
              onClick={handlePingWifi}
              disabled={isPingingWifi}
              title="Ping Test"
              className="py-3 px-3 bg-stone-800 hover:bg-stone-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer border border-stone-700"
            >
              <Radio className={`w-3.5 h-3.5 text-amber-400 ${isPingingWifi ? "animate-pulse" : ""}`} />
              <span>{isPingingWifi ? "..." : "पिंग"}</span>
            </button>
          </div>

          {wifiPingStatus && (
            <div
              className={`p-2 rounded-xl border text-[11px] flex items-center gap-1.5 ${
                wifiPingStatus.online
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                  : "bg-red-500/10 border-red-500/40 text-red-300"
              }`}
            >
              {wifiPingStatus.online ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}
              <span>{wifiPingStatus.message}</span>
            </div>
          )}
        </div>

        {/* Essential Quick Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E7E2DA]">
          <div className="space-y-0.5">
            <span className="text-xs font-black text-stone-900 block">
              ऑर्डर दिल्यावर आपोआप KOT प्रिंट करा
            </span>
            <span className="text-[10.5px] text-stone-500 font-medium">
              वेटरने &apos;Send KOT&apos; दाबल्यावर थेट किचनमध्ये पावती निघेल
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoPrintKot}
            onChange={(e) => setAutoPrintKot(e.target.checked)}
            className="w-5 h-5 accent-amber-600 cursor-pointer rounded-lg"
          />
        </div>

        {/* Primary Save Button */}
        <button
          type="button"
          onClick={handleSaveSettings}
          className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4 text-amber-200 stroke-[3]" />
          <span>सेटिंग्ज सेव्ह करा (Save & Ready)</span>
        </button>

        {/* ⚙️ अधिक प्रगत पर्याय (More Options - Collapsed by Default) */}
        <div className="pt-2 border-t border-stone-200">
          <button
            type="button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-full py-2 px-1 text-stone-500 hover:text-stone-800 text-xs font-bold flex items-center justify-between cursor-pointer rounded-xl hover:bg-stone-50 transition-colors"
          >
            <span>⚙️ इतर पर्याय (More Options: Bluetooth / System Print / Change IP)</span>
            {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showMoreOptions && (
            <div className="mt-3 space-y-3.5 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 animate-in fade-in">
              {/* Change IP Address */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-700 block">
                  वाय-फाय IP पत्ता बदला (Change IP):
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={wifiIp}
                    onChange={(e) => {
                      setWifiIp(e.target.value);
                      setWifiPingStatus(null);
                    }}
                    placeholder="192.168.0.108"
                    className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="button"
                    onClick={handleAutoScanNetwork}
                    disabled={isScanningWifi}
                    className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                  >
                    {isScanningWifi ? "..." : "शोधा"}
                  </button>
                </div>
              </div>

              {/* Alternative Print Modes */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <span className="text-[11px] font-bold text-stone-700 block">
                  पर्यायी प्रिंटिंग पद्धत (Alternative Mode):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintMode("RAWBT")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printMode === "RAWBT"
                        ? "bg-orange-50 border-orange-500 text-orange-950 font-bold"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <Zap className="w-4 h-4 mb-1 text-orange-600" />
                    <div className="text-xs font-black">RawBT Bluetooth</div>
                    <div className="text-[9.5px] text-stone-500">Android ॲप आवश्यक</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintMode("SYSTEM")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      printMode === "SYSTEM"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mb-1 text-emerald-600" />
                    <div className="text-xs font-black">सिस्टीम प्रिंट</div>
                    <div className="text-[9.5px] text-stone-500">Android प्रिंटर डायलॉग</div>
                  </button>
                </div>
              </div>

              {/* Paper Width */}
              <div className="space-y-1.5 pt-2 border-t border-stone-200">
                <span className="text-[11px] font-bold text-stone-700 block">कागदाचा आकार:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperWidth("80mm")}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-bold text-center cursor-pointer ${
                      paperWidth === "80mm"
                        ? "bg-amber-100 border-amber-500 text-amber-950 font-black"
                        : "bg-white border-stone-200 text-stone-600"
                    }`}
                  >
                    80mm (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperWidth("58mm")}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-bold text-center cursor-pointer ${
                      paperWidth === "58mm"
                        ? "bg-amber-100 border-amber-500 text-amber-950 font-black"
                        : "bg-white border-stone-200 text-stone-600"
                    }`}
                  >
                    58mm (Small)
                  </button>
                </div>
              </div>
            </div>
          )}
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
