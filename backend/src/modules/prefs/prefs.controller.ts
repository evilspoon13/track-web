import type { Request, Response } from "express";
import * as prefsService from "./prefs.service";
import type { ScreenPrefs } from "./prefs.types";
import { broadcastToUserClients } from "../realtime/realtime.service";

export async function getScreenPrefs(req: Request, res: Response) {
  try {
    const prefs = await prefsService.readScreenPrefs(req.uid);
    res.status(200).json(prefs);
  } catch (error) {
    res.status(500).json({ msg: String(error) });
  }
}

export async function updateScreenPrefs(req: Request, res: Response) {
  try {
    const body = req.body as Partial<ScreenPrefs>;
    const pinnedNames = Array.isArray(body.pinnedNames)
      ? body.pinnedNames.filter((v): v is string => typeof v === "string")
      : [];
    const order = Array.isArray(body.order)
      ? body.order.filter((v): v is string => typeof v === "string")
      : [];
    const prefs: ScreenPrefs = { pinnedNames, order };
    await prefsService.writeScreenPrefs(req.uid, prefs);
    broadcastToUserClients(req.uid, { type: "screen_prefs_updated", prefs });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ msg: String(error) });
  }
}
