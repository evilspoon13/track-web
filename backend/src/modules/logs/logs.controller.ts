import type { Request, Response } from "express";
import * as logsService from "./logs.service";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MS_PER_DAY = 86_400_000;

export async function getLogsHandler(req: Request, res: Response) {
  try {
    const deviceId = req.deviceId;
    if (!deviceId) {
      res.status(400).json({ msg: "No device linked to your account" });
      return;
    }

    const limitRaw = parseInt(req.query.limit as string ?? "", 10);
    const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(limitRaw, MAX_LIMIT);

    const beforeRaw = req.query.before as string | undefined;
    const beforeTs = beforeRaw !== undefined ? parseInt(beforeRaw, 10) : undefined;

    let dateStartMs: number | undefined;
    let dateEndMs: number | undefined;
    const dateRaw = req.query.date as string | undefined;
    if (dateRaw) {
      const parsed = new Date(dateRaw + "T00:00:00Z").getTime();
      if (!isNaN(parsed)) {
        dateStartMs = parsed;
        dateEndMs = parsed + MS_PER_DAY;
      }
    }

    const result = await logsService.getLogs(deviceId, limit, beforeTs, dateStartMs, dateEndMs);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ msg: String(error) });
  }
}

export async function getLogDaysHandler(req: Request, res: Response) {
  try {
    const deviceId = req.deviceId;
    if (!deviceId) {
      res.status(400).json({ msg: "No device linked to your account" });
      return;
    }

    const days = await logsService.getLogDays(deviceId);
    res.status(200).json({ days });
  } catch (error) {
    res.status(500).json({ msg: String(error) });
  }
}
