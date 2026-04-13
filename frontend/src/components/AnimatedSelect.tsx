import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const CHEVRON_SVG = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`;

const POPUP_MAX_HEIGHT = 192; // matches max-h-48 (12rem)
const GAP = 4; // matches mt-1

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
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, dropUp: false });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropUp = spaceBelow < POPUP_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;
    setCoords({
      top: rect.bottom + GAP,
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      width: rect.width,
      dropUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updateCoords();
    // Capture so ancestor-scroll events (ConfigPanel's overflow-y-auto, etc.) also fire.
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" style={style}>
      <button
        ref={anchorRef}
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
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="anim-dropdown fixed z-50 max-h-48 overflow-y-auto rounded border border-gray-700 bg-gray-900 py-0.5 shadow-xl scrollbar-hide"
            style={
              coords.dropUp
                ? { bottom: coords.bottom, left: coords.left, width: coords.width }
                : { top: coords.top, left: coords.left, width: coords.width }
            }
          >
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
          </div>,
          document.body
        )}
    </div>
  );
}
