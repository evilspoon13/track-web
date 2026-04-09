import { useState, useRef, useEffect } from "react";

const CHEVRON_SVG = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`;

interface Option {
  value: string;
  label: string;
}

interface AnimatedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedSelect({
  value,
  onChange,
  options,
  disabled,
  className = "",
  style,
}: AnimatedSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative" style={style}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full appearance-none text-left rounded border border-gray-700 bg-transparent px-2 py-1.5 text-xs text-white focus:border-gray-500 focus:outline-none ${
          disabled ? "cursor-not-allowed opacity-40" : ""
        } ${className}`}
        style={{
          backgroundImage: CHEVRON_SVG,
          backgroundPosition: "right 0.5rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1.5em 1.5em",
          paddingRight: "2.5rem",
        }}
      >
        {selected?.label ?? ""}
      </button>
      {open && (
        <div className="anim-dropdown absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded border border-gray-700 bg-gray-900 py-0.5 shadow-xl scrollbar-hide">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`block w-full px-2 py-1.5 text-left text-xs transition-colors ${
                opt.value === value
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
