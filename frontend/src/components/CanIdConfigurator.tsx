import { useState } from "react";
import { ChevronRight, ChevronDown, Trash2, Plus, Save } from "lucide-react";
import { useEditorState, useEditorDispatch } from "../state/EditorContext";
import type { FrameDefinition, FrameSignal, SignalType } from "../types";
import { saveDbc } from "../utils/layoutIO";
import AnimatedSelect from "./AnimatedSelect";

const SIGNAL_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-red-500",
];

const SIGNAL_TYPES: SignalType[] = [
  "uint8", "int8", "uint16", "int16", "uint32", "int32", "float", "double",
];

const TYPE_BYTES: Record<SignalType, number> = {
  uint8: 1, int8: 1,
  uint16: 2, int16: 2,
  uint32: 4, int32: 4, float: 4,
  double: 8,
};

// Convert between bits (data model / DBC) and bytes (UI)
const bitToByte = (startBit: number) => Math.floor(startBit / 8);
const bitLenToByteLen = (startBit: number, bitLen: number) =>
  Math.ceil((startBit + bitLen) / 8) - Math.floor(startBit / 8);
const byteToBit = (byteIdx: number) => byteIdx * 8;
const byteLenToBitLen = (byteLen: number) => byteLen * 8;

function wouldOverlap(
  frame: FrameDefinition,
  signalIdx: number,
  startBit: number,
  bitLen: number
): boolean {
  const aEnd = startBit + bitLen;
  return frame.signals.some((sig, i) => {
    if (i === signalIdx) return false;
    return startBit < sig.start_byte + sig.length && aEnd > sig.start_byte;
  });
}

export default function CanIdConfigurator() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const { frameParserConfig, canIdsDirty } = state;

  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  const [expandedSignals, setExpandedSignals] = useState<Record<string, Set<number>>>({});
  const [activeSignal, setActiveSignal] = useState<{ canId: string; signalIdx: number } | null>(null);
  const [byteSelection, setByteSelection] = useState<{ canId: string; signalIdx: number; bytes: number[] } | null>(null);
  const [newFrameMode, setNewFrameMode] = useState(false);
  const [newCanId, setNewCanId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const toggleFrame = (canId: string) => {
    setExpandedFrames((prev) => {
      const next = new Set(prev);
      if (next.has(canId)) next.delete(canId);
      else next.add(canId);
      return next;
    });
  };

  const toggleSignal = (canId: string, idx: number) => {
    const frameSet = new Set(expandedSignals[canId] ?? []);
    if (frameSet.has(idx)) {
      frameSet.clear();
      setActiveSignal(null);
      setByteSelection(null);
    } else {
      frameSet.clear();
      frameSet.add(idx);
      setActiveSignal({ canId, signalIdx: idx });
      setByteSelection(null);
    }
    setExpandedSignals((prev) => ({ ...prev, [canId]: frameSet }));
  };

  const handleCreateFrame = () => {
    if (!newCanId.trim()) return;
    const frame: FrameDefinition = {
      can_id_label: newLabel.trim() || newCanId.trim(),
      signals: [],
    };
    dispatch({ type: "ADD_CAN_FRAME", payload: { canId: newCanId.trim(), frame } });
    setExpandedFrames((prev) => new Set([...prev, newCanId.trim()]));
    setNewFrameMode(false);
    setNewCanId("");
    setNewLabel("");
  };

  const handleRemoveFrame = (canId: string) => {
    dispatch({ type: "REMOVE_CAN_FRAME", payload: { canId } });
    if (activeSignal?.canId === canId) {
      setActiveSignal(null);
      setByteSelection(null);
    }
  };

  const handleUpdateLabel = (canId: string, labelVal: string) => {
    const frame = frameParserConfig[canId];
    if (!frame) return;
    dispatch({ type: "UPDATE_CAN_FRAME", payload: { canId, frame: { ...frame, can_id_label: labelVal } } });
  };

  const handleAddSignal = (canId: string) => {
    const frame = frameParserConfig[canId];
    if (!frame) return;
    const taken = new Set<number>();
    frame.signals.forEach((s) => {
      const sb = bitToByte(s.start_byte);
      const eb = sb + bitLenToByteLen(s.start_byte, s.length);
      for (let b = sb; b < eb; b++) taken.add(b);
    });
    let freeByte = 0;
    for (let i = 0; i < 8; i++) { if (!taken.has(i)) { freeByte = i; break; } }
    const newSignal: FrameSignal = { name: `SIGNAL_${frame.signals.length + 1}`, start_byte: byteToBit(freeByte), length: 8, type: "uint8", scale: 1, offset: 0 };
    const newIdx = frame.signals.length;
    const updatedFrame = { ...frame, signals: [...frame.signals, newSignal] };
    dispatch({ type: "UPDATE_CAN_FRAME", payload: { canId, frame: updatedFrame } });
    setExpandedSignals((prev) => {
      const frameSet = new Set(prev[canId] ?? []);
      frameSet.add(newIdx);
      return { ...prev, [canId]: frameSet };
    });
    setActiveSignal({ canId, signalIdx: newIdx });
    setByteSelection({ canId, signalIdx: newIdx, bytes: [freeByte] });
  };

  const handleRemoveSignal = (canId: string, signalIdx: number) => {
    const frame = frameParserConfig[canId];
    if (!frame) return;
    const signals = frame.signals.filter((_, i) => i !== signalIdx);
    const updatedFrame = { ...frame, signals };
    dispatch({ type: "UPDATE_CAN_FRAME", payload: { canId, frame: updatedFrame } });
    if (activeSignal?.canId === canId && activeSignal.signalIdx === signalIdx) {
      setActiveSignal(null);
      setByteSelection(null);
    }
  };

  const handleUpdateSignal = (canId: string, signalIdx: number, updates: Partial<FrameSignal>) => {
    const frame = frameParserConfig[canId];
    if (!frame) return;
    const current = frame.signals[signalIdx]!;
    const merged = { ...current, ...updates };
    merged.start_byte = Math.max(0, Math.min(56, merged.start_byte));  // max start bit = byte 7
    merged.length = Math.max(8, Math.min(64 - merged.start_byte, merged.length));  // min 1 byte = 8 bits
    if (wouldOverlap(frame, signalIdx, merged.start_byte, merged.length)) return;
    const byteLen = bitLenToByteLen(merged.start_byte, merged.length);
    if (TYPE_BYTES[merged.type] > byteLen) {
      merged.type = [...SIGNAL_TYPES].reverse().find((t) => TYPE_BYTES[t] <= byteLen) ?? "uint8";
    }
    const signals = frame.signals.map((s, i) => (i === signalIdx ? merged : s));
    dispatch({ type: "UPDATE_CAN_FRAME", payload: { canId, frame: { ...frame, signals } } });
  };

  const handleByteClick = (canId: string, byteIdx: number) => {
    if (!activeSignal || activeSignal.canId !== canId) return;
    const { signalIdx } = activeSignal;
    const frame = frameParserConfig[canId];
    if (!frame) return;
    const sig = frame.signals[signalIdx];
    if (!sig) return;

    const sigStartByte = bitToByte(sig.start_byte);
    const sigByteLen = bitLenToByteLen(sig.start_byte, sig.length);
    const sigEndByte = sigStartByte + sigByteLen;
    const isOwnedByActive = byteIdx >= sigStartByte && byteIdx < sigEndByte;

    if (isOwnedByActive) {
      if (sigByteLen === 1) return;
      if (byteIdx === sigStartByte) {
        handleUpdateSignal(canId, signalIdx, { start_byte: byteToBit(sigStartByte + 1), length: byteLenToBitLen(sigByteLen - 1) });
      } else if (byteIdx === sigEndByte - 1) {
        handleUpdateSignal(canId, signalIdx, { length: byteLenToBitLen(sigByteLen - 1) });
      }
      setByteSelection(null);
      return;
    }

    const isSameSelection =
      byteSelection?.canId === canId && byteSelection?.signalIdx === signalIdx;

    if (!isSameSelection) {
      setByteSelection({ canId, signalIdx, bytes: [byteIdx] });
      handleUpdateSignal(canId, signalIdx, { start_byte: byteToBit(byteIdx), length: byteLenToBitLen(1) });
    } else {
      const existing = byteSelection!.bytes;
      const min = Math.min(...existing, byteIdx);
      const max = Math.max(...existing, byteIdx);
      const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      setByteSelection({ canId, signalIdx, bytes: range });
      handleUpdateSignal(canId, signalIdx, { start_byte: byteToBit(min), length: byteLenToBitLen(max - min + 1) });
    }
  };

  const handleSave = async () => {
    await saveDbc(frameParserConfig);
    dispatch({ type: "MARK_CAN_IDS_CLEAN" });
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
    setShowSaveModal(false);
  };

  const getByteOwnership = (frame: FrameDefinition): number[] => {
    const ownership = Array(8).fill(-1);
    frame.signals.forEach((sig, idx) => {
      const startByte = Math.floor(sig.start_byte / 8);
      const endByte = Math.ceil((sig.start_byte + sig.length) / 8);
      for (let b = startByte; b < endByte && b < 8; b++) {
        ownership[b] = idx;
      }
    });
    return ownership;
  };

  const fieldClass =
    "w-full rounded border border-gray-700 bg-transparent px-2 py-1 text-xs text-white focus:border-gray-500 focus:outline-none";

  return (
    <>
      {showSaveModal && (
        <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="anim-modal mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-8 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-white">Save CAN Frames?</h2>
            <p className="mb-8 text-gray-300">
              This will overwrite the saved CAN signal configuration in the cloud.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 rounded bg-gray-700 px-6 py-4 text-lg font-medium text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded bg-teal-700 px-6 py-4 text-lg font-medium text-white hover:bg-teal-600"
              >
                {saveStatus || "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs font-medium text-gray-400">CAN Frames</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewFrameMode((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="relative flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              aria-label="Save CAN frames"
            >
              <Save className="h-3.5 w-3.5" />
              {canIdsDirty && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-teal-500" />
              )}
            </button>
          </div>
        </div>

        {/* New frame form */}
        {newFrameMode && (
          <div className="anim-accordion border-b border-gray-700 px-4 py-3">
            <div className="mb-2">
              <label className="mb-1 block text-xs text-gray-400">CAN ID</label>
              <input
                type="text"
                placeholder="0x100"
                value={newCanId}
                onChange={(e) => setNewCanId(e.target.value)}
                className={fieldClass}
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-gray-400">Label</label>
              <input
                type="text"
                placeholder="ENGINE_DATA"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFrame()}
                className={fieldClass}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setNewFrameMode(false); setNewCanId(""); setNewLabel(""); }}
                className="flex-1 rounded py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFrame}
                className="flex-1 rounded bg-blue-600 py-1.5 text-xs text-white hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {Object.keys(frameParserConfig).length === 0 && !newFrameMode && (
          <p className="px-4 py-3 text-xs text-gray-500">No CAN frames defined.</p>
        )}

        {Object.entries(frameParserConfig).map(([canId, frame], frameIdx, arr) => {
          const isExpanded = expandedFrames.has(canId);
          const ownership = getByteOwnership(frame);
          const isActiveFrame = activeSignal?.canId === canId;
          const isLast = frameIdx === arr.length - 1;

          return (
            <div key={canId} className="relative">
              {/* Frame row */}
              <div
                className="relative flex cursor-pointer items-center gap-2 py-2.5 pl-8 pr-4 hover:bg-white/5"
                onClick={() => toggleFrame(canId)}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-4 top-0 w-px bg-gray-700 ${
                    isLast ? "bottom-1/2" : "bottom-0"
                  }`}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 h-px w-3 bg-gray-700"
                />
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                )}
                <span className="font-mono text-sm font-medium text-white">{canId}</span>
                <span className="flex-1 truncate text-sm text-gray-400">({frame.can_id_label})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFrame(canId); }}
                  className="flex-shrink-0 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isExpanded && (
                <div className="anim-accordion relative pl-8 pr-4">
                  {!isLast && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-4 top-0 bottom-0 w-px bg-gray-700"
                    />
                  )}
                  {/* Label edit */}
                  <div className="mb-3 pt-2">
                    <label className="mb-1 block text-xs font-medium text-gray-400">Label</label>
                    <input
                      type="text"
                      value={frame.can_id_label}
                      onChange={(e) => handleUpdateLabel(canId, e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  {/* Byte map — interactive when a signal is active */}
                  <div className="mb-3">
                    <span className="mb-1.5 block text-xs text-gray-500">
                      {isActiveFrame
                        ? `Byte Map — click to assign to ${frame.signals[activeSignal!.signalIdx]?.name ?? "signal"}`
                        : "Byte Map"}
                    </span>
                    <div
                      className="flex gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:!block [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-600"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "#4b5563 transparent" }}
                    >
                      {Array.from({ length: 8 }, (_, i) => {
                        const ownerIdx = ownership[i]!;
                        const isOwnedByActive =
                          isActiveFrame && ownerIdx === activeSignal!.signalIdx;

                        let colorClass: string;
                        if (ownerIdx >= 0) {
                          const base = SIGNAL_COLORS[ownerIdx % SIGNAL_COLORS.length]!;
                          colorClass = isActiveFrame && !isOwnedByActive
                            ? `${base} opacity-40`
                            : base;
                        } else {
                          colorClass = isActiveFrame
                            ? "bg-gray-700 hover:bg-gray-600"
                            : "bg-gray-700 text-gray-500";
                        }

                        const takenByOther = isActiveFrame && ownerIdx >= 0 && !isOwnedByActive;

                        return isActiveFrame ? (
                          <button
                            key={i}
                            onClick={() => !takenByOther && handleByteClick(canId, i)}
                            disabled={takenByOther}
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[11px] font-mono text-white transition ${colorClass} ${isOwnedByActive ? "ring-1 ring-white/50" : ""} ${takenByOther ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {i}
                          </button>
                        ) : (
                          <div
                            key={i}
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-[11px] font-mono text-white ${colorClass}`}
                          >
                            {i}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Signals */}
                  {frame.signals.length > 0 && (
                    <div className="mb-2 border-t border-gray-700/60">
                      {frame.signals.map((sig, sigIdx) => {
                        const isSigExpanded = expandedSignals[canId]?.has(sigIdx) ?? false;
                        const sigColor = SIGNAL_COLORS[sigIdx % SIGNAL_COLORS.length]!;
                        const isThisActive =
                          activeSignal?.canId === canId && activeSignal.signalIdx === sigIdx;

                        return (
                          <div key={sigIdx} className="border-b border-gray-700/60">
                            <div
                              className="flex cursor-pointer items-center gap-2 py-2 hover:bg-white/5"
                              onClick={() => toggleSignal(canId, sigIdx)}
                            >
                              <div className={`h-2 w-2 flex-shrink-0 rounded-full ${sigColor}`} />
                              {isSigExpanded ? (
                                <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-500" />
                              )}
                              <span className={`flex-1 truncate font-mono text-xs font-medium ${isThisActive ? "text-white" : "text-gray-300"}`}>
                                {sig.name}
                              </span>
                              <span className="flex-shrink-0 text-xs text-gray-500">
                                {bitToByte(sig.start_byte)}–{bitToByte(sig.start_byte) + bitLenToByteLen(sig.start_byte, sig.length) - 1}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveSignal(canId, sigIdx); }}
                                className="flex-shrink-0 text-gray-600 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            {isSigExpanded && (
                              <div className="anim-accordion pb-3 pl-5">
                                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-400">Name</label>
                                    <input
                                      type="text"
                                      value={sig.name}
                                      onChange={(e) => handleUpdateSignal(canId, sigIdx, { name: e.target.value })}
                                      className={fieldClass}
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-400">Type</label>
                                    <AnimatedSelect
                                      value={sig.type}
                                      onChange={(v) => handleUpdateSignal(canId, sigIdx, { type: v as SignalType })}
                                      options={SIGNAL_TYPES.filter((t) => TYPE_BYTES[t] <= bitLenToByteLen(sig.start_byte, sig.length)).map((t) => ({
                                        value: t,
                                        label: t,
                                      }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-400">Scale</label>
                                    <input
                                      type="number"
                                      value={sig.scale}
                                      onChange={(e) => handleUpdateSignal(canId, sigIdx, { scale: parseFloat(e.target.value) || 1 })}
                                      className={fieldClass}
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-400">Offset</label>
                                    <input
                                      type="number"
                                      value={sig.offset}
                                      onChange={(e) => handleUpdateSignal(canId, sigIdx, { offset: parseFloat(e.target.value) || 0 })}
                                      className={fieldClass}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => handleAddSignal(canId)}
                    className="mb-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                  >
                    <Plus className="h-3 w-3" />
                    Add Signal
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
