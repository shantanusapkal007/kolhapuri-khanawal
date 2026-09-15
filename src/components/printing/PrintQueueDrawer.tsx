"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  X,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ChefHat,
  Receipt,
  FileText,
  Lock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { globalPrinterManager } from "@/lib/printing/printer-connection-manager";
import { PrintJob, PrintJobStatus } from "@/types/billing";

interface PrintQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintQueueDrawer({ isOpen, onClose }: PrintQueueDrawerProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "FAILED" | "SUCCESS">("ALL");

  useEffect(() => {
    const unsubscribe = globalPrinterManager.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const queuedCount = jobs.filter((j) => j.status === "QUEUED" || j.status === "PRINTING" || j.status === "RETRYING").length;
  const failedCount = jobs.filter((j) => j.status === "FAILED").length;
  const successCount = jobs.filter((j) => j.status === "SUCCESS").length;

  const filteredJobs = jobs.filter((j) => {
    if (activeFilter === "ACTIVE") return j.status === "QUEUED" || j.status === "PRINTING" || j.status === "RETRYING";
    if (activeFilter === "FAILED") return j.status === "FAILED";
    if (activeFilter === "SUCCESS") return j.status === "SUCCESS";
    return true;
  });

  const getStatusBadge = (status: PrintJobStatus) => {
    switch (status) {
      case "QUEUED":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            <span>रांगेत (Queued)</span>
          </span>
        );
      case "PRINTING":
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-blue-300 animate-pulse">
            <RefreshCw className="w-3 h-3 text-blue-700 animate-spin" />
            <span>प्रिंट होत आहे...</span>
          </span>
        );
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>यशस्वी (Success)</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-red-300">
            <XCircle className="w-3 h-3 text-red-700" />
            <span>अयशस्वी (Failed)</span>
          </span>
        );
      case "RETRYING":
        return (
          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-900 font-bold px-2 py-0.5 rounded-full text-[10px] border border-orange-300">
            <RotateCcw className="w-3 h-3 text-orange-700 animate-spin" />
            <span>पुन्हा प्रयत्न...</span>
          </span>
        );
    }
  };

  const getTypeIcon = (type: PrintJob["type"]) => {
    switch (type) {
      case "KOT":
        return <ChefHat className="w-4 h-4 text-orange-600" />;
      case "RECEIPT":
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case "TABLE_CHECK":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "DAY_END":
        return <Lock className="w-4 h-4 text-purple-600" />;
      case "TEST":
        return <Zap className="w-4 h-4 text-amber-600" />;
      case "CANCELLED_KOT":
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-stone-200 overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-700 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">
                प्रिंटर स्पूलर रांग (Print Spooler)
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {queuedCount > 0 ? `${queuedCount} प्रिंट प्रलंबित आहेत` : "सर्व प्रिंट सुरळीत चालू आहेत"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline / Failed Alert Banner */}
        {failedCount > 0 && (
          <div className="p-3 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-red-900 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{failedCount} प्रिंट अयशस्वी झाले (Printer Offline?)</span>
            </div>
            <button
              type="button"
              onClick={() => globalPrinterManager.retryAllFailed()}
              className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>सर्व पुन्हा पाठवा</span>
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="px-4 py-2 bg-stone-100/70 border-b border-stone-200 flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeFilter === "ALL" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            सर्व ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ACTIVE")}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeFilter === "ACTIVE" ? "bg-white text-stone-900 shadow-2xs" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            चालू ({queuedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("FAILED")}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeFilter === "FAILED" ? "bg-white text-red-700 shadow-2xs" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            अयशस्वी ({failedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("SUCCESS")}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeFilter === "SUCCESS" ? "bg-white text-emerald-800 shadow-2xs" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            यशस्वी ({successCount})
          </button>
        </div>

        {/* Job List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredJobs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-400">
              <Printer className="w-12 h-12 mb-2 text-stone-300" />
              <p className="text-xs font-bold text-stone-600">प्रिंट रांग रिकामी आहे</p>
              <p className="text-[11px] text-stone-400 mt-0.5">ऑर्डर किंवा बिल प्रिंट झाल्यावर येथे दिसेल.</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-3.5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 transition-all shadow-2xs space-y-2"
              >
                {/* Top Row: Icon, Title, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="p-1.5 rounded-xl bg-stone-100 shrink-0 mt-0.5">
                      {getTypeIcon(job.type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-stone-900 truncate">
                        {job.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-stone-500 mt-0.5">
                        <span className="font-bold text-stone-700">{job.printerName}</span>
                        <span>•</span>
                        <span>{job.paperWidth}</span>
                      </div>
                    </div>
                  </div>

                  <div>{getStatusBadge(job.status)}</div>
                </div>

                {/* Error message if failed */}
                {job.errorMessage && (
                  <div className="p-2 bg-red-50 rounded-xl text-[10.5px] text-red-900 border border-red-200 font-medium">
                    ⚠️ {job.errorMessage}
                  </div>
                )}

                {/* Meta info & Action row */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                  <span>
                    {new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    {job.attempts > 1 ? ` • प्रयत्न: ${job.attempts}/${job.maxAttempts}` : ""}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {(job.status === "FAILED" || job.status === "RETRYING") && (
                      <button
                        type="button"
                        onClick={() => globalPrinterManager.retryJob(job.id)}
                        className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1 border border-red-200 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>पुन्हा पाठवा</span>
                      </button>
                    )}

                    {(job.status === "QUEUED" || job.status === "RETRYING") && (
                      <button
                        type="button"
                        onClick={() => globalPrinterManager.cancelJob(job.id)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold transition-colors"
                      >
                        रद्द करा
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => globalPrinterManager.clearCompletedJobs()}
            className="px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-500" />
            <span>पूर्ण झालेले साफ करा</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors"
          >
            बंद करा
          </button>
        </div>
      </div>
    </div>
  );
}
