import type { Request, Response } from "express";
import type { FrameDefinition, FrameParserConfig } from "./frame-parser.types";
import * as frameParserService from "./frame-parser.service";

export async function getConfig(req: Request, res: Response) {
  try {
    const config: FrameParserConfig | null = await frameParserService.readConfig(req.uid);
    if (config === null) {
      res.status(404).json({ msg: "Not Found" });
      return;
    }
    res.status(200).json(config);
  } catch (error) {
    res.status(500).json({ msg: error });
  }
}

export async function updateConfig(req: Request, res: Response) {
  try {
    const { can_id, frameDefinition } = req.body as { can_id: `0x${string}`; frameDefinition: FrameDefinition };
    await frameParserService.updateConfig(req.uid, can_id, frameDefinition);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, msg: error });
  }
}
