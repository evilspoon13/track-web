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

    if (!headerDeviceId) {
      res.status(400).json({ error: "Missing x-device-id header" });
      return;
    }

    const teamMembers = Array.isArray(body.teamMembers) ? body.teamMembers : [];
    const result = await devicesService.registerDevice(headerDeviceId, teamMembers);
    res.status(200).json({ msg: "Device registered", data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
