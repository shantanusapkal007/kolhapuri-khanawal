"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  X,
  Check,
  Zap,
  Wifi,
  Bluetooth,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings2,
  RefreshCw,
  Layers,
  Laptop,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
  generatePrinterTestHtml,
} from "@/lib/printing/thermal-printer";
import { PrinterSettings, PrinterDevice } from "@/types/billing";

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SimplePrintMode = "SYSTEM" | "BLUETOOTH" | "NETWORK";

export function PrinterSettingsModal({ isOpen, onClose }: PrinterSettingsModalProps) {
  const store = globalRestaurantStore;

  // Local state
  const [settings, setSettings] = useState<PrinterSettings>(store.printerSettings);
  const [devices, setDevices] = useState<PrinterDevice[]>(
    store.printerSettings.devices && store.printerSettings.devices.length > 0
      ? store.printerSettings.devices
      : DEFAULT_PRINTER_DEVICES
  );

  // Environment detection
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  // Active print mode
  const [printMode, setPrintMode] = useState<SimplePrintMode>("SYSTEM");
  const [bluetoothName, setBluetoothName] = useState<string>("");
  const [networkIp, setNetworkIp] = useState<string>("192.168.1.200");
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">("80mm");
  const [autoPrintKot, setAutoPrintKot] = useState<boolean>(true);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(true);
  const [printMarathiHeader, setPrintMarathiHeader] = useState<boolean>(true);

  // UI state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showAdvancedRouting, setShowAdvancedRouting] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent || "";
      const mobileCheck = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
      const androidCheck = /Android/i.test(ua);
      setIsMobile(mobileCheck);
      setIsAndroid(androidCheck);
    }
  }, []);

  // Initialize from store settings
  useEffect(() => {
    if (!isOpen) return;

    const currentSettings = store.printerSettings;
    setSettings(currentSettings);
    setPaperWidth(currentSettings.paperWidth || "80mm");
    setAutoPrintKot(currentSettings.autoPrintKotOnOrder ?? true);
    setAutoPrintReceipt(currentSettings.autoPrintReceiptOnPayment ?? true);
    setPrintMarathiHeader(currentSettings.printMarathiHeader ?? true);

    const devList = currentSettings.devices && currentSettings.devices.length > 0
      ? currentSettings.devices
      : DEFAULT_PRINTER_DEVICES;
    setDevices(devList);

    // Determine primary mode
    const primary = devList[0];
    if (primary) {
      if (primary.connectionType === "BLUETOOTH" || primary.connectionType === "RAWBT" || primary.connectionType === "BLUETOOTH_SPP") {
        setPrintMode("BLUETOOTH");
        setBluetoothName(primary.bluetoothDeviceName || primary.name || "");
      } else if (primary.connectionType === "NETWORK") {
        setPrintMode("NETWORK");
        setNetworkIp(primary.ipAddress || "192.168.1.200");
      } else {
        setPrintMode("SYSTEM");
      }
    } else {
      setPrintMode("SYSTEM");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Pair Bluetooth thermal printer
  const handlePairBluetooth = async () => {
    setTestResult(null);
    try {
      const res = await globalPrinterManager.pairBluetoothPrinter();
      if (res) {
        const name = res.deviceName || "Bluetooth Thermal Printer";
        setBluetoothName(name);
        setTestResult({
          success: true,
          message: `✅ "${name}" जोडला गेला (Connected successfully!)`,
        });
      }
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        setTestResult({
          success: false,
          message: err?.message || "Bluetooth pairing failed. Ensure Bluetooth is enabled.",
        });
      }
    }
  };

  // Test Print Slip
  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Find matching device from existing fleet or construct one
      const existingDev = devices.find((d) => {
        if (printMode === "BLUETOOTH") {
          return d.connectionType === "BLUETOOTH_SPP" || d.connectionType === "BLUETOOTH" || d.connectionType === "RAWBT";
        }
        if (printMode === "NETWORK") return d.connectionType === "NETWORK";
        return d.connectionType === "BROWSER_SYSTEM";
      });

      const activeDev: PrinterDevice = existingDev
        ? {
            ...existingDev,
            paperWidth,
            ipAddress: printMode === "NETWORK" ? networkIp : existingDev.ipAddress,
            bluetoothDeviceName: printMode === "BLUETOOTH" ? (bluetoothName || existingDev.bluetoothDeviceName) : existingDev.bluetoothDeviceName,
            isDefaultReceiptPrinter: true,
            isDefaultKotPrinter: true,
            assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
          }
        : {
            id: "test-device",
            name: printMode === "BLUETOOTH" ? (bluetoothName || "Bluetooth Thermal") : printMode === "NETWORK" ? `Network (${networkIp})` : "System Print Spooler",
            connectionType: printMode === "BLUETOOTH" ? "BLUETOOTH_SPP" : printMode === "NETWORK" ? "NETWORK" : "BROWSER_SYSTEM",
            paperWidth,
            isEnabled: true,
            status: "ONLINE",
            ipAddress: networkIp,
            port: 9100,
            bluetoothDeviceName: bluetoothName,
            assignedStations: ["CASHIER", "MAIN_KITCHEN"],
            isDefaultReceiptPrinter: true,
            isDefaultKotPrinter: true,
            autoCut: true,
            openDrawerOnPrint: false,
          };

      const res = await globalPrinterManager.printDirectDeviceTestSlip(
        activeDev,
        generatePrinterTestHtml
      );

      setTestResult({
        success: res.success,
        message: res.message || (res.success ? "✅ टेस्ट पावती पाठवली (Test slip sent!)" : "प्रिंट पाठवणे अयशस्वी"),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "चाचणी पावती प्रिंट करण्यात अडचण आली",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save changes
  const handleSave = () => {
    // Look for existing device matching selected mode
    const existingIdx = devices.findIndex((d) => {
      if (printMode === "BLUETOOTH") {
        return d.connectionType === "BLUETOOTH_SPP" || d.connectionType === "BLUETOOTH" || d.connectionType === "RAWBT";
      }
      if (printMode === "NETWORK") return d.connectionType === "NETWORK";
      return d.connectionType === "BROWSER_SYSTEM";
    });

    let activeDev: PrinterDevice;
    if (existingIdx !== -1) {
      const existing = devices[existingIdx];
      activeDev = {
        ...existing,
        paperWidth,
        isEnabled: true,
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: true,
        assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
        ipAddress: printMode === "NETWORK" ? networkIp : existing.ipAddress,
        bluetoothDeviceName: printMode === "BLUETOOTH" ? (bluetoothName || existing.bluetoothDeviceName) : existing.bluetoothDeviceName,
      };
    } else {
      activeDev = {
        id: `printer-${printMode.toLowerCase()}-${Date.now()}`,
        name: printMode === "BLUETOOTH" ? (bluetoothName || "Bluetooth Thermal") : printMode === "NETWORK" ? `Network POS (${networkIp})` : "System Print Spooler",
        connectionType: printMode === "BLUETOOTH" ? "BLUETOOTH_SPP" : printMode === "NETWORK" ? "NETWORK" : "BROWSER_SYSTEM",
        paperWidth,
        isEnabled: true,
        status: "ONLINE",
        ipAddress: networkIp,
        port: 9100,
        bluetoothDeviceName: bluetoothName,
        assignedStations: ["CASHIER", "MAIN_KITCHEN", "THALI_SECTION", "TANDOOR_BHAKRI", "FRY_SECTION", "BEVERAGE_DESSERT"],
        isDefaultReceiptPrinter: true,
        isDefaultKotPrinter: true,
        autoCut: true,
        openDrawerOnPrint: true,
      };
    }

    // Keep all other devices preserved, setting default flags to false
    const updatedDevices: PrinterDevice[] = [
      activeDev,
      ...devices
        .filter((d) => d.id !== activeDev.id)
        .map((d) => ({
          ...d,
          isDefaultReceiptPrinter: false,
          isDefaultKotPrinter: false,
        })),
    ];

    const newSettings: PrinterSettings = {
      ...settings,
      paperWidth,
      autoPrintKotOnOrder: autoPrintKot,
      autoPrintReceiptOnPayment: autoPrintReceipt,
      printMarathiHeader,
      devices: updatedDevices,
    };

    setSettings(newSettings);
    store.updatePrinterSettings(newSettings);

    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden text-stone-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-600/20">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">
                प्रिंटर सेटिंग्ज (Printer Settings)
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                KOT व ग्राहकांची पावती प्रिंटिंग
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Saved Notification Banner */}
          {savedBanner && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>सेटिंग्ज जतन केल्या! (Settings saved successfully!)</span>
            </div>
          )}

          {/* Device Environment Alert */}
          {isMobile ? (
            <div className="rounded-2xl p-3 bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-950">
              <Smartphone className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-black text-[11.5px] block">
                  {isAndroid ? "📱 Android मोबाईल / टॅबलेट" : "📱 मोबाईल डिव्हाइस"}
                </span>
                <p className="text-[10.5px] text-amber-900/90 leading-tight">
                  Android वर <strong>सिस्टम प्रिंट (System Print)</strong> किंवा <strong>ब्लूटूथ (Bluetooth)</strong> निवडा. कोणत्याही केबल किंवा सिरियल पोर्टची गरज नाही.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 bg-stone-100/70 border border-stone-200 flex items-start gap-2.5 text-xs text-stone-700">
              <Laptop className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-black text-[11.5px] block">
                  💻 डेस्कटॉप / कॉम्प्युटर टर्मिनल
                </span>
                <p className="text-[10.5px] text-stone-500 leading-tight">
                  काऊंटर किंवा किचन प्रिंटरसाठी सिस्टम प्रिंट किंवा Wi-Fi नेटवर्क IP वापरा.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Connection Mode */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              1. प्रिंट पद्धत निवडा (Connection Type)
            </label>

            <div className="space-y-2">
              {/* Option A: System Print Dialog */}
              <button
                type="button"
                onClick={() => setPrintMode("SYSTEM")}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all touch-manipulation flex items-start gap-3 ${
                  printMode === "SYSTEM"
                    ? "bg-red-50/70 border-red-500 text-red-950 ring-2 ring-red-400/30 font-semibold shadow-xs"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50/80"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${printMode === "SYSTEM" ? "bg-red-600 text-white" : "bg-stone-100 text-stone-600"}`}>
                  <Printer className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-stone-900">सिस्टम प्रिंट डायलॉग (System Print)</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                      शिफारस केलेले (100% Reliable)
                    </span>
                  </div>
                  <p className="text-[10.5px] text-stone-500 mt-1 leading-snug">
                    Zero setup. मोबाईल व कॉम्प्युटरमधील सर्व ब्लूटूथ, Wi-Fi प्रिंटर किंवा PDF वर लगेच प्रिंट होते.
                  </p>
                </div>
                {printMode === "SYSTEM" && <Check className="h-4 w-4 text-red-700 shrink-0 mt-1" />}
              </button>

              {/* Option B: Bluetooth Thermal */}
              <button
                type="button"
                onClick={() => setPrintMode("BLUETOOTH")}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all touch-manipulation flex items-start gap-3 ${
                  printMode === "BLUETOOTH"
                    ? "bg-indigo-50/70 border-indigo-500 text-indigo-950 ring-2 ring-indigo-400/30 font-semibold shadow-xs"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50/80"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${printMode === "BLUETOOTH" ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-600"}`}>
                  <Bluetooth className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-stone-900">ब्लूटूथ थर्मल प्रिंटर (Bluetooth Direct)</span>
                    <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                      हॅन्डहेल्ड POS
                    </span>
                  </div>
                  <p className="text-[10.5px] text-stone-500 mt-1 leading-snug">
                    58mm किंवा 80mm पोर्टेबल वायरलेस प्रिंटर (MPT-II, PT-210, TVS) साठी.
                  </p>
                </div>
                {printMode === "BLUETOOTH" && <Check className="h-4 w-4 text-indigo-700 shrink-0 mt-1" />}
              </button>

              {/* Bluetooth Pairing Subpanel */}
              {printMode === "BLUETOOTH" && (
                <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-950 block">ब्लूटूथ डिव्हाइस जोडा:</span>
                      <span className="text-[10px] text-indigo-700">
                        {bluetoothName ? `जोडलेला प्रिंटर: ${bluetoothName}` : "प्रिंटर स्कॅन करून पेअर करा"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePairBluetooth}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs touch-manipulation active:scale-95"
                    >
                      <Bluetooth className="h-3.5 w-3.5" />
                      <span>{bluetoothName ? "दुसरा प्रिंटर स्कॅन करा" : "प्रिंटर स्कॅन करा"}</span>
                    </button>
                  </div>

                  {isAndroid && (
                    <p className="text-[9.5px] text-indigo-900/80 border-t border-indigo-200/60 pt-1.5 leading-snug">
                      💡 <strong>Android टीप:</strong> प्रथम तुमच्या फोनच्या Settings मधून प्रिंटर पेअर करा (PIN 0000 किंवा 1234), किंवा <strong>सिस्टम प्रिंट डायलॉग</strong> वापरा.
                    </p>
                  )}
                </div>
              )}

              {/* Option C: Wi-Fi / Network IP */}
              <button
                type="button"
                onClick={() => setPrintMode("NETWORK")}
                className={`w-full p-3.5 rounded-2xl border text-left transition-all touch-manipulation flex items-start gap-3 ${
                  printMode === "NETWORK"
                    ? "bg-blue-50/70 border-blue-500 text-blue-950 ring-2 ring-blue-400/30 font-semibold shadow-xs"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50/80"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 ${printMode === "NETWORK" ? "bg-blue-600 text-white" : "bg-stone-100 text-stone-600"}`}>
                  <Wifi className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-stone-900">Wi-Fi / नेटवर्क प्रिंटर (LAN IP)</span>
                  </div>
                  <p className="text-[10.5px] text-stone-500 mt-1 leading-snug">
                    किचन किंवा काऊंटरवरील इथरनेट/वायफाय केबल प्रिंटर (Port 9100).
                  </p>
                </div>
                {printMode === "NETWORK" && <Check className="h-4 w-4 text-blue-700 shrink-0 mt-1" />}
              </button>

              {/* Network IP Subpanel */}
              {printMode === "NETWORK" && (
                <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-2 animate-in slide-in-from-top-2 duration-150">
                  <label className="text-[11px] font-bold text-blue-950 block">
                    प्रिंटर IP पत्ता (Printer IP Address):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={networkIp}
                      onChange={(e) => setNetworkIp(e.target.value)}
                      placeholder="192.168.1.200"
                      className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono font-bold focus:border-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <span className="text-[9.5px] text-blue-800/80 block">
                    मानक थर्मल पोर्ट: 9100. प्रिंटर व डिव्हाइस एकाच Wi-Fi वर असणे आवश्यक आहे.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Paper Size */}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              2. कागदाचा आकार (Paper Roll Size)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between ${
                  paperWidth === "80mm"
                    ? "bg-stone-900 text-white border-stone-900 shadow-md font-bold"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <div>
                  <span className="text-xs block font-black">80mm Standard</span>
                  <span className={`text-[10px] ${paperWidth === "80mm" ? "text-stone-300" : "text-stone-400"}`}>
                    3-इंच काऊंटर बिल रोल
                  </span>
                </div>
                {paperWidth === "80mm" && <Check className="h-4 w-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => setPaperWidth("58mm")}
                className={`p-3 rounded-2xl border text-left transition-all touch-manipulation flex items-center justify-between ${
                  paperWidth === "58mm"
                    ? "bg-stone-900 text-white border-stone-900 shadow-md font-bold"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <div>
                  <span className="text-xs block font-black">58mm Compact</span>
                  <span className={`text-[10px] ${paperWidth === "58mm" ? "text-stone-300" : "text-stone-400"}`}>
                    2-इंच मोबाईल हॅन्डहेल्ड रोल
                  </span>
                </div>
                {paperWidth === "58mm" && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Section 3: Essential Automation Toggles */}
          <div className="space-y-2 pt-1">
            <label className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              3. ऑटोमेशन व फॉन्ट (Printing Automation)
            </label>

            <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    ऑर्डर झाल्यावर KOT आपोआप प्रिंट करा
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Auto-print Kitchen Ticket on order send
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrintKot}
                  onChange={(e) => setAutoPrintKot(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </label>

              <div className="border-t border-stone-200/60" />

              <label className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    बिल भरल्यावर पावती आपोआप प्रिंट करा
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Auto-print Customer Tax Invoice on payment
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoPrintReceipt}
                  onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </label>

              <div className="border-t border-stone-200/60" />

              <label className="flex items-center justify-between cursor-pointer py-1">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    मराठी रेस्टॉरंट हेडर (कोल्हापुरी खानावळ)
                  </span>
                  <span className="text-[10px] text-stone-500">
                    Print Marathi Unicode header on receipts
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={printMarathiHeader}
                  onChange={(e) => setPrintMarathiHeader(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Test Print Slip Section */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTesting}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-xl text-xs font-black flex items-center justify-center gap-2 border border-stone-300/80 shadow-2xs transition-all active:scale-95 touch-manipulation"
            >
              <FileText className="h-4 w-4 text-stone-600" />
              <span>{isTesting ? "प्रिंट पाठवत आहे..." : "प्रिंट चाचणी पावती (Print Test Slip)"}</span>
            </button>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  testResult.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-red-50 text-red-900 border border-red-200"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Collapsible Android Guide */}
          <div className="border border-stone-200 rounded-2xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowAndroidGuide(!showAndroidGuide)}
              className="w-full p-3 bg-stone-50 hover:bg-stone-100 flex items-center justify-between font-bold text-stone-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                <span>Android वर प्रिंटर कसे जोडायचे? (Quick Guide)</span>
              </div>
              {showAndroidGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAndroidGuide && (
              <div className="p-3 bg-white space-y-2 text-[11px] text-stone-600 leading-relaxed border-t border-stone-100">
                <div className="space-y-1.5">
                  <p>
                    <strong>पद्धत १: सिस्टम प्रिंट (सर्वात सोपी व खात्रीशीर)</strong>
                    <br />
                    १. वरील <strong>"सिस्टम प्रिंट डायलॉग"</strong> पर्याय निवडा.
                    <br />
                    २. प्रिंट दाबताच फोनचा मूळ प्रिंट मेनू उघडेल.
                    <br />
                    ३. तेथून तुमचा ब्लूटूथ किंवा वायफाय प्रिंटर निवडून पावती प्रिंट करा.
                  </p>
                  <p className="pt-1 border-t border-stone-100">
                    <strong>पद्धत २: ब्लूटूथ थेट प्रिंटिंग</strong>
                    <br />
                    १. फोनच्या Bluetooth Settings मध्ये जाऊन प्रिंटर पेअर करा (पिन <code className="bg-stone-100 px-1 font-mono">0000</code> किंवा <code className="bg-stone-100 px-1 font-mono">1234</code>).
                    <br />
                    २. येथे <strong>"प्रिंटर स्कॅन करा"</strong> बटण दाबून तो निवडा.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-stone-100 bg-stone-50/80 px-5 py-3 flex items-center justify-between gap-2.5">
          <a
            href="/printers"
            onClick={onClose}
            className="text-xs font-bold text-red-700 hover:text-red-900 underline flex items-center gap-1"
          >
            <span>प्रगत प्रिंटर व्यवस्थापन (Fleet) →</span>
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-200/50 transition-colors"
            >
              रद्द करा (Cancel)
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all touch-manipulation flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>जतन करा (Save Settings)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
