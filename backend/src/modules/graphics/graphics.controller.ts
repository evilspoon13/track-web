import type { Request, Response } from "express";
import type { ScreenInfo } from "./graphics.types";
import * as graphicsService from "./graphics.service";
import { sendConfigToPi, broadcastToDeviceClients } from "../realtime/realtime.service";

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
    res.status(200).json(screen);
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
    const screen = req.body as ScreenInfo;
    await graphicsService.saveScreen(req.deviceId, screenId, screen);
    broadcastToDeviceClients(req.deviceId, { type: "screen_updated", name: screen.name, screen });
    await pushFullConfigToPi(req.deviceId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}
