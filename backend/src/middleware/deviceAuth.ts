import type { Request, Response, NextFunction } from "express";

const DEVICE_SECRET = process.env.DEVICE_SECRET ?? "";

export function requireDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const id = req.headers["x-device-id"];
  const secret = req.headers["x-device-secret"];

  if (!id || !secret || secret !== DEVICE_SECRET) {
    res.status(401).json({ error: "Invalid device credentials" });
    return;
  }

  next();
}
