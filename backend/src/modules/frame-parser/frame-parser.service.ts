import type { ApiMessage } from "../../common/types/api.types";
import type { FrameDefinition, FrameParserConfig } from "./frame-parser.types";
import { sendReloadSignal } from "../../common/system/signal.service";
import { atomicWriteJson } from "../../common/system/json-helpers";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "../../../../../config/default.json");

export async function readConfig(): Promise<FrameParserConfig | null> {
  try {
    const data = await fs.promises.readFile(DEFAULT_CONFIG_PATH, "utf-8");

    if (data.trim().length === 0) {
      return null;
    }

    const currentConfig = JSON.parse(data) as FrameParserConfig;
    return currentConfig;
  } 
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

export async function updateConfig(can_id: `0x${string}`, frame: FrameDefinition): Promise<ApiMessage> {
  const config: FrameParserConfig = (await readConfig()) ?? { frames: {} };

  config.frames[can_id] = frame;

  await atomicWriteJson(DEFAULT_CONFIG_PATH, config);
  // sendReloadSignal("fsae-can-parser.service");
  return {msg: "Config Updated"};
}
