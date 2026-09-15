"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Printer,
  Check,
  X,
  Zap,
  Wifi,
  Bluetooth,
  Usb,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  Activity,
  Radio,
  Clock,
  Sparkles,
  Server,
  ArrowRight,
  Smartphone,
  Eye,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  printTestTicket,
  triggerCashDrawerKick,
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
  generatePrinterTestHtml,
} from "@/lib/printing/thermal-printer";
import { ThermalReceiptModal } from "./ThermalReceiptModal";
import {
  PrinterSettings,
  PrinterDevice,
  PrinterConnectionType,
  PrintJob,
} from "@/types/billing";

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_STATIONS = [
  { code: "CASHIER", name: "Cashier Desk / Counter" },
  { code: "MAIN_KITCHEN", name: "Main Kitchen (Hot Food)" },
  { code: "THALI_SECTION", name: "Thali Assembly Line" },
  { code: "TANDOOR_BHAKRI", name: "Tandoor & Bhakri Section" },
  { code: "FRY_SECTION", name: "Fry & Sukka Section" },
  { code: "BEVERAGE_DESSERT", name: "Solkadhi & Bar" },
];

export function PrinterSettingsModal({ isOpen, onClose }: PrinterSettingsModalProps) {
  const store = globalRestaurantStore;
  const [activeTab, setActiveTab] = useState<"DEVICES" | "ROUTING" | "QUEUE" | "TRIGGERS">("DEVICES");
  const [settings, setSettings] = useState<PrinterSettings>(store.printerSettings);
  const [devices, setDevices] = useState<PrinterDevice[]>(
    store.printerSettings.devices && store.printerSettings.devices.length > 0
      ? store.printerSettings.devices
      : DEFAULT_PRINTER_DEVICES
  );
  const [saved, setSaved] = useState(false);
  const [drawerKicked, setDrawerKicked] = useState(false);

  // Live print queue subscription
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  // Testing device state
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, { online: boolean; message: string }>>({});

  // Live test print tracking & preview
  const [printingDeviceId, setPrintingDeviceId] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<Record<string, { success: boolean; message: string }>>({});
  const [previewDevice, setPreviewDevice] = useState<PrinterDevice | null>(null);

  // Add / Edit device modal
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Partial<PrinterDevice>>({
    name: "",
    connectionType: "NETWORK",
    paperWidth: "80mm",
    isEnabled: true,
    status: "ONLINE",
    ipAddress: "192.168.1.",
    port: 9100,
    assignedStations: ["MAIN_KITCHEN"],
    isDefaultReceiptPrinter: false,
    isDefaultKotPrinter: false,
    autoCut: true,
    openDrawerOnPrint: false,
    sppMode: "VIRTUAL_COM",
    rfcommChannel: 1,
    rfcommPin: "0000",
    chunkSize: 128,
    chunkDelayMs: 25,
    baudRate: 9600,
  });

  // Auto-ping all printers on modal open
  const handlePingAll = async () => {
    for (const device of devices) {
      handleTestDevice(device);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const unsub = globalPrinterManager.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    // Auto-ping all on open
    const timer = setTimeout(() => {
      for (const dev of devices) {
        globalPrinterManager.testDeviceConnection(dev, settings).then((res) => {
          setDeviceStatuses((prev) => ({
            ...prev,
            [dev.id]: {
              online: res.online,
              message: res.message || (res.online ? "Online" : "Offline"),
            },
          }));
        });
      }
    }, 300);
    return () => { unsub(); clearTimeout(timer); };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSettingChange = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    store.updatePrinterSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSaveDevice = () => {
    if (!editingDevice.name) return;

    const newDevice: PrinterDevice = {
      id: editingDevice.id || `printer-${Date.now()}`,
      name: editingDevice.name,
      connectionType: editingDevice.connectionType || "NETWORK",
      paperWidth: editingDevice.paperWidth || "80mm",
      isEnabled: editingDevice.isEnabled ?? true,
      status: "ONLINE",
      assignedStations: editingDevice.assignedStations || [],
      isDefaultReceiptPrinter: editingDevice.isDefaultReceiptPrinter || false,
      isDefaultKotPrinter: editingDevice.isDefaultKotPrinter || false,
      autoCut: editingDevice.autoCut ?? true,
      openDrawerOnPrint: editingDevice.openDrawerOnPrint ?? false,
      ...editingDevice,
    };

    const updatedDevices = [...devices];
    const existingIndex = updatedDevices.findIndex((d) => d.id === newDevice.id);
    if (existingIndex !== -1) {
      updatedDevices[existingIndex] = newDevice;
    } else {
      updatedDevices.push(newDevice);
    }

    setDevices(updatedDevices);
    store.updatePrinterSettings({ devices: updatedDevices });
    setIsEditingDevice(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDeleteDevice = (id: string) => {
    const updated = devices.filter((d) => d.id !== id);
    setDevices(updated);
    store.updatePrinterSettings({ devices: updated });
  };

  const handleTestDevice = async (device: PrinterDevice) => {
    setTestingDeviceId(device.id);
    try {
      const res = await globalPrinterManager.testDeviceConnection(device, settings);
      setDeviceStatuses((prev) => ({
        ...prev,
        [device.id]: {
          online: res.online,
          message: res.message || (res.online ? "Online" : "Offline"),
        },
      }));
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handlePrintDeviceTestSlip = async (device: PrinterDevice) => {
    setPrintingDeviceId(device.id);
    setPrintStatus((prev) => ({
      ...prev,
      [device.id]: { success: true, message: "Dispatching test slip..." },
    }));
    try {
      const res = await globalPrinterManager.printDirectDeviceTestSlip(
        device,
        generatePrinterTestHtml
      );
      setPrintStatus((prev) => ({
        ...prev,
        [device.id]: {
          success: res.success,
          message: res.message || (res.success ? "Test slip sent!" : "Print failed"),
        },
      }));
      // Auto-clear success after 8s
      if (res.success) {
        setTimeout(() => {
          setPrintStatus((prev) => {
            const copy = { ...prev };
            delete copy[device.id];
            return copy;
          });
        }, 8000);
      }
    } catch (err: any) {
      setPrintStatus((prev) => ({
        ...prev,
        [device.id]: {
          success: false,
          message: err.message || "Failed to send test slip",
        },
      }));
    } finally {
      setPrintingDeviceId(null);
    }
  };

  const handleTestDrawer = () => {
    triggerCashDrawerKick();
    setDrawerKicked(true);
    setTimeout(() => setDrawerKicked(false), 2000);
  };

  const handlePairBluetooth = async () => {
    try {
      const res = await globalPrinterManager.pairBluetoothPrinter();
      if (res) {
        setEditingDevice((prev) => ({
          ...prev,
          bluetoothDeviceName: res.deviceName,
          name: res.deviceName,
        }));
      }
    } catch (err: any) {
      alert(err.message || "Bluetooth pairing error");
    }
  };

  const handlePairBluetoothSpp = async () => {
    try {
      const res = await globalPrinterManager.pairBluetoothSppPrinter(editingDevice.sppUuid);
      if (res) {
        setEditingDevice((prev) => ({
          ...prev,
          bluetoothDeviceName: res.deviceName,
          name: prev.name || res.deviceName,
        }));
      }
    } catch (err: any) {
      alert(err.message || "Bluetooth SPP pairing error");
    }
  };

  const handleConnectSerial = async () => {
    try {
      const res = await globalPrinterManager.requestSerialPort(editingDevice.baudRate || 9600);
      if (res) {
        setEditingDevice((prev) => ({
          ...prev,
          name: prev.name || res.portName,
          serialPortName: res.portName,
        }));
      }
    } catch (err: any) {
      alert(err.message || "Serial connection error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-900 text-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-md">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-wide">
                  Thermal Printer Fleet Manager
                </h3>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Multi-Device Ready
                </span>
              </div>
              <p className="text-[11px] text-stone-300 font-medium">
                Simultaneous Network (LAN/Wi-Fi), Bluetooth, Serial/USB & Station Routing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-4 sm:px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("DEVICES")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "DEVICES"
                ? "border-red-600 text-red-700"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Printers & Hardware ({devices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ROUTING")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "ROUTING"
                ? "border-red-600 text-red-700"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Station Routing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QUEUE")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "QUEUE"
                ? "border-red-600 text-red-700"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Print Spooler ({jobs.filter((j) => j.status === "QUEUED" || j.status === "PRINTING").length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("TRIGGERS")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "TRIGGERS"
                ? "border-red-600 text-red-700"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Automation Triggers</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: PRINTERS & LIVE HARDWARE FLEET */}
          {activeTab === "DEVICES" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Connected Hardware Thermal Printers
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Multiple printers can receive print jobs simultaneously across kitchen & counter stations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePingAll}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all shadow-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Ping All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDevice({
                        name: "",
                        connectionType: "NETWORK",
                        paperWidth: "80mm",
                        isEnabled: true,
                        status: "ONLINE",
                        ipAddress: "192.168.1.",
                        port: 9100,
                        assignedStations: ["MAIN_KITCHEN"],
                        isDefaultReceiptPrinter: false,
                        isDefaultKotPrinter: false,
                        autoCut: true,
                        openDrawerOnPrint: false,
                      });
                      setIsEditingDevice(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 transition-all shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Thermal Printer</span>
                  </button>
                </div>
              </div>

              {/* Printer Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {devices.map((device) => {
                  const statusInfo = deviceStatuses[device.id];
                  return (
                    <div
                      key={device.id}
                      className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`p-2 rounded-lg ${
                              device.connectionType === "NETWORK"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : device.connectionType === "BLUETOOTH"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : device.connectionType === "BLUETOOTH_SPP"
                                ? "bg-teal-50 text-teal-700 border border-teal-200"
                                : device.connectionType === "SERIAL_USB"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : device.connectionType === "RAWBT"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-stone-100 text-stone-700 border border-stone-200"
                            }`}
                          >
                            {device.connectionType === "NETWORK" && <Wifi className="h-4 w-4" />}
                            {device.connectionType === "BLUETOOTH" && <Bluetooth className="h-4 w-4" />}
                            {device.connectionType === "BLUETOOTH_SPP" && <Radio className="h-4 w-4" />}
                            {device.connectionType === "SERIAL_USB" && <Usb className="h-4 w-4" />}
                            {device.connectionType === "RAWBT" && <Smartphone className="h-4 w-4" />}
                            {device.connectionType === "BROWSER_SYSTEM" && <Printer className="h-4 w-4" />}
                            {device.connectionType === "LOCAL_BRIDGE" && <Server className="h-4 w-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-bold text-stone-900">{device.name}</h5>
                              <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[9px] font-black text-stone-600">
                                {device.paperWidth}
                              </span>
                            </div>

                            <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                              {device.connectionType === "NETWORK" && `${device.ipAddress || "No IP"}:${device.port || 9100}`}
                              {device.connectionType === "BLUETOOTH" && (device.bluetoothDeviceName || "Bluetooth BLE")}
                              {device.connectionType === "BLUETOOTH_SPP" && `SPP RFCOMM (${device.sppMode || "VIRTUAL_COM"}, Ch.${device.rfcommChannel || 1}${device.serialPortName ? ` • ${device.serialPortName}` : ""}${device.bluetoothDeviceName ? ` • ${device.bluetoothDeviceName}` : ""})`}
                              {device.connectionType === "SERIAL_USB" && `${device.serialPortName || "COM Port"} (${device.baudRate || 9600} bps)`}
                              {device.connectionType === "RAWBT" && (device.rawbtMethod === "INTENT" ? "RawBT Android Intent" : `RawBT :${device.rawbtPort || 40213}`)}
                              {device.connectionType === "LOCAL_BRIDGE" && (device.bridgeUrl || "http://localhost:9180")}
                              {device.connectionType === "BROWSER_SYSTEM" && "System Print Dialog"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDevice(device);
                              setIsEditingDevice(true);
                            }}
                            className="p-1 text-stone-400 hover:text-stone-700 rounded"
                            title="Edit printer"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(device.id)}
                            className="p-1 text-stone-400 hover:text-red-600 rounded"
                            title="Delete printer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Assigned Stations & Tags */}
                      <div className="flex flex-wrap gap-1">
                        {device.isDefaultReceiptPrinter && (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                            ★ Primary Receipt
                          </span>
                        )}
                        {device.isDefaultKotPrinter && (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-800 border border-red-200">
                            ★ Primary KOT
                          </span>
                        )}
                        {device.assignedStations.map((st) => (
                          <span
                            key={st}
                            className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-700"
                          >
                            {st}
                          </span>
                        ))}
                      </div>

                      {/* Test & Live Status Footer */}
                      <div className="flex items-center justify-between border-t border-stone-100 pt-2 text-[10px]">
                        <div>
                          {statusInfo ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                statusInfo.online ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {statusInfo.online ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-rose-600" />
                              )}
                              {statusInfo.message}
                            </span>
                          ) : (
                            <span className="text-stone-400 flex items-center gap-1">
                              <Radio className="h-3 w-3" />
                              Ready for dispatch
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewDevice(device)}
                            title="Preview ESC/POS test slip"
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100 transition-colors"
                          >
                            <Eye className="h-2.5 w-2.5 text-stone-500" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTestDevice(device)}
                            disabled={testingDeviceId === device.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`h-2.5 w-2.5 ${testingDeviceId === device.id ? "animate-spin text-red-600" : ""}`} />
                            <span>Ping</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintDeviceTestSlip(device)}
                            disabled={printingDeviceId === device.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-black disabled:opacity-60 transition-colors"
                          >
                            <Printer className={`h-2.5 w-2.5 ${printingDeviceId === device.id ? "animate-spin text-red-400" : ""}`} />
                            <span>{printingDeviceId === device.id ? "Printing..." : "Test Slip"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Live Test Slip Feedback */}
                      {printStatus[device.id] && (
                        <div
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] font-semibold border ${
                            printStatus[device.id].success
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {printStatus[device.id].success ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                            )}
                            <span className="truncate">{printStatus[device.id].message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice(device)}
                            className="ml-2 shrink-0 font-bold underline hover:opacity-80"
                          >
                            View Slip
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: STATION ROUTING */}
          {activeTab === "ROUTING" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      Multi-Station Order Splitting
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      When a waiter places an order with items from different kitchen stations (e.g. Mutton Thali, Bhakri, and Solkadhi), the system automatically routes items to each designated thermal printer simultaneously!
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSplitKotByStation ?? true}
                    onChange={(e) => handleSettingChange("autoSplitKotByStation", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 mt-1"
                  />
                </div>

                <div className="flex items-start justify-between border-t border-stone-200 pt-3">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      Print Master Copy to Main Kitchen
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      In addition to station tickets, also print a complete consolidated KOT to the head chef counter.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.printMasterKotToKitchen ?? true}
                    onChange={(e) => handleSettingChange("printMasterKotToKitchen", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 mt-1"
                  />
                </div>
              </div>

              {/* Station Mapping Table */}
              <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-2xs">
                <div className="bg-stone-100/70 px-4 py-2.5 border-b border-stone-200 text-xs font-bold text-stone-800">
                  Station Printer Destination Matrix
                </div>
                <div className="divide-y divide-stone-100">
                  {AVAILABLE_STATIONS.map((station) => {
                    const assignedDevice = devices.find((d) =>
                      d.assignedStations && d.assignedStations.includes(station.code)
                    ) || devices.find((d) => station.code === "CASHIER" ? d.isDefaultReceiptPrinter : d.isDefaultKotPrinter);

                    return (
                      <div key={station.code} className="px-4 py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-stone-900">{station.name}</div>
                          <div className="text-[10px] text-stone-500 font-mono">Code: {station.code}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-stone-700">
                            Routes to:
                          </span>
                          <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-red-700 border border-stone-200">
                            {assignedDevice ? assignedDevice.name : "System Default"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRINT QUEUE & CONCURRENT SPOOLER */}
          {activeTab === "QUEUE" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    Live Hardware Print Spooler
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Prevents concurrent byte collisions when multiple waiters submit orders at the same time.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => globalPrinterManager.clearCompletedJobs()}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    Clear Completed
                  </button>
                </div>
              </div>

              {jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-400">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-stone-400 opacity-60" />
                  <p className="text-xs font-medium">No print jobs in spooler queue.</p>
                  <p className="text-[10px] text-stone-400 mt-1">Jobs will appear here as orders and receipts are printed.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-2xs divide-y divide-stone-100">
                  {jobs.slice(0, 20).map((job) => (
                    <div key={job.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            job.status === "SUCCESS"
                              ? "bg-emerald-500"
                              : job.status === "PRINTING"
                              ? "bg-amber-500 animate-ping"
                              : job.status === "RETRYING"
                              ? "bg-orange-500 animate-pulse"
                              : job.status === "FAILED"
                              ? "bg-red-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <div>
                          <div className="font-bold text-stone-900">{job.title}</div>
                          <div className="text-[10px] text-stone-500 flex items-center gap-2">
                            <span>Target: {job.printerName}</span>
                            <span>•</span>
                            <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                            {job.errorMessage && (
                              <span className="text-red-600 font-medium">({job.errorMessage})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            job.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700"
                              : job.status === "PRINTING"
                              ? "bg-amber-50 text-amber-700"
                              : job.status === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUTOMATION TRIGGERS */}
          {activeTab === "TRIGGERS" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-900">Hardware Triggers & Solenoids</h4>

                <label className="flex items-center justify-between cursor-pointer py-1.5 border-b border-stone-100">
                  <div>
                    <span className="text-xs font-medium text-stone-800 block">Auto-print KOT on order placement</span>
                    <span className="text-[10px] text-stone-500">Sends ticket to kitchen immediately when waiter confirms</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoPrintKotOnOrder}
                    onChange={(e) => handleSettingChange("autoPrintKotOnOrder", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1.5 border-b border-stone-100">
                  <div>
                    <span className="text-xs font-medium text-stone-800 block">Auto-print customer bill on payment</span>
                    <span className="text-[10px] text-stone-500">Prints tax invoice when Cash or UPI is settled</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoPrintReceiptOnPayment}
                    onChange={(e) => handleSettingChange("autoPrintReceiptOnPayment", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1.5 border-b border-stone-100">
                  <div>
                    <span className="text-xs font-medium text-stone-800 block">Kick cash drawer on Cash tender</span>
                    <span className="text-[10px] text-stone-500">Sends ESC/POS pulse (ESC p 0 25 250) to open solenoid drawer</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoKickCashDrawerOnCash}
                    onChange={(e) => handleSettingChange("autoKickCashDrawerOnCash", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1.5">
                  <div>
                    <span className="text-xs font-medium text-stone-800 block">Include Marathi Devanagari header</span>
                    <span className="text-[10px] text-stone-500">Prints bold "कोल्हापुरी खानावळ" on top of receipt</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.printMarathiHeader}
                    onChange={(e) => handleSettingChange("printMarathiHeader", e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>

              {/* Hardware Test Panel */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                <h4 className="text-xs font-bold text-stone-900">Diagnostic Hardware Tests</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => printTestTicket(settings)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white p-3 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-100 active:scale-95 transition-all"
                  >
                    <Printer className="h-4 w-4 text-red-700" />
                    <span>Broadcast Test Slip to All</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestDrawer}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white p-3 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-100 active:scale-95 transition-all"
                  >
                    <Zap className="h-4 w-4 text-amber-600" />
                    <span>{drawerKicked ? "Pulse Fired!" : "Test Cash Drawer Pulse"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Settings saved!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white hover:bg-stone-800 active:scale-95 transition-all shadow-xs"
          >
            Close & Apply
          </button>
        </div>
      </div>

      {/* SUB-MODAL: ADD / EDIT PRINTER */}
      {isEditingDevice && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-3">
              <h4 className="text-sm font-bold text-stone-900">
                {editingDevice.id ? "Edit Thermal Printer" : "Configure New Thermal Printer"}
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingDevice(false)}
                className="rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Printer Display Name</label>
                <input
                  type="text"
                  value={editingDevice.name || ""}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  placeholder="e.g. Kitchen Master 80-1 or Bar Counter"
                  className="w-full rounded-xl border border-stone-300 p-2.5 text-xs focus:border-red-600 focus:outline-hidden"
                />
              </div>

              {/* Connection Type */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Hardware Interface / Connection</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: "NETWORK", label: "Network (LAN/Wi-Fi)", icon: Wifi },
                    { type: "BLUETOOTH_SPP", label: "Bluetooth SPP / RFCOMM", icon: Radio },
                    { type: "SERIAL_USB", label: "Serial COM Port", icon: Usb },
                    { type: "RAWBT", label: "RawBT (Android)", icon: Smartphone },
                    { type: "BLUETOOTH", label: "Web Bluetooth BLE", icon: Bluetooth },
                    { type: "LOCAL_BRIDGE", label: "Local POS Bridge", icon: Server },
                    { type: "BROWSER_SYSTEM", label: "System Dialog", icon: Printer },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSel = editingDevice.connectionType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setEditingDevice({ ...editingDevice, connectionType: item.type as any })}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          isSel
                            ? "border-red-600 bg-red-50 text-red-900 font-bold shadow-2xs"
                            : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSel ? "text-red-700" : "text-stone-500"}`} />
                        <span className="text-[11px]">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Connection Details */}
              {editingDevice.connectionType === "NETWORK" && (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-blue-50/50 p-3 border border-blue-100">
                  <div className="col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Printer IP Address</label>
                    <input
                      type="text"
                      value={editingDevice.ipAddress || ""}
                      onChange={(e) => setEditingDevice({ ...editingDevice, ipAddress: e.target.value })}
                      placeholder="192.168.1.200"
                      className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Raw Port</label>
                    <input
                      type="number"
                      value={editingDevice.port || 9100}
                      onChange={(e) => setEditingDevice({ ...editingDevice, port: parseInt(e.target.value, 10) || 9100 })}
                      className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* BLUETOOTH CLASSIC SPP / RFCOMM CONFIGURATION */}
              {editingDevice.connectionType === "BLUETOOTH_SPP" && (
                <div className="rounded-xl bg-teal-50/60 p-3.5 border border-teal-200 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Radio className="h-4 w-4 text-teal-700" />
                        <label className="font-bold text-stone-900 text-xs">
                          Bluetooth Classic SPP & RFCOMM Setup
                        </label>
                      </div>
                      <p className="text-[10px] text-stone-600 mt-0.5">
                        Standard wireless serial protocol for ESC/POS thermal printers (PT-210, MPT-II, ZJ-5802, GOOJPRT, HOIN, TVS, Epson).
                      </p>
                    </div>
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold text-teal-800 border border-teal-300">
                      RFCOMM SPP
                    </span>
                  </div>

                  {/* SPP Transport / Operating Mode */}
                  <div>
                    <label className="block text-[10px] font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                      Operating Mode / Driver Interface
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {[
                        {
                          mode: "VIRTUAL_COM",
                          title: "Virtual COM Port",
                          subtitle: "Paired Windows/Mac COM Port via Web Serial (Recommended for PC)",
                          icon: Usb,
                        },
                        {
                          mode: "BLE_GATT",
                          title: "GATT Serial SPP",
                          subtitle: "Standard SPP (0x1101) & UART characteristics in Chrome",
                          icon: Bluetooth,
                        },
                        {
                          mode: "RAWBT_RFCOMM",
                          title: "RawBT Android Socket",
                          subtitle: "Native RFCOMM channel for Android phones & tablets",
                          icon: Smartphone,
                        },
                      ].map((m) => {
                        const isSel = (editingDevice.sppMode || "VIRTUAL_COM") === m.mode;
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.mode}
                            type="button"
                            onClick={() => setEditingDevice({ ...editingDevice, sppMode: m.mode as any })}
                            className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                              isSel
                                ? "border-teal-600 bg-white text-teal-950 font-bold shadow-xs ring-1 ring-teal-500"
                                : "border-teal-200/70 bg-teal-50/40 text-stone-700 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3.5 w-3.5 ${isSel ? "text-teal-700" : "text-stone-400"}`} />
                              <span className="text-[11px] font-bold">{m.title}</span>
                            </div>
                            <span className="text-[9px] text-stone-500 mt-1 line-clamp-2 leading-tight">
                              {m.subtitle}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode-Specific Settings */}
                  {/* Mode 1: Virtual COM Port (Web Serial RFCOMM) */}
                  {(editingDevice.sppMode === "VIRTUAL_COM" || !editingDevice.sppMode) && (
                    <div className="rounded-lg bg-white p-3 border border-teal-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-stone-900 block">
                            Paired Bluetooth COM Port
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Pair printer in Windows Bluetooth settings first, then select its virtual COM port.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConnectSerial}
                          className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
                        >
                          <Usb className="h-3.5 w-3.5" />
                          <span>{editingDevice.serialPortName ? "Change COM Port" : "Select COM Port"}</span>
                        </button>
                      </div>

                      {editingDevice.serialPortName && (
                        <div className="rounded-md bg-teal-50 border border-teal-200 p-2 font-mono text-[11px] text-teal-900 font-bold flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                          <span>Connected Port: {editingDevice.serialPortName}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-stone-100">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Baud Rate</label>
                          <select
                            value={editingDevice.baudRate || 9600}
                            onChange={(e) => setEditingDevice({ ...editingDevice, baudRate: parseInt(e.target.value, 10) })}
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          >
                            <option value={9600}>9600 bps (Standard POS)</option>
                            <option value={19200}>19200 bps</option>
                            <option value={38400}>38400 bps</option>
                            <option value={57600}>57600 bps</option>
                            <option value={115200}>115200 bps (High-Speed)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Data Bits</label>
                          <select
                            value={editingDevice.dataBits || 8}
                            onChange={(e) => setEditingDevice({ ...editingDevice, dataBits: parseInt(e.target.value, 10) as any })}
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          >
                            <option value={8}>8 bits (Standard)</option>
                            <option value={7}>7 bits</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Parity</label>
                          <select
                            value={editingDevice.parity || "none"}
                            onChange={(e) => setEditingDevice({ ...editingDevice, parity: e.target.value as any })}
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          >
                            <option value="none">None (Standard)</option>
                            <option value="even">Even</option>
                            <option value="odd">Odd</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Flow Control</label>
                          <select
                            value={editingDevice.flowControl || "none"}
                            onChange={(e) => setEditingDevice({ ...editingDevice, flowControl: e.target.value as any })}
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          >
                            <option value="none">None</option>
                            <option value="hardware">Hardware (RTS/CTS)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: GATT Serial SPP */}
                  {editingDevice.sppMode === "BLE_GATT" && (
                    <div className="rounded-lg bg-white p-3 border border-teal-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-stone-900 block">
                            Web Bluetooth SPP Device Scan
                          </span>
                          <span className="text-[10px] text-stone-500">
                            Connects directly using SPP 0x1101 and UART characteristics in Chrome/Edge.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePairBluetoothSpp}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
                        >
                          <Bluetooth className="h-3.5 w-3.5" />
                          <span>Scan SPP Device</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-100">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Device Name</label>
                          <input
                            type="text"
                            value={editingDevice.bluetoothDeviceName || ""}
                            onChange={(e) => setEditingDevice({ ...editingDevice, bluetoothDeviceName: e.target.value })}
                            placeholder="e.g. PT-210 or MPT-II"
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">SPP Service UUID</label>
                          <input
                            type="text"
                            value={editingDevice.sppUuid || "00001101-0000-1000-8000-00805f9b34fb"}
                            onChange={(e) => setEditingDevice({ ...editingDevice, sppUuid: e.target.value })}
                            placeholder="00001101-0000-1000-8000-00805f9b34fb"
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono text-[10px]"
                          />
                        </div>
                      </div>

                      {/* Quick UUID Presets */}
                      <div className="flex flex-wrap items-center gap-1 text-[9px] pt-1">
                        <span className="text-stone-400 font-bold">UUID Presets:</span>
                        {[
                          { label: "0x1101 (Standard SPP)", uuid: "00001101-0000-1000-8000-00805f9b34fb" },
                          { label: "HM-10 (0xFFE0)", uuid: "0000ffe0-0000-1000-8000-00805f9b34fb" },
                          { label: "ISSC UART", uuid: "49535343-fe7d-41aa-87d9-066442454a86" },
                          { label: "Nordic NUS", uuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e" },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setEditingDevice({ ...editingDevice, sppUuid: p.uuid })}
                            className="rounded bg-stone-100 px-1.5 py-0.5 hover:bg-stone-200 text-stone-700 font-mono"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mode 3: RawBT Android RFCOMM Socket */}
                  {editingDevice.sppMode === "RAWBT_RFCOMM" && (
                    <div className="rounded-lg bg-white p-3 border border-teal-200 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-900">
                        <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                        <span>Android Native RFCOMM Socket Target</span>
                      </div>
                      <p className="text-[10px] text-stone-500">
                        RawBT communicates directly with the printer's Bluetooth MAC address on RFCOMM channel.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                            Bluetooth MAC Address or Name
                          </label>
                          <input
                            type="text"
                            value={editingDevice.bluetoothMacAddress || editingDevice.bluetoothDeviceName || ""}
                            onChange={(e) => setEditingDevice({ ...editingDevice, bluetoothMacAddress: e.target.value })}
                            placeholder="66:32:B1:88:99:A2 or PT-210"
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">RFCOMM Channel</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={editingDevice.rfcommChannel || 1}
                            onChange={(e) => setEditingDevice({ ...editingDevice, rfcommChannel: parseInt(e.target.value, 10) || 1 })}
                            className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* Quick PIN Selector */}
                      <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                        <span className="text-[10px] font-bold text-stone-600">Pairing PIN:</span>
                        <div className="flex items-center gap-1">
                          {["0000", "1234"].map((pin) => (
                            <button
                              key={pin}
                              type="button"
                              onClick={() => setEditingDevice({ ...editingDevice, rfcommPin: pin })}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                editingDevice.rfcommPin === pin
                                  ? "bg-teal-600 text-white border-teal-700"
                                  : "bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200"
                              }`}
                            >
                              {pin}
                            </button>
                          ))}
                          <input
                            type="text"
                            value={editingDevice.rfcommPin || "0000"}
                            onChange={(e) => setEditingDevice({ ...editingDevice, rfcommPin: e.target.value })}
                            placeholder="PIN"
                            className="w-16 rounded border border-stone-300 p-1 text-[10px] font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Flow Control & Buffer Throttling (All Modes) */}
                  <div className="rounded-lg bg-teal-50/70 p-2.5 border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-800 uppercase tracking-wider">
                        Buffer Flow Control & Throttling
                      </span>
                      <span className="text-[9px] font-semibold text-teal-800">
                        Prevents RAM overflow on portable printers
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Chunk Size</label>
                        <select
                          value={editingDevice.chunkSize || 128}
                          onChange={(e) => setEditingDevice({ ...editingDevice, chunkSize: parseInt(e.target.value, 10) })}
                          className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                        >
                          <option value={64}>64 Bytes (Safe for 58mm)</option>
                          <option value={128}>128 Bytes (Recommended)</option>
                          <option value={256}>256 Bytes</option>
                          <option value={512}>512 Bytes (Fast)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Inter-Chunk Delay</label>
                        <select
                          value={editingDevice.chunkDelayMs !== undefined ? editingDevice.chunkDelayMs : 25}
                          onChange={(e) => setEditingDevice({ ...editingDevice, chunkDelayMs: parseInt(e.target.value, 10) })}
                          className="w-full rounded-lg border border-stone-300 bg-white p-1.5 text-xs font-mono"
                        >
                          <option value={10}>10 ms</option>
                          <option value={25}>25 ms (Recommended)</option>
                          <option value={50}>50 ms (Slow printhead)</option>
                          <option value={0}>0 ms (No throttle)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Quick Setup Instructions Accordion */}
                  <div className="rounded-lg bg-stone-100/80 p-2.5 text-[10px] text-stone-600 space-y-1">
                    <span className="font-bold text-stone-800 block">💡 Quick SPP / RFCOMM Pairing Tips:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[9.5px]">
                      <li>
                        <strong>Windows PC:</strong> Pair printer in Windows Bluetooth Settings (PIN <code className="font-mono bg-white px-1">0000</code> or <code className="font-mono bg-white px-1">1234</code>), then use <em>Virtual COM Port</em> mode to link the COM port.
                      </li>
                      <li>
                        <strong>Android Mobile Waiter:</strong> Use <em>RawBT Android Socket</em> or <em>GATT Serial</em> with Channel 1.
                      </li>
                      <li>
                        <strong>Garbled Characters or Missing Lines?</strong> Set Chunk Size to <strong>128 Bytes</strong> and Delay to <strong>25ms</strong>.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {editingDevice.connectionType === "BLUETOOTH" && (
                <div className="rounded-xl bg-indigo-50/50 p-3 border border-indigo-100 space-y-2">
                  <label className="block font-bold text-stone-800">Bluetooth Device Pairing</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingDevice.bluetoothDeviceName || ""}
                      onChange={(e) => setEditingDevice({ ...editingDevice, bluetoothDeviceName: e.target.value })}
                      placeholder="e.g. MPT-II or RPP02N"
                      className="flex-1 rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={handlePairBluetooth}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700"
                    >
                      Pair Device
                    </button>
                  </div>
                </div>
              )}

              {editingDevice.connectionType === "SERIAL_USB" && (
                <div className="rounded-xl bg-amber-50/50 p-3 border border-amber-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-stone-800">Serial COM Port (RS232 / USB-to-UART)</label>
                      <p className="text-[10px] text-stone-500">Supports CH340, CP2102, FTDI, Prolific chips on Windows/Linux</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectSerial}
                      className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-2xs"
                    >
                      {editingDevice.serialPortName ? "Change COM Port" : "Select COM Port"}
                    </button>
                  </div>

                  {editingDevice.serialPortName && (
                    <div className="rounded-lg bg-white border border-amber-200 p-2 font-mono text-[11px] text-amber-900 font-bold flex items-center gap-1.5">
                      <Usb className="h-3.5 w-3.5 text-amber-600" />
                      <span>{editingDevice.serialPortName}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Baud Rate</label>
                      <select
                        value={editingDevice.baudRate || 9600}
                        onChange={(e) => setEditingDevice({ ...editingDevice, baudRate: parseInt(e.target.value, 10) })}
                        className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                      >
                        <option value={9600}>9600 bps (Standard POS)</option>
                        <option value={19200}>19200 bps</option>
                        <option value={38400}>38400 bps</option>
                        <option value={57600}>57600 bps</option>
                        <option value={115200}>115200 bps (High-Speed)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Data Bits</label>
                      <select
                        value={editingDevice.dataBits || 8}
                        onChange={(e) => setEditingDevice({ ...editingDevice, dataBits: parseInt(e.target.value, 10) as any })}
                        className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                      >
                        <option value={8}>8 bits</option>
                        <option value={7}>7 bits</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Parity</label>
                      <select
                        value={editingDevice.parity || "none"}
                        onChange={(e) => setEditingDevice({ ...editingDevice, parity: e.target.value as any })}
                        className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                      >
                        <option value="none">None</option>
                        <option value="even">Even</option>
                        <option value="odd">Odd</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Stop Bits</label>
                      <select
                        value={editingDevice.stopBits || 1}
                        onChange={(e) => setEditingDevice({ ...editingDevice, stopBits: parseInt(e.target.value, 10) as any })}
                        className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                      >
                        <option value={1}>1 bit</option>
                        <option value={2}>2 bits</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {editingDevice.connectionType === "RAWBT" && (
                <div className="rounded-xl bg-purple-50/50 p-3.5 border border-purple-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-700" />
                    <div>
                      <label className="block font-bold text-stone-800">RawBT Print Service (Android)</label>
                      <p className="text-[10px] text-stone-500">
                        Prints via RawBT app on Android phones & tablets connected to thermal printers (Bluetooth, USB, or Wi-Fi).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDevice({ ...editingDevice, rawbtMethod: "HTTP" })}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        (editingDevice.rawbtMethod || "HTTP") === "HTTP"
                          ? "border-purple-600 bg-purple-100/70 font-bold text-purple-950"
                          : "border-stone-200 bg-white text-stone-700"
                      }`}
                    >
                      <div className="font-bold">Background HTTP Daemon</div>
                      <div className="text-[9.5px] text-stone-500">Silent background print on port 40213</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingDevice({ ...editingDevice, rawbtMethod: "INTENT" })}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        editingDevice.rawbtMethod === "INTENT"
                          ? "border-purple-600 bg-purple-100/70 font-bold text-purple-950"
                          : "border-stone-200 bg-white text-stone-700"
                      }`}
                    >
                      <div className="font-bold">Android App Intent</div>
                      <div className="text-[9.5px] text-stone-500">Launches RawBT Android URI scheme</div>
                    </button>
                  </div>

                  {(editingDevice.rawbtMethod || "HTTP") === "HTTP" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-stone-600 mb-0.5">RawBT Host / IP</label>
                        <input
                          type="text"
                          value={editingDevice.rawbtHost || "localhost"}
                          onChange={(e) => setEditingDevice({ ...editingDevice, rawbtHost: e.target.value })}
                          placeholder="localhost or 192.168.1.xxx"
                          className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Port (Default 40213)</label>
                        <input
                          type="number"
                          value={editingDevice.rawbtPort || 40213}
                          onChange={(e) => setEditingDevice({ ...editingDevice, rawbtPort: parseInt(e.target.value, 10) || 40213 })}
                          className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}


              {editingDevice.connectionType === "LOCAL_BRIDGE" && (
                <div className="rounded-xl bg-stone-100 p-3 space-y-1">
                  <label className="block font-bold text-stone-800">Bridge Gateway URL</label>
                  <input
                    type="text"
                    value={editingDevice.bridgeUrl || "http://localhost:9180/print"}
                    onChange={(e) => setEditingDevice({ ...editingDevice, bridgeUrl: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 bg-white p-2 text-xs font-mono"
                  />
                </div>
              )}

              {/* Paper Width Profile */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Paper Roll Width</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDevice({ ...editingDevice, paperWidth: "80mm" })}
                    className={`p-2.5 rounded-xl border text-left ${
                      editingDevice.paperWidth === "80mm"
                        ? "border-red-600 bg-red-50 font-bold text-red-900"
                        : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    80mm Standard (Desktop POS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDevice({ ...editingDevice, paperWidth: "58mm" })}
                    className={`p-2.5 rounded-xl border text-left ${
                      editingDevice.paperWidth === "58mm"
                        ? "border-red-600 bg-red-50 font-bold text-red-900"
                        : "border-stone-200 bg-white text-stone-700"
                    }`}
                  >
                    58mm Compact (Mobile POS)
                  </button>
                </div>
              </div>

              {/* Station Assignment */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Assigned Kitchen / Service Stations</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AVAILABLE_STATIONS.map((station) => {
                    const assigned = editingDevice.assignedStations?.includes(station.code);
                    return (
                      <label
                        key={station.code}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                          assigned ? "bg-stone-50 border-stone-300 font-bold" : "border-stone-200 text-stone-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={(e) => {
                            const cur = editingDevice.assignedStations || [];
                            const updated = e.target.checked
                              ? [...cur, station.code]
                              : cur.filter((c) => c !== station.code);
                            setEditingDevice({ ...editingDevice, assignedStations: updated });
                          }}
                          className="rounded text-red-600"
                        />
                        <span className="text-[11px]">{station.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Default Role Flags */}
              <div className="space-y-2 border-t border-stone-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingDevice.isDefaultReceiptPrinter || false}
                    onChange={(e) => setEditingDevice({ ...editingDevice, isDefaultReceiptPrinter: e.target.checked })}
                    className="rounded text-red-600"
                  />
                  <span>Primary Receipt Printer (Receives customer bills)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingDevice.isDefaultKotPrinter || false}
                    onChange={(e) => setEditingDevice({ ...editingDevice, isDefaultKotPrinter: e.target.checked })}
                    className="rounded text-red-600"
                  />
                  <span>Primary KOT Printer (Receives master kitchen tickets)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setIsEditingDevice(false)}
                className="px-4 py-2 rounded-xl border border-stone-300 bg-white font-bold text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDevice}
                className="px-5 py-2 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800"
              >
                Save Printer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Slip Preview Modal */}
      {previewDevice && (
        <ThermalReceiptModal
          isOpen={!!previewDevice}
          onClose={() => setPreviewDevice(null)}
          title={`Diagnostic Test Slip — ${previewDevice.name}`}
          defaultPaperWidth={previewDevice.paperWidth || "80mm"}
          generateHtml={(width) =>
            generatePrinterTestHtml({
              ...settings,
              paperWidth: width,
            })
          }
        />
      )}
    </div>
  );
}
