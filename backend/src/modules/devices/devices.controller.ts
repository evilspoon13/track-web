import type { Request, Response } from "express";
import type { RegisterDeviceBody } from "./devices.types";
import * as devicesService from "./devices.service";
import { sendMessageToPi } from "../realtime/realtime.service";

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

export async function getDevice(req: Request, res: Response) {
  try {
    const result = await devicesService.getDevice(req.deviceId!);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateTeamMembers(req: Request, res: Response) {
  try {
    const body = req.body as { team_members?: unknown };
    if (!Array.isArray(body.team_members)) {
      res.status(400).json({ error: "Missing team_members array" });
      return;
    }

    const result = await devicesService.updateTeamMembers(req.deviceId!, body.team_members);

    // Push update to Pi if it's connected
    sendMessageToPi(req.deviceId!, {
      type: "team_members_update",
      team_members: result.teamMembers,
    });

    res.status(200).json({ ok: true, team_members: result.teamMembers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
