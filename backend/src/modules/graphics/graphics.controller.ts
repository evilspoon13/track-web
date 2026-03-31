import type { Request, Response } from "express";
import type { ScreenInfo } from "./graphics.types";
import * as graphicsService from "./graphics.service";
import { sendConfigToPi } from "../realtime/realtime.service";

export async function getScreenNames(req: Request, res: Response) {
  try {
    const screens = await graphicsService.getScreenNames(req.uid);
    if (screens === null) {
      res.status(404).json({ msg: "No screens found" });
      return;
    }
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
    const screenId = req.params.screenId;
    const screen = req.body as ScreenInfo;
    await graphicsService.saveScreen(req.uid, screenId, screen);
    const driverDisplay = await graphicsService.getDriverDisplay(req.uid);
    if (driverDisplay === screen.name) {
      sendConfigToPi(screen);
    }
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
    const { screenName } = req.body as { screenName: string | null };
    await graphicsService.setDriverDisplay(req.uid, screenName ?? null);
    if (screenName) {
      const screen = await graphicsService.getScreenById(req.uid, screenName);
      if (screen) sendConfigToPi(screen);
    }
    res.status(200).json({ msg: "Driver display updated" });
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}
