import React from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

interface StatusBadgeProps {
  variant?: BadgeVariant;
  label: string;
  sublabel?: string;
  dot?: boolean;
  className?: string;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  info: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  neutral: {
    bg: "bg-stone-100",
    text: "text-stone-700",
    border: "border-stone-200",
    dot: "bg-stone-400",
  },
  primary: {
    bg: "bg-red-50",
    text: "text-red-900",
    border: "border-red-200",
    dot: "bg-red-700",
  },
};

export function StatusBadge({
  variant = "neutral",
  label,
  sublabel,
  dot = false,
  className = "",
  size = "md",
}: StatusBadgeProps) {
  const style = VARIANT_STYLES[variant];
  const sizeClasses = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-lg border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
      <span>{label}</span>
      {sublabel && (
        <span className="opacity-75 font-normal text-[10px]">({sublabel})</span>
      )}
    </span>
  );
}
