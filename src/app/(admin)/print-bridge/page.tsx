"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Cloud,
  Printer,
  Wifi,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Terminal,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Send,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Cpu,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import {
  subscribeToPrintJobs,
  subscribeToBridgeStatus,
  isBridgeOnline,
  getActiveBridge,
  retryJob,
  cancelJob,
  clearCompletedJobs,
  enqueuePrintJob,
} from "@/lib/printing/cloud-print-queue";
import { buildDiagnosticTestEscPos } from "@/lib/printing/escpos-builder";
import type { CloudPrintJob, PrintBridgeHeartbeat } from "@/types/billing";

export default function PrintBridgeAdminPage() {
  const [bridges, setBridges] = useState<PrintBridgeHeartbeat[]>([]);
  const [jobs, setJobs] = useState<CloudPrintJob[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<
    "ALL" | "PENDING" | "CLAIMED" | "SUCCESS" | "FAILED" | "UNCERTAIN"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEnqueuingTest, setIsEnqueuingTest] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    const unsubJobs = subscribeToPrintJobs((updatedJobs) => {
      setJobs(updatedJobs);
    });

    const unsubBridges = subscribeToBridgeStatus((updatedBridges) => {
      setBridges(updatedBridges);
    });

    return () => {
      unsubJobs();
      unsubBridges();
    };
  }, []);

  const activeBridge = useMemo(() => getActiveBridge(bridges), [bridges]);
  const online = useMemo(() => isBridgeOnline(bridges), [bridges]);

  // Toast / feedback message auto-clear
  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Job filtering
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (selectedFilter !== "ALL" && job.status !== selectedFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title?.toLowerCase().includes(q);
        const matchStation = job.stationCode?.toLowerCase().includes(q);
        const matchCreator = job.createdByName?.toLowerCase().includes(q);
        const matchId = job.id?.toLowerCase().includes(q);
        return matchTitle || matchStation || matchCreator || matchId;
      }
      return true;
    });
  }, [jobs, selectedFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = jobs.length;
    const success = jobs.filter((j) => j.status === "SUCCESS").length;
    const pending = jobs.filter((j) => j.status === "PENDING" || j.status === "CLAIMED").length;
    const failed = jobs.filter((j) => j.status === "FAILED").length;
    const uncertain = jobs.filter((j) => j.status === "UNCERTAIN").length;
    return { total, success, pending, failed, uncertain };
  }, [jobs]);

  // Quick Action: Send diagnostic test slip
  const handleSendTestSlip = async () => {
    setIsEnqueuingTest(true);
    setActionMessage(null);
    try {
      const bytes = buildDiagnosticTestEscPos("POSIFLOW KP307-UEWB", "80mm");
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      await enqueuePrintJob({
        type: "TEST",
        title: `Bridge Diagnostic Slip (${new Date().toLocaleTimeString("en-IN")})`,
        stationCode: "CASHIER",
        payloadBase64: b64,
        paperWidth: "80mm",
        createdBy: "ADMIN",
        createdByName: "Admin Dashboard",
      });

      setActionMessage({
        type: "success",
        text: "✅ टेस्ट स्लिप क्लाउड रांगेत पाठवली! कॅशियर ब्रिज ती प्रिंट करेल.",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: `❌ टेस्ट प्रिंट अयशस्वी: ${err?.message || "Error"}`,
      });
    } finally {
      setIsEnqueuingTest(false);
    }
  };

  // Quick Action: Retry failed job
  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob(jobId);
      setActionMessage({
        type: "success",
        text: "🔄 जॉब पुन्हा रांगेत पाठवला (Retried to PENDING)",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: `पुन्हा प्रयत्न अयशस्वी: ${err?.message}`,
      });
    }
  };

  // Quick Action: Cancel pending job
  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      setActionMessage({
        type: "info",
        text: "प्रिंट जॉब रद्द केला (Cancelled)",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: `रद्द करणे अयशस्वी: ${err?.message}`,
      });
    }
  };

  // Quick Action: Clear 24h completed
  const handleClearCompleted = async () => {
    try {
      const count = await clearCompletedJobs();
      setActionMessage({
        type: "success",
        text: `झालेले ${count} जुने जॉब्स साफ केले (Cleaned up ${count} completed jobs)`,
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: `साफ करणे अयशस्वी: ${err?.message}`,
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 text-stone-100 animate-in fade-in duration-300">
      {/* Toast notification */}
      {actionMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold backdrop-blur-md animate-in slide-in-from-top-3 ${
            actionMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : actionMessage.type === "error"
              ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
              : "bg-amber-950/90 border-amber-500/40 text-amber-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : actionMessage.type === "error" ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/30">
              <Cloud className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                क्लाउड प्रिंट ब्रिज
                <span className="text-xs sm:text-sm font-bold text-amber-400 font-mono">
                  Cloud Print Queue
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-stone-400">
                मोबाईल फोनवरून दिलेली ऑर्डर्स हॉटेलच्या वाय-फाय वरील प्रिंटरवर थेट आपोआप छापली जातात.
              </p>
            </div>
          </div>
        </div>

        {/* Live Bridge Status Pill & Send Test Button */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
              online
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                : "bg-rose-950/80 border-rose-500/50 text-rose-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                online ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>{online ? "ब्रिज चालू (ONLINE)" : "ब्रिज बंद (OFFLINE)"}</span>
          </div>

          <button
            onClick={handleSendTestSlip}
            disabled={isEnqueuingTest}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 rounded-xl text-xs font-black shadow-lg shadow-amber-900/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isEnqueuingTest ? "पाठवत आहे..." : "टेस्ट स्लिप प्रिंट करा"}</span>
          </button>
        </div>
      </div>

      {/* Offline Warning Banner (if offline) */}
      {!online && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-bold">
                कॅशियर कॉम्प्युटरवरील प्रिंट ब्रिज बंद आहे (Print Bridge is Offline)
              </p>
              <p className="text-rose-300/80 text-[11px] mt-0.5">
                मोबाईलवरून पाठवलेले प्रिंट जॉब्स क्लाउड रांगेत (Queue) सुरक्षित राहतील आणि कॉम्प्युटरवर ब्रिज सुरू होताच आपोआप प्रिंट होतील.
              </p>
            </div>
          </div>
          <a
            href="#bridge-guide"
            className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800/80 border border-rose-500/40 text-rose-100 font-bold text-[11px] transition-all"
          >
            सुरू कसा करायचा? (Setup Guide) ↓
          </a>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800">
          <span className="text-[11px] text-stone-400 font-bold block">एकूण जॉब्स (Total)</span>
          <span className="text-2xl font-black text-white mt-1 block">{stats.total}</span>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800">
          <span className="text-[11px] text-emerald-400 font-bold block">छापलेले (Success)</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{stats.success}</span>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800">
          <span className="text-[11px] text-amber-400 font-bold block">प्रतिक्षेत (Pending/In-Flight)</span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{stats.pending}</span>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800">
          <span className="text-[11px] text-rose-400 font-bold block">अयशस्वी (Failed)</span>
          <span className="text-2xl font-black text-rose-400 mt-1 block">{stats.failed}</span>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900/70 border border-stone-800 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-orange-400 font-bold block">साशंक (Uncertain)</span>
          <span className="text-2xl font-black text-orange-400 mt-1 block">{stats.uncertain}</span>
        </div>
      </div>

      {/* Bridge Status & Diagnostic Card */}
      <div className="p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              सक्रिय प्रिंट ब्रिज तपशील (Bridge Instance Status)
            </h2>
          </div>
          {activeBridge && (
            <span className="text-[11px] font-mono text-stone-400">
              शेवटचा सिग्नल (Heartbeat):{" "}
              <b className="text-amber-300 font-semibold">
                {new Date(activeBridge.lastHeartbeat).toLocaleTimeString("en-IN")}
              </b>
            </span>
          )}
        </div>

        {activeBridge ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
              <span className="text-[10px] text-stone-500 font-bold uppercase">Bridge Host / ID</span>
              <p className="font-mono font-bold text-stone-200 mt-1 truncate">
                {activeBridge.hostname}
              </p>
              <p className="text-[10px] text-stone-500 font-mono truncate">{activeBridge.bridgeId}</p>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
              <span className="text-[10px] text-stone-500 font-bold uppercase">Version & Jobs</span>
              <p className="font-mono font-bold text-emerald-400 mt-1">
                v{activeBridge.version || "1.0.0"} • {activeBridge.jobsDelivered || 0} छापील बिल्स
              </p>
              <p className="text-[10px] text-stone-500">
                {activeBridge.lastJobAt
                  ? `Last job: ${new Date(activeBridge.lastJobAt).toLocaleTimeString("en-IN")}`
                  : "No jobs delivered yet"}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80 sm:col-span-2">
              <span className="text-[10px] text-stone-500 font-bold uppercase">
                स्थानिक प्रिंटर मॅपिंग (Station IP Mapping)
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                {activeBridge.printerMapping &&
                  Object.entries(activeBridge.printerMapping).map(([station, target]) => (
                    <span
                      key={station}
                      className="px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300"
                    >
                      <b className="text-amber-400">{station}:</b> {target.ip}:{target.port}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-stone-950/40 border border-stone-800/60 text-center text-xs text-stone-400">
            कोणताही प्रिंट ब्रिज सध्या जोडलेला नाही. खालील सूचना वापरून कॅशियर कॉम्प्युटरवर ब्रिज सुरू करा.
          </div>
        )}
      </div>

      {/* Live Print Queue Table */}
      <div className="p-5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-4">
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              प्रिंट रांग (Live Print Queue)
            </h2>
            <span className="text-xs text-stone-500">({filteredJobs.length} jobs)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="शोधा (Search)..."
                className="pl-8 pr-3 py-1.5 bg-stone-950 border border-stone-800 rounded-xl text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-400 w-44"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-[11px] font-bold">
              {(["ALL", "PENDING", "CLAIMED", "SUCCESS", "FAILED", "UNCERTAIN"] as const).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedFilter === filter
                        ? "bg-amber-400 text-stone-950 font-black shadow-sm"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    {filter}
                  </button>
                )
              )}
            </div>

            {/* Clear Completed Action */}
            <button
              onClick={handleClearCompleted}
              title="Clear jobs completed > 24 hours ago"
              className="p-1.5 text-stone-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl border border-stone-800 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto rounded-xl border border-stone-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 font-bold uppercase text-[10px]">
                <th className="p-3">स्थिती (Status)</th>
                <th className="p-3">शीर्षक व प्रकार (Job Title)</th>
                <th className="p-3">विभाग (Station)</th>
                <th className="p-3">कोणी पाठवले (Created By)</th>
                <th className="p-3">वेळ (Time)</th>
                <th className="p-3 text-right">कृती (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-500 font-sans">
                    कोणतेही प्रिंट जॉब्स सापडले नाहीत (No print jobs in queue)
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-stone-800/30 transition-colors"
                    >
                      {/* Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            job.status === "SUCCESS"
                              ? "bg-emerald-950 border border-emerald-500/40 text-emerald-300"
                              : job.status === "PENDING"
                              ? "bg-amber-950 border border-amber-500/40 text-amber-300 animate-pulse"
                              : job.status === "CLAIMED"
                              ? "bg-sky-950 border border-sky-500/40 text-sky-300"
                              : job.status === "UNCERTAIN"
                              ? "bg-orange-950 border border-orange-500/40 text-orange-300"
                              : "bg-rose-950 border border-rose-500/40 text-rose-300"
                          }`}
                        >
                          {job.status === "SUCCESS" && <CheckCircle2 className="w-3 h-3" />}
                          {job.status === "PENDING" && <Clock className="w-3 h-3" />}
                          {job.status === "CLAIMED" && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {job.status === "UNCERTAIN" && <AlertTriangle className="w-3 h-3" />}
                          {job.status === "FAILED" && <XCircle className="w-3 h-3" />}
                          <span>{job.status}</span>
                        </span>
                      </td>

                      {/* Title & Type */}
                      <td className="p-3">
                        <div className="font-sans font-bold text-stone-200">{job.title}</div>
                        <div className="text-[10px] text-stone-500 flex items-center gap-2 mt-0.5">
                          <span className="bg-stone-800 px-1.5 py-0.2 rounded text-stone-300">
                            {job.type}
                          </span>
                          <span>•</span>
                          <span>{job.paperWidth}</span>
                          {job.printerIp && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400">{job.printerIp}</span>
                            </>
                          )}
                        </div>
                        {job.errorMessage && (
                          <div className="text-[10px] text-rose-400 mt-1 font-sans">
                            ⚠️ {job.errorMessage}
                          </div>
                        )}
                      </td>

                      {/* Station */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[11px] text-amber-300 font-bold">
                          {job.stationCode}
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="p-3 whitespace-nowrap text-stone-300 font-sans">
                        <span className="text-xs">{job.createdByName || "Staff"}</span>
                      </td>

                      {/* Time */}
                      <td className="p-3 whitespace-nowrap text-stone-400 text-[11px]">
                        <div>{new Date(job.createdAt).toLocaleTimeString("en-IN")}</div>
                        <div className="text-[10px] text-stone-500">
                          {new Date(job.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(job.status === "FAILED" || job.status === "UNCERTAIN") && (
                            <button
                              onClick={() => handleRetryJob(job.id)}
                              title="पुन्हा प्रयत्न करा (Retry Job)"
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}
                          {job.status === "PENDING" && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              title="रद्द करा (Cancel Job)"
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Setup Guide Section */}
      <div
        id="bridge-guide"
        className="p-6 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 border border-stone-800 space-y-5"
      >
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">
            कॅशियर कॉम्प्युटरवर प्रिंट ब्रिज कसा सुरू करायचा? (Cashier PC Setup Guide)
          </h2>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          प्रिंटर स्थानिक वाय-फाय वर असल्याने (<b>192.168.0.108:9100</b>), मोबाईल PWA मधून प्रिंट केलेली बिले
          क्लाउड डेटाबेस मार्फत रेस्टॉरंटमधील कॅशियर कॉम्प्युटरवर येतात आणि तिथून थर्मल प्रिंटरला दिली जातात.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Step 1: Run Command */}
          <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">पायरी १: कमांड सुरू करा (Run Command)</span>
              <button
                onClick={() => copyToClipboard("npm run bridge", "cmd1")}
                className="text-stone-400 hover:text-amber-300 flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copiedKey === "cmd1" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "cmd1" ? "कॉपी झाले!" : "कॉपी करा"}</span>
              </button>
            </div>
            <div className="p-3 rounded-lg bg-black border border-stone-800 font-mono text-[11px] text-amber-300 overflow-x-auto">
              npm run bridge
            </div>
            <p className="text-[11px] text-stone-400">
              किंवा थेट: <code className="text-stone-300">node scripts/print-bridge.mjs</code>
            </p>
          </div>

          {/* Step 2: Auto-start on Windows */}
          <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
            <span className="font-bold text-amber-400 block">
              पायरी २: कॉम्प्युटर सुरू झाल्यावर आपोआप सुरू होण्यासाठी (Auto-start on PC boot)
            </span>
            <p className="text-[11px] text-stone-400">
              Windows वरील <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-200">Win + R</kbd> दाबून{" "}
              <code className="text-amber-300">shell:startup</code> टाईप करा. तिथे एक शॉर्टकट बनवा ज्यामुळे कॉम्प्युटर सुरू होताच ब्रिज बॅकग्राउंडमध्ये चालू राहील.
            </p>
            <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-800 text-[11px] text-stone-300">
              💡 <b>टीप:</b> ब्रिज सुरू असताना स्क्रीनवर प्रिंटरचा IP (192.168.0.108:9100) आणि प्रत्येक प्रिंटचे स्टेटस हिरव्या रंगात दिसते.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
