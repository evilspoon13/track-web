import type { Request, Response } from "express";
import type { GraphicsConfig, ScreenInfo } from "./graphics.types";
import * as graphicsService from "./graphics.service";

export async function getConfig(_req: Request, res: Response) {
  try {
    const config: GraphicsConfig | null = await graphicsService.readConfig();
    res.status(200).json(config);
  }
  catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function getScreenNames(req: Request, res: Response) {
  try {
    const screens: string[] | null = await graphicsService.getScreenNames();
    if (screens === null) {
      res.status(404).json({msg: "No screens found"});
      return;
    }

    res.status(200).json({screens});
    return;
  }
  catch (error) {
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

    const screen: ScreenInfo | null = await graphicsService.getScreenById(screenName);
    if (screen === null) {
      res.status(404).json({ msg: "Screen not found" });
      return;
    }

    res.status(200).json(screen);
    return;
  }
  catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function deleteScreenById(req: Request<{ screenId: string}>, res: Response) {
  try {
    const screenName = req.params.screenId;
    if (!screenName) {
      res.status(400).json({ msg: "Invalid request" });
      return;
    }

    const response = await graphicsService.deleteScreenById(screenName);
    if (response.msg === "fail") {
      res.status(404).json({ success: false });
      return;
    }

    res.status(200).json({ success: true });
    return;
  }
  catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function updateScreen(req: Request<{ screenId: string}>, res: Response) {
  try {
    const screenId = req.params.screenId;
    const screen = req.body as ScreenInfo;
    await graphicsService.saveScreen(screenId, screen);
    res.status(200).json({ success: true });
    return;
  }
  catch (error) {
    res.status(500).json({ msg: error });
  }
}
