"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  Wifi,
  Bluetooth,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Edit3,
  Trash2,
  Zap,
  RotateCcw,
  Sliders,
  Check,
  X,
  Clock,
  ShieldCheck,
  ChevronRight,
  Layers,
  HelpCircle,
  FileText,
  Lock,
  Receipt,
  ChefHat,
  Cpu,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Star,
  Search,
  RefreshCw,
  Globe,
  Radio,
  Info,
} from "lucide-react";
import { globalRestaurantStore } from "@/lib/store/restaurant-store";
import {
  globalPrinterManager,
  DEFAULT_PRINTER_DEVICES,
  generatePrinterTestHtml,
} from "@/lib/printing/thermal-printer";
import {
  PrinterDevice,
  PrinterSettings,
  PrinterConnectionType,
  PrinterStatus,
  PrintJob,
} from "@/types/billing";
import { PrintQueueDrawer } from "@/components/printing/PrintQueueDrawer";

const STATION_OPTIONS = [
  { code: "CASHIER", label: "काऊंटर / बिल (Cashier Desk)" },
  { code: "MAIN_KITCHEN", label: "मुख्य स्वयंपाकघर (Main Kitchen)" },
  { code: "THALI_SECTION", label: "थाळी विभाग (Thali Section)" },
  { code: "TANDOOR_BHAKRI", label: "तंदूर व गरमागरम भाकरी (Tandoor & Bhakri)" },
  { code: "FRY_SECTION", label: "तांबडा-पांढरा व सुक्का (Fry / Sukka)" },
  { code: "BEVERAGE_DESSERT", label: "सोलकढी व पेये (Drinks & Dessert)" },
];

export default function PrintersManagementPage() {
  const store = globalRestaurantStore;

  // Settings & Devices State
  const [settings, setSettings] = useState<PrinterSettings>(store.printerSettings);
  const [devices, setDevices] = useState<PrinterDevice[]>(
    store.printerSettings.devices && store.printerSettings.devices.length > 0
      ? store.printerSettings.devices
      : DEFAULT_PRINTER_DEVICES
  );
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  // Modals & Drawers
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PrinterDevice | null>(null);

  // Connection testing states
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { online: boolean; message?: string; latencyMs?: number }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Mobile & Online KP307-UEWB Setup State
  const [mobileSetupTab, setMobileSetupTab] = useState<"WIFI" | "BLUETOOTH">("WIFI");
  const [quickWifiIp, setQuickWifiIp] = useState<string>(() => {
    const existing = store.printerSettings.devices?.find((d) => d.connectionType === "NETWORK" && d.ipAddress);
    return existing?.ipAddress || "192.168.1.100";
  });
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [foundPrinters, setFoundPrinters] = useState<{ ip: string; port: number; latencyMs?: number }[]>([]);
  const [wifiPingStatus, setWifiPingStatus] = useState<{ online: boolean; message: string; latencyMs?: number } | null>(null);
  const [isPingingWifi, setIsPingingWifi] = useState(false);
  const [isTestingQuick, setIsTestingQuick] = useState(false);
  const [showStepGuide, setShowStepGuide] = useState(true);

  // Modal Network helper states
  const [modalPingStatus, setModalPingStatus] = useState<{ online: boolean; message: string; latencyMs?: number } | null>(null);
  const [isModalPinging, setIsModalPinging] = useState(false);
  const [isModalScanning, setIsModalScanning] = useState(false);

  // Form State for Add / Edit Printer
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    modelName: string;
    connectionType: PrinterConnectionType;
    paperWidth: "80mm" | "58mm";
    ipAddress: string;
    port: number;
    timeoutMs: number;
    bluetoothDeviceName: string;
    bleServiceUuid: string;
    sppMode: "VIRTUAL_COM" | "BLE_GATT" | "RAWBT_RFCOMM" | "AUTO";
    serialPortName: string;
    baudRate: number;
    assignedStations: string[];
    isDefaultReceiptPrinter: boolean;
    isDefaultKotPrinter: boolean;
    autoCut: boolean;
    openDrawerOnPrint: boolean;
    failoverPrinterId: string;
  }>({
    id: "",
    name: "",
    modelName: "POSIFLOW KP307-UEWB",
    connectionType: "NETWORK",
    paperWidth: "80mm",
    ipAddress: "192.168.1.50",
    port: 9100,
    timeoutMs: 3000,
    bluetoothDeviceName: "KP307-UEWB",
    bleServiceUuid: "000018f0-0000-1000-8000-00805f9b34fb",
    sppMode: "AUTO",
    serialPortName: "COM3",
    baudRate: 9600,
    assignedStations: ["CASHIER"],
    isDefaultReceiptPrinter: true,
    isDefaultKotPrinter: false,
    autoCut: true,
    openDrawerOnPrint: true,
    failoverPrinterId: "",
  });

  // Subscribe to live printer queue
  useEffect(() => {
    const unsub = globalPrinterManager.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Add Printer Modal with KP307-UEWB presets
  const handleOpenAddModal = (preset: "POSIFLOW_WIFI" | "POSIFLOW_BT" | "SYSTEM" = "POSIFLOW_WIFI") => {
    setEditingDevice(null);
    if (preset === "POSIFLOW_WIFI") {
      setFormData({
        id: `printer-${Date.now()}`,
        name: `POSIFLOW KP307-UEWB (Wi-Fi)`,
        modelName: "POSIFLOW KP307-UEWB",
        connectionType: "NETWORK",
        paperWidth: "80mm",
        ipAddress: "192.168.1.50",
        port: 9100,
        timeoutMs: 3000,
        bluetoothDeviceName: "KP307-UEWB",
        bleServiceUuid: "000018f0-0000-1000-8000-00805f9b34fb",
        sppMode: "AUTO",
        serialPortName: "COM3",
        baudRate: 9600,
        assignedStations: ["CASHIER"],
        isDefaultReceiptPrinter: devices.filter((d) => d.isDefaultReceiptPrinter).length === 0,
        isDefaultKotPrinter: devices.filter((d) => d.isDefaultKotPrinter).length === 0,
        autoCut: true,
        openDrawerOnPrint: true,
        failoverPrinterId: devices[0]?.id || "",
      });
    } else if (preset === "POSIFLOW_BT") {
      setFormData({
        id: `printer-${Date.now()}`,
        name: `POSIFLOW KP307-UEWB (Bluetooth)`,
        modelName: "POSIFLOW KP307-UEWB",
        connectionType: "BLUETOOTH_SPP",
        paperWidth: "80mm",
        ipAddress: "192.168.1.50",
        port: 9100,
        timeoutMs: 3000,
        bluetoothDeviceName: "KP307-UEWB",
        bleServiceUuid: "000018f0-0000-1000-8000-00805f9b34fb",
        sppMode: "AUTO",
        serialPortName: "COM3",
        baudRate: 9600,
        assignedStations: ["MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
        failoverPrinterId: devices[0]?.id || "",
      });
    } else {
      setFormData({
        id: `printer-${Date.now()}`,
        name: `Mobile Spooler (System Print)`,
        modelName: "Browser Print Driver",
        connectionType: "BROWSER_SYSTEM",
        paperWidth: "80mm",
        ipAddress: "",
        port: 9100,
        timeoutMs: 3000,
        bluetoothDeviceName: "",
        bleServiceUuid: "",
        sppMode: "AUTO",
        serialPortName: "",
        baudRate: 9600,
        assignedStations: ["CASHIER", "MAIN_KITCHEN"],
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
        autoCut: true,
        openDrawerOnPrint: false,
        failoverPrinterId: "",
      });
    }
    setIsEditModalOpen(true);
  };

  // Open Edit Printer Modal
  const handleOpenEditModal = (dev: PrinterDevice) => {
    setEditingDevice(dev);
    setFormData({
      id: dev.id,
      name: dev.name,
      modelName: dev.modelName || "POSIFLOW KP307-UEWB",
      connectionType: dev.connectionType,
      paperWidth: dev.paperWidth || "80mm",
      ipAddress: dev.ipAddress || "192.168.1.50",
      port: dev.port || 9100,
      timeoutMs: dev.timeoutMs || 3000,
      bluetoothDeviceName: dev.bluetoothDeviceName || "KP307-UEWB",
      bleServiceUuid: dev.bleServiceUuid || "000018f0-0000-1000-8000-00805f9b34fb",
      sppMode: dev.sppMode || "AUTO",
      serialPortName: dev.serialPortName || "COM3",
      baudRate: dev.baudRate || 9600,
      assignedStations: dev.assignedStations || [],
      isDefaultReceiptPrinter: !!dev.isDefaultReceiptPrinter,
      isDefaultKotPrinter: !!dev.isDefaultKotPrinter,
      autoCut: dev.autoCut ?? true,
      openDrawerOnPrint: dev.openDrawerOnPrint ?? false,
      failoverPrinterId: dev.failoverPrinterId || "",
    });
    setIsEditModalOpen(true);
  };

  // Save Printer Device
  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("कृपया प्रिंटरचे नाव प्रविष्ट करा (Enter printer name)");
      return;
    }

    const updatedDevice: PrinterDevice = {
      id: formData.id || `printer-${Date.now()}`,
      name: formData.name.trim(),
      modelName: formData.modelName,
      connectionType: formData.connectionType,
      paperWidth: formData.paperWidth,
      isEnabled: true,
      status: "ONLINE",
      ipAddress: formData.ipAddress.trim(),
      port: Number(formData.port) || 9100,
      timeoutMs: Number(formData.timeoutMs) || 3000,
      bluetoothDeviceName: formData.bluetoothDeviceName.trim(),
      bleServiceUuid: formData.bleServiceUuid.trim(),
      sppMode: formData.sppMode,
      serialPortName: formData.serialPortName.trim(),
      baudRate: Number(formData.baudRate) || 9600,
      assignedStations: formData.assignedStations,
      isDefaultReceiptPrinter: formData.isDefaultReceiptPrinter,
      isDefaultKotPrinter: formData.isDefaultKotPrinter,
      autoCut: formData.autoCut,
      openDrawerOnPrint: formData.openDrawerOnPrint,
      failoverPrinterId: formData.failoverPrinterId || undefined,
    };

    let nextDevices: PrinterDevice[];
    if (editingDevice) {
      nextDevices = devices.map((d) => (d.id === editingDevice.id ? updatedDevice : d));
    } else {
      nextDevices = [...devices, updatedDevice];
    }

    // Ensure single default receipt and KOT printer if toggled
    if (updatedDevice.isDefaultReceiptPrinter) {
      nextDevices = nextDevices.map((d) =>
        d.id === updatedDevice.id ? d : { ...d, isDefaultReceiptPrinter: false }
      );
    }
    if (updatedDevice.isDefaultKotPrinter) {
      nextDevices = nextDevices.map((d) =>
        d.id === updatedDevice.id ? d : { ...d, isDefaultKotPrinter: false }
      );
    }

    setDevices(nextDevices);
    const updatedSettings: PrinterSettings = {
      ...settings,
      devices: nextDevices,
    };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);

    setIsEditModalOpen(false);
    showToast(`प्रिंटर '${updatedDevice.name}' यशस्वीरित्या जतन केला!`);
  };

  // Delete Printer Device
  const handleDeleteDevice = (id: string, name: string) => {
    if (devices.length <= 1) {
      alert("किमान एक प्रिंटर कॉन्फिगर असणे आवश्यक आहे (At least one printer must remain)");
      return;
    }
    if (!confirm(`तुम्हाला खात्री आहे का '${name}' प्रिंटर काढून टाकायचा आहे?`)) {
      return;
    }
    const nextDevices = devices.filter((d) => d.id !== id);
    setDevices(nextDevices);
    const updatedSettings: PrinterSettings = {
      ...settings,
      devices: nextDevices,
    };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);
    showToast(`प्रिंटर '${name}' काढला गेला.`);
  };

  // Test Ping Connection
  const handleTestConnection = async (dev: PrinterDevice) => {
    setTestingDeviceId(dev.id);
    try {
      const res = await globalPrinterManager.testDeviceConnection(dev, settings);
      setPingResults((prev) => ({
        ...prev,
        [dev.id]: {
          online: res.online,
          message: res.message || (res.online ? "Connected" : "Unreachable"),
          latencyMs: res.latencyMs,
        },
      }));
      if (res.online) {
        showToast(`✅ ${dev.name}: जोडणी यशस्वी (${res.latencyMs ? `${res.latencyMs}ms` : "Active"})`);
      } else {
        showToast(`❌ ${dev.name}: संपर्क होऊ शकला नाही (${res.message || "Offline"})`);
      }
    } catch (err: any) {
      setPingResults((prev) => ({
        ...prev,
        [dev.id]: {
          online: false,
          message: err?.message || "Connection failed",
        },
      }));
      showToast(`❌ ${dev.name}: ${err?.message || "Ping error"}`);
    } finally {
      setTestingDeviceId(null);
    }
  };

  // Send Direct Diagnostic Test Slip
  const handleTestPrint = async (dev: PrinterDevice) => {
    showToast(`🖨️ ${dev.name} वर टेस्ट पावती पाठवत आहे...`);
    try {
      const res = await globalPrinterManager.printDirectDeviceTestSlip(
        dev,
        generatePrinterTestHtml
      );
      if (res.success) {
        showToast(`✅ ${dev.name} वर चाचणी पावती पाठवली! (${res.message || "Success"})`);
      } else {
        showToast(`❌ चाचणी अयशस्वी: ${res.message || "Failed"}`);
      }
    } catch (err: any) {
      showToast(`❌ एरर: ${err?.message || "Test print failed"}`);
    }
  };

  // Toggle Automation Switches
  const handleToggleAutomation = (key: keyof PrinterSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    store.updatePrinterSettings(updated);
    showToast("ऑटोमेशन सेटिंग्ज अपडेट केल्या!");
  };

  const queuedCount = jobs.filter((j) => j.status === "QUEUED" || j.status === "PRINTING" || j.status === "RETRYING").length;
  const failedCount = jobs.filter((j) => j.status === "FAILED").length;

  // Active Android Printing Mode Flags
  const isAndroidSystemActive = devices.some(
    (d) => d.isEnabled && d.isDefaultReceiptPrinter && d.connectionType === "BROWSER_SYSTEM"
  );
  const isRawBtActive = devices.some(
    (d) => d.isEnabled && d.isDefaultReceiptPrinter && d.connectionType === "RAWBT"
  );
  const isWifiActive = devices.some(
    (d) => d.isEnabled && d.isDefaultReceiptPrinter && d.connectionType === "NETWORK"
  );

  // 1-Click Quick Setup Handlers
  const handleActivateAndroidSystemPrint = () => {
    const dev = globalPrinterManager.activateAndroidSystemPrint(settings.paperWidth || "80mm");
    const updatedDevs = [
      dev,
      ...devices
        .filter((d) => d.id !== dev.id)
        .map((d) => ({ ...d, isDefaultReceiptPrinter: false, isDefaultKotPrinter: false })),
    ];
    setDevices(updatedDevs);
    const updatedSettings = { ...settings, devices: updatedDevs };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);
    showToast("✅ Android सिस्टीम प्रिंट चालू केले! (Android System Print Activated)");
  };

  const handleActivateAndroidRawBtPrint = () => {
    const dev = globalPrinterManager.activateAndroidRawBtPrint(settings.paperWidth || "80mm");
    const updatedDevs = [
      dev,
      ...devices
        .filter((d) => d.id !== dev.id)
        .map((d) => ({ ...d, isDefaultReceiptPrinter: false, isDefaultKotPrinter: false })),
    ];
    setDevices(updatedDevs);
    const updatedSettings = { ...settings, devices: updatedDevs };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);
    showToast("⚡ RawBT ब्लूटूथ प्रिंटर चालू केला! (RawBT Activated)");
  };

  // Auto-scan local network for POSIFLOW KP307-UEWB (port 9100)
  const handleAutoScanNetwork = async () => {
    setIsScanningWifi(true);
    setWifiPingStatus(null);
    showToast("🔍 वाय-फायवर KP307 प्रिंटर शोधत आहे...");
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
        "192.168.1.101",
      ];
      const found = await globalPrinterManager.scanNetworkPrinters(candidates);
      setFoundPrinters(found);
      if (found.length > 0) {
        setQuickWifiIp(found[0].ip);
        setWifiPingStatus({
          online: true,
          message: `सापडला! (${found[0].latencyMs ? `${found[0].latencyMs}ms` : "Active"})`,
          latencyMs: found[0].latencyMs,
        });
        showToast(`✅ KP307 प्रिंटर सापडला: ${found[0].ip}!`);
      } else {
        showToast("⚠️ वाय-फायवर प्रिंटर सापडला नाही. कृपया FEED दाबून IP तपासा किंवा मॅन्युअली IP टाका.");
      }
    } catch {
      showToast("⚠️ स्कॅनिंग अयशस्वी. कृपया मॅन्युअली IP टाका.");
    } finally {
      setIsScanningWifi(false);
    }
  };

  // Ping test the current quickWifiIp
  const handlePingWifi = async () => {
    if (!quickWifiIp.trim()) {
      showToast("कृपया IP पत्ता टाका");
      return;
    }
    setIsPingingWifi(true);
    try {
      const res = await fetch(`/api/print/network?ip=${encodeURIComponent(quickWifiIp.trim())}&port=9100&timeoutMs=2500`);
      const data = await res.json();
      if (data.online) {
        setWifiPingStatus({
          online: true,
          message: `जोडणी यशस्वी (${data.latencyMs}ms)`,
          latencyMs: data.latencyMs,
        });
        showToast(`✅ प्रिंटर ऑनलाइन आहे! (${data.latencyMs}ms)`);
      } else {
        setWifiPingStatus({
          online: false,
          message: `संपर्क होऊ शकला नाही (${data.error || "Offline"})`,
        });
        showToast(`❌ संपर्क अयशस्वी: ${data.error || "Offline"}`);
      }
    } catch (err: any) {
      setWifiPingStatus({
        online: false,
        message: err?.message || "Ping error",
      });
      showToast(`❌ एरर: ${err?.message || "Ping error"}`);
    } finally {
      setIsPingingWifi(false);
    }
  };

  // Modal Auto-Scan
  const handleModalAutoScan = async () => {
    setIsModalScanning(true);
    setModalPingStatus(null);
    showToast("🔍 नेटवर्कवर KP307 शोधत आहे...");
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
        setFormData((prev) => ({ ...prev, ipAddress: found[0].ip }));
        setModalPingStatus({
          online: true,
          message: `प्रिंटर सापडला (${found[0].latencyMs ? `${found[0].latencyMs}ms` : "Active"})`,
          latencyMs: found[0].latencyMs,
        });
        showToast(`✅ प्रिंटर सापडला: ${found[0].ip}!`);
      } else {
        showToast("⚠️ वाय-फायवर प्रिंटर सापडला नाही. मॅन्युअली IP टाका.");
      }
    } catch {
      showToast("⚠️ स्कॅनिंग अयशस्वी.");
    } finally {
      setIsModalScanning(false);
    }
  };

  // Modal Ping Test
  const handleModalPing = async () => {
    if (!formData.ipAddress.trim()) {
      showToast("कृपया IP पत्ता टाका");
      return;
    }
    setIsModalPinging(true);
    try {
      const res = await fetch(
        `/api/print/network?ip=${encodeURIComponent(formData.ipAddress.trim())}&port=${formData.port || 9100}&timeoutMs=2500`
      );
      const data = await res.json();
      if (data.online) {
        setModalPingStatus({
          online: true,
          message: `जोडणी चालू आहे (${data.latencyMs}ms)`,
          latencyMs: data.latencyMs,
        });
        showToast(`✅ प्रिंटर ऑनलाइन आहे! (${data.latencyMs}ms)`);
      } else {
        setModalPingStatus({
          online: false,
          message: `ऑफलाइन (${data.error || "Cannot connect"})`,
        });
        showToast(`❌ संपर्क अयशस्वी: ${data.error || "Offline"}`);
      }
    } catch (err: any) {
      setModalPingStatus({
        online: false,
        message: err?.message || "Ping error",
      });
      showToast(`❌ एरर: ${err?.message || "Ping error"}`);
    } finally {
      setIsModalPinging(false);
    }
  };

  const handleActivateWifiNetworkPrint = () => {
    if (!quickWifiIp.trim()) {
      showToast("कृपया वाय-फाय IP टाका (Enter IP)");
      return;
    }
    const dev = globalPrinterManager.activateWifiNetworkPrint(quickWifiIp.trim(), settings.paperWidth || "80mm");
    const updatedDevs = [
      dev,
      ...devices
        .filter((d) => d.id !== dev.id)
        .map((d) => ({ ...d, isDefaultReceiptPrinter: false, isDefaultKotPrinter: false })),
    ];
    setDevices(updatedDevs);
    const updatedSettings = { ...settings, devices: updatedDevs };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);
    setWifiPingStatus({
      online: true,
      message: "सक्रिय मुख्य प्रिंटर (Universal Default)",
    });
    showToast(`⭐ वाय-फाय प्रिंटर (${quickWifiIp.trim()}) सर्व बिल व KOT साठी मुख्य प्रिंटर झाला!`);
  };

  const handleQuickTestPrint = async (type: "SYSTEM" | "RAWBT" | "WIFI") => {
    try {
      setIsTestingQuick(true);
      showToast("चाचणी पावती पाठवत आहे...");
      let targetDev: PrinterDevice;
      if (type === "SYSTEM") {
        targetDev = devices.find((d) => d.connectionType === "BROWSER_SYSTEM") || {
          id: "temp-sys",
          name: "Android System Print",
          connectionType: "BROWSER_SYSTEM",
          paperWidth: settings.paperWidth || "80mm",
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: false,
        };
      } else if (type === "RAWBT") {
        targetDev = devices.find((d) => d.connectionType === "RAWBT") || {
          id: "temp-rawbt",
          name: "RawBT Android Print",
          connectionType: "RAWBT",
          rawbtMethod: "INTENT",
          paperWidth: settings.paperWidth || "80mm",
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: true,
        };
      } else {
        targetDev = devices.find((d) => d.connectionType === "NETWORK") || {
          id: "temp-wifi",
          name: `Wi-Fi (${quickWifiIp})`,
          connectionType: "NETWORK",
          ipAddress: quickWifiIp.trim() || "192.168.1.50",
          port: 9100,
          paperWidth: settings.paperWidth || "80mm",
          isEnabled: true,
          status: "ONLINE",
          assignedStations: ["CASHIER", "MAIN_KITCHEN"],
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          autoCut: true,
          openDrawerOnPrint: true,
        };
      }

      const res = await globalPrinterManager.printDirectDeviceTestSlip(targetDev, generatePrinterTestHtml);
      if (res.success) {
        showToast(`✅ चाचणी पावती पाठवली! (${res.message || "Success"})`);
      } else {
        showToast(`❌ चाचणी अयशस्वी: ${res.message || "Failed"}`);
      }
    } catch (err: any) {
      showToast(`❌ एरर: ${err?.message || "Failed"}`);
    } finally {
      setIsTestingQuick(false);
    }
  };

  // 1-Click Set any printer as Universal Default for all Bills & KOTs
  const handleSetAsDefaultAll = (targetDev: PrinterDevice) => {
    const updatedDevs = devices.map((d) => {
      if (d.id === targetDev.id) {
        return {
          ...d,
          isDefaultReceiptPrinter: true,
          isDefaultKotPrinter: true,
          isEnabled: true,
          assignedStations: [
            "CASHIER",
            "MAIN_KITCHEN",
            "THALI_SECTION",
            "TANDOOR_BHAKRI",
            "FRY_SECTION",
            "BEVERAGE_DESSERT",
          ],
        };
      }
      return {
        ...d,
        isDefaultReceiptPrinter: false,
        isDefaultKotPrinter: false,
      };
    });

    setDevices(updatedDevs);
    const updatedSettings = { ...settings, devices: updatedDevs };
    setSettings(updatedSettings);
    store.updatePrinterSettings(updatedSettings);
    showToast(`⭐ '${targetDev.name}' आता सर्व बिल व KOT साठी मुख्य प्रिंटर झाला!`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-stone-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900">
              प्रिंटर व्यवस्थापन व हार्डवेअर (Printer Management)
            </h1>
            <span className="bg-red-100 text-red-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-red-200">
              POSIFLOW KP307-UEWB Certified
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            वाय-फाय, ब्लूटूथ व सिरीयल थर्मल प्रिंटर्स, KOT स्टेशन राउटिंग व ऑटो-कट सेटिंग्ज
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Spooler Queue Button */}
          <button
            type="button"
            onClick={() => setIsQueueOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold shadow-2xs transition-all flex items-center gap-2 active:scale-95"
          >
            <Clock className="w-4 h-4 text-stone-500" />
            <span>प्रिंट रांग (Queue)</span>
            {queuedCount > 0 ? (
              <span className="bg-amber-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {queuedCount}
              </span>
            ) : failedCount > 0 ? (
              <span className="bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full">
                {failedCount} Offline
              </span>
            ) : null}
          </button>

          {/* Add Printer Button */}
          <button
            type="button"
            onClick={() => handleOpenAddModal("POSIFLOW_WIFI")}
            className="px-4 py-2 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white rounded-xl text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>+ प्रिंटर जोडा (Add Printer)</span>
          </button>
        </div>
      </div>

      {/* 📱 मोबाईल व ऑनलाइन प्रिंटर सोपे सेटअप (Mobile & Online Printer Hub) */}
      <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white shadow-xl border border-stone-700/80 space-y-5">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  मोबाईल व टॅबलेट प्रिंटर सेटअप (Mobile Printer Hub)
                </h2>
                <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  POSIFLOW KP307-UEWB
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Android फोन, iPhone किंवा टॅबलेटवरून थेट प्रिंटिंगसाठी सोपे पर्याय
              </p>
            </div>
          </div>

          {/* Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowStepGuide(!showStepGuide)}
            className="self-start sm:self-auto text-xs text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1.5 bg-stone-800/90 px-3.5 py-1.5 rounded-xl border border-stone-700 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showStepGuide ? "मार्गदर्शन लपवा" : "मदत व सूचना (Guide)"}</span>
            {showStepGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Tab Selection: Wi-Fi Online vs Direct Bluetooth */}
        <div className="flex items-center gap-2 border-b border-stone-700/70 pb-3">
          <button
            type="button"
            onClick={() => setMobileSetupTab("WIFI")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              mobileSetupTab === "WIFI"
                ? "bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20"
                : "bg-stone-800/80 text-stone-300 hover:bg-stone-700/80"
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>🌐 हॉटेल वाय-फाय / ऑनलाइन (Wi-Fi Online - शिफारस)</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileSetupTab("BLUETOOTH")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              mobileSetupTab === "BLUETOOTH"
                ? "bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20"
                : "bg-stone-800/80 text-stone-300 hover:bg-stone-700/80"
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            <span>📱 फोन थेट ब्लूटूथ (Bluetooth Direct)</span>
          </button>
        </div>

        {/* TAB 1: Wi-Fi / Online Print Setup */}
        {mobileSetupTab === "WIFI" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Step-by-Step Visual: How to find Printer IP Online */}
            {showStepGuide && (
              <div className="p-4 rounded-2xl bg-stone-950/70 border border-amber-500/30 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>प्रिंटरचा IP पत्ता कसा शोधायचा? (Find KP307-UEWB IP Online):</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Self-Test Method</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी १: स्विच बंद करा</span>
                    <p className="text-stone-400">
                      प्रिंटरचा मुख्य पॉवर स्विच <strong>OFF (बंद)</strong> करा. कागदाचा रोल व्यवस्थित असल्याची खात्री करा.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी २: FEED बटन दाबा</span>
                    <p className="text-stone-400">
                      समोरील <strong>FEED बटण दाबून ठेवा</strong> आणि त्याच वेळी पॉवर स्विच <strong>ON (चालू)</strong> करा.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी ३: २ सेकंदांनंतर सोडा</span>
                    <p className="text-stone-400">
                      २ सेकंदांनी FEED बटन सोडा. प्रिंटर आपोआप <strong>Self-Test स्लिप</strong> बाहेर काढेल.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी ४: IP पत्ता वाचा</span>
                    <p className="text-stone-400">
                      स्लिपवर खाली छापलेला <strong>IP Address</strong> (उदा. 192.168.1.100) खालील बॉक्समध्ये टाका.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scanner & Presets Box */}
            <div className="p-4 rounded-2xl bg-stone-800/80 border border-stone-700 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-amber-400" />
                    <span>हॉटेल वाय-फाय नेटवर्क प्रिंटर (POSIFLOW KP307-UEWB)</span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    सर्व Android फोन, iPhone व काऊंटर कॉम्प्युटर एकाच प्रिंटरवर एकाच वेळी चालतात.
                  </p>
                </div>

                {/* Auto-Scan Button */}
                <button
                  type="button"
                  onClick={handleAutoScanNetwork}
                  disabled={isScanningWifi}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningWifi ? "animate-spin" : ""}`} />
                  <span>{isScanningWifi ? "स्कॅन करत आहे..." : "🔍 आपोआप KP307 शोधा (Auto-Scan)"}</span>
                </button>
              </div>

              {/* Found Printers Announcement */}
              {foundPrinters.length > 0 && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>नेटवर्कवर प्रिंटर सापडला: <strong>{foundPrinters[0].ip}</strong> (Latency: {foundPrinters[0].latencyMs}ms)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickWifiIp(foundPrinters[0].ip);
                      handlePingWifi();
                    }}
                    className="px-2 py-0.5 bg-emerald-500 text-stone-950 font-bold rounded-lg text-[10px]"
                  >
                    हा IP वापरा
                  </button>
                </div>
              )}

              {/* Quick Presets Row */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-stone-400 block">
                  सामान्य IP पत्ते (Quick Subnet Presets):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    "192.168.1.100",
                    "192.168.1.87",
                    "192.168.1.50",
                    "192.168.0.100",
                    "192.168.29.100",
                    "192.168.31.100",
                  ].map((presetIp) => (
                    <button
                      key={presetIp}
                      type="button"
                      onClick={() => {
                        setQuickWifiIp(presetIp);
                        setWifiPingStatus(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
                        quickWifiIp === presetIp
                          ? "bg-amber-400 text-stone-950 border-amber-400"
                          : "bg-stone-900/90 text-stone-300 border-stone-700 hover:border-stone-500"
                      }`}
                    >
                      {presetIp}
                    </button>
                  ))}
                </div>
              </div>

              {/* IP Input, Ping & Test Actions */}
              <div className="pt-2 border-t border-stone-700/60 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={quickWifiIp}
                      onChange={(e) => {
                        setQuickWifiIp(e.target.value);
                        setWifiPingStatus(null);
                      }}
                      placeholder="उदा. 192.168.1.100"
                      className="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-600 rounded-xl text-xs font-mono font-bold text-white placeholder-stone-500 focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-[11px] font-mono text-stone-500 font-bold">
                      :9100
                    </span>
                  </div>

                  {/* Ping Test Button */}
                  <button
                    type="button"
                    onClick={handlePingWifi}
                    disabled={isPingingWifi}
                    className="px-3.5 py-2.5 bg-stone-700 hover:bg-stone-600 active:scale-95 text-stone-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Radio className={`w-3.5 h-3.5 text-amber-400 ${isPingingWifi ? "animate-pulse" : ""}`} />
                    <span>{isPingingWifi ? "तपासत आहे..." : "📶 पिंग तपासा (Ping)"}</span>
                  </button>

                  {/* Test Slip Print */}
                  <button
                    type="button"
                    onClick={() => handleQuickTestPrint("WIFI")}
                    disabled={isTestingQuick}
                    className="px-3.5 py-2.5 bg-stone-700 hover:bg-stone-600 active:scale-95 text-stone-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>📄 टेस्ट पावती (Test Slip)</span>
                  </button>
                </div>

                {/* Live Ping Status Badge */}
                {wifiPingStatus && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      wifiPingStatus.online
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-red-500/10 border-red-500/40 text-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {wifiPingStatus.online ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span>
                        {wifiPingStatus.online
                          ? `🟢 प्रिंटर ऑनलाइन आहे! (${wifiPingStatus.latencyMs ? `${wifiPingStatus.latencyMs}ms` : "Active"}) - Port 9100 तयार`
                          : `🔴 ${wifiPingStatus.message || "संपर्क अयशस्वी"}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* 1-Click Set as Universal Default for All Bills & KOT */}
                <button
                  type="button"
                  onClick={handleActivateWifiNetworkPrint}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-300 text-stone-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-current text-stone-950" />
                  <span>⭐ सर्व फोन व बिलांसाठी हाच मुख्य प्रिंटर बनवा (Make Universal Default)</span>
                </button>
              </div>
            </div>

            {/* Helper: Printer Web Firmware Portal */}
            <div className="p-3.5 bg-stone-950/60 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-stone-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>प्रिंटरला हॉटेलच्या नवीन Wi-Fi शी कनेक्ट करायचे आहे का? (Wi-Fi Setup Portal)</span>
                </span>
                <p className="text-[11px] text-stone-400">
                  प्रिंटरचे वेब पेज उघडा ➔ लॉगिन: <strong>admin</strong> | पासवर्ड: <strong>password</strong> किंवा <strong>123456</strong> ➔ Wireless Settings मध्ये Wi-Fi पासवर्ड टाका.
                </p>
              </div>
              <a
                href={`http://${quickWifiIp || "192.168.1.100"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shrink-0 border border-stone-700 transition-all cursor-pointer"
              >
                <span>प्रिंटर वेब पेज उघडा</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* TAB 2: Direct Bluetooth Print Setup */}
        {mobileSetupTab === "BLUETOOTH" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Bluetooth Step Guide */}
            {showStepGuide && (
              <div className="p-4 rounded-2xl bg-stone-950/70 border border-stone-800 text-xs space-y-2.5">
                <span className="font-black text-amber-300 block">
                  💡 Android फोन ब्लूटूथ पेअरिंग कसे करावे? (Bluetooth Pairing Guide):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी १: फोन ब्लूटूथ चालू करा</span>
                    <p className="text-stone-400">
                      फोनच्या <strong>Settings ➔ Bluetooth</strong> मध्ये जा आणि ब्लूटूथ ऑन करा.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी २: KP307-UEWB पेअर करा</span>
                    <p className="text-stone-400">
                      &apos;Pair new device&apos; दाबा, प्रिंटरचे नाव निवडा. पिन कोड <strong>0000</strong> किंवा <strong>1234</strong> टाका.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 space-y-1">
                    <span className="font-black text-amber-400 block">पायरी ३: खालील बटण दाबा</span>
                    <p className="text-stone-400">
                      कोणतेही ॲप नको असल्यास <strong>&apos;Android सिस्टीम&apos;</strong> किंवा जलद ०.१ सेकंद प्रिंटसाठी <strong>&apos;RawBT&apos;</strong> चालू करा.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2 Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Card 1: Android System Print */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isAndroidSystemActive
                    ? "bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30"
                    : "bg-stone-800/80 border-stone-700 hover:border-stone-600"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm text-white">१. Android सिस्टीम प्रिंट</h3>
                    </div>
                    {isAndroidSystemActive && (
                      <span className="bg-emerald-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> सक्रिय (Active)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-300 leading-normal">
                    <strong>सर्वात सोपे!</strong> कोणतेही नवीन ॲप नको. फोनच्या Bluetooth Settings मध्ये पेअर करून थेट प्रिंट डायलॉगवरून प्रिंट करा.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-700/60">
                  <button
                    type="button"
                    onClick={handleActivateAndroidSystemPrint}
                    className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isAndroidSystemActive ? "सध्या सक्रिय आहे ✓" : "हे चालू करा (Set Default)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickTestPrint("SYSTEM")}
                    disabled={isTestingQuick}
                    className="w-full py-1.5 px-3 bg-stone-700/70 hover:bg-stone-700 active:scale-95 text-stone-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    <span>📄 पावती चाचणी प्रिंट (Test Slip)</span>
                  </button>
                </div>
              </div>

              {/* Card 2: RawBT Instant Print */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isRawBtActive
                    ? "bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/30"
                    : "bg-stone-800/80 border-stone-700 hover:border-stone-600"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm text-white">२. RawBT ब्लूटूथ प्रिंट</h3>
                    </div>
                    {isRawBtActive && (
                      <span className="bg-emerald-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> सक्रिय (Active)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-300 leading-normal">
                    <strong>सुपरफास्ट ०.१ सेकंद!</strong> डायलॉगशिवाय थेट ब्लूटूथवर आपोआप पावती प्रिंट होते.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-700/60">
                  <button
                    type="button"
                    onClick={handleActivateAndroidRawBtPrint}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 active:scale-95 text-stone-950 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isRawBtActive ? "RawBT सक्रिय आहे ✓" : "RawBT चालू करा (Activate)"}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickTestPrint("RAWBT")}
                      disabled={isTestingQuick}
                      className="py-1.5 px-2 bg-stone-700/70 hover:bg-stone-700 active:scale-95 text-stone-200 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-stone-400" />
                      <span>⚡ टेस्ट</span>
                    </button>

                    <a
                      href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-stone-700/70 hover:bg-stone-700 active:scale-95 text-amber-300 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Play Store</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printer Fleet Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-stone-500">
            कॉन्फिगर केलेले प्रिंटर ({devices.length})
          </h2>
          <span className="text-[11px] text-stone-400">
            डिफॉल्ट बिल: <strong>{devices.find((d) => d.isDefaultReceiptPrinter)?.name || "Not set"}</strong> | KOT: <strong>{devices.find((d) => d.isDefaultKotPrinter)?.name || "Not set"}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((dev) => {
            const ping = pingResults[dev.id];
            const isTesting = testingDeviceId === dev.id;

            return (
              <div
                key={dev.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 shadow-2xs bg-white ${
                  dev.isDefaultReceiptPrinter || dev.isDefaultKotPrinter
                    ? "border-red-300/80 ring-1 ring-red-400/20"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                {/* Header: Type icon, Name, Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-stone-100 text-stone-700 shrink-0 mt-0.5">
                      {dev.connectionType === "NETWORK" && <Wifi className="w-5 h-5 text-blue-600" />}
                      {dev.connectionType === "BLUETOOTH_SPP" && <Bluetooth className="w-5 h-5 text-indigo-600" />}
                      {dev.connectionType === "BLUETOOTH_BLE" && <Bluetooth className="w-5 h-5 text-purple-600" />}
                      {dev.connectionType === "BLUETOOTH" && <Bluetooth className="w-5 h-5 text-indigo-600" />}
                      {dev.connectionType === "SERIAL_USB" && <Laptop className="w-5 h-5 text-amber-600" />}
                      {dev.connectionType === "BROWSER_SYSTEM" && <Printer className="w-5 h-5 text-stone-700" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-stone-900 truncate">
                        {dev.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-mono font-bold">
                          {dev.paperWidth}
                        </span>
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-bold">
                          {dev.connectionType.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col items-end gap-1">
                    {dev.isDefaultReceiptPrinter && (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                        काऊंटर बिल (Bill)
                      </span>
                    )}
                    {dev.isDefaultKotPrinter && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                        किचन KOT
                      </span>
                    )}
                  </div>
                </div>

                {/* Connection Details Box */}
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7E2DA] space-y-1.5 text-xs text-stone-600">
                  {dev.connectionType === "NETWORK" && (
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-stone-400">IP & Port:</span>
                      <span className="font-bold text-stone-900">
                        {dev.ipAddress || "192.168.1.50"}:{dev.port || 9100}
                      </span>
                    </div>
                  )}
                  {(dev.connectionType === "BLUETOOTH_SPP" || dev.connectionType === "BLUETOOTH_BLE" || dev.connectionType === "BLUETOOTH") && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">BT Device:</span>
                      <span className="font-bold text-stone-900 truncate max-w-[160px]">
                        {dev.bluetoothDeviceName || "KP307-UEWB"}
                      </span>
                    </div>
                  )}
                  {dev.connectionType === "SERIAL_USB" && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">COM Port:</span>
                      <span className="font-bold text-stone-900">
                        {dev.serialPortName || "COM3"} ({dev.baudRate || 9600} bps)
                      </span>
                    </div>
                  )}
                  {dev.connectionType === "BROWSER_SYSTEM" && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">Driver:</span>
                      <span className="font-bold text-emerald-700">Native OS / Zero-Fail Fallback</span>
                    </div>
                  )}

                  {/* Station badges */}
                  {dev.assignedStations && dev.assignedStations.length > 0 && (
                    <div className="pt-1 border-t border-stone-200/60 flex items-center gap-1 flex-wrap text-[10px]">
                      <span className="text-stone-400 font-bold">स्टेशन:</span>
                      {dev.assignedStations.map((st) => (
                        <span key={st} className="bg-stone-200/70 text-stone-700 px-1.5 py-0.2 rounded font-medium">
                          {st.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Failover target */}
                  {dev.failoverPrinterId && (
                    <div className="text-[10px] text-stone-400 flex items-center gap-1 pt-0.5">
                      <span>बॅकअप / Failover:</span>
                      <span className="text-stone-700 font-bold">
                        {devices.find((d) => d.id === dev.failoverPrinterId)?.name || dev.failoverPrinterId}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ping Status Banner if tested */}
                {ping && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 ${
                      ping.online
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : "bg-red-50 text-red-900 border border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {ping.online ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span className="truncate">{ping.message}</span>
                    </div>
                    {ping.latencyMs && (
                      <span className="text-[10px] font-mono shrink-0 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                        {ping.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}

                {/* 1-Click Make Universal Default Button */}
                <div className="pt-2">
                  {dev.isDefaultReceiptPrinter && dev.isDefaultKotPrinter ? (
                    <div className="w-full py-2 px-3 bg-emerald-50 border border-emerald-300 text-emerald-900 font-black text-xs rounded-xl flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>मुख्य प्रिंटर: सर्व बिल व KOT यावरच प्रिंट होतील</span>
                      </span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-extrabold shrink-0">
                        सक्रिय ✓
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetAsDefaultAll(dev)}
                      className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-stone-950 font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>या प्रिंटरवर सर्व बिल व KOT चालू करा (Make Default)</span>
                    </button>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-stone-100 grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestConnection(dev)}
                    disabled={isTesting}
                    title="Ping Connection"
                    className="py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Wifi className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-blue-600" : ""}`} />
                    <span>Ping</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestPrint(dev)}
                    title="Print Diagnostic Test Slip"
                    className="py-2 rounded-xl bg-stone-900 hover:bg-black text-amber-200 text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>टेस्ट</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(dev)}
                    title="Edit Settings"
                    className="py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                    <span>बदला</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(dev.id, dev.name)}
                    title="Delete Printer"
                    className="py-2 rounded-xl border border-stone-200 hover:bg-red-50 hover:border-red-200 text-red-600 text-[11px] font-bold transition-all flex items-center justify-center active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Printing Automation Preferences */}
      <div className="premium-card p-5 sm:p-6 space-y-4">
        <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-black text-stone-900">
              ऑटोमेशन व सिस्टिम सेटिंग्ज (POS Print Automation)
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              ऑर्डर देताच KOT व बिल भरल्यावर ग्राहक पावती आपोआप पाठवण्याचे नियम
            </p>
          </div>
          <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold">
            हार्डवेअर रूल्स
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                ऑर्डर पाठवताच KOT आपोआप प्रिंट करा (Auto KOT)
              </span>
              <span className="text-[10px] text-stone-500">
                Dispatches ticket to Kitchen printer immediately on waiter submit
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPrintKotOnOrder}
              onChange={(e) => handleToggleAutomation("autoPrintKotOnOrder", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                बिल भरल्यावर पावती आपोआप प्रिंट करा (Auto Bill)
              </span>
              <span className="text-[10px] text-stone-500">
                Sends tax invoice to counter printer as soon as payment is settled
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPrintReceiptOnPayment}
              onChange={(e) => handleToggleAutomation("autoPrintReceiptOnPayment", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                कॅश भरल्यावर गल्ला उघडा (Cash Drawer Kick)
              </span>
              <span className="text-[10px] text-stone-500">
                Sends ESC/POS pulse (ESC p 0 25 250) to open mechanical cash drawer
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoKickCashDrawerOnCash}
              onChange={(e) => handleToggleAutomation("autoKickCashDrawerOnCash", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                मराठी देवनागरी हेडर (कोल्हापुरी खानावळ)
              </span>
              <span className="text-[10px] text-stone-500">
                Includes authentic Marathi Unicode restaurant header on tickets
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.printMarathiHeader}
              onChange={(e) => handleToggleAutomation("printMarathiHeader", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                स्टेशननुसार KOT स्प्लिट करा (Multi-Station KOT)
              </span>
              <span className="text-[10px] text-stone-500">
                Sends Bhakri items to Tandoor printer, Sukka to Fry printer, etc.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSplitKotByStation}
              onChange={(e) => handleToggleAutomation("autoSplitKotByStation", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/70 border border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors">
            <div>
              <span className="text-xs font-bold text-stone-800 block">
                दुबार प्रिंट संरक्षण (Duplicate Print Guard)
              </span>
              <span className="text-[10px] text-stone-500">
                Prevents accidental double printing within 60 seconds
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.duplicatePrintProtection ?? true}
              onChange={(e) => handleToggleAutomation("duplicatePrintProtection", e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* ADD / EDIT PRINTER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden text-stone-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/90 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-700 text-white flex items-center justify-center shadow-xs">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    {editingDevice ? "प्रिंटर कॉन्फिगरेशन बदला (Edit Printer)" : "नवीन प्रिंटर जोडा (Add Thermal Printer)"}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-medium">
                    POSIFLOW KP307-UEWB व ESC/POS थर्मल डिव्हाइस
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleSaveDevice} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Printer Name & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    प्रिंटर नाव (Printer Display Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="उदा. काऊंटर KP307-UEWB"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-900 focus:border-red-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    हार्डवेअर मॉडेल (Printer Model)
                  </label>
                  <input
                    type="text"
                    value={formData.modelName}
                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    placeholder="POSIFLOW KP307-UEWB"
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-medium text-stone-900 focus:border-red-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Connection Type */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  कनेक्शन प्रकार (Connection Mode) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "NETWORK" })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formData.connectionType === "NETWORK"
                        ? "bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-300/40"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <Wifi className="w-4 h-4 mb-1 text-blue-600" />
                    <div className="text-xs">Wi-Fi / LAN IP</div>
                    <div className="text-[10px] text-stone-500 font-normal">Port 9100 (शिफारस)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "BLUETOOTH_SPP" })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formData.connectionType === "BLUETOOTH_SPP"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-2 ring-indigo-300/40"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <Bluetooth className="w-4 h-4 mb-1 text-indigo-600" />
                    <div className="text-xs">Android BT SPP</div>
                    <div className="text-[10px] text-stone-500 font-normal">Classic RFCOMM</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "BLUETOOTH_BLE" })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formData.connectionType === "BLUETOOTH_BLE"
                        ? "bg-purple-50 border-purple-500 text-purple-950 font-bold ring-2 ring-purple-300/40"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <Bluetooth className="w-4 h-4 mb-1 text-purple-600" />
                    <div className="text-xs">iOS BT BLE</div>
                    <div className="text-[10px] text-stone-500 font-normal">Low Energy GATT</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "SERIAL_USB" })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formData.connectionType === "SERIAL_USB"
                        ? "bg-amber-50 border-amber-500 text-amber-950 font-bold ring-2 ring-amber-300/40"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <Laptop className="w-4 h-4 mb-1 text-amber-600" />
                    <div className="text-xs">USB / Serial COM</div>
                    <div className="text-[10px] text-stone-500 font-normal">Desktop Terminal</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, connectionType: "BROWSER_SYSTEM" })}
                    className={`p-2.5 rounded-xl border text-left transition-all col-span-2 sm:col-span-1 ${
                      formData.connectionType === "BROWSER_SYSTEM"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-300/40"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <Printer className="w-4 h-4 mb-1 text-emerald-600" />
                    <div className="text-xs">System Print</div>
                    <div className="text-[10px] text-stone-500 font-normal">Universal Fallback</div>
                  </button>
                </div>
              </div>

              {/* Dynamic Connection Fields */}
              {formData.connectionType === "NETWORK" && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-950 block">
                      प्रिंटर IP पत्ता (Printer IP) *
                    </label>
                    <button
                      type="button"
                      onClick={handleModalAutoScan}
                      disabled={isModalScanning}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isModalScanning ? "animate-spin" : ""}`} />
                      <span>{isModalScanning ? "शोधत आहे..." : "🔍 आपोआप शोधा"}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        required
                        value={formData.ipAddress}
                        onChange={(e) => {
                          setFormData({ ...formData, ipAddress: e.target.value });
                          setModalPingStatus(null);
                        }}
                        placeholder="192.168.1.100"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:border-blue-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                          placeholder="9100"
                          className="w-full rounded-xl border border-stone-300 bg-white px-2 py-2 text-xs font-mono font-bold text-stone-900 focus:border-blue-600 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={handleModalPing}
                          disabled={isModalPinging}
                          title="Ping Test"
                          className="p-2 bg-stone-200 hover:bg-stone-300 active:scale-95 text-stone-800 rounded-xl text-xs font-bold cursor-pointer shrink-0"
                        >
                          <Radio className={`w-3.5 h-3.5 ${isModalPinging ? "animate-pulse text-blue-600" : ""}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subnet Chips */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 block">पटकन निवडा (Presets):</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {["192.168.1.100", "192.168.1.87", "192.168.1.50", "192.168.0.100", "192.168.29.100"].map((ip) => (
                        <button
                          key={ip}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, ipAddress: ip });
                            setModalPingStatus(null);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                            formData.ipAddress === ip
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-stone-700 border-stone-300 hover:border-stone-400"
                          }`}
                        >
                          {ip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ping Status inside Modal */}
                  {modalPingStatus && (
                    <div
                      className={`p-2 rounded-xl border text-[11px] flex items-center gap-1.5 ${
                        modalPingStatus.online
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-red-50 border-red-300 text-red-800"
                      }`}
                    >
                      {modalPingStatus.online ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      )}
                      <span>{modalPingStatus.message}</span>
                    </div>
                  )}

                  <p className="text-[10px] text-blue-900/80 leading-relaxed">
                    💡 <strong>IP शोधण्याची सोपी पद्धत:</strong> प्रिंटर स्विच बंद करा ➔ समोरील <strong>FEED बटण दाबून धरून</strong> चालू करा ➔ २ सेकंदांनी सोडा. पावतीवर IP पत्ता दिसेल.
                  </p>
                </div>
              )}

              {(formData.connectionType === "BLUETOOTH_SPP" || formData.connectionType === "BLUETOOTH_BLE" || formData.connectionType === "BLUETOOTH") && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-indigo-950 block mb-1">
                        ब्लूटूथ नाव (Broadcast Name)
                      </label>
                      <input
                        type="text"
                        value={formData.bluetoothDeviceName}
                        onChange={(e) => setFormData({ ...formData, bluetoothDeviceName: e.target.value })}
                        placeholder="KP307-UEWB"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-900 focus:border-indigo-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-indigo-950 block mb-1">
                        डिफॉल्ट पिन (Default PIN)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value="0000 / 1234"
                        className="w-full rounded-xl border border-stone-200 bg-stone-100 px-3 py-2 text-xs font-mono text-stone-600"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-indigo-900/80">
                    💡 Android फोनच्या Settings मधून <strong>KP307-UEWB</strong> पेअर करा (PIN: 0000 किंवा 1234).
                  </p>
                </div>
              )}

              {formData.connectionType === "SERIAL_USB" && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-amber-950 block mb-1">
                        सिरीयल COM पोर्ट (COM Port)
                      </label>
                      <input
                        type="text"
                        value={formData.serialPortName}
                        onChange={(e) => setFormData({ ...formData, serialPortName: e.target.value })}
                        placeholder="COM3"
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:border-amber-600 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-amber-950 block mb-1">
                        बाउड रेट (Baud Rate)
                      </label>
                      <select
                        value={formData.baudRate}
                        onChange={(e) => setFormData({ ...formData, baudRate: Number(e.target.value) })}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:border-amber-600 focus:outline-hidden"
                      >
                        <option value="9600">9600 (डिफॉल्ट)</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="115200">115200</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-900/80">
                    💻 हे सेटिंग फक्त Windows / Desktop कॉम्प्युटरवरील USB केबलसाठी आहे. मोबाईलवर हे चालत नाही.
                  </p>
                </div>
              )}

              {/* Paper Roll Size */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  कागदाचा आकार (Paper Width)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paperWidth: "80mm" })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formData.paperWidth === "80mm"
                        ? "bg-stone-900 text-white border-stone-900 font-bold shadow-xs"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <div className="text-xs font-black">80mm Standard POS</div>
                    <div className={`text-[10px] ${formData.paperWidth === "80mm" ? "text-stone-300" : "text-stone-400"}`}>
                      3-इंच काऊंटर बिल (POSIFLOW KP307-UEWB)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, paperWidth: "58mm" })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formData.paperWidth === "58mm"
                        ? "bg-stone-900 text-white border-stone-900 font-bold shadow-xs"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <div className="text-xs font-black">58mm Compact POS</div>
                    <div className={`text-[10px] ${formData.paperWidth === "58mm" ? "text-stone-300" : "text-stone-400"}`}>
                      2-इंच पोर्टेबल हॅन्डहेल्ड बिल
                    </div>
                  </button>
                </div>
              </div>

              {/* Roles: Default Receipt vs Default KOT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 bg-stone-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefaultReceiptPrinter}
                    onChange={(e) => setFormData({ ...formData, isDefaultReceiptPrinter: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      मुख्य बिल प्रिंटर (Default Bill)
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Receives customer tax invoices
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 bg-stone-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefaultKotPrinter}
                    onChange={(e) => setFormData({ ...formData, isDefaultKotPrinter: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">
                      मुख्य किचन KOT प्रिंटर
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Receives kitchen order tickets
                    </span>
                  </div>
                </label>
              </div>

              {/* Station Routing Checkboxes */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  स्टेशन जबाबदारी (Assigned Stations)
                </label>
                <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  {STATION_OPTIONS.map((st) => {
                    const isSelected = formData.assignedStations.includes(st.code);
                    return (
                      <label key={st.code} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assignedStations: [...formData.assignedStations, st.code] });
                            } else {
                              setFormData({ ...formData, assignedStations: formData.assignedStations.filter((s) => s !== st.code) });
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="truncate">{st.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Hardware Features: Auto Cut, Cash Drawer Kick */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/60 cursor-pointer">
                  <span className="text-xs font-bold text-stone-800">कागद ऑटो-कट करा (Auto-Cut)</span>
                  <input
                    type="checkbox"
                    checked={formData.autoCut}
                    onChange={(e) => setFormData({ ...formData, autoCut: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/60 cursor-pointer">
                  <span className="text-xs font-bold text-stone-800">गल्ला उघडा (Open Cash Drawer)</span>
                  <input
                    type="checkbox"
                    checked={formData.openDrawerOnPrint}
                    onChange={(e) => setFormData({ ...formData, openDrawerOnPrint: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                  />
                </label>
              </div>

              {/* Failover / Backup Selection */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  बॅकअप प्रिंटर (Failover Printer if Offline)
                </label>
                <select
                  value={formData.failoverPrinterId}
                  onChange={(e) => setFormData({ ...formData, failoverPrinterId: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-red-600 focus:outline-hidden"
                >
                  <option value="">सिस्टीम प्रिंट डायलॉग (Browser Fallback)</option>
                  {devices
                    .filter((d) => d.id !== formData.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.connectionType})
                      </option>
                    ))}
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-red-700/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>जतन करा (Save Printer)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Print Queue Drawer */}
      <PrintQueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />
    </div>
  );
}
