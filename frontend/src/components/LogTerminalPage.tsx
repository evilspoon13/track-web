import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry, LogsResponse } from "../types";
import { authFetch } from "../utils/layoutIO";

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `[${hh}:${mm}:${ss}.${ms}]`;
}

function formatCanId(canId: number): string {
  return "0x" + canId.toString(16).toUpperCase().padStart(3, "0");
}

async function fetchLogs(before?: number): Promise<LogsResponse> {
  const params = new URLSearchParams({ limit: "100" });
  if (before !== undefined) params.set("before", String(before));
  const res = await authFetch(`/api/logs?${params.toString()}`);
  if (!res.ok) return { entries: [], nextCursor: null };
  return res.json() as Promise<LogsResponse>;
}

export default function LogTerminalPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLogs().then(({ entries: newEntries, nextCursor: nc }) => {
      if (cancelled) return;
      setEntries([...newEntries].reverse());
      setNextCursor(nc);
      setInitialLoaded(true);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialLoaded) {
      bottomRef.current?.scrollIntoView();
    }
  }, [initialLoaded]);

  const loadMore = useCallback(() => {
    if (loading || nextCursor === null) return;
    setLoading(true);
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    fetchLogs(nextCursor).then(({ entries: older, nextCursor: nc }) => {
      setEntries((prev) => [...[...older].reverse(), ...prev]);
      setNextCursor(nc);
      setLoading(false);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    }).catch(() => setLoading(false));
  }, [loading, nextCursor]);

  useEffect(() => {
    if (!initialLoaded || nextCursor === null) return;
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) loadMore(); },
      { root: scrollContainerRef.current, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [initialLoaded, nextCursor, loadMore]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-950">
      {/* Header bar */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-gray-800 px-6">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">LOG TERMINAL</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-mono text-gray-600">HIST</span>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs text-green-500 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div ref={topSentinelRef} />
        {loading && (
          <div className="py-1 text-[10px] text-gray-600 text-center">loading...</div>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="leading-6 border-b border-gray-900 py-0.5">
            <span className="text-gray-600">{formatTs(entry.ts)} </span>
            <span className="text-gray-500">{formatCanId(entry.can_id)} </span>
            <span className="text-gray-400">{"| " + (entry.frame_name ?? "UNKNOWN").padEnd(12) + " "}</span>
            <span className="text-green-500">{"→ " + entry.value.toFixed(2)}</span>
          </div>
        ))}
        {initialLoaded && entries.length === 0 && (
          <div className="py-4 text-[10px] text-gray-600 text-center">no logs found</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
