import { db } from "../../lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { ApiMessage } from "../../common/types/api.types";
import type { DbcConfig, FrameDefinition, FrameSignal } from "./dbc.types";
import { SignalType } from "./dbc.types";
import type { Signal } from "candied/dist/dbc/Dbc";
import { Dbc } from "candied";

const docRef = (deviceId: string) =>
  db.collection("devices").doc(deviceId).collection("dbc").doc("content");

function signalTypeFromCandied(sig: Signal): SignalType {
  const dt = sig.dataType;
  if (dt === "float") return SignalType.FLOAT;
  if (dt === "double") return SignalType.DOUBLE;
  if (dt === "int8") return SignalType.INT8;
  if (dt === "int16") return SignalType.INT16;
  if (dt === "uint8") return SignalType.UINT8;
  if (dt === "uint16") return SignalType.UINT16;
  if (dt === "int32" || dt === "int64") return SignalType.INT32;
  if (dt === "uint32" || dt === "uint64") return SignalType.UINT32;
  // fallback: derive from signed + length
  if (sig.signed) {
    if (sig.length <= 8) return SignalType.INT8;
    if (sig.length <= 16) return SignalType.INT16;
    return SignalType.INT32;
  }
  if (sig.length <= 8) return SignalType.UINT8;
  if (sig.length <= 16) return SignalType.UINT16;
  return SignalType.UINT32;
}

function parseCandiedToConfig(dbc: Dbc): DbcConfig {
  const frames: Record<string, FrameDefinition> = {};
  dbc.data.messages.forEach((msg) => {
    const canIdHex = "0x" + msg.id.toString(16);
    const signals: FrameSignal[] = [];
    msg.signals.forEach((sig) => {
      signals.push({
        name: sig.name,
        start_byte: sig.startBit,
        length: sig.length,
        type: signalTypeFromCandied(sig),
        scale: sig.factor,
        offset: sig.offset,
      });
    });
    frames[canIdHex] = { can_id_label: msg.name, signals };
  });
  return { frames };
}

export async function readDbc(deviceId: string): Promise<DbcConfig | null> {
  const snap = await docRef(deviceId).get();
  if (!snap.exists) return null;
  const dbc = new Dbc();
  dbc.load(snap.data()!.raw as string);
  return parseCandiedToConfig(dbc);
}

export async function writeDbc(deviceId: string, config: DbcConfig): Promise<ApiMessage> {
  const dbc = new Dbc();
  dbc.description = "DBC file";
  for (const [canIdHex, frame] of Object.entries(config.frames)) {
    const messageId = parseInt(canIdHex, 16);
    const dlc = Math.max(...frame.signals.map((s) => s.start_byte + s.length), 1);
    const message = dbc.createMessage(frame.can_id_label, messageId, dlc);
    message.add().updateDescription(frame.can_id_label).updateNode("Vector__XXX");
    for (const signal of frame.signals) {
      const t = signal.type.toLowerCase();
      message.addSignal(signal.name, signal.start_byte, signal.length, {
        signed: t.startsWith("int"),
        isFloat: t === "float" || t === "double",
        factor: signal.scale,
        offset: signal.offset,
      });
    }
  }
  const raw = dbc.write();
  await docRef(deviceId).set({ raw, updatedAt: FieldValue.serverTimestamp() });
  return { msg: "Wrote DBC" };
}

export async function uploadDbc(deviceId: string, raw: string): Promise<DbcConfig> {
  await docRef(deviceId).set({ raw, updatedAt: FieldValue.serverTimestamp() });
  const dbc = new Dbc();
  dbc.load(raw);
  return parseCandiedToConfig(dbc);
}

export async function readDbcRaw(deviceId: string): Promise<string | null> {
  const snap = await docRef(deviceId).get();
  if (!snap.exists) return null;
  const raw = snap.data()?.raw as unknown;
  return typeof raw === "string" ? raw : null;
}
