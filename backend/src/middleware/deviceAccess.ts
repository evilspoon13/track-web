import type { Request, Response, NextFunction } from "express";

export function requireDevice(req: Request, res: Response, next: NextFunction): void {
  if (!req.deviceId) {
    res.status(403).json({ msg: "no_device_paired" });
    return;
  }
  next();
}
