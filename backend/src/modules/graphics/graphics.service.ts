import type { ApiMessage } from "../../common/types/api.types";
import type { ScreenInfo, GraphicsConfig } from "./graphics.types";
import { sendReloadSignal } from "../../common/system/signal.service";
import { atomicWriteJson } from "../../common/system/json-helpers";
import fs from "node:fs";
import path from "node:path";


const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "../../../../../config/graphics.json");

export async function readConfig(): Promise<GraphicsConfig | null> {
  try {
    const data = await fs.promises.readFile(DEFAULT_CONFIG_PATH, "utf-8");

    if (data.trim().length === 0) {
      return null;
    }

    const currentConfig = JSON.parse(data) as GraphicsConfig;
    return currentConfig;
  } 
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

export async function getScreenNames(): Promise<string[] | null> {
  const config: GraphicsConfig | null = await readConfig();
  if (config === null || config.screens === null) {
    return null;
  }

  let screenNames: string[] = config.screens!.map((screen) => screen.name);

  return screenNames;
}

export async function getScreenById(screen: string): Promise<ScreenInfo | null> {
  const config: GraphicsConfig | null = await readConfig();
  if (config === null) {
    return null;
  }

  const matchedScreen = config.screens.find((currScreen) => currScreen.name === screen);
  return matchedScreen ?? null;
}

export async function deleteScreenById(screen: string): Promise<ApiMessage> {
  const config: GraphicsConfig | null = await readConfig();
  if (config === null) {
    return {msg: "fail"};
  }

  const screenIdx = config.screens.findIndex((currScreen) => currScreen.name === screen);
  if (screenIdx == -1){
    return {msg: "fail"};
  }
  config.screens.splice(screenIdx, 1);

  await atomicWriteJson(DEFAULT_CONFIG_PATH, config);
  return {msg: "Screen Deleted"};
}

// Writes Graphics Config to shared memory
export async function saveScreen( screenId:string, newScreen: ScreenInfo): Promise<ApiMessage> {
  let config: GraphicsConfig = (await readConfig()) ?? {screens : []};

  const idx = config.screens.findIndex((screen) => screen.name == screenId);
  
  if (idx >= 0) {
    config.screens[idx] = newScreen;
  }
  else {
    config.screens.push(newScreen);
  }

  await atomicWriteJson(DEFAULT_CONFIG_PATH, config);
  // sendReloadSignal("fsae-graphics.service");
  return {msg: "Config Updated"};
}
