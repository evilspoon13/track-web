import type { Request, Response } from "express";
import type { RegisterDeviceBody } from "./devices.types";
import * as devicesService from "./devices.service";

function headerString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length ? v.trim() : null;
}

export async function registerDevice(req: Request, res: Response) {
  try {
    const body = req.body as Partial<RegisterDeviceBody>;
    const headerDeviceId = headerString(req.headers["x-device-id"]);
    const bodyDeviceId = typeof body.device_id === "string" && body.device_id.trim().length ? body.device_id.trim() : null;

    const deviceId = headerDeviceId ?? bodyDeviceId;
    if (!deviceId) {
      res.status(400).json({ error: "Missing device_id" });
      return;
    }

    if (headerDeviceId && bodyDeviceId && headerDeviceId !== bodyDeviceId) {
      res.status(400).json({ error: "device_id mismatch between header and body" });
      return;
    }

    const teamMembers = Array.isArray(body.teamMembers) ? body.teamMembers : [];
    const result = await devicesService.registerDevice(deviceId, teamMembers);
    res.status(200).json({ msg: "Device registered", data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

