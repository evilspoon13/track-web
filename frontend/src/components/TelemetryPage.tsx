// ─── Fake time-series (30 samples ≈ last 30 s) ───────────────────────────────

const SERIES: Record<string, number[]> = {
  rpm:   [5980,6120,6380,6520,6480,6620,6750,6420,6380,6450,6510,6580,6420,6350,6480,6590,6680,6420,6380,6510,6620,6750,6800,6680,6590,6420,6380,6450,6420,6420],
  spd:   [88,90,93,96,98,100,102,99,97,95,96,98,100,102,104,101,99,98,99,100,102,104,106,105,103,101,100,99,98,98],
  thr:   [72,78,82,85,88,90,87,84,82,85,88,90,87,85,88,90,92,87,85,88,90,87,85,88,90,87,85,88,87,87],
  brk:   [0,0,5,18,32,40,34,20,5,0,0,8,22,38,45,34,18,6,0,0,0,12,28,40,42,34,20,8,0,34],
  mtmp:  [68,69,69,70,70,71,71,71,72,72,72,72,72,73,73,73,72,72,72,72,72,73,73,72,72,72,72,72,72,72],
  itmp:  [64,64,65,65,66,66,67,67,67,68,68,68,68,68,68,68,68,69,69,68,68,68,68,68,68,68,68,68,68,68],
  pvolt: [393,392.8,392.6,392.4,392.2,392.0,391.8,392.0,392.2,392.4,392.6,392.8,393.0,392.8,392.6,392.4,392.2,392.0,391.8,392.0,392.2,392.4,392.6,392.4,392.2,392.0,392.2,392.4,392.4,392.4],
  soc:   [75,75,75,74,74,74,74,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73,73],
  latg:  [0.2,0.4,0.8,1.2,1.6,1.8,1.9,1.8,1.6,1.2,0.8,0.4,0.0,-0.4,-0.8,-1.2,-1.6,-1.8,-1.6,-1.2,-0.8,-0.4,0.0,0.4,0.8,1.2,1.6,1.8,1.9,1.8],
  long:  [-0.2,-0.1,0.0,0.1,0.2,0.3,0.2,0.1,0.0,-0.1,-0.3,-0.5,-0.8,-1.0,-0.8,-0.5,-0.3,-0.1,0.0,0.1,0.2,0.3,0.2,0.1,0.0,-0.2,-0.4,-0.6,-0.4,-0.4],
};

// ─── Cell definitions ─────────────────────────────────────────────────────────

type CellType = "graph" | "laptime" | "gps" | "gforce";

interface Cell {
  id: string;
  type: CellType;
  label: string;
  unit?: string;
  seriesKey?: string;
  yMin?: number;
  yMax?: number;
  current?: string;
  warn?: number;
  crit?: number;
  colSpan?: number;
  latG?: number;
  longG?: number;
}

const CELLS: Cell[] = [
  // Row 1 — powertrain
  { id: "rpm",   type: "graph",   label: "MOTOR RPM",       unit: "rpm", seriesKey: "rpm",   yMin: 0,   yMax: 8000, current: "6,420" },
  { id: "spd",   type: "graph",   label: "VEHICLE SPEED",   unit: "km/h",seriesKey: "spd",   yMin: 0,   yMax: 160,  current: "98"    },
  { id: "thr",   type: "graph",   label: "THROTTLE POS",    unit: "%",   seriesKey: "thr",   yMin: 0,   yMax: 100,  current: "87"    },
  { id: "brk",   type: "graph",   label: "BRAKE PRESSURE",  unit: "bar", seriesKey: "brk",   yMin: 0,   yMax: 80,   current: "34"    },
  // Row 2 — thermal / electrical
  { id: "mtmp",  type: "graph",   label: "MOTOR TEMP",      unit: "°C",  seriesKey: "mtmp",  yMin: 60,  yMax: 120,  current: "72",  warn: 90,  crit: 110 },
  { id: "itmp",  type: "graph",   label: "INVERTER TEMP",   unit: "°C",  seriesKey: "itmp",  yMin: 55,  yMax: 100,  current: "68",  warn: 80,  crit: 95  },
  { id: "pvolt", type: "graph",   label: "PACK VOLTAGE",    unit: "V",   seriesKey: "pvolt", yMin: 380, yMax: 400,  current: "392.4" },
  { id: "soc",   type: "graph",   label: "STATE OF CHARGE", unit: "%",   seriesKey: "soc",   yMin: 0,   yMax: 100,  current: "73"   },
  // Row 3 — map / dynamics / timing
  { id: "gps",    type: "gps",    label: "GPS POSITION",    colSpan: 2   },
  { id: "gforce", type: "gforce", label: "G-FORCE",         latG: 1.8, longG: -0.4 },
  { id: "lap",    type: "laptime",label: "LAP TIME",        current: "1:24.3" },
];

// ─── SVG components ───────────────────────────────────────────────────────────

function LineGraph({ id, values, yMin, yMax, warn, crit }: {
  id: string; values: number[]; yMin: number; yMax: number;
  warn?: number; crit?: number;
}) {
  const W = 300;
  const H = 60;
  const range = yMax - yMin || 1;
  const lastVal = values[values.length - 1] ?? 0;

  const lineColor =
    crit && lastVal >= crit ? "#f87171" :
    warn && lastVal >= warn ? "#fbbf24" : "#6b7280";

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - yMin) / range) * H;
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const first = pts[0] ?? [0, H];
  const last  = pts[pts.length - 1] ?? [W, H];
  const fillPath = `M${first[0]},${first[1]} ${pts.map(([x,y])=>`L${x},${y}`).join(" ")} L${last[0]},${H} L${first[0]},${H} Z`;
  const warnY = warn !== undefined ? H - ((warn - yMin) / range) * H : null;
  const critY = crit !== undefined ? H - ((crit - yMin) / range) * H : null;
  const gradId = `fill-${id}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yMin < 0 && (
        <line x1={0} y1={H - ((-yMin) / range) * H} x2={W} y2={H - ((-yMin) / range) * H}
          stroke="#374151" strokeWidth="0.75" />
      )}
      {warnY !== null && (
        <line x1={0} y1={warnY} x2={W} y2={warnY}
          stroke="#fbbf24" strokeWidth="0.75" strokeDasharray="4,3" />
      )}
      {critY !== null && (
        <line x1={0} y1={critY} x2={W} y2={critY}
          stroke="#f87171" strokeWidth="0.75" strokeDasharray="4,3" />
      )}
      <path d={fillPath} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={lineColor}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={lineColor} />
    </svg>
  );
}

// Fake FSAE-style track outline + car position
function TrackMap() {
  // Track outer path (simplified FSAE autocross-style circuit)
  const outer = "M 55,18 L 225,18 Q 258,18 258,48 L 258,70 Q 258,90 240,98 L 218,104 Q 200,110 196,128 Q 192,148 170,155 L 125,155 Q 102,155 94,138 L 90,124 Q 84,106 64,102 Q 40,97 38,74 L 38,48 Q 38,18 55,18 Z";
  // Track inner path (inset ~16px)
  const inner = "M 72,34 L 210,34 Q 234,34 234,56 L 234,72 Q 234,86 220,92 L 200,97 Q 182,102 178,118 Q 174,134 158,140 L 136,140 Q 118,140 112,126 L 108,114 Q 104,100 84,96 Q 66,92 66,72 L 66,56 Q 66,34 72,34 Z";
  // Car dot position along the track (hardcoded for mockup)
  const carX = 182;
  const carY = 104;
  // Ghost (previous lap) dot
  const ghostX = 158;
  const ghostY = 38;

  return (
    <svg viewBox="0 0 296 174" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* Track surface */}
      <path d={outer} fill="#1c1c1c" stroke="#374151" strokeWidth="1" />
      <path d={inner} fill="#030712" stroke="#374151" strokeWidth="1" />

      {/* Start/finish line */}
      <line x1="55" y1="18" x2="72" y2="34" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="3,2" />

      {/* Sector markers */}
      <circle cx={258} cy={70} r={3} fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
      <circle cx={125} cy={155} r={3} fill="none" stroke="#1d4ed8" strokeWidth="1.5" />

      {/* Ghost car (previous lap) */}
      <circle cx={ghostX} cy={ghostY} r={5} fill="#1f2937" stroke="#374151" strokeWidth="1.5" />

      {/* Car position */}
      <circle cx={carX} cy={carY} r={6} fill="#ffffff" />
      <circle cx={carX} cy={carY} r={10} fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.3" />

      {/* GPS lock indicator */}
      <text x="8" y="168" fill="#374151" fontSize="7" fontFamily="monospace">GPS LOCK</text>
      <circle cx="47" cy="165" r="3" fill="#22c55e" />
      <text x="8" y="10" fill="#374151" fontSize="7" fontFamily="monospace">FSAE TRACK — MOCKUP</text>
    </svg>
  );
}

// Compact G-force XY crosshair
function GForcePlot({ latG, longG }: { latG: number; longG: number }) {
  const range = 3;
  const cx = 50; const cy = 50;
  const scale = 38 / range;
  const dotX = cx + latG * scale;
  const dotY = cy - longG * scale;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {[1, 2, 3].map(n => (
        <circle key={n} cx={cx} cy={cy} r={(n / range) * 38}
          fill="none" stroke="#1f2937" strokeWidth="0.75" />
      ))}
      <line x1={cx} y1={12} x2={cx} y2={88} stroke="#1f2937" strokeWidth="0.75" />
      <line x1={12} y1={cy} x2={88} y2={cy} stroke="#1f2937" strokeWidth="0.75" />
      <text x={cx+1} y={11} fill="#374151" fontSize="5" textAnchor="middle">+</text>
      <text x={cx+1} y={93} fill="#374151" fontSize="5" textAnchor="middle">−</text>
      <text x={10}   y={cy+2} fill="#374151" fontSize="5" textAnchor="middle">−</text>
      <text x={91}   y={cy+2} fill="#374151" fontSize="5" textAnchor="middle">+</text>
      <circle cx={dotX} cy={dotY} r={6} fill="#ffffff" fillOpacity="0.08" />
      <circle cx={dotX} cy={dotY} r={3} fill="#ffffff" />
    </svg>
  );
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function TelemetryCell({ cell }: { cell: Cell }) {
  const numVal = parseFloat((cell.current ?? "0").replace(",", "")) || 0;
  const valueColor =
    cell.crit && numVal >= cell.crit ? "text-red-400" :
    cell.warn && numVal >= cell.warn ? "text-amber-400" : "text-white";

  const colSpanClass = cell.colSpan === 2 ? "col-span-2" : "";

  if (cell.type === "gps") {
    return (
      <div className={`${colSpanClass} bg-gray-950 rounded-xl flex flex-col p-4 overflow-hidden`}>
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">{cell.label}</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-mono text-gray-600">29.7604° N  95.3698° W</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <TrackMap />
        </div>
      </div>
    );
  }

  if (cell.type === "gforce") {
    return (
      <div className={`${colSpanClass} bg-gray-950 rounded-xl flex flex-col p-4 overflow-hidden`}>
        <div className="flex items-start justify-between mb-1 flex-shrink-0">
          <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">{cell.label}</span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-mono text-gray-600">
              LAT <span className="text-gray-300">{cell.latG?.toFixed(2)}g</span>
            </span>
            <span className="text-[10px] font-mono text-gray-600">
              LON <span className="text-gray-300">{cell.longG?.toFixed(2)}g</span>
            </span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <GForcePlot latG={cell.latG!} longG={cell.longG!} />
        </div>
      </div>
    );
  }

  if (cell.type === "laptime") {
    return (
      <div className={`${colSpanClass} bg-gray-950 rounded-xl flex flex-col justify-between p-4`}>
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">{cell.label}</span>
        <div>
          <span className="font-mono text-3xl font-bold tabular-nums text-white leading-none">
            {cell.current}
          </span>
          <div className="mt-3 flex flex-col gap-1 text-[10px] font-mono">
            <div className="flex justify-between">
              <span className="text-gray-600">SECTOR 1</span>
              <span className="text-gray-400">28.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SECTOR 2</span>
              <span className="text-gray-400">31.4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SECTOR 3</span>
              <span className="text-gray-400">24.8</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-800 pt-1">
              <span className="text-gray-600">BEST</span>
              <span className="text-gray-500">1:22.9</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: graph
  return (
    <div className={`${colSpanClass} bg-gray-950 rounded-xl flex flex-col justify-between p-4 overflow-hidden`}>
      <div className="flex items-start justify-between flex-shrink-0">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500 leading-tight">
          {cell.label}
        </span>
        <div className="flex items-baseline gap-1 ml-2">
          <span className={`text-xl font-bold tabular-nums leading-none ${valueColor}`}>
            {cell.current}
          </span>
          <span className="text-[10px] text-gray-600">{cell.unit}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end min-h-0 mt-2">
        {cell.seriesKey && (
          <>
            <LineGraph
              id={cell.id}
              values={SERIES[cell.seriesKey] ?? []}
              yMin={cell.yMin!}
              yMax={cell.yMax!}
              warn={cell.warn}
              crit={cell.crit}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-gray-700">{cell.yMin}{cell.unit}</span>
              <span className="text-[9px] font-mono text-gray-700">−30s</span>
              <span className="text-[9px] font-mono text-gray-700">{cell.yMax}{cell.unit}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TelemetryPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-gray-900">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-3 p-3 bg-gray-900">
        {CELLS.map((cell) => (
          <TelemetryCell key={cell.id} cell={cell} />
        ))}
      </div>
    </div>
  );
}
