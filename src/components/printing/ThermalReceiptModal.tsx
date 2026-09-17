"use client";

import React, { useState } from "react";
import { Printer, Copy, Check, X, Sliders, ExternalLink } from "lucide-react";
import { openPrintWindow } from "@/lib/printing/thermal-printer";

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  generateHtml: (paperWidth: "80mm" | "58mm") => string;
  defaultPaperWidth?: "80mm" | "58mm";
  onDirectPrint?: (paperWidth: "80mm" | "58mm") => Promise<void> | void;
}

export function ThermalReceiptModal({
  isOpen,
  onClose,
  title,
  generateHtml,
  defaultPaperWidth = "80mm",
  onDirectPrint,
}: ThermalReceiptModalProps) {
  const [paperWidth, setPaperWidth] = useState<"80mm" | "58mm">(defaultPaperWidth);
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const html = generateHtml(paperWidth);

  const handlePrint = async () => {
    if (onDirectPrint) {
      try {
        setIsPrinting(true);
        await onDirectPrint(paperWidth);
        onClose();
      } catch (err) {
        console.error("Direct print failed:", err);
      } finally {
        setIsPrinting(false);
      }
    } else {
      openPrintWindow(html, title);
    }
  };

  const handleCopy = () => {
    // Extract plain text from the HTML for quick WhatsApp/SMS messaging
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const text = doc.body.innerText || "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">{title}</h3>
              <p className="text-[11px] text-stone-500 font-medium">ESC/POS Thermal Paper Preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 80mm vs 58mm width toggle */}
            <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setPaperWidth("80mm")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperWidth === "80mm"
                    ? "bg-red-700 text-white shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth("58mm")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  paperWidth === "58mm"
                    ? "bg-red-700 text-white shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                58mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Paper Simulator */}
        <div className="flex-1 overflow-y-auto bg-stone-200/70 p-4 sm:p-6 flex justify-center">
          <div
            style={{ width: paperWidth === "58mm" ? "240px" : "330px" }}
            className="bg-white text-black shadow-lg rounded-sm border border-stone-300 transition-all duration-200 min-h-[300px] overflow-hidden"
          >
            <iframe
              srcDoc={html}
              title={title}
              className="w-full min-h-[480px] border-none"
              style={{ display: "block" }}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-100 transition-all"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-stone-500" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 transition-all"
            >
              Done
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-700/20 hover:bg-red-800 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>{isPrinting ? "Printing to Thermal..." : `Print to Thermal (${paperWidth})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
