import type { Request, Response } from "express";
import * as logsService from "./logs.service";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function getLogsHandler(req: Request, res: Response) {
  try {
    const deviceId = req.query.device_id as string | undefined;
    if (!deviceId) {
      res.status(400).json({ msg: "device_id is required" });
      return;
    }

    const limitRaw = parseInt(req.query.limit as string ?? "", 10);
    const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(limitRaw, MAX_LIMIT);

    const beforeRaw = req.query.before as string | undefined;
    const beforeTs = beforeRaw !== undefined ? parseInt(beforeRaw, 10) : undefined;

    const result = await logsService.getLogs(deviceId, req.uid, limit, beforeTs);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ msg: String(error) });
  }
}
