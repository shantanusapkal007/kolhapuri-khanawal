"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { RotateCw, Home, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Unhandled error caught in component tree:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleNavigateHome = () => {
    window.location.href = "/tables";
  };

  private handleToggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private handleResetCache = () => {
    if (confirm("तुम्हाला खात्री आहे का? डेटा रिसेट केल्यास सेव्ह नसलेला तात्पुरता डेटा साफ होईल.")) {
      try {
        localStorage.removeItem("kk_live_operations_v1");
      } catch {}
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F7F4] flex flex-col items-center justify-center p-4 text-center select-none font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 mb-4 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mb-1">
              काहीतरी अडचण आली!
            </h1>
            <p className="text-sm font-semibold text-amber-900 mb-2">
              Something went wrong in the application
            </p>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed">
              काळजी नसावी! तुमचे चालू ऑर्डर्स आणि डेटा डिव्हाइस मेमरीमध्ये सुरक्षित आहेत. खालील बटण दाबून ॲप रीलोड करा.
            </p>

            <div className="w-full flex flex-col gap-2.5 mb-6">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-amber-800 hover:bg-amber-900 active:scale-98 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all touch-manipulation"
              >
                <RotateCw className="w-4 h-4" />
                🔄 ॲप पूर्ववत करा (Reload App)
              </button>

              <button
                onClick={this.handleNavigateHome}
                className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all touch-manipulation"
              >
                <Home className="w-4 h-4" />
                🏠 मुख्य टेबल स्क्रीन (Go to Tables)
              </button>
            </div>

            {/* Collapsible Error Debug Details */}
            <div className="w-full border-t border-stone-200 pt-3">
              <button
                onClick={this.handleToggleDetails}
                className="text-xs text-stone-400 hover:text-stone-600 flex items-center justify-center gap-1 mx-auto py-1"
              >
                <span>तांत्रिक माहिती (Technical Details)</span>
                {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-2 text-left bg-stone-900 text-stone-200 rounded-xl p-3 text-[11px] font-mono overflow-auto max-h-40 leading-tight">
                  <p className="font-bold text-red-400 mb-1">{this.state.error?.toString()}</p>
                  <p className="text-stone-400 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</p>
                  <div className="mt-3 pt-2 border-t border-stone-800 flex justify-end">
                    <button
                      onClick={this.handleResetCache}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Clear State Cache & Recover
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-xs text-stone-400 font-medium">
            कोल्हापुरी खानावळ रेस्टॉरंट ऑपरेटिंग सिस्टीम • v1.0 Production
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
