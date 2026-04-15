import type { Request, Response } from "express";
import type { ScreenInfo } from "./graphics.types";
import * as graphicsService from "./graphics.service";
import { sendConfigToPi, broadcastToDeviceClients } from "../realtime/realtime.service";

function parseCanId(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) return Number(v);
  return NaN;
}

function toHexCanId(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return "0x" + Math.floor(v).toString(16);
  if (typeof v === "string") return v;
  return "0x0";
}

function denormalizeScreen(screen: ScreenInfo): ScreenInfo {
  return {
    ...screen,
    widgets: (screen.widgets ?? []).map((w) => {
      const out: typeof w = {
        ...w,
        data: { ...w.data, can_id: toHexCanId(w.data?.can_id) as unknown as number },
      };
      if (w.graph && w.graph.x_can_id !== undefined) {
        out.graph = { ...w.graph, x_can_id: toHexCanId(w.graph.x_can_id) as unknown as number };
      }
      return out;
    }),
  };
}

function normalizeScreen(screen: ScreenInfo): ScreenInfo {
  return {
    ...screen,
    widgets: (screen.widgets ?? []).map((w) => {
      const normalized: typeof w = {
        ...w,
        data: { ...w.data, can_id: parseCanId(w.data?.can_id) },
      };
      if (w.graph && w.graph.x_can_id !== undefined) {
        normalized.graph = { ...w.graph, x_can_id: parseCanId(w.graph.x_can_id) };
      }
      return normalized;
    }),
  };
}

async function pushFullConfigToPi(deviceId: string) {
  const allScreens = await graphicsService.getAllScreens(deviceId);
  sendConfigToPi(deviceId, { screens: allScreens });
}

export async function getScreenNames(req: Request, res: Response) {
  try {
    const screens = await graphicsService.getScreenNames(req.deviceId!);
    res.status(200).json({ screens });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function getScreenById(req: Request<{ screenId: string }>, res: Response) {
  try {
    const screenName = req.params.screenId;
    if (!screenName) {
      res.status(400).json({ msg: "Invalid request" });
      return;
    }
    const screen = await graphicsService.getScreenById(req.deviceId!, screenName);
    if (screen === null) {
      res.status(404).json({ msg: "Screen not found" });
      return;
    }
    res.status(200).json(denormalizeScreen(screen));
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function deleteScreenById(req: Request<{ screenId: string }>, res: Response) {
  try {
    const screenName = req.params.screenId;
    if (!screenName) {
      res.status(400).json({ msg: "Invalid request" });
      return;
    }
    const response = await graphicsService.deleteScreenById(req.deviceId!, screenName);
    if (response.msg === "fail") {
      res.status(404).json({ success: false });
      return;
    }
    broadcastToDeviceClients(req.deviceId!, { type: "screen_deleted", name: screenName });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function updateScreen(req: Request<{ screenId: string }>, res: Response) {
  try {
    if (!req.deviceId) {
      res.status(403).json({ msg: "No device assigned" });
      return;
    }
    const screenId = req.params.screenId;
    const screen = normalizeScreen(req.body as ScreenInfo);
    await graphicsService.saveScreen(req.deviceId, screenId, screen);
    broadcastToDeviceClients(req.deviceId, { type: "screen_updated", name: screen.name, screen });
    await pushFullConfigToPi(req.deviceId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}
