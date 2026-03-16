const FAKE_LOGS = [
  "[12:34:01.023] 0x200 | MOTOR_DATA   → RPM=6420   TEMP=72°C   TORQUE=186Nm",
  "[12:34:01.045] 0x180 | PACK_DATA    → VOLT=392.4V  CURR=48.2A  SOC=73%",
  "[12:34:01.067] 0x240 | BRAKE_DATA   → PRESS=34bar  BIAS=58%  ABS=0",
  "[12:34:01.089] 0x200 | MOTOR_DATA   → RPM=6438   TEMP=72°C   TORQUE=189Nm",
  "[12:34:01.112] 0x300 | SUSP_DATA    → FL=12mm  FR=11mm  RL=14mm  RR=13mm",
  "[12:34:01.134] 0x180 | PACK_DATA    → VOLT=391.8V  CURR=49.1A  SOC=73%",
  "[12:34:01.156] 0x220 | INV_DATA     → TEMP=68°C  DCBUS=391.2V  FAULT=0x00",
  "[12:34:01.178] 0x260 | VEHICLE_DATA → SPEED=98km/h  LATG=1.8g  LONG=-0.4g",
  "[12:34:01.201] 0x200 | MOTOR_DATA   → RPM=6460   TEMP=72°C   TORQUE=191Nm",
  "[12:34:01.223] 0x180 | PACK_DATA    → VOLT=391.6V  CURR=49.8A  SOC=73%",
  "[12:34:01.245] 0x240 | BRAKE_DATA   → PRESS=28bar  BIAS=58%  ABS=0",
  "[12:34:01.267] 0x300 | SUSP_DATA    → FL=13mm  FR=12mm  RL=14mm  RR=14mm",
  "[12:34:01.289] 0x200 | MOTOR_DATA   → RPM=6480   TEMP=73°C   TORQUE=193Nm",
  "[12:34:01.312] 0x180 | PACK_DATA    → VOLT=391.4V  CURR=50.2A  SOC=73%",
  "[12:34:01.334] 0x220 | INV_DATA     → TEMP=68°C  DCBUS=391.0V  FAULT=0x00",
  "[12:34:01.356] 0x260 | VEHICLE_DATA → SPEED=100km/h  LATG=1.6g  LONG=-0.3g",
  "[12:34:01.378] 0x200 | MOTOR_DATA   → RPM=6510   TEMP=73°C   TORQUE=196Nm",
  "[12:34:01.401] 0x180 | PACK_DATA    → VOLT=391.2V  CURR=50.8A  SOC=72%",
  "[12:34:01.423] 0x240 | BRAKE_DATA   → PRESS=0bar   BIAS=58%  ABS=0",
  "[12:34:01.445] 0x300 | SUSP_DATA    → FL=11mm  FR=10mm  RL=13mm  RR=12mm",
];

export default function LogTerminalPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-950">
      {/* Header bar */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-gray-800 px-6">
        <span className="text-[10px] font-mono tracking-[0.18em] text-gray-500">LOG TERMINAL</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-mono text-gray-600">LIVE</span>
        </div>
      </div>

      {/* Log output */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs text-green-500 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {FAKE_LOGS.map((line, i) => (
          <div key={i} className="leading-6 border-b border-gray-900 py-0.5">
            <span className="text-gray-600">{line.slice(0, 14)}</span>
            <span className="text-gray-500">{line.slice(14, 20)}</span>
            <span className="text-gray-400">{line.slice(20, 32)}</span>
            <span className="text-green-500">{line.slice(32)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
