import type { Request, Response } from "express";
import type { ScreenInfo } from "./graphics.types";
import * as graphicsService from "./graphics.service";
import { sendConfigToPi } from "../realtime/realtime.service";

async function pushFullConfigToPi(uid: string, deviceId: string) {
  const allScreens = await graphicsService.getAllScreens(uid);
  sendConfigToPi(deviceId, { screens: allScreens });
}

export async function getScreenNames(req: Request, res: Response) {
  try {
    const screens = await graphicsService.getScreenNames(req.uid);
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
    const screen = await graphicsService.getScreenById(req.uid, screenName);
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
    const response = await graphicsService.deleteScreenById(req.uid, screenName);
    if (response.msg === "fail") {
      res.status(404).json({ success: false });
      return;
    }
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
    await graphicsService.saveScreen(req.uid, screenId, screen);
    await pushFullConfigToPi(req.uid, req.deviceId!);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function getDriverDisplayHandler(req: Request, res: Response) {
  try {
    const name = await graphicsService.getDriverDisplay(req.uid);
    res.status(200).json({ driverDisplayScreen: name });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function setDriverDisplayHandler(req: Request, res: Response) {
  try {
    if (!req.deviceId) {
      res.status(403).json({ msg: "No device assigned" });
      return;
    }
    const { screenName } = req.body as { screenName: string | null };
    if (screenName) {
      const screen = await graphicsService.getScreenById(req.uid, screenName);
      if (!screen) {
        res.status(404).json({ msg: "Screen not found" });
        return;
      }
      await graphicsService.setDriverDisplay(req.uid, screenName);
      await pushFullConfigToPi(req.uid, req.deviceId!);
    } else {
      await graphicsService.setDriverDisplay(req.uid, null);
    }
    res.status(200).json({ msg: "Driver display updated" });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}
