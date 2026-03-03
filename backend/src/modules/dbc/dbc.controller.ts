import type { Request, Response } from "express";
import * as dbcService from "./dbc.service";

export async function getDbc(_req: Request, res: Response) {
  const config = await dbcService.readDbc();
  res.status(200).json(config);
}

export async function updateDbc(req: Request, res: Response) {
  const updated = await dbcService.writeDbc(req.body);
  res.status(200).json(updated);
}
