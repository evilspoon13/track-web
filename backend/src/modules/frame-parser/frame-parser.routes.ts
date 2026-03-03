import { Router } from "express";
import * as frameParserController from "./frame-parser.controller";

const router = Router();

router.get("/", frameParserController.getConfig);

router.post("/", frameParserController.updateConfig);

export default router;
