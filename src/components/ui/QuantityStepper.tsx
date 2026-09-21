import React from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { triggerHaptic } from "@/lib/mobile/haptics";

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  allowDeleteOnZero?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  min = 0,
  max = 99,
  allowDeleteOnZero = true,
  size = "md",
  className = "",
}: QuantityStepperProps) {
  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < max) {
      triggerHaptic("tap");
      onIncrement();
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > min) {
      triggerHaptic("tap");
      onDecrement();
    }
  };

  const buttonSizeClasses =
    size === "sm"
      ? "w-8 h-8 min-w-[32px] min-h-[32px]"
      : size === "lg"
      ? "w-12 h-12 min-w-[48px] min-h-[48px]"
      : "w-10 h-10 min-w-[44px] min-h-[44px]"; // standard 44px touch target

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const textClasses = size === "sm" ? "text-xs min-w-[20px]" : "text-sm sm:text-base min-w-[28px]";

  const isAtZeroOrMin = quantity <= min;
  const showTrashIcon = allowDeleteOnZero && quantity === 1;

  return (
    <div
      className={`inline-flex items-center gap-1 bg-stone-100/90 border border-stone-200/90 rounded-xl p-0.5 select-none touch-manipulation ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={isAtZeroOrMin}
        aria-label="Decrease quantity"
        className={`${buttonSizeClasses} flex items-center justify-center rounded-lg bg-white text-stone-800 shadow-2xs border border-stone-200/70 active:scale-95 disabled:opacity-40 disabled:pointer-events-none hover:bg-stone-50 transition-all cursor-pointer`}
      >
        {showTrashIcon ? (
          <Trash2 className={`${iconSize} text-rose-600`} />
        ) : (
          <Minus className={`${iconSize} text-stone-700`} />
        )}
      </button>

      <span
        className={`font-black text-center font-tabular text-stone-900 ${textClasses}`}
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={quantity >= max}
        aria-label="Increase quantity"
        className={`${buttonSizeClasses} flex items-center justify-center rounded-lg bg-red-800 text-white shadow-2xs active:scale-95 disabled:opacity-40 disabled:pointer-events-none hover:bg-red-900 transition-all cursor-pointer`}
      >
        <Plus className={`${iconSize}`} />
      </button>
    </div>
  );
}
