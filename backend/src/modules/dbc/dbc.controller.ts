import type { Request, Response } from "express";
import * as dbcService from "./dbc.service";

export async function getDbc(req: Request, res: Response) {
  try {
    const config = await dbcService.readDbc(req.uid);
    if (config === null) {
      res.status(200).json({ frames: {} });
      return;
    }
    res.status(200).json(config);
  } catch {
    res.status(500).json({ msg: "Internal server error" });
  }
}

export async function updateDbc(req: Request, res: Response) {
  try {
    const result = await dbcService.writeDbc(req.uid, req.body);
    res.status(200).json(result);
  } catch {
    res.status(500).json({ msg: "Internal server error" });
  }
}

export async function uploadDbc(req: Request, res: Response) {
  try {
    const { raw } = req.body as { raw: string };
    if (!raw || typeof raw !== "string") {
      res.status(400).json({ msg: "Missing raw DBC string in body.raw" });
      return;
    }
    let config;
    try {
      config = await dbcService.uploadDbc(req.uid, raw);
    } catch {
      res.status(400).json({ msg: "Invalid DBC file — could not be parsed." });
      return;
    }
    res.status(200).json(config);
  } catch {
    res.status(500).json({ msg: "Internal server error" });
  }
}
