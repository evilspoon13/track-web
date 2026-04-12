import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry, DaySummary } from "../types";
import { fetchLogDays, fetchLogs } from "../utils/layoutIO";
import { useTelemetry } from "../state/TelemetryContext";
import { useEditorState } from "../state/EditorContext";

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

interface DayData {
  entries: LogEntry[];
  nextCursor: number | null;
  loading: boolean;
}

async function downloadExcel(entries: LogEntry[], filename: string) {
  const XLSX = await import("xlsx");

  const timestamps = [...new Set(entries.map((e) => e.ts))].sort((a, b) => a - b);
  const signals = [...new Set(entries.map((e) => e.frame_name ?? `0x${e.can_id.toString(16)}`))];

  const lookup = new Map<number, Record<string, number>>();
  for (const e of entries) {
    const key = e.frame_name ?? `0x${e.can_id.toString(16)}`;
    if (!lookup.has(e.ts)) lookup.set(e.ts, {});
    lookup.get(e.ts)![key] = e.value;
  }

  const rows = timestamps.map((ts) => {
    const row: Record<string, string | number> = { timestamp: new Date(ts).toISOString() };
    for (const sig of signals) {
      row[sig] = lookup.get(ts)?.[sig] ?? "";
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Logs");
  XLSX.writeFile(wb, filename);
}

export default function LogTerminalPage() {
  // --- Live panel state ---
  const { rawMessages, connected } = useTelemetry();
  const { frameParserConfig } = useEditorState();
  const liveScrollRef = useRef<HTMLDivElement>(null);
  const liveBottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (isAtBottomRef.current) {
      liveBottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [rawMessages]);

  const handleLiveScroll = useCallback(() => {
    const el = liveScrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  // --- History panel state ---
  const [days, setDays] = useState<DaySummary[]>([]);
  const [daysLoading, setDaysLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dayData, setDayData] = useState<Record<string, DayData>>({});
  const [dateFilter, setDateFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadDays = useCallback(() => {
    setDaysLoading(true);
    fetchLogDays()
      .then((d) => setDays(d))
      .finally(() => setDaysLoading(false));
  }, []);

  useEffect(() => { loadDays(); }, [loadDays]);

  const toggleDay = useCallback((date: string) => {
    if (expandedDay === date) {
      setExpandedDay(null);
      return;
    }
    setExpandedDay(date);
    if (dayData[date]?.entries.length) return;

    setDayData((prev) => ({ ...prev, [date]: { entries: [], nextCursor: null, loading: true } }));
    fetchLogs({ date, limit: 100 }).then(({ entries, nextCursor }) => {
      setDayData((prev) => ({
        ...prev,
        [date]: { entries, nextCursor, loading: false },
      }));
    });
  }, [expandedDay, dayData]);

  const loadMoreForDay = useCallback((date: string) => {
    const dd = dayData[date];
    if (!dd || dd.loading || dd.nextCursor === null) return;
    setDayData((prev) => ({ ...prev, [date]: { ...prev[date]!, loading: true } }));
    fetchLogs({ date, limit: 100, before: dd.nextCursor }).then(({ entries, nextCursor }) => {
      setDayData((prev) => {
        const existing = prev[date]!;
        return {
          ...prev,
          [date]: {
            entries: [...existing.entries, ...entries],
            nextCursor,
            loading: false,
          },
        };
      });
    });
  }, [dayData]);

  const handleDownloadDay = useCallback(async (date: string) => {
    setDownloading(date);
    const allEntries: LogEntry[] = [];
    let cursor: number | undefined;
    for (;;) {
      const { entries, nextCursor } = await fetchLogs({ date, limit: 500, before: cursor });
      allEntries.push(...entries);
      if (nextCursor === null) break;
      cursor = nextCursor;
    }
    await downloadExcel(allEntries, `logs-${date}.xlsx`);
    setDownloading(null);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    setDownloading("all");
    const allEntries: LogEntry[] = [];
    const targetDays = filteredDays.length > 0 ? filteredDays : days;
    for (const day of targetDays) {
      let cursor: number | undefined;
      for (;;) {
        const { entries, nextCursor } = await fetchLogs({ date: day.date, limit: 500, before: cursor });
        allEntries.push(...entries);
        if (nextCursor === null) break;
        cursor = nextCursor;
      }
    }
    await downloadExcel(allEntries, "logs-all.xlsx");
    setDownloading(null);
  }, [days]);

  const filteredDays = dateFilter
    ? days.filter((d) => d.date === dateFilter)
    : days;

  // Group entries by session
  function groupBySession(entries: LogEntry[]): { session: string; entries: LogEntry[] }[] {
    const groups: { session: string; entries: LogEntry[] }[] = [];
    let current: { session: string; entries: LogEntry[] } | null = null;
    for (const e of entries) {
      if (!current || current.session !== e.session) {
        current = { session: e.session, entries: [] };
        groups.push(current);
      }
      current.entries.push(e);
    }
    return groups;
  }

  // --- Resizable divider ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(() => {
    const saved = localStorage.getItem("log-split-pct");
    return saved ? Number(saved) : 33;
  });
  const draggingRef = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    let lastPct = 50;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      lastPct = Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100));
      setLeftPct(lastPct);
    };

    const onUp = () => {
      draggingRef.current = false;
      localStorage.setItem("log-split-pct", String(lastPct));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden bg-gray-950">
      {/* Left: History */}
      <div className="flex flex-col min-w-0 border-r border-gray-800" style={{ width: `${leftPct}%` }}>
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-800 px-6">
          <span className="text-xs tracking-[0.18em] text-gray-500">LOG HISTORY</span>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-7 bg-gray-900 border border-gray-700 rounded px-2 text-xs text-gray-400"
              style={{ colorScheme: "dark" }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                CLEAR
              </button>
            )}
            <button
              onClick={handleDownloadAll}
              disabled={downloading !== null}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
            >
              {downloading === "all" ? "EXPORTING..." : "DOWNLOAD ALL"}
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto text-sm [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {daysLoading && (
            <div className="py-4 text-xs text-gray-600 text-center">Loading...</div>
          )}
          {!daysLoading && filteredDays.length === 0 && (
            <div className="py-4 text-xs text-gray-600 text-center">No logs found</div>
          )}
          {filteredDays.map((day) => {
            const isExpanded = expandedDay === day.date;
            const dd = dayData[day.date];
            return (
              <div key={day.date} className="border-b border-gray-800">
                {/* Day header */}
                <button
                  onClick={() => toggleDay(day.date)}
                  className="flex w-full items-center justify-between px-6 py-2 hover:bg-gray-900/50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs">{isExpanded ? "v" : ">"}</span>
                    <span className="text-sm text-gray-300">{formatDate(day.date)}</span>
                    <span className="text-xs text-gray-600">({day.count.toLocaleString()})</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadDay(day.date); }}
                    disabled={downloading !== null}
                    className="text-xs text-gray-600 hover:text-gray-300 disabled:opacity-40"
                  >
                    {downloading === day.date ? "..." : "XLSX"}
                  </button>
                </button>

                {/* Expanded entries */}
                {isExpanded && dd && (
                  <div className="anim-accordion px-6 pb-3">
                    {dd.loading && dd.entries.length === 0 && (
                      <div className="py-2 text-xs text-gray-600 text-center">Loading...</div>
                    )}
                    {groupBySession(dd.entries).map((group, gi) => (
                      <div key={gi}>
                        <div className="py-1 text-xs text-gray-600 border-b border-gray-800/50 mb-1">
                          --- session: {group.session} ---
                        </div>
                        {group.entries.map((entry, ei) => (
                          <div key={ei} className="leading-6 border-b border-gray-900 py-0.5">
                            <span className="text-gray-600">{formatTs(entry.ts)} </span>
                            <span className="text-gray-500">{formatCanId(entry.can_id)} </span>
                            <span className="text-gray-400">{"| " + (entry.frame_name ?? "UNKNOWN").padEnd(12) + " "}</span>
                            <span className="text-green-500">{"-> " + entry.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {dd.nextCursor !== null && (
                      <button
                        onClick={() => loadMoreForDay(day.date)}
                        disabled={dd.loading}
                        className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 disabled:opacity-40 text-center"
                      >
                        {dd.loading ? "loading..." : "load more"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-1 flex-shrink-0 cursor-col-resize bg-gray-800 hover:bg-green-600 transition-colors"
      />

      {/* Right: Live Feed */}
      <div className="flex flex-col min-w-0" style={{ width: `${100 - leftPct}%` }}>
        <div className="flex h-12 flex-shrink-0 items-center border-b border-gray-800 px-6">
          <span className="text-xs tracking-[0.18em] text-gray-500">LIVE FEED</span>
        </div>
        <div
          ref={liveScrollRef}
          onScroll={handleLiveScroll}
          className="flex-1 overflow-y-auto px-6 py-4 text-xs text-green-500 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-900 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-600"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 #111827" }}
        >
          {rawMessages.length === 0 && (
            <div className="py-4 text-xs text-gray-600 text-center">
              {connected ? "Waiting for telemetry..." : "Not connected"}
            </div>
          )}
          {rawMessages.map((msg, i) => {
            const colonIdx = msg.key.indexOf(":");
            const canIdNum = parseInt(msg.key.slice(0, colonIdx), 10);
            const signalName = msg.key.slice(colonIdx + 1);
            const hex = "0x" + canIdNum.toString(16);
            const frameName = frameParserConfig[hex]?.can_id_label ?? "UNKNOWN";
            return (
              <div key={i} className="leading-6 border-b border-gray-900 py-0.5">
                <span className="text-gray-600">{formatTs(msg.ts)} </span>
                <span className="text-gray-500">{formatCanId(canIdNum)} </span>
                <span className="text-gray-400">{"| " + frameName.padEnd(12) + " "}</span>
                <span className="text-blue-400">{signalName.padEnd(16)}</span>
                <span className="text-green-500">{" -> " + msg.value.toFixed(2)}</span>
              </div>
            );
          })}
          <div ref={liveBottomRef} />
        </div>
      </div>
    </div>
  );
}
