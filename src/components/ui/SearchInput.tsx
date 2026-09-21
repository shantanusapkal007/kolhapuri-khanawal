import React from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search items... (शोधा...)",
  className = "",
  autoFocus = false,
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-3.5 pointer-events-none text-stone-400">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-11 pl-10 pr-10 bg-white border border-stone-300/80 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm sm:text-base focus:outline-none focus:border-red-800 focus:ring-3 focus:ring-red-900/10 shadow-2xs transition-all touch-manipulation"
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
