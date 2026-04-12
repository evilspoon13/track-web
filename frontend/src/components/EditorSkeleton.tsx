import { useEffect, useState } from "react";
import { GRID_COLS, GRID_ROWS } from "../utils/widgetDefaults";

const SHOW_DELAY_MS = 150;
const MIN_SHOW_MS = 300;

export function useDeferredSkeleton(active: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    let shownAt = 0;
    const showTimer = window.setTimeout(() => {
      shownAt = Date.now();
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (shownAt === 0) {
        setVisible(false);
        return;
      }
      const elapsed = Date.now() - shownAt;
      if (elapsed >= MIN_SHOW_MS) {
        setVisible(false);
      } else {
        window.setTimeout(() => setVisible(false), MIN_SHOW_MS - elapsed);
      }
    };
  }, [active]);

  return visible;
}

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-700/60 ${className}`} />;
}

export default function EditorSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <div className="relative flex h-14 flex-shrink-0 items-center justify-center border-b border-gray-700 bg-gray-900">
        <span className="absolute left-4 text-lg font-bold text-white">T.R.A.C.K.</span>
        <div className="flex items-center gap-8">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-16" />
        </div>
        <div className="absolute right-4 flex items-center gap-3">
          <Shimmer className="h-2 w-20 rounded-full" />
          <Shimmer className="h-7 w-7 rounded-full" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex h-full w-72 flex-col border-r border-gray-700 bg-gray-800">
          <div className="border-b border-gray-700 p-4">
            <Shimmer className="mb-2 h-3 w-16" />
            <Shimmer className="h-8 w-full" />
          </div>
          <div className="border-b border-gray-700 p-4">
            <Shimmer className="mb-2 h-3 w-14" />
            <div className="flex flex-col gap-2">
              <Shimmer className="h-6 w-full" />
              <Shimmer className="h-6 w-full" />
            </div>
          </div>
          <div className="border-b border-gray-700 p-4">
            <Shimmer className="mb-2 h-3 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Shimmer className="h-12" />
              <Shimmer className="h-12" />
              <Shimmer className="h-12" />
              <Shimmer className="h-12" />
              <Shimmer className="h-12" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="p-4">
            <div className="flex gap-2">
              <Shimmer className="h-14 flex-1" />
              <Shimmer className="h-14 flex-1" />
              <Shimmer className="h-14 flex-1" />
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center p-4">
          <div
            className="grid gap-0 rounded border border-gray-700 bg-gray-800/40"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
              aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
              width: "min(100%, calc((100vh - 8rem) * 10 / 6))",
            }}
          >
            {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => (
              <div key={i} className="border border-gray-700/40" />
            ))}
          </div>
        </div>

        <div className="flex h-full w-80 flex-col border-l border-gray-700 bg-gray-800">
          <div className="border-b border-gray-600 p-4">
            <Shimmer className="h-4 w-32" />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-3 w-28" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-3 w-16" />
            <div className="flex gap-2">
              <Shimmer className="h-8 flex-1" />
              <Shimmer className="h-8 flex-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
